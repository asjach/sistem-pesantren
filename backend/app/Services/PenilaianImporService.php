<?php

namespace App\Services;

use App\Models\Ekstrakurikuler;
use App\Models\KegiatanEvaluatif;
use App\Models\KomponenNilai;
use App\Models\MataPelajaran;
use App\Models\NilaiEkstrakurikuler;
use App\Models\NilaiKomponen;
use App\Models\NilaiSantri;
use App\Models\PengampuMapel;
use App\Models\PrestasiSantri;
use App\Models\RaporCatatanWali;
use Illuminate\Support\Facades\DB;

/**
 * Impor modul Penilaian — satu layanan untuk EMPAT template terpisah
 * (keputusan PRD):
 *  1. `nilai`        — leger wide: kolom tetap + kolom MAPEL dinamis.
 *                      Konteks `komponen_id` = null → nilai akhir kegiatanEvaluatif
 *                      (impor langsung); terisi → skor komponen (hitung ulang).
 *  2. `catatan_wali` — ketidakhadiran + catatan + status kenaikan.
 *  3. `prestasi`     — satu baris per prestasi.
 *  4. `ekskul`       — pasangan kolom `ekskul{n}` + `predikat{n}`.
 *
 * Semua nilai terikat KEGIATAN EVALUATIF (`kegiatan_evaluatif_id` wajib untuk tipe `nilai`).
 * Kunci pencocokan santri: `nis_lokal` + `jenjang` (unik per lembaga); `nama`
 * jadi pembanding bila diisi. Santri di luar cakupan kegiatanEvaluatif (mis. tingkat
 * akhir pada ASAT) ditolak dengan pesan jelas.
 */
class PenilaianImporService extends ImporPotongan
{
    /** Kolom tetap (bukan mapel) pada template `nilai`. */
    private const KOLOM_TETAP_NILAI = [
        'nis_lokal', 'nama', 'jenjang', 'kelas', 'tahun_ajaran', 'semester',
    ];

    private PenilaianService $nilai;

    /** @var array<string, int|null> */
    private array $cacheSantri = [];

    private array $cacheKelas = [];

    private array $cacheMapel = [];

    private array $cachePengampu = [];

    private array $cacheEkskul = [];

    private array $cacheTingkat = [];

    private ?KegiatanEvaluatif $kegiatanEvaluatif = null;

    /**
     * @param  string  $tipe  nilai|catatan_wali|prestasi|ekskul
     * @param  string  $tahunAjaran  TA konteks (kolom file boleh menimpa)
     * @param  string  $semester  semester konteks (kolom file boleh menimpa)
     * @param  list<string>  $jenjang  jenjang yang boleh diakses pengguna
     * @param  int|null  $kegiatanEvaluatifId  kegiatanEvaluatif target (wajib untuk tipe `nilai`)
     * @param  int|null  $komponenId  komponen target (null = isi nilai akhir)
     */
    public function __construct(
        private string $tipe,
        private string $tahunAjaran,
        private string $semester,
        private array $jenjang,
        private ?int $kegiatanEvaluatifId = null,
        private ?int $komponenId = null,
        ?PenilaianService $nilai = null,
    ) {
        $this->nilai = $nilai ?? new PenilaianService;
    }

    public function normalisasiBaris(array $baris): array
    {
        $keluar = [];
        foreach ($baris as $kunci => $nilai) {
            $k = strtolower(trim((string) $kunci));
            if ($nilai === null) {
                $keluar[$k] = null;

                continue;
            }
            $keluar[$k] = is_string($nilai) ? trim($nilai) : $nilai;
        }

        return $this->castTanggal($keluar);
    }

    protected function prosesBaris(array $baris, int $no, bool $kering): void
    {
        $nis = $this->teks($baris, 'nis_lokal');
        $jenjang = $this->teks($baris, 'jenjang') ?? ($this->jenjang[0] ?? null);
        $this->kunciAktif = $nis;

        if ($nis === null) {
            $this->fail($no, 'nis_lokal', 'NIS lokal wajib diisi.');

            return;
        }
        if ($jenjang === null || ! in_array($jenjang, $this->jenjang, true)) {
            $this->fail($no, 'jenjang', "Jenjang '{$jenjang}' tidak dikenali / di luar akses Anda.");

            return;
        }

        $santriId = $this->santriId($nis, $jenjang);
        if ($santriId === null) {
            $this->fail($no, 'nis_lokal', "Santri dengan NIS {$nis} tidak ditemukan di jenjang {$jenjang}.");

            return;
        }

        $nama = $this->teks($baris, 'nama');
        if ($nama !== null) {
            $namaDb = (string) DB::table('santri')->where('id', $santriId)->value('nama_lengkap');
            if ($this->normalkan($nama) !== $this->normalkan($namaDb)) {
                $this->fail($no, 'nama', "Nama tidak cocok dengan NIS {$nis} (DB: {$namaDb}).");

                return;
            }
        }

        $ta = $this->teks($baris, 'tahun_ajaran') ?? $this->tahunAjaran;
        $semester = $this->teks($baris, 'semester') ?? $this->semester;

        $this->valid++;

        match ($this->tipe) {
            'nilai' => $this->prosesNilai($baris, $no, $kering, $santriId, $jenjang, $ta, $semester),
            'catatan_wali' => $this->prosesCatatanWali($baris, $no, $kering, $santriId, $jenjang, $ta, $semester),
            'prestasi' => $this->prosesPrestasi($baris, $no, $kering, $santriId, $ta, $semester),
            'ekskul' => $this->prosesEkskul($baris, $no, $kering, $santriId, $jenjang, $ta, $semester),
            default => $this->fail($no, 'tipe', "Tipe impor '{$this->tipe}' tidak dikenal."),
        };
    }

    /** @param array<string, mixed> $baris */
    private function prosesNilai(array $baris, int $no, bool $kering, int $santriId, string $jenjang, string $ta, string $semester): void
    {
        $kegiatanEvaluatif = $this->kegiatanEvaluatif();
        if ($kegiatanEvaluatif === null) {
            $this->fail($no, 'kegiatan_evaluatif', 'Kegiatan Evaluatif penilaian tidak ditemukan / tidak dipilih.');

            return;
        }

        $tingkat = $this->tingkat($santriId, $jenjang, $ta, $semester);
        if (! $this->nilai->tingkatCocokCakupan($kegiatanEvaluatif, $tingkat)) {
            $this->fail($no, 'nis_lokal', "Santri tidak termasuk peserta kegiatanEvaluatif {$kegiatanEvaluatif->kode} (cakupan: {$kegiatanEvaluatif->cakupan}).");

            return;
        }

        $namaKelas = $this->teks($baris, 'kelas');
        if ($namaKelas === null) {
            $this->fail($no, 'kelas', 'Kelas wajib diisi (dipakai mencari pengampu mapel).');

            return;
        }
        $kelasId = $this->kelasId($jenjang, $ta, $namaKelas);
        if ($kelasId === null) {
            $this->fail($no, 'kelas', "Kelas '{$namaKelas}' tidak ditemukan pada TA {$ta}.");

            return;
        }

        $ada = false;
        $adaNilai = false;
        foreach ($baris as $kolom => $nilaiKolom) {
            if (in_array($kolom, self::KOLOM_TETAP_NILAI, true)) {
                continue;
            }
            $skor = $this->angka($nilaiKolom);
            if ($skor === null) {
                continue;
            }
            $adaNilai = true;

            $mapelId = $this->mapelId($jenjang, (string) $kolom);
            if ($mapelId === null) {
                $this->fail($no, (string) $kolom, "Mapel '{$kolom}' tidak terdaftar di jenjang {$jenjang}.");

                continue;
            }
            $pengampuId = $this->pengampuId($kelasId, $mapelId);
            if ($pengampuId === null) {
                $this->fail($no, (string) $kolom, "Mapel '{$kolom}' belum punya pengampu di kelas {$namaKelas}.");

                continue;
            }
            if ($skor < 0 || $skor > $kegiatanEvaluatif->nilaiMaks()) {
                $namaSantri = $this->teks($baris, 'nama')
                    ?? (string) DB::table('santri')->where('id', $santriId)->value('nama_lengkap');
                $namaMapel = (string) (MataPelajaran::whereKey($mapelId)->value('nama_mapel') ?? $kolom);
                $this->fail($no, (string) $kolom, "{$namaSantri} — {$namaMapel}: nilai di luar rentang {$kegiatanEvaluatif->rentang_nilai}.");

                continue;
            }
            $ada = true;

            if ($kering) {
                continue;
            }

            if ($this->komponenId !== null) {
                $komponen = KomponenNilai::where('id', $this->komponenId)
                    ->where('kegiatan_evaluatif_id', $kegiatanEvaluatif->id)
                    ->first();
                if ($komponen === null) {
                    $this->fail($no, (string) $kolom, 'Komponen tidak termasuk kegiatanEvaluatif terpilih.');

                    continue;
                }
                NilaiKomponen::updateOrCreate(
                    [
                        'santri_id' => $santriId, 'pengampu_mapel_id' => $pengampuId,
                        'tahun_ajaran' => $ta, 'semester' => $semester,
                        'komponen_nilai_id' => $komponen->id,
                    ],
                    ['skor' => $skor],
                );
                $this->hitungUlangAkhir($santriId, $pengampuId, $mapelId, $jenjang, $tingkat, $ta, $semester, $kegiatanEvaluatif->id);
            } else {
                $this->nilai->simpanAkhir($santriId, $pengampuId, $ta, $semester, $kegiatanEvaluatif->id, $skor, NilaiSantri::IMPOR);
            }
            $this->dibuat++;
        }

        if (! $ada && ! $adaNilai) {
            $this->fail($no, 'nilai', 'Tidak ada kolom mapel berisi nilai.');
        }
    }

    /** Hitung ulang nilai akhir dari SELURUH komponen berbobot kegiatanEvaluatif. */
    private function hitungUlangAkhir(
        int $santriId,
        int $pengampuId,
        int $mapelId,
        string $jenjang,
        ?string $tingkat,
        string $ta,
        string $semester,
        int $kegiatanEvaluatifId,
    ): void {
        $hasil = $this->nilai->hitungAkhir($santriId, $pengampuId, $mapelId, $jenjang, $tingkat, $ta, $semester, $kegiatanEvaluatifId);
        if ($hasil['nilai'] === null) {
            return;
        }
        $this->nilai->simpanAkhir($santriId, $pengampuId, $ta, $semester, $kegiatanEvaluatifId, $hasil['nilai'], NilaiSantri::HITUNG);
    }

    /** @param array<string, mixed> $baris */
    private function prosesCatatanWali(array $baris, int $no, bool $kering, int $santriId, string $jenjang, string $ta, string $semester): void
    {
        $namaKelas = $this->teks($baris, 'kelas');
        $kelasId = $namaKelas !== null ? $this->kelasId($jenjang, $ta, $namaKelas) : null;
        if ($kelasId === null) {
            $this->fail($no, 'kelas', "Kelas '{$namaKelas}' tidak ditemukan pada TA {$ta}.");

            return;
        }
        if ($kering) {
            return;
        }

        RaporCatatanWali::updateOrCreate(
            ['santri_id' => $santriId, 'kelas_id' => $kelasId, 'tahun_ajaran' => $ta, 'semester' => $semester],
            [
                'sakit' => (int) ($this->angka($baris['sakit'] ?? null) ?? 0),
                'izin' => (int) ($this->angka($baris['izin'] ?? null) ?? 0),
                'alpa' => (int) ($this->angka($baris['alpa'] ?? null) ?? 0),
                'catatan_akademik' => $this->teks($baris, 'catatan'),
                'keputusan_kenaikan' => $this->teks($baris, 'status_kenaikan'),
            ],
        );
        $this->dibuat++;
    }

    /** @param array<string, mixed> $baris */
    private function prosesPrestasi(array $baris, int $no, bool $kering, int $santriId, string $ta, string $semester): void
    {
        $prestasi = $this->teks($baris, 'prestasi');
        if ($prestasi === null) {
            $this->fail($no, 'prestasi', 'Nama prestasi wajib diisi.');

            return;
        }
        if ($kering) {
            return;
        }

        PrestasiSantri::create([
            'santri_id' => $santriId,
            'tahun_ajaran' => $ta,
            'semester' => $semester,
            'prestasi' => $prestasi,
            'level' => $this->teks($baris, 'level'),
            'keterangan' => $this->teks($baris, 'keterangan'),
        ]);
        $this->dibuat++;
    }

    /** @param array<string, mixed> $baris */
    private function prosesEkskul(array $baris, int $no, bool $kering, int $santriId, string $jenjang, string $ta, string $semester): void
    {
        $ada = false;
        foreach ($baris as $kolom => $nilaiKolom) {
            if (! preg_match('/^ekskul(\d+)$/', (string) $kolom, $m)) {
                continue;
            }
            $nama = $this->teks($baris, (string) $kolom);
            if ($nama === null) {
                continue;
            }
            $ada = true;
            $predikat = $this->teks($baris, 'predikat'.$m[1]);
            if ($predikat !== null) {
                $predikat = strtoupper($predikat);
            }
            if ($kering) {
                continue;
            }

            $ekskulId = $this->ekskulId($jenjang, $ta, $nama);
            NilaiEkstrakurikuler::updateOrCreate(
                ['santri_id' => $santriId, 'tahun_ajaran' => $ta, 'semester' => $semester, 'ekstrakurikuler_id' => $ekskulId],
                ['predikat' => $predikat],
            );
            $this->dibuat++;
        }

        if (! $ada) {
            $this->fail($no, 'ekskul', 'Tidak ada kolom ekskul yang terisi.');
        }
    }

    private function kegiatanEvaluatif(): ?KegiatanEvaluatif
    {
        if ($this->kegiatanEvaluatif === null && $this->kegiatanEvaluatifId !== null) {
            $this->kegiatanEvaluatif = KegiatanEvaluatif::find($this->kegiatanEvaluatifId);
        }

        return $this->kegiatanEvaluatif;
    }

    private function tingkat(int $santriId, string $jenjang, string $ta, string $semester): ?string
    {
        $kunci = "{$santriId}|{$jenjang}|{$ta}|{$semester}";
        if (! array_key_exists($kunci, $this->cacheTingkat)) {
            $this->cacheTingkat[$kunci] = DB::table('riwayat_belajar')
                ->where('santri_id', $santriId)
                ->where('jenjang', $jenjang)
                ->where('tahun_ajaran', $ta)
                ->where('semester', $semester)
                ->orderByDesc('is_active_riwayat')
                ->value('tingkat');
        }

        return $this->cacheTingkat[$kunci] === null ? null : (string) $this->cacheTingkat[$kunci];
    }

    private function santriId(string $nis, string $jenjang): ?int
    {
        $kunci = $jenjang.':'.$nis;
        if (! array_key_exists($kunci, $this->cacheSantri)) {
            $this->cacheSantri[$kunci] = DB::table('lembaga_santri')
                ->where('jenjang', $jenjang)
                ->where('nis_lokal', $nis)
                ->value('santri_id');
        }

        return $this->cacheSantri[$kunci] === null ? null : (int) $this->cacheSantri[$kunci];
    }

    private function kelasId(string $jenjang, string $ta, string $nama): ?int
    {
        $kunci = "{$jenjang}|{$ta}|".$this->normalkan($nama);
        if (! array_key_exists($kunci, $this->cacheKelas)) {
            $this->cacheKelas[$kunci] = DB::table('kelas')
                ->where('jenjang', $jenjang)
                ->where('tahun_ajaran', $ta)
                ->whereRaw('LOWER(nama_kelas) = ?', [$this->normalkan($nama)])
                ->value('id');
        }

        return $this->cacheKelas[$kunci] === null ? null : (int) $this->cacheKelas[$kunci];
    }

    private function mapelId(string $jenjang, string $nama): ?int
    {
        $kunci = "{$jenjang}|".$this->normalkan($nama);
        if (! array_key_exists($kunci, $this->cacheMapel)) {
            $this->cacheMapel[$kunci] = MataPelajaran::where('jenjang', $jenjang)
                ->whereRaw('LOWER(nama_mapel) = ?', [mb_strtolower($this->normalkan($nama))])
                ->value('id');
        }

        return $this->cacheMapel[$kunci] === null ? null : (int) $this->cacheMapel[$kunci];
    }

    private function pengampuId(int $kelasId, int $mapelId): ?int
    {
        $kunci = "{$kelasId}|{$mapelId}";
        if (! array_key_exists($kunci, $this->cachePengampu)) {
            $this->cachePengampu[$kunci] = PengampuMapel::where('kelas_id', $kelasId)
                ->where('mata_pelajaran_id', $mapelId)
                ->value('id');
        }

        return $this->cachePengampu[$kunci] === null ? null : (int) $this->cachePengampu[$kunci];
    }

    /** Ekstrakurikuler master per (jenjang, TA); dibuat bila belum ada. */
    private function ekskulId(string $jenjang, string $ta, string $nama): int
    {
        $kunci = "{$jenjang}|{$ta}|".$this->normalkan($nama);
        if (! array_key_exists($kunci, $this->cacheEkskul)) {
            $row = Ekstrakurikuler::firstOrCreate(
                ['jenjang' => $jenjang, 'tahun_ajaran' => $ta, 'nama' => $this->normalkan($nama)],
                ['is_active' => true],
            );
            $this->cacheEkskul[$kunci] = $row->id;
        }

        return (int) $this->cacheEkskul[$kunci];
    }

    private function angka(mixed $nilai): ?float
    {
        if ($nilai === null || $nilai === '') {
            return null;
        }
        if (is_int($nilai) || is_float($nilai)) {
            return (float) $nilai;
        }

        $teks = str_replace(',', '.', trim((string) $nilai));
        if (! is_numeric($teks)) {
            return null;
        }

        return (float) $teks;
    }

    private function normalkan(string $teks): string
    {
        return mb_strtolower(preg_replace('/\s+/u', ' ', trim($teks)) ?? '');
    }
}
