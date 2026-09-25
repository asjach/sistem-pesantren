<?php

namespace App\Http\Controllers\Api\Admin;

use App\Exports\AlumniTemplateExport;
use App\Http\Controllers\Api\Concerns\ImporBertahap;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AlumniImportRequest;
use App\Http\Requests\Admin\AlumniPotongRequest;
use App\Imports\AlumniImport;
use App\Models\Alumni;
use App\Models\ImportSesi;
use App\Models\Santri;
use App\Services\AlumniImporService;
use App\Services\UrutKatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Facades\Excel;

/**
 * Arsip alumni: daftar terskop tenant, template Excel, dan dua jalur
 * import (file massal + potongan bertahap).
 * Dipisah dari SiklusController (kenaikan/kelulusan/salin semester).
 */
class AlumniArsipController extends Controller
{
    use ImporBertahap;
    use TenantGuard;
    use UrutDaftar;

    /** Urutan nullable yang dipakai daftar arsip. */
    private const SORT_NULLABLE = [
        'alumni.tanggal_lulus', 'kelas.nama_kelas', 'tahun_ajaran.nama',
    ];

    /** GET /api/admin/alumni — arsip alumni (terskop tenant via lembaga lulus). */
    public function index(Request $request): JsonResponse
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
        $this->terapkanUrut($alumni, $urut, [['alumni.id', 'turun']], self::SORT_NULLABLE);
        $alumni = $alumni->paginate($this->perPage($request));

        return response()->json($alumni);
    }

    public function templateImport()
    {
        return Excel::download(new AlumniTemplateExport, 'template-import-alumni.xlsx');
    }

    public function periksaImport(AlumniImportRequest $request): JsonResponse
    {
        return $this->prosesImport($request, periksa: true);
    }

    public function import(AlumniImportRequest $request): JsonResponse
    {
        return $this->prosesImport($request, periksa: false);
    }

    /**
     * POST /api/admin/alumni/import-potong — import bertahap (potongan JSON
     *  1000 baris/panggilan) dari browser. Lingkup ada per baris; izin dicek
     *  di AlumniImporService, bukan 403 di depan.
     */
    public function potongImport(AlumniPotongRequest $request, AlumniImporService $layanan): JsonResponse
    {
        return $this->jalankanImporSesi($request, 'alumni', $layanan);
    }

    /** POST /api/admin/alumni/import-potong/{sesi}/batal. */
    public function batalPotong(Request $request, ImportSesi $sesi): JsonResponse
    {
        return $this->batalImporSesi($request, $sesi);
    }

    /** GET /api/admin/alumni/import-potong/{sesi}/galat — unduh CSV galat. */
    public function galatPotong(Request $request, ImportSesi $sesi)
    {
        return $this->unduhGalatImpor($request, $sesi, 'galat-import-alumni.csv');
    }

    private function prosesImport(AlumniImportRequest $request, bool $periksa): JsonResponse
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
}
