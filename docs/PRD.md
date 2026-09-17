# Dokumentasi Proyek — Sistem Informasi Manajemen Pesantren (SIMPES)

| Atribut | Keterangan |
|---|---|
| Versi Dokumen | 2.44 (samakan NIS paket MI↔MD) |
| Tanggal | 10 September 2026 |
| Status | Proyek ini = menyusun dokumentasi, bukan coding app. G0–G3 didetailkan; G4+ roadmap |
| Penyusun | Solo dev + Yayasan |
| Arsip acuan (read-only) | `Step-By-Step Sistem Pesantren/Backend/` + `Frontend/admin-flutter-desktop/docs/` |
| Skema versi | Major restruktur = X.0; final 1 bab = X.Y; kecil docs = X.Y.Z |

> **Konvensi.** Bahasa Indonesia persis DB. Logika saja, tanpa kode mentah, format kode + nama modul. Tanpa asumsi umum. Aturan bisa berubah via Lampiran E. Penulisan Bab 3 (tanpa simbol paragraf).

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 2026-09-10 | Baseline restrukturisasi; arsip dibekukan; G0–G3 production |
| 1.1 | 2026-09-10 | Final Bab 2–7 (tabel ID-Modul, FR/NFR English, UC, asumsi/batasan) |
| 1.1.1 | 2026-09-10 | Bab 8 ke tabel ID-Modul (kecil docs) |
| 1.1.2 | 2026-09-10 | Bab 9 ke tabel + perbaiki RACI admin (kecil docs) |
| 1.1.3 | 2026-09-10 | Bab 10 pisah Modul + sisip TC-07 portal (kecil docs) |
| 1.1.4 | 2026-09-10 | Bab 11-14 + Lampiran B ke tabel, perbaiki admin (kecil docs) |
| 1.2 | 2026-09-10 | Verifikasi akhir Lampiran A-E; perbaiki baris TBD (minor) |
| 1.3 | 2026-09-10 | Pindah ke root docs/PRD.md + gabung backend PRD Part B (minor) |
| 1.3.1 | 2026-09-10 | docs/SCHEMA.md baru + migration per-modul 15 file, hapus single-file (patch) |
| 1.3.2 | 2026-09-10 | attach/detach lembaga, resolve fallback, 3 bug referensi, dashboard terdokumentasi, .env.example MySQL (patch) |
| 1.4 | 2026-09-10 | Kunci paket offline OFF-01 s/d OFF-10 (minor) |
| 1.5 | 2026-09-10 | Modul 100 PSB full live: 69 routes, 10 tests hijau; is_seleksi ganti psb_butuh_seleksi_default (minor) |
| 1.6 | 2026-09-10 | Modul 101 Santri live: policy+kamus+import+CRUD, 10 tests hijau, suite 22/22 (minor) |
| 1.7 | 2026-09-10 | Modul 102 Siklus live: service+8 endpoint, 9 tests hijau, suite 31/31; gerbang AND target (minor) |
| 1.7.1 | 2026-09-10 | status_awal final: kenaikan (naik), is_pindahan+masuk_tingkat PSB, tidak_lulus buka mengulang (patch) |
| 1.8 | 2026-09-10 | Sesi: token per-device, staf 30 hari / ortu-santri 365 hari, revokasi saat peran berubah, logout-all, prune harian; SQLite tanpa enkripsi (minor) |
| 1.9 | 2026-09-10 | Modul 103 transaksi live: generate+bayar+void, kuitansi PDF+thermal, client_op_id, 10 tests hijau, suite 49/49 (minor) |
| 1.9.1 | 2026-09-11 | Kunci role diri (update+assign 403 semua peran, admin tak bisa buat admin), auto-attach pivot buat lembaga, FE users (opsi+kelola role/lembaga) + tambah lembaga; 8 tests hijau, suite 57/57 (patch) |
| 1.9.2 | 2026-09-11 | Anti-eskalasi: non-super_admin 403 mutasi/hapus pemegang admin/super_admin (update/assign/remove/attach/detach/destroy), tambah lembaga hanya super_admin (gantikan auto-attach v1.9.1); FE kunci baris privileged + form lembaga super_admin-only; 12 tests hijau, suite 61/61 (patch) |
| 1.9.3 | 2026-09-11 | Desktop Tauri: src-tauri asli (store plugin, id pesantren), token/base-URL via plugin-store + halaman Pengaturan (ganti backend tanpa rebuild), bundle macOS .app + .dmg aarch64 VALID & jalan; CI Win/Linux tunda (patch) |
| 1.9.4 | 2026-09-11 | Design overhaul FE v0.4.0: tokens + komponen (toolbar, table-wrap, badge/chip, check-pills, alert), layout responsif, empty-state semua tabel; tanpa ubah logika/API; dmg rebuilt (patch) |
| 1.9.5 | 2026-09-11 | Pause desktop: hapus `src-tauri/target` (±1 GB) + `.app/.dmg`; source Tauri tersimpan, resume via `tauri:build`; percobaan web-only (patch, docs-only) |
| 1.9.6 | 2026-09-11 | Migrasi FE v0.5.0 ke Tailwind v4 + shadcn (10 komponen Radix): galeri 20 tema Top Populer ala VSCode data-driven (`src/themes.ts`, palet resmi) + kustom, teks tombol otomatis via `onAccentFor` (40/40 pasang ≥4.5:1), border global lembut (12% via color-mix, tanpa shadow kartu) + mode Gelap/Terang/Sistem per perangkat, galeri kartu pratinjau, Ctrl/Cmd+B sidebar, grid Excel `react-data-grid` pin beta.40 (resize kolom persist, density + drag tinggi baris, checkbox + salin TSV, kolom Aksi Lihat/Ubah/Hapus role-gated, ikut 20 tema; sorting off, seleksi per halaman) untuk 6 tabel master, form tambah 6 halaman jadi modal + tombol kanan atas, pagination semua list, dialog/toast/skeleton, favicon, catch-all, min window; QA build + kontras + screenshot; tanpa ubah backend/API (patch) |
| 1.9.7 | 2026-09-11 | Tabel master pindah ke `react-datasheet-grid` (wrapper `ExcelTable`, 6 halaman): 3 lib tabel lama + CSS-nya dicabut (react-data-grid/ag-grid/react-data-table-component) dan `ViewDialog` dipisah; seleksi gaya spreadsheet (outline 1px tunggal menimpa garis grid, tint, header kolom + nomor baris tersorot, lubang jangkar hanya saat edit); resize kolom 1:1 + AutoFit (klik 2× gagang, tombol semua kolom, otomatis saat muat & saat font berubah) + resize serentak untuk multi-kolom terseleksi; edit klik-2× langsung tersimpan (`quickEditRef` + simpan satu baris); toolbar satu baris (cari+filter+kontrol+tambah) dengan grup fungsi (mode edit/tampilan/alat/draft), petunjuk pindah ke tooltip; kontrol global ukuran huruf, tinggi baris, dan jenis huruf (9 font sistem + 8 Google Fonts **offline**: 32 `@font-face` dari `src/assets/fonts`, 1,4 MB, skrip `scripts/fonts-offline.py`; isi tabel saja, header tetap `--font-display`); garis kolom & baris terakhir digambar di dalam sel; label tombol jadi "+ Pengguna"/"+ Tahun Ajaran"/dst; desktop Tauri 0.5.0 dibangun ulang (`.app` 11 MB, `.dmg` 4 MB, font ter-embed); tanpa ubah backend/API (patch) |
| 1.10 | 2026-09-14 | Desain (gambaran umum, bisa berubah; docs-only): `santri.lembaga_id` boleh NULL = legacy tanpa track (sumber kebenaran lembaga = `riwayat_belajar`, kolom jadi cache), terlihat semua admin; `santri.status_global` turunan murni default false (= punya ≥1 riwayat aktif); asrama = entitas sendiri (bukan `lembaga`) + peran `asrama` (7 peran) + pivot `user_asrama`; keuangan asrama ditandai lewat `pos_keuangan.kategori` (matriks izin: generate dari lembaga, update hanya pos asrama, delete admin lembaga); presensi/kegiatan asrama ditunda (TBD) |
| 1.10.1 | 2026-09-14 | Klarifikasi lingkup (docs-only): **Asrama (505) = rencana PASCA PRODUCTION** (tidak dikerjakan dalam waktu dekat; tidak ada tabel/peran/pivot dibuat sekarang). Desain dicatat sebagai arah agar keputusan sekarang tidak menutup jalan; perubahan `santri` (legacy/`status_global`) dibahas terpisah dari asrama |
| 1.10.2 | 2026-09-14 | Implementasi bagian **santri** v1.10 (bukan asrama): `santri.lembaga_id` nullable + FK nullOnDelete (legacy tanpa track), `status_global` turunan murni default false + backfill dari riwayat aktif, legacy terlihat semua admin (scope/policy/otorisasi), penempatan kelas & kenaikan mengadopsi lembaga saat NULL, import tidak hardcode `true`; tes baru legacy + adopsi; suite 113/113 hijau |
| 1.10.3 | 2026-09-14 | Input manual santri (legacy) via `POST /admin/santri` + aturan lembaga: admin scoped 1 lembaga → otomatis, admin rangkap/full/super → opsional (null = legacy); import Excel mendukung `lembaga_id` per baris & tanpa lembaga (tanpa riwayat), tahun ajaran wajib hanya bila lembaga diisi; **template Excel** `GET /admin/santri/import-template` (semua kolom profil + `lembaga_id`, sel bertipe teks) + tombol unduh di dialog Import; FE dialog Tambah; suite 116/116 hijau |
| 1.10.4 | 2026-09-14 | Import santri 2 langkah: **`POST /admin/santri/import-periksa`** (dry-run — transaksi di-rollback, ringkasan baris + daftar masalah) sebelum `import-lengkap`; tombol Import baru aktif bila periksa lolos; tambah cek kelas harus selembaga & setahun dengan baris; suite 117/117 hijau |
| 1.10.5 | 2026-09-14 | Template import santri bergaya: header **kuning = wajib** / biru = opsional (dari `rules()` import), sel teks, dropdown data-validation untuk kolom enum + kamus dengan nilai **live `RefService`** per lembaga (sheet "Referensi" tersembunyi; unduh ulang setelah referensi berubah); import hanya membaca sheet pertama; perbaikan `config/cache.php` `serializable_classes` (cache kamus `stdClass` dulu rusak saat cache hit); suite 119/119 hijau |
| 1.10.6 | 2026-09-14 | Perbaikan dropdown template: atribut OOXML `showDropDown` **inverted** — default PhpSpreadsheet menulis `1` sehingga Excel menyembunyikan panah dropdown; kini `setShowDropDown(true)` → XML `showDropDown="0"` (diverifikasi 37/37 dropdown + tes XML mentah); suite 119/119 hijau |
| 1.10.7 | 2026-09-14 | Urut tampil kamus seragam: **`urutan` ASC, tie-break `nama` ASC** (`RefService::effective` & `effectiveAlamat`, berlaku juga dropdown template); `ref_status_awal`/`ref_status_akhir`: kolom `label` → **`nama`** (nilai tetap `kode`, tanpa FK) agar kolom seragam 36 tabel ref; controller/seeder/FE/tests/docs disesuaikan; suite 120/120 hijau |
| 1.11 | 2026-09-15 | Modul 102 **UI admin desktop**: halaman Siklus 6 view (santri aktif, salin ke genap, kenaikan kelas, belum ditempatkan, mutasi keluar, alumni) + dialog aksi (set/pindah/keluar kelas, salin genap, kenaikan, mutasi, kelulusan) dan aksi massal per baris tercentang; endpoint baru `GET /admin/riwayat` (roster baris riwayat + filter lembaga/TA/semester/tingkat/kelas/tanpa_kelas/q, terskop tenant) & `POST /admin/akademik/salin-genap` (massal per lembaga, partial per-item, tanpa `siswa` = semua ganjil aktif); `naik-kelas` menerima `tgl_masuk`/`no_absen` per item; fix serialisasi `riwayat_belajar.tgl_masuk` → `date:Y-m-d` (dulu ISO UTC sehingga tampil H-1 di WIB); suite 122/122 (SiklusFlowTest 14), typecheck lolos |
| 1.12 | 2026-09-15 | Aturan **TA selalu milik lembaga operasional** (root tidak boleh punya TA): `TahunAjaran::resolveUntukLembaga()` dipakai daftar/ACC/tagihan PSB per lembaga (paket MI+MD → TA masing-masing; tanpa TA aktif → 422); guard tolak root di store TA, kegiatan PSB, import santri (level file + per baris), dan target aksi siklus; TA silang lembaga ditolak di import/naik-kelas/lulus; `DevSeeder` selaras (TA per MI/MD/MTS/MLN, kegiatan acuan TA MI, gelombang aktif, kuota); portal PSB publik (:1421) aktif & terverifikasi end-to-end (opsi → daftar paket → ACC → riwayat/tagihan TA benar, data uji dibersihkan); suite 131/131 |
| 1.13 | 2026-09-15 | **Kelas unik per lembaga + tahun ajaran** (FB-004-01): nama dinormalisasi (trim + rapat spasi) di model `Kelas`; migrasi dedupe otomatis (keeper id terkecil, referensi 8 tabel dipindah termasuk unique terdampak `kelas_kurikulum`/`pengampu_mapel`/`rapor_catatan_wali`) lalu `UNIQUE(lembaga_id, tahun_ajaran_id, nama_kelas)`; `store`/`update` menolak duplikat case-insensitive dengan pesan Indonesia + tangkap race 1062; dialog Tambah/Ubah di FE memuat nama lingkup lembaga+TA dan menolak duplikat sebelum submit; KelasStoreTest 6→10 hijau |
| 1.14 | 2026-09-15 | Koreksi panjang **NIS = maks 20 karakter** (dulu validasi 10): kolom `santri.nis` & `riwayat_belajar.nis` jadi `VARCHAR(20)`; validasi `max:20` di store/update santri, ACC PSB (tunggal + bulk), import Excel, dan naik-kelas; input FE `maxLength` 20; tes batas 20/21 di PsbFlowTest (tunggal + bulk 16 karakter) dan SantriFlowTest (update + dry-run import) |
| 1.15 | 2026-09-15 | Import santri: kolom **`kelas_id` menerima nama kelas** (diutamakan — kini deterministik karena `(lembaga, TA, nama)` unik), id numerik, atau kosong; butuh lembaga+TA kecuali id pada baris legacy (cache `santri.kelas_id`, tanpa riwayat); template Excel memuat **dropdown nama kelas** per lingkup via `GET /admin/santri/import-template?lembaga_id=&tahun_ajaran_id=`; dialog import ikut mengirim TA + teks bantuan; tes 20–22 baru (SantriFlowTest 19→22), suite penuh hijau |
| 2.44 | 2026-09-17 | **Samakan NIS paket MI↔MD**: `PenerimaanService::samakanNisSatu` dua arah (satu sisi bernomor → salin ke sisi kosong; beda dua sisi / tabrakan dilaporkan tanpa disentuh; transaksi per santri) + endpoint `POST /admin/santri/samakan-nis` (izin `santri.ubah`, pratinjau bawaan + eksekusi, kandidat se-lingkup) + tombol & dialog pratinjau di Data Santri; suite 173/173 (4 test baru), typecheck + build lolos |
| 2.43 | 2026-09-17 | **Data existing multi-pilih**: `data-gabungan` menerima `lembaga_id[]` (satu/lebih; tiap id dicek operasional + tenant, luar lingkup 403); dialog memakai check-pills (pola UsersPage) + pil "Semua" — super_admin/admin pesantren/multi-lembaga bebas pilih 1/lebih/semua, admin tunggal terkunci otomatis; suite 169/169, typecheck + build lolos |
| 2.42 | 2026-09-17 | **Import satu pintu**: endpoint gabungan menerima file identitas (tanpa blok lembaga → hanya santri; penjaga heading dilonggarkan ke `nama_lengkap`, rule lembaga sepenuhnya opsional, ringkasan `baris_tanpa_keanggotaan`); toggle mode Identitas/Gabungan dihapus dari dialog (satu tombol template gabungan + data existing); endpoint identitas lama tetap hidup (kompatibilitas); suite 169/169, typecheck + build lolos |
| 2.41 | 2026-09-17 | **Unduh data existing fleksibel**: `data-gabungan` tanpa parameter → semua lembaga dalam lingkup (super_admin: semua operasional; scoped: miliknya); dropdown pilih lembaga + "Semua (lingkup saya)" di dialog import (bawaan: filter aktif → lembaga tunggal terkunci otomatis → semua); toast "pilih lembaga dulu" dihapus; round-trip file campuran teruji; suite 168/168, typecheck + build lolos |
| 2.40 | 2026-09-17 | **Import tahan file ketikan manual**: `WithMapping::map()` di `SantriLengkapImport` (berlaku identitas + gabungan) menormalisasi SEBELUM validasi — sel numerik di kolom teks (`nisn, nik, rt/rw, telp, nis_lokal, kode_lembaga`, …) di-cast ke string, serial tanggal Excel → `Y-m-d`; rule `nisn` diselaraskan jadi `digits:10` (seperti `aturanProfil`); test xlsx asli (NISN/NIS angka + tanggal serial) + unit `map()`; suite 167/167 hijau |
| 2.39 | 2026-09-17 | **Import gabungan siswa (`santri` + `lembaga_santri`)**: template Excel satu sheet — blok keanggotaan dulu (`santri_id, kode_lembaga, lembaga_id, nis_lokal, nis_kemenag, is_active, tgl_mulai, tgl_selesai`) lalu seluruh `KOLOM_PROFIL`; `kode_lembaga` kunci utama (case-insensitive, dropdown lingkup pengunduh) fallback `lembaga_id`; cocok 4 lapis (`santri_id` eksak → `nik|nama|tgl` → `nis+lembaga` → create; sel kosong = pertahankan, pengosongan via UI); keanggotaan belum ada → create (aktif bawaan), sudah ada → update; endpoint `import-template-gabungan` / `data-gabungan` (pra-isi round-trip update) / `import-periksa-gabungan` (dry-run) / `import-gabungan` — tulis butuh `santri.tambah` DAN `santri.ubah` (dua middleware = AND), baris luar tenant gagal per baris, penjaga salah-template (422 jelas); FE dialog import bermode (Identitas / Gabungan, tombol template + data existing); dedup `SantriLengkapImport` diekstrak protected untuk dipakai ulang; suite 166/166 hijau (11 test baru SantriLembagaImportTest) |
| 2.38 | 2026-09-17 | **Matriks izin Kelola Izin + hapus sementara role `kasir`**: kewenangan aksi pindah dari role hardcoded ke izin `modul.aksi` (katalog `IzinKatalog`, tabel Spatie `permissions`/`role_has_permissions` yang sudah ada); halaman Kelola Izin (super_admin saja, matriks checkbox role × izin + simpan per role, anti-lockout super_admin); endpoint admin bermiddleware `permission:` per aksi, policy Santri/User berbasis izin, cakupan data tetap pivot `user_lembaga`; FE `bisa()` + guard halaman + tombol aksi per izin + `audit-izin.mjs` cegah drift; portal tetap role-based; role `kasir` dihapus dari seeder/kode/test (kembali saat modul keuangan dirumuskan ulang; 6→5 peran efektif); suite 155/155 hijau |
| 2.37 | 2026-09-16 | **Hapus sisa keuangan di PSB**: flag mati `is_pendaftaran_paid`/`is_daftar_ulang_paid` (kolom + casts), method yatim `nominalPendaftaran(+Efektif)`, master biaya (`psb_biaya_lembaga` utuh + kolom nominal kuota + endpoint `biaya-lembaga` + tampilan biaya di `opsi`); sinyal paket baru `paket_tersedia` (boolean, opsi a) menggantikan `nominal_paket !== null`; FE kuota tanpa input nominal + checkbox paket, tabel biaya dihapus; seeder/test/SCHEMA/PRD disesuaikan; suite 148/148 hijau |
| 2.36 | 2026-09-16 | **Hapus total modul keuangan (BE/FE/docs)**: 21 file backend (service, 4 controller, policy, 10 model, 2 view, 1 test, 2 migrasi) + bedah PSB (tanpa tagihan: daftar/ACC/hapus/pulihkan/undur-diri/import), portal (riwayat-pembayaran), policy, routes, 2 ref kas (`ref_kategori_kas`, `ref_metode_pembayaran`), seeder; FE: 3 halaman + `api/keuangan` + seksi pos/tarif + nav; SCHEMA BLOK 4 dihapus (BLOK 5–11 jadi 4–10); PRD normatif keuangan dihapus (riwayat changelog tetap); `migrate:fresh` + suite hijau tanpa KeuanganFlowTest |
| 2.35 | 2026-09-16 | **Ribbon grup Kolom: label di samping stepper (FE)**: label "Freeze Kolom" (dulu "Bekukan kolom") dan "Tinggi header" dipindah dari atas stepper ke sampingnya; lebar label dikunci `min-w-[86px]` agar kedua stepper sejajar satu kolom, font disamakan dengan label di samping kontrol lain (`text-xs text-white/80`, seragam dengan "Header"/"Cell" di grup Font & Warna); urutan tombol reset tetap; `typecheck` lolos |
| 2.34 | 2026-09-16 | **AutoFit kolom `select` memakai label, bukan nilai mentah (FE)**: pengukur lebar kolom (`syncAutoWidths` saat render + `autoFitWidth` untuk AutoFit DOM) memakai nilai mentah grid (`'default'`) alih-alih teks yang benar-benar dirender, sehingga kolom `select` hanya selebar kata "default" dan label pilihannya (mis. `Ikut lembaga`) membungkus 2 baris lalu terpotong klip sel. Ditambah helper `teksTampilSel()` (memetakan nilai → label `choices` untuk `kind: 'select'`) yang dipakai kedua pengukur — berlaku semua tabel. Terverifikasi uji browser: sel "Seleksi" tabel Kuota-Biaya PSB 58 → 87 px (`scrollHeight` = `clientHeight`, satu baris); sapuan `/kegiatan-psb`, `/psb`, `/santri`, `/rekap-santri` 1360×900 → 0 sel terpotong (satu-satunya tabel ber-scroll: tabel utama `/santri` 30 baris, memang paginasi); `typecheck` & `build` lolos |
| 2.33 | 2026-09-16 | **Throttle dilepas di `APP_ENV=local` (BE)**: `AppServiceProvider` mendeteksi `app()->isLocal()` sekali di `boot()`; limiter `login`, `api_user`, dan `imports` mengembalikan `Limit::none()` hanya di local (produksi tetap 6/mnt, 120/mnt, 10/mnt). Latar: siklus kerja dev memuat halaman berulang kali demi cek tampilan (mis. `/kegiatan-psb` ±6 request per muat → 429 setelah ~20 muat/menit) padahal tujuannya bukan menarik data baru. Bukan cache apa pun, jadi tidak ada risiko data basi; `APP_ENV=testing` tetap kena batas sehingga `HardeningReviewTest` (429) hijau. Terverifikasi: 130 request berurutan `GET /api/admin/psb/kegiatan` → semua 200, 8 login salah → 401 (bukan 429); `php artisan test --filter='HardeningReviewTest|SessionFlowTest'` 11/11 lolos |
| 2.32 | 2026-09-16 | **Tinggi tabel kompak ikut header ber-multibaris + isi yang membungkus (FE)**: tinggi tabel ber-`maxRows` dulu dipatok `27` (≈ header 1 baris) **dan** dibatasi `Math.min(gridH, …)` — padahal `gridH` (tinggi wrapper) mengikuti tinggi kartu, jadi umpan balik membuat tinggi terpaku saat header membungkus. Kini: (a) memakai tinggi header efektif `headerH ?? headerAutoH ?? DEFAULT_HEADER_H` + 1, (b) batas `gridH` dibuang untuk tabel kompak (kebutuhan sudah dibatasi `maxRows`), (c) sel **data** diklip (`overflow: hidden`; sel header tidak, agar judul tetap utuh) supaya isi yang membungkus (mis. opsi select panjang di kolom sempit) tak menambah `scrollHeight`. Terverifikasi uji browser di `/kegiatan-psb` & `/rekap-santri` 1360/900 px — semua tabel **tanpa scrollbar**, judul 2 baris utuh; `typecheck` & `build` lolos |
| 2.31 | 2026-09-16 | **Garis bawah header saat tabel kosong (FE)**: DSG menyetel `.dsg-cell-header { box-shadow: none }`; garis bawah header normalnya berasal dari `border-top` baris data di bawahnya, jadi tabel **tanpa baris data** tak punya garis bawah (hanya kolom Aksi yang punya). Ditambah aturan CSS yang menggambar `box-shadow: 0 1px` pada sel header (kecuali gutter & sticky yang sudah punya) **hanya saat tak ada baris data** (`:has`) agar tidak dobel pada tabel berisi; terverifikasi uji browser; `build` lolos |
| 2.30 | 2026-09-16 | **Brand sidebar disembunyikan saat dilipat (FE)**: saat rail (terlipat) hanya tombol lipat di tengah yang tampil — teks brand `SIMPES` tidak dirender (sebelumnya menampilkan "S" yang ter-*shrink*/terpotong); `<aside>` tetap `overflow-hidden`; terverifikasi uji browser (terbuka: `SIMPES` + tombol kanan; terlipat: tanpa brand, tombol center 28 = center sidebar); `typecheck` & `build` lolos |
| 2.29 | 2026-09-16 | **Migrasi preferensi huruf sel lama (FE)**: `loadPrefs` memindahkan `simpes_grid_font`/`simpes_grid_font_family` (pref lama) ke bagian UI `tabel_sel` — size/font masing-masing hanya bila bagian itu belum mengaturnya — lalu menghapus pref lama; terverifikasi uji browser (20 + Inter Light termigrasi; bagian yang sudah diatur tidak ditimpa; pref lama terhapus); `typecheck` & `build` lolos |
| 2.28 | 2026-09-16 | **Sinkron font & ukuran sel: ribbon ↔ Tampilan (FE)**: `GridPrefs` jadi *facade* ke bagian UI **`tabel_sel`** — `fontPx`/`fontFamily` dibaca dari `parts.gaya.tabel_sel` dan `setFontPx`/`setFontFamily` menulis ke bagian itu (bukan preferensi terpisah `simpes_grid_font(_family)` yang kini pensiun); jadi mengubah di ribbon (Font/Font Size sel) langsung tampil di Tampilan dan sebaliknya, satu sumber. `ExcelTable` tak berubah (tetap lewat GridPrefs). Terverifikasi uji browser dua arah (ribbon 11→12 → Tampilan 12; Tampilan font→Inter → ribbon "Inter" & sel render Inter; tanpa error); `typecheck` & `build` lolos |
| 2.27 | 2026-09-16 | **Konsistensi default font sel di halaman Tampilan (FE)**: fallback CSS `.simpes-dsg`/`.dsg-container`/`.dsg-cell` disamakan ke Roboto Light (`"Roboto", sans-serif`, weight 300) sehingga bagian **Sel tabel grid** di Tampilan menampilkan `Bawaan — Roboto` & 11 px (dulu `Bawaan — Aptos`; header sudah cocok); terverifikasi uji browser; `typecheck` & `build` lolos |
| 2.26 | 2026-09-16 | **Fix reset ukuran huruf sel tidak bertahan (FE)**: `setFontPx(null)` di `GridPrefs` dulu **tidak menghapus** pref `simpes_grid_font` (hanya `setRowH`/`setHeaderH` yang menghapus) sehingga tombol ⟲ mengembalikan nilai hanya sementara lalu nilai lama (mis. 14) dimuat lagi saat reload — kini disamakan (`prefSet(…, '')` saat null); terverifikasi uji browser (naik→14 tersimpan & bertahan; reset→pref kosong & tetap 11 setelah reload); `typecheck` & `build` lolos |
| 2.25 | 2026-09-16 | **Font bawaan Tabel = Roboto Light (FE)**: header kolom & isi sel default ke **Roboto Light** (`FONT_TABEL_DEFAULT = '"Roboto", sans-serif\|300'`, dibundel lokal) — `GridPrefs` (font sel) & `RibbonTabel` (font header) memakai konstanta ini, CSS `--part-tabel_header-font/weight` fallback ke `"Roboto", sans-serif`/300; opsi "Bawaan" tetap ada; terverifikasi uji browser; `typecheck` & `build` lolos |
| 2.24 | 2026-09-16 | **Ikon header/ribbon ikut warna aksen tema (FE)**: pengecualian CSS `header svg.simpes-ikon → color: inherit` dihapus sehingga ikon di ribbon (mode grup, kolom, baris, font & warna, area akun) memakai `--accent-readable` seperti ikon sidebar — mis. tema Monokai (mode terang) kini merah tua (#9A1F4A), bukan putih; terverifikasi uji browser (tema monokai: ikon ribbon = sidebar = akun = aksen, tanpa error); `build` lolos |
| 2.23 | 2026-09-16 | **Ikon kerapatan baris (FE)**: tambah 3 ikon ke kosakata (`DensitySmall`/`DensityMedium`/`DensityLarge` → Lucide `rows-4/3/2`, Material `density-small/medium/large`, set lain jatuh ke Lucide) via `scripts/icons-gen.mjs`; tombol Ramping/Sedang/Nyaman di grup **Baris** kini **ikon saja** (label jadi tooltip/aria-label, ukuran `w-8`) dan tetap sejajar dengan stepper tinggi baris; terverifikasi uji browser (ketiga ikon berbeda, tooltip/aria ada, klik mengaktifkan, tanpa error); `typecheck` & `build` lolos |
| 2.22 | 2026-09-16 | **Tinggi Header pindah ke grup KOLOM (FE)**: kontrol tinggi baris header (`input_tinggi_header_top` + tombol resetnya) dipindah dari grup **BARIS** ke grup **KOLOM**, ditata **di bawah "Bekukan kolom"** dengan label kecil "Tinggi header"; grup BARIS kembali hanya kerapatan + tinggi baris; terverifikasi uji browser (kontrol ada di KOLOM & tidak di BARIS, posisi di bawah Bekukan kolom, tanpa error); `typecheck` & `build` lolos |
| 2.21 | 2026-09-16 | **Default ukuran huruf sel tabel = 11 px (FE)**: `DEFAULT_FONT_PX` diubah 13 → **11** (berlaku global untuk SEMUA tabel di semua halaman; kunci pref `simpes_grid_font`, bukan per tabel) + fallback CSS `--simpes-font-size` (2 tempat) disamakan ke 11; terverifikasi uji browser (stepper ribbon = 11, sel data ter-render 11px, `--simpes-font-size: 11px`, tanpa error); `typecheck` & `build` lolos |
| 2.20 | 2026-09-16 | **Judul kolom "Font Size" center atas stepper (FE)**: kolom stepper dan kolom tombol reset dipisah pada grid grup Font & Warna (`[rowlabel][Font][Font Size][reset][Color][Bg-Color]`) sehingga label **Font Size** center tepat di atas stepper saja (bukan gabungan stepper+reset); terverifikasi uji browser (center label = center stepper 1037 px, bukan titik tengah stepper+reset, tanpa error); `typecheck` & `build` lolos |
| 2.19 | 2026-09-16 | **Tombol reset nonaktif (bukan disembunyikan) (FE)**: semua tombol ⟲ reset (tinggi header, ukuran/warna header, ukuran/warna sel) kini **selalu tampil** namun `disabled` saat tidak berlaku (dulu di-hide) — lebar grup tetap stabil tanpa slot penampung; terverifikasi uji browser (kelima tombol ada & disabled saat awal, aktif setelah nilai manual, lebar grup 486 px tetap); `typecheck` & `build` lolos |
| 2.18 | 2026-09-16 | **Reset ukuran huruf sel (FE)**: tombol ⟲ "Kembalikan ukuran huruf sel ke bawaan" (`btn_reset_ukuran_cell_top`) ditambahkan di kolom Font Size baris Cell pada grup Font & Warna (muncul hanya bila ukuran bukan bawaan; `setFontPx(null)`), dalam slot lebar tetap sehingga lebar grup tidak berubah; terverifikasi uji browser (13 → 14 → 13, lebar grup stabil 486 px, tanpa error); `typecheck` & `build` lolos |
| 2.17 | 2026-09-16 | **Grup Font & Warna (FE)**: grup `Header` + `Cell` digabung menjadi satu grup **"Font & Warna"** berbentuk tabel (grid 2 baris × kolom `Font` / `Font Size` / `Color` / `Bg-Color`; baris `Header` & `Cell`; judul kolom Bahasa Inggris sesuai permintaan); tombol ⟲ reset ukuran/warna dipertahankan dalam **slot lebar tetap** sehingga tampil/hilang tidak menggeser kolom; kontrol **Tinggi Header** dipindah sementara ke grup **Baris** (penyesuaian menyusul); terverifikasi uji browser (kolom sejajar, lebar grup stabil 486 px saat reset muncul/hilang, Header Height ada di Baris, tanpa error); `typecheck` & `build` lolos |
| 2.16 | 2026-09-16 | **Pemisah & jarak antar grup ribbon (FE)**: garis pemisah antar grup dibuat setinggi penuh baris (menembus padding vertikal sehingga menyentuh border atas/bawah bilah ribbon) dan padding kiri-kanan tiap grup dinaikkan (`px-1.5` → `px-3`) agar lebih renggang; pratinjau `pemisah_ribbon` diselaraskan; terverifikasi uji browser (pemisah `h=123` sama dengan tinggi baris, tanpa error); `typecheck` & `build` lolos |
| 2.15 | 2026-09-16 | **Perbaikan tombol kerapatan grup Baris (FE)**: sudut tombol Ramping/Sedang/Nyaman tidak lagi terpotong (override pembulatan `data-[spacing=0]` bawaan `ToggleGroup` yang menang spesifisitas), dan lebarnya dibuat tetap `w-[72px]` sehingga `font-semibold` saat aktif tidak melebarkan grup (dulu menggeser grup lain ke kanan); terverifikasi uji browser (lebar grup stabil 122 px saat ganti pilihan, `border-radius` 4 px, tanpa error); `typecheck` & `build` lolos |
| 2.14 | 2026-09-16 | **Tinggi seragam grup Baris (FE)**: baris Ramping/Sedang/Nyaman disamakan `h-6` (dulu `h-4/h-6/h-4` mengikuti −/nilai/+ sehingga terlihat beda) dan baris stepper vertikal `input_tinggi_top` juga `h-6`, sehingga tinggi seragam sekaligus tetap sejajar (Ramping↔−, Sedang↔nilai, Nyaman↔+); terverifikasi uji browser (semua tinggi 24 px, sejajar, tanpa error); `typecheck` & `build` lolos |
| 2.13 | 2026-09-16 | **Opsi stepper vertikal per-kontrol (FE)**: `SpinBox` diberi prop `vertikal?` — **bawaan tetap horizontal** (`− nilai +`, `h-6`); hanya `input_tinggi_top` (grup **Baris**) yang disetel vertikal (− atas, nilai, + bawah); kerapatan **Ramping/Sedang/Nyaman** ikut ditumpuk vertikal dan disejajarkan per baris dengan stepper (Ramping↔− `h-4`, Sedang↔nilai `h-6`, Nyaman↔+ `h-4`); pratinjau `spinbox` editor kembali horizontal; terverifikasi uji browser (bounding-box sejajar ≤2 px, stepper lain horizontal, tanpa error); `typecheck` & `build` lolos |
| 2.12 | 2026-09-16 | **AutoFit pindah ke context menu header (FE)**: tombol "Sesuaikan Lebar" dihapus dari grup ribbon **KOLOM** (kini hanya "Bekukan kolom"); AutoFit ditambahkan ke **context menu header kolom** (klik kanan) sebagai "Sesuaikan lebar kolom ini" (`onAutoFit`) dan "Sesuaikan lebar semua kolom" (`onAutoFitAll`); terverifikasi uji browser (tombol ribbon hilang, item menu muncul & aksi jalan tanpa error); `typecheck` & `build` lolos |
| 2.11 | 2026-09-16 | **Ruang label grup & padding baris ribbon (FE)**: label grup di atas isi grup dengan jarak ~6 px ke tool (tanpa border); baris tools diberi padding vertikal 12 px agar lebih longgar (tinggi ~101 px, tetap satu baris); pratinjau editor diselaraskan; terverifikasi uji browser (jarak 6 px, `borderBottom 0px`, tanpa scroll); `typecheck` & `build` lolos |
| 2.10 | 2026-09-16 | **Label grup ribbon di atas (FE)**: nama grup (`RibbonGroup`) dipindah dari bawah ke **atas** isi grup (mis. MODE, KOLOM, BARIS, HEADER, CELL); pratinjau `grup_ribbon`/`menu_ribbon` di editor Tampilan diselaraskan; terverifikasi uji browser (semua label di atas kontrol, baris tetap satu baris, tanpa error); `typecheck` & `build` lolos |
| 2.9 | 2026-09-16 | **Perapian grup mode di ribbon tabel (FE)**: grup "Tabel" → **"Mode"**; tombol "Input Baris"/"Edit Sel" → **"Mode Input"/"Mode Edit"** dan ditata bertumpuk (Edit di bawah Input); tombol "Salin TSV" & "Reset Tampilan" dihapus dari ribbon (salin masih bisa lewat Ctrl/Cmd+C di grid); `typecheck` & `build` lolos |
| 2.8 | 2026-09-16 | **Tab pada baris tools ribbon (FE)**: bila halaman menyumbang tools halaman **dan** punya tools tabel, baris ribbon menampilkan strip tab (label dari `RibbonSlot label=…`, mis. **PSB** + **Tabel**) sehingga hanya satu kelompok ditampilkan — baris tetap satu baris tanpa scroll (dua sumber lain tetap tanpa strip tab); menambah `label` ke `RibbonSlot` dan penjaga tab aktif (tanpa state-loop di halaman tanpa tools); pemilih **Tahap PSB** tetap stepper 5 tombol + jumlah (bukan dropdown) dan muat satu baris di tab PSB; terverifikasi uji browser (PSB: 2 tab, tools tabel vs halaman, `scrollWidth==clientWidth`, tanpa error); `typecheck` & `build` lolos |
| 2.7 | 2026-09-16 | **Ribbon tidak lagi menggulir horizontal (FE)**: baris tools dibuat membungkus (`flex-wrap`, tinggi ikut tumbuh) alih-alih `overflow-x-auto`; terverifikasi uji browser di 1360 px & 1120 px (`scrollWidth == clientWidth`, tanpa scroll halaman); `typecheck` & `build` lolos |
| 2.6 | 2026-09-16 | **Tools per halaman (contoh pertama, FE)**: mekanisme `RibbonSlot` dipakai di dua halaman tanpa grid/aksi halaman — **Pengaturan → Server** (grup "Server": Uji koneksi, Kembalikan bawaan; tombol inline di form dihapus, validasi alamat dipindah ke `onUji`) dan **PSB** (grup "Tahap": pemilih 5 tahap + jumlah, dan grup "Pendaftar": Tambah/Import yang hanya tampil di tahap Pendaftar; timeline `<ol>` dan `addButton` lama dihapus); aksi massal baris tercentang tetap di toolbar tabel (menyusul); terverifikasi uji browser (grup muncul, pindah tahap mengubah data, tombol jalan, tanpa error console); `typecheck` & `build` lolos |
| 2.5 | 2026-09-16 | **Tombol tampil/sembunyi toolbar (FE)**: tombol lipat di bar judul (muncul hanya bila halaman punya tools) menyembunyikan/menampilkan baris tools; status disimpan per perangkat di pref `simpes_tools_tampil` (bawaan tampil); terverifikasi uji browser (hide→`0`, reload tetap tersembunyi, show→`1`); `typecheck` & `build` lolos |
| 2.4 | 2026-09-16 | **Pemisahan navigasi vs tools (FE)**: tautan halaman pindah dari ribbon ke **sidebar rail kiri** (dari registri `lib/halaman.ts` — kini sumber tunggal label+ikon; dikelompokkan per kategori, bisa dilipat ke rail ikon via tombol & **Ctrl/Cmd+B**, status di pref `simpes_sidebar` yang sebelumnya menganggur); ribbon jadi **bar judul halaman + area akun** (mode/picker/akun) dan **baris tools kontekstual** di bawahnya; **slot tools per halaman** baru (`RibbonSlot`, portal ke baris tools) agar halaman bisa menyumbang kontrol sendiri, digabung dengan tools tabel (`RibbonTable`/`RibbonTabel`) yang tetap; komponen `topbar/RibbonBeranda|Master|Psb|Santri|Keuangan|Pengaturan` + `RibbonBtn`/`pathAktif` dihapus; bagian style `sidebar` aktif (via `data-slot="sidebar"`) dan `tab_ribbon` jadi belum-dipakai; `npm run typecheck` & `build` lolos; tanpa ubah backend/API |
| 2.3 | 2026-09-16 | **Opsi baris per halaman & "Semua"**: opsi 10/50/100/500 + **Semua** (75/250/1000 dihapus), bawaan tetap 50; "Semua" dikirim `per_page=0` dan backend mengartikannya tanpa batas (`PerPageLimit` baru: `PER_PAGE_ALL=100000`, dipakai `TenantGuard` & `UserManagementController`); pager tetap tampil saat "Semua" agar bisa dikembalikan; tes `test_16_daftar_santri_per_page_semua` (105 baris, suite 148/148) |
| 2.2 | 2026-09-16 | **Baris per halaman**: opsi 10/50/75 ditambahkan (kini 10/50/75/100/250/500/1000) dan bawaan tabel menjadi **50/halaman** (`PER_PAGE_DEFAULT`, tersimpan per tabel seperti sebelumnya); pager tak tampil bila seluruh data masuk satu halaman (`total <= perPage`) |
| 2.1 | 2026-09-16 | **Pemisahan kontrol ukuran huruf tabel**: stepper "Ukuran huruf sel" (ribbon → grup Cell) hanya mengatur isi sel; ukuran header **mandiri** (bawaan **11 px**, ala Excel) dan hanya diatur stepper grup Header (+ tombol ⟲ "Kembalikan ukuran huruf header ke bawaan" bila bukan bawaan); CSS `.dsg-cell-header-container` tak lagi jatuh ke `--simpes-font-size` |
| 2.0 | 2026-09-15 | **Rombak alur santri (akademik)**: `santri` = buku induk identitas murni (hapus `lembaga_id`/`kelas_id`/`nis`); tabel baru **`lembaga_santri`** (`nis_lokal` unik per lembaga, `nis_kemenag` generate manual NSM+YY+4 digit, `is_active`, `tgl_mulai`/`tgl_selesai`); `riwayat_belajar` tanpa `nis`; satu pintu `PenerimaanService` + `NisKemenagService` + `SiklusSantriService` (mutasi/lulus/berhenti menutup riwayat & keanggotaan); import identitas & import riwayat terpisah; FE: Buku Induk, Riwayat Belajar, Daftar Kelas, Pindah Kelas, Kenaikan, Kelulusan, Mutasi Keluar, Rekap Santri (halaman lama Siklus/Penempatan/Roster/Salin Genap/Alumni/Arsip dilebur); suite 147/147, typecheck + build FE lolos |

## Daftar Isi

1. Pendahuluan
2. Gambaran Sistem
3. Analisis Kebutuhan
4. Model Proses Bisnis
5. Perancangan Sistem
6. Perancangan Basis Data
7. Perancangan Antarmuka
8. Implementasi (rencana dokumen)
9. Manajemen Proyek (rencana dokumen)
10. Rencana Pengujian
11. Penyebaran dan Migrasi Data
12. Keamanan Sistem
13. Pelatihan dan Dokumentasi Pengguna
14. Pemeliharaan dan Dukungan
- Lampiran A — ERD (sumber kebenaran)
- Lampiran B — Matriks Ketertelusuran ke Arsip
- Lampiran C — Isu Terbuka / TBD
- Lampiran D — Glosarium
- Lampiran E — Catatan Perubahan Aturan

---

## 1. Pendahuluan

### 1.1 Tujuan Dokumen

Proyek ini menyusun Project Documentation SIMPES (bukan coding app). Dokumen ini acuan tunggal: kebutuhan, proses, rancangan, rencana uji/penyebaran, plus lampiran ketertelusuran ke arsip. Kriteria selesai per bab: ringkas, logika terverifikasi ke arsip/keputusan, TBD eksplisit.

### 1.2 Latar Belakang

Pengelolaan santri, keuangan, akademik, dan operasional masih manual/spreadsheet:

- Data santri (biodata, dokumen, riwayat belajar) tersebar.
- Tagihan SPP dan pembayaran rawan salah catat.
- Nilai, kurikulum, dan induk santri tidak terintegrasi per lembaga.
- Komunikasi orang_tua/wali tidak real-time.
- Pimpinan sulit mendapat laporan per lembaga maupun gabungan.

Pesantren menaungi beberapa lembaga — MI, MD, MTs, Mu'allimin — dalam satu pesantren (root `lembaga kode=PESANTREN`). Tiap lembaga punya `tahun_ajaran`, `kurikulum`, `kelas`, pegawai sendiri; sebagian santri aktif di >1 lembaga (mis. MTS + MD, paket MI-MD).

**Asrama bukan `lembaga`** (v1.10, **implementasi pasca production**): asrama punya kepengurusan, gedung, kamar, dan siklus penghuni sendiri; didaftarkan sebagai entitas `asrama` + peran `asrama` + pivot `user_asrama` (Modul 505). Santri asrama tetap terikat lembaga akademiknya untuk urusan akademik/PSB; penanda keuangan asrama ditetapkan saat modul keuangan dirumuskan ulang. Tidak ada tabel/role/pivot asrama yang dibuat sekarang — desain ini arah agar sistem sekarang mendekati bentuk akhirnya.

**Santri legacy:** `santri.lembaga_id` boleh NULL untuk data lama yang lembaganya tidak punya jejak `riwayat_belajar`/mutasi/kenaikan/pembayaran. Sumber kebenaran lembaga adalah `riwayat_belajar`; kolom ini cache terakhir dan diisi saat penempatan kelas. `status_global` bukan input manual — turunan "punya ≥1 riwayat aktif" (default nonaktif sampai ditempatkan).

### 1.3 Tujuan Proyek

1. Sistem terpusat untuk santri, pegawai/guru, dan pengguna lintas lembaga via model single-pesantren (`lembaga`).
2. Digitalisasi PSB 2-jalur, santri, siklus/riwayat, dan keuangan per lembaga.
3. Akademik (kurikulum, mapel, pengampu, nilai, rapor) dengan pivot `kurikulum_mapel`.
4. Kepegawaian (master, keaktifan, walas, sertifikasi).
5. Portal wali read-only + pengajuan.
6. Laporan real-time per lembaga + gabungan dengan tenant ketat.
7. Admin scoped mandiri per lembaga namun terintegrasi.

### 1.4 Ruang Lingkup

**Production awal (G0–G3, prioritas):**
- G0: auth, referensi/master (001–004). Desktop admin_lembaga (pengganti Excel).
- G1: PSB, santri (kelas, mutasi, naik, lulus) (100–102). Desktop.
- G2: DITUNDA — menunggu perumusan ulang modul keuangan dari awal.
- G3: ortu mobile (daftar; subset 100/203). Setelah ini production.

**Pasca (detail ditunda, kecuali ada di arsip):**
- G4: guru, dokumen guru/santri, absensi guru. G5: laporan keuangan, input nilai (tanpa rapor). G6: pengurus mobile (statistik). G7: absen santri, asrama (**Modul 505 sudah digambarkan** — entitas+peran+pivot; UI/migrasi menyusul), tahfizh, rapor. G8: notifikasi, pengumuman, gateway, fingerprint.

**Kurikulum/nilai:** dibangun belakangan (G5/G7), skema disiapkan sekarang (pivot, tingkat, mode_rapor) agar minim rombak.

### 1.5 Definisi Singkat

Lihat Lampiran D. Inti: `lembaga` (root PESANTREN + MI/MD/MTS/MUA), `tahun_ajaran`, `kelas` (`walas_id→pegawai`), 6 peran (`super_admin, admin, guru, orang_tua, santri, asrama` — `asrama` pasca production; `kasir` dihapus sementara v2.38), matriks izin (`IzinKatalog`), `riwayat_belajar`, `asrama` (entitas sendiri, bukan lembaga; pasca production).

### 1.6 Referensi (arsip, read-only)

- [[Step-By-Step Sistem Pesantren/Backend/AGENTS|AGENTS — Konvensi]]
- [[Step-By-Step Sistem Pesantren/Backend/000_Catatan Pembahasan|000 Keputusan Terkunci]]
- [[Step-By-Step Sistem Pesantren/Backend/002_Skema_Database|002 Skema (implementasi)]]
- Wawancara pengurus (Agu 2026), kurikulum 2026/2027, tata tertib.

---

## 2. Gambaran Sistem

### 2.1 Deskripsi Umum

SIMPES adalah backend API-first Laravel 13 + frontend terpisah, modular berurutan (`001→004→100→102→200→203`).

### 2.2 Struktur Lembaga

| Kode      | Nama           | Sifat                    | Kohort             | Aturan daftar (Modul 100 PSB Penerimaan)                        |
| --------- | -------------- | ------------------------ | ------------------ | --------------------------------------------------------------- |
| PESANTREN | Root pesantren | Induk (`parent_id` null) | —                  | Fallback kontak/logo bila null di anak; root null pakai placeholder |
| MI        | Ibtidaiyah     | Formal                   | SD                 | Langsung contoh hari ini; mandiri boleh; paket MD opsional      |
| MD        | Diniyah        | Non-formal paralel       | SD (sama dgn MI)   | Langsung contoh hari ini; mandiri boleh; paket MI opsional      |
| MTS       | Tsanawiyah     | Formal                   | SMP                | Seleksi contoh hari ini; eksklusif                              |
| MLN       | Mu'allimin     | Formal khas              | Aliyah (nama beda) | Seleksi contoh hari ini; eksklusif                              |

Aturan terkunci:
- Hierarki via `parent_id` ke root; PK tetap `lembaga.id` INT. `kode` hardcoded, unik global, wajib isi (PESANTREN, MI, MD, MTS, MLN). Ganti kode via Lampiran E.
- Seleksi via flag: default `lembaga.is_seleksi`; override `psb_kuota_biaya.membutuhkan_seleksi` null = ikut default. Contoh hari ini MI/MD langsung, MTS/MLN seleksi; bisa dibalik per gelombang.
- Paket MI-MD opsional: 1 input usia SD jadi 2 keikutsertaan (primer MI, non-asrama, lifecycle tidak divergen). MI saja / MD saja tetap boleh.
- Tenant: pivot `user_lembaga` satu-satunya; tanpa tabel `pesantren` (Modul 003 Auth Login).

### 2.3 Peran Pengguna

| Peran | Tenant | Hak utama |
|---|---|---|
| `super_admin` | Semua, tanpa pivot | Semua izin (terkunci di matriks); tulis global `ref_*`; buat semua peran; kelola matriks izin |
| `admin` | Full tanpa pivot = semua; scoped dengan pivot = subset via `isAdminFull()` | Semua izin kecuali `izin.*`, `tampilan_standar.lihat`, `server.lihat`, `lembaga.tambah`; CRUD `001–004` (kecuali tambah lembaga = super_admin), `100–102`, attach/detach `user_lembaga`; tak boleh mutasi/hapus pemegang `admin/super_admin` maupun role diri sendiri |
| `guru` | Wajib pivot ≥1 | Modul 202 Nilai-Rapor: input miliknya/walasnya |
| `orang_tua` | Wajib pivot, via `wali_santri_relasi` | Modul 203 Portal Wali + Modul 100 PSB Penerimaan daftar + ajukan/batal (1 aktif/santri) |
| `santri` | Wajib pivot | Portal terbatas |
| `asrama` | Wajib pivot `user_asrama` (ditetapkan super_admin saja) | Modul 505 Asrama (**pasca production**; peran belum di-seed sekarang): penghuni/kamar/izin pulang/kegiatan; keuangan mengikuti perumusan ulang modul keuangan |
| (`kasir` — dihapus sementara; kembali saat modul keuangan dirumuskan ulang) | Wajib pivot ≥1 | Menunggu modul keuangan |

Aturan terkunci:
- 6 peran final: `super_admin, admin, guru, orang_tua, santri, asrama`; **efektif sekarang 5** — `asrama` menyusul pasca production (Modul 505); guard wajib `sanctum`; multi-peran didukung. 4 peran lama (`admin_pesantren, admin_lembaga, kasir_pesantren, kasir_lembaga`) dihapus; gabung jadi `admin` / `kasir` (Modul 003 Auth Login). Role `kasir` dihapus sementara dari seed/kode (v2.38); riwayatnya tetap di changelog.
- Tenant pivot `user_lembaga`; `users` tanpa kolom tenant; 1 akun multi-lembaga via `lembaga_ids[]` (mis. 1 akun `admin` untuk MI+MD); non-admin tidak boleh list users. Peran `asrama` memakai pivot tambahan `user_asrama` (1 akun boleh multi-asrama) dan **tidak** memberi akses `user_lembaga`.
- Pemberian peran via `assignableRolesFor()`: `super_admin` ke semua 6; `admin` hanya `guru,orang_tua,santri` (tidak boleh buat sesama `admin/super_admin`, dan **tidak boleh** memberi `asrama` — khusus super_admin); tambah lembaga via attach/detach oleh `super_admin`/admin full; larang hapus diri sendiri. **Pengecualian create**: saat *membuat user* saja, `admin` (full/scoped) boleh memberi role `admin` — batas lembaga ⊆ kewenangan pembuat (boleh subset; scoped tanpa `lembaga_ids` memakai pivot sendiri, sehingga tak bisa melahirkan admin global). Jalur `update`/`assignRole`/`removeRole`/`import` tetap tanpa role `admin`.
- Login multi-identifier `email/phone/username` + `password`, throttle 6/mnt, tulis `login_audits` + `last_login_at`. Buat user hanya oleh admin manual atau Import Excel; register publik tidak dibuka.

### 2.3.x Matriks Izin (Kelola Izin)

Kewenangan terdiri dari dua dimensi yang dikombinasikan (AND):
- **Aksi** — izin `modul.aksi` (`lihat/tambah/ubah/hapus` per modul + izin halaman pseudo `daftar_kelas/pindah_kelas/kenaikan/kelulusan/rekap_santri/mutasi_keluar/tampilan_standar/server/izin`), dikelola super_admin lewat halaman Kelola Izin (matriks checkbox role × izin, simpan per role). Katalog kanonis: `IzinKatalog::MODUL_AKSI` (satu sumber kebenaran untuk seeder, validasi API, dan audit FE).
- **Cakupan data** — pivot `user_lembaga` (`bolehPesantren()`/`canAccessLembaga()`); tidak berubah oleh matriks.

Aturan terkunci:
- Role `super_admin` selalu full (barisnya terkunci di matriks; API menolak `PUT` untuknya) — anti-lockout.
- Halaman Kelola Izin + endpoint `/api/admin/izin` hanya pemilik `izin.*` (= super_admin).
- Portal orang_tua/santri dan grup campuran (`portal/psb/{calon}/dokumen`) tetap role-based (pengecualian terdokumentasi, di luar matriks).
- Aturan struktural tetap di kode (bukan matriks): tambah lembaga, sebar standar tampilan, mutasi target privileged, dan kunci role diri = super_admin saja.
- Halaman baru wajib didaftarkan di katalog + `HALAMAN.permission`; `audit-izin.mjs` (predev/prebuild/pretypecheck) dan test pengerasan route menggagalkan drift.

### 2.4 Asumsi dan Batasan

| ID | Asumsi (kode + nama modul) |
|---|---|
| A1 | Online; API-first Laravel 13 / PHP 8.4+ / MySQL / Sanctum `sanctum` (Modul 001 Inisiasi, 003 Auth Login) |
| A2 | Single-pesantren via `lembaga`; tenant pivot `user_lembaga` saja (Modul 003) |
| A3 | Bahasa Indonesia persis DB: `santri`, `riwayat_belajar`, `tahun_ajaran` (AGENTS) |
| A4 | Data awal Excel per lembaga ke staging lalu verifikasi lalu production; dedup `nik+nama+tgl_lahir` (Modul 101 Santri, 003) |
| A5 | NIK wajib boleh fiktif tanpa flag (Modul 101) |
| A6 | `kurikulum`, `dokumen_wajib_lembaga`, `ref_*` per lembaga; kontak/logo null fallback root, root null placeholder (Modul 004 Referensi-Master, 100 PSB Penerimaan) |
| A7 | FE terpisah Tauri/PySide/RN; Flutter dihentikan; base `API_BASE_URL` fallback `127.0.0.1:8000/api` (Modul 003) |
| A8 | Kapasitas/kinerja ikut Bab 3.2 NFR-01 sampai NFR-07; anggaran Bab 9 |

| ID | Batasan (kode + nama modul) |
|---|---|
| B1 | Migration per-modul per-file (timestamp bawaan, urutan FK); spec di `docs/SCHEMA.md`; file besar single-file lama dihapus (v1.3.1) |
| B2 | Register publik ditutup; buat user hanya admin manual/import (Modul 003) |
| B3 | Guard wajib `sanctum`; throttle login 6/mnt; middleware `permission:` + `authorize` + `canAccessLembaga` wajib (Modul 003) |
| B4 | UNIQUE nullable tidak cegah duplikat NULL MySQL; dedup wajib service (`RefService`, import 101) (Modul 002) |
| B5 | Kolom pemakai `ref_*` string tanpa FK; shadow global hanya `is_active` (Modul 004) |
| B7 | Scope G0-G3 production dulu; G4+ TBD; `500-505`, `900-901` ditutup sementara (Bab 1.4) |

---

## 3. Analisis Kebutuhan

### 3.1 Functional Requirement (G0–G3 detail; pasca persiapan)

| ID                     | Modul (kode + nama)                               | Functional Requirement                                                                                           | Status doc            |
| ---------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------- |
| FR-003                 | 003 Auth Login                                    | Login multi-identifier, 6 peran (efektif 5; `asrama` pasca production, `kasir` dihapus sementara v2.38), import, audit, matriks izin Kelola Izin (super_admin) | Detail (G0)           |
| FR-004                 | 004 Referensi-Master                              | `lembaga`, `tahun_ajaran`, `kelas`, 34 `ref_*` via `RefService`                                                  | Detail (G0)           |
| FR-100                 | 100 PSB Penerimaan Santri                         | 2-jalur via `is_seleksi` + override null ikut default, kuota saat input, waiting_list, paket MI-MD opsional, ACC | Detail (G1+G3 daftar) |
| FR-101                 | 101 Santri Master                                 | `id` stabil; NIK fiktif boleh; dedup; `status_global` turunan (default false); `lembaga_id` boleh NULL (legacy, terlihat semua admin) | Detail (G1)           |
| FR-102                 | 102 Siklus Santri                                 | status_awal/akhir, naik/pindah/mutasi/lulus                                                                      | Detail (G1)           |
| FR-203                 | 203 Portal Wali subset                            | Daftar + pengajuan                                                                                               | Detail (G3)           |
| FR-200, FR-201, FR-202 | 200 Pegawai, 201 Kurikulum-Mapel, 202 Nilai-Rapor | Skema siap, UI belakangan                                                                                        | Persiapan (G5/G7)     |
| FR-505                 | 505 Asrama                                        | Entitas `asrama` (bukan lembaga)+`user_asrama`+peran `asrama`; kamar, penghuni, izin pulang, kegiatan; keuangan menyusul perumusan ulang | Gambaran umum (**pasca production**) |

### 3.2 Non-Functional Requirement

| ID | Non-Functional Requirement |
|---|---|
| NFR-01 | <3 dtk; cache `RefService` 300 dtk |
| NFR-02 | 3.000 santri aktif; `per_page=20` |
| NFR-03 | Bcrypt/argon2, throttle login 6/mnt, `lockForUpdate`, `latest('id')` |
| NFR-04 | Uptime 99%/bulan |
| NFR-05 | Sederhana; `control id snake_case` |
| NFR-06 | API-first; FE Tauri/PySide/RN |
| NFR-07 | Backup harian + rollback |

### 3.3 Use Case

| ID | Actor | Functional Requirement | Modul |
|---|---|---|---|
| UC-G0-01 | `super_admin`, `admin` | Login + kelola `users` (import, audit) | 003 Auth Login |
| UC-G0-00 | `super_admin` | Kelola matriks izin role × modul (Kelola Izin) | 003 Auth Login |
| UC-G0-02 | `super_admin`, `admin` | Kelola `lembaga`, `tahun_ajaran`, `kelas`, `ref_*` | 004 Referensi-Master |
| UC-G1-01 | `admin`, `orang_tua` | PSB daftar, verifikasi, seleksi opsional, ACC + paket MI-MD | 100 PSB Penerimaan |
| UC-G1-02 | `admin` | Kelola `santri` + import dedup | 101 Santri Master |
| UC-G1-03 | `admin` | Naik/pindah/mutasi/lulus (`riwayat_belajar`) | 102 Siklus Santri |
| UC-G3-01 | `orang_tua`, `santri` | Portal daftar + pengajuan | 203 Portal Wali subset |
| UC-Pasca | `guru` + pasca | Pegawai, kurikulum-mapel, nilai-rapor, `500-505` | 200, 201, 202, 500-505 TBD |

---

## 4. Model Proses Bisnis (logika saja)

| ID | Modul (kode + nama) | Aturan | Input, Proses, Output |
|---|---|---|---|
| 4.1 | 100 PSB Penerimaan | Master kegiatan → gelombang (anti-overlap, otomatis saat daftar) → kuota pendaftaran per lembaga; 2-jalur via `lembaga.is_seleksi` (override null ikut default); kuota pool gabungan per kelompok kunci saat input (penuh ke waiting_list); paket MI-MD opsional (1 calon + baris `psb_calon_lembaga`, primer MI, non-asrama) | Input: NIK wajib (fiktif boleh), dokumen wajib per lembaga. Proses: cek-NIK ke daftar ke verifikasi ke seleksi opsional ke pemberkasan ke lengkapi ke ACC tunggal; aksi massal verifikasi/masuk daftar ulang/ACC/undur diri/hapus (soft delete + restore). Output: nomor `PSB_*`, `santri`, `riwayat_belajar` aktif (1 per lembaga) |
| 4.2 | 101 Santri Master (buku induk), 102 Siklus Santri | `santri` = identitas murni + `status_global` (turunan: ada `riwayat_belajar.is_aktif`); keanggotaan per lembaga di `lembaga_santri` (`nis_lokal`, `nis_kemenag` manual, `is_active`, `tgl_mulai`/`tgl_selesai`); `riwayat_belajar` tanpa `nis` (jejak kelas/semester) | Input identitas: ACC PSB, dialog manual, import Excel identitas. Keanggotaan/riwayat: ACC PSB, dialog Riwayat Belajar, import riwayat terpisah (kunci `nik` → fallback `nis_lokal`+lembaga), kenaikan, kelulusan. Proses: salin ganjil→genap; kenaikan massal per-item (kelas menyusul); pindah/set/keluar kelas; mutasi & kelulusan menutup riwayat + keanggotaan (arsip `mutasi_keluar`/`alumni`). Output: `riwayat_belajar`, `lembaga_santri`, `mutasi_keluar`, `alumni` |
| 4.3 | (Dihapus — Modul Keuangan dirumuskan ulang dari awal; lihat entri changelog 2.36) | — | — |
| 4.4 | 203 Portal Wali G3 | Daftar + pengajuan (1 aktif/santri); envelope `pesan/data` | Input: akun `orang_tua` via `wali_santri_relasi`. Proses: list anak ke detail. Output: pengajuan |
| 4.5 | 200 Pegawai, 201 Kurikulum-Mapel, 202 Nilai-Rapor persiapan | Skema siap: `kurikulum`, pivot `kurikulum_mapel` (tingkat/kkm/urutan), `pengampu` 4 lapis, `mode_rapor`, `semester` | Dibangun G5/G7; arsip 201/202 |
| 4.6 | 505 Asrama (gambaran umum v1.10 — **pasca production**) | Asrama entitas sendiri (bukan `lembaga`); pengurus via peran `asrama` + `user_asrama`; kamar & penghuni punya siklus mandiri; daftar per jenjang/JK dari query (bukan kolom); keuangan asrama menyusul perumusan ulang | Input: `asrama` + `asrama_kamar`, penempatan `asrama_penghuni` (kamar menyusul), `asrama_izin_pulang`, `asrama_kegiatan`. Proses: izin pulang diajukan lalu diproses (setujui/tolak), penghuni keluar (tutup baris). Output: daftar penghuni per asrama/jenjang/JK, riwayat izin. Presensi asrama & kegiatan harian detail ditunda (TBD) |

---

## 5. Perancangan Sistem

### 5.1 Arsitektur

```
[Frontend] → [Backend Laravel 13 API (/api, sanctum+role:)] → [MySQL]
Service Layer + Policy + transaction; notifikasi DB agregat.
```

### 5.2 Modul (G0–G3 detail; pasca 1 baris)

| ID | Modul (kode + nama) | Tabel inti | Status |
|---|---|---|---|
| FR-003 | 003 Auth Login | `users`, `user_lembaga`, `user_asrama`, `login_audits`, `permissions`, `role_has_permissions` | Detail |
| FR-004 | 004 Referensi-Master | `lembaga`, `tahun_ajaran`, `kelas`, 34 `ref_*` | Detail |
| FR-100 | 100 PSB Penerimaan | `psb_*`, `dokumen_santri` | Detail |
| FR-101 | 101 Santri Master | `santri` | Detail |
| FR-102 | 102 Siklus Santri | `riwayat_belajar`, `mutasi_keluar`, `alumni` | Detail |
| FR-203 | 203 Portal Wali subset | `wali_*`, `pengajuan_biodata_santri` | Detail G3 |
| FR-200, FR-201, FR-202 | 200 Pegawai, 201 Kurikulum-Mapel, 202 Nilai-Rapor | Lihat arsip | Persiapan |
| FR-505 | 505 Asrama | `asrama`, `asrama_kamar`, `asrama_penghuni`, `asrama_izin_pulang`, `asrama_kegiatan`, `user_asrama` | Gambaran umum (**pasca production**) |

### 5.3 Alur Data Utama (G0–G3)

| ID | Alur | Tahapan |
|---|---|---|
| 5.3.1 | PSB 100 | cek-NIK ke daftar ke verifikasi ke ACC ke `santri+riwayat` |
| 5.3.2 | Siklus 102 | salin ganjil-genap ke naik massal ke penempatan ke mutasi/lulus |
| 5.3.4 | Nilai 202 persiapan | simpan massal ke hitung ke portal (dibangun G5) |
| 5.3.5 | Asrama 505 (gambaran umum) | daftar penghuni ke penempatan kamar ke izin pulang ke proses (setujui/tolak/kembali) |

---

## 6. Perancangan Basis Data (format umum)

> Tipe logis umum, bukan sintaks Laravel. Rincian kolom lengkap di ERD Lampiran A + Modul 002 Skema Database.

| ID | Modul (kode + nama) | Tabel inti | Relasi kunci |
|---|---|---|---|
| 6.1 | 003 Auth Login, 004 Referensi-Master | `lembaga`, 34 `ref_*`, `users`, `user_lembaga`, `tahun_ajaran`, `pegawai`, `kelas` | `lembaga 1—N tahun_ajaran/kelas`; `kelas.walas_id` inline; ref global + shadow lembaga |
| 6.2 | 101 Santri Master, 102 Siklus Santri | `santri`, `riwayat_belajar`, `mutasi_keluar`, `alumni` | `santri 1—N riwayat_belajar`; `riwayat N—1 kelas`; `id` stabil, NIK index tanpa unique; `santri.lembaga_id` nullable (cache, fallback riwayat), `status_global` turunan |
| 6.3 | 100 PSB Penerimaan | `psb_*`, `dokumen_santri` | `calon` ke `santri` saat ACC; dokumen pindah ke santri |
| 6.5 | 200 Pegawai, 201 Kurikulum-Mapel, 202 Nilai-Rapor, 203 Portal Wali | `kurikulum_mapel` pivot, `wali_*`, `pengajuan_biodata_santri` | `kurikulum N—M mapel` via `kurikulum_mapel`; wali via `wali_santri_relasi` |
| 6.6 | 505 Asrama (gambaran umum — **pasca production**) | `asrama`, `asrama_kamar`, `asrama_penghuni`, `asrama_izin_pulang`, `asrama_kegiatan`, `user_asrama` | `asrama 1—N kamar/penghuni/izin/kegiatan`; `santri 1—N penghuni`; pengurus via `user_asrama` (asrama bukan `lembaga`) |

Contoh kamus ringkas:

**`santri`:** `id INT PK`; `nik VARCHAR(16) INDEX nullable` (fiktif boleh, dedup service); `nis VARCHAR(20) nullable` (maks 20 karakter); `status_global BOOLEAN DEFAULT false` (turunan: punya ≥1 riwayat aktif); `lembaga_id INT FK NULL` (legacy tanpa track; cache), `kelas_id INT FK NULL`.
**`riwayat_belajar`:** `status_awal VARCHAR`; `status_akhir VARCHAR`; `is_aktif BOOLEAN` (tulis via service); `semester CHAR(1)`.
**`asrama`:** `id INT PK`; `jenis_kelamin ENUM(L,P)`; `user_asrama(user_id, asrama_id)`; tidak memakai `riwayat_belajar`.

---

## 7. Perancangan Antarmuka

| App | Modul (kode + nama) | Fitur | Kontrak |
|---|---|---|---|
| Desktop Admin G0-G1 | 001-004, 100 PSB Penerimaan, 101 Santri Master, 102 Siklus Santri | CRUD penuh referensi, PSB, santri/siklus | `control id snake_case`, `per_page=20`, tangani 401/403/422/429 |
| Mobile Kasir G2 | DITUNDA — menunggu perumusan ulang modul keuangan | — | Sama |
| Mobile Ortu G3 | 100 daftar, 203 Portal Wali subset | Daftar + ajukan/batal | Sama |
| Pasca TBD | 200 Pegawai, 201 Kurikulum-Mapel, 202 Nilai-Rapor, 500+ | Pegawai, nilai, presensi | TBD |

---

## 8. Implementasi

### 8.1 Tumpukan Terkunci

Laravel 13 / PHP 8.4+, Sanctum (`sanctum`), Spatie (`sanctum`), MySQL, Excel, DomPDF, Service Layer. FE: Tauri/PySide/RN (Flutter dihentikan).

### 8.2 Strategi Migration (per alur, per-modul per-file)

Migration per-modul (timestamp bawaan, urutan FK); spec di `docs/SCHEMA.md` (ditulis ulang dari vault 002). Urutan `lembaga` ke `ref_*` ke `users` (`0001` bawaan) ke `user_lembaga` ke `tahun_ajaran` ke `pegawai` ke `kelas` ke `santri` ke riwayat ke PSB ke lanjutan; blok asrama (`asrama*`, `user_asrama`) menyusul setelah presensi.

| ID | Alur (Bab 4) | Modul | Tabel (BLOK) |
|---|---|---|---|
| 8.2.1 | PSB | 100 PSB Penerimaan | `psb_gelombang`, `psb_kuota_biaya`, `psb_calon_santri`, `dokumen_santri`, `dokumen_wajib_lembaga`, `psb_log_status` |
| 8.2.2 | Santri/Siklus | 101 Santri Master, 102 Siklus Santri | `santri`, `riwayat_belajar`, `mutasi_keluar`, `alumni` |
| 8.2.4 | Akademik/Nilai/Portal | 200, 201, 202, 203 | `kurikulum*`, `pengampu_mapel`, `nilai_santri`, `rapor_catatan_wali`, `wali_*` |
| 8.2.5 | Asrama (gambaran umum — **pasca production**, belum dibuat) | 505 Asrama | `asrama`, `asrama_kamar`, `asrama_penghuni`, `asrama_izin_pulang`, `asrama_kegiatan`, `user_asrama`; perubahan `santri` (lembaga_id nullable, status_global default false — dibahas terpisah) |

### 8.3 Konvensi Kode

| ID | Aturan Kode | Modul |
|---|---|---|
| 8.3.1 | Guard `sanctum` + middleware `permission:` + `canAccessLembaga` / `isAdminFull` | 003 Auth Login |
| 8.3.2 | `DB::transaction` + `lockForUpdate` | 102 |
| 8.3.3 | Key Excel flat; NIK null ke `create()` | 003, 101 |
| 8.3.4 | `latest('id')` | Semua list |

---

## 9. Manajemen Proyek (Hybrid Solo)

**Metode:** Fase-gate + Kanban WIP=1. Fondasi waterfall (`001–004` stabil dulu). Modul tarik 1-1 sesuai dependensi. Siklus 1 minggu: tarik → kerjakan → demo pengurus → done.
```
[001-004] ▶ [100-102] ▶ [200-203 subset] ▶ [UAT]
```

**Roadmap:**

| Gel. | ID-Modul | App | Status |
|---|---|---|---|
| G0 | 001-004 fondasi | Desktop | Production awal |
| G1 | 100 PSB Penerimaan, 101 Santri Master, 102 Siklus Santri | Desktop | Production awal |
| G2 | DITUNDA — menunggu perumusan ulang modul keuangan | — | Ditunda |
| G3 | 100 daftar, 203 Portal Wali subset | Mobile ortu | Production awal |
| G4+ | 200 Pegawai, 201 Kurikulum-Mapel, 202 Nilai-Rapor, 500-505, notif/gateway | Menyusul | Pasca, TBD |

Estimasi solo: G0 3–4 mgg; G1 4–5; G2 2–3; G3 3–4. Total G0–G3 ±4–5 bln.

| Peran | Tanggung jawab (RACI ringkas) |
|---|---|
| `super_admin` | A global |
| `admin` scoped | R lembaganya |
| `guru`, `orang_tua` | R input miliknya |
| Solo dev + QA | R bangun/uji |

| ID | Risiko | Mitigasi (kode) |
|---|---|---|
| R-01 | Tenant bocor | Cek `canAccessLembaga` + TC lintas lembaga (Modul 003) |
| R-03 | Excel berantakan | Bersihkan + staging (Modul 101, 003) |
| R-04 | Kasir non-komputer | Ditunda bersama G2 |
| R-05 | Scope creep | Kunci G0–G3 dulu |

**Aturan bisa berubah:** catat Masalah ke Usulan ke Dampak (skema/API/FE) ke putus (terima/tunda/tolak) ke tulis Lampiran E + naik versi `X.Y.Z`. Ubah UI tanpa ubah API: catat ringan. Ubah logika/skema: wajib analisis dampak paket/tenant/kontrak FE v1 (tambah opsional dulu, jangan breaking).

---

## 10. Rencana Pengujian (fokus G0–G3)

Unit, integrasi (Modul 100 PSB Penerimaan ke 101 Santri Master), sistem, UAT.

| ID | Modul (kode + nama) | Skenario | Harapan |
|---|---|---|---|
| TC-01 | 003 Auth Login | Login + throttle | 200/429 + audit |
| TC-02 | 003 Auth Login | Assign peran | Ditolak bila di luar hak |
| TC-05 | 101 Santri Master | Impor santri | Skip baris gagal |
| TC-06 | 102 Siklus Santri | Naik massal | Partial berhasil/gagal |
| TC-07 | 203 Portal Wali subset | Daftar + pengajuan | 1 aktif/santri |
| TC-08 | 003 Auth Login | Tenant lembaga | 403 lintas lembaga |

---

## 11. Penyebaran dan Migrasi Data

| Tahap | Aktivitas (kode + nama modul) |
|---|---|
| 11.1 | Staging ke production malam hari ke rollback backup (Modul 900 Deploy VPS, 901 Konfigurasi Produksi TBD) |
| 11.2 | Migrasi Excel per lembaga via `SantriLengkapImport` / `UsersImport` ke dedup `nik+nama+tgl_lahir` ke gabung ganda lintas lembaga ke staging ke verifikasi ke production (Modul 101 Santri Master, 003 Auth Login) |

| ID | Checklist |
|---|---|
| C-01 | UAT lulus |
| C-02 | `lembaga` / `tahun_ajaran` / `ref_*` / `kurikulum` terkonfigurasi |
| C-03 | Paket MI-MD terverifikasi |
| C-04 | Akun 5 peran sekarang teruji (peran `asrama` diuji saat Modul 505 / pasca production) |
| C-05 | Training/backup/SSL selesai |

---

## 12. Keamanan Sistem

| ID | Kontrol | Modul |
|---|---|---|
| K-01 | Bcrypt/argon2 | 003 Auth Login |
| K-02 | Guard `sanctum` + middleware `permission:` + tenant `canAccessLembaga` | 003 |
| K-03 | Transaksi terkunci | 102 |
| K-04 | Audit (`login_audits`, `psb_log_status`, `wali_portal_logs`) | 003, 100, 203 |
| K-05 | Backup offsite + SSL; privasi internal | 900/901 TBD |
| K-06 | Izin asrama (v1.10): mengikuti perumusan ulang modul keuangan | 505 |

---

## 13. Pelatihan dan Dokumentasi Pengguna

| Sesi | Peserta | App | Modul + Materi |
|---|---|---|---|
| 1 | `admin` | Desktop | 004, 100, 101, 102: referensi, PSB, santri/siklus |
| 2 | `kasir` | — | DITUNDA — menunggu perumusan ulang modul keuangan |
| 3 | `orang_tua` | Mobile ortu | 100, 203: daftar |

Manual per peran, video pendek, FAQ.

---

## 14. Pemeliharaan dan Dukungan

Garansi 3 bln; respons 1×24 jam. G4+ dibuka setelah G0–G3 stabil production.

---

## Lampiran A — ERD (Sumber Kebenaran)

Diagram Crow's Foot diturunkan dari [[Step-By-Step Sistem Pesantren/Backend/002_Skema_Database|002]] dan diringkas di Bab 6. File visual menyusul; hingga ada, tabel Bab 6 + arsip 002 berlaku dengan interpretasi tipe logis.

## Lampiran B — Matriks Ketertelusuran ke Arsip (read-only)

| ID | Modul (kode + nama) | Arsip |
|---|---|---|
| FR-003 | 003 Auth Login | [[Step-By-Step Sistem Pesantren/Backend/003_Authentication\|003]] |
| FR-004 | 004 Referensi-Master | [[Step-By-Step Sistem Pesantren/Backend/004_Modul Referensi dan Master Data\|004]] |
| FR-100 | 100 PSB Penerimaan | [[Step-By-Step Sistem Pesantren/Backend/100_Modul PSB\|100]] |
| FR-101 | 101 Santri Master | [[Step-By-Step Sistem Pesantren/Backend/101_Modul Santri\|101]] |
| FR-102 | 102 Siklus Santri | [[Step-By-Step Sistem Pesantren/Backend/102_Modul Riwayat Santri\|102]] |
| FR-203 | 203 Portal Wali | [[Step-By-Step Sistem Pesantren/Backend/203_Modul Portal Orang Tua\|203]] |
| FR-200, FR-201, FR-202 | 200 Pegawai, 201 Kurikulum-Mapel, 202 Nilai-Rapor | Persiapan, arsip 200/201/202 |
| TBD-Pasca | 500 Presensi Santri, 501 Presensi Guru, 502 Jadwal, 503 Tahfizh, 504 Pimpinan, 505 Asrama | TBD pasca |
| TBD-Infra | 900 Deploy VPS, 901 Konfigurasi Produksi | TBD infra |
| FE-UI | Frontend LANGKAH UI | `Frontend/admin-flutter-desktop/docs/` |
| DB-002 | Skema DB Bab 6 | [[Step-By-Step Sistem Pesantren/Backend/002_Skema_Database\|002]] |
| KONV | Konvensi Bab 8 | [[Step-By-Step Sistem Pesantren/Backend/AGENTS\|AGENTS]], [[Step-By-Step Sistem Pesantren/Backend/000_Catatan Pembahasan\|000]] |

## Lampiran C — Isu Terbuka / TBD

G4: Modul Guru (pegawai), Dokumen Guru/Santri, Absensi Guru (Modul 501 stub). G5: Laporan Keuangan (menunggu perumusan ulang modul keuangan), Input Nilai tanpa rapor (Modul 202 subset). G6: Statistik Pengurus (Modul 504 ringkas). G7: Absen Santri (500), **Asrama (505 — gambaran umum v1.10: entitas `asrama`+`user_asrama`+peran `asrama`; PASCA PRODUCTION, tidak dikerjakan dalam waktu dekat)**, Tahfizh (503), Rapor (202). G8: Notifikasi, Pengumuman, Gateway, Fingerprint (belum ada). Fase 3–4 cadangan.

TBD khusus asrama (v1.10 — semua pasca production):
- Implementasi asrama tidak dalam waktu dekat; tidak ada tabel/peran/pivot dibuat sekarang.
- Yang perlu dijaga sekarang agar tidak menutup jalan: peran baru cukup ditambah saat itu.
- Perubahan `santri` (`lembaga_id` nullable, `status_global` turunan) **bukan** bagian asrama — **sudah diimplementasikan** (v1.10.2).
- Presensi kegiatan asrama: `sesi_presensi.kategori` sudah ada, tetapi `presensi_santri.kelas_id` masih NOT NULL — perlu penyesuaian skema sebelum dipakai.
- Tarif beda antar-asrama (putra/putri) belum diakomodasi; menunggu perumusan ulang modul keuangan.
- Bentuk tabel kamar/penghuni/izin/kegiatan masih **gambaran umum**, bisa berubah saat implementasi.

## Lampiran D — Glosarium (Opsi A)

SIMPES; santri; lembaga (MI=SD formal, MD=SD non-formal paralel, MTS=SMP, MLN=Aliyah beda nama; kode hardcoded; PK id INT); tahun_ajaran; kelas; pegawai/guru; 6 peran (`super_admin, admin, guru, orang_tua, santri, asrama` — efektif 5 sekarang; `asrama` pasca production, `kasir` dihapus sementara v2.38); PSB (`is_seleksi`); riwayat_belajar; asrama (entitas sendiri — bukan `lembaga`; kamar, penghuni, izin pulang, kegiatan; pasca production); pengurus asrama (peran `asrama` + pivot `user_asrama`); santri legacy (`santri.lembaga_id` NULL, tanpa track riwayat).

## Lampiran E — Catatan Perubahan Aturan

| Tgl | Aturan | Sebelum ke Sesudah | Alasan | Dampak |
|---|---|---|---|---|
| 2026-09-10 | Bab 2.2 poin 1 | Paket wajib ke opsional (MI/MD mandiri boleh) | Fleksibilitas SD | Bab 3 FR-100, Bab 4.1 |
| 2026-09-10 | Bab 2.2 poin 2 | `psb_butuh_seleksi_default` ke `lembaga.is_seleksi`; override null ikut default | Sederhanakan nama | Modul 002, 004, 100; kontrak FE |
| 2026-09-10 | Bab 2.2 poin 3 | `MUA` ke `MLN`; istilah beku ke hardcoded; PK tetap id INT | Samakan singkatan | Seed kode, nomor PSB, filter FE |
| 2026-09-10 | Bab 2.2 poin 4 | Fallback tambah placeholder bila root null | Kop dokumen G0 | Profil lembaga, kuitansi |
| 2026-09-10 | OFF-01 s/d OFF-10 | Online-only ke online-first + SQLite lokal (detail Lampiran F) | PC putus-nyambung | Kontrak FE, API bayar (`client_op_id`), SOP kasir |
| 2026-09-10 | status_awal | `naik_kelas` ke `kenaikan`; ACC dari flag `is_pindahan`; `masuk_tingkat` per jenjang; `tidak_lulus` buka baris mengulang | Putusan domain | 100/102, seeder, tests |
| 2026-09-10 | sesi 2a-2d, 4a | Token per-device; staf 30 hari / murni ortu-santri 365 hari; revokasi saat peran berubah; `logout-all`; prune harian; SQLite tanpa enkripsi (SOP akun OS + kunci layar) | PC admin + HP hilang | AuthController, UserManagement, scheduler, tests |
| 2026-09-11 | kunci role diri | Bebas ubah role sendiri ke 403 semua peran (`update` key `roles` + `assignRole`; `removeRole` sudah 403); admin tetap tak bisa beri `admin/super_admin` | Admin tak bisa naikkan diri; super_admin pun terkunci | UserManagement, tests, FE users |
| 2026-09-11 | auto-attach lembaga | Buat lembaga tanpa auto-akses ke scoped pembuat auto-attach pivot (full/super_admin tidak di-attach) | Lembaga baru langsung bisa dikelola pembuatnya | LembagaController, tests, FE lembaga |
| 2026-09-11 | anti-eskalasi admin | Admin bisa hapus super_admin / tambah role ke super_admin / tambah lembaga ke tutup: mutasi target pemegang `admin/super_admin` (update/assign/remove/attach/detach/destroy) 403 bila actor bukan super_admin; `store` lembaga 403 bila bukan super_admin (gantikan auto-attach v1.9.1) | Hanya super_admin kelola admin & lembaga | UserManagement, LembagaController, tests, FE users/lembaga |
| 2026-09-14 | buat admin oleh admin | Larangan role `admin` dilonggarkan **khusus create**: `admin` (full/scoped) boleh membuat user ber-role `admin`, lembaga ⊆ kewenangannya (boleh subset; scoped tanpa `lembaga_ids` = pivot sendiri, tak bisa jadi admin global). Jalur update/assignRole/removeRole/import tetap dilarang; admin tetap tak bisa memutasi sesama/admin | admin_lembaga bisa menambah admin di lembaganya tanpa menunggu super_admin | UserManagement (`creatableRolesFor`), UserRoleGuardTest, FE users |
| 2026-09-14 | desain santri & asrama (v1.10, gambaran umum) | (1) `santri.lembaga_id` NOT NULL → **nullable** = legacy tanpa track, terlihat **semua admin**, sumber kebenaran lembaga = `riwayat_belajar`; (2) `status_global` default true + hardcode → **turunan murni** default false (= punya ≥1 riwayat aktif); (3) asrama dari flag biaya di lembaga → **entitas sendiri** (bukan `lembaga`) + peran `asrama` (6 → 7 peran) + pivot `user_asrama`, super_admin saja; (4) keuangan asrama ditandai lewat `pos_keuangan.kategori` | Data lama tanpa jejak riwayat/pembayaran perlu hidup tanpa tenant; kepengurusan asrama terpisah dari lembaga | SCHEMA (santri, pos_keuangan, BLOK 11), PRD 2.3/4.2/4.6/6/8.2/12, policy/tenant scope 101, seeder peran, tests |
| 2026-09-14 | lingkup asrama (v1.10.1) | Asrama (505) dipastikan **pasca production** — tidak dikerjakan dalam waktu dekat, tidak ada tabel/peran/pivot sekarang. Poin (1)(2) di atas (santri legacy/status_global) dipisah dari asrama dan dibahas sendiri | Fokus G0–G3 production; desain dicatat agar sistem sekarang mendekati bentuk akhir tanpa menutup jalan | Lampiran C, PRD 1.2/2.3/3.1/4.6/5.2/6.6/8.2.5, SCHEMA BLOK 11 |

## Lampiran F — Keputusan Offline (terkunci v1.4)

Scope: desktop admin + kasir (nanti). Mobile ortu wajib online (tanpa lapisan offline).

| ID | Keputusan |
|---|---|
| OFF-01 | SQLite lokal = replika baca + draft; MySQL server satu-satunya sumber kebenaran; tanpa sync-engine dua-arah |
| OFF-02 | Baca-lokal + sync bertingkat: struktural 60 mnt, kamus 60 mnt full-pull, tarif 30 mnt, santri list 10 mnt (detail live), users 10 mnt full-pull, status transaksi 2 mnt + refresh fokus/pasca-tulis; delta via `updated_since` (endpoint baru, kecil) |
| OFF-03 | Pemicu sync: login penuh (jaminan minimal), interval, tutup best-effort, pasca-tulis, reconnect, manual |
| OFF-04 | Online = live langsung; offline = fallback SQLite + banner + timer dashboard sejak `last_seen_server` + label basi; tulis transaksi mati |
| OFF-05 | Login-offline: verifier perangkat 30 hari, semua peran, password tiap buka, salah 5x kunci 5 mnt, akun baru/PC baru/kedaluwarsa wajib online, revokasi berlaku online-berikutnya |
| OFF-06 | Token: staf 30 hari, murni `orang_tua/santri` 365 hari, nama per-device; auto-login desktop admin+kasir; revokasi saat peran berubah + `logout-all`; prune harian; pencabutan berlaku seketika saat online |
| OFF-07 | Opsi B payment-intent: snapshot-only, nominal fixed, nomor `LOKAL-*` + struk SEMENTARA, 1 pintu, tutup-hari terkunci, dorong per-item via API bayar + `client_op_id`, void/ACC final online-only |
| OFF-08 | Perubahan tarif/pos tulis-hanya-online (pull 30 mnt) |
| OFF-09 | Tanpa merge otomatis: tolak 409 `{kode, alasan, server_state, bisa_aksi[]}`, pilih manual per item + audit pilihan |
| OFF-10 | Validasi server tak berubah (tenant, peran, ref efektif, kuota, kunci billing, counter) |

TBD (tidak dikunci): enkripsi SQLite, bentuk endpoint delta, LAN-fallback, UAT chaos.

## Pembahasan Selanjutnya (sesi baru)

- v1.4 paket offline terkunci. Next: scaffold Tauri / backend 100 (sesuai pilihan).

---

# Part B — Detail Backend (EN, dari backend/docs/PRD.md 2026-09-09)

> Digabung ke root docs per keputusan sesi. File lama `backend/docs/PRD.md` kini pointer.

## Sistem Pesantren — Product Requirements Document (PRD)

> Scope: entire system (backend + all frontends).
> Source of truth for backend behavior: step-by-step build guides in the docs vault
> (`Backend/001`–`004`, `100`–`102`, `200`–`203`; decisions `000` no.1–51).
> Status as of 2026-09-09. Language: English.

### 1. Overview

Sistem Pesantren is an integrated information system for a single pesantren
(Islamic boarding school) that runs several educational units (lembaga:
MI, MD, MTs, Mu'allimin) under one root identity.

Vision: one identity per santri (`santri.id`),
one reference dictionary — serving six operator roles through
purpose-built frontends that all consume a single Laravel API.

Non-goals: multi-pesantren SaaS (explicitly dropped, decision no.40);
web session UI (API-first, token auth only).

### 2. System architecture

```
                        ┌─────────────────────────────┐
                        │  Backend (Laravel 13 API)   │  backend/
                        │  Sanctum tokens, /api/*     │
                        └──────────────┬──────────────┘
           ┌───────────────┬───────────┼───────────┬───────────────┐
           ▼               ▼           ▼           ▼               ▼
   admin-desktop   admin-desktop  kasir      orangtua      pimpinan     guru
   -tauri          -pyside        -mobile    -mobile       -mobile      -mobile
   (Tauri 2)       (PySide6)      (RN)       (RN)          (RN)         (RN)
```

All frontends are separate projects under `frontend/` (never merged):

| App | Folder | Stack | Users |
|---|---|---|---|
| Admin desktop (primary) | `frontend/admin-desktop-tauri` | Tauri 2 | super_admin, admin |
| Admin desktop (alt) | `frontend/admin-desktop-pyside` | PySide6 | super_admin, admin |
| Kasir mobile | `frontend/kasir-mobile-react-native` | React Native | kasir (+admin) |
| Orang tua mobile | `frontend/orangtua-mobile-react-native` | React Native | orang_tua |
| Pimpinan mobile | `frontend/pimpinan-mobile-react-native` | React Native | pimpinan (reads executive aggregates) |
| Guru mobile | `frontend/guru-mobile-react-native` | React Native | guru |

> Note: the legacy Flutter `desktop/` project was deleted 2026-09-09 and is
> superseded by `frontend/*` above. The empty workspace `mobile/` folder is
> unrelated to this layout.

Backend ↔ frontend contract: JSON over HTTPS, `Authorization: Bearer <sanctum>`,
envelope `{pesan, data}` for portal endpoints, standard pagination elsewhere.

### 3. Tech stack

* Backend: Laravel 13 (PHP 8.4+), Sanctum (`guard: sanctum`), Spatie Permission
  (`guard_name: sanctum`), MySQL, Maatwebsite Excel, DomPDF (rapor),
  Service Layer pattern, `DB::transaction()` + `lockForUpdate()` for critical ops.
* Admin Tauri: Tauri 2 + frontend webview (to be decided: React/Vue/Svelte).
* Admin PySide: PySide6 (Qt for Python), desktop offline-tolerant forms.
* Mobile (×4): React Native (shared API client design, separate apps/releases).
* Infra: single VPS deployment (docs `900`–`901`, currently closed).

### 4. Actors & roles

Six roles, hierarchical (decision no.40): `super_admin` → `admin` (full =
no `user_lembaga` pivot; scoped = via pivot) → `guru` →
`orang_tua` / `santri`. Plus `asrama` (pengurus asrama, pivot `user_asrama`,
v1.10; **pasca production** — efektif sekarang 5 peran; `kasir` dihapus
sementara v2.38). One user may hold multiple roles.

* `assignableRolesFor()`: super_admin grants all 6; admin grants
  `guru, orang_tua, santri` (no privilege escalation; `asrama`
  dan `admin` khusus super_admin, kecuali create-admin v1.9.x).
* Aksi vs cakupan (v2.38): *boleh melakukan apa* = izin matriks
  (`IzinKatalog`, `permission:` middleware, policy); *milik lembaga mana* =
  pivot (`User::lembagaIds()`, `canAccessLembaga()`, `isAdminFull()`).
* Tenant choke point: `User::lembagaIds()` (pivot `user_lembaga` only —
  `users` has NO tenant column), `canAccessLembaga()`, `isAdminFull()`.
* Convention (locked): LIST may be wide (all accessible lembaga);
  ACTION is strict AND per-lembaga. Non-admins get empty user lists
  (`whereRaw('1 = 0')`); kasir sees only own lembaga.

### 5. Backend modules

Status legend: ✅ implemented & migrated · 🟡 spec locked, not implemented ·
🔲 closed (kept as draft, opens on demand).

#### Phase 0 — Foundation ✅ (migrated, seeded)

**001 Setup.** Laravel 13 project, `.env`, `auth.php` (`guard: sanctum`).
Status: ✅ project exists.

**002 Database schema.** Per-module migration files (default timestamps, FK order;
spec in `docs/SCHEMA.md`, rewritten from vault single-file spec): `lembaga` (root `kode=PESANTREN` + units via `parent_id`) → 36 `ref_*`
→ `users` (+pivot/audit) → `tahun_ajaran` → `pegawai` → `kelas`
(`walas_id → pegawai` inline) → santri/riwayat → PSB → finance →
HR-academic → grades → presensi → tahfizh → wali portal. ~80 tables.
MySQL 64-char index pitfall: 4 composite uniques use short `uq_*` names.
Status: ✅ `migrate:fresh` green (100 tables incl. framework/package tables).

**003 Authentication & users.** Multi-identifier login (email/phone/username),
throttle + `login_audits`, 6 roles, `UsersImport` (flat keys, intra-file
dedup, `lembaga_ids[]` pivot sync), `UserPolicy`.
API: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`,
`GET|POST /api/admin/users`, `PUT|DELETE /api/admin/users/{user}`,
`POST /api/admin/users/import`, role assign/remove,
`POST|DELETE /api/admin/users/{user}/lembaga` (attach/detach, multi-lembaga).
Status: ✅ 36 routes live.

**Dashboard (ekstra, di luar vault — didokumentasikan v1.3.2).**
`GET /api/dashboard/ringkasan` (`auth:sanctum`, semua peran, scope tenant +
opsional `?lembaga_id=`): hitungan `lembaga/pengguna/tahun_ajaran_aktif/kelas`
+ daftar tahun aktif. Bukan executive dashboard 504. Slot `santri`,
`antrean_psb` = null (placeholder modul lanjutan).

**004 Reference & master data.** 34 kamus tables (global row
`lembaga_id=null` + per-lembaga rows; shadow = on/off only for globals),
`RefService::effective()/kodeAktif()/forget()` (cached), `ReferensiSeeder`
(decision no.51 values), `Lembaga/TahunAjaran/Kelas` CRUD with tenant scope.
API: `GET /api/admin/referensi/types`, `GET|POST /api/admin/referensi/{tipe}`,
`DELETE /api/admin/referensi/{tipe}/{id}`, lembaga/TA/kelas CRUD.
Status: ✅ migrated + seeded (agama 6, tingkat 12, tugas 2, …).

#### Phase 1 — Core operations 🟡 (spec locked, not implemented)

**100 PSB (new-student admission).** Master kegiatan → gelombang (tanggal shared,
anti-overlap, satu kegiatan aktif; tanpa status gelombang — gerbang pendaftaran publik
otomatis murni dari tanggal buka/tutup) → kuota pendaftaran per lembaga. Two flexible
paths via `membutuhkan_seleksi` (direct vs selection); combined pool quota per
`kelompok_psb` (combo khusus MI/MD; pool value on the primary lembaga's
`psb_kuota_biaya` row) + `waiting_list`; MI-MD package (1 calon +
`psb_calon_lembaga` child rows, 1 grouped number `PSB_{tahun}_MIMD_{gel}_{seq}`,
single ACC → 1 santri + 2 riwayat); identity `nik+nama+tgl_lahir`
dedup (NIK may be fictitious); 9 statuses (no `seleksi`); `no_pendaftaran` race →
catch 1062 regenerate (max 3×). Bulk actions admin: verifikasi, seleksi,
ACC, hapus; hapus = soft delete + restore.
Stories: public daftar (+paket) via gelombang yang sedang dibuka (tanggal), admin verify/ACC/hapus,
wali portal lengkapi/ajukan-daftar-ulang, TU verifies `dokumen_santri`. Alur status admin:
`baru` → verifikasi → `terverifikasi` → tombol "Masuk daftar ulang" (lembaga ber-seleksi
meminta konfirmasi lolos/tidak lolos; tidak lolos → `tidak_lolos`) → status `pemberkasan` →
wali ajukan daftar ulang (`ajukan_daftar_ulang`) **atau** admin boleh langsung ACC dari
`pemberkasan` → status `daftar_ulang` + santri dibuat (NIS opsional diisi saat ACC —
tunggal atau massal per calon — dan ikut tersimpan ke `santri.nis` + `riwayat_belajar.nis`;
boleh dikosongkan lalu diisi menyusul lewat import). Pengunduran diri (status
`mengundurkan_diri`, aksi baris + massal) tersedia dari fase terdaftar, daftar ulang, dan
diterima; data lama berstatus `ditolak` dimigrasikan ke `mengundurkan_diri`. Bila calon yang
sudah diterima (santri dibuat lewat ACC) mengundurkan diri, data `santri` + arsip
`riwayat_belajar`-nya dihapus dan calon kembali murni sebagai riwayat PSB. NIS wajib unik (master + arsip);
diisi opsional saat ACC atau menyusul via import/kenaikan. Batalkan fase
(kembali ke status sebelumnya dari log `psb_log_status`, aksi baris + massal) tersedia untuk
semua fase kecuali fase diterima/`daftar_ulang` (santri sudah dibuat).
`butuh_pemberkasan` hanya penanda
lengkapi berkas. Ketentuan dokumen
per kegiatan PSB × lembaga (`dokumen_wajib_lembaga`) bersifat penekanan — tidak menahan
daftar ulang; saat ACC baris checklist dibuat di `dokumen_santri` (boleh ditandai
"tidak memiliki"). Status: ✅ live (fitur tests hijau). Captcha + PDF bukti ditunda.

**101 Santri master.** 74-column EMIS profile; NIK/NISN index-only + service
dedup; `updateOrCreate` only when NIK present (+ intra-file guard);
`status_global` bool (false iff ALL riwayat non-active);
`SantriPolicy` (guru excluded from admin list).
Status: ✅ live (CRUD scoped, import-lengkap, kamus, foto/dokumen; 10 tests).
Tambahan vs vault: mapping import penuh (tanpa drop diam-diam), `uploadFoto`,
`tipe_santri` rule, `kewarganegaraan` default WNI, kolom `kelas_id` menerima
nama kelas/id (dropdown template per lembaga+TA). Recalc `status_global` tetap di 102.

**Preset tampilan kolom tabel (lintas modul).** Combobox di toolbar setiap tabel
(`ExcelTable`) berisi bawaan "Lengkap" + preset buatan user; preset menyimpan
daftar kolom (`preset_tabel.kolom`) per tabel & per lembaga. Saat membuat preset,
user dapat memilih satu atau beberapa lembaga tujuan (multi-generate); tiap lembaga
lalu dapat mengedit salinannya sendiri. Pilihan terakhir per user per tabel diingat
di `preset_tabel_aktif`. Salin TSV mengikuti kolom yang terlihat.
Status: ✅ live.

**Aksi baris tabel (lintas modul).** Bila jumlah tombol aksi baris lebih dari 3,
otomatis diringkas menjadi dropdown (ikon titik-tiga vertikal) berisi seluruh aksi +
labelnya; 1–3 aksi tetap tampil langsung. Berlaku di semua tabel `ExcelTable`.

**102 Santri lifecycle.** `riwayat_belajar` (`status_awal`: santri_baru/
mengulang/pindahan; `status_akhir`: aktif/naik/tidak_naik/pindah_keluar/
lulus/tidak_lulus; `is_aktif` true iff `aktif`; semester 1/2; per-item mass
promotion with `{berhasil, gagal[]}`); graduation via `alumni` (last-wins),
exit via `mutasi_keluar`; package-aware (`nonAktifkanRiwayat`).
Status: ✅ live (8 endpoints, 10 tests). Gerbang AND per-lembaga target
(canAccess + riwayat-aktif). `pindah_keluar` ikut seeder no.51; `tidak_lulus`
buka baris mengulang tapel-berikut (tanpa alumni).

#### Phase 2 — Academic 🟡 (spec locked, not implemented)

**200 Personnel.** Global `pegawai` master (+11 EMIS cols), multi-lembaga via
`keaktifan_pegawai`, `tugas_utama` kamus, one-to-one `pegawai_sertifikasi`
(auto-sync flag), `keluarga_pegawai`, `pegawai_dokumen`, manual account link
(full-admin only), `setWalas()` 3-layer validation (FE filters active keaktifan).
Status: 🟡 `pegawai` table exists; service/policy pending.

**201 Curriculum & subjects.** `kurikulum` per lembaga, `kurikulum_mapel`
(explicit mapel + `tingkat` null=all + `kkm` null=manual + `urutan`),
`kelas_kurikulum` dual pivot, `tunjukPengampu` 4-layer validation;
class members read from `riwayat_belajar` (no `kelas_santri` table).
Status: 🟡 tables exist; service/policy pending.

**202 Grades & rapor.** Centralized mass input (admin/pengampu/wali, per-item
partial `{berhasil, gagal[]}`), `akhir=(formatif+sumatif)/2`, fixed predicates
A90/B80/C70/D (KKM = archive), `keputusan_kenaikan`, PDF rapor
(terpisah/digabung views).
Status: 🟡 tables exist; `PenilaianService` pending.

**203 Parent portal.** Read-only aggregator (dashboard, bill summary) +
biodata proposals (1 active/santri, cancellable) via `PengajuanBiodataService`
(100); `wali_santri_relasi` + `wali_portal_logs`; `SantriPolicy::view` +
`{pesan, data}` envelope.
Status: 🟡 tables exist; portal service/controller pending.

#### Phase 5 + Infra 🔲 (closed drafts, open on demand)

`500` presensi santri · `501` presensi staff (stub) · `502` jadwal (slot,
conflict validation) · `503` tahfizh (ziyadah/murajaah) · `504` pimpinan
dashboard · `900` VPS deploy · `901` production config. Small tenant gates
already merged; full specs untouched until reactivated.

### 6. Frontend apps (scope per app)

All apps: Sanctum token login (identifier + password), secure token storage,
tenant-aware lists (filter by accessible `lembaga`), Indonesian UI.

#### 6.1 `frontend/admin-desktop-tauri` (primary admin)

Users: super_admin, admin. Full CRUD: users/roles, lembaga, tahun ajaran,
kelas (+`setWalas` picker from active keaktifan), 34 kamus (global vs lembaga
views), plus (when backend lands): PSB antrean (verify/ACC/tolak,
paket ops), santri master + import, siklus (naik/pindah/mutasi/lulus),
pegawai + keaktifan/sertifikasi,
kurikulum/mapel/pengampu, nilai massal + rapor print, wali proposals approval.
Status: 🟢 shell v0.5.0 live (Tailwind+shadcn: 20 tema ala VSCode data-driven + kustom, Gelap/Terang/Sistem per perangkat, galeri pratinjau, border lembut tanpa shadow, sidebar rail + Ctrl/Cmd+B, pagination, dialog/toast/skeleton). Tabel master memakai `react-datasheet-grid` lewat wrapper `ExcelTable` (seleksi gaya spreadsheet, resize + AutoFit, edit klik-2× langsung simpan) dengan kontrol global ukuran/tinggi/jenis huruf; **Google Fonts disimpan lokal di repo** (`src/assets/fonts`, 8 keluarga × Light/Regular) sehingga aplikasi berjalan **tanpa internet** — dihasilkan ulang via `scripts/fonts-offline.py`. Desktop Tauri 0.5.0 dibangun (`.app` 11 MB, `.dmg` 4 MB, aarch64, belum ditandatangani); build desktop hanya dijalankan bila diminta. Siklus santri (102) sudah live di UI: roster + salin genap + kenaikan/pindah/mutasi/lulus. Belum: modul 200+ (pegawai/kurikulum/nilai), Fase 5, portal ortu lanjutan.

#### 6.2 `frontend/admin-desktop-pyside` (alternate admin)

Same scope as 6.1 (feature parity target), PySide6 implementation for
environments preferring Qt/Python (bulk Excel import, PDF printing).
Status: 🔲 not scaffolded.

#### 6.3 `frontend/kasir-mobile-react-native`

Users: kasir (+admin). Scope: DITUNDA — menunggu perumusan ulang modul keuangan dari awal.
Offline: queue-and-sync for payments is OUT (online only, race safety).
Status: 🔲 not scaffolded.

#### 6.4 `frontend/orangtua-mobile-react-native`

Users: orang_tua. Scope (203): children list → detail (profil, kelas,
nilai/rapor, presensi poin, tahfizh rekap), ajukan/batalkan
biodata edits (whitelist fields, NIK needs full-admin), PSB lanjutan for
registered NIK, document upload status. Read-only except proposals/uploads.
Status: 🔲 not scaffolded (backend 203 pending).

#### 6.5 `frontend/pimpinan-mobile-react-native`

Users: pimpinan. This is NOT an admin app — it is a read-only statistics app
for strategic decisions. Scope (504): total santri keseluruhan, santri per
lembaga, enrollment per gelombang, jumlah guru, kehadiran guru, keuangan
(menunggu perumusan ulang modul), kehadiran santri, tahfizh
progress, alumni/mutasi counts. No mutations whatsoever.
Status: 🔲 not scaffolded (backend 504 closed).

#### 6.6 `frontend/guru-mobile-react-native`

Users: guru. Scope: my classes (walas + pengampu), anggota kelas
(from active riwayat), nilai input per pengampu (massal per-item),
catatan wali, presensi sesi (when 500 opens), jadwal mengajar (when 502
opens), setoran tahfizh input (when 503 opens).
Status: 🔲 not scaffolded (backend 201/202 pending).

### 7. Data model summary

* Tenant: `lembaga` tree (`parent_id`, root `kode=PESANTREN`); `user_lembaga`
  pivot is the ONLY tenant store.
* Kamus pattern: consumer columns are free strings (no FK); `ref_*` tables
  provide suggestions via `RefService::effective(tipe, lembagaId)`; global
  rows shadowable on/off per lembaga.
* Identity: `santri.id` stable; NIK attribute (required, may be fictitious),
  dedup `nik+nama+tgl_lahir`.
* Lifecycle: `riwayat_belajar.is_aktif` (iff `status_akhir='aktif'`);
  `santri.status_global` recalculated; graduation/exit in `alumni` /
  `mutasi_keluar`, never on santri.

### 8. API conventions

* Prefix `/api`, `auth:sanctum` + `role:` middleware; admin group
  `role:super_admin|admin`; portal group `role:orang_tua`.
* Service layer (thin controllers); policies per model; `latest('id')`;
  Excel imports use flat keys; NIK-null uses `create()`.
* See live contract: `php artisan route:list --path=api` (36 routes).

### 9. Non-functional requirements

* Concurrency: `lockForUpdate` on kuota/nomor/riwayat;
  1062 retry (max 3–4) with re-read.
* Security: Sanctum tokens, throttle login (6/min) + `login_audits`,
  no privilege escalation (`assignableRolesFor`), tenant AND-checks on writes.
* Data: `migrate:fresh` allowed pre-production (no backfill); seeds via
  `ReferensiSeeder` (no.51) + `RoleSeeder` (6 roles).
* MySQL: index names ≤64 chars (`uq_*` short names); multi-NULL uniques
  guarded in service, not relied on.

### 10. Implementation status matrix

| Area | Spec | Migrated | Seeded | API live |
|---|---|---|---|---|
| 001 setup | ✅ | n/a | n/a | n/a |
| 002 schema (~80 tables) | ✅ | ✅ | n/a | n/a |
| 003 auth/users | ✅ | ✅ | ✅ roles | ✅ |
| 004 ref/master (34 kamus, lembaga/TA/kelas) | ✅ | ✅ | ✅ no.51 | ✅ |
| 100 PSB full (daftar, paket, verify/ACC, portal, dokumen, import) | ✅ | ✅ | — | ✅ (69 routes, 10 tests) |
| 101 Santri (CRUD, import, kamus, policy) | ✅ | ✅ | — | ✅ (10 tests) |
| 102 Siklus (salin genap, naik, pindah, mutasi, lulus, roster + arsip) | ✅ | ✅ | — | ✅ (14 tests) |
| 200/201/202/203 | ✅ specs | ✅ tables | — | 🔲 |
| Fase 5 (500–505), infra (900–901) | 🔲 drafts | ✅ tables | — | 🔲 |
| 6 frontend apps | §6 above | n/a | n/a | 🔲 |

### 11. Roadmap

1. Backend services in vault order: 100 → 101 → 102 → 200 → 201 → 202 → 203 (each: service + policy + controller + tests).
2. Scaffold `admin-desktop-tauri` auth/users shell against live 003/004 APIs.
3. Scaffold remaining frontends as their backend slices land.
4. Reactivate Fase 5 + infra when core is live.
5. Harden: load test, audit logs review, backup/restore runbook.

### 12. Out of scope

Multi-pesantren SaaS, web-session UI, offline payment queueing, payroll,
SMS gateway (notifications are in-app +
aggregate badge, free tier).

### 13. Glossary

santri (student) · lembaga (unit: MI/MD/MTs/Mu'allimin) · tahun ajaran
(academic year) · rombel/kelas (class) · wali (guardian/parent user) ·
walas (homeroom teacher, `kelas.walas_id → pegawai`) · PSB (admission) ·
Daftar ulang (re-enrollment) · Rapor (report card) ·
Tahfizh (Qur'an memorization: ziyadah/murajaah) · KBM (teaching activity).
