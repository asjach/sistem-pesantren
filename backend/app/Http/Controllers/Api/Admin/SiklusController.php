<?php

namespace App\Http\Controllers\Api\Admin;

use App\Exports\MutasiKeluarTemplateExport;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\MutasiKeluarImportRequest;
use App\Http\Requests\Admin\SiklusDaftarKelasRequest;
use App\Http\Requests\Admin\SiklusLembagaRequest;
use App\Http\Requests\Admin\SiklusLulusRequest;
use App\Http\Requests\Admin\SiklusMutasiKeluarRequest;
use App\Http\Requests\Admin\SiklusNaikKelasOtomatisRequest;
use App\Http\Requests\Admin\SiklusNaikKelasRequest;
use App\Http\Requests\Admin\SiklusRekapRequest;
use App\Http\Requests\Admin\SiklusSalinGenapRequest;
use App\Imports\MutasiKeluarImport;
use App\Models\Alumni;
use App\Models\Kelas;
use App\Models\LembagaSantri;
use App\Models\MutasiKeluar;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\TahunAjaran;
use App\Services\SiklusSantriService;
use App\Services\UrutKatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Facades\Excel;

/**
 * Siklus akademik santri: salin genap, kenaikan, kelulusan, mutasi keluar,
 * berhenti jenjang, daftar kelas, rekap, dan profil santri.
 */
class SiklusController extends Controller
{
    use TenantGuard;
    use UrutDaftar;

    private const SORT_NULLABLE_ARSIP = [
        'mutasi_keluar.tanggal_mutasi', 'alumni.tanggal_lulus',
        'kelas.nama_kelas', 'tahun_ajaran.nama',
    ];

    public function __construct(private SiklusSantriService $siklusService) {}

    // ---------------- Salin genap ----------------

    /** POST /api/admin/akademik/salin-genap — massal per lembaga (partial per-item). */
    public function salinGenapMassal(SiklusSalinGenapRequest $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $data = $request->validated();

        $lembagaId = $data['jenjang'];
        $this->authorizeLembaga($request->user(), $lembagaId);
        $tanggal = (string) $data['tanggal_masuk'];

        $items = $data['siswa'] ?? RiwayatBelajar::where('jenjang', $lembagaId)
            ->where('semester', '1')->where('is_active_riwayat', RiwayatBelajar::YA)
            ->orderBy('id')->get()
            ->map(fn (RiwayatBelajar $r) => ['santri_id' => (int) $r->santri_id])
            ->all();

        $ok = 0;
        $gagal = [];
        foreach ($items as $item) {
            try {
                $santri = Santri::findOrFail($item['santri_id']);
                $this->authorizeAksiLembaga($request, $santri, $lembagaId);
                $kelasId = isset($item['kelas_id']) ? (int) $item['kelas_id'] : null;
                $this->cekKelasGenap($santri, $lembagaId, $kelasId);
                $this->siklusService->salinKeGenap(
                    $santri,
                    $lembagaId,
                    $tanggal,
                    isset($item['no_absen']) ? (int) $item['no_absen'] : null,
                    $kelasId
                );
                $ok++;
            } catch (\Throwable $e) {
                $gagal[] = ['santri_id' => $item['santri_id'] ?? null, 'pesan' => $e->getMessage()];
            }
        }

        return response()->json(['pesan' => 'Salin ke genap selesai.', 'berhasil' => $ok, 'gagal' => $gagal]);
    }

    /** Guard kelas pengganti salin genap: wajib se-lembaga & se-tahun dengan baris aktif. */
    protected function cekKelasGenap(Santri $santri, string $lembagaId, ?int $kelasId): void
    {
        if ($kelasId === null) {
            return;
        }
        $kelas = Kelas::findOrFail($kelasId);
        if ($kelas->jenjang !== $lembagaId) {
            throw ValidationException::withMessages(['kelas_id' => 'Kelas beda lembaga.']);
        }
        $ganjil = RiwayatBelajar::where('santri_id', $santri->id)
            ->where('jenjang', $lembagaId)->where('is_active_riwayat', RiwayatBelajar::YA)
            ->latest('id')->first();
        if ($ganjil && $kelas->tahun_ajaran !== $ganjil->tahun_ajaran) {
            throw ValidationException::withMessages(['kelas_id' => 'Kelas beda tahun ajaran.']);
        }
    }

    // ---------------- Kenaikan / kelulusan ----------------

    /** POST /api/admin/akademik/naik-kelas — batch = 1 lembaga + 1 tahun + 1 tingkat. */
    public function naikKelasMassal(SiklusNaikKelasRequest $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $data = $request->validated();

        $lembagaId = $data['jenjang'];
        $tahunBaru = (string) $data['tahun_ajaran_baru'];
        $tingkat = (string) $data['tingkat'];
        $this->cekTaEfektif($lembagaId, $tahunBaru, 'tahun_ajaran_baru');

        $ok = 0;
        $gagal = [];
        foreach ($data['siswa'] as $item) {
            try {
                $santri = Santri::findOrFail($item['santri_id']);
                $this->authorizeAksiLembaga($request, $santri, $lembagaId);
                $this->siklusService->prosesKenaikanPerSantri(
                    $santri,
                    $lembagaId,
                    $tahunBaru,
                    $tingkat,
                    $item['status'],
                    $item['tgl_masuk'] ?? null,
                    isset($item['no_absen']) ? (int) $item['no_absen'] : null
                );
                $ok++;
            } catch (\Throwable $e) {
                $gagal[] = ['santri_id' => $item['santri_id'] ?? null, 'pesan' => $e->getMessage()];
            }
        }

        return response()->json(['pesan' => 'Proses kenaikan selesai.', 'berhasil' => $ok, 'gagal' => $gagal]);
    }

    /** POST /api/admin/akademik/naik-kelas-otomatis — TA + kelas tujuan
     *  dibuatkan otomatis (partial per-item). */
    public function naikKelasOtomatis(SiklusNaikKelasOtomatisRequest $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $data = $request->validated();

        $lembagaId = $data['jenjang'];

        $ok = 0;
        $gagal = [];
        $hasil = [];
        foreach ($data['siswa'] as $item) {
            try {
                $santri = Santri::findOrFail($item['santri_id']);
                $this->authorizeAksiLembaga($request, $santri, $lembagaId);
                $baru = $this->siklusService->prosesKenaikanOtomatis(
                    $santri,
                    $lembagaId,
                    $item['status'],
                    $item['tgl_masuk']
                );
                $baru->load(['santri:id,nama_lengkap', 'kelas:id,nama_kelas', 'tahunAjaran:id,nama']);
                $hasil[] = [
                    'santri_id' => $baru->santri_id,
                    'nama' => $baru->santri?->nama_lengkap,
                    'kelas' => $baru->kelas?->nama_kelas,
                    'tingkat' => $baru->tingkat,
                    'tahun_ajaran' => $baru->tahunAjaran?->nama,
                ];
                $ok++;
            } catch (\Throwable $e) {
                $gagal[] = ['santri_id' => $item['santri_id'] ?? null, 'pesan' => $e->getMessage()];
            }
        }

        return response()->json(['pesan' => 'Proses kenaikan selesai.', 'berhasil' => $ok, 'gagal' => $gagal, 'data' => $hasil]);
    }

    /** POST /api/admin/santri/{santri}/batal-kenaikan — urungkan hasil kenaikan. */
    public function batalKenaikan(SiklusLembagaRequest $request, Santri $santri): JsonResponse
    {
        $data = $request->validated();

        $this->authorizeAksiLembaga($request, $santri, $data['jenjang']);

        $lama = $this->siklusService->batalKenaikan($santri, $data['jenjang']);

        return response()->json(['pesan' => 'Kenaikan dibatalkan; santri kembali ke kelas asal.', 'data' => $lama]);
    }

    /** POST /api/admin/santri/{santri}/batal-salin — urungkan salin ganjil→genap. */
    public function batalSalin(SiklusLembagaRequest $request, Santri $santri): JsonResponse
    {
        $data = $request->validated();

        $this->authorizeAksiLembaga($request, $santri, $data['jenjang']);

        $ganjil = $this->siklusService->batalSalin($santri, $data['jenjang']);

        return response()->json(['pesan' => 'Salin semester dibatalkan; santri kembali ke semester 1.', 'data' => $ganjil]);
    }

    /** POST /api/admin/santri/{santri}/lulus — kelulusan per lembaga (+arsip alumni). */
    public function lulus(SiklusLulusRequest $request, Santri $santri): JsonResponse
    {
        $data = $request->validated();

        $this->cekTaEfektif($data['jenjang'], (string) $data['tahun_ajaran_lulus'], 'tahun_ajaran_lulus');
        $this->authorizeAksiLembaga($request, $santri, $data['jenjang']);

        $alumni = $this->siklusService->prosesLulusPerLembaga($santri, $data['jenjang'], $data);

        return response()->json([
            'pesan' => 'Santri dinyatakan lulus dan masuk data alumni.',
            'data' => $alumni,
        ]);
    }

    /** POST /api/admin/santri/{santri}/tidak-lulus — buka riwayat mengulang TA berikut. */
    public function tidakLulus(SiklusLembagaRequest $request, Santri $santri): JsonResponse
    {
        $data = $request->validated();

        $this->authorizeAksiLembaga($request, $santri, $data['jenjang']);

        $riwayat = $this->siklusService->prosesTidakLulus($santri, $data['jenjang']);

        return response()->json([
            'pesan' => 'Santri tidak lulus; riwayat mengulang tapel berikut dibuka.',
            'data' => $riwayat,
        ]);
    }

    // ---------------- Mutasi / berhenti ----------------

    /** POST /api/admin/santri/{santri}/mutasi — mutasi keluar per lembaga. */
    public function mutasiKeluar(SiklusMutasiKeluarRequest $request, Santri $santri): JsonResponse
    {
        $data = $request->validated();

        $this->authorizeAksiLembaga($request, $santri, $data['jenjang']);

        $mutasi = $this->siklusService->prosesMutasiPerLembaga($santri, $data['jenjang'], $data);

        return response()->json([
            'pesan' => 'Santri berhasil dimutasi keluar.',
            'data' => $mutasi,
        ]);
    }

    /** POST /api/admin/santri/{santri}/berhenti-jenjang — tutup satu jenjang (paket). */
    public function berhentiJenjang(SiklusLembagaRequest $request, Santri $santri): JsonResponse
    {
        $data = $request->validated();

        $this->authorizeAksiLembaga($request, $santri, $data['jenjang']);

        $this->siklusService->nonAktifkanRiwayat($santri, $data['jenjang']);

        return response()->json(['pesan' => 'Riwayat jenjang dinonaktifkan.', 'data' => $santri->fresh()]);
    }

    // ---------------- Daftar & arsip ----------------

    /** GET /api/admin/mutasi-keluar — arsip mutasi (terskop tenant). */
    public function getMutasiKeluar(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);
        $urut = $this->parseUrut($request, UrutKatalog::peta('mutasi_arsip'));

        $mutasi = MutasiKeluar::tenantScope()
            ->with(['santri:id,nama_lengkap,nisn', 'lembaga:jenjang,nama', 'kelasTerakhir:id,nama_kelas'])
            ->when($request->filled('jenjang'), fn ($q) => $q->where('jenjang', (string) $request->input('jenjang')));
        if ($urut !== null) {
            $mutasi->select('mutasi_keluar.*')
                ->leftJoin('santri', 'santri.id', '=', 'mutasi_keluar.santri_id')
                ->leftJoin('lembaga', 'lembaga.jenjang', '=', 'mutasi_keluar.jenjang')
                ->leftJoin('kelas', 'kelas.id', '=', 'mutasi_keluar.kelas_terakhir_id');
        }
        $this->terapkanUrut($mutasi, $urut, [['mutasi_keluar.id', 'turun']], self::SORT_NULLABLE_ARSIP);
        $mutasi = $mutasi->paginate($this->perPage($request));

        return response()->json($mutasi);
    }

    /** GET /api/admin/mutasi-keluar/import-template — template Excel import arsip. */
    public function templateImportMutasi()
    {
        return Excel::download(new MutasiKeluarTemplateExport, 'template-import-mutasi-keluar.xlsx');
    }

    /** POST /api/admin/mutasi-keluar/import-periksa — validasi file TANPA menulis (dry-run). */
    public function periksaImportMutasi(MutasiKeluarImportRequest $request): JsonResponse
    {
        return $this->prosesImportMutasi($request, periksa: true);
    }

    /** POST /api/admin/mutasi-keluar/import — import arsip mutasi massal. */
    public function importMutasi(MutasiKeluarImportRequest $request): JsonResponse
    {
        return $this->prosesImportMutasi($request, periksa: false);
    }

    /** Alur bersama import arsip mutasi multi-lembaga. Mode periksa:
     *  transaksi selalu di-rollback. Izin dicek per baris di import
     *  (mengikuti akun), bukan 403 di depan. */
    private function prosesImportMutasi(MutasiKeluarImportRequest $request, bool $periksa): JsonResponse
    {
        $request->validated();

        $import = new MutasiKeluarImport;
        $errors = [];

        if ($periksa) {
            DB::beginTransaction();
        }

        try {
            Excel::import($import, $request->file('file'));
        } catch (ValidationException $e) {
            $errors = $this->formatFailures($e->failures());
        } finally {
            if ($periksa) {
                DB::rollBack();
            }
        }

        if ($errors === []) {
            $errors = $this->formatFailures($import->failures());
        }

        if ($periksa) {
            return response()->json([
                'pesan' => $errors === [] ? 'Pengecekan selesai: file siap diimport.' : 'Pengecekan menemukan masalah.',
                'siap_import' => $errors === [],
                'ringkasan' => $import->ringkasan(),
                'errors' => $errors,
            ]);
        }

        if ($errors !== []) {
            return response()->json([
                'pesan' => 'Gagal mengimport beberapa data.',
                'errors' => $errors,
            ], 422);
        }

        $ringkasan = $import->ringkasan();

        return response()->json([
            'pesan' => "{$ringkasan['dibuat']} arsip dibuat, {$ringkasan['dilewati']} dilewati.",
            'ringkasan' => $ringkasan,
        ]);
    }

    private function formatFailures(iterable $failures): array
    {
        $errors = [];
        foreach ($failures as $failure) {
            $errors[] = [
                'row' => $failure->row(),
                'attribute' => $failure->attribute(),
                'errors' => $failure->errors(),
            ];
        }

        return $errors;
    }

    /** GET /api/admin/alumni — arsip alumni (terskop tenant via lembaga lulus). */
    public function getAlumni(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);
        $urut = $this->parseUrut($request, UrutKatalog::peta('kelulusan_alumni'));

        $alumni = Alumni::tenantScope()
            ->with(['santri:id,nama_lengkap,nisn', 'lembagaLulus:jenjang,nama', 'tahunAjaranLulus:nama', 'kelasLulus:id,nama_kelas'])
            ->when($request->filled('jenjang'), fn ($q) => $q->where('lembaga_lulus', (string) $request->input('jenjang')))
            ->when($request->filled('tahun_ajaran_lulus'), fn ($q) => $q->where('tahun_ajaran_lulus', $request->input('tahun_ajaran_lulus')));
        if ($urut !== null) {
            $alumni->select('alumni.*')
                ->leftJoin('santri', 'santri.id', '=', 'alumni.santri_id')
                ->leftJoin('lembaga', 'lembaga.jenjang', '=', 'alumni.lembaga_lulus')
                ->leftJoin('tahun_ajaran', 'tahun_ajaran.nama', '=', 'alumni.tahun_ajaran_lulus')
                ->leftJoin('kelas', 'kelas.id', '=', 'alumni.kelas_lulus_id');
        }
        $this->terapkanUrut($alumni, $urut, [['alumni.id', 'turun']], self::SORT_NULLABLE_ARSIP);
        $alumni = $alumni->paginate($this->perPage($request));

        return response()->json($alumni);
    }

    /**
     * GET /api/admin/akademik/daftar-kelas — daftar santri per kelas.
     * Muatan penuh 3 tabel: `riwayat_belajar` + `santri` (semua kolom) +
     * `lembaga_anggota` (baris `lembaga_santri` santri+lembaga, aktif
     * diutamakan) + relasi kelas/lembaga/tahun ajaran. `nis_lokal` ringkas
     * dipertahankan untuk kompatibilitas.
     * Tanpa `kelompok_status`: perilaku lama (is_active_riwayat pada TA default aktif
     * + semester berjalan). Dengan `kelompok_status=aktif|nonaktif`: basis
     * tampil = status_akhir (aktif = Aktif, Naik, Tidak Naik, Lulus,
     * Tidak Lulus; nonaktif = Pindah/Keluar) dan `lintas_periode=1`
     * mematikan default TA/semester agar bisa lintas periode.
     */
    public function daftarKelas(SiklusDaftarKelasRequest $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $data = $request->validated();
        $lembagaId = $data['jenjang'];
        $this->authorizeLembaga($request->user(), $lembagaId);

        $lintas = $request->boolean('lintas_periode');
        $kelompok = $data['kelompok_status'] ?? null;

        $ta = $data['tahun_ajaran']
            ?? ($lintas ? null : TahunAjaran::aktif($lembagaId)?->nama);
        if (! $lintas && $ta === null) {
            return response()->json(['pesan' => 'Tahun ajaran aktif belum ada di lembaga ini.', 'data' => []]);
        }

        $semester = $data['semester']
            ?? ($lintas || $ta === null ? null : (string) (RiwayatBelajar::where('jenjang', $lembagaId)
                ->where('tahun_ajaran', $ta)->where('is_active_riwayat', RiwayatBelajar::YA)
                ->orderByDesc('semester')->value('semester') ?? '1'));

        $query = RiwayatBelajar::with([
            'santri',
            'kelas:id,nama_kelas,tingkat',
            'lembaga:jenjang,nama',
            // JANGAN eager-load `tahunAjaran`: kunci relasi di-snake-case jadi
            // `tahun_ajaran` dan menimpa atribut string FK (frontend menerima
            // objek → tampil "[object Object]"). Nilai FK-nya sudah nama TA.
        ])->where('jenjang', $lembagaId);
        if ($ta !== null) {
            $query->where('tahun_ajaran', $ta);
        }
        if ($semester !== null) {
            $query->where('semester', $semester);
        }
        if ($kelompok === 'aktif') {
            // Aktif = gabungan status akhir (bukan flag is_active_riwayat).
            $query->whereIn('status_akhir', ['aktif', 'naik', 'tidak_naik', 'lulus', 'tidak_lulus']);
        } elseif ($kelompok === 'nonaktif') {
            $query->where('status_akhir', 'pindah_keluar');
        } else {
            $query->where('is_active_riwayat', RiwayatBelajar::YA);
        }

        if (! empty($data['kelas_id'])) {
            $query->where('kelas_id', (int) $data['kelas_id']);
        }
        if (! empty($data['tingkat'])) {
            $query->where('tingkat', $data['tingkat']);
        }

        $baris = $query->orderBy('tahun_ajaran')->orderBy('semester')->orderBy('kelas_id')->orderBy('no_absen')->orderBy('santri_id')->get();
        // Keanggotaan penuh (satu baris per santri; aktif diutamakan) + NIS lokal
        // ringkas (kompatibilitas payload lama).
        $anggota = LembagaSantri::whereIn('santri_id', $baris->pluck('santri_id')->unique())
            ->where('jenjang', $lembagaId)
            ->orderByDesc('is_active_lembaga')->orderBy('id')
            ->get()->groupBy('santri_id')->map->first();
        $baris->each(function ($r) use ($anggota) {
            $ls = $anggota[$r->santri_id] ?? null;
            $r->setRelation('lembaga_anggota', $ls);
            $r->setAttribute('nis_lokal', $ls?->nis_lokal);
        });

        return response()->json([
            'jenjang' => $lembagaId,
            'tahun_ajaran' => $ta,
            'semester' => $semester,
            'data' => $baris,
        ]);
    }

    /**
     * GET /api/admin/akademik/rekap-santri — rekap jumlah santri per tahun ajaran,
     * per tingkat, per kelas, plus usia per kelas.
     */
    public function rekapSantri(SiklusRekapRequest $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $data = $request->validated();
        // Keaktifan dari `status_akhir`: aktif = selain Pindah/Keluar (bawaan),
        // nonaktif = Pindah/Keluar, kosong = semua status.
        $keaktifan = $data['keaktifan'] ?? 'aktif';

        $riwayatQuery = function (bool $semuaTa = false) use ($request, $data, $keaktifan) {
            // "Santri aktif pada periode" = terdaftar di TA+semester itu dan
            // tidak pindah keluar (definisi sama dengan Daftar Kelas), bukan
            // flag `is_active_riwayat` yang hanya menandai periode terkini.
            // Unique (santri, TA, jenjang, semester) → satu baris per santri.
            $q = RiwayatBelajar::query();
            if ($keaktifan === 'aktif') {
                $q->whereIn('status_akhir', ['aktif', 'naik', 'tidak_naik', 'lulus', 'tidak_lulus']);
            } elseif ($keaktifan === 'nonaktif') {
                $q->where('status_akhir', 'pindah_keluar');
            }
            $this->scopeLembaga($q, $request->user(), $request, 'jenjang');
            if (! $semuaTa && ! empty($data['tahun_ajaran'])) {
                $q->where('tahun_ajaran', $data['tahun_ajaran']);
            }
            if (! empty($data['semester'])) {
                $q->where('semester', $data['semester']);
            }

            return $q;
        };

        $perTingkat = (clone $riwayatQuery())
            ->join('santri', 'santri.id', '=', 'riwayat_belajar.santri_id')
            ->selectRaw("riwayat_belajar.jenjang as jenjang, riwayat_belajar.tingkat as tingkat, COUNT(*) as jumlah, SUM(santri.jk = 'L') as l, SUM(santri.jk = 'P') as p")
            ->groupBy('riwayat_belajar.jenjang', 'riwayat_belajar.tingkat')
            ->with('lembaga:jenjang,nama')
            ->get()
            ->map(fn ($r) => [
                'lembaga' => $r->lembaga?->jenjang ?? $r->lembaga?->nama,
                'tingkat' => $r->tingkat,
                'jumlah' => (int) $r->jumlah,
                'l' => (int) $r->l,
                'p' => (int) $r->p,
            ])->values()->all();

        $kelasQuery = Kelas::query()->with(['lembaga:jenjang,nama', 'tahunAjaran:nama']);
        $this->scopeLembaga($kelasQuery, $request->user(), $request, 'jenjang');
        if (! empty($data['tahun_ajaran'])) {
            $kelasQuery->where('tahun_ajaran', $data['tahun_ajaran']);
        }
        $kelas = $kelasQuery->orderBy('jenjang')->orderBy('tingkat')->orderBy('nama_kelas')->get();

        $terisi = (clone $riwayatQuery())
            ->join('santri', 'santri.id', '=', 'riwayat_belajar.santri_id')
            ->whereIn('riwayat_belajar.kelas_id', $kelas->pluck('id'))
            ->selectRaw("riwayat_belajar.kelas_id as kelas_id, COUNT(*) as jumlah, SUM(santri.jk = 'L') as l, SUM(santri.jk = 'P') as p")
            ->groupBy('riwayat_belajar.kelas_id')
            ->get()
            ->keyBy('kelas_id');

        $perKelas = $kelas->map(function (Kelas $k) use ($terisi) {
            $t = $terisi[$k->id] ?? null;
            $jml = (int) ($t->jumlah ?? 0);

            return [
                'kelas_id' => $k->id,
                'kelas' => $k->nama_kelas,
                'tingkat' => $k->tingkat,
                'lembaga' => $k->lembaga?->jenjang ?? $k->lembaga?->nama,
                'tahun_ajaran' => $k->tahunAjaran?->nama,
                'kapasitas' => $k->kapasitas !== null ? (int) $k->kapasitas : null,
                'terisi' => $jml,
                'l' => (int) ($t->l ?? 0),
                'p' => (int) ($t->p ?? 0),
                'sisa' => $k->kapasitas !== null ? max(0, (int) $k->kapasitas - $jml) : null,
            ];
        })->values()->all();

        // Usia per tingkat: rata-rata + sebaran kelompok umur (dari tgl_lahir santri).
        $usiaPerTingkat = [];
        $riwayatTingkat = (clone $riwayatQuery())
            ->with(['santri:id,tgl_lahir'])
            ->get()
            ->groupBy(fn (RiwayatBelajar $r) => (string) ($r->tingkat ?? ''));

        foreach ($riwayatTingkat as $tingkat => $baris) {
            $usia = $baris->map(fn (RiwayatBelajar $r) => $r->santri?->tgl_lahir?->age)
                ->filter(fn ($u) => $u !== null);

            if ($usia->isEmpty()) {
                continue;
            }
            $kelompok = ['<7' => 0, '7-9' => 0, '10-12' => 0, '13-15' => 0, '>=16' => 0];
            foreach ($usia as $u) {
                if ($u < 7) {
                    $kelompok['<7']++;
                } elseif ($u <= 9) {
                    $kelompok['7-9']++;
                } elseif ($u <= 12) {
                    $kelompok['10-12']++;
                } elseif ($u <= 15) {
                    $kelompok['13-15']++;
                } else {
                    $kelompok['>=16']++;
                }
            }
            $usiaPerTingkat[] = [
                'tingkat' => $tingkat === '' ? null : (string) $tingkat,
                'jumlah' => $usia->count(),
                'rata_usia' => round($usia->avg(), 1),
                'min' => $usia->min(),
                'max' => $usia->max(),
                'kelompok' => $kelompok,
            ];
        }
        usort($usiaPerTingkat, fn ($a, $b) => strnatcasecmp((string) $a['tingkat'], (string) $b['tingkat']));

        // Rekap per tahun ajaran = SELURUH TA (abaikan filter TA terpilih),
        // agar kolom kiri menampilkan rentang penuh dari TA awal ke akhir.
        $perTahunAjaran = $riwayatQuery(true)
            ->join('santri', 'santri.id', '=', 'riwayat_belajar.santri_id')
            ->selectRaw("riwayat_belajar.tahun_ajaran as tahun_ajaran, COUNT(*) as jumlah, SUM(santri.jk = 'L') as l, SUM(santri.jk = 'P') as p")
            ->groupBy('riwayat_belajar.tahun_ajaran')
            ->orderBy('riwayat_belajar.tahun_ajaran')
            ->with('tahunAjaran:nama')
            ->get()
            ->map(fn ($r) => [
                'tahun_ajaran' => $r->tahun_ajaran,
                'jumlah_riwayat_aktif' => (int) $r->jumlah,
                'l' => (int) $r->l,
                'p' => (int) $r->p,
            ])->values()->all();

        return response()->json([
            'total_aktif' => (int) (clone $riwayatQuery())->count(),
            'per_tahun_ajaran' => $perTahunAjaran,
            'per_tingkat' => $perTingkat,
            'per_kelas' => $perKelas,
            'usia_per_tingkat' => $usiaPerTingkat,
        ]);
    }

    /** GET /api/admin/santri/{santri}/profil — identitas + keanggotaan + riwayat + arsip. */
    public function profilSantri(Request $request, Santri $santri): JsonResponse
    {
        $this->authorize('view', $santri);

        $santri->load([
            'lembagaSantri.lembaga:jenjang,nama,nsm',
        ]);
        $riwayat = RiwayatBelajar::where('santri_id', $santri->id)
            ->with(['kelas:id,nama_kelas,tingkat', 'lembaga:jenjang,nama'])
            ->orderByDesc('id')->get();
        $mutasi = MutasiKeluar::where('santri_id', $santri->id)
            ->with(['lembaga:jenjang,nama', 'kelasTerakhir:id,nama_kelas'])
            ->orderByDesc('id')->get();
        $alumni = Alumni::where('santri_id', $santri->id)
            ->with(['lembagaLulus:jenjang,nama', 'tahunAjaranLulus:nama'])
            ->orderByDesc('id')->get();

        return response()->json([
            'santri' => $santri,
            'keanggotaan' => $santri->lembagaSantri,
            'riwayat' => $riwayat,
            'mutasi' => $mutasi,
            'alumni' => $alumni,
        ]);
    }
}
