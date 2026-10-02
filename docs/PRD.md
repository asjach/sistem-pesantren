# Part A — Dokumentasi Proyek (ID) — Sistem Informasi Manajemen Pesantren (SIMPES)

| Atribut | Keterangan |
|---|---|
| Versi Dokumen | 2.74 (header KAPITAL) |
| Tanggal | 18 September 2026 |
| Status | PRD produk SIMPES — acuan tunggal kebutuhan, rancangan, dan status implementasi aplikasi yang sedang dibangun |
| Penyusun | Solo dev + Yayasan |
| Skema versi | Major restruktur = X.0; final 1 bab = X.Y; kecil docs = X.Y.Z |

> **Konvensi.** Bahasa Indonesia persis DB. Logika saja, tanpa kode mentah, format kode + nama modul. Tanpa asumsi umum. Aturan bisa berubah via Lampiran E. Penulisan Bab 3 (tanpa simbol paragraf).

<!-- Konvensi changelog: urut menaik (terlama di atas); entri baru selalu ditambahkan di BAWAH. -->

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 2026-09-10 | Baseline restrukturisasi; arsip dibekukan; G0–G3 production |
| 1.1 | 2026-09-10 | Final Bab 2–7 (ID-Modul, FR/NFR, UC, asumsi/batasan) |
| 1.1.1 | 2026-09-10 | Bab 8 ke tabel ID-Modul (kecil docs) |
| 1.1.2 | 2026-09-10 | Bab 9 ke tabel + perbaiki RACI admin (kecil docs) |
| 1.1.3 | 2026-09-10 | Bab 10 pisah Modul + sisip TC-07 portal (kecil docs) |
| 1.1.4 | 2026-09-10 | Bab 11-14 + Lampiran B ke tabel, perbaiki admin (kecil docs) |
| 1.2 | 2026-09-10 | Verifikasi Lampiran A-E; perbaiki TBD (minor) |
| 1.3 | 2026-09-10 | Pindah ke root docs/PRD.md + gabung PRD backend (minor) |
| 1.3.1 | 2026-09-10 | SCHEMA.md baru + migrasi per-modul, hapus single-file (patch) |
| 1.3.2 | 2026-09-10 | attach/detach lembaga, 3 bug referensi, dashboard, .env MySQL (patch) |
| 1.4 | 2026-09-10 | Kunci paket offline OFF-01–OFF-10 (minor) |
| 1.5 | 2026-09-10 | Modul 100 PSB live (69 route, 10 test); is_seleksi ganti default (minor) |
| 1.6 | 2026-09-10 | Modul 101 Santri live (policy, kamus, import, CRUD); suite 22/22 (minor) |
| 1.7 | 2026-09-10 | Modul 102 Siklus live (service + 8 endpoint); suite 31/31 (minor) |
| 1.7.1 | 2026-09-10 | status_awal final; tidak_lulus buka mengulang (patch) |
| 1.8 | 2026-09-10 | Sesi: token per-device, 30/365 hari, revokasi, logout-all, prune (minor) |
| 1.9 | 2026-09-10 | Modul 103 transaksi live; suite 49/49 (minor; modul dihapus di 2.36) |
| 1.9.1 | 2026-09-11 | Kunci role diri + auto-attach lembaga; suite 57/57 (patch) |
| 1.9.2 | 2026-09-11 | Anti-eskalasi admin; tambah lembaga hanya super_admin; suite 61/61 (patch) |
| 1.9.3 | 2026-09-11 | Desktop Tauri asli (.app/.dmg macOS jalan); CI Win/Linux tunda (patch) |
| 1.9.4 | 2026-09-11 | Design overhaul FE v0.4.0 (token, komponen, responsif) (patch) |
| 1.9.5 | 2026-09-11 | Pause desktop: hapus target ±1 GB; coba web-only (patch, docs-only) |
| 1.9.6 | 2026-09-11 | FE v0.5.0 Tailwind v4 + shadcn: 20 tema, grid Excel, modal, pagination (patch) |
| 1.9.7 | 2026-09-11 | Tabel ke react-datasheet-grid (ExcelTable): seleksi spreadsheet, AutoFit, font offline (patch) |
| 1.10 | 2026-09-14 | Desain santri legacy + status_global + asrama (docs-only; asrama TBD) |
| 1.10.1 | 2026-09-14 | Asrama (505) = pasca production (docs-only) |
| 1.10.2 | 2026-09-14 | legacy nullable + status_global turunan + backfill; suite 113/113 |
| 1.10.3 | 2026-09-14 | Input manual + template Excel santri; suite 116/116 |
| 1.10.4 | 2026-09-14 | Import 2 langkah (periksa dry-run); suite 117/117 |
| 1.10.5 | 2026-09-14 | Template bergaya (wajib/opsional, dropdown live RefService); suite 119/119 |
| 1.10.6 | 2026-09-14 | Fix panah dropdown OOXML; suite 119/119 |
| 1.10.7 | 2026-09-14 | Urut kamus seragam; label → nama; suite 120/120 |
| 1.11 | 2026-09-15 | UI Siklus desktop (6 view + dialog + aksi massal); suite 122/122 |
| 1.12 | 2026-09-15 | TA milik lembaga operasional; portal PSB terverifikasi; suite 131/131 |
| 1.13 | 2026-09-15 | Kelas unik per lembaga+TA (dedupe + tangkap 1062); test 6→10 |
| 1.14 | 2026-09-15 | NIS maks 20 karakter (kolom + validasi + FE) |
| 1.15 | 2026-09-15 | kelas_id terima nama kelas + dropdown template |
| 2.0 | 2026-09-15 | Rombak santri: buku induk murni + lembaga_santri + 3 service; 8 halaman FE; suite 147/147 |
| 2.1 | 2026-09-16 | Ukuran huruf sel vs header dipisah (header mandiri 11 px) |
| 2.2 | 2026-09-16 | Baris per halaman 10–1000, bawaan 50 |
| 2.3 | 2026-09-16 | Opsi "Semua" (per_page=0); suite 148/148 |
| 2.4 | 2026-09-16 | Navigasi ke sidebar rail; ribbon jadi judul + tools (FE) |
| 2.5 | 2026-09-16 | Tombol tampil/sembunyi baris tools (per perangkat) |
| 2.6 | 2026-09-16 | Slot tools per halaman (Server, PSB) |
| 2.7 | 2026-09-16 | Baris tools membungkus, tanpa scroll horizontal |
| 2.8 | 2026-09-16 | Tab tools halaman vs tabel di ribbon |
| 2.9 | 2026-09-16 | Grup "Tabel" → "Mode"; Salin/Reset keluar ribbon |
| 2.10 | 2026-09-16 | Label grup ribbon pindah ke atas |
| 2.11 | 2026-09-16 | Jarak label grup + padding baris tools |
| 2.12 | 2026-09-16 | AutoFit pindah ke context menu header |
| 2.13 | 2026-09-16 | Stepper vertikal khusus tinggi baris |
| 2.14 | 2026-09-16 | Tinggi seragam grup Baris (h-6) |
| 2.15 | 2026-09-16 | Fix tombol kerapatan terpotong + lebar tetap |
| 2.16 | 2026-09-16 | Pemisah penuh + padding antar grup |
| 2.17 | 2026-09-16 | Grup "Font & Warna" gabungan (grid Header/Cell) |
| 2.18 | 2026-09-16 | Tombol reset ukuran huruf sel |
| 2.19 | 2026-09-16 | Tombol reset selalu tampil (disabled bila tak berlaku) |
| 2.20 | 2026-09-16 | Label Font Size center atas stepper |
| 2.21 | 2026-09-16 | Default huruf sel 11 px global |
| 2.22 | 2026-09-16 | Tinggi Header pindah ke grup KOLOM |
| 2.23 | 2026-09-16 | Ikon kerapatan baris (tombol ikon saja) |
| 2.24 | 2026-09-16 | Ikon ikut warna aksen tema |
| 2.25 | 2026-09-16 | Font bawaan tabel Roboto Light |
| 2.26 | 2026-09-16 | Fix reset ukuran sel tidak bertahan |
| 2.27 | 2026-09-16 | Default font sel di Tampilan = Roboto 11 px |
| 2.28 | 2026-09-16 | Sinkron font ribbon ↔ Tampilan (satu sumber) |
| 2.29 | 2026-09-16 | Migrasi pref huruf lama ke tabel_sel |
| 2.30 | 2026-09-16 | Brand disembunyikan saat sidebar dilipat |
| 2.31 | 2026-09-16 | Garis bawah header saat tabel kosong |
| 2.32 | 2026-09-16 | Tinggi tabel kompak ikut header multibaris; tanpa scrollbar |
| 2.33 | 2026-09-16 | Throttle dilepas di APP_ENV=local |
| 2.34 | 2026-09-16 | AutoFit select pakai label; 0 sel terpotong |
| 2.35 | 2026-09-16 | Label Kolom di samping stepper |
| 2.36 | 2026-09-16 | Hapus total modul keuangan (21 file BE + 3 halaman FE) |
| 2.37 | 2026-09-16 | Hapus sisa keuangan PSB (flag paid, nominal, tabel biaya) |
| 2.38 | 2026-09-17 | Matriks izin Kelola Izin; role kasir dihapus; suite 155/155 |
| 2.39 | 2026-09-17 | Import gabungan santri+keanggotaan (4 lapis, kode_lembaga); suite 166/166 |
| 2.40 | 2026-09-17 | Import tahan ketikan manual; NISN digits:10; suite 167/167 |
| 2.41 | 2026-09-17 | Unduh existing fleksibel (semua lingkup, auto-kunci); suite 168/168 |
| 2.42 | 2026-09-17 | Import satu pintu (terima identitas murni); suite 169/169 |
| 2.43 | 2026-09-17 | Existing multi-pilih lembaga; suite 169/169 |
| 2.44 | 2026-09-17 | Samakan NIS MI↔MD dua arah; suite 173/173 |
| 2.45 | 2026-09-17 | Import nama kelas MI↔MD; suite 176/176 |
| 2.46 | 2026-09-17 | Export nama kelas; suite 178/178 |
| 2.47 | 2026-09-17 | Tombol Ambil/Copy nama kelas; suite 179/179 |
| 2.48 | 2026-09-17 | Halaman MI-MD (3 panel, samakan kelas, pair-exception); suite 182/182 |
| 2.49 | 2026-09-17 | Panah daftarkan MI Only → MD; suite 183/183 |
| 2.50 | 2026-09-17 | X hapus fisik jejak MD; suite 185/185 |
| 2.51 | 2026-09-17 | PRD catat semua aturan (docs-only) |
| 2.52 | 2026-09-17 | Beku kelas arsip (kelas_lulus_id + auto kelas_terakhir_id); suite 186/186 |
| 2.53 | 2026-09-17 | §7 dokumentasi desain UI (docs-only) |
| 2.54 | 2026-09-17 | Lampiran G operasional agen (docs-only) |
| 2.55 | 2026-09-17 | PRD sebagai dasar proyek (docs-only) |
| 2.56 | 2026-09-17 | Pecah PRD jadi 4 file tanpa ubah isi (docs-only) |
| 2.57 | 2026-09-17 | Lepas referensi arsip (docs-only) |
| 2.58 | 2026-09-17 | Hapus halaman Tampilan Standar + kunci sebar super_admin |
| 2.59 | 2026-09-17 | Detail lembaga lengkap |
| 2.60 | 2026-09-17 | Halaman Keanggotaan terpusat (/keanggotaan) |
| 2.61 | 2026-09-17 | Pengecualian pasangan MI-MD global timbal-balik |
| 2.62 | 2026-09-17 | Urut header tabel (klik = tunggal, Shift+Klik = multi maks 3) |
| 2.63 | 2026-09-17 | Urut header ke semua tabel daftar via trait UrutDaftar |
| 2.64 | 2026-09-17 | Default urut santri = JK lalu Nama |
| 2.65 | 2026-09-17 | Urut pindah ke dropdown toolbar + item gabungan |
| 2.66 | 2026-09-17 | Nama header kustom via preset |
| 2.67 | 2026-09-17 | Label bawaan semua header grid = nama kolom database |
| 2.68 | 2026-09-17 | Halaman Kamus Label: acuan global per tabel.kolom |
| 2.69 | 2026-09-17 | Kamus Label: pilihan tabel + kolom otomatis dari skema database |
| 2.70 | 2026-09-17 | Kamus Label: dropdown Tabel + satu baris per kolom (auto-save POST/PUT + Reset); fitur `urut_bawaan` dihapus |
| 2.71 | 2026-09-18 | Status Mode Edit/Input jadi bilah di bawah tabel; Esc sekali keluar mode |
| 2.72 | 2026-09-18 | Kamus Label: tombol generate label massal (upper/proper/lower) + dropdown tabel ber-search + ikon align & switch kolom |
| 2.73 | 2026-09-18 | Urutan pindah ke Preset Urut global per tabel (`urut_preset`): dialog "Kelola urutan" memilih kode sah dari `UrutKatalog`, atur label/arah/opsi bawaan; seed dari opsi lama; halaman tak lagi hardcode `opsiUrut`; `bisa_urut` & `arah_bawaan` di-drop dari kamus label; izin `urut_preset.*`; suite 233/233, typecheck + build lolos |
| 2.74 | 2026-09-18 | Semua header grid tampil KAPITAL (underscore→spasi; placeholder `tabel.kolom` dipangkas jadi nama kolom) — nilai kamus/preset tersimpan tak berubah, hanya tampilan; Opsi A label beda akhiran untuk 3 kolom tabrakan (`NAMA INDUK`, `KELAS MI`, `KELAS MD`) |
| 2.75 | 2026-09-22 | Refactor lembaga berjenjang: PK `jenjang` (tanpa `kode`/`parent_id`/root); import/template/data siswa pakai kunci `jenjang`; suite 273/273 |
| 2.76 | 2026-09-22 | Import dipindah ke halaman Santri Per Lembaga; keanggotaan wajib (santri minimal 1 jenjang) di import & tambah manual; endpoint import identitas-only dihapus; suite 268/268 |
| 2.77 | 2026-09-22 | Tombol aksi toolbar diringkas jadi satu menu dropdown (`MenuAksiToolbar`) di semua halaman |
| 2.78 | 2026-09-22 | Urutan kolom per preset: `preset_tabel.kolom` jadi berurutan & dihormati grid; Tab Kolom 3 panel (preset / kolom tersedia / kolom terpilih yang bisa diseret); seret kolom di grid menyimpan ke preset aktif; tanpa preset tetap pakai urutan global `toolbar_preset.urutan` |
| 2.79 | 2026-09-22 | Halaman Santri Per Lembaga menampilkan seluruh identitas santri (mirror Buku Induk) dulu lalu keanggotaan; identitas bisa diedit dari grid (PATCH santri); endpoint `lembaga-santri` memuat penuh kolom profil; preset bawaan `ringkas` (seeder); suite 268/268 |
| 2.80 | 2026-09-22 | Import gabungan: `tahaj_masuk` (+`tingkat_masuk`) otomatis membuat riwayat belajar perdana (semester 1) via `PenerimaanService::terima`; dilewati bila riwayat aktif sudah ada atau keanggotaan nonaktif; TA tak dikenal menolak baris; ringkasan `baris_riwayat_dibuat`; suite 271/271 |
| 2.81 | 2026-09-22 | Import tahan file besar: baca per chunk 500 baris (state lintas chunk di properti; nomor baris global; transaksi per chunk), cek heading baca-data-saja; perbaiki OOM `memory_limit` pada xlsx ±2000 baris; suite 273/273 |
| 2.82 | 2026-09-23 | Import tahan data nyata: normalisasi `tahaj_masuk` strip→slash (`1998-1999`→`1998/1999`) & tanggal nol Excel (`1900-01-00`)→null; rule panjang kolom DB (nik/ayah/ibu/wali, nis, npsn/nss, no_urut digit) agar gagal per baris bukan 500; penomoran baris Excel-absolut selaras validator; jaring `QueryException` per baris; suite 274/274 |
| 2.83 | 2026-09-23 | `lembaga_santri.no_urut` jadi string(20) — menerima sufiks huruf (`706x`) untuk data ganda historis yang tercatat di ijazah; request/import/frontend longgar; suite 274/274 |
| 2.84 | 2026-09-23 | NIK/`no_kk` longgar + flag `X-`: digit bukan 16 tidak ditolak, tersimpan berawalan `X-` (mutator model + lookup sadar-flag, kolom DB 20); `nis_kemenag` bebas duplikat (lepas unique + cek dipakai); MD abaikan `nis_kemenag` (null via hook; generate 422); batas eksekusi import 300 dtk; suite 277/277 |
| 2.85 | 2026-09-23 | Riwayat perdana untuk semua baris import valid (bukan hanya keanggotaan aktif): `terima()` mengaktifkan ulang keanggotaan nonaktif bila perlu; baris eksplisit `is_active_lembaga=Tidak` tetap dilewati; suite 279/279 |
| 2.86 | 2026-09-23 | Halaman Riwayat Belajar awal TA: kiri = riwayat tanpa kelas (filter tingkat, panah set-kelas), kanan = riwayat berkelas (filter dengan_kelas + tingkat + kelas, aksi keluar-kelas); ACC PSB ikut buat perdana tanpa kelas; suite 280/280 |
| 2.87 | 2026-09-23 | Import file kelas multi-lembaga + multi-TA (template + Periksa + Import, duplikat dilewati, izin per baris mengikuti akun) + tombol di halaman Kelas; suite 286/286 |
| 2.88 | 2026-09-23 | Field `kelas.nama_alias` (opsional, maks 50): migrasi + CRUD + grid/dialog Tambah-Ubah + template/import file; suite 286/286 |
| 2.89 | 2026-09-23 | Wali kelas inline (`kelas.walas_id`): model Pegawai/KeaktifanPegawai + endpoint set-walas & daftar aktif (validasi 3 lapis) + kolom `walas` di import + kolom grid & dropdown Ubah; suite 290/290 |
| 2.90 | 2026-09-23 | Kode warna header template Excel (kuning = wajib, biru = opsional): dilengkapi untuk template kelas + PSB, dikunci tes untuk 4 template; suite 291/291 |
| 2.91 | 2026-09-23 | Fix TA grid kelas "[object Object]": lepas eager `tahunAjaran` di index (kunci relasi yang di-snake Laravel menimpa atribut string); FK string dipakai langsung; suite 291/291 |
| 2.92 | 2026-09-23 | Import kelas upsert: nama cocok → update kolom terisi (kosong = pertahankan), nama baru → dibuat; ringkasan diperbarui; suite 292/292 |
| 2.93 | 2026-09-23 | Import riwayat insert+update: upsert per kunci (update hanya sel terisi), izin per baris mengikuti akun, ringkasan dibuat/diperbarui + dialog; suite 294/294 |
| 2.94 | 2026-09-23 | Halaman Pindah Semester (ganjil→genap, nav di bawah Riwayat Belajar): kiri = ganjil tanpa genap (panah/massal salin, filter tingkat+kelas), kanan = semester 2; endpoint belum-genap; suite 295/295 |
| 2.95 | 2026-09-23 | Status salin semester: ganjil arsip tetap 'aktif', genap dibuka 'lanjutan' (kode kamus baru); suite 296/296 |
| 2.96 | 2026-09-23 | Batal salin semester: endpoint + aksi per baris/massal di panel kanan Pindah Semester (genap dihapus, ganjil dibuka); suite 298/298 |
| 2.97 | 2026-09-23 | Syarat pindah semester: hanya ganjil yang sudah berkelas (genap mewarisi kelas otomatis); suite 298/298 |
| 2.98 | 2026-09-23 | Template riwayat pakai `nama_kelas` (bukan `kelas_id`); import terima dua heading (nama dulu, fallback id); suite 299/299 |
| 2.99 | 2026-09-23 | Import arsip mutasi keluar (template/periksa/import, tombol di panel arsip): kunci NIK→NIS lokal, kelas cukup nama (+TA bila ganda), baris sama dilewati, efek tiru tombol Mutasi; suite 305/305 |
| 2.100 | 2026-09-23 | Import riwayat tanpa NIK: kunci `nis_lokal` + `jenjang` (template, validasi, pencocokan, dialog, tes); suite 305/305 |
| 2.101 | 2026-09-23 | Status tampil Proper Case di grid/dialog (`Santri Baru`); template dropdown ikut label, import petakan label→kode (kode lama tetap jalan); suite 306/306 |
| 2.102 | 2026-09-23 | Perbaiki import riwayat untuk arsip keanggotaan sendiri: baris aktif mengaktifkan ulang (pola terima), baris arsip tak membangunkan, bentrok NIS kecualikan milik sendiri; suite 308/308 |
| 2.103 | 2026-09-23 | Import riwayat siap file historis 34 rb baris: serial tanggal General→Y-m-d, alias status (`Naik Kelas`, `Keluar`), fallback NIS pasangan MI↔MD, tanpa cek unik no_absen, nomor galat absolut; verifikasi periksa nyata 34.844/34.868 valid; suite 310/310 |
| 2.104 | 2026-09-23 | Import riwayat bertahap: service per-baris reusable (mode kering), endpoint potong + sesi + CSV galat, dialog SheetJS 2000 baris/panggilan + progress; verifikasi potong nyata 34.868 baris; suite 315/315 |
| 2.105 | 2026-09-23 | Perbaiki corrupt NIS berurutan: cocok via pasangan tak menimpa NIS target (kasus NIS beda antar-tahun); verifikasi file 34.868 baris; suite 316/316 |
| 2.106 | 2026-09-23 | Masuk-lagi-setelah-keluar = periode baru: arsip nonaktif + NIS beda → baris keanggotaan baru (bukan timpa NIS); bentrok NIS santri-scoped; repair SALSYA + 20 riwayat; suite 319/319 |
| 2.107 | 2026-09-23 | Kriteria cocok import santri disederhanakan: santri_id eksak → nis+jenjang (cocok triple NIK dihapus; NIK hanya disimpan); suite 319/319 |
| 2.108 | 2026-09-23 | Import santri bertahap 1000 baris/potongan (SantriImporService + sesi tipe santri + dialog terpisah; endpoint upload utuh dihapus); riwayat 2000→1000/potongan; kolom riwayat_dibuat di import_sesi; suite 322/322 |
| 2.109 | 2026-09-23 | Fix batal-salin: baris genap dari import (ganjil masih aktif) bisa dibatalkan — hapus genap, pastikan ganjil aktif; suite 323/323 |
| 2.110 | 2026-09-23 | Fix `[object Object]`: lepas eager-load `tahunAjaran` di daftar (snake-case menimpa atribut FK) + helper tampilan `namaTahunAjaran`/`namaLembaga`; suite 323/323 |
| 2.111 | 2026-09-23 | Halaman MI-MD ikut TA topbar (default TA aktif): santri difilter ke TA terpilih (riwayat di TA atau `tahaj_masuk`), kelas dari TA itu — alumni/TA lama tak muncul; suite 324/324 |
| 2.112 | 2026-09-24 | Antrean PSB jadi 1 halaman 6 tab (shadcn Tabs + badge jumlah per tahap; rute `/psb/:tahap`; sidebar 6 entri → 1); pencarian/filter dipertahankan antar tab |
| 2.113 | 2026-09-24 | Daftar Kelas: aksi baris jadi "Lihat detail santri" (ProfilSantriDialog) & "Ubah detail santri" (dialog identitas baru); hapus aksi "Pindah kelas"/"Keluarkan dari kelas" (pindah tetap di halaman Pindah Kelas) |
| 2.114 | 2026-09-24 | Buku Induk dipindah dari grup Santri ke grup Data Induk (sebelum Referensi) |
| 2.115 | 2026-09-24 | Grup Santri: subgrup "Identitas" dihapus; subgrup baru "Lain-lain" menampung Rekap Santri & Pengajuan Biodata |
| 2.116 | 2026-09-24 | Grup Santri: subgrup "Mutasi" dihapus; Pindah Kelas & Mutasi Keluar dipindah ke subgrup "Akademik" |
| 2.117 | 2026-09-24 | Fix is_active_riwayat impor: hanya periode terakhir per (santri, jenjang) yang `status_akhir='aktif'`; sisanya diarsipkan (invarian maks 1 aktif per santri+lembaga). Tambah perintah `riwayat:sinkron-aktif` untuk backfill; data lama: 3.924 → 1.064 baris aktif, 553 santri aktif |
| 2.118 | 2026-09-24 | Rekap Santri tak lagi bergantung `is_active_riwayat` (TA historis kembali terhitung): dasar = TA + semester + `status_akhir` bukan pindah_keluar (selaras Daftar Kelas); tambah filter semester dari TopBar; tambah kolom jenis kelamin L \| P \| JML (per TA, per tingkat, per kelas). 2010/2011: ganjil 425 (L 217/P 208), genap 395 (L 197/P 198) |
| 2.119 | 2026-09-24 | Rekap Santri: layout 3 kolom (Per TA span vertikal; Per Tingkat; Per Kelas; Usia per TINGKAT di bawah kolom 2–3) dengan pembatas antar tabel **resizable** (react-resizable-panels), container tabel **tanpa border**, rasio baris Per Tingkat/Kelas : Usia = **2:1**; tabel Per TA menampilkan SELURUH TA (abaikan filter TA terpilih); baris "Jumlah" (total L/P/JML) di Per Tingkat & Per Kelas dan total (Jumlah/rata/min/max + tiap kelompok usia) di Usia per Tingkat; tabel mengisi penuh wadah (scroll hanya saat isi melebihi); Per Kelas: kolom Kelas/Lembaga/L/P/JML (tanpa tingkat, TA, kapasitas, sisa) |
| 2.120 | 2026-09-24 | Rekap Santri: filter **Keaktifan** (Aktif = `status_akhir` selain Pindah/Keluar [bawaan]; Tidak aktif = Pindah/Keluar; Semua). Verified: semester 2 Tidak aktif = 739 |
| 2.121 | 2026-09-24 | Rekap Santri: tabel Per tahun ajaran diurut menaik (ASC) berdasarkan Tahun Ajaran (2004/2005 → …) |
| 2.122 | 2026-09-24 | Fix dropdown lembaga TopBar: opsi "Semua" selalu tampil selama punya akses (sebelumnya hanya muncul saat sudah "Semua", sehingga tak bisa kembali dari lembaga terpilih) |
| 2.123 | 2026-09-24 | Status akhir semester ganjil = **`lanjut`** (kode ref baru "Lanjut"): ganjil yang lanjut ke genap TA sama tidak lagi `aktif`; `aktif` khusus periode yang berjalan. `salinKeGenap` mengarsipkan ganjil sebagai `lanjut`, `batalSalin` mengembalikannya ke `aktif`, importer menyinkronkan ganjil↔genap. Set "aktif" (Daftar Kelas & Rekap) menyertakan `lanjut` |
| 2.124 | 2026-09-24 | Import arsip mutasi keluar: hapus kolom `nik`, kunci update kini **NIS lokal + jenjang** (`nis_lokal` wajib). Template/deskripsi/tabel tes disesuaikan |
| 2.125 | 2026-09-24 | Mutasi Keluar: dua tabel (Santri aktif : Arsip) jadi **resizable** dengan rasio awal **1:2** (sebelumnya grid 1:1) |
| 2.126 | 2026-09-24 | Mutasi Keluar: container tabel tanpa border; aksi "Mutasi" jadi ikon panah kanan tanpa label (ActionIcon) |
| 2.127 | 2026-09-24 | Mutasi Keluar: filter **tingkat** & **kelas** (multi-pilih/centang) untuk daftar Santri aktif, di baris atas topBar tepat setelah dropdown Semester (slot filter halaman baru `TopBarFilter`); gaya trigger disamakan dengan dropdown lembaga/TA/semester, tanpa ikon |
| 2.128 | 2026-09-24 | TopBar: hapus ikon pada dropdown lembaga, tahun ajaran, dan semester (teks + chevron saja) |
| 2.129 | 2026-09-24 | TopBar: hapus header/judul pada daftar dropdown lembaga, tahun ajaran, semester, serta filter tingkat & kelas |
| 2.130 | 2026-09-24 | Ribbon tabel: hapus header grup MODE, KOLOM, BARIS, dan FONT & WARNA (`RibbonGroup` label jadi opsional) |
| 2.131 | 2026-09-24 | TopBar: tombol toggle tampil/sembunyi ribbon diperlebar (`size-6` → `w-14`) |
| 2.132 | 2026-09-24 | TopBar: tombol mode (Terang/Gelap/Sistem) dipindah dari baris atas ke area akun — blok khusus di bawah nama akun, di atas menu Tema |
| 2.133 | 2026-09-24 | Filter **tingkat & kelas** (multi-pilih, topBar) dipakai lintas halaman via komponen bersama `FilterTingkatKelas`: Mutasi Keluar, Kenaikan Kelas, Daftar Kelas, Pindah Kelas, Riwayat Belajar, Pindah Semester (server-side), dan MI-MD (kelas saja). Endpoint `riwayat-belajar` & `riwayat-belajar/belum-genap` kini menerima `tingkat[]` & `kelas_id[]` |
| 2.134 | 2026-09-24 | **Search tunggal di topBar** menggantikan judul halaman (slot `TopBarSearch`): satu input per halaman dipakai semua tabel (mis. MI-MD & Kegiatan PSB 3 tabel, Riwayat Belajar/Pindah Semester 2 tabel, Pindah Kelas banyak kolom). Input cari per tabel dihapus di seluruh halaman ber-tabel; `useDaftarTabel` menerima `search` eksternal. Endpoint `pengajuan-biodata`, `mutasi-keluar`, `alumni` menerima `q`. Judul tetap di judul jendela/sidebar |
| 2.135 | 2026-09-24 | Fix search topBar tak jalan untuk query 1 karakter (mis. "9" di halaman Kelas): guard panjang 1 di `useDaftarTabel` dihapus; live search 400 ms berlaku semua panjang query (termasuk mode "Semua baris") |
| 2.136 | 2026-09-24 | TopBar search: sembunyikan tombol bersihkan bawaan (`type=search`), pertahankan tombol "x" kustom |
| 2.137 | 2026-09-24 | Search multi-field (bertahap): **Buku Induk** mencari `nama_lengkap`, `nisn`, `ayah_nama`, `ibu_nama` (`GET /admin/santri?q=`); **Pengguna** mencari `name`, `email`, `phone`, `username`, `role` (hapus filter Role di header tabel; filter lewat search). Halaman lain menyusul bila diperlukan |
| 2.138 | 2026-09-24 | TopBar search: placeholder dihapus (teks label tetap dipakai sebagai `aria-label`) |
| 2.139 | 2026-09-24 | Toolbar tabel: label filter/dropdown (Tingkat, Urutkan, Kolom, dll.) disejajarkan **satu baris** dengan kontrolnya (inline) saat berada di toolbar; di luar toolbar tetap bertumpuk |
| 2.140 | 2026-09-24 | Dropdown Urutkan: label opsi "Tanpa urutan" diganti strip "—" |
| 2.141 | 2026-09-24 | Tombol **PERAN SEBAGAI** di baris atas dihapus; pilih/keluar peran lembaga super_admin pindah ke section **"Peran sebagai"** di menu akun (tetap tampil saat bertindak; banner act-as dipertahankan sebagai penanda) |
| 2.142 | 2026-09-24 | Halaman **Kelas**: hapus filter Tingkat di header tabel; filter Tingkat (multi-pilih 1–12) pindah ke topBar. Endpoint `kelas` menerima `tingkat[]` (tunggal tetap didukung) |
| 2.143 | 2026-09-24 | Dropdown **Semester** disembunyikan di halaman Kelas (data kelas tak mengenal semester; kontrol ini tak berpengaruh di sana). Mekanisme per halaman via `TanpaSemester` |
| 2.144 | 2026-09-24 | **Tingkat & Kelas jadi filter global** (setara lembaga/TA/semester; nilai menetap lintas halaman, tersimpan per perangkat; pilihan kelas dikosongkan saat ganti lembaga/TA). Tiap filter bisa show/hide per halaman via `VisibilitasFilter` (bawaan: lembaga/TA/semester tampil, tingkat/kelas tampil bila halaman meminta). Slot `TopBarFilter`/`TanpaSemester` dilebur ke mekanisme ini |
| 2.145 | 2026-09-24 | Fix toggle `is_active` halaman Referensi tak bisa ditekan: peta izin `toggleBoleh` di-key per `jenjang` padahal `bolehToggle` dipanggil per `id` baris (selalu gagal → disabled); kini di-key per `id` |
| 2.146 | 2026-09-24 | Opsi **Tingkat** global menyesuaikan lembaga aktif (distinct tingkat dari daftar kelas; mis. MI → 1–6; jatuh balik 1–12 bila kosong). Pilihan usang ikut dibuang saat ganti lembaga |
| 2.147 | 2026-09-24 | Daftar Kelas: hapus 6 kolom jejak teknis (`riwayat/santri/anggota.created_at+updated_at`) dari grid; header CREATED AT/UPDATED AT tak lagi tampil |
| 2.148 | 2026-09-24 | Daftar Kelas: hapus kolom ganda — `TAHUN AJARAN` (nilai sama dengan `TA`), `JENJANG` (sama dengan `LEMBAGA`), `TGL MASUK` anggota (header kembar milik riwayat; sisakan riwayat), ID teknis `SANTRI_ID`+`KELAS_ID` |
| 2.149 | 2026-09-24 | Dialog **Kelola Halaman** (perluasan Kelola Tabel ke cakupan halaman): 4 tab Filter/Kolom/Urutan/Toolbar + pemilih tabel; visibilitas filter topBar pindah ke tabel `pengaturan_halaman` (DB menang atas bawaan kode; tombol topBar khusus super_admin). `VisibilitasFilter` → `PengaturanHalaman` (+registrasi tabel; diekstraksi ke konstanta di Mutasi/Kenaikan/Kelulusan/Semester). Halaman tanpa grid (Dashboard, Rekap, Pengaturan) tanpa tombol |
| 2.150 | 2026-09-24 | Fix CI MySQL (lolos SQLite karena DQS literal + varchar tak ditegakkan): `tahunAjaran:id,nama` → `tahunAjaran:nama` (PsbKegiatan index, Siklus naik-otomatis); fixture TA matriks ≤9 char unik; assert filter per-kunci (urutan kunci JSON MySQL ≠ urutan kirim) |
| 2.151 | 2026-09-24 | Hapus Kotak cari toolbar (mati sejak pencarian pindah ke topBar; tak ada halaman mengoper search): kunci `cari` keluar dari kontrol+lebar toolbar FE & allowlist BE; tes toolbar pakai `info`/`urut`, kunci `cari` lama kini ditolak 422 |
| 2.152 | 2026-09-24 | Hapus dialog Kelola Tabel: pengelolaan hanya lewat Kelola Halaman (tombol topBar). Pintu yang dibuang: item Kelola preset/Urutan di dropdown, klik kanan toolbar & menu konteks, aksi ribbon; `PresetKolomApi.bukaKelola`, `TabKelola`, `pakaiLengkap` lokal ikut hapus. Toggle kolom per preset di menu konteks tetap ada (gerbang diseragamkan mati-saat-bertindak) |
| 2.153 | 2026-09-24 | Daftar Kelas: Urutkan + paginasi sisi server (ikuti pola riwayat_belajar). Endpoint dukung `q` (nama/NIK/NIS lokal), `tingkat[]`, `kelas_id[]`, `sort`/`arah` (katalog `daftar_kelas`), paginasi; seed opsi urut; pemanggil lama (Kelulusan/PindahKelas/Mutasi) kirim `per_page=0`. Halaman pakai `useDaftarTabel` + `Pager`; filter global & cari pindah ke server |
| 2.154 | 2026-09-24 | Fix jumlah status Daftar Kelas: opsi Semua kirim `kelompok_status=semua` (tanpa filter status) — sebelumnya jatuh ke cabang lama `is_active_riwayat='Ya'` sehingga baris nonaktif terbuang (543 vs 553). Tanpa param tetap perilaku lama untuk pemanggil lain |
| 2.155 | 2026-09-24 | Zona info tengah toolbar (ganti posisi search box lama): pil 2 baris — info halaman + info seleksi (dot aksen, hanya saat ada centang); sembunyi total bila kosong; ikut toggle preset `info`. Prop `tengah` baru; label info Daftar Kelas pindah ke tengah |
| 2.156 | 2026-09-24 | MI-MD: tiga tabel dipisahkan panel horizontal resizable tanpa border (MI Only, MD Semua, Perbandingan Kelas) dengan handle drag/keyboard; kontrol dropdown Kolom dipindahkan ke header masing-masing tabel; rasio awal sama besar, lebar minimum 20%, dan tiap panel mengisi tinggi area |
| 2.157 | 2026-09-25 | MI-MD: dropdown Urutkan ditambahkan di kiri dropdown Kolom pada header setiap tabel; opsi Nama/NIS/Kelas dibangun per tabel, sorting berjalan sisi klien, dan preset awal tetap Nama menaik. Ketiga tabel didaftarkan di Kelola Halaman untuk mengelola preset Kolom, Urutan, dan Toolbar |
| 2.158 | 2026-09-25 | MI-MD menjadi dua kolom: kolom kiri memuat MI Only di atas Perbandingan Kelas dengan rasio tinggi 2:1 dan pemisah vertikal resizable; kolom kanan memuat MD Semua dengan pemisah lebar resizable |
| 2.159 | 2026-09-25 | Aksi Samakan dengan MI/MD hanya berlaku untuk santri dengan keanggotaan aktif pada kedua jenjang; permintaan API dari Santri yang hanya aktif di MI atau MD ditolak tanpa membuat riwayat/keanggotaan sisi lain |
| 2.160 | 2026-09-25 | Label aksi baris Samakan dipersingkat: ikon panah ke kanan diikuti MI atau MD; tooltip deskriptif tetap dipertahankan |
| 2.161 | 2026-09-25 | Perbandingan Kelas hanya memuat Santri aktif di MI dan MD yang sama-sama memiliki kelas aktif; jika kelas MI atau MD kosong, baris tidak ditampilkan |
| 2.162 | 2026-09-25 | Pindah Kelas: saat halaman dibuka, filter global Tingkat otomatis memilih tingkat terendah yang tersedia pada kelas aktif, bukan Semua; pilihan pengguna berikutnya tetap dihormati |
| 2.163 | 2026-09-25 | Kelola Halaman tab Filter: setiap filter relevan memiliki mode Tunggal/Jamak tersimpan per halaman (default Tunggal); allowlist filter per halaman disembunyikan bila tidak dipakai. Provider dan API mendukung nilai jamak (OR dalam filter, AND antarfilter), sementara target aksi tetap scalar aman |
| 2.164 | 2026-09-25 | Filter Tingkat dan Kelas dipindahkan ke rail vertikal 42px tepat di bawah TopBar dengan warna latar halaman: nilai All berada di posisi pertama pada kedua filter, terdapat switch Tunggal/Jamak per filter dengan jarak antarbagian, daftar tingkat di atas, daftar kelas di bawah, scroll per bagian, pilihan mengikuti mode Tunggal/Jamak dari Kelola Halaman, dan mode Jamak mendukung klik atau tahan lalu geser; dropdown TopBar yang duplikat dihapus |
| 2.165 | 2026-09-25 | Filter Lembaga dan Semester pada TopBar menggunakan ToggleGroup tanpa opsi Semua, mendukung mode Tunggal/Jamak, dan tanpa margin antar-nilai; Semester hanya menampilkan Ganjil dan Genap |
| 2.166 | 2026-09-25 | Katalog Urutan selalu menyediakan kode jk untuk seluruh tabel berbasis data Santri, MI-MD, dan PSB, serta katalog Pegawai untuk data guru/pegawai; data MI-MD juga membawa nilai jk ke opsi urutan |
| 2.167 | 2026-09-25 | ExcelTable memakai header generik berisi judul, filter tabel, Urutkan, Kolom, dan Aksi; toolbar hanya menampilkan informasi, aksi massal, serta kontrol kondisional; header lama pada halaman berpanel dihapus agar tidak tampil ganda |
| 2.168 | 2026-09-25 | Mutasi Keluar: tombol Import Arsip dipindahkan ke menu Aksi paling kanan, dan kontrol preset Kolom diaktifkan kembali pada tabel Arsip |
| 2.169 | 2026-09-25 | Seluruh tombol pembuka Import pada halaman yang relevan disatukan ke menu Aksi/hamburger paling kanan; tombol Tambah dan aksi global lain tetap mengikuti pola menu yang sama |
| 2.170 | 2026-09-25 | Kelola Halaman → Toolbar: lebar semua combobox default 120px; Filter halaman hanya memuat combobox selain Urutkan dan Kolom; Info seleksi dihapus dari pengaturan visibilitas |
| 2.171 | 2026-09-25 | Kelola Halaman dapat dibuka lewat tombol, klik kanan TopBar, atau klik kanan header container tabel; akses tetap terbatas super_admin efektif |
| 2.172 | 2026-09-25 | Ganti lembaga tidak lagi membuat filter tahun/rail tingkat-kelas hilang sementara; kontrol TopBar tetap tampil nonaktif saat memuat, dan request kelas menunggu scope baru siap |
| 2.173 | 2026-09-25 | Rail Tingkat memakai data aktif `ref_tingkat` melalui Referensi API, bukan diturunkan dari kelas; daftar kelas tetap memakai `listKelas` |
| 2.174 | 2026-09-25 | Referensi: pilihan baris dapat dihapus massal secara permanen dengan konfirmasi, permission `referensi.hapus`, dan laporan hasil parsial |
| 2.175 | 2026-09-25 | Referensi: pilihan Tipe kamus disimpan per perangkat dan dipulihkan saat scope lembaga berubah |
| 2.176 | 2026-09-25 | Pilihan Tingkat/Kelas tidak lagi membuat array filter global tersusun ulang, sehingga rail tidak flicker saat tingkat dipilih |
| 2.177 | 2026-09-25 | Mode jamak rail: klik biasa memilih satu nilai, drag atau Ctrl/Cmd klik menambah/memilih beberapa nilai |
| 2.178 | 2026-09-25 | Riwayat Belajar: dua panel menampilkan data sesuai tahun ajaran yang dipilih dengan judul Semester Ganjil dan Semester Genap; masing-masing memakai field nama_lengkap, kelas, tgl_masuk, status_awal, status_akhir, is_active_riwayat dan filter Keaktifan default Semua |
| 2.179 | 2026-09-25 | Riwayat Belajar diubah menjadi laporan per semester read-only: aksi masuk/keluarkan kelas, checkbox, dan filter kelas tujuan dihapus; impor riwayat tetap tersedia |
| 2.180 | 2026-09-25 | Riwayat Belajar menerapkan filter tahun ajaran, tingkat, dan kelas yang dipilih pada kedua tabel semester |
| 2.181 | 2026-09-25 | Label Kamus Label untuk `riwayat_belajar.is_active_riwayat` diubah menjadi `AKTIF` tanpa menonaktifkan sumber label tabel |
| 2.182 | 2026-09-25 | Field `tgl_masuk` dihapus dari kedua tabel Riwayat Belajar |
| 2.183 | 2026-09-25 | Combobox preset Kolom disembunyikan pada kedua tabel Riwayat Belajar |
| 2.184 | 2026-09-25 | Filter Keaktifan Riwayat Belajar memakai `status_akhir`: selain `pindah_keluar` berarti Aktif, `pindah_keluar` berarti Tidak Aktif |
| 2.185 | 2026-09-25 | Dialog Kelola Halaman memakai layout flex agar baris tab tidak ikut meregang; area isi tab dapat digulir sendiri |
| 2.186 | 2026-09-25 | Filter Tingkat/Kelas mode tunggal mengganti nilai lama saat nilai lain dipilih, dan klik nilai aktif mengosongkan pilihan |
| 2.187 | 2026-09-25 | Tabel Semester Ganjil Riwayat Belajar menampilkan aksi Pindah untuk siswa aktif; backend hanya menerima TA aktif dan Semester aktif Ganjil, serta memindahkan baris exact yang dipilih |
| 2.188 | 2026-09-25 | Aksi Pindah dipindahkan ke toolbar header Semester Ganjil dan hanya aktif setelah checkbox dipilih; input tanggal masuk dipindah ke dialog konfirmasi |
| 2.189 | 2026-09-25 | Riwayat Belajar menjadi aksi massal tanpa checkbox: Pindah berada di sebelah filter Keaktifan dan memproses status akhir selain Pindah/Keluar, Semester Genap memakai aksi Batal pada TA aktif, dan semua aksi Import dihapus |
| 2.190 | 2026-09-25 | Dialog Pindah ke Semester 2 menampilkan jumlah serta nama siswa tidak aktif berdasarkan filter halaman, dengan status aktif memakai `status_akhir != pindah_keluar` |
| 2.191 | 2026-09-25 | Aksi Pindah dan ringkasannya mengabaikan filter Tingkat/Kelas; kedua filter hanya untuk pengecekan tabel. Import Biasa tetap dihapus, sedangkan Import Bertahap dipulihkan |
| 2.192 | 2026-09-25 | Halaman Pindah Semester dihapus dari route, sidebar, dan konfigurasi frontend; URL lama dialihkan ke Riwayat Belajar |
| 2.193 | 2026-09-25 | Tabel Arsip Mutasi Keluar menampilkan seluruh kolom `mutasi_keluar`, nama Santri, dan nama kelas terakhir |
| 2.194 | 2026-09-25 | Panel Santri Aktif pada Mutasi Keluar otomatis disembunyikan saat digeser melewati batas minimum dan tampil kembali saat gagang digeser ke kanan |
| 2.195 | 2026-09-25 | Auto-hide panel pertama diterapkan seragam pada seluruh kelompok resizable, mencakup panel bersarang dan pratinjau; panel tampil kembali saat gagang digeser ke arah sebaliknya |
| 2.196 | 2026-09-25 | Teks Tahun Ajaran pada halaman MI-MD dihapus; tahun ajaran tetap tercermin dari filter global dan data tabel |
| 2.197 | 2026-09-25 | Garis separator resizable diperpanjang hingga ujung panel tanpa jedanya |
| 2.198 | 2026-09-25 | Padding global `p-1` pada container `main` dihapus agar tabel menempel ke sisi area konten |
| 2.199 | 2026-09-25 | Area handle resizable diperbesar dari 8 px menjadi 12 px untuk kondisi drag yang lebih mudah |
| 2.200 | 2026-09-25 | Filter Semester diaktifkan pada halaman MI-MD dan diteruskan ke query data agar hasil Ganjil/Genap dapat dibedakan |
| 2.201 | 2026-09-25 | Rail Tingkat diaktifkan pada halaman MI-MD dan diteruskan ke query data bersama filter semester |
| 2.202 | 2026-09-25 | Halaman Riwayat Belajar menggunakan resizable dua panel; Semester Ganjil dapat otomatis tersembunyi dan dipulihkan melalui gagang pemisah |
| 2.203 | 2026-09-25 | AutoFit header ExcelTable membungkus header multiword menjadi dua baris saat lebar tidak cukup, tetapi memprioritaskan lebar isi kolom yang panjang agar header tetap satu baris |
| 2.204 | 2026-09-25 | Pagination menampilkan nomor halaman aktif dan tetangga halaman pertama/terakhir dengan elipsis; page size tetap dipertahankan |
| 2.205 | 2026-09-25 | Tombol sebelumnya/berikutnya dipadatkan menjadi ikon saja; pilihan Data/hal menggunakan grup tombol toggle |
| 2.206 | 2026-09-25 | Label pilihan seluruh data pada pagination diubah dari `Semua` menjadi `All` |
| 2.207 | 2026-09-25 | Layout pagination tiga kolom: Data/hal di kiri, tombol halaman di tengah, dan informasi halaman/jumlah data di kanan |
| 2.208 | 2026-09-25 | Padding horizontal pagination 4 px; halaman aktif ditampilkan antara Prev/Next tanpa tombol nomor, jumlah data tetap di kanan |
| 2.209 | 2026-09-25 | Setiap item Data/hal pada pagination dikunci lebar 36 px agar opsi jumlah data seragam |
| 2.210 | 2026-09-25 | Padding vertikal pagination dikurangi menjadi 4 px atas dan bawah |
| 2.211 | 2026-09-25 | Padding bawah pagination dan wrapper tabel dihapus agar area konten menempel ke batas bawah panel |
| 2.212 | 2026-09-25 | Padding bawah pagination dan wrapper tabel dikembalikan menjadi 4 px |
| 2.213 | 2026-09-25 | Padding bawah pagination tetap 4 px, sedangkan padding bawah wrapper tabel diatur 0 px agar tidak terhitung dua kali |
| 2.214 | 2026-09-25 | Label `Data/hal` dihapus; grup tombol pilihan jumlah data tetap dipertahankan |
| 2.215 | 2026-09-25 | Kontrol Prev, informasi halaman, dan Next dibungkus border |
| 2.216 | 2026-09-25 | Padding horizontal pada wrapper kontrol Prev/Hal/Next dihapus agar border hugs konten |
| 2.217 | 2026-09-25 | Lebar item Data/hal dikurangi menjadi 28 px |
| 2.218 | 2026-09-25 | Jumlah data dihapus dari judul tabel dan pagination selalu tampil, termasuk saat data masih berada dalam satu halaman |
| 2.219 | 2026-09-25 | Padding horizontal dan border wrapper tabel pada halaman Pindah Kelas dihapus |
| 2.220 | 2026-09-25 | Pagination Klien ditambahkan pada setiap tabel kelas di halaman Pindah Kelas, termasuk pilihan jumlah data dan navigasi halaman |
| 2.221 | 2026-09-25 | Tombol Salin ke Genap beserta dialog dan alur terkait dihapus dari halaman Pindah Kelas |
| 2.222 | 2026-09-25 | Label `Tingkat` pada judul kelompok kelas Pindah Kelas dihapus; nilai tingkat tetap ditampilkan |
| 2.223 | 2026-09-25 | Nilai tingkat pada judul kelompok kelas Pindah Kelas juga dihapus |
| 2.224 | 2026-09-25 | Padding vertikal header container tabel dikurangi dari 8 px menjadi 4 px |
| 2.225 | 2026-09-25 | Tombol All pada rail Tingkat disembunyikan khusus halaman Pindah Kelas; rail Kelas tetap menyediakan All |
| 2.226 | 2026-09-25 | Area handle resizable dikecilkan dari 12 px menjadi 8 px |
| 2.227 | 2026-09-25 | Gagang visual dan ikon di dalam handle resizable disamakan menjadi 8 px agar perubahan ukuran terlihat |
| 2.228 | 2026-09-25 | Padding container `main` dipaksa 0 px secara horizontal dan vertikal untuk seluruh halaman |
| 2.229 | 2026-09-25 | Padding horizontal wrapper tabel pada halaman Kenaikan Kelas dihapus agar tabel menempel ke area panel |
| 2.230 | 2026-09-25 | Padding horizontal tabel 2 dan 3 Kenaikan Kelas juga dihapus agar konsisten dengan tabel utama |
| 2.231 | 2026-09-25 | Combobox Urutkan dan Kolom dihapus pada ketiga tabel Kenaikan Kelas; tanggal masuk dan tombol Naik dipindahkan ke header container tabel utama |
| 2.232 | 2026-09-25 | Combobox Urutkan dan Kolom dihapus pada ketiga tabel Kelulusan; Tingkat akhir, Luluskan, dan Tandai tidak lulus dipindahkan ke header container tabel masing-masing |
| 2.233 | 2026-09-25 | Padding horizontal dan border wrapper ketiga tabel Kelulusan dihapus |
| 2.234 | 2026-09-25 | Action Import ditambahkan pada menu Aksi tabel Alumni; action Tidak Lulus ditambahkan pada menu Aksi Santri Tingkat Akhir |
| 2.235 | 2026-09-25 | Semua import file aktif diseragamkan ke session bertahap per 1.000 baris; endpoint full-file tetap dipertahankan untuk kompatibilitas |
| 2.236 | 2026-09-26 | Import mutasi keluar: `tanggal_mutasi` dan `alasan_mutasi` jadi opsional (kosong disimpan `NULL`; kolom `tanggal_mutasi` dibuat nullable langsung di migrasi utama) |
| 2.237 | 2026-09-26 | Import riwayat belajar: kolom kelas resmi `nama_kelas` (bukan `kelas_id`); heading lama `kelas_id` tetap diterima sebagai alias dan galat kelas menunjuk `nama_kelas` |
| 2.238 | 2026-09-26 | Import mutasi keluar: `kelas_terakhir` dibaca nama rombel lebih dulu (angka seperti "1" tak lagi diperlakukan sebagai id kelas); id numerik hanya fallback |
| 2.239 | 2026-09-26 | Import arsip mutasi keluar: `alasan_mutasi` jadi bebas teks (maks 100 karakter, tak harus ada di kamus `ref_alasan_mutasi`); form "Proses mutasi" tetap memakai kamus |
| 2.240 | 2026-09-26 | Seeder `ref_tingkat` mengikuti jenjang: MI/MD 1-6, MTS 7-9, MLN 10-12; baris tingkat di luar rentang lembaga dihapus saat seed |
| 2.241 | 2026-09-26 | Dialog import kelas, riwayat belajar, dan mutasi keluar bertambah tombol **Unduh data existing** (kolom identik template import, data nyata, dibatasi lembaga akses akun) |
| 2.242 | 2026-09-26 | Dialog import santri bertahap bertambah tombol **Unduh data existing**; cakupan mengikuti akses akun (super admin/admin pesantren = semua lembaga, admin MI/MD = milik + pasangan MI+MD, admin lain = miliknya) |
| 2.243 | 2026-09-26 | Dialog import santri: pilihan lembaga untuk unduh data existing tak lagi dikunci/di-default oleh filter lembaga toolbar; bawaan seluruh lembaga yang boleh diakses, terkunci hanya bila akun cuma punya satu lembaga |
| 2.244 | 2026-09-26 | Import bertahap dijalankan inline di dialog import Santri; pop-up terpisah "Buka import bertahap" dihapus (satu dialog: template, data existing, pilih file, Periksa, Import) |
| 2.245 | 2026-09-26 | Layout dialog import Santri diterapkan ke semua dialog import (Kelas, Riwayat Belajar, Mutasi Keluar, Alumni, PSB): cards Template / Data existing (chip lembaga + unduh di kanan) / Import bertahap inline, `sm:max-w-3xl`, deskripsi singkat |
| 2.246 | 2026-09-26 | Unduh data existing diberi style: header tebal (kuning = wajib, biru = opsional), baris 1 dibekukan, autofilter, border tipis, zebra baris data, dan lebar kolom per jenis data |
| 2.247 | 2026-09-26 | Import arsip alumni: `tanggal_lulus` opsional (kosong disimpan `NULL` lewat migrasi alter; kolom jadi nullable), form Lulus tetap mewajibkan tanggal, dan perbandingan baris sama jadi null-aware |
| 2.248 | 2026-09-26 | Import arsip alumni: `tgl_selesai` keanggotaan diisi dari `tanggal_lulus` walau keanggotaan sudah nonaktif; tanggal kosong tidak menimpa `tgl_selesai` lama |
| 2.249 | 2026-09-26 | Import arsip mutasi keluar sekarang mendukung update: kunci baris `nis_lokal` + `jenjang` (bukan berdasarkan tanggal), kolom terisi ditimpa, sel kosong dipertahankan, tanpa perubahan → dilewati |
| 2.250 | 2026-09-26 | Unduh data existing dipindah ke frontend: backend hanya mengirim JSON (`*/data-existing`), Excel disusun di browser dengan `xlsx-js-style` (header wajib/opsional, lebar kolom, autofilter, zebra) |
| 2.251 | 2026-09-26 | Dialog import alumni bertambah kartu **Data existing** (endpoint `alumni/data-existing`, kelas ditulis sebagai nama rombel, `tanggal_lulus` boleh kosong) |
| 2.252 | 2026-09-26 | Auto-hide resizable Kenaikan Kelas & Kelulusan diperbaiki: ukuran panel memakai persen (sebelumnya angka = piksel di react-resizable-panels v4) sehingga panel tersembunyi saat gagang diseret ke tepi kiri/bawah |
| 2.253 | 2026-09-26 | Arsip kelulusan (alumni) menjadi unik per (santri + lembaga_lulus): satu Santri bisa punya arsip MI sekaligus MD; import & tombol Proses Lulus memakai kunci NIS lokal + jenjang, bukan last-wins |
| 2.254 | 2026-09-26 | Panel bawah Kenaikan Kelas (Santri tidak naik) dan Kelulusan (Santri tidak lulus) kini auto-hide: seret gagang baris ke bawah hingga melewati batas → panel tersembunyi |
| 2.255 | 2026-09-26 | Panel Santri tidak naik & Santri tidak lulus disembunyikan otomatis saat tabelnya kosong (`sembunyiOtomatis` pada ResizableAutoHidePanel: collapse/expand via panelRef), dan langsung muncul lagi begitu ada data |
| 2.256 | 2026-09-26 | Filter tahun ajaran dimunculkan di Mutasi Keluar, Kenaikan Kelas, dan Kelulusan untuk melihat riwayat; tabel proses (Santri aktif/semester genap/tingkat akhir) tetap hanya Santri AKTIF periode aktif, disertai catatan `CatatanProsesTahunAjaran` |
| 2.257 | 2026-09-26 | Mutasi Keluar mendapat filter semester: daftar proses memakai baris riwayat AKTIF pada semester terpilih (`lintas_periode` saat "Semua semester"), arsip tetap mengikuti filter tahun ajaran |
| 2.258 | 2026-09-26 | Fix: `ResizableAutoHidePanel` tidak lagi meng-unmount isi panel saat panel terlihat (flag tersembunyi terbalik), sehingga tabel Santri aktif/tingkat akhir/semester genap kembali tampil; drag untuk sembunyi tetap berfungsi |
| 2.259 | 2026-09-26 | Kenaikan Kelas dikunci pada semester genap: saat semester aktif ganjil seluruh tabel proses dikosongkan (tanpa request) + catatan解释了; filter semester tampil di halaman Kenaikan |
| 2.260 | 2026-09-26 | Kenaikan Kelas: tabel Santri naik kelas & tidak naik kini membaca tahun ajaran tujuan (TA aktif + 1, cermin `SiklusSantriService::taBerikutnya`) sesuai backend yang menulis hasil ke TA berikutnya, bukan TA aktif |
| 2.261 | 2026-09-26 | Kenaikan Kelas: tabel naik/tidak naik mengikuti filter tahun ajaran (default TA tujuan = TA aktif + 1); memilih TA lain menampilkan histori kenaikan tahun tersebut (tanpa filter `is_active_riwayat`, baris tak aktif diberi label "Historis" tanpa aksi Batalkan) dan tetap boleh dibaca saat semester aktif ganjil |
| 2.262 | 2026-09-26 | Kenaikan Kelas: kandidat proses = baris semester genap dengan `status_akhir = 'aktif'` dari semua tahun ajaran (tidak dibatasi TA aktif) + kolom tahun ajaran; tabel hasil default "semua tahun" karena backend placing hasil ke TA baris asal + 1, memilih TA lain tetap untuk histori |
| 2.263 | 2026-09-26 | Kenaikan Kelas mengikuti tahun ajaran dari filter (wajib satu TA), bukan TA/semester aktif: kandidat = baris semester 2 yang masih berstatus akhir bukan Pindah/Keluar (tingkat 1–5, pagination); tabel naik = TA berikutnya dengan status awal selain `santri_baru`; tabel tidak naik = status awal `mengulang`. Proses naik/tidak naik memakai checkbox baris tercentang (bukan sekali klik semua), dan Batalkan tersedia per baris maupun massal untuk status awal kenaikan/mengulang yang masih aktif. API `riwayat-belajar` menerima `status_awal[]` (array) dan `status_awal_bukan[]`. Tabel kandidat juga punya kolom Aksi berikon per baris: naik (centang hijau) dan tidak naik (X merah); Batalkan di kedua tabel hasil memakai ikon X merah, tombol Batalkan (n) untuk baris tercentang berada di kanan baris judul tabel; strip toolbar tambahan di kedua tabel hasil disembunyikan.
| 2.264 | 2026-09-26 | Indikator jumlah baris tercentang ("... baris dipilih") dihapus dari toolbar semua tabel; fungsi centang, seleksi massal, dan jumlah pada tombol aksi tetap berjalan.
| 2.265 | 2026-09-26 | Kenaikan Kelas: pagination dihapus pada tabel Santri semester 2, Santri naik kelas, dan Santri tidak naik; ketiga tabel memuat semua baris sekaligus (`per_page=0`) dan panel tidak naik tetap auto-hide saat kosong.
| 2.266 | 2026-09-26 | Kenaikan Kelas: padding wrapper tabel Santri semester 2 dihapus agar tabel menempel ke area panel.
| 2.267 | 2026-09-26 | Kelulusan mengikuti tahun ajaran dari filter (wajib satu TA): kandidat = semester 2 kelas akhir berstatus akhir aktif; alumni menampilkan seluruh field arsip tahun lulus terpilih; tidak lulus = pengulang aktif tahun berikutnya di kelas akhir. Tombol Tidak Lulus langsung memproses kandidat terpilih tanpa antrean lokal.
| 2.268 | 2026-09-26 | Kelulusan: kolom tahun ajaran lulus memakai helper `namaTahunAjaran` karena relasi backend diserialkan sebagai objek pada kunci FK; profil santri diperbaiki dengan pola yang sama.
| 2.269 | 2026-09-26 | Kelulusan: catatan “Pilih satu tahun ajaran di filter …” dihapus dari halaman.
| 2.270 | 2026-09-26 | Kelulusan: aksi Batalkan per baris (ikon X merah) + bulk `Batalkan (n)` di header pada tabel Alumni dan Santri tidak lulus; endpoint baru `batal-lulus` (hapus arsip alumni, buka lagi riwayat + keanggotaan) dan `batal-tidak-lulus` (hapus baris mengulang, buka lagi baris asal), masing-masing menolak bila sudah ada transisi lanjutan.
| 2.271 | 2026-09-26 | Kelulusan: kolom tanggal lulus hanya menampilkan tanggal (`YYYY-MM-DD`), bagian waktu dipotong.
| 2.272 | 2026-09-26 | Kelulusan: tabel Alumni bisa mode Edit (auto-save per sel) untuk field arsip — tanggal, nomor ijazah/peserta, SKHUN, no. surat, kegiatan, penyerahan, melanjutkan, catatan; kunci santri/lembaga/tahun/kelas tetap baca-saja. Endpoint baru `PUT alumni/{alumni}` (`AlumniUpdateRequest`, izin `kelulusan.ubah` + akses lembaga).
| 2.273 | 2026-09-26 | Kelulusan: sel kosong pada tabel Alumni dibiarkan kosong (tanpa strip “—”).
| 2.274 | 2026-09-26 | Kelulusan: default `penyerahan_ijazah` dari import adalah “Sudah”, sedangkan dari aksi Luluskan tetap “Belum”.
| 2.275 | 2026-09-26 | Kelulusan: combobox Urutkan dan Kolom ditampilkan di judul tabel Alumni (sebelum tombol aksi); pilihan urut dikirim sebagai `sort`/`arah` ke endpoint arsip alumni.
| 2.276 | 2026-09-26 | Fix sinkron dialog Kelola Halaman: registrasi tabel kini mencakup susunan key field, sehingga perubahan kolom tanpa ganti key tabel tetap mendaftarkan ulang dan tab Kolom/Urutan selalu sama dengan halaman.
| 2.278 | 2026-10-02 | Kamus Label dihapus seluruhnya: halaman + route `/pengaturan/kamus-label`, API `kamus-kolom/*`, model `LabelKolom`, service `KamusKolomService`, izin `kamus_label.*`, dan tabel `label_kolom` (drop via migrasi) |
| 2.279 | 2026-10-02 | Nama header kolom tabel dipindah dari basis data ke kode: label ditulis di tiap halaman sebagai `ExcelField.label`, dan label berupa nama kolom mentah di-humanize otomatis `lib/labelKolom` (snake_case → Proper Case, `tabel.kolom` dipangkas, singkatan `nip`/`nis` tetap kapital) |
| 2.280 | 2026-10-02 | `ExcelField.sumber` di-drop beserta 238 deklarasi; atribut perataan/kunci-lebar/tooltip/format ikut hilang. Format isi sel kini lewat `ExcelField.format` (`angka`/`tanggal`/`ya_tidak`); kolom hitung tanpa kolom asal otomatis mengikuti humanizer |
| 2.281 | 2026-10-02 | Preset Tabel (`preset_tabel`, `toolbar_preset`, `urut_preset`) dipastikan fitur terpisah dan tidak terpengaruh penghapusan Kamus Label |
| 2.282 | 2026-10-02 | Standar tampilan lembaga dihapus: checkbox "Rekam Visual", provider `standarTampilan`, API `pengaturan-tampilan`, `PengaturanTampilanController`, model + request, dan tabel `pengaturan_tampilan` (drop via migrasi). Setelan tampilan kini murni per perangkat prefs |
| 2.283 | 2026-10-02 | Konsekuensi penghapusan: `ExcelTable` memakai lebar/beku milik user saja, `useLebarKolom` tanpa opsi `standar`, `GridPrefs` tanpa `rowH/headerH/align` dari standar, `PresetKolom` & `DialogKelolaHalaman` tanpa preset aktif standar, `BannerBertindak` tanpa tombol rekam. Halaman `/pengaturan/tampilan` masih ada sebagai editor gaya per pengguna (di-hapus lagi pada v2.284) |
| 2.284 | 2026-10-02 | Halaman Tampilan dihapus: route `/pengaturan/tampilan` & `/pengaturan/bagian` (alias), `PartStyleEditor`, alat "pilih komponen" (`picker`), entri navigasi & filter, izin `tampilan.*`, part UI `daftar_bagian`, dan fungsi `resetBagian`/`resetBagianBanyak`/`resetSemuaBagian`. `/pengaturan` kini ke `/pengaturan/izin`. Gaya per bagian UI tetap bisa diubah dari ribbon Tabel |

## Daftar Isi

> Rujukan antar-file: "Bab 2–8" → `arsitektur.md`; "Bab 9–14 + Lampiran" → `operasi.md`; "§N / Part B" → `backend-detail.md`.

- [1. Pendahuluan](#1-pendahuluan) (file ini)
- [2. Gambaran Sistem](arsitektur.md#2-gambaran-sistem) … [8. Implementasi](arsitektur.md#8-implementasi)
- [9. Manajemen Proyek](operasi.md#9-manajemen-proyek-hybrid-solo) … [14. Pemeliharaan dan Dukungan](operasi.md#14-pemeliharaan-dan-dukungan)
- [Lampiran A, C–H](operasi.md#lampiran-a--erd-sumber-kebenaran) + Pembahasan Selanjutnya
- [Part B — Detail Backend (EN)](backend-detail.md#part-b--detail-backend-en-dari-backenddocsprdmd-2026-09-09)

## 1. Pendahuluan

### 1.1 Tujuan Dokumen

Dokumen ini adalah PRD produk SIMPES — dasar pembangunan dan pemeliharaan aplikasi. Acuan tunggal: kebutuhan, proses, rancangan, rencana uji/penyebaran, status implementasi, plus lampiran. Kriteria selesai per bab: ringkas, tercermin di kode + test, TBD eksplisit.

### 1.2 Latar Belakang

Pengelolaan santri, keuangan, akademik, dan operasional masih manual/spreadsheet:

- Data santri (biodata, dokumen, riwayat belajar) tersebar.
- Nilai, kurikulum, dan induk santri tidak terintegrasi per lembaga.
- Komunikasi orang_tua/wali tidak real-time.
- Pimpinan sulit mendapat laporan per lembaga maupun gabungan.

Pesantren menaungi beberapa lembaga — MI, MD, MTs, Mu'allimin — sebagai baris `lembaga` berjenjang (PK `jenjang`, tanpa root). Tiap lembaga punya `tahun_ajaran`, `kurikulum`, `kelas`, pegawai sendiri; sebagian santri aktif di >1 lembaga (mis. MTS + MD, paket MI-MD).

**Asrama bukan `lembaga`** (v1.10, **implementasi pasca production**): asrama punya kepengurusan, gedung, kamar, dan siklus penghuni sendiri; didaftarkan sebagai entitas `asrama` + peran `asrama` + pivot `user_asrama` (Modul 505). Santri asrama tetap terikat lembaga akademiknya untuk urusan akademik/PSB; penanda keuangan asrama ditetapkan saat modul keuangan dirumuskan ulang. Tidak ada tabel/role/pivot asrama yang dibuat sekarang — desain ini arah agar sistem sekarang mendekati bentuk akhirnya.

**Santri legacy:** santri lama tanpa jejak `riwayat_belajar`. Sumber kebenaran lembaga adalah `riwayat_belajar`. `status_global` bukan input manual — turunan "punya ≥1 riwayat aktif" (default nonaktif sampai ditempatkan).

### 1.3 Tujuan Proyek

1. Sistem terpusat untuk santri, pegawai/guru, dan pengguna lintas lembaga via model single-pesantren (`lembaga`).
2. Digitalisasi PSB 2-jalur, santri, dan siklus/riwayat per lembaga (keuangan tahap terakhir sebelum production).
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

Lihat Lampiran D. Inti: `lembaga` (PK `jenjang`: MI/MD/MTS/MLN), `tahun_ajaran`, `kelas` (`walas_id→pegawai`), 6 peran (`super_admin, admin, guru, orang_tua, santri, asrama` — `asrama` pasca production; `kasir` dihapus sementara v2.38), matriks izin (`IzinKatalog`), `riwayat_belajar`, `asrama` (entitas sendiri, bukan lembaga; pasca production).

### 1.6 Referensi

- Wawancara pengurus (Agu 2026), kurikulum 2026/2027, tata tertib.

---
