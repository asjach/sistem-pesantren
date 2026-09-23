<?php

namespace App\Services;

use App\Models\Alumni;
use App\Models\Kelas;
use App\Models\LembagaSantri;
use App\Models\MutasiKeluar;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * 102 — transisi akademik santri (semua lewat service ini):
 * - `riwayat_belajar` = jejak kelas/semester (tanpa NIS; NIS ada di `lembaga_santri`).
 * - `is_active_riwayat='Ya'` iff `status_akhir='aktif'` (abaikan sifat custom ref).
 * - `santri.is_active_pst` dihitung ulang tiap transisi ('Ya' iff ada ≥1 riwayat aktif).
 * - Mutasi/lulus menutup riwayat + keanggotaan (`lembaga_santri`); arsip di
 *   `mutasi_keluar`/`alumni`.
 * - Paket MI+MD: satu jenjang keluar/lulus tidak menghentikan jenjang lain.
 * - unique [santri,tahun,lembaga,semester] → catch 1062 re-read/retry (pola 103).
 */
class SiklusSantriService
{
    /** Salin ganjil→genap dalam tahun SAMA: tutup baris '1' aktif, buat baris '2'. */
    public function salinKeGenap(Santri $santri, string $jenjang, string $tglMasukGenap, ?int $noAbsen = null, ?int $kelasId = null): RiwayatBelajar
    {
        return DB::transaction(function () use ($santri, $jenjang, $tglMasukGenap, $noAbsen, $kelasId) {
            $santri = Santri::whereKey($santri->id)->lockForUpdate()->firstOrFail();
            $ganjil = RiwayatBelajar::where('santri_id', $santri->id)
                ->where('jenjang', $jenjang)->where('is_active_riwayat', RiwayatBelajar::YA)
                ->lockForUpdate()->latest('id')->first();
            if (! $ganjil) {
                throw ValidationException::withMessages(['riwayat' => 'Tidak ada riwayat aktif di lembaga ini.']);
            }
            if ($ganjil->semester !== '1') {
                abort(422, 'Salin genap wajib dari baris ganjil (semester 1) yang aktif.');
            }
            if (RiwayatBelajar::where('santri_id', $santri->id)->where('jenjang', $jenjang)
                ->where('tahun_ajaran', $ganjil->tahun_ajaran)->where('semester', '2')->exists()) {
                throw ValidationException::withMessages(['riwayat' => 'Baris genap tahun ini sudah ada.']);
            }
            if (! is_null($noAbsen)) {
                $this->cekBentrokAbsen($kelasId ?? $ganjil->kelas_id, $ganjil->tahun_ajaran, '2', $noAbsen);
            }
            // Tutup ganjil sebagai arsip semester: status_akhir dipertahankan 'aktif', is_active_riwayat='Tidak'.
            $ganjil->update(['is_active_riwayat' => RiwayatBelajar::TIDAK]);

            $genap = $this->buatRiwayatDenganRetry($santri->id, [
                'tahun_ajaran' => $ganjil->tahun_ajaran,
                'jenjang' => $jenjang,
                'kelas_id' => $kelasId ?? $ganjil->kelas_id,
                'semester' => '2',
                'tgl_masuk' => $tglMasukGenap,
                'no_absen' => $noAbsen,
                'tingkat' => $ganjil->tingkat,
                'status_awal' => 'lanjutan', // KUNCI: masuk semester 2 selalu lanjutan (bukan warisan ganjil)
                'status_akhir' => 'aktif',
                'is_active_riwayat' => RiwayatBelajar::YA,
            ], where: fn ($q) => $q->where('tahun_ajaran', $ganjil->tahun_ajaran)
                ->where('jenjang', $jenjang)->where('semester', '2'));

            $santri->hitungUlangStatusGlobal();

            return $genap;
        });
    }

    /** Cek bentrok no_absen per (kelas, tahun, semester); null/kelas-null lolos. */
    public function cekBentrokAbsen($kelasId, string $tahunAjaran, string $semester, int $noAbsen): void
    {
        if (! $kelasId || ! $noAbsen) {
            return;
        }
        $bentrok = RiwayatBelajar::where('kelas_id', $kelasId)
            ->where('tahun_ajaran', $tahunAjaran)->where('semester', $semester)
            ->where('no_absen', $noAbsen)->exists();
        if ($bentrok) {
            throw ValidationException::withMessages(['no_absen' => 'No. absen sudah dipakai di rombel semester ini.']);
        }
    }

    /**
     * Kenaikan genap→ganjil tahun BARU: tutup baris '2' aktif, buat ganjil tahun baru.
     * $status: 'naik' (tingkat+1) atau 'tidak_naik' (tingkat sama, mengulang). kelas_id=null.
     */
    public function prosesKenaikanPerSantri(Santri $santri, string $jenjang, string $tahunBaru, string $tingkat, string $status, ?string $tglMasuk = null, ?int $noAbsen = null): RiwayatBelajar
    {
        return DB::transaction(function () use ($santri, $jenjang, $tahunBaru, $tingkat, $status, $tglMasuk, $noAbsen) {
            $santri = Santri::whereKey($santri->id)->lockForUpdate()->firstOrFail();
            $lama = RiwayatBelajar::where('santri_id', $santri->id)
                ->where('jenjang', $jenjang)->where('is_active_riwayat', RiwayatBelajar::YA)
                ->lockForUpdate()->latest('id')->first();
            if (! $lama) {
                throw ValidationException::withMessages(['riwayat' => 'Tidak ada riwayat aktif di lembaga ini.']);
            }
            if ($lama->semester !== '2') {
                abort(422, 'Kenaikan wajib dari baris genap (semester 2) yang aktif — salin ke genap dulu.');
            }
            if (! in_array($status, ['naik', 'tidak_naik'], true)) {
                abort(422, 'Status harus naik/tidak_naik.');
            }
            $akhirLama = $status;
            $awalBaru = $status === 'naik' ? 'kenaikan' : 'mengulang';
            foreach ([['status_akhir', $akhirLama], ['status_awal', $awalBaru], ['status_akhir', 'aktif']] as [$t, $k]) {
                if (! in_array($k, RefService::kodeAktif($t, $jenjang), true)) {
                    abort(422, "Status $k tidak aktif di lembaga ini.");
                }
            }

            $lama->update(['status_akhir' => $akhirLama, 'is_active_riwayat' => RiwayatBelajar::TIDAK]);

            $this->pastikanKeanggotaanAktif($santri, $jenjang);

            $baru = $this->buatRiwayatDenganRetry($santri->id, [
                'tahun_ajaran' => $tahunBaru,
                'jenjang' => $jenjang,
                'kelas_id' => null,
                'semester' => '1',
                'tgl_masuk' => $tglMasuk,
                'no_absen' => $noAbsen,
                'tingkat' => $tingkat,
                'status_awal' => $awalBaru,
                'status_akhir' => 'aktif',
                'is_active_riwayat' => RiwayatBelajar::YA,
            ], where: fn ($q) => $q->where('tahun_ajaran', $tahunBaru)
                ->where('jenjang', $jenjang)->where('semester', '1'));

            $santri->hitungUlangStatusGlobal();

            return $baru;
        });
    }

    /**
     * Kenaikan otomatis genap→ganjil: TA + kelas tujuan dibuatkan bila belum
     * ada. Naik: tingkat+1, kelas angka+1 (1A→2A, 12-A→13-A, 12→13);
     * tidak_naik: tingkat + kelas senama. Baris lama ditutup dengan
     * status_akhir naik/tidak_naik; baris baru status_awal
     * kenaikan/mengulang, status_akhir aktif.
     */
    public function prosesKenaikanOtomatis(Santri $santri, string $jenjang, string $status, ?string $tglMasuk = null): RiwayatBelajar
    {
        return DB::transaction(function () use ($santri, $jenjang, $status, $tglMasuk) {
            $santri = Santri::whereKey($santri->id)->lockForUpdate()->firstOrFail();
            $lama = RiwayatBelajar::where('santri_id', $santri->id)
                ->where('jenjang', $jenjang)->where('is_active_riwayat', RiwayatBelajar::YA)
                ->lockForUpdate()->latest('id')->first();
            if (! $lama) {
                throw ValidationException::withMessages(['riwayat' => 'Tidak ada riwayat aktif di lembaga ini.']);
            }
            if ($lama->semester !== '2') {
                abort(422, 'Kenaikan wajib dari baris genap (semester 2) yang aktif — salin ke genap dulu.');
            }
            if (! in_array($status, ['naik', 'tidak_naik'], true)) {
                abort(422, 'Status harus naik/tidak_naik.');
            }
            // Hanya tingkat 1–5; tingkat akhir lewat halaman Kelulusan.
            if (! preg_match('/^[1-5]$/', (string) $lama->tingkat)) {
                throw ValidationException::withMessages(['tingkat' => 'Tingkat akhir diproses lewat halaman Kelulusan.']);
            }
            $awalBaru = $status === 'naik' ? 'kenaikan' : 'mengulang';
            foreach ([['status_akhir', $status], ['status_awal', $awalBaru], ['status_akhir', 'aktif']] as [$t, $k]) {
                if (! in_array($k, RefService::kodeAktif($t, $jenjang), true)) {
                    abort(422, "Status $k tidak aktif di lembaga ini.");
                }
            }

            $taBaru = $this->taBerikutnya($lama->tahun_ajaran, $jenjang);
            $tingkatBaru = $status === 'naik' ? (string) ((int) $lama->tingkat + 1) : (string) $lama->tingkat;
            $kelasBaruId = $this->kelasKenaikan(
                $jenjang, $taBaru->nama, $lama->kelas?->nama_kelas, $tingkatBaru, $status === 'naik'
            );

            $lama->update(['status_akhir' => $status, 'is_active_riwayat' => RiwayatBelajar::TIDAK]);

            $this->pastikanKeanggotaanAktif($santri, $jenjang);

            $baru = $this->buatRiwayatDenganRetry($santri->id, [
                'tahun_ajaran' => $taBaru->nama,
                'jenjang' => $jenjang,
                'kelas_id' => $kelasBaruId,
                'semester' => '1',
                'tgl_masuk' => $tglMasuk,
                'no_absen' => null,
                'tingkat' => $tingkatBaru,
                'status_awal' => $awalBaru,
                'status_akhir' => 'aktif',
                'is_active_riwayat' => RiwayatBelajar::YA,
            ], where: fn ($q) => $q->where('tahun_ajaran', $taBaru->nama)
                ->where('jenjang', $jenjang)->where('semester', '1'));

            $santri->hitungUlangStatusGlobal();

            return $baru;
        });
    }

    /** TA berikutnya ("2026/2027"→"2027/2028"); buatkan bila belum ada. */
    protected function taBerikutnya(string $ta, string $jenjang): TahunAjaran
    {
        $lama = TahunAjaran::find($ta);
        if (! $lama || ! preg_match(TahunAjaran::POLA, (string) $lama->nama, $m)) {
            abort(422, 'Nama tahun ajaran tak berpola tahun (YYYY/YYYY).');
        }
        $namaBaru = ((int) $m[1] + 1).'/'.((int) $m[2] + 1);
        $ada = TahunAjaran::efektif($jenjang)->firstWhere('nama', $namaBaru);
        if ($ada) {
            return $ada;
        }

        return TahunAjaran::create([
            'nama' => $namaBaru,
            'tanggal_mulai' => null, 'tanggal_selesai' => null,
            'is_aktif' => false,
        ]);
    }

    /**
     * Kelas tujuan di TA baru (firstOrCreate). Nama wajib berangka depan:
     * naik menambah angkanya (1A→2A, 12-A→13-A, 12→13); tidak_naik senama.
     *
     * @return int|null null bila baris lama tanpa kelas (tetap tanpa kelas).
     */
    protected function kelasKenaikan(string $jenjang, string $taBaru, ?string $namaLama, string $tingkatBaru, bool $naik): ?int
    {
        if ($namaLama === null || trim($namaLama) === '') {
            return null;
        }
        if (! preg_match('/^(\d+)(.*)$/', trim($namaLama), $m)) {
            throw ValidationException::withMessages(['kelas' => "Nama kelas \"{$namaLama}\" tak berangka depan (mis. 1A)."]);
        }
        $namaBaru = $naik ? ((int) $m[1] + 1).$m[2] : trim($namaLama);
        $kelas = Kelas::firstOrCreate(
            ['jenjang' => $jenjang, 'tahun_ajaran' => $taBaru, 'nama_kelas' => $namaBaru],
            ['tingkat' => $tingkatBaru]
        );

        return $kelas->id;
    }

    /**
     * Batalkan kenaikan: hapus baris baru (kenaikan/mengulang yang masih
     * aktif) dan buka kembali baris lama yang ditutupnya. Hanya bila belum
     * ada transisi lanjutan (baris baru masih aktif).
     */
    public function batalKenaikan(Santri $santri, string $jenjang): RiwayatBelajar
    {
        return DB::transaction(function () use ($santri, $jenjang) {
            $santri = Santri::whereKey($santri->id)->lockForUpdate()->firstOrFail();
            $baru = RiwayatBelajar::where('santri_id', $santri->id)
                ->where('jenjang', $jenjang)->where('is_active_riwayat', RiwayatBelajar::YA)
                ->whereIn('status_awal', ['kenaikan', 'mengulang'])
                ->lockForUpdate()->latest('id')->first();
            if (! $baru) {
                throw ValidationException::withMessages(['riwayat' => 'Tidak ada hasil kenaikan aktif yang bisa dibatalkan.']);
            }
            $lama = RiwayatBelajar::where('santri_id', $santri->id)
                ->where('jenjang', $jenjang)->where('is_active_riwayat', RiwayatBelajar::TIDAK)
                ->whereIn('status_akhir', ['naik', 'tidak_naik'])
                ->where('id', '!=', $baru->id)
                ->lockForUpdate()->latest('id')->first();
            if (! $lama) {
                throw ValidationException::withMessages(['riwayat' => 'Baris asal kenaikan tidak ditemukan.']);
            }

            $baru->delete();
            // Invarian: is_active_riwayat='Ya' iff status_akhir='aktif'.
            $lama->update(['status_akhir' => 'aktif', 'is_active_riwayat' => RiwayatBelajar::YA]);

            $santri->hitungUlangStatusGlobal();

            return $lama->fresh();
        });
    }

    /**
     * Batalkan salin semester: hapus baris genap aktif dan pastikan baris
     * ganjil TA sama kembali aktif. Ganjil boleh masih aktif (baris genap
     * dari import tidak menutup ganjil) — cukup hapus genapnya. Hanya bila
     * belum ada transisi lanjutan (baris aktif terbaru masih semester 2).
     */
    public function batalSalin(Santri $santri, string $jenjang): RiwayatBelajar
    {
        return DB::transaction(function () use ($santri, $jenjang) {
            $santri = Santri::whereKey($santri->id)->lockForUpdate()->firstOrFail();
            $genap = RiwayatBelajar::where('santri_id', $santri->id)
                ->where('jenjang', $jenjang)->where('is_active_riwayat', RiwayatBelajar::YA)
                ->lockForUpdate()->latest('id')->first();
            if (! $genap || $genap->semester !== '2') {
                throw ValidationException::withMessages(['riwayat' => 'Tidak ada salin semester aktif yang bisa dibatalkan.']);
            }
            $ganjil = RiwayatBelajar::where('santri_id', $santri->id)
                ->where('jenjang', $jenjang)
                ->where('tahun_ajaran', $genap->tahun_ajaran)->where('semester', '1')
                ->where('id', '!=', $genap->id)
                ->lockForUpdate()->latest('id')->first();
            if (! $ganjil) {
                throw ValidationException::withMessages(['riwayat' => 'Baris ganjil asal tidak ditemukan.']);
            }

            $genap->delete();
            // Ganjil dari salin tertutup (buka lagi); ganjil dari import
            // masih aktif (no-op) — akhir: santri kembali ke semester 1.
            $ganjil->update(['is_active_riwayat' => RiwayatBelajar::YA]);

            $santri->hitungUlangStatusGlobal();

            return $ganjil->fresh();
        });
    }

    /**
     * Kenaikan massal per-item partial: satu batch = satu lembaga + satu tahun + satu tingkat.
     * $items: [['santri_id'=>int,'status'=>'naik|tidak_naik','tgl_masuk'=>?string,'no_absen'=>?int], ...]
     *
     * @return array{berhasil: int, gagal: array<int, array{santri_id: ?int, pesan: string}>, data: array<int, RiwayatBelajar>}
     */
    public function naikMassal(string $jenjang, string $tahunBaru, string $tingkat, array $items): array
    {
        $berhasil = 0;
        $gagal = [];
        $data = [];
        foreach ($items as $item) {
            try {
                $santri = Santri::findOrFail($item['santri_id'] ?? 0);
                $data[] = $this->prosesKenaikanPerSantri(
                    $santri,
                    $jenjang,
                    $tahunBaru,
                    $tingkat,
                    $item['status'] ?? '',
                    $item['tgl_masuk'] ?? null,
                    $item['no_absen'] ?? null
                );
                $berhasil++;
            } catch (\Throwable $e) {
                $gagal[] = ['santri_id' => $item['santri_id'] ?? null, 'pesan' => $e->getMessage()];
            }
        }

        return ['berhasil' => $berhasil, 'gagal' => $gagal, 'data' => $data];
    }

    /** Pindah/penempatan kelas dalam tahun berjalan (riwayat aktif yang sama). */
    public function pindahKelas(RiwayatBelajar $riwayat, int $kelasBaruId): RiwayatBelajar
    {
        return DB::transaction(function () use ($riwayat, $kelasBaruId) {
            $riwayat = RiwayatBelajar::whereKey($riwayat->id)->lockForUpdate()->firstOrFail();
            if ($riwayat->is_active_riwayat !== RiwayatBelajar::YA) {
                abort(422, 'Riwayat tidak aktif.');
            }
            $kelas = Kelas::findOrFail($kelasBaruId);
            if ($kelas->jenjang !== $riwayat->jenjang) {
                abort(422, 'Kelas beda lembaga.');
            }
            if ($kelas->tahun_ajaran !== $riwayat->tahun_ajaran) {
                abort(422, 'Kelas beda tahun ajaran.');
            }
            if ($riwayat->tingkat && $kelas->tingkat && $riwayat->tingkat !== $kelas->tingkat) {
                abort(422, 'Tingkat kelas tidak cocok.');
            }
            // Tingkat kosong mewarisi kelas tujuan.
            $upd = ['kelas_id' => $kelas->id];
            if (empty($riwayat->tingkat) && ! empty($kelas->tingkat)) {
                $upd['tingkat'] = $kelas->tingkat;
            }
            $riwayat->update($upd);

            return $riwayat->fresh();
        });
    }

    /** Penempatan kelas menyusul untuk baris kelas_id=null. */
    public function setKelas(RiwayatBelajar $riwayat, int $kelasId): RiwayatBelajar
    {
        return $this->pindahKelas($riwayat, $kelasId);
    }

    /** Keluarkan santri dari kelas (penempatan dibatalkan): kelas_id=NULL. */
    public function keluarKelas(RiwayatBelajar $riwayat): RiwayatBelajar
    {
        return DB::transaction(function () use ($riwayat) {
            $riwayat = RiwayatBelajar::whereKey($riwayat->id)->lockForUpdate()->firstOrFail();
            if ($riwayat->is_active_riwayat !== RiwayatBelajar::YA) {
                abort(422, 'Riwayat tidak aktif.');
            }
            $riwayat->update(['kelas_id' => null]);

            return $riwayat->fresh();
        });
    }

    /**
     * Batalkan baris riwayat (HARD DELETE fisik): dipakai halaman Riwayat
     * Belajar semester ganjil untuk membatalkan pemasukan yang salah.
     * Hanya baris aktif; arsip (is_active_riwayat='Tidak') adalah jejak sejarah.
     * Keanggotaan `lembaga_santri` dipertahankan; `is_active_pst` dihitung ulang.
     */
    public function hapusRiwayat(RiwayatBelajar $riwayat): void
    {
        DB::transaction(function () use ($riwayat) {
            $baris = RiwayatBelajar::whereKey($riwayat->id)->lockForUpdate()->firstOrFail();
            if ($baris->is_active_riwayat !== RiwayatBelajar::YA) {
                abort(422, 'Hanya riwayat aktif yang bisa dibatalkan.');
            }
            $santriId = $baris->santri_id;
            $baris->delete();

            Santri::whereKey($santriId)->firstOrFail()->hitungUlangStatusGlobal();
        });
    }

    /** Mutasi per lembaga: tutup riwayat + keanggotaan, catat arsip `mutasi_keluar`. */
    public function prosesMutasiPerLembaga(Santri $santri, string $jenjang, array $dataMutasi): MutasiKeluar
    {
        return DB::transaction(function () use ($santri, $jenjang, $dataMutasi) {
            $santri = Santri::whereKey($santri->id)->lockForUpdate()->firstOrFail();
            if (! in_array('pindah_keluar', RefService::kodeAktif('status_akhir', $jenjang), true)) {
                abort(422, 'Status pindah_keluar nonaktif di lembaga ini.');
            }
            if (! in_array($dataMutasi['alasan_mutasi'], RefService::kodeAktif('alasan_mutasi', $jenjang), true)) {
                abort(422, 'Alasan mutasi tidak aktif di lembaga ini.');
            }

            $diubah = RiwayatBelajar::where('santri_id', $santri->id)->where('jenjang', $jenjang)
                ->where('is_active_riwayat', RiwayatBelajar::YA)->lockForUpdate()
                ->update(['status_akhir' => 'pindah_keluar', 'is_active_riwayat' => RiwayatBelajar::TIDAK]);
            if ($diubah === 0) {
                abort(422, 'Santri tidak memiliki riwayat aktif di lembaga ini.');
            }
            $this->tutupKeanggotaan($santri, $jenjang, $dataMutasi['tanggal_mutasi'] ?? null);

            $mutasi = MutasiKeluar::create([
                'santri_id' => $santri->id,
                'jenjang' => $jenjang,
                // Beku otomatis dari riwayat terakhir; input manual tetap menang bila diisi.
                'kelas_terakhir_id' => $dataMutasi['kelas_terakhir_id']
                    ?? RiwayatBelajar::where('santri_id', $santri->id)
                        ->where('jenjang', $jenjang)
                        ->where('status_akhir', 'pindah_keluar')
                        ->latest('id')->value('kelas_id'),
                'tanggal_mutasi' => $dataMutasi['tanggal_mutasi'],
                'alasan_mutasi' => $dataMutasi['alasan_mutasi'],
                'no_surat' => $dataMutasi['no_surat'] ?? null,
                'nama_sekolah_tujuan' => $dataMutasi['nama_sekolah_tujuan'] ?? null,
                'npsn_sekolah_tujuan' => $dataMutasi['npsn_sekolah_tujuan'] ?? null,
                'nsm_sekolah_tujuan' => $dataMutasi['nsm_sekolah_tujuan'] ?? null,
                'alamat_sekolah_tujuan' => $dataMutasi['alamat_sekolah_tujuan'] ?? null,
                'keterangan' => $dataMutasi['keterangan'] ?? null,
            ]);
            $santri->hitungUlangStatusGlobal();

            return $mutasi;
        });
    }

    /** Lulus per lembaga: tutup riwayat + keanggotaan, arsip `alumni` (1 baris per santri). */
    public function prosesLulusPerLembaga(Santri $santri, string $jenjang, array $dataLulus): Alumni
    {
        return DB::transaction(function () use ($santri, $jenjang, $dataLulus) {
            $santri = Santri::whereKey($santri->id)->lockForUpdate()->firstOrFail();
            if (! in_array('lulus', RefService::kodeAktif('status_akhir', $jenjang), true)) {
                abort(422, 'Status lulus nonaktif di lembaga ini.');
            }

            $diubah = RiwayatBelajar::where('santri_id', $santri->id)->where('jenjang', $jenjang)
                ->where('is_active_riwayat', RiwayatBelajar::YA)->lockForUpdate()
                ->update(['status_akhir' => 'lulus', 'is_active_riwayat' => RiwayatBelajar::TIDAK]);
            if ($diubah === 0) {
                abort(422, 'Santri tidak memiliki riwayat aktif di lembaga ini.');
            }
            $this->tutupKeanggotaan($santri, $jenjang, $dataLulus['tanggal_lulus'] ?? null);

            $atribut = [
                'lembaga_lulus' => $jenjang,
                'kelas_lulus_id' => RiwayatBelajar::where('santri_id', $santri->id)
                    ->where('jenjang', $jenjang)
                    ->where('status_akhir', 'lulus')
                    ->latest('id')->value('kelas_id'),
                'tahun_ajaran_lulus' => $dataLulus['tahun_ajaran_lulus'],
                'nomor_ijazah' => $dataLulus['nomor_ijazah'] ?? null,
                'no_surat_ijazah' => $dataLulus['no_surat_ijazah'] ?? null,
                'tanggal_lulus' => $dataLulus['tanggal_lulus'],
                'kegiatan_setelah_lulus' => $dataLulus['kegiatan_setelah_lulus'] ?? null,
                'penyerahan_ijazah' => $dataLulus['penyerahan_ijazah'] ?? 'belum',
                'melanjutkan' => $dataLulus['melanjutkan'] ?? null,
                'catatan' => $dataLulus['catatan'] ?? null,
            ];
            // NOTE last-wins terkunci: alumni unique per santri — paket MI+MD yang lulus
            // berurutan menimpa baris yang sama (lembaga terakhir menang).
            $usaha = 0;
            while (true) {
                try {
                    $alumni = Alumni::updateOrCreate(['santri_id' => $santri->id], $atribut);
                    break;
                } catch (QueryException $e) {
                    if (($e->errorInfo[1] ?? null) !== 1062 || ++$usaha >= 3) {
                        throw $e;
                    }
                    $alumni = Alumni::where('santri_id', $santri->id)->lockForUpdate()->first();
                    if ($alumni) {
                        $alumni->update($atribut);
                        $alumni = $alumni->fresh();
                        break;
                    }
                }
            }
            $santri->hitungUlangStatusGlobal();

            return $alumni;
        });
    }

    /**
     * Tidak lulus: tutup baris aktif (status_akhir tidak_lulus) + buka baris TA
     * BERIKUT (status_awal mengulang, tingkat sama, semester 1). Keanggotaan tetap aktif.
     */
    public function prosesTidakLulus(Santri $santri, string $jenjang, array $data = []): RiwayatBelajar
    {
        return DB::transaction(function () use ($santri, $jenjang) {
            $santri = Santri::whereKey($santri->id)->lockForUpdate()->firstOrFail();
            if (! in_array('tidak_lulus', RefService::kodeAktif('status_akhir', $jenjang), true)) {
                abort(422, 'Status tidak_lulus nonaktif di lembaga ini.');
            }
            if (! in_array('mengulang', RefService::kodeAktif('status_awal', $jenjang), true)) {
                abort(422, 'Status mengulang nonaktif di lembaga ini.');
            }
            $aktif = RiwayatBelajar::where('santri_id', $santri->id)->where('jenjang', $jenjang)
                ->where('is_active_riwayat', RiwayatBelajar::YA)->lockForUpdate()->latest('id')->get();
            if ($aktif->isEmpty()) {
                abort(422, 'Santri tidak memiliki riwayat aktif di lembaga ini.');
            }
            foreach ($aktif as $row) {
                $row->update(['status_akhir' => 'tidak_lulus', 'is_active_riwayat' => RiwayatBelajar::TIDAK]);
            }

            $taBerikut = (new PenerimaanService)->tahunAjaranBerikut($jenjang, $aktif->first());
            if (! $taBerikut) {
                abort(422, 'Tahun ajaran berikut belum ada di lembaga ini — buat dulu sebelum proses tidak lulus.');
            }

            $this->pastikanKeanggotaanAktif($santri, $jenjang);

            $baru = $this->buatRiwayatDenganRetry($santri->id, [
                'tahun_ajaran' => $taBerikut->nama,
                'jenjang' => $jenjang,
                'kelas_id' => null,
                'semester' => '1',
                'tingkat' => $aktif->first()->tingkat,
                'status_awal' => 'mengulang',
                'status_akhir' => 'aktif',
                'is_active_riwayat' => RiwayatBelajar::YA,
            ], where: fn ($q) => $q->where('tahun_ajaran', $taBerikut->nama)
                ->where('jenjang', $jenjang)->where('semester', '1'));

            $santri->hitungUlangStatusGlobal();

            return $baru->fresh();
        });
    }

    /**
     * Berhenti satu jenjang (paket MI-MD: MD berhenti, MI lanjut): tutup riwayat
     * aktif + keanggotaan lembaga tsb. `status_akhir` dipertahankan sebagai arsip.
     */
    public function nonAktifkanRiwayat(Santri $santri, string $jenjang, ?string $catatan = null)
    {
        return DB::transaction(function () use ($santri, $jenjang) {
            RiwayatBelajar::where('santri_id', $santri->id)
                ->where('jenjang', $jenjang)
                ->where('is_active_riwayat', RiwayatBelajar::YA)->lockForUpdate()
                ->update(['is_active_riwayat' => RiwayatBelajar::TIDAK]);
            $this->tutupKeanggotaan($santri, $jenjang, null);
            $santri->hitungUlangStatusGlobal();
        });
    }

    /** Hitung ulang `santri.is_active_pst` ('Ya' iff ada ≥1 riwayat aktif). */
    public function hitungUlangStatusGlobal(Santri $santri): Santri
    {
        $santri->hitungUlangStatusGlobal();

        return $santri->fresh();
    }

    /**
     * Sinkronkan jejak aktif per (santri, jenjang) — dipakai impor historis &
     * backfill data lama: hanya baris periode TERAKHIR (tahun ajaran desc, lalu
     * semester desc) yang aktif, dan itu pun hanya bila `status_akhir='aktif'`;
     * baris lain diarsipkan. Menegakkan invarian "maks 1 riwayat aktif per
     * santri+lembaga" yang selama ini dilanggar hasil impor (semua ganjil
     * bersejarah ikut `Ya`).
     */
    public function sinkronkanAktifRiwayat(int $santriId, string $jenjang): void
    {
        $baris = RiwayatBelajar::where('santri_id', $santriId)
            ->where('jenjang', $jenjang)
            ->orderByDesc('tahun_ajaran')
            ->orderByDesc('semester')
            ->orderByDesc('id')
            ->get();

        $terakhir = $baris->first();
        $idAktif = $terakhir !== null && $terakhir->status_akhir === 'aktif' ? $terakhir->id : null;

        foreach ($baris as $r) {
            $nilai = $r->id === $idAktif ? RiwayatBelajar::YA : RiwayatBelajar::TIDAK;
            if ($r->is_active_riwayat !== $nilai) {
                $r->update(['is_active_riwayat' => $nilai]);
            }
        }
    }

    // ---- Alias nama generik ----

    public function mutasiKeluar(Santri $santri, string $jenjang, array $dataMutasi): MutasiKeluar
    {
        return $this->prosesMutasiPerLembaga($santri, $jenjang, $dataMutasi);
    }

    public function luluskan(Santri $santri, string $jenjang, array $dataLulus): Alumni
    {
        return $this->prosesLulusPerLembaga($santri, $jenjang, $dataLulus);
    }

    public function berhentiJenjang(Santri $santri, string $jenjang, ?string $catatan = null)
    {
        return $this->nonAktifkanRiwayat($santri, $jenjang, $catatan);
    }

    public function recalcStatusGlobal(Santri $santri): Santri
    {
        return $this->hitungUlangStatusGlobal($santri);
    }

    // ---- Internal ----

    /** Keanggotaan aktif wajib ada saat transisi riwayat (buat bila belum ada). */
    protected function pastikanKeanggotaanAktif(Santri $santri, string $jenjang): LembagaSantri
    {
        return LembagaSantri::aktif($santri->id, $jenjang)
            ?? LembagaSantri::create([
                'santri_id' => $santri->id,
                'jenjang' => $jenjang,
                'is_active_lembaga' => LembagaSantri::YA,
            ]);
    }

    /** Tutup keanggotaan aktif santri di lembaga (mutasi/lulus/berhenti). */
    protected function tutupKeanggotaan(Santri $santri, string $jenjang, ?string $tglSelesai): void
    {
        LembagaSantri::where('santri_id', $santri->id)
            ->where('jenjang', $jenjang)
            ->where('is_active_lembaga', LembagaSantri::YA)
            ->lockForUpdate()
            ->update([
                'is_active_lembaga' => LembagaSantri::TIDAK,
                'tgl_selesai' => $tglSelesai ?? now()->toDateString(),
            ]);
    }

    /**
     * Buat riwayat + retry 1062: baca ulang baris yang sudah ada (race dobel-klik).
     *
     * @param  array<string, mixed>  $atribut
     */
    protected function buatRiwayatDenganRetry(int $santriId, array $atribut, callable $where): RiwayatBelajar
    {
        $usaha = 0;
        while (true) {
            try {
                return RiwayatBelajar::create(array_merge(['santri_id' => $santriId], $atribut));
            } catch (QueryException $e) {
                if (($e->errorInfo[1] ?? null) !== 1062 || ++$usaha >= 3) {
                    throw $e;
                }
                $ada = RiwayatBelajar::where('santri_id', $santriId)->where($where)->first();
                if ($ada) {
                    return $ada;
                }
            }
        }
    }
}
