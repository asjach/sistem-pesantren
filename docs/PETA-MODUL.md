# PETA MODUL — Status & Rencana Terpusat

> **Satu-satunya tempat** untuk menjawab "modul ini sudah sampai mana, sedang
> apa, dan akan apa". Dokumen lain (PRD, arsitektur, backend-detail, operasi)
> **tidak lagi** memuat daftar status/rencana — mereka hanya menunjuk ke sini.
>
> Berkas ini adalah **turunan** dari papan proyek di database; lihat "Cara kerja
> papan" di bawah. Jangan mengubah status di sini secara manual.

- **Terakhir diperbarui:** 2026-10-19
- **Aturan menulis:** status dikelola lewat **papan proyek** di database
  (`backend/database/papan.sqlite`, koneksi `papan`), bukan dengan menyunting
  berkas ini. Berkas ini adalah **turunan** dari papan.
- **Aturan mengisi:** tiap deskripsi **1–2 kalimat**, bukan daftar fitur. Rincian
  teknis butir sisa ada di bagian H (sedang) dan I (lainnya).

## Cara kerja papan (sejak 2026-10-19)

Papan hidup di SQLite **terpisah** agar tidak terhapus `migrate:fresh` DB
pesantren. Cetak birunya ada di kode, jadi bisa dibangun ulang kapan saja:

```bash
php artisan migrate --path=database/migrations/papan --database=papan
php artisan db:seed --class=PapanSeeder
```

Sehari-hari, status dibaca dan diubah lewat command — bukan menyunting markdown:

| Perintah | Guna |
|---|---|
| `php artisan papan:lihat` | Daftar modul, sub-modul, dan poinnya (dengan sebaran status) |
| `php artisan papan:lihat E.3` | Satu sub-modul saja |
| `php artisan papan:lihat --riwayat` | Riwayat perpindahan status poin |
| `php artisan papan:tandai E.3 128 in_progress --catatan="..."` | Pindahkan satu **poin** |
| `php artisan papan:butir tambah E.3 --deskripsi="..."` | Tambah poin |
| `php artisan papan:butir ubah E.3 --id=128 --deskripsi="..."` | Ubah teks poin (tambahkan `--status=` bila statusnya ikut) |
| `php artisan papan:butir naik E.3 --id=128` | Geser poin satu langkah ke atas |
| `php artisan papan:butir turun E.3 --id=128` | Geser poin satu langkah ke bawah |
| `php artisan papan:butir hapus E.3 --id=128` | Hapus poin |
| `php artisan papan:sebut --kode=E.3 --nama="..."` | Ganti nama/kode sub-modul (`--kode-baru=` untuk kodenya) |
| `php artisan papan:sebut --modul=E --kode=E.9 --nama="..." --buat` | Tambah sub-modul baru |
| `php artisan papan:sebut --kode=E.9 --hapus --yakin` | Hapus sub-modul beserta poinnya |
| `php artisan papan:markdown` | Pratinjau markdown hasil papan (tidak menulis) |
| `php artisan papan:markdown --tulis` | Tulis ulang berkas ini dari papan |

**Menyunting isi lebih lengkap lewat aplikasi.** Halaman **Papan** punya tombol
*Kelola sub-modul & poin* (ganti nama/kode atau tambah/hapus sub-modul, tambah
poin baru) dan panel rincian tiap kartu (ubah teks, pindah status, geser urutan,
hapus poin). Sisi tulisnya butuh izin `papan.ubah`; tanpa izin itu halaman tetap
terbaca penuh, hanya tanpa kontrol sunting.

**Bedanya dengan seed ulang — penting.** Menyunting lewat aplikasi **tidak**
menyentuh poin lain: poin tetap punya id dan status yang sama. Sebaliknya
`db:seed --class=PapanSeeder` **menghapus lalu membuat ulang** semua poin, jadi
id berubah dan seluruh status hasil kerja kembali ke cetak biru. Pakai seeder
hanya untuk membangun ulang papan dari nol.

**Yang bergerak itu poin, bukan sub-modul.** Setiap poin berstatus sendiri
(belum dijadwalkan (`backlog`) | siap dikerjakan (`todo`) | sedang dikerjakan (`in_progress`) | menunggu peninjauan (`for_review`) | selesai (`done`)), dan status
sub-modul **dihitung otomatis** dari poin-poinnya. Pekerjaan aktif didahulukan,
disusul siap dikerjakan (To Do), belum dijadwalkan (Backlog), dan menunggu
peninjauan (For Review); sub-modul menjadi selesai (Done) hanya bila semua
poinnya sudah selesai (Done).

Konsekuensinya, di UI satu sub-modul bisa muncul di beberapa kolom sekaligus —
memang begitu yang diinginkan: `E.3` yang separuh selesai tampil sebagai kartu di
kolom **Selesai (Done)** dan **Siap dikerjakan (To Do)** bersamaan.

Modul di berkas ini **dihasilkan** `papan:markdown --tulis`; bagian SEDANG
DIKERJAKAN dan RINCIAN TEKNIS LAINNYA dipertahankan apa adanya. Jadi setelah
mengubah status lewat command, jalankan `--tulis` supaya berkas ini ikut segar,
lalu commit markdown-nya sebagai jejak yang tahan lama.

**Status alur kerja (workflow):** status efektif = pengaturan utama (master) + penanda aplikasi (flag); cek di Board. Alur kerja (workflow) hanya menjadi rujukan agen/pengguna untuk aplikasi yang status efektifnya **Aktif**; saat **Draf**, PRD dan kode yang berlaku.

## Cara baca

Lima status alur kerja (workflow) dipakai konsisten di seluruh berkas:

- **Belum dijadwalkan (Backlog)** — belum siap dijadwalkan atau masih ditahan.
- **Siap dikerjakan (To Do)** — siap dikerjakan.
- **Sedang dikerjakan (In Progress)** — sedang dikerjakan.
- **Menunggu peninjauan (For Review)** — implementasi selesai dan menunggu peninjauan.
- **Selesai (Done)** — pekerjaan dan seluruh subpoin sudah selesai.

Status yang tidak berlaku ditulis **(kosong)** agar tidak tampak terlewat.

---

# Aplikasi: Desktop Admin

## DA1. Fondasi & Infrastruktur

### DA1.1 Setup & Runtime `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Proyek Laravel 13, Vite, dan Tauri berjalan
  - [x] API-first
  - [x] Sanctum
  - [x] SQLite/MySQL siap
- Konfigurasi dev dan produksi terdokumentasi
  - [x] .env contoh
  - [x] CORS localhost
  - [x] perintah artisan/npm

### DA1.2 Skema Database `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Migrasi dan skema pesantren terkendali
  - [x] 84 file migrasi
  - [x] 126 tabel termasuk framework
  - [x] SCHEMA.md
- Database papan terpisah dari database pesantren
  - [x] koneksi papan
  - [x] migrasi path papan
  - [x] tidak ikut migrate:fresh

### DA1.3 Referensi & Master `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Kamus referensi per lembaga
  - [x] 34 tabel kamus
  - [x] RefService ber-cache
  - [x] fan-out
- CRUD Lembaga, Tahun Ajaran, dan Kelas
  - [x] scope tenant
  - [x] validasi jenjang
  - [x] kode unik

### DA1.4 Pengaturan Aplikasi Desktop `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Pengaturan server dan sesi aman
  - [x] URL API tersimpan
  - [x] Uji koneksi
  - [x] Token di keychain dengan fallback memori
- Folder arsip dan mode dokumen
  - [x] Pilih folder arsip
  - [x] Mode dokumen
  - [x] Peringatan bila akses folder ditolak

## DA2. Autentikasi & Pengguna

### DA2.1 Login & Sesi `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Login multi-identifier
  - [x] email/HP/username
  - [x] throttle 6/menit
  - [x] login_audits
- Kunci diri dan anti-eskalasi
  - [x] tidak bisa hapus diri
  - [x] role tidak naik sendiri
  - [x] kebijakan izin

### DA2.2 Peran & Izin `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Lima peran efektif dan matriks izin
  - [x] super_admin/admin/guru/orang_tua/santri
  - [x] IzinKatalog
  - [x] PermissionSeeder
- Mode lembaga dan pesantren
  - [x] X-Lembaga-Aktif
  - [x] scope tenant
  - [x] act-as

### DA2.3 Akun PTK `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Undangan dan aktivasi akun guru
  - [ ] email/WA
  - [ ] token sekali pakai
  - [ ] reset kata sandi
- Sinkron akun dengan data pegawai
  - [ ] tautan pegawai_id
  - [ ] peran guru/kasir
  - [ ] nonaktif otomatis
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## DA3. PSB & Santri

### DA3.1 PSB `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Master kegiatan, gelombang, dan kuota
  - [x] per lembaga
  - [x] anti-tumpang
  - [x] kuota
- Pendaftaran dua jalur dan tahapan
  - [x] langsung/seleksi
  - [x] verifikasi
  - [x] daftar ulang/ACC/undur
- Aksi massal dan impor
  - [x] promosi calon
  - [x] dokumen
  - [x] impor

### DA3.2 Santri `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- CRUD santri dan NIS
  - [x] SantriPolicy
  - [x] impor satu pintu
  - [x] samakan NIS massal
- Foto dan dokumen santri
  - [x] unggah
  - [x] jenis dokumen
  - [x] viewer

### DA3.3 Siklus Santri `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Naik kelas, pindah, mutasi, lulus
  - [x] massal/otomatis
  - [x] arsip
  - [x] MI-MD
- Roster dan status global
  - [x] riwayat_belajar
  - [x] status turunan
  - [x] beku kelas

### DA3.4 Presensi Santri `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- UI presensi dan pelanggaran
  - [ ] input per sesi
  - [ ] rekap kehadiran
  - [ ] poin pelanggaran
- Pencatatan presensi harian lewat API
  - [ ] Sesi presensi per kelas
  - [ ] Input kehadiran massal
  - [ ] Status hadir/sakit/izin/alpa
  - [ ] Rekap kehadiran per santri
- Poin pelanggaran dan tindak lanjut
  - [ ] Kategori dan bobot pelanggaran
  - [ ] Poin otomatis dari kejadian
  - [ ] Riwayat dan tindak lanjut
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Tabel presensi dan pelanggaran
  - [x] sesi_presensi
  - [x] presensi_santri
  - [x] pelanggaran_santri

### DA3.5 Asrama `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Fondasi asrama
  - [ ] tabel asrama/kamar/penghuni
  - [ ] peran asrama
  - [ ] pivot user_asrama
- Alur izin pulang dan kegiatan
  - [ ] pengajuan
  - [ ] persetujuan
  - [ ] kalender kegiatan
- Kamar dan penempatan santri
  - [ ] Data kamar dan kapasitas
  - [ ] Penempatan dan mutasi kamar
  - [ ] Pembina per kamar
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## DA4. Kepegawaian

### DA4.1 Pegawai `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Master pegawai global
  - [x] EMIS
  - [x] keaktifan_pegawai
  - [x] sertifikasi
- Walas dan akun PTK
  - [x] setWalas tiga lapis
  - [x] penautan akun
  - [x] dokumen

### DA4.2 Presensi Pegawai `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- UI absensi guru
  - [ ] input harian
  - [ ] koreksi
  - [ ] izin/cuti
- Pencatatan presensi pegawai lewat API
  - [ ] Absen masuk dan pulang
  - [ ] Izin dan cuti
  - [ ] Rekap kehadiran per pegawai
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Tabel presensi pegawai
  - [x] presensi_pegawai
  - [x] status harian
  - [x] rekap

## DA5. Kurikulum

### DA5.1 Mata Pelajaran `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Salin daftar mapel antar kelas (TA sama) dengan pratinjau
  - [x] Sumber hanya kelas pada tahun ajaran yang sama
  - [x] Pratinjau mapel yang akan ditambahkan vs dilewati
  - [x] Hindari duplikat: mapel yang sudah ada tidak disalin ulang
  - [x] Verifikasi: KurikulumModulTest 9/9 (169 asersi) + suite FE 1427/1427 + npm run typecheck
- Master mapel dan KKM
  - [x] per jenjang
  - [x] kelompok formal/pesantren
  - [x] urutan rapor

### DA5.2 Pengampu `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Tes komponen halaman Pengampu
  - [ ] tes render
  - [ ] tes validasi
  - [ ] tes izin
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Pivot kelas × mapel → guru
  - [x] validasi bentrok
  - [x] guru aktif
  - [x] per TA

### DA5.3 Jadwal Pelajaran `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Jadwal dari sudut guru
  - [ ] agenda mengajar
  - [ ] filter guru
  - [ ] tampilan mobile
- Cetak/unduh jadwal
  - [ ] PDF
  - [ ] Excel
  - [ ] kop
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Slot per jenjang dan anti bentrok
  - [x] bentrok kelas
  - [x] bentrok guru
  - [x] grid mingguan
- Jadwal per kelas
  - [x] template
  - [x] salin
  - [x] cetak
- Salin jadwal pelajaran dari tahun ajaran lain (sejenjang)
  - [x] Pilih TA sumber; tujuan = TA aktif; lembaga/jenjang harus sama
  - [x] Pratinjau: kelas, slot, pengampu, dan sel jadwal yang akan disalin atau dilewati
  - [x] Hanya kelas yang sudah ada di TA tujuan; kelas lain dilewati dan dilaporkan
  - [x] Slot, pengampu, dan sel jadwal ikut disalin; guru tanpa keaktifan di TA tujuan dikosongkan
  - [x] Sel jadwal yang sudah terisi di TA tujuan tidak ditimpa
  - [x] Verifikasi: KurikulumModulTest 9/9 (169 asersi) + suite FE 1427/1427 + npm run typecheck
- Status Jadwal Pelajaran
  - [x] Status per kelas: "Draft", "Pembahasan", "Final"
  - [x] Status lembaga + tahun ajaran turunan: Final bila SELURUH kelas Final; selain itu Draft/Pembahasan
  - [x] Jadwal kelas Final tidak bisa diubah; harus diubah dulu menjadi Draft
  - [x] Jadwal hasil salin dari tahun ajaran sebelumnya berstatus Draft
  - [x] Verifikasi: KurikulumModulTest 10/10 (192 asersi) + suite FE 1427/1427 + npm run typecheck; ERD divalidasi (9 blok, 0 masalah)
- Varian Jadwal Pelajaran
  - [x] Simpan varian manual: snapshot slot, pengampu, dan sel jadwal + nama
  - [x] Riwayat varian: daftar berisi waktu, pembuat, status, dan ringkasan isi
  - [x] Varian aktif yang dipakai; hanya satu aktif per tahun ajaran + lembaga
  - [x] Mengaktifkan varian memulihkan jadwal dari snapshot (kelas Final dilewati)
  - [x] Verifikasi: KurikulumModulTest 11/11 (215 asersi) + suite FE 1427/1427 + typecheck; ERD 116 entitas/154 hubungan, 0 masalah

### DA5.4 Struktur Kurikulum `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- tabel struktur kurikulum
  - [x] Halaman baru Kurikulum → Struktur Kurikulum
  - [x] Struktur per VARIAN jadwal; combobox memilih varian, termasuk yang tidak aktif
  - [x] Baris = mapel aktif jenjang; kolom = tingkat jenjang
  - [x] JP per minggu dihitung otomatis dari snapshot varian (terbanyak antar kelas satu tingkat); JP per tahun = JP/minggu × minggu efektif
  - [x] Baris terakhir = jumlah per tingkat; combobox menampilkan JP per minggu atau per tahun
  - [x] Minggu efektif per jenjang + tahun ajaran; tabel baca-saja dan hanya referensi (tidak mengunci jadwal)
  - [x] Verifikasi: tes backend + frontend + typecheck; SCHEMA/ERD diselaraskan

## DA6. Penilaian

### DA6.1 Nilai & Peristiwa `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Kunci dan buka kunci nilai
  - [ ] kunci setelah cetak
  - [ ] alasan buka
  - [ ] log audit
- Bobot UJIAN final
  - [ ] UM 60
  - [ ] rata-rata rapor 40
  - [ ] kebijakan pesantren
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- Leger crosstab dan rapor
  - [x] ekspor Excel
  - [x] cetak per santri/kelas
  - [x] rekap
  - [x] Leger memakai ExcelTable baca-saja dengan NIS, Nama, Kelas, kolom mapel dinamis, dan Rata²; pagination, unduh, dan hitung ulang tetap berjalan
  - [x] Judul kolom crosstab memakai kode mapel; kode kosong/duplikat memakai singkatan lalu nama mapel, sementara kunci kolom tetap stabil
  - [x] Penanda nilai hasil impor tetap tampil dan tabel tetap baca-saja
  - [x] Pemeriksaan: typecheck, tes backend/frontend terkait, serta uji kolom dinamis dan pagination hijau
- Halaman Input Manual Nilai Akhir
  - [x] Leger menyediakan input langsung sel mapel lewat Mode Ubah ExcelTable, dengan rail Tingkat/Kelas yang ada
  - [x] Nilai akhir mengikuti rentang peristiwa (0–10/0–100/0–4) dan tersimpan per santri + mapel + peristiwa + semester; sel kosong menghapus nilai; predikat dihitung
  - [x] Nilai manual memakai sumber manual (badge M) dan tidak ditimpa Hitung ulang kecuali paksa; impor tetap I
  - [x] Pengguna tanpa penilaian.ubah tetap baca-saja; mapel tanpa pengampu ditolak
  - [x] Perubahan nilai ditahan selama Mode Ubah dan disimpan sekaligus saat keluar mode, bukan setiap sel berubah
  - [x] Typecheck, tes backend/frontend, serta uji edit/kosongkan di UI hijau
  - [x] Leger menampilkan kolom Jumlah dan Peringkat di akhir kolom; peringkat dihitung per kelas
  - [x] Baris peringkat 1, 2, dan 3 diberi latar hijau, kuning, dan biru dengan teks/nilai tetap terbaca
  - [x] Rentang nilai per peristiwa (0-10/0-100/0-4, default 0-100) dapat dipilih di Leger dan tersimpan
  - [x] Nilai di luar rentang dilewati tanpa menggagalkan input/update lain; sel/baris valid tetap disimpan; toast memuat nama dan mapel
  - [x] Dokumentasi skema dan tes validasi rentang hijau
**Selesai (Done)**
- Nilai per peristiwa
  - [x] PTS/ASAS/ASAT/UJIAN/UAP
  - [x] komponen/bobot
  - [x] sumber nilai
- Impor nilai
  - [x] empat template
  - [x] import-potong
  - [x] validasi

### DA6.2 Cetak Rapor `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Absensi otomatis
  - [ ] sesi_presensi
  - [ ] override leger
  - [ ] rekap kehadiran
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- Cetak massal satu kelas
  - [x] Satu tombol Cetak satu kelas mencetak seluruh santri kelas/peristiwa/semester terpilih dalam satu dialog
  - [x] Opsi peringkat dipilih sekali per batch (3/10/semua); peringkat di luar batas dikosongkan
  - [x] Cetak massal memakai gerbang kelengkapan yang sama; tombol terkunci dengan alasan bila nilai belum lengkap
  - [x] Nama wali kelas dan kepala dibekukan saat batch pertama; cetak massal dan cetak tunggal lingkup sama memakai snapshot; nama kosong diisi data terbaru lalu dibekukan
  - [x] Setiap rapor tercetak pada halaman terpisah dan utuh di A4/PDF
  - [x] Tabel batch terdokumentasi di SCHEMA/ERD dan tes backend/frontend terkait hijau
**Selesai (Done)**
- Rapor per santri/kelas
  - [x] kop
  - [x] identitas
  - [x] nilai + terbilang
- Validasi kelengkapan
  - [x] kelas lengkap
  - [x] tombol cetak terkunci
  - [x] halaman 2

### DA6.3 Tahfizh `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- UI tahfizh
  - [ ] ziyadah
  - [ ] murajaah
  - [ ] rekap per santri
- Target dan setoran tahfizh lewat API
  - [ ] Target per santri
  - [ ] Setoran ziyadah dan murajaah
  - [ ] Rekap capaian per periode
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Tabel tahfizh
  - [x] target_tahfiz
  - [x] setoran_tahfiz
  - [x] rekap_tahfiz_santri

### DA6.X Cetak Kartu Peserta `Menunggu peninjauan (For Review)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- Pengelolaan nomor peserta peristiwa
  - [x] Peserta mengikuti cakupan peristiwa, semester, tingkat, dan kelas
  - [x] Nomor peserta boleh kosong atau diisi manual, unik, dan asalnya tercatat
  - [x] Penyusun pola nomor memakai token dengan contoh hasil langsung
  - [x] Urutan dapat direset per tingkat atau disambung untuk seluruh tingkat
  - [x] Pembuatan nomor hanya mengisi yang kosong dan tidak menimpa nomor manual
  - [x] Pembuatan ulang nomor otomatis bersifat eksplisit dan nomor tetap tersimpan saat dibuka kembali
  - [x] Perubahan struktur data, dokumentasi, dan pemeriksaan terkait terselaraskan
- Perancang desain, ukuran, dan cetak kartu peserta
  - [x] Tersedia beberapa desain bawaan dan desain buatan pengguna
  - [x] Gambar latar, data dinamis, dan teks tetap dapat dipilih
  - [x] Elemen dapat dipindahkan dan diatur pada bidang desain
  - [x] Foto kosong memakai siluet sesuai jenis kelamin
  - [x] Ukuran tersimpan per peristiwa dan lembaga
  - [x] Peserta terpilih atau seluruh peserta dapat dicetak ke A4/PDF
**Selesai (Done)**
- (kosong)

## DA7. Keuangan

### DA7.1 Tagihan & Tarif `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Kartu piutang per santri
  - [ ] lintas TA
  - [ ] surat tagihan
  - [ ] cetak
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Master jenis tagihan dan tarif
  - [x] per lembaga/TA
  - [x] bulanan
  - [x] dispensasi
- Generate tagihan
  - [x] anti duplikat
  - [x] terbayar dilewati
  - [x] kuota
- Crosstab tagihan
  - [x] dispensasi
  - [x] grup custom
  - [x] ekspor

### DA7.2 Kasir & Kwitansi `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Nomor kwitansi runut
  - [ ] per lembaga/kas/tahun
  - [ ] format final
  - [ ] tidak ada hex acak
- Split payment
  - [ ] gabungan metode
  - [ ] sub-bayar
  - [ ] rincian
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Kasir harian
  - [x] pembayaran
  - [x] saldo terkunci
  - [x] batal/hapus
- Kwitansi
  - [x] cetak
  - [x] cetak ulang
  - [x] dialog/tabel

### DA7.3 Rekap & Tutup Buku `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Rekap per posisi kas
  - [ ] tunai TU
  - [ ] bank lembaga
  - [ ] bank pesantren
- Mutasi kas harian
  - [ ] arus masuk
  - [ ] per hari
  - [ ] filter
- Tutup buku
  - [ ] tolak mundur
  - [ ] buka kunci
  - [ ] alasan
- Tarif per asrama
  - [ ] menunggu modul asrama
  - [ ] tarif kamar
  - [ ] penghuni
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

### DA7.4 Tunggakan `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Aging 30/60/90
  - [ ] jatuh tempo
  - [ ] surat tagihan
  - [ ] ekspor
- Pengingat WhatsApp
  - [ ] template
  - [ ] antrean kirim
  - [ ] log
- Tren penerimaan
  - [ ] bulanan
  - [ ] per TA
  - [ ] dasbor
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Crosstab tunggakan
  - [x] per santri/kelas
  - [x] total tagihan
  - [x] terbayar

### DA7.5 Audit & Kontrol `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Jejak audit transaksi
  - [ ] siapa
  - [ ] kapan
  - [ ] alasan
- Maker-checker
  - [ ] pencatat
  - [ ] penyetuju
  - [ ] konflik peran
- Ekspor laporan
  - [ ] Excel
  - [ ] PDF
  - [ ] crosstab/harian/rekap
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## DA8. Portal & Integrasi

### DA8.1 Portal Wali `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Dashboard portal wali
  - [ ] ringkasan anak
  - [ ] tagihan
  - [ ] pengumuman
- Aktor santri
  - [ ] peran santri
  - [ ] rute portal
  - [ ] batas data
- Portal tagihan dan pembayaran anak
  - [ ] Ringkasan tagihan per anak
  - [ ] Riwayat pembayaran
  - [ ] Unduh kwitansi
- Portal akademik dan tahfizh anak
  - [ ] Nilai dan rapor
  - [ ] Presensi harian
  - [ ] Capaian tahfizh
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Jalur PSB lanjutan dan pengajuan biodata
  - [x] satu aktif per santri
  - [x] batal
  - [x] riwayat keluarga

### DA8.2 API Mobile & Publik `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Kontrak API mobile
  - [ ] versi API
  - [ ] token per device
  - [ ] dokumentasi
- Endpoint publik landing
  - [ ] profil
  - [ ] berita
  - [ ] PSB
- Rate limit dan observability
  - [ ] throttle
  - [ ] log
  - [ ] metrics
- Izin bawaan peran guru
  - [ ] Jadwal dan kelas yang diampu
  - [ ] Input nilai
  - [ ] Presensi pegawai
  - [ ] Setoran tahfizh
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

### DA8.3 Notifikasi & Gateway `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Gateway WhatsApp dan email
  - [ ] Penyedia dan kredensial
  - [ ] Antrean pengiriman
  - [ ] Status dan percobaan ulang
- Push notification mobile
  - [ ] Pendaftaran perangkat
  - [ ] Topik per peran
  - [ ] Preferensi pengguna
- Riwayat dan status notifikasi
  - [ ] Log pengiriman
  - [ ] Status dibaca
  - [ ] Penanganan gagal kirim
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## DA9. Production & Operasional

### DA9.1 Deploy `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Deploy VPS dan production
  - [ ] domain
  - [ ] TLS
  - [ ] queue/scheduler
- Migrasi dan rollback
  - [ ] backup
  - [ ] urutan migrasi
  - [ ] rollback
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

### DA9.2 Backup & Restore `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Backup terjadwal
  - [ ] DB pesantren
  - [ ] DB papan
  - [ ] retensi
- Uji restore
  - [ ] RTO/RPO
  - [ ] dokumentasi
  - [ ] simulasi
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

### DA9.3 Monitoring & Log `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Log aplikasi dan error
  - [ ] Laravel log
  - [ ] error tracking
  - [ ] rotasi
- Monitoring uptime
  - [ ] health check
  - [ ] disk/DB
  - [ ] alert
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

### DA9.4 Rilis & Distribusi `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Build otomatis lintas sistem
  - [ ] CI backend
  - [ ] CI desktop
  - [ ] Artefak rilis tersimpan
- Paket rilis desktop
  - [ ] DMG macOS
  - [ ] Installer Windows
  - [ ] Versi dan changelog
- Tanda tangan dan pembaruan otomatis
  - [ ] Signing
  - [ ] Notarization
  - [ ] Auto-update
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## DA10. Dashboard & Laporan

### DA10.1 Dashboard Ringkas `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Ringkasan lintas modul
  - [x] lembaga/santri/pegawai
  - [x] keuangan/siklus/PSB
  - [x] izin per blok

### DA10.2 Statistik Pimpinan `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Dashboard eksekutif
  - [ ] KPI
  - [ ] tren
  - [ ] perbandingan lembaga
- Ekspor laporan pimpinan
  - [ ] PDF/Excel
  - [ ] jadwal kirim
  - [ ] filter periode
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

### DA10.3 Laporan Terpusat `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Katalog laporan lintas modul
  - [ ] Santri dan siklus
  - [ ] Akademik dan rapor
  - [ ] Keuangan dan tunggakan
  - [ ] Kepegawaian dan PSB
- Ekspor dan pengiriman terjadwal
  - [ ] Ekspor PDF dan Excel
  - [ ] Jadwal kirim
  - [ ] Riwayat pengiriman
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## DA11. Kerangka UI & Tampilan

### DA11.1 Tabel & Grid `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Grid tabel bergaya Excel
  - [x] Seleksi blok dan salin/tempel TSV
  - [x] Autofit dan atur lebar kolom
  - [x] Header beku dan scrollbar melayang
  - [x] Simpan otomatis per sel
- Preset kolom, urutan, dan toolbar
  - [x] Preset kolom per pengguna
  - [x] Urutan dan visibilitas kolom
  - [x] Toolbar preset dan komponen input custom

### DA11.2 Navigasi & Pencarian `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Command palette dan pencarian global
  - [x] Pintasan membuka palette
  - [x] Pencarian halaman dan tabel
  - [x] Pencarian cepat di topbar
- Tab halaman dan jendela terpisah
  - [x] Tab halaman gabungan
  - [x] Preferensi tab terakhir
  - [x] Profil santri di jendela lepas
- Filter dan visibilitas per halaman
  - [x] Pilihan filter yang tampil
  - [x] Visibilitas kolom per tabel
  - [x] Tersimpan per halaman

### DA11.3 Tampilan & Aksesibilitas `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Bantuan keyboard dan pembaca layar
  - [ ] Overlay peta pintasan
  - [ ] Navigasi VoiceOver di halaman utama
  - [ ] Uji aksesibilitas dan kontras
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Tema, density, dan mode navigasi
  - [x] Terang/gelap/sistem
  - [x] Density dan radius sudut
  - [x] Sidebar/menubar dan sembilan set ikon

### DA11.4 Halaman Board `Menunggu peninjauan (For Review)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- Alur pemilihan, riset, dan konfirmasi pekerjaan melalui Board
  - [x] Seluruh 103 poin To Do dikembalikan ke Backlog dengan riwayat perubahan
  - [x] Pengguna memilih To Do hanya pada alur kerja aplikasi yang efektif Aktif
  - [x] To Do dipakai untuk riset hanya-baca dan penyusunan syarat selesai
  - [x] Hasil riset menyertakan rekomendasi UI atau menyatakan tidak ada dampak UI
  - [x] Poin tetap To Do sampai subpoin final dan izin pengerjaan disetujui
  - [x] Maksimal satu In Progress per aplikasi dan urutan beberapa To Do ditentukan
  - [x] Setelah disetujui poin masuk In Progress, dikerjakan, lalu masuk For Review
**Selesai (Done)**
- Kolom status tanpa sub-modul terlipat saat Board dibuka
  - [x] Kolom tanpa sub-modul tertutup saat halaman Board dibuka
  - [x] Kolom yang punya sub-modul terbuka
  - [x] Kolom Selesai (Done) selalu tertutup secara default
  - [x] Bukaan manual pengguna tetap setelah data disegarkan
  - [x] Verifikasi: 27 tes komponen Board lulus + npm run typecheck
- Rail modul menandai modul yang punya pekerjaan For Review
  - [x] Modul dengan poin For Review berlatar warna berbeda di rail modul
  - [x] Modul tanpa For Review tetap netral
  - [x] Warna tetap terbaca saat modul itu sedang aktif
  - [x] Verifikasi: tes pustaka + typecheck + pratinjau visual

## DA12. Dokumen & Berkas

### DA12.1 Arsip Dokumen `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Dokumen santri, pegawai, dan lembaga
  - [x] Tiga jenis pemilik dokumen
  - [x] Unggah dan unduh berkas
  - [x] Penampil PDF dan gambar
  - [x] Status kelengkapan berkas wajib
- Arsip lokal desktop dan sinkron dokumen
  - [x] Folder arsip lokal
  - [x] Pindai dan garis panduan
  - [x] Sinkron dokumen massal
  - [x] Pilihan mode penyimpanan

### DA12.2 Impor & Ekspor Berkas `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Impor XLSX bertahap dengan pratinjau
  - [x] Unduh template per modul
  - [x] Pratinjau baris sebelum simpan
  - [x] Potong baris dan unduh daftar galat
  - [x] Batal dan pulihkan hasil impor
- Ekspor tabel ke XLSX dan TSV
  - [x] Ekspor mengikuti filter aktif
  - [x] Salin blok sebagai TSV
  - [x] Simpan berkas lewat dialog desktop
---

# Aplikasi: Mobile Orang Tua

## MO0. Fondasi & Rilis

### MO0.1 Kerangka & Distribusi `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Kerangka aplikasi mobile
  - [ ] Pilihan stack dan struktur proyek
  - [ ] Navigasi dan tema dasar
  - [ ] Konfigurasi API dan sesi
- Build dan distribusi rilis
  - [ ] Build debug dan rilis
  - [ ] Distribusi uji internal
  - [ ] Tanda tangan dan rilis toko
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MO1. Akun & Onboarding

### MO1.1 API Autentikasi `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Login wali lewat API
  - [x] Sanctum
  - [x] multi-identifier
  - [x] peran orang_tua

### MO1.2 UI Mobile `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Login dan onboarding wali
  - [ ] email/HP
  - [ ] OTP
  - [ ] pilih santri
- Verifikasi relasi wali-santri
  - [ ] data wali
  - [ ] data santri
  - [ ] batas akses
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MO2. Profil Santri

### MO2.1 API Portal `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Rute portal wali
  - [x] portal/*
  - [x] role orang_tua
  - [x] agregator baca

### MO2.2 UI Profil `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Biodata dan dokumen anak
  - [ ] lihat
  - [ ] unduh
  - [ ] pengajuan perubahan
- Riwayat belajar
  - [ ] per lembaga
  - [ ] kelas
  - [ ] status aktif
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MO3. Tagihan & Pembayaran

### MO3.1 API Keuangan `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- API tagihan dan pembayaran untuk portal wali
  - [ ] Daftar tagihan per anak
  - [ ] Riwayat pembayaran
  - [ ] Sisa tunggakan per anak
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

### MO3.2 UI Tagihan `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Daftar tagihan per anak
  - [ ] jatuh tempo
  - [ ] status
  - [ ] filter
- Pembayaran digital
  - [ ] metode
  - [ ] bukti
  - [ ] kwitansi
- Tunggakan
  - [ ] aging
  - [ ] pengingat
  - [ ] riwayat
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MO4. Presensi & Perilaku

### MO4.1 API Presensi `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Tabel presensi santri
  - [x] sesi
  - [x] kehadiran
  - [x] pelanggaran

### MO4.2 UI Presensi `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Presensi harian anak
  - [ ] per sesi
  - [ ] izin/sakit
  - [ ] rekap
- Pelanggaran
  - [ ] jenis
  - [ ] poin
  - [ ] tindak lanjut
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MO5. Tahfizh

### MO5.1 API Tahfizh `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Tabel target dan setoran
  - [x] target
  - [x] setoran
  - [x] rekap

### MO5.2 UI Tahfizh `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Target dan setoran
  - [ ] ziyadah
  - [ ] murajaah
  - [ ] grafik
- Rekap tahfizh
  - [ ] periode
  - [ ] catatan guru
  - [ ] unduh
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MO6. PSB & Pengajuan

### MO6.1 API PSB `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Pendaftaran dan pengajuan
  - [x] PSB
  - [x] biodata
  - [x] dokumen

### MO6.2 UI PSB `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- PSB online
  - [ ] formulir
  - [ ] unggah dokumen
  - [ ] status
- Pengajuan biodata
  - [ ] satu aktif
  - [ ] batal
  - [ ] verifikasi
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MO7. Notifikasi

### MO7.1 Push & WhatsApp `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Notifikasi tagihan dan presensi
  - [ ] push
  - [ ] WhatsApp
  - [ ] deep link
- Preferensi notifikasi
  - [ ] jenis
  - [ ] jam tenang
  - [ ] per anak
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)
---

# Aplikasi: Mobile Guru

## MG0. Fondasi & Rilis

### MG0.1 Kerangka & Distribusi `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Kerangka aplikasi mobile
  - [ ] Pilihan stack dan struktur proyek
  - [ ] Navigasi dan tema dasar
  - [ ] Konfigurasi API dan sesi
- Build dan distribusi rilis
  - [ ] Build debug dan rilis
  - [ ] Distribusi uji internal
  - [ ] Tanda tangan dan rilis toko
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MG1. Akun & Login

### MG1.1 API Autentikasi `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Login guru lewat API
  - [x] Sanctum
  - [x] multi-identifier
  - [x] peran guru

### MG1.2 UI Guru `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Login mobile dan profil guru
  - [ ] email/HP
  - [ ] sesi perangkat
  - [ ] penempatan
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MG2. Jadwal Mengajar

### MG2.1 API Jadwal `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Jadwal per kelas
  - [x] slot
  - [x] anti bentrok
  - [x] per TA

### MG2.2 UI Jadwal `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Agenda mengajar guru
  - [ ] hari ini
  - [ ] minggu
  - [ ] filter
- Detail kelas
  - [ ] mapel
  - [ ] jam
  - [ ] ruang
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MG3. Input Nilai

### MG3.1 API Nilai `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Nilai per peristiwa
  - [x] komponen
  - [x] impor
  - [x] leger

### MG3.2 UI Input `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Input nilai per kelas
  - [ ] mapel
  - [ ] komponen
  - [ ] validasi
- Rekap dan submit nilai
  - [ ] kunci
  - [ ] status
  - [ ] koreksi
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MG4. Presensi Pegawai

### MG4.1 API Presensi `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Tabel presensi pegawai
  - [x] status harian
  - [x] rekap
  - [x] koreksi

### MG4.2 UI Presensi `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Absen harian guru
  - [ ] masuk/pulang
  - [ ] lokasi
  - [ ] riwayat
- Izin dan cuti
  - [ ] pengajuan
  - [ ] persetujuan
  - [ ] lampiran
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MG5. Setoran Tahfizh

### MG5.1 API Tahfizh `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Tabel setoran tahfizh
  - [x] target
  - [x] setoran
  - [x] rekap

### MG5.2 UI Setoran `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Input setoran
  - [ ] ziyadah
  - [ ] murajaah
  - [ ] catatan
- Rekap santri
  - [ ] per kelas
  - [ ] periode
  - [ ] unduh
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MG6. Pengampu & Kelas

### MG6.1 API Pengampu `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Pivot pengampu
  - [x] kelas × mapel
  - [x] guru
  - [x] per TA

### MG6.2 UI Pendampingan `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Daftar kelas dan mapel
  - [ ] TA aktif
  - [ ] daftar siswa
  - [ ] filter
- Catatan kelas
  - [ ] jurnal
  - [ ] tindak lanjut
  - [ ] riwayat
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MG7. Pengajuan & Izin

### MG7.1 Alur Pengajuan `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Pengajuan izin guru
  - [ ] jenis
  - [ ] lampiran
  - [ ] atasan
- Status pengajuan
  - [ ] riwayat
  - [ ] notifikasi
  - [ ] pembatalan
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)
---

# Aplikasi: Mobile Pimpinan

## MP0. Fondasi & Rilis

### MP0.1 Kerangka & Distribusi `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Kerangka aplikasi mobile
  - [ ] Pilihan stack dan struktur proyek
  - [ ] Navigasi dan tema dasar
  - [ ] Konfigurasi API dan sesi
- Build dan distribusi rilis
  - [ ] Build debug dan rilis
  - [ ] Distribusi uji internal
  - [ ] Tanda tangan dan rilis toko
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MP1. Akun & Login

### MP1.1 API Autentikasi `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Login pimpinan lewat API
  - [x] Sanctum
  - [x] multi-identifier
  - [x] batas izin

### MP1.2 UI Pimpinan `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Login mobile pimpinan
  - [ ] email/HP
  - [ ] sesi perangkat
  - [ ] profil
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MP2. Dashboard Eksekutif

### MP2.1 API Ringkasan `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Ringkasan lintas modul
  - [x] dashboard/ringkasan
  - [x] izin per blok
  - [x] null bila tak berizin

### MP2.2 UI KPI `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- KPI dan tren
  - [ ] per lembaga
  - [ ] periode
  - [ ] perbandingan
- Statistik pimpinan lanjutan
  - [ ] modul 504
  - [ ] ekspor
  - [ ] jadwal kirim
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MP3. Statistik Keuangan

### MP3.1 API Keuangan `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Data tagihan dan pembayaran
  - [x] tagihan
  - [x] terbayar
  - [x] tunggakan

### MP3.2 UI Keuangan `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Tren keuangan
  - [ ] per lembaga
  - [ ] per kas
  - [ ] periode
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MP4. Statistik Santri & PSB

### MP4.1 API Santri & PSB `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Data santri dan PSB
  - [x] jumlah aktif
  - [x] funnel PSB
  - [x] per lembaga

### MP4.2 UI Santri `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Statistik santri
  - [ ] per jenjang
  - [ ] siklus
  - [ ] mutasi
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MP5. Statistik Akademik

### MP5.1 API Akademik `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Data nilai dan kehadiran
  - [x] nilai
  - [x] jadwal
  - [x] presensi

### MP5.2 UI Akademik `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Distribusi nilai dan kehadiran
  - [ ] per kelas
  - [ ] per mapel
  - [ ] peringatan
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MP6. Laporan & Ekspor

### MP6.1 Laporan `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Laporan PDF/Excel
  - [ ] periode
  - [ ] per lembaga
  - [ ] filter
- Jadwal kirim laporan
  - [ ] email/WA
  - [ ] rekap berkala
  - [ ] riwayat
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MP7. Notifikasi & Alert

### MP7.1 Alert `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Ambang batas otomatis
  - [ ] tunggakan
  - [ ] kehadiran
  - [ ] nilai
- Push dan riwayat alert
  - [ ] peristiwa
  - [ ] penerima
  - [ ] tindak lanjut
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)
---

# Aplikasi: Mobile Kasir

## MK0. Fondasi & Rilis

### MK0.1 Kerangka & Distribusi `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Kerangka aplikasi mobile
  - [ ] Pilihan stack dan struktur proyek
  - [ ] Navigasi dan tema dasar
  - [ ] Konfigurasi API dan sesi
- Build dan distribusi rilis
  - [ ] Build debug dan rilis
  - [ ] Distribusi uji internal
  - [ ] Tanda tangan dan rilis toko
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MK1. Akun & Login

### MK1.1 API Autentikasi `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Login kasir lewat API
  - [x] Sanctum
  - [x] multi-identifier
  - [x] batas izin

### MK1.2 UI Kasir `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Login dan profil kasir
  - [ ] role kasir
  - [ ] perangkat
  - [ ] shift
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

### MK1.3 Peran & Izin Kasir `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Peran dan izin kasir untuk aplikasi mobile
  - [ ] Buat peran kasir
  - [ ] Izin kasir: pembayaran, kwitansi, tunggakan
  - [ ] Uji login dan akses kasir
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MK2. Kasir Harian

### MK2.1 API Kasir `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Pembayaran dan pembatalan
  - [x] kasir
  - [x] saldo terkunci
  - [x] batal/hapus

### MK2.2 UI Kasir `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Cari santri dan pilih tagihan
  - [ ] pencarian
  - [ ] filter
  - [ ] rincian
- Bayar dan cetak
  - [ ] metode
  - [ ] konfirmasi
  - [ ] kwitansi
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MK3. Kwitansi

### MK3.1 API Kwitansi `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Kwitansi dan cetak ulang
  - [x] nomor
  - [x] data bayar
  - [x] riwayat

### MK3.2 UI Kwitansi `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Cetak thermal dan bagikan
  - [ ] thermal
  - [ ] PDF
  - [ ] WhatsApp
- Nomor kwitansi runut
  - [ ] per kas
  - [ ] per tahun
  - [ ] format final
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MK4. Tunggakan

### MK4.1 API Tunggakan `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Crosstab tunggakan
  - [x] per santri/kelas
  - [x] total
  - [x] terbayar

### MK4.2 UI Tunggakan `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Daftar tunggakan kasir
  - [ ] aging
  - [ ] surat
  - [ ] pengingat
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MK5. Tutup Buku & Rekap

### MK5.1 API Rekap `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Rekap per posisi kas
  - [ ] tunai
  - [ ] bank
  - [ ] periode
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

### MK5.2 UI Tutup Buku `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Tutup buku harian
  - [ ] rekap
  - [ ] kunci
  - [ ] buka kunci
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MK6. Dispensasi

### MK6.1 API Dispensasi `Selesai (Done)`
**Belum dijadwalkan (Backlog)**
- (kosong)
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Dispensasi dan grup santri
  - [x] disponsasi
  - [x] grup custom
  - [x] tagihan

### MK6.2 UI Dispensasi `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Pengajuan dan persetujuan
  - [ ] ajukan
  - [ ] setujui
  - [ ] riwayat
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## MK7. Offline & Sinkronisasi

### MK7.1 Mode Offline `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Cache data tagihan
  - [ ] santri
  - [ ] tagihan
  - [ ] saldo
- Antrean transaksi
  - [ ] simpan lokal
  - [ ] retry
  - [ ] status
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

### MK7.2 Sinkronisasi `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Sinkron dan konflik
  - [ ] timestamp
  - [ ] konflik
  - [ ] audit
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)
---

# Aplikasi: Landing Page Pesantren

## LP0. Fondasi & Peluncuran

### LP0.1 Fondasi Teknis `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Keputusan stack dan hosting
  - [ ] Pilihan framework/static site
  - [ ] Hosting dan CDN
  - [ ] Alur build dan rilis
- Domain, HTTPS, dan email resmi
  - [ ] Domain dan DNS
  - [ ] Sertifikat HTTPS
  - [ ] Email resmi pesantren
- Integrasi data publik
  - [ ] Profil pesantren dan lembaga
  - [ ] Formulir PSB publik
  - [ ] Berita dan pengumuman
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

### LP0.2 Peluncuran `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Migrasi konten awal
  - [ ] Teks profil dan visi-misi
  - [ ] Foto fasilitas dan kegiatan
  - [ ] Daftar prestasi
- Uji aksesibilitas dan performa
  - [ ] Kontras dan navigasi keyboard
  - [ ] Skor Lighthouse
  - [ ] Uji di perangkat mobile
- Peluncuran dan pemantauan
  - [ ] Pemeriksaan akhir
  - [ ] Pemantauan uptime
  - [ ] Rencana perbaikan
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## LP1. Profil & Identitas

### LP1.1 Struktur Halaman `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Halaman profil pesantren
  - [ ] sejarah
  - [ ] visi-misi
  - [ ] struktur
- Profil per lembaga
  - [ ] MI
  - [ ] MD
  - [ ] MTS
  - [ ] MLN
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

### LP1.2 Konten Identitas `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Fasilitas dan prestasi
  - [ ] fasilitas
  - [ ] prestasi
  - [ ] galeri
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## LP2. PSB Online

### LP2.1 Formulir PSB `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Formulir pendaftaran publik
  - [ ] jalur
  - [ ] data calon
  - [ ] unggah
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- Prototipe formulir PSB publik berjalan
  - [x] Pilihan lembaga dan paket
  - [x] Data calon dan cek NIK
  - [x] Unggah bukti transfer
  - [x] Nomor pendaftaran

### LP2.2 Status & Biaya `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Cek status dan biaya
  - [ ] status
  - [ ] biaya
  - [ ] konfirmasi
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## LP3. Berita & Pengumuman

### LP3.1 CMS Berita `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Kelola berita dan pengumuman
  - [ ] kategori
  - [ ] editor
  - [ ] jadwal terbit
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

### LP3.2 Tampilan Publik `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Daftar dan detail berita
  - [ ] daftar
  - [ ] detail
  - [ ] pencarian
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## LP4. Galeri & Fasilitas

### LP4.1 Album `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Album foto dan video
  - [ ] kategori
  - [ ] lazy load
  - [ ] caption
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

### LP4.2 Virtual Tour `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Tur 360 dan peta
  - [ ] 360
  - [ ] peta
  - [ ] aksesibilitas
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## LP5. Kontak & WhatsApp

### LP5.1 Kontak `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Form kontak dan lokasi
  - [ ] form
  - [ ] maps
  - [ ] jam layanan
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

### LP5.2 WhatsApp `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- WhatsApp dan antispam
  - [ ] deep link
  - [ ] template
  - [ ] antispam
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## LP6. SEO & Analytics

### LP6.1 SEO Teknis `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Metadata dan sitemap
  - [ ] metadata
  - [ ] sitemap
  - [ ] schema.org
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

### LP6.2 Analytics `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Analytics dan consent
  - [ ] GA4
  - [ ] event PSB
  - [ ] consent
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## LP7. Multi-lembaga & Bahasa

### LP7.1 Multi-lembaga `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Halaman per lembaga
  - [ ] jenjang
  - [ ] navigasi
  - [ ] konten
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

### LP7.2 Bahasa & Aksesibilitas `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Bahasa dan aksesibilitas
  - [ ] ID/EN
  - [ ] kontras
  - [ ] keyboard
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

## LP8. Keamanan & Performa

### LP8.1 Keamanan `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Keamanan publik
  - [ ] HTTPS
  - [ ] anti-spam
  - [ ] rate limit
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

### LP8.2 Performa `Belum dijadwalkan (Backlog)`
**Belum dijadwalkan (Backlog)**
- Performa halaman
  - [ ] cache
  - [ ] gambar
  - [ ] Lighthouse
**Siap dikerjakan (To Do)**
- (kosong)
**Sedang dikerjakan (In Progress)**
- (kosong)
**Menunggu peninjauan (For Review)**
- (kosong)
**Selesai (Done)**
- (kosong)

# SEDANG DIKERJAKAN

**Kosong.** Tidak ada sub-modul yang disetujui sebagai pekerjaan berjalan.

---

# RINCIAN TEKNIS LAINNYA

Bagian ini memuat hal teknis yang terlalu rinci untuk masuk ke modul papan, dan
tidak terikat pada modul Keuangan maupun Penilaian.

## Kurikulum & Mata Pelajaran (201)

### Jadwal per guru
- **FE:** tampilan jadwal dari sudut guru; saat ini baru per kelas.

### Cetak & unduh jadwal per kelas
- **FE:** keluaran cetak/Excel untuk jadwal yang sudah tersusun.

### Salin mapel antar tahun ajaran
- **FE:** kelas tingkat atas menyalin daftar mapel dari tingkat bawah.

### Tes tersisa
- Endpoint yang belum tertulis: `kurikulum/slot` CRUD penuh, `guruAktif`, `indexMapel` filter.
- `KurikulumPengampuPage` belum punya tes komponen.

## Portal

### Dashboard portal wali
- **BE:** agregator baca-saja lewat rute `portal/*` dengan penjaga `role:orang_tua`.

### Ringkasan tagihan di portal
- **BE:** tagihan milik anak, dibaca dari akun wali.

### Aktor santri
- **BE:** peran `santri` sudah ada, tetapi belum punya rute portal sendiri.

## Keputusan Offline

Lampiran F `operasi.md` (OFF-01…OFF-09) masih berstatus keputusan desain dan
belum diimplementasikan. Bila mulai dikerjakan, pindahkan butirnya ke modul yang sesuai
dan tandai SEDANG.

---

# J. IZIN & PERAN

Sumber kanonis: `backend/app/Services/IzinKatalog.php`.

- **Peran efektif (5):** `super_admin`, `admin`, `guru`, `orang_tua`, `santri`.
- **Admin lembaga:** semua izin kecuali 17 nama di `EKSKLUSIF_SUPER_ADMIN`.
- **Guru:** izin bawaan kosong; klien desktop juga menolak peran ini.
- **Izin = aksi.** Cakupan lembaga diatur pivot `user_lembaga` dan header `X-Lembaga-Aktif`.
- **Peran lama:** `kasir` dihapus v2.38; `asrama` masih rancangan modul 505.

---

# K. RUJUKAN

- Tabel dan kolom → [SCHEMA.md](SCHEMA.md)
- Endpoint dan aturan per modul → [backend-detail.md](backend-detail.md)
- Rancangan produk dan alur bisnis → [PRD.md](PRD.md)
- Arsitektur, peran, dan UI → [arsitektur.md](arsitektur.md)
- Uji, penyebaran, dan TBD → [operasi.md](operasi.md)
- Riwayat perubahan → [CHANGELOG.md](CHANGELOG.md)
