<?php

namespace App\Http\Controllers\Api\Admin;

use App\Exports\RiwayatBelajarTemplateExport;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\RiwayatImportRequest;
use App\Http\Requests\Admin\RiwayatKelasRequest;
use App\Http\Requests\Admin\RiwayatStoreRequest;
use App\Imports\RiwayatBelajarImport;
use App\Models\LembagaSantri;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Services\PenerimaanService;
use App\Services\SiklusSantriService;
use App\Services\UrutKatalog;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\Validators\Failure;
use Maatwebsite\Excel\Validators\ValidationException;

/**
 * Riwayat belajar (`riwayat_belajar`): jejak kelas/semester per santri+lembaga.
 * Halaman "Riwayat Belajar" — tabel, dialog input, dan import Excel terpisah.
 */
class RiwayatBelajarController extends Controller
{
    use TenantGuard;
    use UrutDaftar;

    private const SORT_NULLABLE = [
        'kelas.nama_kelas', 'riwayat_belajar.tingkat', 'riwayat_belajar.no_absen',
    ];

    /** GET /api/admin/riwayat-belajar — roster riwayat (default hanya aktif). */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);
        $urut = $this->parseUrut($request, UrutKatalog::peta('riwayat_belajar'));

        $query = $this->scopeLembaga(
            RiwayatBelajar::with([
                'santri:id,nama_lengkap,jk',
                'kelas:id,nama_kelas,tingkat',
                'lembaga:id,nama,kode',
                'tahunAjaran:id,nama',
            ]),
            $request->user(),
            $request
        );

        if ($request->has('is_aktif')) {
            $query->where('riwayat_belajar.is_aktif', $request->boolean('is_aktif'));
        } else {
            $query->where('riwayat_belajar.is_aktif', true);
        }
        if ($request->filled('tahun_ajaran_id')) {
            $query->where('tahun_ajaran_id', $request->integer('tahun_ajaran_id'));
        }
        if ($request->filled('semester')) {
            $query->where('semester', $request->input('semester'));
        }
        if ($request->filled('tingkat')) {
            $query->where('tingkat', $request->input('tingkat'));
        }
        if ($request->filled('kelas_id')) {
            $query->where('kelas_id', $request->integer('kelas_id'));
        }
        if ($request->filled('status_akhir')) {
            $query->where('status_akhir', $request->input('status_akhir'));
        }
        if ($request->boolean('tanpa_kelas')) {
            $query->whereNull('kelas_id');
        }
        if ($request->filled('q')) {
            $q = $request->input('q');
            $query->whereHas('santri', fn ($s) => $s
                ->where('nama_lengkap', 'like', "%{$q}%")
                ->orWhere('nik', 'like', "%{$q}%"));
        }

        if ($urut !== null) {
            $query->select('riwayat_belajar.*')
                ->leftJoin('santri', 'santri.id', '=', 'riwayat_belajar.santri_id')
                ->leftJoin('kelas', 'kelas.id', '=', 'riwayat_belajar.kelas_id')
                ->leftJoin('lembaga', 'lembaga.id', '=', 'riwayat_belajar.lembaga_id')
                ->leftJoin('tahun_ajaran', 'tahun_ajaran.id', '=', 'riwayat_belajar.tahun_ajaran_id');
        }
        $this->terapkanUrut($query, $urut, [
            ['riwayat_belajar.lembaga_id', 'naik'], ['riwayat_belajar.tingkat', 'naik'],
            ['riwayat_belajar.kelas_id', 'naik'], ['riwayat_belajar.no_absen', 'naik'],
            ['riwayat_belajar.santri_id', 'naik'],
        ], self::SORT_NULLABLE);

        $hasil = $query->paginate($this->perPage($request));

        $this->lampirkanNisLokal($hasil);

        return response()->json($hasil);
    }

    /**
     * POST /api/admin/riwayat-belajar — dialog input riwayat / penerimaan santri:
     * santri + lembaga + tahun ajaran (+ kelas/tingkat/status awal opsional).
     */
    public function store(RiwayatStoreRequest $request, PenerimaanService $penerimaan): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $data = $request->validated();

        $santri = Santri::findOrFail($data['santri_id']);
        $this->authorize('update', $santri);
        $this->authorizeLembaga($request->user(), (int) $data['lembaga_id']);
        $this->tolakLembagaRoot((int) $data['lembaga_id']);

        $riwayat = $penerimaan->terima($santri, (int) $data['lembaga_id'], (int) $data['tahun_ajaran_id'], [
            'kelas_id' => $data['kelas_id'] ?? null,
            'tingkat' => $data['tingkat'] ?? null,
            'no_absen' => $data['no_absen'] ?? null,
            'status_awal' => $data['status_awal'] ?? 'santri_baru',
            'tgl_masuk' => $data['tgl_masuk'] ?? null,
            'nis_lokal' => $data['nis_lokal'] ?? null,
        ]);

        return response()->json(['pesan' => 'Riwayat belajar ditambahkan.', 'data' => $riwayat], 201);
    }

    /** POST /api/admin/riwayat-belajar/{riwayat}/set-kelas — penempatan kelas menyusul. */
    public function setKelas(RiwayatKelasRequest $request, RiwayatBelajar $riwayat, SiklusSantriService $siklus): JsonResponse
    {
        $this->authorizeAksiLembaga($request, $riwayat->santri, (int) $riwayat->lembaga_id);
        $data = $request->validated();

        return response()->json([
            'pesan' => 'Kelas berhasil ditetapkan.',
            'data' => $siklus->setKelas($riwayat, (int) $data['kelas_id']),
        ]);
    }

    /** POST /api/admin/riwayat-belajar/{riwayat}/pindah-kelas. */
    public function pindahKelas(RiwayatKelasRequest $request, RiwayatBelajar $riwayat, SiklusSantriService $siklus): JsonResponse
    {
        $this->authorizeAksiLembaga($request, $riwayat->santri, (int) $riwayat->lembaga_id);
        $data = $request->validated();

        return response()->json([
            'pesan' => 'Santri dipindah kelas.',
            'data' => $siklus->pindahKelas($riwayat, (int) $data['kelas_id']),
        ]);
    }

    /** POST /api/admin/riwayat-belajar/{riwayat}/keluar-kelas — batalkan penempatan. */
    public function keluarKelas(Request $request, RiwayatBelajar $riwayat, SiklusSantriService $siklus): JsonResponse
    {
        $this->authorizeAksiLembaga($request, $riwayat->santri, (int) $riwayat->lembaga_id);

        return response()->json([
            'pesan' => 'Santri dikeluarkan dari kelas.',
            'data' => $siklus->keluarKelas($riwayat),
        ]);
    }

    // ---------------- Import riwayat belajar (terpisah dari import identitas) ----------------

    /** GET /api/admin/riwayat-belajar/import-template */
    public function template(Request $request)
    {
        $this->authorize('viewAny', Santri::class);

        return Excel::download(new RiwayatBelajarTemplateExport, 'template-import-riwayat-belajar.xlsx');
    }

    /** POST /api/admin/riwayat-belajar/import-periksa — dry-run tanpa menulis. */
    public function periksaImport(RiwayatImportRequest $request): JsonResponse
    {
        return $this->prosesImport($request, periksa: true);
    }

    /** POST /api/admin/riwayat-belajar/import-lengkap */
    public function importLengkap(RiwayatImportRequest $request): JsonResponse
    {
        return $this->prosesImport($request, periksa: false);
    }

    private function prosesImport(RiwayatImportRequest $request, bool $periksa): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $request->validated();

        $import = new RiwayatBelajarImport;
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
            return response()->json(['pesan' => 'Gagal mengimport beberapa data.', 'errors' => $errors], 422);
        }

        return response()->json(['pesan' => 'Riwayat belajar berhasil diimport.']);
    }

    /** Lampirkan NIS lokal (dari keanggotaan) ke tiap baris riwayat. */
    private function lampirkanNisLokal(LengthAwarePaginator $hasil): void
    {
        $santriIds = $hasil->getCollection()->pluck('santri_id')->unique()->values();
        $peta = LembagaSantri::whereIn('santri_id', $santriIds)
            ->get(['santri_id', 'lembaga_id', 'nis_lokal'])
            ->mapWithKeys(fn (LembagaSantri $ls) => [$ls->santri_id.':'.$ls->lembaga_id => $ls->nis_lokal]);

        $hasil->getCollection()->transform(function (RiwayatBelajar $row) use ($peta) {
            $row->setAttribute('nis_lokal', $peta[$row->santri_id.':'.$row->lembaga_id] ?? null);

            return $row;
        });
    }

    /** @param  iterable<Failure>  $failures */
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
