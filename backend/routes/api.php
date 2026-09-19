<?php

use App\Http\Controllers\Api\Admin\IzinController;
use App\Http\Controllers\Api\Admin\KamusLabelController;
use App\Http\Controllers\Api\Admin\KelasController;
use App\Http\Controllers\Api\Admin\LembagaController;
use App\Http\Controllers\Api\Admin\LembagaSantriController;
use App\Http\Controllers\Api\Admin\MiMdController;
use App\Http\Controllers\Api\Admin\PengaturanTampilanController;
use App\Http\Controllers\Api\Admin\PresetTabelController;
use App\Http\Controllers\Api\Admin\PsbBiayaController;
use App\Http\Controllers\Api\Admin\PsbKegiatanController;
use App\Http\Controllers\Api\Admin\ReferensiController;
use App\Http\Controllers\Api\Admin\RiwayatBelajarController;
use App\Http\Controllers\Api\Admin\SantriController;
use App\Http\Controllers\Api\Admin\SemesterAktifController;
use App\Http\Controllers\Api\Admin\SiklusController;
use App\Http\Controllers\Api\Admin\TahunAjaranController;
use App\Http\Controllers\Api\Admin\ToolbarPresetController;
use App\Http\Controllers\Api\Admin\UrutPresetController;
use App\Http\Controllers\Api\Admin\UserManagementController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\KamusController;
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
        // `lembaga_aktif` agar /me mengembalikan izin EFEKTIF saat super_admin
        // sedang bertindak sebagai lembaga (setara admin).
        Route::get('me', [AuthController::class, 'me'])->middleware('lembaga_aktif');
    });
});

// Gerbang aksi = izin matriks (`permission:`); cakupan data = pivot
// `user_lembaga` di controller/policy (`lembaga_aktif`, TenantGuard).
Route::middleware(['auth:sanctum', 'lembaga_aktif', 'throttle:api_user'])
    ->get('dashboard/ringkasan', [DashboardController::class, 'ringkasan'])
    ->middleware('permission:dashboard.lihat');

Route::middleware(['auth:sanctum', 'lembaga_aktif', 'throttle:api_user'])
    ->prefix('admin')
    ->group(function () {
        Route::get('lembaga', [LembagaController::class, 'index'])->middleware('permission:lembaga.lihat');
        Route::post('lembaga', [LembagaController::class, 'store'])->middleware('permission:lembaga.tambah');
        Route::match(['put', 'patch'], 'lembaga/{lembaga}', [LembagaController::class, 'update'])->middleware('permission:lembaga.ubah');
        Route::delete('lembaga/{lembaga}', [LembagaController::class, 'destroy'])->middleware('permission:lembaga.hapus');

        Route::get('referensi/types', [ReferensiController::class, 'types'])->middleware('permission:referensi.lihat');
        Route::get('referensi/{tipe}', [ReferensiController::class, 'index'])->middleware('permission:referensi.lihat');
        Route::post('referensi/{tipe}', [ReferensiController::class, 'store'])->middleware('permission:referensi.tambah');
        Route::match(['put', 'patch'], 'referensi/{tipe}/{id}', [ReferensiController::class, 'update'])->middleware('permission:referensi.ubah');
        Route::post('referensi/{tipe}/{id}/pulihkan', [ReferensiController::class, 'pulihkan'])->middleware('permission:referensi.ubah');
        Route::delete('referensi/{tipe}/{id}', [ReferensiController::class, 'destroy'])->middleware('permission:referensi.hapus');

        Route::get('tahun-ajaran', [TahunAjaranController::class, 'index'])->middleware('permission:tahun_ajaran.lihat');
        Route::post('tahun-ajaran', [TahunAjaranController::class, 'store'])->middleware('permission:tahun_ajaran.tambah');
        Route::match(['put', 'patch'], 'tahun-ajaran/{tahunAjaran}', [TahunAjaranController::class, 'update'])->middleware('permission:tahun_ajaran.ubah');
        Route::delete('tahun-ajaran/{tahunAjaran}', [TahunAjaranController::class, 'destroy'])->middleware('permission:tahun_ajaran.hapus');
        Route::post('tahun-ajaran/{tahunAjaran}/set-aktif', [TahunAjaranController::class, 'setAktif'])->middleware('permission:tahun_ajaran.ubah');
        Route::post('tahun-ajaran/{tahunAjaran}/sembunyikan', [TahunAjaranController::class, 'sembunyikan'])->middleware('permission:tahun_ajaran.ubah');

        Route::get('semester-aktif', [SemesterAktifController::class, 'index'])->middleware('permission:semester.lihat');
        Route::put('semester-aktif', [SemesterAktifController::class, 'upsert'])->middleware('permission:semester.ubah');

        Route::get('kelas', [KelasController::class, 'index'])->middleware('permission:kelas.lihat');
        Route::post('kelas', [KelasController::class, 'store'])->middleware('permission:kelas.tambah');
        Route::get('kelas/export-nama', [KelasController::class, 'exportNama'])->middleware('permission:kelas.lihat');
        Route::post('kelas/import-nama', [KelasController::class, 'importNama'])->middleware('permission:kelas.tambah');
        Route::match(['put', 'patch'], 'kelas/{kela}', [KelasController::class, 'update'])->middleware('permission:kelas.ubah');
        Route::delete('kelas/{kela}', [KelasController::class, 'destroy'])->middleware('permission:kelas.hapus');

        // Data Santri (101: master profil + import PPDB massal + foto/dokumen)
        Route::get('santri', [SantriController::class, 'index'])->middleware('permission:santri.lihat');
        Route::post('santri', [SantriController::class, 'store'])->middleware('permission:santri.tambah');
        Route::get('santri/import-template', [SantriController::class, 'template'])->middleware('permission:santri.lihat');
        Route::patch('santri/{santri}', [SantriController::class, 'update'])->middleware('permission:santri.ubah');
        Route::post('santri/import-periksa', [SantriController::class, 'periksaImport'])->middleware(['permission:santri.tambah', 'throttle:imports']);
        Route::post('santri/import-lengkap', [SantriController::class, 'importLengkap'])->middleware(['permission:santri.tambah', 'throttle:imports']);
        // Import gabungan siswa (identitas + keanggotaan): dua middleware = AND (tambah DAN ubah).
        Route::get('santri/import-template-gabungan', [SantriController::class, 'templateGabungan'])->middleware('permission:santri.lihat');
        Route::get('santri/data-gabungan', [SantriController::class, 'dataGabungan'])->middleware('permission:santri.lihat');
        Route::post('santri/import-periksa-gabungan', [SantriController::class, 'periksaImportGabungan'])->middleware(['permission:santri.tambah', 'permission:santri.ubah', 'throttle:imports']);
        Route::post('santri/import-gabungan', [SantriController::class, 'importGabungan'])->middleware(['permission:santri.tambah', 'permission:santri.ubah', 'throttle:imports']);
        // Samakan NIS paket MI↔MD (pratinjau + eksekusi).
        Route::post('santri/samakan-nis', [SantriController::class, 'samakanNis'])->middleware('permission:santri.ubah');
        Route::post('santri/{santri}/foto', [SantriController::class, 'uploadFoto'])->middleware('permission:santri.tambah');
        Route::get('santri/{santri}/dokumen', [SantriController::class, 'listDokumen'])->middleware('permission:santri.lihat');
        Route::post('santri/{santri}/dokumen', [SantriController::class, 'uploadDokumen'])->middleware('permission:santri.tambah');
        Route::post('santri/{santri}/dokumen/{dokumen}/tidak-memiliki', [SantriController::class, 'tidakMemiliki'])->middleware('permission:santri.ubah');

        // Keanggotaan per lembaga (buku induk: NIS lokal/kemenag, status, tanggal)
        Route::get('lembaga-santri', [LembagaSantriController::class, 'daftar'])->middleware('permission:santri.lihat');
        Route::get('santri/{santri}/lembaga', [LembagaSantriController::class, 'index'])->middleware('permission:santri.lihat');
        Route::post('santri/{santri}/lembaga', [LembagaSantriController::class, 'store'])->middleware('permission:santri.tambah');
        Route::patch('lembaga-santri/{lembagaSantri}', [LembagaSantriController::class, 'update'])->middleware('permission:santri.ubah');
        Route::post('lembaga-santri/{lembagaSantri}/generate-nisk', [LembagaSantriController::class, 'generateNisk'])->middleware('permission:santri.ubah');

        // Riwayat belajar (102): roster + dialog input + import terpisah
        Route::get('riwayat-belajar', [RiwayatBelajarController::class, 'index'])->middleware('permission:riwayat_belajar.lihat');
        Route::get('riwayat-belajar/belum-masuk', [RiwayatBelajarController::class, 'belumMasuk'])->middleware('permission:riwayat_belajar.lihat');
        Route::post('riwayat-belajar', [RiwayatBelajarController::class, 'store'])->middleware('permission:riwayat_belajar.tambah');
        Route::delete('riwayat-belajar/{riwayat}', [RiwayatBelajarController::class, 'destroy'])->middleware('permission:riwayat_belajar.hapus');
        Route::get('riwayat-belajar/import-template', [RiwayatBelajarController::class, 'template'])->middleware('permission:riwayat_belajar.lihat');
        Route::post('riwayat-belajar/import-periksa', [RiwayatBelajarController::class, 'periksaImport'])->middleware(['permission:riwayat_belajar.tambah', 'throttle:imports']);
        Route::post('riwayat-belajar/import-lengkap', [RiwayatBelajarController::class, 'importLengkap'])->middleware(['permission:riwayat_belajar.tambah', 'throttle:imports']);
        Route::post('riwayat-belajar/{riwayat}/pindah-kelas', [RiwayatBelajarController::class, 'pindahKelas'])->middleware('permission:pindah_kelas.ubah');
        Route::post('riwayat-belajar/{riwayat}/set-kelas', [RiwayatBelajarController::class, 'setKelas'])->middleware('permission:pindah_kelas.ubah');
        Route::post('riwayat-belajar/{riwayat}/keluar-kelas', [RiwayatBelajarController::class, 'keluarKelas'])->middleware('permission:pindah_kelas.ubah');

        // Siklus akademik (kenaikan, kelulusan, mutasi keluar, rekap)
        Route::post('akademik/naik-kelas', [SiklusController::class, 'naikKelasMassal'])->middleware('permission:kenaikan.ubah');
        Route::post('akademik/salin-genap', [SiklusController::class, 'salinGenapMassal'])->middleware('permission:kenaikan.ubah');
        Route::get('akademik/daftar-kelas', [SiklusController::class, 'daftarKelas'])->middleware('permission:daftar_kelas.lihat');
        Route::get('akademik/rekap-santri', [SiklusController::class, 'rekapSantri'])->middleware('permission:rekap_santri.lihat');
        Route::post('santri/{santri}/lulus', [SiklusController::class, 'lulus'])->middleware('permission:kelulusan.ubah');
        Route::post('santri/{santri}/tidak-lulus', [SiklusController::class, 'tidakLulus'])->middleware('permission:kelulusan.ubah');
        Route::post('santri/{santri}/mutasi', [SiklusController::class, 'mutasiKeluar'])->middleware('permission:mutasi_keluar.ubah');
        Route::post('santri/{santri}/berhenti-jenjang', [SiklusController::class, 'berhentiJenjang'])->middleware('permission:mutasi_keluar.ubah');
        Route::get('santri/{santri}/profil', [SiklusController::class, 'profilSantri'])->middleware('permission:santri.lihat');
        Route::get('mutasi-keluar', [SiklusController::class, 'getMutasiKeluar'])->middleware('permission:mutasi_keluar.lihat');
        Route::get('alumni', [SiklusController::class, 'getAlumni'])->middleware('permission:kelulusan.lihat');

        // Halaman MI-MD: 3 tabel berdampingan + samakan kelas by-nama.
        Route::get('mi-md', [MiMdController::class, 'index'])->middleware('permission:rekap_santri.lihat');
        Route::post('mi-md/samakan-kelas', [MiMdController::class, 'samakanKelas'])->middleware('permission:pindah_kelas.ubah');
        Route::post('mi-md/daftarkan-md', [MiMdController::class, 'daftarkanMd'])->middleware('permission:santri.tambah');
        Route::post('mi-md/hapus-md', [MiMdController::class, 'hapusMd'])->middleware('permission:santri.ubah');

        Route::prefix('users')->group(function () {
            Route::get('/', [UserManagementController::class, 'index'])->middleware('permission:pengguna.lihat');
            Route::post('/', [UserManagementController::class, 'store'])->middleware('permission:pengguna.tambah');
            Route::match(['put', 'patch'], '/{user}', [UserManagementController::class, 'update'])->middleware('permission:pengguna.ubah');
            Route::delete('/{user}', [UserManagementController::class, 'destroy'])->middleware('permission:pengguna.hapus');
            Route::post('/import', [UserManagementController::class, 'import'])->middleware(['permission:pengguna.tambah', 'throttle:imports']);
            Route::post('/{user}/roles', [UserManagementController::class, 'assignRole'])->middleware('permission:pengguna.ubah');
            Route::delete('/{user}/roles', [UserManagementController::class, 'removeRole'])->middleware('permission:pengguna.ubah');
            Route::post('/{user}/lembaga', [UserManagementController::class, 'attachLembaga'])->middleware('permission:pengguna.ubah');
            Route::delete('/{user}/lembaga', [UserManagementController::class, 'detachLembaga'])->middleware('permission:pengguna.ubah');
        });

        Route::get('pengajuan-biodata', [PengajuanBiodataController::class, 'index'])->middleware('permission:pengajuan_biodata.lihat');
        Route::post('pengajuan-biodata/{id}/setujui', [PengajuanBiodataController::class, 'setujui'])->middleware('permission:pengajuan_biodata.ubah');
        Route::post('pengajuan-biodata/{id}/tolak', [PengajuanBiodataController::class, 'tolak'])->middleware('permission:pengajuan_biodata.ubah');

        Route::get('dokumen-wajib', [PsbDokumenController::class, 'indexWajib'])->middleware('permission:dokumen_wajib.lihat');
        Route::post('dokumen-wajib', [PsbDokumenController::class, 'storeWajib'])->middleware('permission:dokumen_wajib.tambah');
        Route::delete('dokumen-wajib/{id}', [PsbDokumenController::class, 'destroyWajib'])->middleware('permission:dokumen_wajib.hapus');

        // Preset kolom tampilan tabel (per lembaga; global = admin pesantren).
        Route::get('preset-tabel', [PresetTabelController::class, 'index'])->middleware('permission:preset_tabel.lihat');
        Route::post('preset-tabel', [PresetTabelController::class, 'store'])->middleware('permission:preset_tabel.tambah');
        Route::post('preset-tabel/aktif', [PresetTabelController::class, 'setAktif'])->middleware('permission:preset_tabel.lihat');
        Route::put('preset-tabel/{preset}', [PresetTabelController::class, 'update'])->middleware('permission:preset_tabel.ubah');
        Route::post('preset-tabel/{preset}/bawaan', [PresetTabelController::class, 'setBawaan'])->middleware('permission:preset_tabel.ubah');
        Route::delete('preset-tabel/{preset}', [PresetTabelController::class, 'destroy'])->middleware('permission:preset_tabel.hapus');

        Route::get('kamus-kolom', [KamusLabelController::class, 'index'])->middleware('permission:kamus_label.lihat');
        Route::get('kamus-kolom/peta', [KamusLabelController::class, 'peta'])->middleware('permission:kamus_label.lihat');
        Route::get('kamus-kolom/skema', [KamusLabelController::class, 'skema'])->middleware('permission:kamus_label.lihat');
        Route::post('kamus-kolom/generasi', [KamusLabelController::class, 'generasi'])->middleware(['permission:kamus_label.tambah', 'permission:kamus_label.ubah']);
        Route::post('kamus-kolom', [KamusLabelController::class, 'store'])->middleware('permission:kamus_label.tambah');
        Route::match(['put', 'patch'], 'kamus-kolom/{labelKolom}', [KamusLabelController::class, 'update'])->middleware('permission:kamus_label.ubah');
        Route::delete('kamus-kolom/{labelKolom}', [KamusLabelController::class, 'destroy'])->middleware('permission:kamus_label.hapus');
        Route::get('urut-preset', [UrutPresetController::class, 'index'])->middleware('permission:urut_preset.lihat');
        Route::put('urut-preset', [UrutPresetController::class, 'simpan'])->middleware('permission:urut_preset.tambah|urut_preset.ubah');
        Route::delete('urut-preset', [UrutPresetController::class, 'hapus'])->middleware('permission:urut_preset.hapus');

        // Visibilitas kontrol toolbar (global per tabel; tulis super_admin saja).
        Route::get('toolbar-preset', [ToolbarPresetController::class, 'index'])->middleware('permission:toolbar_preset.lihat');
        Route::put('toolbar-preset', [ToolbarPresetController::class, 'simpan'])->middleware('permission:toolbar_preset.tambah|toolbar_preset.ubah');
        Route::delete('toolbar-preset', [ToolbarPresetController::class, 'hapus'])->middleware('permission:toolbar_preset.hapus');

        // Standar tampilan per lembaga (super_admin sebar ke semua; admin lembaga salinannya).
        Route::get('pengaturan-tampilan', [PengaturanTampilanController::class, 'show'])->middleware('permission:tampilan.lihat');
        Route::get('pengaturan-tampilan/versi', [PengaturanTampilanController::class, 'versi'])->middleware('permission:tampilan.lihat');
        Route::put('pengaturan-tampilan', [PengaturanTampilanController::class, 'upsert'])->middleware('permission:tampilan.ubah');
        Route::delete('pengaturan-tampilan', [PengaturanTampilanController::class, 'destroy'])->middleware('permission:tampilan.hapus');

        // Master modul PSB: kegiatan -> gelombang -> kuota/biaya pendaftaran per lembaga,
        // plus biaya masuk/asrama per lembaga (lintas gelombang).
        Route::get('psb/kegiatan', [PsbKegiatanController::class, 'index'])->middleware('permission:kegiatan_psb.lihat');
        Route::post('psb/kegiatan', [PsbKegiatanController::class, 'store'])->middleware('permission:kegiatan_psb.tambah');
        Route::put('psb/kegiatan/{kegiatan}', [PsbKegiatanController::class, 'update'])->middleware('permission:kegiatan_psb.ubah');
        Route::delete('psb/kegiatan/{kegiatan}', [PsbKegiatanController::class, 'destroy'])->middleware('permission:kegiatan_psb.hapus');
        Route::post('psb/gelombang', [PsbKegiatanController::class, 'storeGelombang'])->middleware('permission:kegiatan_psb.tambah');
        Route::put('psb/gelombang/{gelombang}', [PsbKegiatanController::class, 'updateGelombang'])->middleware('permission:kegiatan_psb.ubah');
        Route::delete('psb/gelombang/{gelombang}', [PsbKegiatanController::class, 'destroyGelombang'])->middleware('permission:kegiatan_psb.hapus');
        Route::get('psb/lembaga', [PsbBiayaController::class, 'indexLembaga'])->middleware('permission:kegiatan_psb.lihat');
        Route::get('psb/kuota-biaya', [PsbBiayaController::class, 'indexKuota'])->middleware('permission:kegiatan_psb.lihat');
        Route::post('psb/kuota-biaya', [PsbBiayaController::class, 'upsertKuota'])->middleware('permission:kegiatan_psb.tambah');
        Route::delete('psb/kuota-biaya/{kuota}', [PsbBiayaController::class, 'destroyKuota'])->middleware('permission:kegiatan_psb.hapus');

        // Matriks izin (Kelola Izin): hanya pemilik izin terkait (= super_admin).
        Route::get('izin', [IzinController::class, 'index'])->middleware('permission:izin.lihat');
        Route::put('izin', [IzinController::class, 'update'])->middleware('permission:izin.ubah');
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

// PSB admin (auth + izin matriks, scope tenant lembaga per aksi).
Route::middleware(['auth:sanctum', 'lembaga_aktif', 'throttle:api_user'])
    ->prefix('psb')
    ->group(function () {
        Route::get('antrean-daftar-ulang', [PsbController::class, 'antrean'])->middleware('permission:psb.lihat');
        Route::get('gelombang', [PsbController::class, 'gelombang'])->middleware('permission:psb.lihat');
        Route::post('calon', [PsbController::class, 'storeCalon'])->middleware('permission:psb.tambah');
        Route::post('bulk/verifikasi', [PsbController::class, 'bulkVerifikasi'])->middleware('permission:psb.ubah');
        Route::post('bulk/seleksi', [PsbController::class, 'bulkSeleksi'])->middleware('permission:psb.ubah');
        Route::post('bulk/daftar-ulang', [PsbController::class, 'bulkDaftarUlang'])->middleware('permission:psb.ubah');
        Route::post('bulk/undur-diri', [PsbController::class, 'bulkUndurDiri'])->middleware('permission:psb.ubah');
        Route::post('bulk/batalkan-fase', [PsbController::class, 'bulkBatalkanFase'])->middleware('permission:psb.ubah');
        Route::post('bulk/acc-daftar-ulang', [PsbController::class, 'bulkAcc'])->middleware('permission:psb.ubah');
        Route::post('bulk/hapus', [PsbController::class, 'bulkHapus'])->middleware('permission:psb.hapus');
        Route::post('bulk/pulihkan', [PsbController::class, 'bulkPulihkan'])->middleware('permission:psb.ubah');
        Route::post('{calon}/verifikasi', [PsbController::class, 'verifikasi'])->middleware('permission:psb.ubah');
        Route::post('{calon}/seleksi', [PsbController::class, 'seleksi'])->middleware('permission:psb.ubah');
        Route::post('{calon}/daftar-ulang', [PsbController::class, 'daftarUlang'])->middleware('permission:psb.ubah');
        Route::post('{calon}/undur-diri', [PsbController::class, 'undurDiri'])->middleware('permission:psb.ubah');
        Route::post('{calon}/batalkan-fase', [PsbController::class, 'batalkanFase'])->middleware('permission:psb.ubah');
        Route::post('{calon}/acc-daftar-ulang', [PsbController::class, 'acc'])->middleware('permission:psb.ubah');
        Route::post('{calon}/pulihkan', [PsbController::class, 'pulihkan'])->middleware('permission:psb.ubah');
        Route::delete('{calon}', [PsbController::class, 'destroy'])->middleware('permission:psb.hapus');
        Route::post('{calon}/promosi', [PsbController::class, 'promosi'])->middleware('permission:psb.ubah');
        Route::post('import', [PsbController::class, 'import'])->middleware(['permission:psb.tambah', 'throttle:imports']);
        Route::get('import-template', [PsbController::class, 'template'])->middleware('permission:psb.lihat');
        Route::post('dokumen/{dokumen}/verifikasi', [PsbDokumenController::class, 'verifikasi'])->middleware('permission:psb.ubah');
    });

// Portal orang tua (auth + role orang_tua, envelope pesan/data, cek pemilik B5).
// Pengecualian matriks: portal tetap role-based (di luar cakupan Kelola Izin).
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
        Route::get('riwayat-keluarga', [PsbPortalController::class, 'riwayatKeluarga']);
        Route::post('santri/{santri}/pengajuan-biodata', [PengajuanBiodataController::class, 'ajukan']);
        Route::delete('pengajuan-biodata/{id}/batal', [PengajuanBiodataController::class, 'batalkan']);
    });

// List dokumen calon: orang_tua pemilik + admin tenant.
// Pengecualian matriks: grup campuran peran, tetap role-based + cek pemilik di controller.
Route::middleware(['auth:sanctum', 'role:orang_tua|admin|super_admin', 'lembaga_aktif', 'throttle:api_user'])
    ->prefix('portal/psb')
    ->group(function () {
        Route::get('{calon}/dokumen', [PsbDokumenController::class, 'listCalon']);
    });

// Kamus global (saran combobox): publik + throttle (dipakai form PSB tanpa login).
Route::middleware('throttle:30,1')->prefix('kamus')->group(function () {
    Route::get('/{jenis}', [KamusController::class, 'saran']);
});
