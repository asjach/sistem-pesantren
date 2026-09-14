<?php

use App\Http\Controllers\Api\Admin\KelasController;
use App\Http\Controllers\Api\Admin\LembagaController;
use App\Http\Controllers\Api\Admin\PosKeuanganController;
use App\Http\Controllers\Api\Admin\PresetTabelController;
use App\Http\Controllers\Api\Admin\PsbBiayaController;
use App\Http\Controllers\Api\Admin\PsbKegiatanController;
use App\Http\Controllers\Api\Admin\ReferensiController;
use App\Http\Controllers\Api\Admin\SantriController;
use App\Http\Controllers\Api\Admin\SiklusController;
use App\Http\Controllers\Api\Admin\TahunAjaranController;
use App\Http\Controllers\Api\Admin\TarifBiayaController;
use App\Http\Controllers\Api\Admin\UserManagementController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\KamusController;
use App\Http\Controllers\Api\KeuanganController;
use App\Http\Controllers\KuitansiController;
use App\Http\Controllers\Api\PengajuanBiodataController;
use App\Http\Controllers\Api\PsbController;
use App\Http\Controllers\Api\PsbDokumenController;
use App\Http\Controllers\Api\PsbPortalController;
use App\Http\Controllers\Api\PsbPublikController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::post('logout-all', [AuthController::class, 'logoutAll']);
        Route::get('me', [AuthController::class, 'me']);
    });
});

Route::middleware(['auth:sanctum', 'role:super_admin|admin', 'throttle:api_user'])
    ->get('dashboard/ringkasan', [DashboardController::class, 'ringkasan']);

Route::middleware(['auth:sanctum', 'role:super_admin|admin', 'throttle:api_user'])
    ->prefix('admin')
    ->group(function () {
        Route::get('lembaga', [LembagaController::class, 'index']);
        Route::post('lembaga', [LembagaController::class, 'store']);
        Route::match(['put', 'patch'], 'lembaga/{lembaga}', [LembagaController::class, 'update']);
        Route::delete('lembaga/{lembaga}', [LembagaController::class, 'destroy']);

        Route::get('referensi/types', [ReferensiController::class, 'types']);
        Route::get('referensi/{tipe}', [ReferensiController::class, 'index']);
        Route::post('referensi/{tipe}', [ReferensiController::class, 'store']);
        Route::match(['put', 'patch'], 'referensi/{tipe}/{id}', [ReferensiController::class, 'update']);
        Route::delete('referensi/{tipe}/{id}', [ReferensiController::class, 'destroy']);

        Route::apiResource('tahun-ajaran', TahunAjaranController::class)->only(['index', 'store', 'update', 'destroy']);
        Route::post('tahun-ajaran/{tahunAjaran}/set-aktif', [TahunAjaranController::class, 'setAktif']);

        Route::apiResource('kelas', KelasController::class)->only(['index', 'store', 'update', 'destroy']);

        Route::apiResource('pos-keuangan', PosKeuanganController::class)->only(['index', 'store', 'update', 'destroy']);
        Route::apiResource('tarif-biaya', TarifBiayaController::class)->only(['index', 'store', 'update', 'destroy']);

        // Data Santri (101: master profil + import PPDB massal + foto/dokumen)
        Route::get('santri', [SantriController::class, 'index']);
        Route::post('santri', [SantriController::class, 'store']);
        Route::get('santri/import-template', [SantriController::class, 'template']);
        Route::patch('santri/{santri}', [SantriController::class, 'update']);
        Route::post('santri/import-lengkap', [SantriController::class, 'importLengkap'])->middleware('throttle:imports');
        Route::post('santri/{santri}/foto', [SantriController::class, 'uploadFoto']);
        Route::get('santri/{santri}/dokumen', [SantriController::class, 'listDokumen']);
        Route::post('santri/{santri}/dokumen', [SantriController::class, 'uploadDokumen']);
        Route::post('santri/{santri}/dokumen/{dokumen}/tidak-memiliki', [SantriController::class, 'tidakMemiliki']);

        // Siklus status santri (102: naik/tinggal/pindah kelas, mutasi, lulus, alumni)
        Route::post('akademik/naik-kelas', [SiklusController::class, 'naikKelasMassal']);
        Route::post('riwayat/{riwayat}/pindah-kelas', [SiklusController::class, 'pindahKelas']);
        Route::post('riwayat/{riwayat}/set-kelas', [SiklusController::class, 'setKelas']);
        Route::post('riwayat/{riwayat}/keluar-kelas', [SiklusController::class, 'keluarKelas']);
        Route::post('santri/{santri}/berhenti-jenjang', [SiklusController::class, 'berhentiJenjang']);
        Route::post('santri/{santri}/mutasi', [SiklusController::class, 'mutasiKeluar']);
        Route::post('santri/{santri}/lulus', [SiklusController::class, 'lulus']);
        Route::get('mutasi-keluar', [SiklusController::class, 'getMutasiKeluar']);
        Route::get('alumni', [SiklusController::class, 'getAlumni']);

        Route::prefix('users')->group(function () {
            Route::get('/', [UserManagementController::class, 'index']);
            Route::post('/', [UserManagementController::class, 'store']);
            Route::match(['put', 'patch'], '/{user}', [UserManagementController::class, 'update']);
            Route::delete('/{user}', [UserManagementController::class, 'destroy']);
            Route::post('/import', [UserManagementController::class, 'import'])->middleware('throttle:imports');
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

        // Preset kolom tampilan tabel (per lembaga; global = admin pesantren).
        Route::get('preset-tabel', [PresetTabelController::class, 'index']);
        Route::post('preset-tabel', [PresetTabelController::class, 'store']);
        Route::post('preset-tabel/aktif', [PresetTabelController::class, 'setAktif']);
        Route::put('preset-tabel/{preset}', [PresetTabelController::class, 'update']);
        Route::delete('preset-tabel/{preset}', [PresetTabelController::class, 'destroy']);

        // Master modul PSB: kegiatan -> gelombang -> kuota/biaya pendaftaran per lembaga,
        // plus biaya masuk/asrama per lembaga (lintas gelombang).
        Route::get('psb/kegiatan', [PsbKegiatanController::class, 'index']);
        Route::post('psb/kegiatan', [PsbKegiatanController::class, 'store']);
        Route::put('psb/kegiatan/{kegiatan}', [PsbKegiatanController::class, 'update']);
        Route::delete('psb/kegiatan/{kegiatan}', [PsbKegiatanController::class, 'destroy']);
        Route::post('psb/gelombang', [PsbKegiatanController::class, 'storeGelombang']);
        Route::put('psb/gelombang/{gelombang}', [PsbKegiatanController::class, 'updateGelombang']);
        Route::delete('psb/gelombang/{gelombang}', [PsbKegiatanController::class, 'destroyGelombang']);
        Route::get('psb/kuota-biaya', [PsbBiayaController::class, 'indexKuota']);
        Route::post('psb/kuota-biaya', [PsbBiayaController::class, 'upsertKuota']);
        Route::delete('psb/kuota-biaya/{kuota}', [PsbBiayaController::class, 'destroyKuota']);
        Route::get('psb/biaya-lembaga', [PsbBiayaController::class, 'indexBiaya']);
        Route::post('psb/biaya-lembaga', [PsbBiayaController::class, 'upsertBiaya']);
    });

// PSB publik (tanpa auth; captcha SKIP — spec §5 hanya sebut sepintas tanpa implementasi).
Route::prefix('psb')->group(function () {
    Route::get('opsi', [PsbPublikController::class, 'opsi'])->middleware('throttle:30,1');
    Route::post('cek-nik', [PsbPublikController::class, 'cekNik'])->middleware('throttle:5,1');
    Route::post('daftar', [PsbPublikController::class, 'store'])->middleware('throttle:10,1');
    Route::post('daftar-paket', [PsbPublikController::class, 'storePaket'])->middleware('throttle:10,1');
    Route::get('{calon}/bukti-pdf', [PsbPublikController::class, 'bukti'])
        ->middleware('signed')
        ->name('psb.bukti-pdf');
});

// PSB admin (auth + role super_admin|admin, scope tenant lembaga per aksi).
Route::middleware(['auth:sanctum', 'role:super_admin|admin', 'throttle:api_user'])
    ->prefix('psb')
    ->group(function () {
        Route::get('antrean-daftar-ulang', [PsbController::class, 'antrean']);
        Route::get('gelombang', [PsbController::class, 'gelombang']);
        Route::post('calon', [PsbController::class, 'storeCalon']);
        Route::post('bulk/verifikasi', [PsbController::class, 'bulkVerifikasi']);
        Route::post('bulk/seleksi', [PsbController::class, 'bulkSeleksi']);
        Route::post('bulk/daftar-ulang', [PsbController::class, 'bulkDaftarUlang']);
        Route::post('bulk/undur-diri', [PsbController::class, 'bulkUndurDiri']);
        Route::post('bulk/batalkan-fase', [PsbController::class, 'bulkBatalkanFase']);
        Route::post('bulk/acc-daftar-ulang', [PsbController::class, 'bulkAcc']);
        Route::post('bulk/hapus', [PsbController::class, 'bulkHapus']);
        Route::post('bulk/pulihkan', [PsbController::class, 'bulkPulihkan']);
        Route::post('{calon}/verifikasi', [PsbController::class, 'verifikasi']);
        Route::post('{calon}/seleksi', [PsbController::class, 'seleksi']);
        Route::post('{calon}/daftar-ulang', [PsbController::class, 'daftarUlang']);
        Route::post('{calon}/undur-diri', [PsbController::class, 'undurDiri']);
        Route::post('{calon}/batalkan-fase', [PsbController::class, 'batalkanFase']);
        Route::post('{calon}/acc-daftar-ulang', [PsbController::class, 'acc']);
        Route::post('{calon}/pulihkan', [PsbController::class, 'pulihkan']);
        Route::delete('{calon}', [PsbController::class, 'destroy']);
        Route::post('{calon}/promosi', [PsbController::class, 'promosi']);
        Route::post('import', [PsbController::class, 'import'])->middleware('throttle:imports');
        Route::get('import-template', [PsbController::class, 'template']);
        Route::post('dokumen/{dokumen}/verifikasi', [PsbDokumenController::class, 'verifikasi']);
    });

// Portal orang tua (auth + role orang_tua, envelope pesan/data, cek pemilik B5).
Route::middleware(['auth:sanctum', 'role:orang_tua', 'throttle:api_user'])
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
Route::middleware(['auth:sanctum', 'role:orang_tua|admin|super_admin', 'throttle:api_user'])
    ->prefix('portal/psb')
    ->group(function () {
        Route::get('{calon}/dokumen', [PsbDokumenController::class, 'listCalon']);
    });

// Kamus global (saran combobox): publik + throttle (dipakai form PSB tanpa login).
Route::middleware('throttle:30,1')->prefix('kamus')->group(function () {
    Route::get('/{jenis}', [KamusController::class, 'saran']);
});

// Keuangan 103-B: transaksi kasir (auth + role super_admin|admin|kasir, tenant per aksi).
Route::middleware(['auth:sanctum', 'role:super_admin|admin|kasir', 'throttle:api_user'])
    ->prefix('keuangan')
    ->group(function () {
        Route::get('/santri/{santriId}/tagihan', [KeuanganController::class, 'getTagihanSantri']);
        Route::post('/tagihan/generate-bulanan', [KeuanganController::class, 'generateBulanan']);
        Route::post('/bayar', [KeuanganController::class, 'bayar']);
        Route::post('/pembayaran/{pembayaran}/void', [KeuanganController::class, 'void']);
    });

// Kuitansi 103-C: PDF dompdf + HTML thermal (auth + role super_admin|admin|kasir).
Route::middleware(['auth:sanctum', 'role:super_admin|admin|kasir', 'throttle:api_user'])
    ->prefix('kuitansi')
    ->group(function () {
        Route::get('/{pembayaranId}/pdf', [KuitansiController::class, 'cetakPdf']);
        Route::get('/{pembayaranId}/thermal', [KuitansiController::class, 'cetakThermal']);
    });
