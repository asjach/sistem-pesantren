<?php

namespace App\Services;

use App\Models\Alumni;
use App\Models\Kelas;
use App\Models\MutasiKeluar;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Services\RefService;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

// 102 Fase B: seluruh transisi status santri. Aturan terkunci:
// - Tenant lembaga dienforce di controller; service scope per-lembaga via param eksplisit.
// - NIS sinkron (riwayat arsip + mirror master primer); tutup-lalu-buat.
// - is_aktif=true iff status_akhir='aktif' (abaikan sifat custom ref).
// - santri.status_global boolean dihitung ulang tiap transisi (false iff SELURUH riwayat non-aktif).
// - Lulus/mutasi dibaca dari tabel alumni/mutasi_keluar, TIDAK disimpan di santri.
// - Keluar/lulus/berhenti per-lembaga (paket: 1 jenjang keluar, lainnya jalan terus).
// - unique [santri,tahun,lembaga,semester] → catch 1062 re-read/retry maks 3x (pola 103).
// - no_absen bentrok per (kelas,tahun,semester) dicek di service, bukan unique DB.
class SiklusSantriService
{
    /**
     * Salin ganjil→genap dalam tahun SAMA: tutup baris '1' aktif, buat baris '2'.
     * status_awal DIKUNCI sama dengan ganjil (validasi equal). 1 aktif per santri-lembaga terjaga.
     */
    public function salinKeGenap(Santri $santri, int $lembagaId, string $tglMasukGenap, ?int $noAbsen = null, ?int $kelasId = null): RiwayatBelajar
    {
        return DB::transaction(function () use ($santri, $lembagaId, $tglMasukGenap, $noAbsen, $kelasId) {
            $santri = Santri::where('id', $santri->id)->lockForUpdate()->firstOrFail();
            $ganjil = RiwayatBelajar::where('santri_id', $santri->id)
                ->where('lembaga_id', $lembagaId)->where('is_aktif', true)
                ->lockForUpdate()->latest('id')->first();
            if (! $ganjil) throw ValidationException::withMessages(['riwayat' => 'Tidak ada riwayat aktif di lembaga ini.']);
            if ($ganjil->semester !== '1') abort(422, 'Salin genap wajib dari baris ganjil (semester 1) yang aktif.');
            if (RiwayatBelajar::where('santri_id', $santri->id)->where('lembaga_id', $lembagaId)
                ->where('tahun_ajaran_id', $ganjil->tahun_ajaran_id)->where('semester', '2')->exists()) {
                throw ValidationException::withMessages(['riwayat' => 'Baris genap tahun ini sudah ada.']);
            }
            if (! is_null($noAbsen)) $this->cekBentrokAbsen($kelasId ?? $ganjil->kelas_id, $ganjil->tahun_ajaran_id, '2', $noAbsen);
            // Tutup ganjil sebagai arsip semester — PENGECUALIAN invariant kedua (selain berhenti-jenjang):
            // status_akhir dipertahankan 'aktif' + is_aktif=false (selaras 002:480 "ganjil ditutup arsip").
            $ganjil->update(['is_aktif' => false]);
            $usaha = 0;
            while (true) {
                try {
                    $genap = RiwayatBelajar::create([
                        'santri_id' => $santri->id,
                        'tahun_ajaran_id' => $ganjil->tahun_ajaran_id,
                        'lembaga_id' => $lembagaId,
                        'kelas_id' => $kelasId ?? $ganjil->kelas_id,
                        'semester' => '2',
                        'tgl_masuk' => $tglMasukGenap,
                        'no_absen' => $noAbsen,
                        'nis' => $ganjil->nis,
                        'tingkat' => $ganjil->tingkat,
                        'status_awal' => $ganjil->status_awal, // KUNCI: sama dengan ganjil
                        'status_akhir' => 'aktif',
                        'is_aktif' => true,
                    ]);
                    break;
                } catch (QueryException $e) {
                    if (($e->errorInfo[1] ?? null) !== 1062 || ++$usaha >= 3) throw $e;
                    $genap = RiwayatBelajar::where('santri_id', $santri->id)
                        ->where('tahun_ajaran_id', $ganjil->tahun_ajaran_id)->where('lembaga_id', $lembagaId)
                        ->where('semester', '2')->first();
                    if ($genap) break; // race dobel-klik → baca ulang, idempoten
                }
            }
            $this->hitungUlangStatusGlobal($santri->fresh());
            return $genap;
        });
    }

    /** Cek bentrok no_absen per (kelas, tahun, semester); null/kelas-null lolos. */
    protected function cekBentrokAbsen($kelasId, int $tahunAjaranId, string $semester, int $noAbsen): void
    {
        if (! $kelasId || ! $noAbsen) return;
        $bentrok = RiwayatBelajar::where('kelas_id', $kelasId)
            ->where('tahun_ajaran_id', $tahunAjaranId)->where('semester', $semester)
            ->where('no_absen', $noAbsen)->exists();
        if ($bentrok) throw ValidationException::withMessages(['no_absen' => 'No. absen sudah dipakai di rombel semester ini.']);
    }

    /**
     * Kenaikan genap→ganjil tahun BARU: tutup baris '2' aktif, buat ganjil tahun baru.
     * $status: 'naik' (tingkat+1) atau 'tidak_naik' (tingkat sama, mengulang). kelas_id=null, penempatan menyusul.
     */
    public function prosesKenaikanPerSantri(Santri $santri, int $lembagaId, int $tahunBaruId, string $tingkat, string $status, ?string $nis, ?string $tglMasuk = null, ?int $noAbsen = null): RiwayatBelajar
    {
        return DB::transaction(function () use ($santri, $lembagaId, $tahunBaruId, $tingkat, $status, $nis, $tglMasuk, $noAbsen) {
            $santri = Santri::where('id', $santri->id)->lockForUpdate()->firstOrFail();
            $lama = RiwayatBelajar::where('santri_id', $santri->id)
                ->where('lembaga_id', $lembagaId)->where('is_aktif', true)
                ->lockForUpdate()->latest('id')->first();
            if (! $lama) throw ValidationException::withMessages(['riwayat' => 'Tidak ada riwayat aktif di lembaga ini.']);
            if ($lama->semester !== '2') abort(422, 'Kenaikan wajib dari baris genap (semester 2) yang aktif — salin ke genap dulu.');
            if (! in_array($status, ['naik', 'tidak_naik'], true)) abort(422, 'Status harus naik/tidak_naik.');
            // Validasi ke ref efektif lembaga (boleh custom per lembaga).
            $akhirLama = $status; // 'naik' / 'tidak_naik' adalah kode status_akhir
            $awalBaru = $status === 'naik' ? 'kenaikan' : 'mengulang'; // root PRD: kenaikan, bukan naik_kelas
            foreach ([['status_akhir', $akhirLama], ['status_awal', $awalBaru], ['status_akhir', 'aktif']] as [$t, $k]) {
                if (! in_array($k, RefService::kodeAktif($t, $lembagaId), true)) abort(422, "Status $k tidak aktif di lembaga ini.");
            }

            // INVARIANT terkunci: is_aktif=true iff status_akhir='aktif'. Jangan baca sifat custom
            // (shadow ref tidak boleh mengubah sifat) — tutup selalu false, baris baru selalu true.
            $lama->update(['status_akhir' => $akhirLama, 'is_aktif' => false]);

            $usaha = 0;
            while (true) {
                try {
                    $baru = RiwayatBelajar::create([
                        'santri_id' => $santri->id,
                        'tahun_ajaran_id' => $tahunBaruId,
                        'lembaga_id' => $lembagaId,
                        'kelas_id' => null,
                        'semester' => '1',
                        'tgl_masuk' => $tglMasuk,
                        'no_absen' => $noAbsen,
                        'nis' => $nis ?? $lama->nis,
                        'tingkat' => $tingkat,
                        'status_awal' => $awalBaru,
                        'status_akhir' => 'aktif',
                        'is_aktif' => true, // invariant: true iff 'aktif'
                    ]);
                    break;
                } catch (QueryException $e) {
                    if (($e->errorInfo[1] ?? null) !== 1062 || ++$usaha >= 3) throw $e;
                    $baru = RiwayatBelajar::where('santri_id', $santri->id)
                        ->where('tahun_ajaran_id', $tahunBaruId)->where('lembaga_id', $lembagaId)
                        ->where('semester', '1')->first();
                    if ($baru) break; // race dobel-klik → baca ulang, idempoten
                }
            }
            // Mirror master hanya untuk lembaga primer (santri.lembaga_id).
            if ((int) $santri->lembaga_id === (int) $lembagaId) {
                $santri->update(['nis' => $baru->nis, 'kelas_id' => null]);
            }
            $this->hitungUlangStatusGlobal($santri->fresh());
            return $baru;
        });
    }

    /**
     * Kenaikan massal per-item partial: satu batch = satu lembaga + satu tahun + satu tingkat.
     * Tiap item independen (transaksi sendiri); gagal satu tidak menggagalkan lainnya.
     * $items: [['santri_id'=>int,'status'=>'naik|tidak_naik','nis'=>?string,'tgl_masuk'=>?string,'no_absen'=>?int], ...]
     * Return: ['berhasil'=>int,'gagal'=>[['santri_id'=>?int,'pesan'=>string],...],'data'=>RiwayatBelajar[]].
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
                    $item['nis'] ?? null,
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

    /** Pindah kelas dalam tahun berjalan (riwayat aktif yang sama). */
    public function pindahKelas(RiwayatBelajar $riwayat, int $kelasBaruId): RiwayatBelajar
    {
        return DB::transaction(function () use ($riwayat, $kelasBaruId) {
            $riwayat = RiwayatBelajar::where('id', $riwayat->id)->lockForUpdate()->firstOrFail();
            if (! $riwayat->is_aktif) abort(422, 'Riwayat tidak aktif.');
            $kelas = Kelas::findOrFail($kelasBaruId);
            if ((int) $kelas->lembaga_id !== (int) $riwayat->lembaga_id) abort(422, 'Kelas beda lembaga.');
            if ((int) $kelas->tahun_ajaran_id !== (int) $riwayat->tahun_ajaran_id) abort(422, 'Kelas beda tahun ajaran.');
            if ($riwayat->tingkat && $kelas->tingkat && $riwayat->tingkat !== $kelas->tingkat) abort(422, 'Tingkat kelas tidak cocok.');
            $riwayat->update(['kelas_id' => $kelas->id]);
            $santri = $riwayat->santri;
            if ((int) $santri->lembaga_id === (int) $riwayat->lembaga_id) $santri->update(['kelas_id' => $kelas->id]);
            return $riwayat->fresh();
        });
    }

    /** Penempatan kelas menyusul untuk baris kelas_id=null. */
    public function setKelas(RiwayatBelajar $riwayat, int $kelasId): RiwayatBelajar
    {
        return $this->pindahKelas($riwayat, $kelasId);
    }

    /** Mutasi per lembaga (paket: 1 jenjang keluar, lainnya jalan terus). */
    public function prosesMutasiPerLembaga(Santri $santri, int $lembagaId, array $dataMutasi): MutasiKeluar
    {
        return DB::transaction(function () use ($santri, $lembagaId, $dataMutasi) {
            $santri = Santri::where('id', $santri->id)->lockForUpdate()->firstOrFail();
            if (! in_array('pindah_keluar', RefService::kodeAktif('status_akhir', $lembagaId), true)) abort(422, 'Status pindah_keluar nonaktif di lembaga ini.');
            // Alasan mutasi wajib terdaftar di kamus efektif lembaga (ref_alasan_mutasi).
            if (! in_array($dataMutasi['alasan_mutasi'], RefService::kodeAktif('alasan_mutasi', $lembagaId), true)) abort(422, 'Alasan mutasi tidak aktif di lembaga ini.');
            $diubah = RiwayatBelajar::where('santri_id', $santri->id)->where('lembaga_id', $lembagaId)
                ->where('is_aktif', true)->lockForUpdate()
                ->update(['status_akhir' => 'pindah_keluar', 'is_aktif' => false]); // invariant: non-'aktif' selalu false
            if ($diubah === 0) {
                abort(422, 'Santri tidak memiliki riwayat aktif di lembaga ini.');
            }
            $mutasi = MutasiKeluar::create([
                'santri_id' => $santri->id,
                'lembaga_id' => $lembagaId,
                'kelas_terakhir_id' => $dataMutasi['kelas_terakhir_id'],
                'tanggal_mutasi' => $dataMutasi['tanggal_mutasi'],
                'alasan_mutasi' => $dataMutasi['alasan_mutasi'],
                'no_surat' => $dataMutasi['no_surat'] ?? null,
                'nama_sekolah_tujuan' => $dataMutasi['nama_sekolah_tujuan'] ?? null,
                'npsn_sekolah_tujuan' => $dataMutasi['npsn_sekolah_tujuan'] ?? null,
                'nsm_sekolah_tujuan' => $dataMutasi['nsm_sekolah_tujuan'] ?? null,
                'alamat_sekolah_tujuan' => $dataMutasi['alamat_sekolah_tujuan'] ?? null,
                'keterangan' => $dataMutasi['keterangan'] ?? null,
            ]);
            $this->hitungUlangStatusGlobal($santri->fresh());
            return $mutasi;
        });
    }

    /** Lulus per lembaga + baris alumni (max 1 per santri). */
    public function prosesLulusPerLembaga(Santri $santri, int $lembagaId, array $dataLulus): Alumni
    {
        return DB::transaction(function () use ($santri, $lembagaId, $dataLulus) {
            $santri = Santri::where('id', $santri->id)->lockForUpdate()->firstOrFail();
            if (! in_array('lulus', RefService::kodeAktif('status_akhir', $lembagaId), true)) abort(422, 'Status lulus nonaktif di lembaga ini.');
            $diubah = RiwayatBelajar::where('santri_id', $santri->id)->where('lembaga_id', $lembagaId)
                ->where('is_aktif', true)->lockForUpdate()
                ->update(['status_akhir' => 'lulus', 'is_aktif' => false]); // invariant: non-'aktif' selalu false
            if ($diubah === 0) {
                abort(422, 'Santri tidak memiliki riwayat aktif di lembaga ini.');
            }
            // NOTE last-wins terkunci: alumni unique per santri (002) — paket MI+MD yang lulus
            // berurutan akan menimpa baris yang sama; lembaga terakhir menang. Jangan ubah ke
            // unique per-lembaga tanpa pembahasan (menyentuh 100/101/103/504).
            $atribut = ['lembaga_lulus_id' => $lembagaId,
                'tahun_ajaran_lulus_id' => $dataLulus['tahun_ajaran_lulus_id'],
                'nomor_ijazah' => $dataLulus['nomor_ijazah'] ?? null,
                'no_surat_ijazah' => $dataLulus['no_surat_ijazah'] ?? null,
                'tanggal_lulus' => $dataLulus['tanggal_lulus'],
                'kegiatan_setelah_lulus' => $dataLulus['kegiatan_setelah_lulus'] ?? null,
                'penyerahan_ijazah' => $dataLulus['penyerahan_ijazah'] ?? 'belum',
                'melanjutkan' => $dataLulus['melanjutkan'] ?? null,
                'catatan' => $dataLulus['catatan'] ?? null];
            // Lock santri+riwayat di atas sudah serialisasi per-santri; race alumni antar-admin untuk santri
            // yang sama ditangani via 1062 re-read/retry maks 3x (pola 103).
            $usaha = 0;
            while (true) {
                try {
                    $alumni = Alumni::updateOrCreate(['santri_id' => $santri->id], $atribut);
                    break;
                } catch (QueryException $e) {
                    if (($e->errorInfo[1] ?? null) !== 1062 || ++$usaha >= 3) throw $e;
                    $alumni = Alumni::where('santri_id', $santri->id)->lockForUpdate()->first();
                    if ($alumni) {
                        $alumni->update($atribut);
                        $alumni = $alumni->fresh();
                        break;
                    }
                }
            }
            $this->hitungUlangStatusGlobal($santri->fresh());
            return $alumni;
        });
    }

    /**
     * Tidak lulus (root PRD): tutup baris aktif (status_akhir tidak_lulus) + buka
     * baris tapel BERIKUT (status_awal mengulang, tingkat sama, semester 1).
     * Tanpa baris alumni (alumni hanya untuk lulusan). TA berikut wajib sudah ada.
     */
    public function prosesTidakLulus(Santri $santri, int $lembagaId, array $data): RiwayatBelajar
    {
        return DB::transaction(function () use ($santri, $lembagaId, $data) {
            $santri = Santri::where('id', $santri->id)->lockForUpdate()->firstOrFail();
            if (! in_array('tidak_lulus', RefService::kodeAktif('status_akhir', $lembagaId), true)) abort(422, 'Status tidak_lulus nonaktif di lembaga ini.');
            if (! in_array('mengulang', RefService::kodeAktif('status_awal', $lembagaId), true)) abort(422, 'Status mengulang nonaktif di lembaga ini.');
            $aktif = RiwayatBelajar::where('santri_id', $santri->id)->where('lembaga_id', $lembagaId)
                ->where('is_aktif', true)->lockForUpdate()->latest('id')->get();
            if ($aktif->isEmpty()) {
                abort(422, 'Santri tidak memiliki riwayat aktif di lembaga ini.');
            }
            foreach ($aktif as $row) {
                $row->update(['status_akhir' => 'tidak_lulus', 'is_aktif' => false]);
            }
            $taLama = TahunAjaran::find($aktif->first()->tahun_ajaran_id);
            $taBerikut = TahunAjaran::where('lembaga_id', $lembagaId)
                ->when($taLama?->tanggal_mulai, fn ($q, $mulai) => $q->where('tanggal_mulai', '>', $mulai))
                ->orderBy('tanggal_mulai')->orderBy('id')->first();
            if (! $taBerikut) {
                abort(422, 'Tahun ajaran berikut belum ada di lembaga ini — buat dulu sebelum proses tidak lulus.');
            }
            $usaha = 0;
            while (true) {
                try {
                    $baru = RiwayatBelajar::create([
                        'santri_id' => $santri->id,
                        'tahun_ajaran_id' => $taBerikut->id,
                        'lembaga_id' => $lembagaId,
                        'kelas_id' => null,
                        'semester' => '1',
                        'nis' => $aktif->first()->nis,
                        'tingkat' => $aktif->first()->tingkat,
                        'status_awal' => 'mengulang',
                        'status_akhir' => 'aktif',
                        'is_aktif' => true,
                    ]);
                    break;
                } catch (QueryException $e) {
                    if (($e->errorInfo[1] ?? null) !== 1062 || ++$usaha >= 3) throw $e;
                    $baru = RiwayatBelajar::where('santri_id', $santri->id)
                        ->where('tahun_ajaran_id', $taBerikut->id)->where('lembaga_id', $lembagaId)
                        ->where('semester', '1')->first();
                    if ($baru) break;
                }
            }
            $this->hitungUlangStatusGlobal($santri->fresh());

            return $baru->fresh();
        });
    }

    /**
     * Berhenti satu jenjang (paket MI-MD: MD berhenti, MI lanjut).
     * PENGECUALIAN invariant yang disengaja: status_akhir dipertahankan sebagai arsip
     * ('aktif') dengan is_aktif=false agar riwayat paket tetap terbaca sebagai "berhenti",
     * bukan lulus/mutasi. santri.status_global dihitung ulang (false hanya jika SEMUA non-aktif).
     */
    public function nonAktifkanRiwayat(Santri $santri, int $lembagaId, ?string $catatan = null)
    {
        return DB::transaction(function () use ($santri, $lembagaId, $catatan) {
            RiwayatBelajar::where('santri_id', $santri->id)
                ->where('lembaga_id', $lembagaId)
                ->where('is_aktif', true)->lockForUpdate()
                ->update(['is_aktif' => false]);
            $this->hitungUlangStatusGlobal($santri->fresh());
        });
    }

    /**
     * Flag aktif: true jika punya ≥1 riwayat aktif, false jika tidak.
     * Lulus/mutasi TIDAK ditulis ke santri — dibaca dari tabel alumni / mutasi_keluar.
     */
    public function hitungUlangStatusGlobal(Santri $santri): Santri
    {
        $adaAktif = RiwayatBelajar::where('santri_id', $santri->id)->where('is_aktif', true)->exists();
        $santri->update(['status_global' => $adaAktif]);
        return $santri->fresh();
    }

    // ---- Alias nama generik (tugas 102 Fase A+B); implementasi = method spec di atas. ----

    /** Alias: mutasi keluar per lembaga. */
    public function mutasiKeluar(Santri $santri, int $lembagaId, array $dataMutasi): MutasiKeluar
    {
        return $this->prosesMutasiPerLembaga($santri, $lembagaId, $dataMutasi);
    }

    /** Alias: kelulusan per lembaga. */
    public function luluskan(Santri $santri, int $lembagaId, array $dataLulus): Alumni
    {
        return $this->prosesLulusPerLembaga($santri, $lembagaId, $dataLulus);
    }

    /** Alias: berhenti satu jenjang paket. */
    public function berhentiJenjang(Santri $santri, int $lembagaId, ?string $catatan = null)
    {
        return $this->nonAktifkanRiwayat($santri, $lembagaId, $catatan);
    }

    /** Alias: hitung ulang flag aktif santri. */
    public function recalcStatusGlobal(Santri $santri): Santri
    {
        return $this->hitungUlangStatusGlobal($santri);
    }
}
