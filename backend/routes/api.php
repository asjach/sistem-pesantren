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
    });
