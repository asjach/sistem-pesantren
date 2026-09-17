<?php

namespace App\Services;

use App\Models\Alumni;
use App\Models\Kelas;
use App\Models\LembagaSantri;
use App\Models\MutasiKeluar;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * 102 — transisi akademik santri (semua lewat service ini):
 * - `riwayat_belajar` = jejak kelas/semester (tanpa NIS; NIS ada di `lembaga_santri`).
 * - `is_aktif=true` iff `status_akhir='aktif'` (abaikan sifat custom ref).
 * - `santri.status_global` dihitung ulang tiap transisi (true iff ada ≥1 riwayat aktif).
 * - Mutasi/lulus menutup riwayat + keanggotaan (`lembaga_santri`); arsip di
 *   `mutasi_keluar`/`alumni`.
 * - Paket MI+MD: satu jenjang keluar/lulus tidak menghentikan jenjang lain.
 * - unique [santri,tahun,lembaga,semester] → catch 1062 re-read/retry (pola 103).
 */
class SiklusSantriService
{
    /** Salin ganjil→genap dalam tahun SAMA: tutup baris '1' aktif, buat baris '2'. */
    public function salinKeGenap(Santri $santri, int $lembagaId, string $tglMasukGenap, ?int $noAbsen = null, ?int $kelasId = null): RiwayatBelajar
    {
        return DB::transaction(function () use ($santri, $lembagaId, $tglMasukGenap, $noAbsen, $kelasId) {
            $santri = Santri::whereKey($santri->id)->lockForUpdate()->firstOrFail();
            $ganjil = RiwayatBelajar::where('santri_id', $santri->id)
                ->where('lembaga_id', $lembagaId)->where('is_aktif', true)
                ->lockForUpdate()->latest('id')->first();
            if (! $ganjil) {
                throw ValidationException::withMessages(['riwayat' => 'Tidak ada riwayat aktif di lembaga ini.']);
            }
            if ($ganjil->semester !== '1') {
                abort(422, 'Salin genap wajib dari baris ganjil (semester 1) yang aktif.');
            }
            if (RiwayatBelajar::where('santri_id', $santri->id)->where('lembaga_id', $lembagaId)
                ->where('tahun_ajaran_id', $ganjil->tahun_ajaran_id)->where('semester', '2')->exists()) {
                throw ValidationException::withMessages(['riwayat' => 'Baris genap tahun ini sudah ada.']);
            }
            if (! is_null($noAbsen)) {
                $this->cekBentrokAbsen($kelasId ?? $ganjil->kelas_id, $ganjil->tahun_ajaran_id, '2', $noAbsen);
            }
            // Tutup ganjil sebagai arsip semester: status_akhir dipertahankan 'aktif', is_aktif=false.
            $ganjil->update(['is_aktif' => false]);

            $genap = $this->buatRiwayatDenganRetry($santri->id, [
                'tahun_ajaran_id' => $ganjil->tahun_ajaran_id,
                'lembaga_id' => $lembagaId,
                'kelas_id' => $kelasId ?? $ganjil->kelas_id,
                'semester' => '2',
                'tgl_masuk' => $tglMasukGenap,
                'no_absen' => $noAbsen,
                'tingkat' => $ganjil->tingkat,
                'status_awal' => $ganjil->status_awal, // KUNCI: sama dengan ganjil
                'status_akhir' => 'aktif',
                'is_aktif' => true,
            ], where: fn ($q) => $q->where('tahun_ajaran_id', $ganjil->tahun_ajaran_id)
                ->where('lembaga_id', $lembagaId)->where('semester', '2'));

            $santri->hitungUlangStatusGlobal();

            return $genap;
        });
    }

    /** Cek bentrok no_absen per (kelas, tahun, semester); null/kelas-null lolos. */
    public function cekBentrokAbsen($kelasId, int $tahunAjaranId, string $semester, int $noAbsen): void
    {
        if (! $kelasId || ! $noAbsen) {
            return;
        }
        $bentrok = RiwayatBelajar::where('kelas_id', $kelasId)
            ->where('tahun_ajaran_id', $tahunAjaranId)->where('semester', $semester)
            ->where('no_absen', $noAbsen)->exists();
        if ($bentrok) {
            throw ValidationException::withMessages(['no_absen' => 'No. absen sudah dipakai di rombel semester ini.']);
        }
    }

    /**
     * Kenaikan genap→ganjil tahun BARU: tutup baris '2' aktif, buat ganjil tahun baru.
     * $status: 'naik' (tingkat+1) atau 'tidak_naik' (tingkat sama, mengulang). kelas_id=null.
     */
    public function prosesKenaikanPerSantri(Santri $santri, int $lembagaId, int $tahunBaruId, string $tingkat, string $status, ?string $tglMasuk = null, ?int $noAbsen = null): RiwayatBelajar
    {
        return DB::transaction(function () use ($santri, $lembagaId, $tahunBaruId, $tingkat, $status, $tglMasuk, $noAbsen) {
            $santri = Santri::whereKey($santri->id)->lockForUpdate()->firstOrFail();
            $lama = RiwayatBelajar::where('santri_id', $santri->id)
                ->where('lembaga_id', $lembagaId)->where('is_aktif', true)
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
                if (! in_array($k, RefService::kodeAktif($t, $lembagaId), true)) {
                    abort(422, "Status $k tidak aktif di lembaga ini.");
                }
            }

            $lama->update(['status_akhir' => $akhirLama, 'is_aktif' => false]);

            $this->pastikanKeanggotaanAktif($santri, $lembagaId);

            $baru = $this->buatRiwayatDenganRetry($santri->id, [
                'tahun_ajaran_id' => $tahunBaruId,
                'lembaga_id' => $lembagaId,
                'kelas_id' => null,
                'semester' => '1',
                'tgl_masuk' => $tglMasuk,
                'no_absen' => $noAbsen,
                'tingkat' => $tingkat,
                'status_awal' => $awalBaru,
                'status_akhir' => 'aktif',
                'is_aktif' => true,
            ], where: fn ($q) => $q->where('tahun_ajaran_id', $tahunBaruId)
                ->where('lembaga_id', $lembagaId)->where('semester', '1'));

            $santri->hitungUlangStatusGlobal();

            return $baru;
        });
    }

    /**
     * Kenaikan massal per-item partial: satu batch = satu lembaga + satu tahun + satu tingkat.
     * $items: [['santri_id'=>int,'status'=>'naik|tidak_naik','tgl_masuk'=>?string,'no_absen'=>?int], ...]
     *
     * @return array{berhasil: int, gagal: array<int, array{santri_id: ?int, pesan: string}>, data: array<int, RiwayatBelajar>}
     */
    public function naikMassal(int $lembagaId, int $tahunBaruId, string $tingkat, array $items): array
    {
        $berhasil = 0;
        $gagal = [];
        $data = [];
        foreach ($items as $item) {
            try {
                $santri = Santri::findOrFail($item['santri_id'] ?? 0);
                $data[] = $this->prosesKenaikanPerSantri(
                    $santri,
                    $lembagaId,
                    $tahunBaruId,
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
            if (! $riwayat->is_aktif) {
                abort(422, 'Riwayat tidak aktif.');
            }
            $kelas = Kelas::findOrFail($kelasBaruId);
            if ((int) $kelas->lembaga_id !== (int) $riwayat->lembaga_id) {
                abort(422, 'Kelas beda lembaga.');
            }
            if ((int) $kelas->tahun_ajaran_id !== (int) $riwayat->tahun_ajaran_id) {
                abort(422, 'Kelas beda tahun ajaran.');
            }
            if ($riwayat->tingkat && $kelas->tingkat && $riwayat->tingkat !== $kelas->tingkat) {
                abort(422, 'Tingkat kelas tidak cocok.');
            }
            $riwayat->update(['kelas_id' => $kelas->id]);

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
            if (! $riwayat->is_aktif) {
                abort(422, 'Riwayat tidak aktif.');
            }
            $riwayat->update(['kelas_id' => null]);

            return $riwayat->fresh();
        });
    }

    /** Mutasi per lembaga: tutup riwayat + keanggotaan, catat arsip `mutasi_keluar`. */
    public function prosesMutasiPerLembaga(Santri $santri, int $lembagaId, array $dataMutasi): MutasiKeluar
    {
        return DB::transaction(function () use ($santri, $lembagaId, $dataMutasi) {
            $santri = Santri::whereKey($santri->id)->lockForUpdate()->firstOrFail();
            if (! in_array('pindah_keluar', RefService::kodeAktif('status_akhir', $lembagaId), true)) {
                abort(422, 'Status pindah_keluar nonaktif di lembaga ini.');
            }
            if (! in_array($dataMutasi['alasan_mutasi'], RefService::kodeAktif('alasan_mutasi', $lembagaId), true)) {
                abort(422, 'Alasan mutasi tidak aktif di lembaga ini.');
            }

            $diubah = RiwayatBelajar::where('santri_id', $santri->id)->where('lembaga_id', $lembagaId)
                ->where('is_aktif', true)->lockForUpdate()
                ->update(['status_akhir' => 'pindah_keluar', 'is_aktif' => false]);
            if ($diubah === 0) {
                abort(422, 'Santri tidak memiliki riwayat aktif di lembaga ini.');
            }
            $this->tutupKeanggotaan($santri, $lembagaId, $dataMutasi['tanggal_mutasi'] ?? null);

            $mutasi = MutasiKeluar::create([
                'santri_id' => $santri->id,
                'lembaga_id' => $lembagaId,
                // Beku otomatis dari riwayat terakhir; input manual tetap menang bila diisi.
                'kelas_terakhir_id' => $dataMutasi['kelas_terakhir_id']
                    ?? RiwayatBelajar::where('santri_id', $santri->id)
                        ->where('lembaga_id', $lembagaId)
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
    public function prosesLulusPerLembaga(Santri $santri, int $lembagaId, array $dataLulus): Alumni
    {
        return DB::transaction(function () use ($santri, $lembagaId, $dataLulus) {
            $santri = Santri::whereKey($santri->id)->lockForUpdate()->firstOrFail();
            if (! in_array('lulus', RefService::kodeAktif('status_akhir', $lembagaId), true)) {
                abort(422, 'Status lulus nonaktif di lembaga ini.');
            }

            $diubah = RiwayatBelajar::where('santri_id', $santri->id)->where('lembaga_id', $lembagaId)
                ->where('is_aktif', true)->lockForUpdate()
                ->update(['status_akhir' => 'lulus', 'is_aktif' => false]);
            if ($diubah === 0) {
                abort(422, 'Santri tidak memiliki riwayat aktif di lembaga ini.');
            }
            $this->tutupKeanggotaan($santri, $lembagaId, $dataLulus['tanggal_lulus'] ?? null);

            $atribut = [
                'lembaga_lulus_id' => $lembagaId,
                'kelas_lulus_id' => RiwayatBelajar::where('santri_id', $santri->id)
                    ->where('lembaga_id', $lembagaId)
                    ->where('status_akhir', 'lulus')
                    ->latest('id')->value('kelas_id'),
                'tahun_ajaran_lulus_id' => $dataLulus['tahun_ajaran_lulus_id'],
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
    public function prosesTidakLulus(Santri $santri, int $lembagaId, array $data = []): RiwayatBelajar
    {
        return DB::transaction(function () use ($santri, $lembagaId) {
            $santri = Santri::whereKey($santri->id)->lockForUpdate()->firstOrFail();
            if (! in_array('tidak_lulus', RefService::kodeAktif('status_akhir', $lembagaId), true)) {
                abort(422, 'Status tidak_lulus nonaktif di lembaga ini.');
            }
            if (! in_array('mengulang', RefService::kodeAktif('status_awal', $lembagaId), true)) {
                abort(422, 'Status mengulang nonaktif di lembaga ini.');
            }
            $aktif = RiwayatBelajar::where('santri_id', $santri->id)->where('lembaga_id', $lembagaId)
                ->where('is_aktif', true)->lockForUpdate()->latest('id')->get();
            if ($aktif->isEmpty()) {
                abort(422, 'Santri tidak memiliki riwayat aktif di lembaga ini.');
            }
            foreach ($aktif as $row) {
                $row->update(['status_akhir' => 'tidak_lulus', 'is_aktif' => false]);
            }

            $taBerikut = (new PenerimaanService)->tahunAjaranBerikut($lembagaId, $aktif->first());
            if (! $taBerikut) {
                abort(422, 'Tahun ajaran berikut belum ada di lembaga ini — buat dulu sebelum proses tidak lulus.');
            }

            $this->pastikanKeanggotaanAktif($santri, $lembagaId);

            $baru = $this->buatRiwayatDenganRetry($santri->id, [
                'tahun_ajaran_id' => $taBerikut->id,
                'lembaga_id' => $lembagaId,
                'kelas_id' => null,
                'semester' => '1',
                'tingkat' => $aktif->first()->tingkat,
                'status_awal' => 'mengulang',
                'status_akhir' => 'aktif',
                'is_aktif' => true,
            ], where: fn ($q) => $q->where('tahun_ajaran_id', $taBerikut->id)
                ->where('lembaga_id', $lembagaId)->where('semester', '1'));

            $santri->hitungUlangStatusGlobal();

            return $baru->fresh();
        });
    }

    /**
     * Berhenti satu jenjang (paket MI-MD: MD berhenti, MI lanjut): tutup riwayat
     * aktif + keanggotaan lembaga tsb. `status_akhir` dipertahankan sebagai arsip.
     */
    public function nonAktifkanRiwayat(Santri $santri, int $lembagaId, ?string $catatan = null)
    {
        return DB::transaction(function () use ($santri, $lembagaId) {
            RiwayatBelajar::where('santri_id', $santri->id)
                ->where('lembaga_id', $lembagaId)
                ->where('is_aktif', true)->lockForUpdate()
                ->update(['is_aktif' => false]);
            $this->tutupKeanggotaan($santri, $lembagaId, null);
            $santri->hitungUlangStatusGlobal();
        });
    }

    /** Hitung ulang `santri.status_global` (true iff ada ≥1 riwayat aktif). */
    public function hitungUlangStatusGlobal(Santri $santri): Santri
    {
        $santri->hitungUlangStatusGlobal();

        return $santri->fresh();
    }

    // ---- Alias nama generik ----

    public function mutasiKeluar(Santri $santri, int $lembagaId, array $dataMutasi): MutasiKeluar
    {
        return $this->prosesMutasiPerLembaga($santri, $lembagaId, $dataMutasi);
    }

    public function luluskan(Santri $santri, int $lembagaId, array $dataLulus): Alumni
    {
        return $this->prosesLulusPerLembaga($santri, $lembagaId, $dataLulus);
    }

    public function berhentiJenjang(Santri $santri, int $lembagaId, ?string $catatan = null)
    {
        return $this->nonAktifkanRiwayat($santri, $lembagaId, $catatan);
    }

    public function recalcStatusGlobal(Santri $santri): Santri
    {
        return $this->hitungUlangStatusGlobal($santri);
    }

    // ---- Internal ----

    /** Keanggotaan aktif wajib ada saat transisi riwayat (buat bila belum ada). */
    protected function pastikanKeanggotaanAktif(Santri $santri, int $lembagaId): LembagaSantri
    {
        return LembagaSantri::aktif($santri->id, $lembagaId)
            ?? LembagaSantri::create([
                'santri_id' => $santri->id,
                'lembaga_id' => $lembagaId,
                'is_active' => true,
            ]);
    }

    /** Tutup keanggotaan aktif santri di lembaga (mutasi/lulus/berhenti). */
    protected function tutupKeanggotaan(Santri $santri, int $lembagaId, ?string $tglSelesai): void
    {
        LembagaSantri::where('santri_id', $santri->id)
            ->where('lembaga_id', $lembagaId)
            ->where('is_active', true)
            ->lockForUpdate()
            ->update([
                'is_active' => false,
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
