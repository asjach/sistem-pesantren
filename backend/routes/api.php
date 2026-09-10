<?php

use App\Http\Controllers\Api\Admin\KelasController;
use App\Http\Controllers\Api\Admin\LembagaController;
use App\Http\Controllers\Api\Admin\PosKeuanganController;
use App\Http\Controllers\Api\Admin\ReferensiController;
use App\Http\Controllers\Api\Admin\TahunAjaranController;
use App\Http\Controllers\Api\Admin\TarifBiayaController;
use App\Http\Controllers\Api\Admin\UserManagementController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\PengajuanBiodataController;
use App\Http\Controllers\Api\PsbController;
use App\Http\Controllers\Api\PsbDokumenController;
use App\Http\Controllers\Api\PsbPortalController;
use App\Http\Controllers\Api\PsbPublikController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:6,1');

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('me', [AuthController::class, 'me']);
    });
});

Route::middleware('auth:sanctum')->get('dashboard/ringkasan', [DashboardController::class, 'ringkasan']);

Route::middleware(['auth:sanctum', 'role:super_admin|admin'])
    ->prefix('admin')
    ->group(function () {
        Route::get('lembaga', [LembagaController::class, 'index']);
        Route::post('lembaga', [LembagaController::class, 'store']);
        Route::match(['put', 'patch'], 'lembaga/{lembaga}', [LembagaController::class, 'update']);
        Route::delete('lembaga/{lembaga}', [LembagaController::class, 'destroy']);

        Route::get('referensi/types', [ReferensiController::class, 'types']);
        Route::get('referensi/{tipe}', [ReferensiController::class, 'index']);
        Route::post('referensi/{tipe}', [ReferensiController::class, 'store']);
        Route::delete('referensi/{tipe}/{id}', [ReferensiController::class, 'destroy']);

        Route::apiResource('tahun-ajaran', TahunAjaranController::class)->only(['index', 'store', 'update', 'destroy']);
        Route::post('tahun-ajaran/{tahunAjaran}/set-aktif', [TahunAjaranController::class, 'setAktif']);

        Route::apiResource('kelas', KelasController::class)->only(['index', 'store', 'update', 'destroy']);

        Route::apiResource('pos-keuangan', PosKeuanganController::class)->only(['index', 'store', 'update', 'destroy']);
        Route::apiResource('tarif-biaya', TarifBiayaController::class)->only(['index', 'store', 'update', 'destroy']);

        Route::prefix('users')->group(function () {
            Route::get('/', [UserManagementController::class, 'index']);
            Route::post('/', [UserManagementController::class, 'store']);
            Route::match(['put', 'patch'], '/{user}', [UserManagementController::class, 'update']);
            Route::delete('/{user}', [UserManagementController::class, 'destroy']);
            Route::post('/import', [UserManagementController::class, 'import']);
            Route::post('/{user}/roles', [UserManagementController::class, 'assignRole']);
            Route::delete('/{user}/roles', [UserManagementController::class, 'removeRole']);
            Route::post('/{user}/lembaga', [UserManagementController::class, 'attachLembaga']);
            Route::delete('/{user}/lembaga', [UserManagementController::class, 'detachLembaga']);
        });

        Route::get('pengajuan-biodata', [PengajuanBiodataController::class, 'index']);
        Route::post('pengajuan-biodata/{id}/setujui', [PengajuanBiodataController::class, 'setujui']);
        Route::post('pengajuan-biodata/{id}/tolak', [PengajuanBiodataController::class, 'tolak']);

        Route::get('dokumen-wajib', [PsbDokumenController::class, 'indexWajib']);
        Route::post('dokumen-wajib', [PsbDokumenController::class, 'storeWajib']);
        Route::delete('dokumen-wajib/{id}', [PsbDokumenController::class, 'destroyWajib']);
    });

// PSB publik (tanpa auth; captcha SKIP — spec §5 hanya sebut sepintas tanpa implementasi).
Route::prefix('psb')->group(function () {
    Route::post('cek-nik', [PsbPublikController::class, 'cekNik'])->middleware('throttle:5,1');
    Route::post('daftar', [PsbPublikController::class, 'store'])->middleware('throttle:10,1');
    Route::post('daftar-paket', [PsbPublikController::class, 'storePaket'])->middleware('throttle:10,1');
    Route::get('{calon}/bukti-pdf', [PsbPublikController::class, 'bukti'])
        ->middleware('signed')
        ->name('psb.bukti-pdf');
});

// PSB admin (auth + role super_admin|admin, scope tenant lembaga per aksi).
Route::middleware(['auth:sanctum', 'role:super_admin|admin'])
    ->prefix('psb')
    ->group(function () {
        Route::get('antrean-daftar-ulang', [PsbController::class, 'antrean']);
        Route::post('{calon}/verifikasi', [PsbController::class, 'verifikasi']);
        Route::post('{calon}/seleksi', [PsbController::class, 'seleksi']);
        Route::post('{calon}/acc-daftar-ulang', [PsbController::class, 'acc']);
        Route::post('paket/{grup}/acc', [PsbController::class, 'accPaket']);
        Route::post('paket/{grup}/verifikasi', [PsbController::class, 'verifikasiPaket']);
        Route::post('{calon}/tolak', [PsbController::class, 'tolak']);
        Route::post('{calon}/promosi', [PsbController::class, 'promosi']);
        Route::post('paket/{grup}/tolak', [PsbController::class, 'tolakPaket']);
        Route::post('import', [PsbController::class, 'import']);
        Route::post('dokumen/{dokumen}/verifikasi', [PsbDokumenController::class, 'verifikasi']);
    });

// Portal orang tua (auth + role orang_tua, envelope pesan/data, cek pemilik B5).
Route::middleware(['auth:sanctum', 'role:orang_tua'])
    ->prefix('portal')
    ->group(function () {
        Route::prefix('psb')->group(function () {
            Route::post('lanjutan', [PsbPortalController::class, 'daftarLanjutan']);
            Route::put('{calon}/lengkapi', [PsbPortalController::class, 'lengkapi']);
            Route::post('{calon}/ajukan-daftar-ulang', [PsbPortalController::class, 'ajukan']);
            Route::get('riwayat', [PsbPortalController::class, 'riwayat']);
            Route::post('{calon}/dokumen', [PsbDokumenController::class, 'uploadCalon']);
        });
        Route::get('santri/{santri}/riwayat-pembayaran', [PsbPortalController::class, 'riwayatPembayaran']);
        Route::get('riwayat-keluarga', [PsbPortalController::class, 'riwayatKeluarga']);
        Route::post('santri/{santri}/pengajuan-biodata', [PengajuanBiodataController::class, 'ajukan']);
        Route::delete('pengajuan-biodata/{id}/batal', [PengajuanBiodataController::class, 'batalkan']);
    });

// List dokumen calon: orang_tua pemilik + admin tenant.
Route::middleware(['auth:sanctum', 'role:orang_tua|admin'])
    ->prefix('portal/psb')
    ->group(function () {
        Route::get('{calon}/dokumen', [PsbDokumenController::class, 'listCalon']);
    });
