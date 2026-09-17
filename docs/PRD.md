# Part A — Dokumentasi Proyek (ID) — Sistem Informasi Manajemen Pesantren (SIMPES)

| Atribut | Keterangan |
|---|---|
| Versi Dokumen | 2.55 (PRD sebagai dasar proyek) |
| Tanggal | 17 September 2026 |
| Status | PRD produk SIMPES — acuan tunggal kebutuhan, rancangan, dan status implementasi aplikasi yang sedang dibangun |
| Penyusun | Solo dev + Yayasan |
| Arsip acuan (read-only) | `Step-By-Step Sistem Pesantren/Backend/` + `Frontend/admin-flutter-desktop/docs/` |
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

Dokumen ini adalah PRD produk SIMPES — dasar pembangunan dan pemeliharaan aplikasi. Acuan tunggal: kebutuhan, proses, rancangan, rencana uji/penyebaran, status implementasi, plus lampiran ketertelusuran. Kriteria selesai per bab: ringkas, tercermin di kode + test, TBD eksplisit.

### 1.2 Latar Belakang

Pengelolaan santri, keuangan, akademik, dan operasional masih manual/spreadsheet:

- Data santri (biodata, dokumen, riwayat belajar) tersebar.
- Nilai, kurikulum, dan induk santri tidak terintegrasi per lembaga.
- Komunikasi orang_tua/wali tidak real-time.
- Pimpinan sulit mendapat laporan per lembaga maupun gabungan.

Pesantren menaungi beberapa lembaga — MI, MD, MTs, Mu'allimin — dalam satu pesantren (root `lembaga kode=PESANTREN`). Tiap lembaga punya `tahun_ajaran`, `kurikulum`, `kelas`, pegawai sendiri; sebagian santri aktif di >1 lembaga (mis. MTS + MD, paket MI-MD).

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
| NFR-02 | 3.000 santri aktif; `per_page=50` + opsi "Semua" (`per_page=0`, batas 100.000) |
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
| Desktop Admin G0-G1 | 001-004, 100 PSB Penerimaan, 101 Santri Master, 102 Siklus Santri | CRUD penuh referensi, PSB, santri/siklus | `control id snake_case`, `per_page=50` + "Semua", tangani 401/403/422/429 |
| Mobile Kasir G2 | DITUNDA — menunggu perumusan ulang modul keuangan | — | Sama |
| Mobile Ortu G3 | 100 daftar, 203 Portal Wali subset | Daftar + ajukan/batal | Sama |
| Pasca TBD | 200 Pegawai, 201 Kurikulum-Mapel, 202 Nilai-Rapor, 500+ | Pegawai, nilai, presensi | TBD |

### 7.1 Prinsip
- Bahasa Indonesia di seluruh label, toast, dan aria; `id` elemen `snake_case` (NFR-05); nilai DB snake_case dipetakan ke label tampil (mis. status PSB).
- Angka memakai format Indonesia (`id-ID`); tanggal memakai locale `id-ID`.
- Tanpa internet: font dibundel lokal, token dihitung runtime — tambah tema tanpa sentuh CSS.

### 7.2 Tema, mode, dan token
- 25 preset tema (termasuk Hijau Pesantren bawaan dan set populer ala VSCode); tiap tema berisi palet terang + gelap + warna sidebar.
- Mode Terang/Gelap/Sistem (sistem mengikuti OS) + varian Kaya warna (netral/aksen/kaya); bawaan: tema `geist`, mode sistem, warna kaya.
- Teks tombol dihitung otomatis (kontras ≥4,5:1); ikon header/ribbon/sidebar/akun mengikuti warna aksen; border global lembut (12% via color-mix, tanpa shadow kartu); radius seragam 4 px.
- Token runtime per bagian (~100 id: tabel, form, dialog, toast, sidebar, dsb.) — font, ukuran, radius, padding, warna per mode; fallback CSS bila standar belum diatur.

### 7.3 Navigasi
- Dua mode per perangkat: sidebar rail (lipat ke ikon via tombol & Ctrl/Cmd+B, 5 grup) atau menubar; pemilih di submenu Navigasi pada menu akun, sejajar submenu Tema (25 pilihan), Set ikon (9 set), dan Kaya warna.
- Menu akun kanan atas: pengalih lembaga aktif, tahun ajaran aktif, strip mode terang/gelap/sistem, lalu keluar.
- Bar judul halaman + baris tools kontekstual; halaman menyumbang tools via slot (tab ganda bila halaman + tabel sama-sama punya tools); tombol lipat baris tools per perangkat.

### 7.4 Tabel (pola Excel)
- Wrapper tunggal `ExcelTable`: seleksi gaya spreadsheet, resize kolom drag, AutoFit (klik-2× gagang, klik-kanan header, atau semua kolom), edit klik-2× langsung simpan, salin blok TSV siap tempel ke Excel.
- Kerapatan Ramping/Sedang/Nyaman (20/24/30 px) + tinggi baris manual; bekukan N kolom; tinggi header otomatis mengikuti judul multibaris; ukuran huruf sel (bawaan 11 px) dan header (bawaan 11 px) mandiri.
- Preset kolom per tabel (bawaan "Lengkap" terkunci + buatan user, multi-generate per lembaga); pilihan terakhir diingat per user.
- Aksi baris ≤3 tampil langsung, >3 diringkas ke dropdown titik-tiga; pagination 10/50/100/500 + "Semua"; skeleton saat muat, teks "Belum ada data." saat kosong.

### 7.5 Komponen dan umpan balik
- Basis Radix + shadcn (tombol, dialog, dropdown, select, checkbox, tooltip, skeleton, dsb.); stepper vertikal/horizontal untuk angka; combobox preset kolom dengan dialog kelola.
- Dialog konfirmasi hapus, dialog pratinjau (import/samakan), toast sukses/gagal Bahasa Indonesia di tengah atas.
- Form tambah/ubah berupa modal; tombol utama kanan atas halaman.

### 7.6 Font
- Bawaan tabel: Roboto Light (300), sel dan header masing-masing 11 px; UI: Aptos (isi), display (judul), Aptos Narrow, monospace kode.
- 29 opsi font (sistem + Aptos + Google Fonts yang disimpan lokal sehingga offline); pilihan tersimpan per perangkat dan tersinkron antara ribbon dan halaman Tampilan.

### 7.7 Pengaturan tampilan
- Halaman Tampilan (pribadi): cari bagian, pratinjau langsung, reset per bagian/banyak/semua; badge "Standar lembaga · versi N" + tombol kembali ke standar bila admin menyebar standar.
- Halaman Standar (super_admin): sebar satu paket tampilan ke lembaga terpilih; klien memantau versi dan memuat ulang otomatis.

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

SIMPES; santri; lembaga (MI=SD formal, MD=SD non-formal paralel, MTS=SMP, MLN=Aliyah beda nama; kode hardcoded; PK id INT); tahun_ajaran; kelas; pegawai/guru; 6 peran (`super_admin, admin, guru, orang_tua, santri, asrama` — efektif 5 sekarang; `asrama` pasca production, `kasir` dihapus sementara v2.38); PSB (`is_seleksi`); riwayat_belajar; asrama (entitas sendiri — bukan `lembaga`; kamar, penghuni, izin pulang, kegiatan; pasca production); pengurus asrama (peran `asrama` + pivot `user_asrama`); santri legacy (tanpa jejak riwayat).

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

## Lampiran G — Operasional Agen (indeks; salinan dari AGENTS.md + `.opencode/`)

> Catatan penyimpanan: `AGENTS.md` (root/backend/frontend) ikut repo; `.opencode/`
> masuk `.gitignore` (konfigurasi lokal — tidak terbawa clone). Lampiran ini
> memastikan isi operasional penting tetap terdokumentasi di PRD.

### G.1 Aturan tetap agen
- UI & docs Bahasa Indonesia; `id` elemen `snake_case` (NFR-05).
- Commit: agen wajib menawarkan (bukan menunggu diminta) hanya bila `git status`
  kotor DAN salah satu pemicu: (1) pindah topik — tawarkan SEBELUM eksekusi topik
  baru; (2) ±5 permintaan berfile sejak commit terakhir; (3) akan ada perubahan
  besar (>5 file / ±150 baris / fitur-migrasi-API / lintas modul); (4) sisa kotor
  sesi sebelumnya di awal sesi baru. Format `<tipe>: <ringkasan Indonesia>`,
  satu commit = satu perubahan logis; tanpa rahasia/artefak.
- Akun reviewer `super_admin` AKTIF selama pra-production (detail kredensial di
  `AGENTS.md` root; dibuat ulang bila hilang akibat reset DB; dinonaktifkan
  permanen saat production).
- Playwright/browser otomatis wajib persetujuan pengguna; nyala/mati
  `artisan serve` + `vite dev` boleh tanpa konfirmasi; hapus screenshot
  sementara di root repo boleh tanpa konfirmasi.
- Backend: ikuti panduan Laravel Boost (`backend/AGENTS.md`); migrasi via
  `php artisan make:*`; gaya via Pint; uji via PHPUnit (narrowest dulu).

### G.2 Slash command lokal (`command/`)
- `/ui-review` — proses anotasi visual UI + console error lalu perbaiki per nomor;
  input berupa JSON anotasi tempelan (`elemen[]` + `gambar[]`); verifikasi
  `typecheck` + `build` (+ test backend bila tersentuh); tutup dengan ringkasan
  selesai vs butuh klarifikasi.

### G.3 Skills aktif (`skills/`) — dipakai saat pemicunya muncul
| Skill | Dipakai saat |
|---|---|
| `laravel-best-practices` | Tulis/review/refactor kode Laravel (controller, model, migrasi, policy, job, query) |
| `shadcn` | Tambah/cari/perbaiki komponen shadcn, registri, preset |
| `ui-styling` | Bangun UI shadcn/Tailwind, tema, dark mode, layout responsif |
| `ui-ux-pro-max` | Desain/review/perbaiki antarmuka + aksesibilitas + tipografi + chart |
| `design-system` | Token desain, spesifikasi komponen, slide strategis |
| `design` | Logo, CIP + mockup, slide, banner, ikon, foto sosial |
| `banner-design` | Banner sosmed/iklan/hero/cetak |
| `slides` | Presentasi HTML + Chart.js |
| `brand` | Voice, identitas visual, kepatuhan brand |
| `tauri-v2` | Konfigurasi Tauri, command Rust, IPC, permissions, build desktop/mobile |
| `vercel-react-best-practices` | Optimasi performa React/Next.js |
| `find-skills` | Cari/install skill baru saat butuh kemampuan tambahan |

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
                      ┌─────────────────────────────┐  backend/
                      │   Backend (Laravel 13 API)  │
                      │    Sanctum tokens, /api/*   │
                      └──────────────┬──────────────┘
       ┬──────────────┬──────────────┼──────────────┬──────────────┬
       ▼              ▼              ▼              ▼              ▼
 admin-desktop      kasir         orangtua       pimpinan         guru
     -tauri        -mobile        -mobile        -mobile        -mobile
   (Tauri 2)         (RN)           (RN)           (RN)          (RN)
```

All frontends are separate projects under `frontend/` (never merged):

| App | Folder | Stack | Users |
|---|---|---|---|
| Admin desktop (primary) | `frontend/admin-desktop-tauri` | Tauri 2 | super_admin, admin |
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
HR-academic → grades → presensi → tahfizh → wali portal (23 file hasil squash).
MySQL 64-char index pitfall: 4 composite uniques use short `uq_*` names.
Status: ✅ `migrate:fresh` green (100 tables incl. framework/package tables).

**003 Authentication & users.** Multi-identifier login (email/phone/username),
password minimal 8 karakter, throttle + `login_audits`, 5 peran efektif (`kasir` dihapus sementara),
kunci diri (tak boleh ubah/cabut role sendiri, tak boleh hapus diri sendiri),
ganti role mencabut semua token (wajib login ulang), anti-eskalasi
(non-`super_admin` 403 memutasi/menghapus pemegang `admin`/`super_admin`),
act-as lembaga via header `X-Lembaga-Aktif`, `UsersImport` (flat keys, intra-file
dedup, `lembaga_ids[]` pivot sync), `UserPolicy`.
API: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`,
`GET|POST /api/admin/users`, `PUT|DELETE /api/admin/users/{user}`,
`POST /api/admin/users/import`, role assign/remove,
`POST|DELETE /api/admin/users/{user}/lembaga` (attach/detach, multi-lembaga).
Status: ✅ live.

**Dashboard (ekstra, di luar vault — didokumentasikan v1.3.2).**
`GET /api/dashboard/ringkasan` (`auth:sanctum`, semua peran, scope tenant +
opsional `?lembaga_id=`): hitungan `lembaga/pengguna/tahun_ajaran_aktif/kelas`
+ daftar tahun aktif. Bukan executive dashboard 504. Slot `santri`,
`antrean_psb` = null (placeholder modul lanjutan).

**004 Reference & master data.** 34 kamus tables (global row
`lembaga_id=null` + per-lembaga rows; shadow = on/off only for globals),
`RefService::effective()/kodeAktif()/forget()` (cached), urut tampil
`urutan` ASC tie-break `nama` ASC, `ReferensiSeeder`
(decision no.51 values), `Lembaga/TahunAjaran/Kelas` CRUD with tenant scope.
Aturan kamus: baris global diubah hanya `super_admin`; baris lembaga hanya
tenant pemilik; `kode` tak boleh diubah (kunci data), `nama` boleh; duplikat
kode/nama per scope → 422; global dihapus = shadow off per lembaga (bukan
fisik), milik lembaga = nonaktif, pulihkan hanya baris lembaga.
Aturan lembaga: tambah hanya `super_admin`; `kode/npsn/nsm` unik;
`kelompok_psb` combo hanya untuk kode MI/MD.
Aturan kelas: nama dinormalisasi (trim + rapat spasi), unik per
lembaga+tahun ajaran (case-insensitive, pre-check + tangkap 1062);
`kapasitas` minimal 1; `tingkat` harus dikenal di kamus efektif;
TA harus efektif; `kelas_id` menerima nama/id.
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
"tidak memiliki"). Aturan pendaftaran: santri baru wajib tingkat entry
(MI/MD = 1, MTS = 7, MLN = 10), pindahan dari daftar tingkat yang diizinkan;
eksklusif (non-combo) tak boleh daftar ganda aktif, combo MI/MD maks 2
pendaftaran aktif; `no_pendaftaran` unik global (gagal 1062 generate ulang,
maks 3×); `cekNik` mengembalikan boolean saja (anti enumerasi); promosi
waiting→baru hanya bila kuota tersisa. Aturan kegiatan-gelombang: 1 kegiatan
per tahun ajaran, satu kegiatan aktif (aktifkan = matikan lainnya); gelombang
`tgl_tutup` ≥ `tgl_buka`, anti-overlap dalam kegiatan yang sama; hapus
kegiatan/gelombang ditolak bila sudah ada pendaftar. Status: ✅ live
(fitur tests hijau, suite 186/186). Captcha + PDF bukti ditunda.

**101 Santri master.** 74-column EMIS profile; NIK/NISN index-only + service
dedup; `updateOrCreate` only when NIK present (+ intra-file guard);
`status_global` bool (false iff ALL riwayat non-active);
`SantriPolicy` (guru excluded from admin list).
Aturan identitas: `nama_lengkap` + `jk` (L/P) wajib; NIK/No.KK/NIK ortu-wali
`digits:16`; NISN `digits:10`; NIS/nis_lokal maks 20 karakter; `nis_lokal` dan
`nis_kemenag` unik per lembaga (string kosong diabaikan); maks 1 baris aktif
per santri+lembaga. NISK: pola NSM(12 digit)+YY+4 digit akhir `nis_lokal`,
butuh `nis_lokal` terisi + tahun diterima, unik per lembaga.
Foto profil `jpg/jpeg/png` maks 2.048 KB.
Import satu pintu: template-data-periksa-eksekusi; berkas `xlsx/xls/csv` maks
10.240 KB; tulis gabungan butuh
`santri.tambah` DAN `santri.ubah`; pencocokan 4 lapis (santri_id eksak → NIK →
nis+lembaga → create wajib nama); sel kosong = pertahankan (tanpa pengosongan
via file); NIK kosong selalu create; kunci lembaga `kode_lembaga`
(case-insensitive) prioritas, fallback `lembaga_id`; baris luar tenant gagal
per baris (bukan 403); sel numerik/serial tanggal dinormalisasi sebelum
validasi; hanya sheet pertama (sheet Referensi diabaikan).
Samakan NIS MI↔MD: salin hanya bila tepat satu sisi bernomor + sisi tujuan tak
tabrakan; beda dua sisi / tabrakan hanya dilaporkan (tanpa auto-copy).
Status: ✅ live (CRUD scoped, import satu pintu identitas+gabungan, kamus, foto/dokumen, kolom NIS per lembaga, samakan NIS MI↔MD; suite 186/186).
Tambahan vs vault: mapping import penuh (tanpa drop diam-diam), `uploadFoto`,
`tipe_santri` rule, `kewarganegaraan` default WNI, kolom `kelas_id` menerima
nama kelas/id (dropdown template per lembaga+TA). Recalc `status_global` tetap di 102.

**Preset tampilan kolom tabel (lintas modul).** Combobox di toolbar setiap tabel
(`ExcelTable`) berisi bawaan "Lengkap" + preset buatan user; preset menyimpan
daftar kolom (`preset_tabel.kolom`) per tabel & per lembaga. Saat membuat preset,
user dapat memilih satu atau beberapa lembaga tujuan (multi-generate); tiap lembaga
lalu dapat mengedit salinannya sendiri. Pilihan terakhir per user per tabel diingat
di `preset_tabel_aktif`. Salin TSV mengikuti kolom yang terlihat. Preset
`lengkap` dikunci sistem; preset global hanya admin pesantren; nama unik per
tabel+lembaga.
Status: ✅ live.

**Aksi baris tabel (lintas modul).** Bila jumlah tombol aksi baris lebih dari 3,
otomatis diringkas menjadi dropdown (ikon titik-tiga vertikal) berisi seluruh aksi +
labelnya; 1–3 aksi tetap tampil langsung. Berlaku di semua tabel `ExcelTable`.

**Baris per halaman + "Semua" (lintas modul).** Opsi 10/50/100/500 + "Semua",
bawaan 50 per tabel; "Semua" dikirim `per_page=0` (batas 100.000), pager tetap
tampil agar bisa dikembalikan. Status: ✅ live.

**Pengaturan server (lintas modul).** Halaman pengaturan ganti base-URL backend
tanpa rebuild (token/base-URL via plugin-store di desktop); aksi uji koneksi +
kembalikan bawaan; izin `server.lihat` eksklusif `super_admin`. Status: ✅ live.

**Tampilan standar (lintas modul).** Sebaran standar tampilan ke lembaga
(`lembaga_ids` wajib; lembaga tak teresolusi → 422); izin `tampilan_standar.lihat`
eksklusif `super_admin`. Status: ✅ live.

**102 Santri lifecycle.** `riwayat_belajar` (`status_awal`: santri_baru/
mengulang/pindahan; `status_akhir`: aktif/naik/tidak_naik/pindah_keluar/
lulus/tidak_lulus; `is_aktif` true iff `aktif`; semester 1/2; per-item mass
promotion with `{berhasil, gagal[]}`); graduation via `alumni` (last-wins),
exit via `mutasi_keluar`; package-aware (`nonAktifkanRiwayat`).
Status: ✅ live (salin genap, naik/pindah/mutasi/lulus/berhenti massal per-item, halaman MI-MD tambah/hapus massal, beku kelas arsip; suite 186/186). Gerbang AND per-lembaga target
(canAccess + riwayat-aktif). `pindah_keluar` ikut seeder no.51; `tidak_lulus`
buka baris mengulang tapel-berikut (tanpa alumni).
Aturan penghapus: **X di halaman MI-MD = hapus fisik** jejak MD (anggota +
riwayat) tanpa arsip; pengarsipan resmi hanya lewat mutasi/kelulusan.
Aturan beku kelas arsip: `alumni.kelas_lulus_id` terisi otomatis dari riwayat
aktif terakhir saat lulus; `mutasi_keluar.kelas_terakhir_id` beku otomatis
dari riwayat aktif terakhir, input manual menang bila diisi (validasi
`nullable|exists:kelas,id` — sebelumnya input selalu terbuang).
Aturan rombel: `no_absen` unik per (kelas, tahun ajaran, semester), minimal 1;
kelas tujuan se-lembaga + se-TA, tingkat cocok bila keduanya terisi; hanya
riwayat aktif yang bisa diset/dipindah/dikosongkan kelasnya.
Aturan salin genap: wajib dari baris aktif semester 1; tolak bila baris
semester 2 tahun sama sudah ada. Aturan kenaikan: wajib dari semester 2 aktif;
`tidak_lulus` wajib TA berikut sudah ada (tingkat diwarisi, keanggotaan tetap
aktif). Daftar ulang jenjang: baris nonaktif lama tak diaktifkan ulang (buat
baris baru) kecuali reaktivasi arsip sendiri ber-NIS sama.
Import riwayat: upsert kunci (santri, TA, lembaga, semester); semester hanya
1/2; kelas by-nama (case-insensitive) atau id se-lembaga+TA; `status_awal`
bawaan `santri_baru`, `status_akhir` bawaan `aktif`; keanggotaan auto-create
(NIS unik); `is_active` parsing `1/0/aktif/ya/…`, tak dikenal = gagal baris.

**Pengajuan biodata (admin).** Antrean pengajuan perbaikan biodata dari wali:
setujui/tolak hanya untuk status `diajukan`; whitelist 17 field (luar daftar
ditolak); maks 1 antrean per santri; NIK hanya boleh diproses admin full;
setujui NIK didedup `nik+nama+tgl_lahir` kecualikan diri sendiri; batal hanya
oleh pemilik saat masih `diajukan`. Status: ✅ live (terpisah dari portal 203 🟡).

**Dokumen wajib.** Ketentuan dokumen per kegiatan PSB × lembaga; bersifat
penekanan — tidak menahan daftar ulang; saat ACC baris checklist dibuat
(boleh ditandai "tidak memiliki"). Jenis dokumen harus aktif di kamus lembaga;
berkas calon/santri `mimes:jpg,jpeg,png,pdf` maks 5.120 KB. Status: ✅ live.

**Tahun ajaran (perilaku).** Selalu milik lembaga operasional (root ditolak di
store/aksi/import); `nama` unik global; TA aktif tak boleh dihapus/disembunyikan;
hanya TA global bisa diaktifkan (satu aktif per transaksi); sembunyikan = baris
bayangan nonaktif per lembaga. Set-aktif/sembunyikan global hanya `super_admin`.
Status: ✅ live.

**Halaman MI-MD.** Tiga panel: MI Only, MD Semua (+ flag juga-MI), Beda Kelas
(perbandingan by-nama case-insensitive, null = ''). Aksi: daftarkan ke MD
(NIS warisi MI, `tgl_mulai` hari ini, idempoten), hapus fisik jejak MD
(izin `santri.ubah`; ditolak bila bukan-MI-aktif / tanpa anggota MD / ada arsip
alumni-mutasi MD), samakan kelas (pindah ke kelas senama di TA berjalan sisi
tujuan, butuh akses tulis tujuan). **Pengecualian tenant sadar**: akses MI atau
MD membuka kedua sisi — hanya di endpoint halaman ini; tulis tetap sisi target.
Izin halaman memakai ulang `rekap_santri.lihat`. Status: ✅ live.

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

Users: super_admin, admin. Full CRUD: users/roles (+ matriks Kelola Izin), lembaga, tahun ajaran,
kelas (Ambil/Copy antar lembaga, import/export nama), 34 kamus (global vs lembaga
views), PSB antrean (verify/seleksi/ACC/tolak/paket), santri master + import satu pintu
(kolom NIS per lembaga, samakan NIS MI↔MD), siklus (roster, salin genap, naik/pindah/mutasi/lulus/berhenti),
rekap, halaman MI-MD (tambah/hapus massal, samakan kelas), pengajuan biodata (setujui/tolak),
dokumen wajib, preset tabel, pengaturan server/tampilan.
Status: 🟢 shell v0.5.0 live (Tailwind+shadcn: 20 tema ala VSCode data-driven + kustom, Gelap/Terang/Sistem per perangkat, galeri pratinjau, border lembut tanpa shadow, navigasi menubar/ribbon/sidebar per perangkat, pagination 10/50/100/500 + "Semua", dialog/toast/skeleton). Tabel master memakai `react-datasheet-grid` lewat wrapper `ExcelTable` (seleksi gaya spreadsheet, resize + AutoFit, edit klik-2× langsung simpan, aksi baris >3 jadi dropdown, preset kolom per tabel) dengan kontrol global ukuran/tinggi/jenis huruf; **Google Fonts disimpan lokal di repo** (`src/assets/fonts`, 8 keluarga × Light/Regular) sehingga aplikasi berjalan **tanpa internet** — dihasilkan ulang via `scripts/fonts-offline.py`. Desktop Tauri 0.5.0 dibangun (`.app` 11 MB, `.dmg` 4 MB, aarch64, belum ditandatangani); build desktop hanya dijalankan bila diminta. Belum: modul 200+ (pegawai/kurikulum/nilai), Fase 5, portal ortu lanjutan.

#### 6.2 `frontend/kasir-mobile-react-native`

Users: kasir (+admin). Scope: DITUNDA — menunggu perumusan ulang modul keuangan dari awal.
Offline: queue-and-sync for payments is OUT (online only, race safety).
Status: 🔲 not scaffolded.

#### 6.3 `frontend/orangtua-mobile-react-native`

Users: orang_tua. Scope (203): children list → detail (profil, kelas,
nilai/rapor, presensi poin, tahfizh rekap), ajukan/batalkan
biodata edits (whitelist fields, NIK needs full-admin), PSB lanjutan for
registered NIK, document upload status. Read-only except proposals/uploads.
Status: 🔲 not scaffolded (backend 203 pending).

#### 6.4 `frontend/pimpinan-mobile-react-native`

Users: pimpinan. This is NOT an admin app — it is a read-only statistics app
for strategic decisions. Scope (504): total santri keseluruhan, santri per
lembaga, enrollment per gelombang, jumlah guru, kehadiran guru, keuangan
(menunggu perumusan ulang modul), kehadiran santri, tahfizh
progress, alumni/mutasi counts. No mutations whatsoever.
Status: 🔲 not scaffolded (backend 504 closed).

#### 6.5 `frontend/guru-mobile-react-native`

Users: guru. Scope: my classes (walas + pengampu), anggota kelas
(from active riwayat), nilai input per pengampu (massal per-item),
catatan wali, presensi sesi (when 500 opens), jadwal mengajar (when 502
opens), setoran tahfizh input (when 503 opens).
Status: 🔲 not scaffolded (backend 201/202 pending).

### 7. Data model summary

* Tenant: `lembaga` tree (`parent_id`, root `kode=PESANTREN`); `user_lembaga`
  pivot is the ONLY tenant store. Pengecualian tunggal: pasangan MI↔MD di
  halaman MI-MD (akses salah satu membuka kedua sisi baca; tulis tetap sisi
  target). Tulis gabungan butuh `santri.tambah` DAN `santri.ubah` (dua
  middleware = AND).
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
* See live contract: `php artisan route:list --path=api` (144 routes, 101 di grup admin).

### 9. Non-functional requirements

* Concurrency: `lockForUpdate` on kuota/nomor/riwayat;
  1062 retry (max 3–4) with re-read.
* Security: Sanctum tokens, throttle login (6/min) + `login_audits`,
  no privilege escalation (`assignableRolesFor`), tenant AND-checks on writes.
* Data: `migrate:fresh` allowed pre-production (no backfill); seeds via
  `ReferensiSeeder` (no.51) + `RoleSeeder` (5 roles efektif; `kasir` dihapus sementara).
* MySQL: index names ≤64 chars (`uq_*` short names); multi-NULL uniques
  guarded in service, not relied on.

### 10. Implementation status matrix

| Area | Spec | Migrated | Seeded | API live |
|---|---|---|---|---|
| 001 setup | ✅ | n/a | n/a | n/a |
| 002 schema (23 migrasi hasil squash) | ✅ | ✅ | n/a | n/a |
| 003 auth/users | ✅ | ✅ | ✅ roles | ✅ |
| 004 ref/master (34 kamus, lembaga/TA/kelas) | ✅ | ✅ | ✅ no.51 | ✅ |
| 100 PSB full (daftar, paket MI-MD, verify/seleksi/ACC, portal, dokumen, import) | ✅ | ✅ | ✅ no.51 | ✅ (publik + admin + portal; suite 186/186) |
| 101 Santri (CRUD, import satu pintu, kamus, policy, kolom NIS, samakan NIS) | ✅ | ✅ | — | ✅ (suite 186/186) |
| 102 Siklus (salin genap, naik, pindah, mutasi, lulus, roster + arsip, halaman MI-MD, beku kelas) | ✅ | ✅ | — | ✅ (suite 186/186) |
| 200/201/202/203 | ✅ specs | ✅ tables | — | 🔲 |
| Fase 5 (500–505), infra (900–901) | 🔲 drafts | ✅ tables | — | 🔲 |
| 5 frontend apps | §6 above | n/a | n/a | ✅ 1 live (`admin-desktop-tauri`), 4 🔲 |

### 11. Roadmap

1. Inti ✅ live (100/101/102 + matriks izin + import satu pintu + halaman MI-MD): pemeliharaan + pengerasan (audit log review, load test, runbook backup/restore).
2. Berikutnya bila diminta: modul 200 → 201 → 202 → 203 (tiap modul: service + policy + controller + tests), lalu Fase 5 + infra (500–505, 900–901).
3. Aplikasi admin desktop tetap satu (`admin-desktop-tauri`); 5 aplikasi lain dibuka sesuai modul backend-nya.
4. `kelas_lulus_id` alumni sudah live (v2.52). **Modul keuangan (termasuk peran
`kasir`) dirumuskan ulang dari nol dan dikerjakan PALING AKHIR — tahap terakhir
sebelum production** (cakupan: jenis transaksi, metode bayar, peran loket
ditentukan saat tahap itu dimulai; tidak dibahas sekarang agar tidak merusak
susunan yang berjalan).

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
