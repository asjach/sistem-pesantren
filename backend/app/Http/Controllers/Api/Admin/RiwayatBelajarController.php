<?php

namespace App\Http\Controllers\Api\Admin;

use App\Exports\RiwayatBelajarTemplateExport;
use App\Http\Controllers\Api\Concerns\TenantGuard;
use App\Http\Controllers\Api\Concerns\UrutDaftar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\RiwayatImportRequest;
use App\Http\Requests\Admin\RiwayatKelasRequest;
use App\Http\Requests\Admin\RiwayatPotongRequest;
use App\Http\Requests\Admin\RiwayatStoreRequest;
use App\Http\Requests\Admin\RiwayatUpdateRequest;
use App\Imports\RiwayatBelajarImport;
use App\Models\ImportSesi;
use App\Models\LembagaSantri;
use App\Models\RiwayatBelajar;
use App\Models\Santri;
use App\Services\PenerimaanService;
use App\Services\RiwayatBelajarImporService;
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

    /** GET /api/admin/riwayat-belajar — roster riwayat (default hanya aktif).
     *  Filter kelas: `tanpa_kelas=1` (belum ditempatkan) / `dengan_kelas=1`
     *  (sudah masuk kelas) — dipakai dua panel halaman awal tahun ajaran. */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);
        $urut = $this->parseUrut($request, UrutKatalog::peta('riwayat_belajar'));

        $query = $this->scopeLembaga(
            RiwayatBelajar::with([
                'santri:id,nama_lengkap,jk',
                'kelas:id,nama_kelas,tingkat',
                'lembaga:jenjang,nama',
                'tahunAjaran:nama',
            ]),
            $request->user(),
            $request,
            'riwayat_belajar.jenjang'
        );

        if ($request->has('is_active_riwayat')) {
            $query->where('riwayat_belajar.is_active_riwayat', $request->boolean('is_active_riwayat') ? RiwayatBelajar::YA : RiwayatBelajar::TIDAK);
        } else {
            $query->where('riwayat_belajar.is_active_riwayat', RiwayatBelajar::YA);
        }
        if ($request->filled('tahun_ajaran')) {
            $query->where('riwayat_belajar.tahun_ajaran', $request->input('tahun_ajaran'));
        }
        if ($request->filled('semester')) {
            $query->where('riwayat_belajar.semester', $request->input('semester'));
        }
        if ($request->filled('tingkat')) {
            $query->where('riwayat_belajar.tingkat', $request->input('tingkat'));
        }
        if ($request->filled('kelas_id')) {
            $query->where('riwayat_belajar.kelas_id', $request->integer('kelas_id'));
        }
        if ($request->filled('status_akhir')) {
            $query->where('riwayat_belajar.status_akhir', $request->input('status_akhir'));
        }
        if ($request->filled('status_awal')) {
            $query->where('riwayat_belajar.status_awal', $request->input('status_awal'));
        }
        if ($request->boolean('tanpa_kelas')) {
            $query->whereNull('riwayat_belajar.kelas_id');
        }
        if ($request->boolean('dengan_kelas')) {
            $query->whereNotNull('riwayat_belajar.kelas_id');
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
                ->leftJoin('lembaga', 'lembaga.jenjang', '=', 'riwayat_belajar.jenjang')
                ->leftJoin('tahun_ajaran', 'tahun_ajaran.nama', '=', 'riwayat_belajar.tahun_ajaran');
        }
        $this->terapkanUrut($query, $urut, [
            ['riwayat_belajar.jenjang', 'naik'], ['riwayat_belajar.tingkat', 'naik'],
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
        $this->authorizeLembaga($request->user(), $data['jenjang']);

        $riwayat = $penerimaan->terima($santri, $data['jenjang'], (string) $data['tahun_ajaran'], [
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
        $this->authorizeAksiLembaga($request, $riwayat->santri, $riwayat->jenjang);
        $data = $request->validated();

        return response()->json([
            'pesan' => 'Kelas berhasil ditetapkan.',
            'data' => $siklus->setKelas($riwayat, (int) $data['kelas_id']),
        ]);
    }

    /** POST /api/admin/riwayat-belajar/{riwayat}/pindah-kelas. */
    public function pindahKelas(RiwayatKelasRequest $request, RiwayatBelajar $riwayat, SiklusSantriService $siklus): JsonResponse
    {
        $this->authorizeAksiLembaga($request, $riwayat->santri, $riwayat->jenjang);
        $data = $request->validated();

        return response()->json([
            'pesan' => 'Santri dipindah kelas.',
            'data' => $siklus->pindahKelas($riwayat, (int) $data['kelas_id']),
        ]);
    }

    /** POST /api/admin/riwayat-belajar/{riwayat}/keluar-kelas — batalkan penempatan. */
    public function keluarKelas(Request $request, RiwayatBelajar $riwayat, SiklusSantriService $siklus): JsonResponse
    {
        $this->authorizeAksiLembaga($request, $riwayat->santri, $riwayat->jenjang);

        return response()->json([
            'pesan' => 'Santri dikeluarkan dari kelas.',
            'data' => $siklus->keluarKelas($riwayat),
        ]);
    }

    /**
     * GET /api/admin/riwayat-belajar/belum-masuk — panel kiri halaman ganjil:
     * anggota aktif (`lembaga_santri`) yang belum punya riwayat aktif di lembaga
     * ini DAN belum punya baris semester 1 pada TA aktif (walau arsip, agar
     * aksi panah tak menabrak unique santri+tahun+lembaga+semester).
     */
    public function belumMasuk(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $data = $request->validate([
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);
        $lembagaId = $data['jenjang'];
        $ta = (string) $data['tahun_ajaran'];
        $this->authorizeLembaga($request->user(), $lembagaId);
        $this->cekTaEfektif($lembagaId, $ta);

        $query = $this->scopeLembaga(
            LembagaSantri::with([
                'santri:id,nama_lengkap,jk',
                'lembaga:jenjang,nama',
            ]),
            $request->user(),
            $request
        )->where('lembaga_santri.is_active_lembaga', LembagaSantri::YA);

        $query->whereNotExists(fn ($ada) => $ada->selectRaw('1')->from('riwayat_belajar')
            ->whereColumn('riwayat_belajar.santri_id', 'lembaga_santri.santri_id')
            ->whereColumn('riwayat_belajar.jenjang', 'lembaga_santri.jenjang')
            ->where('riwayat_belajar.is_active_riwayat', RiwayatBelajar::YA));
        $query->whereNotExists(fn ($ganjil) => $ganjil->selectRaw('1')->from('riwayat_belajar')
            ->whereColumn('riwayat_belajar.santri_id', 'lembaga_santri.santri_id')
            ->whereColumn('riwayat_belajar.jenjang', 'lembaga_santri.jenjang')
            ->where('riwayat_belajar.tahun_ajaran', $ta)
            ->where('riwayat_belajar.semester', '1'));

        if (! empty($data['q'])) {
            $cari = $data['q'];
            $query->where(fn ($w) => $w
                ->whereHas('santri', fn ($s) => $s
                    ->where('nama_lengkap', 'like', "%{$cari}%")
                    ->orWhere('nik', 'like', "%{$cari}%"))
                ->orWhere('lembaga_santri.nis_lokal', 'like', "%{$cari}%"));
        }

        $query->select('lembaga_santri.*')
            ->leftJoin('santri', 'santri.id', '=', 'lembaga_santri.santri_id')
            ->orderBy('santri.nama_lengkap')
            ->orderBy('lembaga_santri.id');

        return response()->json($query->paginate($this->perPage($request)));
    }

    /**
     * GET /api/admin/riwayat-belajar/belum-genap — panel kiri halaman Pindah
     * Semester: baris semester 1 AKTIF yang sudah masuk kelas dan belum punya
     * baris semester 2 pada TA yang sama (walau arsip, agar aksi panah tak
     * menabrak unique santri+tahun+lembaga+semester). Genap otomatis mewarisi
     * kelas ganjil. Filter tingkat/kelas/pencarian opsional.
     */
    public function belumGenap(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Santri::class);

        $data = $request->validate([
            'jenjang' => ['required', 'string', 'exists:lembaga,jenjang'],
            'tahun_ajaran' => ['required', 'string', 'exists:tahun_ajaran,nama'],
            'tingkat' => ['nullable', 'string', 'max:20'],
            'kelas_id' => ['nullable', 'integer', 'exists:kelas,id'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);
        $lembagaId = $data['jenjang'];
        $ta = (string) $data['tahun_ajaran'];
        $this->authorizeLembaga($request->user(), $lembagaId);
        $this->cekTaEfektif($lembagaId, $ta);

        $query = $this->scopeLembaga(
            // TANPA `tahunAjaran`: kunci relasi yang di-snake Laravel menimpa
            // atribut string `tahun_ajaran` (lihat KelasController@index).
            RiwayatBelajar::with([
                'santri:id,nama_lengkap,jk',
                'kelas:id,nama_kelas,tingkat',
                'lembaga:jenjang,nama',
            ]),
            $request->user(),
            $request,
            'riwayat_belajar.jenjang'
        )->where('riwayat_belajar.jenjang', $lembagaId)
            ->where('riwayat_belajar.tahun_ajaran', $ta)
            ->where('riwayat_belajar.semester', '1')
            ->where('riwayat_belajar.is_active_riwayat', RiwayatBelajar::YA)
            // Syarat pindah: sudah terdaftar di kelas (genap mewarisi kelas ini).
            ->whereNotNull('riwayat_belajar.kelas_id');

        // Sudah punya baris genap TA sama (aktif maupun arsip) → bukan calon.
        $query->whereNotExists(fn ($genap) => $genap->selectRaw('1')->from('riwayat_belajar as g2')
            ->whereColumn('g2.santri_id', 'riwayat_belajar.santri_id')
            ->whereColumn('g2.jenjang', 'riwayat_belajar.jenjang')
            ->where('g2.tahun_ajaran', $ta)
            ->where('g2.semester', '2'));

        if (! empty($data['tingkat'])) {
            $query->where('riwayat_belajar.tingkat', $data['tingkat']);
        }
        if (! empty($data['kelas_id'])) {
            $query->where('riwayat_belajar.kelas_id', (int) $data['kelas_id']);
        }
        if (! empty($data['q'])) {
            $cari = $data['q'];
            $query->where(fn ($w) => $w
                ->whereHas('santri', fn ($s) => $s
                    ->where('nama_lengkap', 'like', "%{$cari}%")
                    ->orWhere('nik', 'like', "%{$cari}%")));
        }

        $query->orderBy('riwayat_belajar.tingkat')
            ->orderBy('riwayat_belajar.kelas_id')
            ->orderBy('riwayat_belajar.no_absen')
            ->orderBy('riwayat_belajar.santri_id');

        $hasil = $query->paginate($this->perPage($request));

        $this->lampirkanNisLokal($hasil);

        return response()->json($hasil);
    }

    /** DELETE /api/admin/riwayat-belajar/{riwayat} — batalkan baris aktif (hard delete fisik). */
    public function destroy(Request $request, RiwayatBelajar $riwayat, SiklusSantriService $siklus): JsonResponse
    {
        $this->authorizeAksiLembaga($request, $riwayat->santri, $riwayat->jenjang);
        $siklus->hapusRiwayat($riwayat);

        return response()->json(['pesan' => 'Riwayat belajar dibatalkan.']);
    }

    /** PATCH /api/admin/riwayat-belajar/{riwayat} — ubah kolom skalar
     *  (semester/tingkat/no_absen/tgl_masuk). Status & kelas dikunci:
     *  status via pintu lifecycle, kelas via set/pindah/keluar-kelas. */
    public function update(RiwayatUpdateRequest $request, RiwayatBelajar $riwayat): JsonResponse
    {
        $this->authorizeAksiLembaga($request, $riwayat->santri, $riwayat->jenjang);

        $riwayat->update($request->validated());

        return response()->json(['pesan' => 'Riwayat belajar diubah.', 'data' => $riwayat->fresh()]);
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

        // File besar (puluhan ribu baris): beri waktu eksekusi eksplisit.
        ini_set('max_execution_time', '600');

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

        $ringkasan = $import->ringkasan();

        return response()->json([
            'pesan' => "{$ringkasan['dibuat']} riwayat dibuat, {$ringkasan['diperbarui']} diperbarui.",
            'ringkasan' => $ringkasan,
        ]);
    }

    /** Lampirkan NIS lokal (dari keanggotaan) ke tiap baris riwayat. */
    private function lampirkanNisLokal(LengthAwarePaginator $hasil): void
    {
        $santriIds = $hasil->getCollection()->pluck('santri_id')->unique()->values();
        $peta = LembagaSantri::whereIn('santri_id', $santriIds)
            ->get(['santri_id', 'jenjang', 'nis_lokal'])
            ->mapWithKeys(fn (LembagaSantri $ls) => [$ls->santri_id.':'.$ls->jenjang => $ls->nis_lokal]);

        $hasil->getCollection()->transform(function (RiwayatBelajar $row) use ($peta) {
            $row->setAttribute('nis_lokal', $peta[$row->santri_id.':'.$row->jenjang] ?? null);

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

    // ---------------- Import bertahap (potongan JSON) ----------------

    /**
     * POST /api/admin/riwayat-belajar/import-potong — satu potongan baris
     * (maks 2000) dari browser. Panggilan pertama tanpa `sesi_id` membuat
     * sesi (wajib `mode` + `total`); berikutnya wajib `sesi_id` milik sendiri.
     * Frontend mengirim SEMUA baris data berurutan (termasuk yang kosong)
     * agar nomor galat absolut selaras nomor Excel (1 = heading).
     */
    public function potongImport(RiwayatPotongRequest $request, RiwayatBelajarImporService $layanan): JsonResponse
    {
        $data = $request->validated();
        $pengguna = $request->user();

        $this->buangSesiBasi();

        if (! empty($data['sesi_id'])) {
            $sesi = ImportSesi::whereKey($data['sesi_id'])->where('user_id', $pengguna->id)->first();
            if ($sesi === null) {
                return response()->json(['message' => 'Sesi import tidak ditemukan.'], 404);
            }
            if ($sesi->status !== ImportSesi::JALAN) {
                return response()->json(['message' => 'Sesi sudah selesai atau dibatalkan.'], 422);
            }
            if ($sesi->mode !== $data['mode']) {
                return response()->json(['message' => 'Mode potongan berbeda dari sesi.'], 422);
            }
        } else {
            $sesi = ImportSesi::create([
                'user_id' => $pengguna->id,
                'tipe' => 'riwayat',
                'mode' => $data['mode'],
                'total' => $data['total'],
            ]);
        }

        $kering = $sesi->mode === 'periksa';
        $normal = array_map(fn ($baris) => $layanan->normalisasiBaris((array) $baris), $data['baris']);
        $layanan->prosesPotongan($normal, $sesi->offset + 1, $kering);

        $baru = $layanan->gagal;
        if ($baru !== []) {
            $this->tambahGalatSesi($sesi, $baru);
        }
        $sesi->offset += count($data['baris']);
        $sesi->dibuat += $layanan->dibuat;
        $sesi->diperbarui += $layanan->diperbarui;
        $sesi->gagal += count($baru);

        $selesai = $request->boolean('terakhir') || $sesi->offset >= $sesi->total;
        if ($selesai) {
            $sesi->status = ImportSesi::SELESAI;
        }
        $sesi->save();

        return response()->json([
            'sesi_id' => $sesi->id,
            'offset' => $sesi->offset,
            'total' => $sesi->total,
            'selesai' => $selesai,
            'ringkasan' => $sesi->ringkasan(),
            'galat_baru' => count($baru),
            'galat_contoh' => array_slice($sesi->galat_contoh ?? [], 0, 10),
            'galat_unduh' => $selesai && $sesi->gagal > 0,
        ]);
    }

    /** POST /api/admin/riwayat-belajar/import-potong/{sesi}/batal. */
    public function batalPotong(Request $request, ImportSesi $sesi): JsonResponse
    {
        if ($sesi->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Sesi import tidak ditemukan.'], 404);
        }
        $this->hapusBerkasGalat($sesi);
        $sesi->update(['status' => ImportSesi::BATAL]);

        return response()->json(['pesan' => 'Sesi import dibatalkan.']);
    }

    /** GET /api/admin/riwayat-belajar/import-potong/{sesi}/galat — unduh CSV galat. */
    public function galatPotong(Request $request, ImportSesi $sesi)
    {
        if ($sesi->user_id !== $request->user()->id || $sesi->galat_file === null) {
            abort(404);
        }
        $path = storage_path('app/'.$sesi->galat_file);
        if (! is_file($path)) {
            abort(404);
        }

        return response()->download($path, 'galat-import-riwayat.csv', ['Content-Type' => 'text/csv']);
    }

    /** Tambah galat potongan ke berkas CSV sesi + contoh (maks 200). */
    private function tambahGalatSesi(ImportSesi $sesi, array $baru): void
    {
        $relatif = $sesi->galat_file ?? "imports/galat-{$sesi->id}.csv";
        $path = storage_path('app/'.$relatif);
        if (! is_dir(dirname($path))) {
            mkdir(dirname($path), 0755, true);
        }
        $baruBerkas = ! is_file($path);
        $tulis = fopen($path, 'ab');
        if ($baruBerkas) {
            fputcsv($tulis, ['baris', 'nis_lokal', 'kolom', 'pesan']);
        }
        foreach ($baru as $galat) {
            fputcsv($tulis, [$galat['baris'], $galat['nis_lokal'] ?? '', $galat['kolom'], $galat['pesan']]);
        }
        fclose($tulis);

        $contoh = $sesi->galat_contoh ?? [];
        foreach ($baru as $galat) {
            if (count($contoh) >= 200) {
                break;
            }
            $contoh[] = $galat;
        }
        $sesi->galat_file = $relatif;
        $sesi->galat_contoh = $contoh;
    }

    private function hapusBerkasGalat(ImportSesi $sesi): void
    {
        if ($sesi->galat_file !== null) {
            $path = storage_path('app/'.$sesi->galat_file);
            if (is_file($path)) {
                @unlink($path);
            }
        }
    }

    /** Bersihkan sesi basi (melewati TTL) beserta berkas galatnya. */
    private function buangSesiBasi(): void
    {
        ImportSesi::where('created_at', '<', now()->subHours(ImportSesi::TTL_JAM))
            ->chunkById(100, function ($daftar) {
                foreach ($daftar as $sesi) {
                    $this->hapusBerkasGalat($sesi);
                    $sesi->delete();
                }
            });
    }
}
