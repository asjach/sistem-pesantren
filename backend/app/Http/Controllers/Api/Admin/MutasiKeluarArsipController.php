<?php

namespace App\Http\Controllers\Api\Admin;

use App\Exports\MutasiKeluarDataExport;
use App\Exports\MutasiKeluarTemplateExport;
use App\Http\Controllers\Api\Concerns\ImporBertahap;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\MutasiKeluarImportRequest;
use App\Http\Requests\Admin\MutasiKeluarPotongRequest;
use App\Imports\MutasiKeluarImport;
use App\Models\ImportSesi;
use App\Models\MutasiKeluar;
use App\Models\Santri;
use App\Services\MutasiKeluarImporService;
use App\Services\UrutKatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Facades\Excel;

/**
 * Arsip mutasi keluar: daftar terskop tenant, ekspor/template Excel,
 * dan dua jalur import (file massal + potongan bertahap).
 * Dipisah dari SiklusController (kenaikan/kelulusan/salin semester).
 */
class MutasiKeluarArsipController extends Controller
{
    use ImporBertahap;
    use TenantGuard;
    use UrutDaftar;

    /** Urutan nullable yang dipakai daftar arsip. */
    private const SORT_NULLABLE = [
        'mutasi_keluar.tanggal_mutasi', 'kelas.nama_kelas', 'tahun_ajaran.nama',
    ];

    /** GET /api/admin/mutasi-keluar — arsip mutasi (terskop tenant). */
    public function index(Request $request): JsonResponse
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
        $this->terapkanUrut($mutasi, $urut, [['mutasi_keluar.id', 'turun']], self::SORT_NULLABLE);
        $mutasi = $mutasi->paginate($this->perPage($request));

        return response()->json($mutasi);
    }

    /** GET /api/admin/mutasi-keluar/import-template — template Excel import arsip. */
    public function templateImport()
    {
        return Excel::download(new MutasiKeluarTemplateExport, 'template-import-mutasi-keluar.xlsx');
    }

    /** GET /api/admin/mutasi-keluar/ekspor-data — unduh data arsip mutasi existing
     *  (kolom = template import; kelas ditulis sebagai nama rombel). */
    public function eksporData(Request $request)
    {
        $this->authorize('viewAny', Santri::class);

        return Excel::download(
            new MutasiKeluarDataExport($this->jenjangUntukBerkas($request)),
            'data-mutasi-keluar-existing.xlsx'
        );
    }

    /** POST /api/admin/mutasi-keluar/import-periksa — validasi file TANPA menulis (dry-run). */
    public function periksaImport(MutasiKeluarImportRequest $request): JsonResponse
    {
        return $this->prosesImport($request, periksa: true);
    }

    /** POST /api/admin/mutasi-keluar/import — import arsip mutasi massal. */
    public function import(MutasiKeluarImportRequest $request): JsonResponse
    {
        return $this->prosesImport($request, periksa: false);
    }

    /** Alur bersama import arsip mutasi multi-lembaga. Mode periksa:
     *  transaksi selalu di-rollback. Izin dicek per baris di import
     *  (mengikuti akun), bukan 403 di depan. */
    /**
     * POST /api/admin/mutasi-keluar/import-potong — import bertahap (potongan
     *  JSON 1000 baris/panggilan) dari browser. Lingkup ada per baris; izin
     *  dicek di MutasiKeluarImporService, bukan 403 di depan.
     */
    public function potongImport(MutasiKeluarPotongRequest $request, MutasiKeluarImporService $layanan): JsonResponse
    {
        return $this->jalankanImporSesi($request, 'mutasi', $layanan);
    }

    /** POST /api/admin/mutasi-keluar/import-potong/{sesi}/batal. */
    public function batalPotong(Request $request, ImportSesi $sesi): JsonResponse
    {
        return $this->batalImporSesi($request, $sesi);
    }

    /** GET /api/admin/mutasi-keluar/import-potong/{sesi}/galat — unduh CSV galat. */
    public function galatPotong(Request $request, ImportSesi $sesi)
    {
        return $this->unduhGalatImpor($request, $sesi, 'galat-import-mutasi-keluar.csv');
    }

    private function prosesImport(MutasiKeluarImportRequest $request, bool $periksa): JsonResponse
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
}
