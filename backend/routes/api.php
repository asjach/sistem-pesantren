<?php

use App\Http\Controllers\Api\Admin\AlumniArsipController;
use App\Http\Controllers\Api\Admin\DokumenController;
use App\Http\Controllers\Api\Admin\IzinController;
use App\Http\Controllers\Api\Admin\KeaktifanPegawaiController;
use App\Http\Controllers\Api\Admin\KelasController;
use App\Http\Controllers\Api\Admin\KeuanganController;
use App\Http\Controllers\Api\Admin\LembagaController;
use App\Http\Controllers\Api\Admin\LembagaPegawaiController;
use App\Http\Controllers\Api\Admin\LembagaSantriController;
use App\Http\Controllers\Api\Admin\MiMdController;
use App\Http\Controllers\Api\Admin\MutasiKeluarArsipController;
use App\Http\Controllers\Api\Admin\PegawaiController;
use App\Http\Controllers\Api\Admin\PengaturanTabelController;
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
        // Kunci `nama` memuat '/', jadi aksi tulis memakai body (bukan segmen URL).
        Route::match(['put', 'patch'], 'tahun-ajaran', [TahunAjaranController::class, 'update'])->middleware('permission:tahun_ajaran.ubah');
        Route::delete('tahun-ajaran', [TahunAjaranController::class, 'destroy'])->middleware('permission:tahun_ajaran.hapus');
        Route::post('tahun-ajaran/set-aktif', [TahunAjaranController::class, 'setAktif'])->middleware('permission:tahun_ajaran.ubah');
        Route::post('tahun-ajaran/sembunyikan', [TahunAjaranController::class, 'sembunyikan'])->middleware('permission:tahun_ajaran.ubah');
        Route::post('tahun-ajaran/tampilkan', [TahunAjaranController::class, 'tampilkan'])->middleware('permission:tahun_ajaran.ubah');

        Route::get('keuangan/jenis', [KeuanganController::class, 'indexJenis'])->middleware('permission:keuangan.lihat');
        Route::post('keuangan/jenis', [KeuanganController::class, 'storeJenis'])->middleware('permission:keuangan.tambah');
        Route::match(['put', 'patch'], 'keuangan/jenis/{jenis}', [KeuanganController::class, 'updateJenis'])->middleware('permission:keuangan.ubah');
        Route::get('keuangan/tarif', [KeuanganController::class, 'indexTarif'])->middleware('permission:keuangan.lihat');
        Route::post('keuangan/tarif', [KeuanganController::class, 'storeTarif'])->middleware('permission:keuangan.tambah');
        Route::match(['put', 'patch'], 'keuangan/tarif/{tarif}', [KeuanganController::class, 'updateTarif'])->middleware('permission:keuangan.ubah');
        Route::delete('keuangan/tarif/{tarif}', [KeuanganController::class, 'destroyTarif'])->middleware('permission:keuangan.hapus');
        Route::get('keuangan/dispensasi', [KeuanganController::class, 'indexDispensasi'])->middleware('permission:keuangan.lihat');
        Route::post('keuangan/dispensasi', [KeuanganController::class, 'storeDispensasi'])->middleware('permission:keuangan.tambah');
        Route::match(['put', 'patch'], 'keuangan/dispensasi/{dispensasi}', [KeuanganController::class, 'updateDispensasi'])->middleware('permission:keuangan.ubah');
        Route::delete('keuangan/dispensasi/{dispensasi}', [KeuanganController::class, 'destroyDispensasi'])->middleware('permission:keuangan.hapus');
        Route::get('keuangan/tagihan', [KeuanganController::class, 'indexTagihan'])->middleware('permission:keuangan.lihat');
        Route::post('keuangan/tagihan', [KeuanganController::class, 'storeTagihan'])->middleware('permission:keuangan.tambah');
        Route::delete('keuangan/tagihan/{tagihan}', [KeuanganController::class, 'destroyTagihan'])->middleware('permission:keuangan.hapus');
        Route::post('keuangan/tagihan/generate', [KeuanganController::class, 'generateTagihan'])->middleware('permission:keuangan.tambah');
        Route::get('keuangan/tagihan/kandidat', [KeuanganController::class, 'kandidatTagihan'])->middleware('permission:keuangan.tambah');
        Route::post('keuangan/pembayaran', [KeuanganController::class, 'storePembayaran'])->middleware('permission:keuangan.tambah');
        Route::post('keuangan/pembayaran/{pembayaran}/batal', [KeuanganController::class, 'batalPembayaran'])->middleware('permission:keuangan.ubah');
        Route::delete('keuangan/pembayaran/{pembayaran}', [KeuanganController::class, 'destroyPembayaran'])->middleware('permission:keuangan.hapus');
        Route::get('keuangan/tagihan/{tagihan}/pembayaran', [KeuanganController::class, 'pembayaranTagihan'])->middleware('permission:keuangan.lihat');
        Route::get('keuangan/tunggakan', [KeuanganController::class, 'tunggakan'])->middleware('permission:keuangan.lihat');

        Route::get('semester-aktif', [SemesterAktifController::class, 'index'])->middleware('permission:semester.lihat');
        Route::put('semester-aktif', [SemesterAktifController::class, 'upsert'])->middleware('permission:semester.ubah');

        Route::get('kelas', [KelasController::class, 'index'])->middleware('permission:kelas.lihat');
        Route::post('kelas', [KelasController::class, 'store'])->middleware('permission:kelas.tambah');
        Route::get('kelas/export-nama', [KelasController::class, 'exportNama'])->middleware('permission:kelas.lihat');
        Route::post('kelas/import-nama', [KelasController::class, 'importNama'])->middleware('permission:kelas.tambah');
        Route::get('kelas/import-template', [KelasController::class, 'templateImport'])->middleware('permission:kelas.lihat');
        Route::post('kelas/import-periksa', [KelasController::class, 'periksaImport'])->middleware(['permission:kelas.tambah', 'throttle:imports']);
        Route::post('kelas/import', [KelasController::class, 'importLengkap'])->middleware(['permission:kelas.tambah', 'throttle:imports']);
        Route::get('kelas/data-existing', [KelasController::class, 'dataExisting'])->middleware('permission:kelas.lihat');
        Route::post('kelas/import-potong', [KelasController::class, 'potongImport'])->middleware(['permission:kelas.tambah', 'throttle:imports']);
        Route::post('kelas/import-potong/{sesi}/batal', [KelasController::class, 'batalPotong'])->middleware('permission:kelas.tambah');
        Route::get('kelas/import-potong/{sesi}/galat', [KelasController::class, 'galatPotong'])->middleware('permission:kelas.lihat');
        Route::post('kelas/{kela}/set-walas', [KelasController::class, 'setWalas'])->middleware('permission:kelas.ubah');
        Route::get('pegawai/aktif', [PegawaiController::class, 'aktif'])->middleware('permission:kelas.ubah');
        Route::match(['put', 'patch'], 'kelas/{kela}', [KelasController::class, 'update'])->middleware('permission:kelas.ubah');
        Route::delete('kelas/{kela}', [KelasController::class, 'destroy'])->middleware('permission:kelas.hapus');

        // Buku Induk Guru + penempatan + riwayat keaktifan (modul pegawai).
        Route::get('pegawai', [PegawaiController::class, 'index'])->middleware('permission:pegawai.lihat');
        Route::post('pegawai', [PegawaiController::class, 'store'])->middleware('permission:pegawai.tambah');
        Route::match(['put', 'patch'], 'pegawai/{pegawai}', [PegawaiController::class, 'update'])->middleware('permission:pegawai.ubah');
        Route::delete('pegawai/{pegawai}', [PegawaiController::class, 'destroy'])->middleware('permission:pegawai.hapus');
        Route::post('pegawai/{pegawai}/tautkan-akun', [PegawaiController::class, 'tautkanAkun'])->middleware('permission:pegawai.ubah');
        Route::post('pegawai/{pegawai}/buatkan-akun', [PegawaiController::class, 'buatkanAkun'])->middleware(['permission:pegawai.ubah', 'permission:pengguna.tambah']);
        Route::post('pegawai/generate-akun', [PegawaiController::class, 'generateAkun'])->middleware(['permission:pegawai.ubah', 'permission:pengguna.tambah']);
        Route::post('pegawai/{pegawai}/foto', [PegawaiController::class, 'uploadFoto'])->middleware('permission:pegawai.ubah');
        Route::get('pegawai/import-template', [PegawaiController::class, 'templateImport'])->middleware('permission:pegawai.lihat');
        Route::get('pegawai/data-existing', [PegawaiController::class, 'dataExisting'])->middleware('permission:pegawai.lihat');
        Route::post('pegawai/import-potong', [PegawaiController::class, 'potongImport'])->middleware(['permission:pegawai.tambah', 'throttle:imports']);
        Route::post('pegawai/import-potong/{sesi}/batal', [PegawaiController::class, 'batalPotong'])->middleware('permission:pegawai.tambah');
        Route::get('pegawai/import-potong/{sesi}/galat', [PegawaiController::class, 'galatPotong'])->middleware('permission:pegawai.lihat');
        Route::get('pegawai-akun', [PegawaiController::class, 'akunIndex'])->middleware('permission:pegawai.lihat');
        Route::get('pegawai-lembaga', [LembagaPegawaiController::class, 'index'])->middleware('permission:pegawai.lihat');
        Route::get('pegawai/{pegawai}/penempatan', [LembagaPegawaiController::class, 'untuk'])->middleware('permission:pegawai.lihat');
        Route::post('pegawai/{pegawai}/tempatkan', [LembagaPegawaiController::class, 'tempatkan'])->middleware('permission:pegawai.ubah');
        Route::match(['put', 'patch'], 'pegawai-lembaga/{penempatan}', [LembagaPegawaiController::class, 'update'])->middleware('permission:pegawai.ubah');
        Route::post('pegawai-lembaga/{penempatan}/nonaktifkan', [LembagaPegawaiController::class, 'nonaktifkan'])->middleware('permission:pegawai.ubah');
        Route::post('pegawai-lembaga/{penempatan}/aktifkan', [LembagaPegawaiController::class, 'aktifkan'])->middleware('permission:pegawai.ubah');
        Route::delete('pegawai-lembaga/{penempatan}', [LembagaPegawaiController::class, 'destroy'])->middleware('permission:pegawai.hapus');
        Route::get('pegawai-lembaga/import-template', [LembagaPegawaiController::class, 'templateImport'])->middleware('permission:pegawai.lihat');
        Route::get('pegawai-lembaga/data-existing', [LembagaPegawaiController::class, 'dataExisting'])->middleware('permission:pegawai.lihat');
        Route::post('pegawai-lembaga/import-potong', [LembagaPegawaiController::class, 'potongImport'])->middleware(['permission:pegawai.ubah', 'throttle:imports']);
        Route::post('pegawai-lembaga/import-potong/{sesi}/batal', [LembagaPegawaiController::class, 'batalPotong'])->middleware('permission:pegawai.ubah');
        Route::get('pegawai-lembaga/import-potong/{sesi}/galat', [LembagaPegawaiController::class, 'galatPotong'])->middleware('permission:pegawai.lihat');
        Route::get('pegawai-keaktifan', [KeaktifanPegawaiController::class, 'index'])->middleware('permission:pegawai.lihat');
        Route::post('pegawai-keaktifan', [KeaktifanPegawaiController::class, 'store'])->middleware('permission:pegawai.ubah');
        Route::post('pegawai-keaktifan/aktifkan-massal', [KeaktifanPegawaiController::class, 'aktifkanMassal'])->middleware('permission:pegawai.ubah');
        Route::get('pegawai-keaktifan/import-template', [KeaktifanPegawaiController::class, 'templateImport'])->middleware('permission:pegawai.lihat');
        Route::get('pegawai-keaktifan/data-existing', [KeaktifanPegawaiController::class, 'dataExisting'])->middleware('permission:pegawai.lihat');
        Route::post('pegawai-keaktifan/import-potong', [KeaktifanPegawaiController::class, 'potongImport'])->middleware(['permission:pegawai.ubah', 'throttle:imports']);
        Route::post('pegawai-keaktifan/import-potong/{sesi}/batal', [KeaktifanPegawaiController::class, 'batalPotong'])->middleware('permission:pegawai.ubah');
        Route::get('pegawai-keaktifan/import-potong/{sesi}/galat', [KeaktifanPegawaiController::class, 'galatPotong'])->middleware('permission:pegawai.lihat');
        Route::post('pegawai-keaktifan/{keaktifan}/nonaktifkan', [KeaktifanPegawaiController::class, 'nonaktifkan'])->middleware('permission:pegawai.ubah');
        Route::delete('pegawai-keaktifan/{keaktifan}', [KeaktifanPegawaiController::class, 'destroy'])->middleware('permission:pegawai.hapus');

        // Data Santri (101: master profil + import PPDB massal + foto/dokumen)
        Route::get('santri', [SantriController::class, 'index'])->middleware('permission:santri.lihat');
        Route::post('santri', [SantriController::class, 'store'])->middleware('permission:santri.tambah');
        Route::patch('santri/{santri}', [SantriController::class, 'update'])->middleware('permission:santri.ubah');
        // Import gabungan siswa bertahap (potongan JSON 1000/panggilan): dua middleware = AND (tambah DAN ubah).
        Route::get('santri/import-template-gabungan', [SantriController::class, 'templateGabungan'])->middleware('permission:santri.lihat');
        Route::get('santri/data-existing', [SantriController::class, 'dataExisting'])->middleware('permission:santri.lihat');
        Route::post('santri/import-potong', [SantriController::class, 'potongImport'])->middleware(['permission:santri.tambah', 'permission:santri.ubah', 'throttle:imports']);
        Route::post('santri/import-potong/{sesi}/batal', [SantriController::class, 'batalPotong'])->middleware(['permission:santri.tambah', 'permission:santri.ubah']);
        Route::get('santri/import-potong/{sesi}/galat', [SantriController::class, 'galatPotong'])->middleware('permission:santri.lihat');
        // Samakan NIS paket MI↔MD (pratinjau + eksekusi).
        Route::post('santri/samakan-nis', [SantriController::class, 'samakanNis'])->middleware('permission:santri.ubah');
        Route::post('santri/{santri}/foto', [SantriController::class, 'uploadFoto'])->middleware('permission:santri.tambah');
        Route::get('santri/{santri}/dokumen', [SantriController::class, 'listDokumen'])->middleware('permission:santri.lihat');
        Route::post('santri/{santri}/dokumen', [SantriController::class, 'uploadDokumen'])->middleware('permission:santri.tambah');

        // Keanggotaan per lembaga (buku induk: NIS lokal/kemenag, status, tanggal)
        Route::get('lembaga-santri', [LembagaSantriController::class, 'daftar'])->middleware('permission:santri.lihat');
        Route::get('santri/{santri}/lembaga', [LembagaSantriController::class, 'index'])->middleware('permission:santri.lihat');
        Route::post('santri/{santri}/lembaga', [LembagaSantriController::class, 'store'])->middleware('permission:santri.tambah');
        Route::patch('lembaga-santri/{lembagaSantri}', [LembagaSantriController::class, 'update'])->middleware('permission:santri.ubah');
        Route::post('lembaga-santri/{lembagaSantri}/generate-nisk', [LembagaSantriController::class, 'generateNisk'])->middleware('permission:santri.ubah');
        Route::post('lembaga-santri/generate-nisk-bulk', [LembagaSantriController::class, 'generateNiskBulk'])->middleware('permission:santri.ubah');

        // Riwayat belajar (102): roster + dialog input + import terpisah
        Route::get('riwayat-belajar', [RiwayatBelajarController::class, 'index'])->middleware('permission:riwayat_belajar.lihat');
        Route::get('riwayat-belajar/belum-masuk', [RiwayatBelajarController::class, 'belumMasuk'])->middleware('permission:riwayat_belajar.lihat');
        Route::get('riwayat-belajar/belum-genap', [RiwayatBelajarController::class, 'belumGenap'])->middleware('permission:kenaikan.lihat');
        Route::post('riwayat-belajar', [RiwayatBelajarController::class, 'store'])->middleware('permission:riwayat_belajar.tambah');
        Route::delete('riwayat-belajar/{riwayat}', [RiwayatBelajarController::class, 'destroy'])->middleware('permission:riwayat_belajar.hapus');
        Route::patch('riwayat-belajar/{riwayat}', [RiwayatBelajarController::class, 'update'])->middleware('permission:riwayat_belajar.ubah');
        Route::get('riwayat-belajar/import-template', [RiwayatBelajarController::class, 'template'])->middleware('permission:riwayat_belajar.lihat');
        Route::post('riwayat-belajar/import-periksa', [RiwayatBelajarController::class, 'periksaImport'])->middleware(['permission:riwayat_belajar.tambah', 'throttle:imports']);
        Route::get('riwayat-belajar/data-existing', [RiwayatBelajarController::class, 'dataExisting'])->middleware('permission:riwayat_belajar.lihat');
        Route::post('riwayat-belajar/import-potong', [RiwayatBelajarController::class, 'potongImport'])->middleware(['permission:riwayat_belajar.tambah', 'throttle:imports']);
        Route::post('riwayat-belajar/import-potong/{sesi}/batal', [RiwayatBelajarController::class, 'batalPotong'])->middleware('permission:riwayat_belajar.tambah');
        Route::get('riwayat-belajar/import-potong/{sesi}/galat', [RiwayatBelajarController::class, 'galatPotong'])->middleware('permission:riwayat_belajar.lihat');
        Route::post('riwayat-belajar/import-lengkap', [RiwayatBelajarController::class, 'importLengkap'])->middleware(['permission:riwayat_belajar.tambah', 'throttle:imports']);
        Route::post('riwayat-belajar/{riwayat}/pindah-kelas', [RiwayatBelajarController::class, 'pindahKelas'])->middleware('permission:pindah_kelas.ubah');
        Route::post('riwayat-belajar/{riwayat}/set-kelas', [RiwayatBelajarController::class, 'setKelas'])->middleware('permission:pindah_kelas.ubah');
        Route::post('riwayat-belajar/{riwayat}/keluar-kelas', [RiwayatBelajarController::class, 'keluarKelas'])->middleware('permission:pindah_kelas.ubah');

        // Siklus akademik (kenaikan, kelulusan, mutasi keluar, rekap)
        Route::post('akademik/naik-kelas', [SiklusController::class, 'naikKelasMassal'])->middleware('permission:kenaikan.ubah');
        Route::post('akademik/naik-kelas-otomatis', [SiklusController::class, 'naikKelasOtomatis'])->middleware('permission:kenaikan.ubah');
        Route::get('akademik/ringkasan-pindah-genap', [SiklusController::class, 'ringkasanPindahGenap'])->middleware('permission:kenaikan.ubah');
        Route::post('akademik/salin-genap', [SiklusController::class, 'salinGenapMassal'])->middleware('permission:kenaikan.ubah');
        Route::post('akademik/batal-salin-massal', [SiklusController::class, 'batalSalinMassal'])->middleware('permission:kenaikan.ubah');
        Route::get('akademik/daftar-kelas', [SiklusController::class, 'daftarKelas'])->middleware('permission:daftar_kelas.lihat');
        Route::get('akademik/rekap-santri', [SiklusController::class, 'rekapSantri'])->middleware('permission:rekap_santri.lihat');
        Route::post('santri/{santri}/lulus', [SiklusController::class, 'lulus'])->middleware('permission:kelulusan.ubah');
        Route::post('santri/{santri}/tidak-lulus', [SiklusController::class, 'tidakLulus'])->middleware('permission:kelulusan.ubah');
        Route::post('santri/{santri}/batal-lulus', [SiklusController::class, 'batalLulus'])->middleware('permission:kelulusan.ubah');
        Route::post('santri/{santri}/batal-tidak-lulus', [SiklusController::class, 'batalTidakLulus'])->middleware('permission:kelulusan.ubah');
        Route::post('santri/{santri}/batal-kenaikan', [SiklusController::class, 'batalKenaikan'])->middleware('permission:kenaikan.ubah');
        Route::post('santri/{santri}/batal-salin', [SiklusController::class, 'batalSalin'])->middleware('permission:kenaikan.ubah');
        Route::post('santri/{santri}/mutasi', [SiklusController::class, 'mutasiKeluar'])->middleware('permission:mutasi_keluar.ubah');
        Route::post('santri/{santri}/berhenti-jenjang', [SiklusController::class, 'berhentiJenjang'])->middleware('permission:mutasi_keluar.ubah');
        Route::get('santri/{santri}/profil', [SiklusController::class, 'profilSantri'])->middleware('permission:santri.lihat');
        Route::get('mutasi-keluar', [MutasiKeluarArsipController::class, 'index'])->middleware('permission:mutasi_keluar.lihat');
        Route::get('mutasi-keluar/import-template', [MutasiKeluarArsipController::class, 'templateImport'])->middleware('permission:mutasi_keluar.lihat');
        Route::post('mutasi-keluar/import-periksa', [MutasiKeluarArsipController::class, 'periksaImport'])->middleware(['permission:mutasi_keluar.ubah', 'throttle:imports']);
        Route::post('mutasi-keluar/import', [MutasiKeluarArsipController::class, 'import'])->middleware(['permission:mutasi_keluar.ubah', 'throttle:imports']);
        Route::get('mutasi-keluar/data-existing', [MutasiKeluarArsipController::class, 'dataExisting'])->middleware('permission:mutasi_keluar.lihat');
        Route::post('mutasi-keluar/import-potong', [MutasiKeluarArsipController::class, 'potongImport'])->middleware(['permission:mutasi_keluar.ubah', 'throttle:imports']);
        Route::post('mutasi-keluar/import-potong/{sesi}/batal', [MutasiKeluarArsipController::class, 'batalPotong'])->middleware('permission:mutasi_keluar.ubah');
        Route::get('mutasi-keluar/import-potong/{sesi}/galat', [MutasiKeluarArsipController::class, 'galatPotong'])->middleware('permission:mutasi_keluar.lihat');
        Route::get('alumni', [AlumniArsipController::class, 'index'])->middleware('permission:kelulusan.lihat');
        Route::put('alumni/{alumni}', [AlumniArsipController::class, 'update'])->middleware('permission:kelulusan.ubah');
        Route::get('alumni/import-template', [AlumniArsipController::class, 'templateImport'])->middleware('permission:kelulusan.lihat');
        Route::get('alumni/data-existing', [AlumniArsipController::class, 'dataExisting'])->middleware('permission:kelulusan.lihat');
        Route::post('alumni/import-periksa', [AlumniArsipController::class, 'periksaImport'])->middleware(['permission:kelulusan.ubah', 'throttle:imports']);
        Route::post('alumni/import', [AlumniArsipController::class, 'import'])->middleware(['permission:kelulusan.ubah', 'throttle:imports']);
        Route::post('alumni/import-potong', [AlumniArsipController::class, 'potongImport'])->middleware(['permission:kelulusan.ubah', 'throttle:imports']);
        Route::post('alumni/import-potong/{sesi}/batal', [AlumniArsipController::class, 'batalPotong'])->middleware('permission:kelulusan.ubah');
        Route::get('alumni/import-potong/{sesi}/galat', [AlumniArsipController::class, 'galatPotong'])->middleware('permission:kelulusan.lihat');

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
            Route::post('/import-potong', [UserManagementController::class, 'potongImport'])->middleware(['permission:pengguna.tambah', 'throttle:imports']);
            Route::post('/import-potong/{sesi}/batal', [UserManagementController::class, 'batalPotong'])->middleware('permission:pengguna.tambah');
            Route::get('/import-potong/{sesi}/galat', [UserManagementController::class, 'galatPotong'])->middleware('permission:pengguna.lihat');
            Route::post('/{user}/roles', [UserManagementController::class, 'assignRole'])->middleware('permission:pengguna.ubah');
            Route::delete('/{user}/roles', [UserManagementController::class, 'removeRole'])->middleware('permission:pengguna.ubah');
            Route::post('/{user}/lembaga', [UserManagementController::class, 'attachLembaga'])->middleware('permission:pengguna.ubah');
            Route::delete('/{user}/lembaga', [UserManagementController::class, 'detachLembaga'])->middleware('permission:pengguna.ubah');
        });

        Route::get('pengajuan-biodata', [PengajuanBiodataController::class, 'index'])->middleware('permission:pengajuan_biodata.lihat');
        Route::post('pengajuan-biodata/{id}/setujui', [PengajuanBiodataController::class, 'setujui'])->middleware('permission:pengajuan_biodata.ubah');
        Route::post('pengajuan-biodata/{id}/tolak', [PengajuanBiodataController::class, 'tolak'])->middleware('permission:pengajuan_biodata.ubah');

        // Tiga halaman dokumen (santri/pegawai/lembaga): izin per tipe lewat context middleware.
        Route::get('dokumen/{tipe}', [DokumenController::class, 'index'])->middleware('permission:dokumen_santri.lihat');
        Route::post('dokumen/{tipe}', [DokumenController::class, 'store'])->middleware('permission:dokumen_santri.tambah');
        Route::match(['put', 'patch'], 'dokumen/{tipe}/{id}', [DokumenController::class, 'update'])->middleware('permission:dokumen_santri.ubah');
        Route::post('dokumen/{tipe}/{id}/unggah', [DokumenController::class, 'unggah'])->middleware('permission:dokumen_santri.ubah');
        Route::delete('dokumen/{tipe}/{id}', [DokumenController::class, 'destroy'])->middleware('permission:dokumen_santri.hapus');
        Route::get('dokumen/{tipe}/{id}/unduh', [DokumenController::class, 'unduh'])->middleware('permission:dokumen_santri.lihat');
        Route::get('dokumen/{tipe}/status-berkas', [DokumenController::class, 'statusBerkas'])->middleware('permission:dokumen_santri.lihat');
        Route::post('dokumen/{tipe}/{id}/sinkron-unggah', [DokumenController::class, 'sinkronUnggah'])->middleware('permission:dokumen_santri.ubah');
        Route::match(['put', 'patch'], 'dokumen/{tipe}/{id}/tandai-sinkron', [DokumenController::class, 'tandaiSinkron'])->middleware('permission:dokumen_santri.ubah');
        Route::get('dokumen/{tipe}/import-template', [DokumenController::class, 'templateImport'])->middleware('permission:dokumen_santri.lihat');
        Route::get('dokumen/{tipe}/data-existing', [DokumenController::class, 'dataExisting'])->middleware('permission:dokumen_santri.lihat');
        Route::post('dokumen/{tipe}/import-potong', [DokumenController::class, 'potongImport'])->middleware(['permission:dokumen_santri.tambah', 'throttle:imports']);
        Route::post('dokumen/{tipe}/import-potong/{sesi}/batal', [DokumenController::class, 'batalPotong'])->middleware('permission:dokumen_santri.tambah');
        Route::get('dokumen/{tipe}/import-potong/{sesi}/galat', [DokumenController::class, 'galatPotong'])->middleware('permission:dokumen_santri.lihat');

        // Preset kolom tampilan tabel (per lembaga; global = admin pesantren).
        Route::get('preset-tabel', [PresetTabelController::class, 'index'])->middleware('permission:preset_tabel.lihat');
        Route::post('preset-tabel', [PresetTabelController::class, 'store'])->middleware('permission:preset_tabel.tambah');
        Route::post('preset-tabel/aktif', [PresetTabelController::class, 'setAktif'])->middleware('permission:preset_tabel.lihat');
        Route::put('preset-tabel/{preset}', [PresetTabelController::class, 'update'])->middleware('permission:preset_tabel.ubah');
        Route::post('preset-tabel/{preset}/bawaan', [PresetTabelController::class, 'setBawaan'])->middleware('permission:preset_tabel.ubah');
        Route::delete('preset-tabel/{preset}', [PresetTabelController::class, 'destroy'])->middleware('permission:preset_tabel.hapus');

        Route::get('urut-preset', [UrutPresetController::class, 'index'])->middleware('permission:urut_preset.lihat');
        Route::put('urut-preset', [UrutPresetController::class, 'simpan'])->middleware('permission:urut_preset.tambah|urut_preset.ubah');
        Route::delete('urut-preset', [UrutPresetController::class, 'hapus'])->middleware('permission:urut_preset.hapus');

        // Visibilitas kontrol toolbar (global per tabel; tulis super_admin saja).
        Route::get('toolbar-preset', [ToolbarPresetController::class, 'index'])->middleware('permission:toolbar_preset.lihat');
        Route::put('toolbar-preset', [ToolbarPresetController::class, 'simpan'])->middleware('permission:toolbar_preset.tambah|toolbar_preset.ubah');
        Route::delete('toolbar-preset', [ToolbarPresetController::class, 'hapus'])->middleware('permission:toolbar_preset.hapus');

        // Visibilitas filter topBar (global per tabel; tulis super_admin saja).
        Route::get('pengaturan-tabel', [PengaturanTabelController::class, 'index'])->middleware('permission:pengaturan_halaman.lihat');
        Route::put('pengaturan-tabel', [PengaturanTabelController::class, 'simpan'])->middleware('permission:pengaturan_halaman.tambah|pengaturan_halaman.ubah');
        Route::delete('pengaturan-tabel', [PengaturanTabelController::class, 'hapus'])->middleware('permission:pengaturan_halaman.hapus');

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
    Route::get('{calon}/bukti', [PsbPublikController::class, 'bukti'])
        ->middleware('signed')
        ->name('psb.bukti');
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
        Route::post('import-potong', [PsbController::class, 'potongImport'])->middleware(['permission:psb.tambah', 'throttle:imports']);
        Route::post('import-potong/{sesi}/batal', [PsbController::class, 'batalPotong'])->middleware('permission:psb.tambah');
        Route::get('import-potong/{sesi}/galat', [PsbController::class, 'galatPotong'])->middleware('permission:psb.lihat');
        Route::get('import-template', [PsbController::class, 'template'])->middleware('permission:psb.lihat');
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
