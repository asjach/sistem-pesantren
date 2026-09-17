# Part A — Dokumentasi Proyek (ID) — Sistem Informasi Manajemen Pesantren (SIMPES)

| Atribut | Keterangan |
|---|---|
| Versi Dokumen | 2.65 (urut via dropdown) |
| Tanggal | 17 September 2026 |
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
| 2.65 | 2026-09-17 | Urut pindah ke dropdown toolbar (klik header dilepas, indikator jadi pasif); opsiUrut dukung item gabungan + label kustom (Keanggotaan: +JK-Nama); typecheck + build lolos |
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

Lihat Lampiran D. Inti: `lembaga` (root PESANTREN + MI/MD/MTS/MLN), `tahun_ajaran`, `kelas` (`walas_id→pegawai`), 6 peran (`super_admin, admin, guru, orang_tua, santri, asrama` — `asrama` pasca production; `kasir` dihapus sementara v2.38), matriks izin (`IzinKatalog`), `riwayat_belajar`, `asrama` (entitas sendiri, bukan lembaga; pasca production).

### 1.6 Referensi

- Wawancara pengurus (Agu 2026), kurikulum 2026/2027, tata tertib.

---
