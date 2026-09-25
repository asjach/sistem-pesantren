<?php

namespace App\Http\Controllers\Api\Admin;

use App\Exports\AlumniTemplateExport;
use App\Exports\MutasiKeluarDataExport;
use App\Exports\MutasiKeluarTemplateExport;
use App\Http\Controllers\Api\Concerns\ImporBertahap;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AlumniImportRequest;
use App\Http\Requests\Admin\AlumniPotongRequest;
use App\Http\Requests\Admin\MutasiKeluarImportRequest;
use App\Http\Requests\Admin\MutasiKeluarPotongRequest;
use App\Http\Requests\Admin\SiklusDaftarKelasRequest;
use App\Http\Requests\Admin\SiklusLembagaRequest;
use App\Http\Requests\Admin\SiklusLulusRequest;
use App\Http\Requests\Admin\SiklusMutasiKeluarRequest;
use App\Http\Requests\Admin\SiklusNaikKelasOtomatisRequest;
use App\Http\Requests\Admin\SiklusNaikKelasRequest;
use App\Http\Requests\Admin\SiklusRekapRequest;
use App\Http\Requests\Admin\SiklusSalinGenapRequest;
use App\Imports\AlumniImport;
use App\Imports\MutasiKeluarImport;
use App\Models\Alumni;
use App\Models\ImportSesi;
use App\Models\Kelas;
use App\Models\LembagaSantri;
use App\Models\MutasiKeluar;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Models\SemesterAktif;
use App\Models\TahunAjaran;
use App\Services\AlumniImporService;
use App\Services\MutasiKeluarImporService;
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
    use ImporBertahap;
    use TenantGuard;
    use UrutDaftar;

    private const SORT_NULLABLE_ARSIP = [
        'mutasi_keluar.tanggal_mutasi', 'alumni.tanggal_lulus',
        'kelas.nama_kelas', 'tahun_ajaran.nama',
    ];

    public function __construct(private SiklusSantriService $siklusService) {}

    // ---------------- Salin genap ----------------

    public function ringkasanPindahGenap(SiklusLembagaRequest $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);
        $data = $request->validated();
        $lembagaId = $data['jenjang'];
        $this->authorizeLembaga($request->user(), $lembagaId);
        $tahunAktif = TahunAjaran::aktif($lembagaId);
        if ($tahunAktif === null || ($data['tahun_ajaran'] ?? null) !== $tahunAktif->nama) {
            throw ValidationException::withMessages(['tahun_ajaran' => 'Ringkasan hanya berlaku pada tahun ajaran aktif.']);
        }
        if ((string) SemesterAktif::where('jenjang', $lembagaId)->value('semester') !== '1') {
            throw ValidationException::withMessages(['semester' => 'Ringkasan hanya berlaku pada semester aktif Ganjil.']);
        }

        $query = RiwayatBelajar::where('jenjang', $lembagaId)
            ->where('tahun_ajaran', $tahunAktif->nama)
            ->where('semester', '1');
        if ($request->filled('q')) {
            $q = (string) $request->input('q');
            $query->whereHas('santri', fn ($s) => $s
                ->where('nama_lengkap', 'like', "%{$q}%")
                ->orWhere('nik', 'like', "%{$q}%"));
        }

        $aktif = (clone $query)->where(function ($status) {
            $status->where('status_akhir', '!=', 'pindah_keluar')
                ->orWhereNull('status_akhir');
        })->count();
        $tidakAktifRows = (clone $query)->where('status_akhir', 'pindah_keluar')
            ->with('santri:id,nama_lengkap')
            ->get();
        $namaTidakAktif = $tidakAktifRows
            ->map(fn (RiwayatBelajar $r) => $r->santri?->nama_lengkap ?? "Santri #{$r->santri_id}")
            ->sortBy(fn (string $nama) => mb_strtolower($nama))
            ->values()
            ->all();

        return response()->json(['data' => [
            'aktif' => $aktif,
            'tidak_aktif' => $tidakAktifRows->count(),
            'nama_tidak_aktif' => $namaTidakAktif,
        ]]);
    }

    /** POST /api/admin/akademik/salin-genap — massal per lembaga (partial per-item). */
    public function salinGenapMassal(SiklusSalinGenapRequest $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $data = $request->validated();

        $lembagaId = $data['jenjang'];
        $this->authorizeLembaga($request->user(), $lembagaId);
        $tanggal = (string) $data['tanggal_masuk'];

        if (isset($data['siswa'])) {
            $items = $data['siswa'];
        } elseif ($data['konteks_aktif'] ?? false) {
            $query = RiwayatBelajar::where('jenjang', $lembagaId)
                ->where('semester', '1')
                ->where(function ($status) {
                    $status->where('status_akhir', '!=', 'pindah_keluar')
                        ->orWhereNull('status_akhir');
                });
            if (isset($data['tahun_ajaran'])) {
                $query->where('tahun_ajaran', $data['tahun_ajaran']);
            }
            if ($request->filled('q')) {
                $q = (string) $request->input('q');
                $query->whereHas('santri', fn ($s) => $s
                    ->where('nama_lengkap', 'like', "%{$q}%")
                    ->orWhere('nik', 'like', "%{$q}%"));
            }
            $items = $query->orderBy('id')->get()
                ->map(fn (RiwayatBelajar $r) => [
                    'santri_id' => (int) $r->santri_id,
                    'riwayat_id' => (int) $r->id,
                ])->all();
        } else {
            $items = RiwayatBelajar::where('jenjang', $lembagaId)
                ->where('semester', '1')->where('is_active_riwayat', RiwayatBelajar::YA)
                ->orderBy('id')->get()
                ->map(fn (RiwayatBelajar $r) => ['santri_id' => (int) $r->santri_id])
                ->all();
        }

        $ok = 0;
        $gagal = [];
        foreach ($items as $item) {
            try {
                $riwayatId = isset($item['riwayat_id']) ? (int) $item['riwayat_id'] : null;
                if ($riwayatId !== null) {
                    $riwayat = RiwayatBelajar::findOrFail($riwayatId);
                    if ($riwayat->jenjang !== $lembagaId || (int) $riwayat->santri_id !== (int) $item['santri_id']) {
                        throw ValidationException::withMessages(['riwayat_id' => 'Riwayat tidak sesuai dengan siswa atau lembaga.']);
                    }
                    $this->cekPindahDariRiwayat($riwayat);
                    $santri = Santri::findOrFail($riwayat->santri_id);
                } else {
                    $santri = Santri::findOrFail($item['santri_id']);
                }
                if ($riwayatId === null) {
                    $this->authorizeAksiLembaga($request, $santri, $lembagaId);
                }
                $kelasId = isset($item['kelas_id']) ? (int) $item['kelas_id'] : null;
                $this->cekKelasGenap($santri, $lembagaId, $kelasId, $riwayatId);
                $this->siklusService->salinKeGenap(
                    $santri,
                    $lembagaId,
                    $tanggal,
                    isset($item['no_absen']) ? (int) $item['no_absen'] : null,
                    $kelasId,
                    $riwayatId
                );
                $ok++;
            } catch (\Throwable $e) {
                $gagal[] = ['santri_id' => $item['santri_id'] ?? null, 'pesan' => $e->getMessage()];
            }
        }

        return response()->json(['pesan' => 'Salin ke genap selesai.', 'berhasil' => $ok, 'gagal' => $gagal]);
    }

    protected function cekPindahDariRiwayat(RiwayatBelajar $riwayat): void
    {
        $tahunAktif = TahunAjaran::aktif($riwayat->jenjang);
        if ($tahunAktif === null || $riwayat->tahun_ajaran !== $tahunAktif->nama) {
            throw ValidationException::withMessages(['riwayat_id' => 'Pindah hanya berlaku pada tahun ajaran aktif.']);
        }
        $semesterAktif = SemesterAktif::where('jenjang', $riwayat->jenjang)->value('semester');
        if ((string) $semesterAktif !== '1') {
            throw ValidationException::withMessages(['riwayat_id' => 'Pindah hanya aktif pada semester aktif Ganjil.']);
        }
        if ($riwayat->semester !== '1' || $riwayat->status_akhir === 'pindah_keluar') {
            throw ValidationException::withMessages(['riwayat_id' => 'Hanya sejarah semester 1 dengan status akhir selain Pindah/Keluar yang dapat dipindahkan.']);
        }
        if (! LembagaSantri::where('santri_id', $riwayat->santri_id)
            ->where('jenjang', $riwayat->jenjang)
            ->where('is_active_lembaga', LembagaSantri::YA)
            ->exists()) {
            throw ValidationException::withMessages(['riwayat_id' => 'Santri tidak aktif di lembaga ini.']);
        }
        if (RiwayatBelajar::where('santri_id', $riwayat->santri_id)
            ->where('jenjang', $riwayat->jenjang)
            ->where('tahun_ajaran', $riwayat->tahun_ajaran)
            ->where('semester', '2')
            ->exists()) {
            throw ValidationException::withMessages(['riwayat_id' => 'Baris semester 2 tahun ini sudah ada.']);
        }
    }

    /** Guard kelas pengganti salin genap: wajib se-lembaga & se-tahun dengan baris aktif. */
    protected function cekKelasGenap(Santri $santri, string $lembagaId, ?int $kelasId, ?int $riwayatId = null): void
    {
        if ($kelasId === null) {
            return;
        }
        $kelas = Kelas::findOrFail($kelasId);
        if ($kelas->jenjang !== $lembagaId) {
            throw ValidationException::withMessages(['kelas_id' => 'Kelas beda lembaga.']);
        }
        $ganjil = $riwayatId !== null
            ? RiwayatBelajar::whereKey($riwayatId)->first()
            : RiwayatBelajar::where('santri_id', $santri->id)
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
                $baru->load(['santri:id,nama_lengkap', 'kelas:id,nama_kelas', 'tahunAjaran:nama']);
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

    public function batalSalinMassal(SiklusLembagaRequest $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);
        $data = $request->validated();
        $lembagaId = $data['jenjang'];
        $this->authorizeLembaga($request->user(), $lembagaId);
        $tahunAktif = TahunAjaran::aktif($lembagaId);
        if ($tahunAktif === null || ($data['tahun_ajaran'] ?? null) !== $tahunAktif->nama) {
            throw ValidationException::withMessages(['tahun_ajaran' => 'Batal hanya berlaku pada tahun ajaran aktif.']);
        }

        $query = RiwayatBelajar::where('jenjang', $lembagaId)
            ->where('tahun_ajaran', $tahunAktif->nama)
            ->where('semester', '2')
            ->where('is_active_riwayat', RiwayatBelajar::YA);
        $this->applyFilter($query, $request, 'tingkat', 'riwayat_belajar.tingkat');
        $this->applyFilter($query, $request, 'kelas_id', 'riwayat_belajar.kelas_id', true);
        if ($request->filled('q')) {
            $q = (string) $request->input('q');
            $query->whereHas('santri', fn ($s) => $s
                ->where('nama_lengkap', 'like', "%{$q}%")
                ->orWhere('nik', 'like', "%{$q}%"));
        }

        $ok = 0;
        $gagal = [];
        foreach ($query->orderBy('id')->get() as $riwayat) {
            try {
                $santri = Santri::findOrFail($riwayat->santri_id);
                $this->authorizeAksiLembaga($request, $santri, $lembagaId);
                $this->cekBatalDariRiwayat($riwayat, $tahunAktif->nama);
                $this->siklusService->batalSalin($santri, $lembagaId, $riwayat->id);
                $ok++;
            } catch (\Throwable $e) {
                $gagal[] = ['santri_id' => $riwayat->santri_id, 'pesan' => $e->getMessage()];
            }
        }

        return response()->json(['pesan' => 'Pembatalan semester selesai.', 'berhasil' => $ok, 'gagal' => $gagal]);
    }

    protected function cekBatalDariRiwayat(RiwayatBelajar $riwayat, string $tahunAktif): void
    {
        if ($riwayat->tahun_ajaran !== $tahunAktif || $riwayat->semester !== '2' || $riwayat->is_active_riwayat !== RiwayatBelajar::YA) {
            throw ValidationException::withMessages(['riwayat_id' => 'Baris semester 2 aktif pada tahun ajaran aktif tidak ditemukan.']);
        }
        if (! LembagaSantri::where('santri_id', $riwayat->santri_id)
            ->where('jenjang', $riwayat->jenjang)
            ->where('is_active_lembaga', LembagaSantri::YA)
            ->exists()) {
            throw ValidationException::withMessages(['riwayat_id' => 'Santri tidak aktif di lembaga ini.']);
        }
        if (! RiwayatBelajar::where('santri_id', $riwayat->santri_id)
            ->where('jenjang', $riwayat->jenjang)
            ->where('tahun_ajaran', $riwayat->tahun_ajaran)
            ->where('semester', '1')
            ->exists()) {
            throw ValidationException::withMessages(['riwayat_id' => 'Baris semester 1 asal tidak ditemukan.']);
        }
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

        $mutasi = $this->scopeLembaga(
            MutasiKeluar::with(['santri:id,nama_lengkap,nisn', 'lembaga:jenjang,nama', 'kelasTerakhir:id,nama_kelas']),
            $request->user(),
            $request,
            'mutasi_keluar.jenjang'
        );
        $tahunAjaran = $this->nilaiFilter($request, 'tahun_ajaran');
        $tingkat = $this->nilaiFilter($request, 'tingkat');
        if ($tahunAjaran !== [] || $tingkat !== []) {
            $mutasi->whereHas('kelasTerakhir', function ($kelas) use ($tahunAjaran, $tingkat) {
                if ($tahunAjaran !== []) {
                    $kelas->whereIn('tahun_ajaran', $tahunAjaran);
                }
                if ($tingkat !== []) {
                    $kelas->whereIn('tingkat', $tingkat);
                }
            });
        }
        $this->applyFilter($mutasi, $request, 'kelas_id', 'kelas_terakhir_id', true);
        $mutasi->when($request->filled('q'), function ($q) use ($request) {
            $cari = (string) $request->input('q');
            $q->whereHas('santri', fn ($s) => $s->where('nama_lengkap', 'like', "%{$cari}%"));
        });
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

    /** GET /api/admin/mutasi-keluar/ekspor-data — unduh data arsip mutasi existing
     *  (kolom = template import; kelas ditulis sebagai nama rombel). */
    public function eksporDataMutasi(Request $request)
    {
        $this->authorize('viewAny', Santri::class);

        return Excel::download(
            new MutasiKeluarDataExport($this->jenjangUntukBerkas($request)),
            'data-mutasi-keluar-existing.xlsx'
        );
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
    /**
     * POST /api/admin/mutasi-keluar/import-potong — import bertahap (potongan
     *  JSON 1000 baris/panggilan) dari browser. Lingkup ada per baris; izin
     *  dicek di MutasiKeluarImporService, bukan 403 di depan.
     */
    public function potongImportMutasi(MutasiKeluarPotongRequest $request, MutasiKeluarImporService $layanan): JsonResponse
    {
        return $this->jalankanImporSesi($request, 'mutasi', $layanan);
    }

    /** POST /api/admin/mutasi-keluar/import-potong/{sesi}/batal. */
    public function batalPotongMutasi(Request $request, ImportSesi $sesi): JsonResponse
    {
        return $this->batalImporSesi($request, $sesi);
    }

    /** GET /api/admin/mutasi-keluar/import-potong/{sesi}/galat — unduh CSV galat. */
    public function galatPotongMutasi(Request $request, ImportSesi $sesi)
    {
        return $this->unduhGalatImpor($request, $sesi, 'galat-import-mutasi-keluar.csv');
    }

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

        $alumni = $this->scopeLembaga(
            Alumni::with(['santri:id,nama_lengkap,nisn', 'lembagaLulus:jenjang,nama', 'tahunAjaranLulus:nama', 'kelasLulus:id,nama_kelas']),
            $request->user(),
            $request,
            'alumni.lembaga_lulus'
        );
        $this->applyFilter($alumni, $request, 'tahun_ajaran', 'alumni.tahun_ajaran_lulus');
        $this->applyFilter($alumni, $request, 'tahun_ajaran_lulus', 'alumni.tahun_ajaran_lulus');
        $this->applyFilter($alumni, $request, 'kelas_id', 'alumni.kelas_lulus_id', true);
        $tingkat = $this->nilaiFilter($request, 'tingkat');
        if ($tingkat !== []) {
            $alumni->whereHas('kelasLulus', fn ($kelas) => $kelas->whereIn('tingkat', $tingkat));
        }
        $alumni->when($request->filled('q'), function ($q) use ($request) {
            $cari = (string) $request->input('q');
            $q->whereHas('santri', fn ($s) => $s->where('nama_lengkap', 'like', "%{$cari}%"));
        });
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

    public function templateImportAlumni()
    {
        return Excel::download(new AlumniTemplateExport, 'template-import-alumni.xlsx');
    }

    public function periksaImportAlumni(AlumniImportRequest $request): JsonResponse
    {
        return $this->prosesImportAlumni($request, periksa: true);
    }

    public function importAlumni(AlumniImportRequest $request): JsonResponse
    {
        return $this->prosesImportAlumni($request, periksa: false);
    }

    /**
     * POST /api/admin/alumni/import-potong — import bertahap (potongan JSON
     *  1000 baris/panggilan) dari browser. Lingkup ada per baris; izin dicek
     *  di AlumniImporService, bukan 403 di depan.
     */
    public function potongImportAlumni(AlumniPotongRequest $request, AlumniImporService $layanan): JsonResponse
    {
        return $this->jalankanImporSesi($request, 'alumni', $layanan);
    }

    /** POST /api/admin/alumni/import-potong/{sesi}/batal. */
    public function batalPotongAlumni(Request $request, ImportSesi $sesi): JsonResponse
    {
        return $this->batalImporSesi($request, $sesi);
    }

    /** GET /api/admin/alumni/import-potong/{sesi}/galat — unduh CSV galat. */
    public function galatPotongAlumni(Request $request, ImportSesi $sesi)
    {
        return $this->unduhGalatImpor($request, $sesi, 'galat-import-alumni.csv');
    }

    private function prosesImportAlumni(AlumniImportRequest $request, bool $periksa): JsonResponse
    {
        $request->validated();
        $import = new AlumniImport;
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
            'pesan' => "{$ringkasan['dibuat']} arsip dibuat, {$ringkasan['diperbarui']} diperbarui, {$ringkasan['dilewati']} dilewati.",
            'ringkasan' => $ringkasan,
        ]);
    }

    /**
     * GET /api/admin/akademik/daftar-kelas — daftar santri per kelas.
     * Muatan penuh 3 tabel: `riwayat_belajar` + `santri` (semua kolom) +
     * `lembaga_anggota` (baris `lembaga_santri` santri+lembaga, aktif
     * diutamakan) + relasi kelas/lembaga/tahun ajaran. `nis_lokal` ringkas
     * dipertahankan untuk kompatibilitas.
     * Tanpa `kelompok_status`: perilaku lama (is_active_riwayat pada TA default aktif
     * + semester berjalan). Dengan `kelompok_status=aktif|nonaktif`: basis
     * tampil = status_akhir (aktif = Aktif, Lanjut, Naik, Tidak Naik, Lulus,
     * Tidak Lulus; nonaktif = Pindah/Keluar) dan `lintas_periode=1`
     * mematikan default TA/semester agar bisa lintas periode.
     */
    public function daftarKelas(SiklusDaftarKelasRequest $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $data = $request->validated();
        $lembagaIds = $data['jenjang'];
        $this->authorizeLembagaMany($request->user(), $lembagaIds);
        $urut = $this->parseUrut($request, UrutKatalog::peta('daftar_kelas'));

        $lintas = $request->boolean('lintas_periode');
        $kelompok = $data['kelompok_status'] ?? null;
        $tahunIds = $data['tahun_ajaran'] ?? [];
        if ($tahunIds === [] && ! $lintas) {
            $tahunIds = collect($lembagaIds)
                ->map(fn (string $lembagaId) => TahunAjaran::aktif($lembagaId)?->nama)
                ->filter()
                ->unique()
                ->values()
                ->all();
        }
        if (! $lintas && $tahunIds === []) {
            return response()->json(['pesan' => 'Tahun ajaran aktif belum ada di lembaga ini.', 'data' => []]);
        }

        $semesterIds = $data['semester'] ?? [];
        if ($semesterIds === [] && ! $lintas) {
            $semesterIds = collect($lembagaIds)
                ->flatMap(function (string $lembagaId) use ($tahunIds) {
                    return collect($tahunIds)->map(function (string $tahunId) use ($lembagaId) {
                        return (string) (RiwayatBelajar::where('jenjang', $lembagaId)
                            ->where('tahun_ajaran', $tahunId)
                            ->where('is_active_riwayat', RiwayatBelajar::YA)
                            ->orderByDesc('semester')
                            ->value('semester') ?? '1');
                    });
                })
                ->filter()
                ->unique()
                ->values()
                ->all();
            $semesterIds = $semesterIds === [] ? ['1'] : $semesterIds;
        }

        $query = RiwayatBelajar::with([
            'santri',
            'kelas:id,nama_kelas,tingkat',
            'lembaga:jenjang,nama',
            // JANGAN eager-load `tahunAjaran`: kunci relasi di-snake_case jadi
            // `tahun_ajaran` dan menimpa atribut string FK (frontend menerima
            // objek → tampil "[object Object]"). Nilai FK-nya sudah nama TA.
        ])->whereIn('riwayat_belajar.jenjang', $lembagaIds);
        if ($tahunIds !== []) {
            $query->whereIn('riwayat_belajar.tahun_ajaran', $tahunIds);
        }
        if ($semesterIds !== []) {
            $query->whereIn('riwayat_belajar.semester', $semesterIds);
        }
        if ($kelompok === 'aktif') {
            // Aktif = gabungan status akhir (bukan flag is_active_riwayat).
            $query->whereIn('riwayat_belajar.status_akhir', ['aktif', 'lanjut', 'naik', 'tidak_naik', 'lulus', 'tidak_lulus']);
        } elseif ($kelompok === 'nonaktif') {
            $query->where('riwayat_belajar.status_akhir', 'pindah_keluar');
        } elseif ($kelompok === 'semua') {
            // Semua status: tanpa filter status sama sekali.
        } else {
            $query->where('riwayat_belajar.is_active_riwayat', RiwayatBelajar::YA);
        }

        $this->applyFilter($query, $request, 'kelas_id', 'riwayat_belajar.kelas_id', true);
        $this->applyFilter($query, $request, 'tingkat', 'riwayat_belajar.tingkat');
        if ($request->filled('q')) {
            $qcari = $request->input('q');
            $query->where(function ($w) use ($qcari, $lembagaIds) {
                $w->whereHas('santri', fn ($s) => $s
                    ->where('nama_lengkap', 'like', "%{$qcari}%")
                    ->orWhere('nik', 'like', "%{$qcari}%"))
                    ->orWhereIn('riwayat_belajar.santri_id', LembagaSantri::whereIn('jenjang', $lembagaIds)
                        ->where('nis_lokal', 'like', "%{$qcari}%")
                        ->select('santri_id'));
            });
        }

        if ($urut !== null) {
            $query->select('riwayat_belajar.*')
                ->leftJoin('santri', 'santri.id', '=', 'riwayat_belajar.santri_id')
                ->leftJoin('kelas', 'kelas.id', '=', 'riwayat_belajar.kelas_id')
                ->leftJoin('lembaga', 'lembaga.jenjang', '=', 'riwayat_belajar.jenjang')
                ->leftJoin('tahun_ajaran', 'tahun_ajaran.nama', '=', 'riwayat_belajar.tahun_ajaran');
        }
        // Urutan bawaan = lama (TA → semester → kelas → absen → santri);
        // nullable dikosongkan agar NULL tetap di depan seperti sebelumnya.
        $this->terapkanUrut($query, $urut, [
            ['riwayat_belajar.tahun_ajaran', 'naik'], ['riwayat_belajar.semester', 'naik'],
            ['riwayat_belajar.kelas_id', 'naik'], ['riwayat_belajar.no_absen', 'naik'],
            ['riwayat_belajar.santri_id', 'naik'],
        ]);

        $hasil = $query->paginate($this->perPage($request));
        // Keanggotaan penuh (satu baris per santri; aktif diutamakan) + NIS lokal
        // ringkas (kompatibilitas payload lama).
        $anggota = LembagaSantri::whereIn('santri_id', $hasil->getCollection()->pluck('santri_id')->unique())
            ->whereIn('jenjang', $lembagaIds)
            ->orderByDesc('is_active_lembaga')->orderBy('id')
            ->get()->groupBy('santri_id');
        $hasil->getCollection()->each(function ($r) use ($anggota) {
            $ls = $anggota[$r->santri_id]?->firstWhere('jenjang', $r->jenjang);
            $r->setRelation('lembaga_anggota', $ls);
            $r->setAttribute('nis_lokal', $ls?->nis_lokal);
        });

        $metadata = fn (array $values): string|array|null => count($values) === 1
            ? $values[0]
            : ($values === [] ? null : $values);

        return response()->json(array_merge($hasil->toArray(), [
            'jenjang' => $metadata($lembagaIds),
            'tahun_ajaran' => $metadata($tahunIds),
            'semester' => $metadata($semesterIds),
        ]));
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

        $riwayatQuery = function (bool $semuaTa = false) use ($request, $keaktifan) {
            // "Santri aktif pada periode" = terdaftar di TA+semester itu dan
            // tidak pindah keluar (definisi sama dengan Daftar Kelas), bukan
            // flag `is_active_riwayat` yang hanya menandai periode terkini.
            // Unique (santri, TA, jenjang, semester) → satu baris per santri.
            $q = RiwayatBelajar::query();
            if ($keaktifan === 'aktif') {
                $q->whereIn('status_akhir', ['aktif', 'lanjut', 'naik', 'tidak_naik', 'lulus', 'tidak_lulus']);
            } elseif ($keaktifan === 'nonaktif') {
                $q->where('status_akhir', 'pindah_keluar');
            }
            $this->scopeLembaga($q, $request->user(), $request, 'jenjang');
            if (! $semuaTa) {
                $this->applyFilter($q, $request, 'tahun_ajaran', 'tahun_ajaran');
            }
            $this->applyFilter($q, $request, 'semester', 'semester');
            $this->applyFilter($q, $request, 'tingkat', 'tingkat');
            $this->applyFilter($q, $request, 'kelas_id', 'kelas_id', true);

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
        $this->applyFilter($kelasQuery, $request, 'tahun_ajaran', 'tahun_ajaran');
        $this->applyFilter($kelasQuery, $request, 'tingkat', 'tingkat');
        $this->applyFilter($kelasQuery, $request, 'kelas_id', 'id', true);
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
