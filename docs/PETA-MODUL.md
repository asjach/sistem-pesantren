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
(`backlog` | `todo` | `in_progress` | `for_review` | `done`), dan status
sub-modul **dihitung otomatis** dari poin-poinnya. Pekerjaan aktif didahulukan,
disusul To Do, Backlog, dan For Review; sub-modul menjadi Done hanya bila semua
poinnya sudah Done.

Konsekuensinya, di UI satu sub-modul bisa muncul di beberapa kolom sekaligus —
memang begitu yang diinginkan: `E.3` yang separuh selesai tampil sebagai kartu di
kolom **Done** dan **To Do** bersamaan.

Modul di berkas ini **dihasilkan** `papan:markdown --tulis`; bagian SEDANG
DIKERJAKAN dan RINCIAN TEKNIS LAINNYA dipertahankan apa adanya. Jadi setelah
mengubah status lewat command, jalankan `--tulis` supaya berkas ini ikut segar,
lalu commit markdown-nya sebagai jejak yang tahan lama.

**Status alur kerja (workflow):** status efektif = pengaturan utama (master) + penanda aplikasi (flag); cek di Board. Alur kerja (workflow) hanya menjadi rujukan agen/pengguna untuk aplikasi yang status efektifnya **Aktif**; saat **Draf**, PRD dan kode yang berlaku.

## Cara baca

Lima status alur kerja (workflow) dipakai konsisten di seluruh berkas:

- **Backlog** — belum siap dijadwalkan atau masih ditahan.
- **To Do** — siap dikerjakan.
- **In Progress** — sedang dikerjakan.
- **For Review** — implementasi selesai dan menunggu peninjauan.
- **Done** — pekerjaan dan seluruh subpoin sudah selesai.

Status yang tidak berlaku ditulis **(kosong)** agar tidak tampak terlewat.

---

# Aplikasi: Desktop Admin

## DA1. Fondasi & Infrastruktur

### DA1.1 Setup & Runtime `For Review`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- Anotasi UI mode dev untuk instruksi agent
  - [x] Tombol Tandai hanya tampil saat dev dan tidak ikut build produksi
  - [x] Klik elemen membuka input instruksi dan menyimpan anotasi ke .dev/anotasi.json berisi rute, selector, komponen, file:line, teks, dan instruksi
  - [x] Panel daftar anotasi dapat dibuka dan tiap entri dapat dihapus
  - [x] Alur agen membaca .dev/anotasi.json dan menindaklanjuti anotasi terdokumentasi
  - [x] Verifikasi: tes terfokus, typecheck, dan build web tanpa memuat lapisan anotasi
  - [x] Pintasan Ctrl/⌘+Shift+A mengaktifkan mode tandai, termasuk saat dialog terbuka
  - [x] Elemen di dalam popup/modal dapat ditandai dan instruksinya dapat diketik
  - [x] Verifikasi: tes lapisan anotasi dan typecheck
**Done**
- Proyek Laravel 13, Vite, dan Tauri berjalan
  - [x] API-first
  - [x] Sanctum
  - [x] SQLite/MySQL siap
- Konfigurasi dev dan produksi terdokumentasi
  - [x] .env contoh
  - [x] CORS localhost
  - [x] perintah artisan/npm

### DA1.2 Skema Database `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Migrasi dan skema pesantren terkendali
  - [x] 84 file migrasi
  - [x] 126 tabel termasuk framework
  - [x] SCHEMA.md
- Database papan terpisah dari database pesantren
  - [x] koneksi papan
  - [x] migrasi path papan
  - [x] tidak ikut migrate:fresh

### DA1.3 Referensi & Master `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Kamus referensi per lembaga
  - [x] 34 tabel kamus
  - [x] RefService ber-cache
  - [x] fan-out
- CRUD Lembaga, Tahun Ajaran, dan Kelas
  - [x] scope tenant
  - [x] validasi jenjang
  - [x] kode unik

### DA1.4 Pengaturan Aplikasi Desktop `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Pengaturan server dan sesi aman
  - [x] URL API tersimpan
  - [x] Uji koneksi
  - [x] Token di keychain dengan fallback memori
- Folder arsip dan mode dokumen
  - [x] Pilih folder arsip
  - [x] Mode dokumen
  - [x] Peringatan bila akses folder ditolak

## DA2. Autentikasi & Pengguna

### DA2.1 Login & Sesi `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Login multi-identifier
  - [x] email/HP/username
  - [x] throttle 6/menit
  - [x] login_audits
- Kunci diri dan anti-eskalasi
  - [x] tidak bisa hapus diri
  - [x] role tidak naik sendiri
  - [x] kebijakan izin

### DA2.2 Peran & Izin `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Lima peran efektif dan matriks izin
  - [x] super_admin/admin/guru/orang_tua/santri
  - [x] IzinKatalog
  - [x] PermissionSeeder
- Mode lembaga dan pesantren
  - [x] X-Lembaga-Aktif
  - [x] scope tenant
  - [x] act-as

### DA2.3 Akun PTK `Backlog`
**Backlog**
- Undangan dan aktivasi akun guru
  - [ ] email/WA
  - [ ] token sekali pakai
  - [ ] reset kata sandi
- Sinkron akun dengan data pegawai
  - [ ] tautan pegawai_id
  - [ ] peran guru/kasir
  - [ ] nonaktif otomatis
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## DA3. PSB & Santri

### DA3.1 PSB `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
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

### DA3.2 Santri `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- CRUD santri dan NIS
  - [x] SantriPolicy
  - [x] impor satu pintu
  - [x] samakan NIS massal
- Foto dan dokumen santri
  - [x] unggah
  - [x] jenis dokumen
  - [x] viewer

### DA3.3 Siklus Santri `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Naik kelas, pindah, mutasi, lulus
  - [x] massal/otomatis
  - [x] arsip
  - [x] MI-MD
- Roster dan status global
  - [x] riwayat_belajar
  - [x] status turunan
  - [x] beku kelas

### DA3.4 Presensi Santri `Backlog`
**Backlog**
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
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Tabel presensi dan pelanggaran
  - [x] sesi_presensi
  - [x] presensi_santri
  - [x] pelanggaran_santri

### DA3.5 Asrama `Backlog`
**Backlog**
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
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## DA4. Kepegawaian

### DA4.1 Pegawai `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Master pegawai global
  - [x] EMIS
  - [x] keaktifan_pegawai
  - [x] sertifikasi
- Walas dan akun PTK
  - [x] setWalas tiga lapis
  - [x] penautan akun
  - [x] dokumen

### DA4.2 Presensi Pegawai `Backlog`
**Backlog**
- UI absensi guru
  - [ ] input harian
  - [ ] koreksi
  - [ ] izin/cuti
- Pencatatan presensi pegawai lewat API
  - [ ] Absen masuk dan pulang
  - [ ] Izin dan cuti
  - [ ] Rekap kehadiran per pegawai
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Tabel presensi pegawai
  - [x] presensi_pegawai
  - [x] status harian
  - [x] rekap

## DA5. Kurikulum

### DA5.1 Mata Pelajaran `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Salin daftar mapel antar kelas (TA sama) dengan pratinjau
  - [x] Sumber hanya kelas pada tahun ajaran yang sama
  - [x] Pratinjau mapel yang akan ditambahkan vs dilewati
  - [x] Hindari duplikat: mapel yang sudah ada tidak disalin ulang
  - [x] Verifikasi: KurikulumModulTest 9/9 (169 asersi) + suite FE 1427/1427 + npm run typecheck
- Master mapel dan KKM
  - [x] per jenjang
  - [x] kelompok formal/pesantren
  - [x] urutan rapor

### DA5.2 Pengampu `Backlog`
**Backlog**
- Tes komponen halaman Pengampu
  - [ ] tes render
  - [ ] tes validasi
  - [ ] tes izin
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Pivot kelas × mapel → guru
  - [x] validasi bentrok
  - [x] guru aktif
  - [x] per TA

### DA5.3 Jadwal Pelajaran `Backlog`
**Backlog**
- Jadwal dari sudut guru
  - [ ] agenda mengajar
  - [ ] filter guru
  - [ ] tampilan mobile
- Cetak/unduh jadwal
  - [ ] PDF
  - [ ] Excel
  - [ ] kop
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
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

### DA5.4 Struktur Kurikulum `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- tabel struktur kurikulum
  - [x] Halaman baru Kurikulum → Struktur Kurikulum
  - [x] Struktur per VARIAN jadwal; combobox memilih varian, termasuk yang tidak aktif
  - [x] Baris = mapel aktif jenjang; kolom = tingkat jenjang
  - [x] JP per minggu dihitung otomatis dari snapshot varian (terbanyak antar kelas satu tingkat); JP per tahun = JP/minggu × minggu efektif
  - [x] Baris terakhir = jumlah per tingkat; combobox menampilkan JP per minggu atau per tahun
  - [x] Minggu efektif per jenjang + tahun ajaran; tabel baca-saja dan hanya referensi (tidak mengunci jadwal)
  - [x] Verifikasi: tes backend + frontend + typecheck; SCHEMA/ERD diselaraskan

## DA6. Penilaian

### DA6.1 Nilai & Kegiatan Evaluatif `Backlog`
**Backlog**
- Kunci dan buka kunci nilai
  - [ ] kunci setelah cetak
  - [ ] alasan buka
  - [ ] log audit
- Bobot UJIAN final
  - [ ] UM 60
  - [ ] rata-rata rapor 40
  - [ ] kebijakan pesantren
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
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
  - [x] Nilai akhir mengikuti rentang kegiatan evaluatif (0–10/0–100/0–4) dan tersimpan per santri + mapel + kegiatan evaluatif + semester; sel kosong menghapus nilai; predikat dihitung
  - [x] Nilai manual memakai sumber manual (badge M) dan tidak ditimpa Hitung ulang kecuali paksa; impor tetap I
  - [x] Pengguna tanpa penilaian.ubah tetap baca-saja; mapel tanpa pengampu ditolak
  - [x] Perubahan nilai ditahan selama Mode Ubah dan disimpan sekaligus saat keluar mode, bukan setiap sel berubah
  - [x] Typecheck, tes backend/frontend, serta uji edit/kosongkan di UI hijau
  - [x] Leger menampilkan kolom Jumlah dan Peringkat di akhir kolom; peringkat dihitung per kelas
  - [x] Baris peringkat 1, 2, dan 3 diberi latar hijau, kuning, dan biru dengan teks/nilai tetap terbaca
  - [x] Rentang nilai per kegiatan evaluatif (0-10/0-100/0-4, default 0-100) dapat dipilih di Leger dan tersimpan
  - [x] Nilai di luar rentang dilewati tanpa menggagalkan input/update lain; sel/baris valid tetap disimpan; toast memuat nama dan mapel
  - [x] Dokumentasi skema dan tes validasi rentang hijau
- Ganti istilah Peristiwa menjadi Kegiatan Evaluatif (backend, database, frontend)
  - [x] Skema dan migrasi rename: peristiwa_nilai → kegiatan_evaluatif, peserta_peristiwa_nilai → peserta_kegiatan_evaluatif, peristiwa_id → kegiatan_evaluatif_id, peristiwa_sumber_id → kegiatan_evaluatif_sumber_id; data dan relasi tetap utuh
  - [x] Backend aktif memakai KegiatanEvaluatif: model, service, controller, request, route /penilaian/kegiatan-evaluatif, key JSON kegiatan_evaluatif, dan tes
  - [x] Frontend memakai tipe/API KegiatanEvaluatif dan seluruh label UI berganti dari Peristiwa menjadi Kegiatan Evaluatif
  - [x] SCHEMA/ERD/PRD/backend-detail serta istilah Board/PETA selaras; riwayat/CHANGELOG lama tidak diubah
  - [x] Pemeriksaan: migrasi data-preserving, tes backend/frontend, typecheck, Pint; istilah peristiwa tersisa hanya di migrasi lama, riwayat CHANGELOG/operasi, serta nama indeks/constraint historis di database
**Done**
- Nilai per kegiatan evaluatif
  - [x] PTS/ASAS/ASAT/UJIAN/UAP
  - [x] komponen/bobot
  - [x] sumber nilai
- Impor nilai
  - [x] empat template
  - [x] import-potong
  - [x] validasi

### DA6.2 Cetak Rapor `Backlog`
**Backlog**
- Absensi otomatis
  - [ ] sesi_presensi
  - [ ] override leger
  - [ ] rekap kehadiran
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- Cetak massal satu kelas
  - [x] Satu tombol Cetak satu kelas mencetak seluruh santri kelas/kegiatan evaluatif/semester terpilih dalam satu dialog
  - [x] Opsi peringkat dipilih sekali per batch (3/10/semua); peringkat di luar batas dikosongkan
  - [x] Cetak massal memakai gerbang kelengkapan yang sama; tombol terkunci dengan alasan bila nilai belum lengkap
  - [x] Nama wali kelas dan kepala dibekukan saat batch pertama; cetak massal dan cetak tunggal lingkup sama memakai snapshot; nama kosong diisi data terbaru lalu dibekukan
  - [x] Setiap rapor tercetak pada halaman terpisah dan utuh di A4/PDF
  - [x] Tabel batch terdokumentasi di SCHEMA/ERD dan tes backend/frontend terkait hijau
**Done**
- Rapor per santri/kelas
  - [x] kop
  - [x] identitas
  - [x] nilai + terbilang
- Validasi kelengkapan
  - [x] kelas lengkap
  - [x] tombol cetak terkunci
  - [x] halaman 2

### DA6.3 Tahfizh `Backlog`
**Backlog**
- UI tahfizh
  - [ ] ziyadah
  - [ ] murajaah
  - [ ] rekap per santri
- Target dan setoran tahfizh lewat API
  - [ ] Target per santri
  - [ ] Setoran ziyadah dan murajaah
  - [ ] Rekap capaian per periode
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Tabel tahfizh
  - [x] target_tahfiz
  - [x] setoran_tahfiz
  - [x] rekap_tahfiz_santri

### DA6.X Cetak Kartu Peserta `For Review`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- Pengelolaan nomor peserta kegiatan evaluatif
  - [x] Peserta mengikuti cakupan kegiatan evaluatif, semester, tingkat, dan kelas
  - [x] Nomor peserta boleh kosong atau diisi manual, unik, dan asalnya tercatat
  - [x] Penyusun pola nomor memakai token dengan contoh hasil langsung
  - [x] Urutan dapat direset per tingkat atau disambung untuk seluruh tingkat
  - [x] Pembuatan nomor hanya mengisi yang kosong dan tidak menimpa nomor manual
  - [x] Pembuatan ulang nomor otomatis bersifat eksplisit dan nomor tetap tersimpan saat dibuka kembali
  - [x] Perubahan struktur data, dokumentasi, dan pemeriksaan terkait terselaraskan
  - [x] Tabel nomor peserta memakai ExcelTable; nomor dapat diedit langsung di sel, sumber manual/otomatis tetap terlihat, dan penyimpanan/validasi berjalan
  - [x] Penyusun pola nomor tampil sebagai dialog dari tombol pemicu, bukan seksi tetap di atas tabel
  - [x] Tombol Pola nomor ditempatkan di toolbar ExcelTable, bukan di bar atas tab
  - [x] Pencarian memakai TopBarSearch global dan combobox kegiatan evaluatif berada di toolbar ExcelTable, bukan bar atas tab
  - [x] Rail Tingkat/Kelas tersedia di halaman kartu peserta dan menyaring daftar peserta
  - [x] Label ringkasan peserta/belum bernomor di toolbar ExcelTable dihilangkan
- Perancang desain, ukuran, dan cetak kartu peserta
  - [x] Tersedia beberapa desain bawaan dan desain buatan pengguna
  - [x] Gambar latar, data dinamis, dan teks tetap dapat dipilih
  - [x] Elemen dapat dipindahkan dan diatur pada bidang desain
  - [x] Foto kosong memakai siluet sesuai jenis kelamin
  - [x] Ukuran tersimpan per kegiatan evaluatif dan lembaga
  - [x] Peserta terpilih atau seluruh peserta dapat dicetak ke A4/PDF
- Padding tabel pada halaman bertabel menjadi 0
  - [x] Tab Nomor peserta kartu peserta tidak memiliki padding area tabel
  - [x] Leger Nilai, Struktur Kurikulum, dan Pengampu tidak memiliki padding pembungkus tabel
  - [x] Verifikasi: typecheck, lint, dan tampilan halaman
**Done**
- (kosong)

## DA7. Keuangan

### DA7.1 Tagihan & Tarif `Backlog`
**Backlog**
- Kartu piutang per santri
  - [ ] lintas TA
  - [ ] surat tagihan
  - [ ] cetak
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
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

### DA7.2 Kasir & Kwitansi `Backlog`
**Backlog**
- Nomor kwitansi runut
  - [ ] per lembaga/kas/tahun
  - [ ] format final
  - [ ] tidak ada hex acak
- Split payment
  - [ ] gabungan metode
  - [ ] sub-bayar
  - [ ] rincian
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Kasir harian
  - [x] pembayaran
  - [x] saldo terkunci
  - [x] batal/hapus
- Kwitansi
  - [x] cetak
  - [x] cetak ulang
  - [x] dialog/tabel

### DA7.3 Rekap & Tutup Buku `Backlog`
**Backlog**
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
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

### DA7.4 Tunggakan `Backlog`
**Backlog**
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
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Crosstab tunggakan
  - [x] per santri/kelas
  - [x] total tagihan
  - [x] terbayar

### DA7.5 Audit & Kontrol `Backlog`
**Backlog**
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
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## DA8. Portal & Integrasi

### DA8.1 Portal Wali `Backlog`
**Backlog**
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
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Jalur PSB lanjutan dan pengajuan biodata
  - [x] satu aktif per santri
  - [x] batal
  - [x] riwayat keluarga

### DA8.2 API Mobile & Publik `Backlog`
**Backlog**
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
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

### DA8.3 Notifikasi & Gateway `Backlog`
**Backlog**
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
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## DA9. Production & Operasional

### DA9.1 Deploy `Backlog`
**Backlog**
- Deploy VPS dan production
  - [ ] domain
  - [ ] TLS
  - [ ] queue/scheduler
- Migrasi dan rollback
  - [ ] backup
  - [ ] urutan migrasi
  - [ ] rollback
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

### DA9.2 Backup & Restore `Backlog`
**Backlog**
- Backup terjadwal
  - [ ] DB pesantren
  - [ ] DB papan
  - [ ] retensi
- Uji restore
  - [ ] RTO/RPO
  - [ ] dokumentasi
  - [ ] simulasi
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

### DA9.3 Monitoring & Log `Backlog`
**Backlog**
- Log aplikasi dan error
  - [ ] Laravel log
  - [ ] error tracking
  - [ ] rotasi
- Monitoring uptime
  - [ ] health check
  - [ ] disk/DB
  - [ ] alert
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

### DA9.4 Rilis & Distribusi `Backlog`
**Backlog**
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
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## DA10. Dashboard & Laporan

### DA10.1 Dashboard Ringkas `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Ringkasan lintas modul
  - [x] lembaga/santri/pegawai
  - [x] keuangan/siklus/PSB
  - [x] izin per blok

### DA10.2 Statistik Pimpinan `Backlog`
**Backlog**
- Dashboard eksekutif
  - [ ] KPI
  - [ ] tren
  - [ ] perbandingan lembaga
- Ekspor laporan pimpinan
  - [ ] PDF/Excel
  - [ ] jadwal kirim
  - [ ] filter periode
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

### DA10.3 Laporan Terpusat `Backlog`
**Backlog**
- Katalog laporan lintas modul
  - [ ] Santri dan siklus
  - [ ] Akademik dan rapor
  - [ ] Keuangan dan tunggakan
  - [ ] Kepegawaian dan PSB
- Ekspor dan pengiriman terjadwal
  - [ ] Ekspor PDF dan Excel
  - [ ] Jadwal kirim
  - [ ] Riwayat pengiriman
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## DA11. Kerangka UI & Tampilan

### DA11.1 Tabel & Grid `Backlog`
**Backlog**
- Tinggi baris V2 bisa diatur per tabel, ikut isi, dan dibatasi N baris.
- V2 bisa menambah record baru lewat baris input di kaki tabel.
- Migrasi halaman MiMd ke ExcelTabelV2: tiga panel MI Only, MD Semua, dan Perbandingan Kelas memakai header, rail, dan aksi massal V2.
- Tinggi header otomatis (headerAutoH) berlaku di V2: header kolom meninggi mengikuti judul yang membungkus seperti V1, agar spinbox mode otomatis berfungsi.
- Judul kolom V2 tidak terpotong (elipsis): header tabel V2 memotong judul yang panjang, sedangkan V1 membungkusnya jadi beberapa baris. Perlu diselaraskan agar judul terbaca penuh.
- Kolom V2 bisa dibekukan: sejumlah N kolom data pertama tetap terlihat saat tabel digulir horizontal, dengan jumlah beku tersimpan per tabel.
- Judul kolom V2 bisa digeser untuk menyusun ulang urutan kolom, lengkap dengan indikator drop, dan urutannya tersimpan per tabel.
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- ExcelTabelV2 — fondasi pembungkus
  - [x] Komponen ExcelTabelV2 memiliki root data-slot=excel-table dan data-varian=v2 tanpa isi
  - [x] Halaman daftar kelas menampilkan wrapper kosong di mode dev; build produksi tetap memakai ExcelTable lama
  - [x] Verifikasi: typecheck, lint, dan tes komponen
- ExcelTabelV2 — layout tiga bagian
  - [x] ExcelTabelV2 menyusun zona header, body, dan footer dengan penanda data-slot
  - [x] Header dan footer setinggi 32px serta shrink-0; body flex-1 min-h-0
  - [x] Halaman daftar kelas mode dev menampilkan skeleton layout; produksi tetap memakai ExcelTable lama
  - [x] Verifikasi: typecheck, lint, tes komponen, dan build
  - [x] Header dan footer tidak memiliki padding; inset diatur oleh isi zona
  - [x] Kolom Aksi melebar mengikuti jumlah ikon terbanyak pada baris yang tampil (24px per ikon, jarak 2px).
  - [x] Tanpa ikon, kolom Aksi hanya menyisakan padding 4px per sisi; tiga ikon umum (view, edit, delete) memakai 84px.
  - [x] Verifikasi: typecheck, lint, dan tes lebar kolom Aksi lulus.
  - [x] Sel kolom switch memakai Switch ukuran xs (24x14px), sama dengan sel switch V1, sehingga tidak mendominasi tinggi baris.
- ExcelTabelV2 — struktur toolbar awal
  - [x] Toolbar memiliki judul, area aksi kosong, dan tombol ikon ellipsis vertikal tanpa label visual
  - [x] Toolbar memakai padding kiri 8px dan kanan 0; footer memakai padding horizontal 8px; tidak ada gap
  - [x] Halaman daftar kelas mode dev menampilkan toolbar V2; produksi tetap memakai ExcelTable lama
  - [x] Verifikasi: typecheck, lint, tes komponen, dan build
  - [x] Tombol menu memakai lebar 24px dan tinggi memenuhi toolbar
  - [x] Ikon ellipsis berada di tengah tombol
  - [x] Tes ExcelTabelV2 hanya menguji struktur dan aksesibilitas, bukan class CSS
  - [x] Tombol chevron-down 24px berada di antara area aksi dan ellipsis
  - [x] Separator vertikal memisahkan judul, area aksi, chevron, dan ellipsis
  - [x] Klik chevron menampilkan area 32px selebar toolbar di bawahnya
  - [x] Zona toolbar memakai nama toolbar, bukan header (slot excel-table-toolbar)
  - [x] Panel chevron dinamai area filter (slot excel-table-filter-area)
  - [x] Footer V2 memakai nama table-footer (slot table-footer)
  - [x] PresetUrut dan PresetKolom tampil di area filter
  - [x] Area filter terbagi kiri (sisa) dan kanan (PresetUrut/PresetKolom)
  - [x] Area filter tampil sebagai overlay dan tidak menggeser body tabel
- ExcelTabelV2 — paritas komponen aman (tanpa ubah layout)
  - [x] Preset kolom (visibilitas + urutan) berlaku saat dipilih; tampilan awal tetap semua kolom.
  - [x] Pilihan baris dikabarkan lewat onCheckedChange, pilih-semua berstatus indeterminate, klik baris bisa memilih dan menyorot baris aktif.
  - [x] Opsi tabel ringkas (hideCheckbox, hideActions, hidePreset) dan sel kaya (kartuHover, cellClass) berfungsi tanpa mengubah bawaan.
  - [x] Loading memakai skeleton dan progress bar; gaya baris checked/aktif serta warna sel dibatasi di .simpes-dsg-v2.
  - [x] npm run typecheck dan tes tersempit hijau; docs/PETA-MODUL.md diperbarui.
- Judul, label kolom, dan perataan tabel V2 mengikuti setelan pengguna.
  - [x] Judul tabel memakai isian pengguna bila ada; bila kosong tetap prop judul, tanpa kontrol baru.
  - [x] Label header memakai label kustom per tabel; bila tidak ada, label field lalu humanize labelKolom.
  - [x] Perataan kolom dari setelan berlaku pada cell dan header; kolom tanpa setelan default tengah seperti V1.
  - [x] Perubahan setelan dari Kelola Tabel/TopBar langsung terlihat tanpa reload lewat event yang sudah ada.
  - [x] npm run typecheck dan tes tersempit hijau; docs/PETA-MODUL.md diperbarui.
- Setelan tabel berlaku pada ExcelTabelV2: visibilitas komponen, filter toolbar, gerigi Pengaturan tabel, dan menu toolbar.
  - [x] Dropdown Menu lainnya berisi sakelar visibilitas komponen yang tersedia di V2 (Judul tabel, Filter, Urutan, Kolom, Tombol aksi, Header kolom, Kolom centang, Kolom Aksi, Pager, Tombol pengaturan) plus pintasan Kelola Tabel dan Pengaturan tampilan; menu tetap terbuka saat mencentang.
  - [x] Sakelar tampilan perangkat (Tabel mengisi lebar, Baris ikut isi) tetap di Kelola Tabel: V2 belum menerapkan keduanya, jadi tidak dipindah agar tidak menjadi tombol mati.
  - [x] Perubahan visibilitas langsung berlaku tanpa reload lewat merge peta server dan kabariToolbar; V1 tidak terpengaruh.
  - [x] Kelola Tabel dari V2 (mode ringkas) menyembunyikan sakelar visibilitas; input judul, label/perataan, urutan, info, kolom beku, tinggi baris, dan reset tetap tersedia.
  - [x] Gerigi Pengaturan tabel, ikon Info, dan item menu pintasan berfungsi sesuai izin; tidak ada tombol mati.
  - [x] npm run typecheck dan tes tersempit hijau (70 tes); anotasi Menu lainnya dihapus setelah selesai.
- Aksi halaman di toolbar V2: aksi massal baris tercentang, tombol aksi utama, dan slot kontrol halaman.
  - [x] ExcelTabelV2 menerima judul sebagai node (header) selain judul berupa string, dengan presedensi judul setelan pengguna, lalu header, lalu judul string, lalu bawaan dari tableKey.
  - [x] Halaman yang hanya mengirim judul string tampil persis seperti sekarang; tidak ada perubahan layout.
  - [x] Halaman V2 contoh memakai header berupa node dan judulnya tampil benar, termasuk saat judul setelan pengguna diisi.
  - [x] Rail filter Tingkat/Kelas tampil di kiri grid V2 lewat prop rail, sejajar judul kolom memakai tinggi header yang sama dengan GridV2, dan menghormati sakelar rel_filter.
  - [x] ExcelTabelV2 menerima slot aksi halaman: awalanToolbar, akhirToolbar, addButton (langsung atau menu Aksi lewat addButtonLangsung), dan renderBulkActions yang hanya dipanggil saat ada centang serta bisa mengosongkan pilihan.
  - [x] npm run typecheck dan tes tersempit hijau; V1 tidak berubah.
- Rel filter tingkat/kelas tampil di kiri grid V2.
  - [x] Rail filter tingkat/kelas tampil di kiri grid V2 dan sejajar judul kolom pada halaman contoh.
  - [x] Rail menghormati sakelar rel_filter: hilang saat dimatikan dan kembali saat dinyalakan (paritas V1).
  - [x] infoKomponen ikut berubah saat rail atau addButton berubah, bukan menyisakan nilai basi.
  - [x] Halaman tanpa filter tingkat/kelas tidak menampilkan rail meski prop rail diaktifkan.
  - [x] npm run typecheck dan tes tersempit hijau; V1 tidak berubah.
- Lebar kolom V2 bisa diubah lewat handle, AutoFit, dan tersimpan per perangkat.
  - [x] Kolom V2 bisa diubah lebarnya dengan menyeret handle di judul kolom.
  - [x] Klik 2x pada handle menjalankan AutoFit lebar kolom itu.
  - [x] AutoFit mengukur isi sel V2 secara akurat memakai teks yang sama dengan yang dirender (sel contoh diambil dari kolom yang diukur dan padding pembungkus isi ikut terhitung; V1 tidak terpengaruh).
  - [x] Lebar kolom tersimpan per perangkat dan bertahan setelah aplikasi dibuka ulang.
  - [x] Grid tidak tampil sebelum DSG memakai lebar basis, sehingga judul kolom tidak melompat saat muat.
  - [x] onAutoFitAll dan resetLebar tersedia dari ExcelTabelV2 agar poin menu klik kanan dan ribbon bisa menyambung tanpa pekerjaan ulang.
  - [x] npm run typecheck dan tes tersempit hijau; V1 tidak berubah.
  - [x] Gagang lebar duduk tepat di border kolom (pembungkus judul dikunci ke lebar sel, bukan w-full pada container DSG yang bisa lebih lebar).
  - [ ] Pemeriksaan pengguna: seret gagang, klik 2x AutoFit pada nis_lokal, dan pastikan tidak ada elipsis lagi.
- Tabel V2 bisa mengisi lebar wadah penuh (isi-lebar) dengan pembagian lebar kolom proporsional.
  - [x] Ada sakelar "isi lebar penuh" untuk tabel V2; saat aktif dan tabel lebih sempit dari wadah, total lebar kolom mengisi wadah sehingga tidak ada sisa ruang di kanan.
  - [x] Pembagian lebar antar kolom proporsional mengikuti lebar basisnya masing-masing (kolom lebar tetap lebih lebar), bukan dibagi rata.
  - [x] Tabel yang total kolomnya melebihi wadah DIBIARKAN menggulir horizontal; kolom tidak menyusut sampai batas minimum (keputusan pengguna: opsi A, hanya membesarkan).
  - [x] Sakelar tersimpan per tabel dan per perangkat, serta bertahan setelah aplikasi dibuka ulang.
  - [x] Saat isi-lebar aktif, menyeret gagang lebar kolom tetap bekerja dan hasil seret tidak langsung ditimpa pembagian otomatis (rasio dipakai agar seret terasa 1:1).
  - [x] Mematikan isi-lebar mengembalikan lebar kolom seperti semula tanpa merusak lebar tersimpan pengguna.
  - [x] npm run typecheck dan tes tersempit hijau; V1 tidak berubah.
  - [ ] Pemeriksaan pengguna: aktifkan "isi lebar penuh" di Kelola Tabel -> Umum pada tabel berkolom sedikit dan pastikan kolom mengisi lebar tanpa sisa ruang kanan.
- Sel V2 bisa disunting langsung dengan simpan otomatis dan validasi.
  - [x] Sel V2 bisa disunting langsung dengan klik ganda, hanya untuk kolom yang bisa disunting (kind selain static); kolom static tetap terkunci.
  - [x] Klik ganda menyalakan Mode Ubah yang ditandai pill status "Mode Ubah aktif"; sebelum itu sel tetap baca-saja (pagar sama seperti V1).
  - [x] Perubahan tersimpan otomatis ke server tanpa tombol simpan, memakai rute simpan yang sudah ada di halaman (pakaiCommitDaftarKelas).
  - [x] Ketikan beruntun pada satu baris digabung: hanya satu simpanan dan satu notifikasi setelah antrean habis, bukan satu per ketikan.
  - [x] Nilai yang gagal validasi ditolak: sel kembali ke nilai server, muncul pesan galat, dan sel lain di baris yang sama tetap tersimpan.
  - [x] Tabel tanpa izin edit (canEdit false) tidak menampilkan Mode Ubah sama sekali; sel tetap baca-saja.
  - [x] npm run typecheck dan tes tersempit hijau; V1 tidak berubah.
  - [ ] Pemeriksaan pengguna: klik ganda sebuah sel teks, ubah isinya, lalu pastikan tersimpan setelah muat ulang dan nilai tidak valid ditolak.
- Menu klik kanan, salin TSV, dan seret isi sel berfungsi di V2.
  - [x] Klik kanan judul kolom V2 menampilkan AutoFit kolom, AutoFit semua, salin kolom (TSV), perataan (super admin), dan Kelola Tabel; area kosong tidak memunculkan menu bawaan WebView.
  - [x] Klik kanan baris/sel menampilkan salin baris (TSV) dan salin nilai sel; klik kanan sudut kiri-atas menyalin seluruh tabel (label header + semua baris) sebagai TSV memakai label kolom setelan pengguna dan nilai yang sedang tampil.
  - [x] Ctrl/Cmd+C menyalin blok seleksi sebagai TSV, sel tunggal sebagai nilainya saja, dan baris tercentang menang atas blok; saat fokus di input/dialog salin native tidak direbut.
  - [x] Mode Ubah menampilkan sakelar Seret isi sel untuk copy dan move di pill status; keduanya mati bawaan, saling eksklusif, tersimpan per tabel/perangkat, dan hanya hidup selama Mode Ubah + izin edit.
  - [x] Menyeret blok terpilih menyalin atau memindahkan isinya ke sel tujuan (sumber dikosongkan pada move), dengan umpan balik sumber/tujuan, badge Salin/Pindahkan, draft langsung terlihat, dan simpan otomatis per baris.
  - [x] Seret isi sel hanya mengubah kolom yang bisa disunting; kolom static tetap, tabel tanpa izin edit tidak menampilkan sakelar/seret, dan nilai yang gagal validasi dikembalikan dengan pesan galat.
  - [ ] npm run typecheck dan tes tersempit V2 hijau; V1 tidak berubah; pemeriksaan pengguna: klik kanan header/baris/sudut, Ctrl+C blok, lalu seret blok dengan mode copy dan move di Daftar Kelas (mode dev).
**Done**
- Grid tabel bergaya Excel
  - [x] Seleksi blok dan salin/tempel TSV
  - [x] Autofit dan atur lebar kolom
  - [x] Header beku dan scrollbar melayang
  - [x] Simpan otomatis per sel
- Preset kolom, urutan, dan toolbar
  - [x] Preset kolom per pengguna
  - [x] Urutan dan visibilitas kolom
  - [x] Toolbar preset dan komponen input custom

### DA11.2 Navigasi & Pencarian `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
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

### DA11.3 Tampilan & Aksesibilitas `Backlog`
**Backlog**
- Evaluasi terhadap penggunaan tes untuk UI
  - [ ] Kebijakan penggunaan tes UI untuk SIMPES ditetapkan dan dapat diterapkan pada komponen bersama
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- Jarak tombol footer dialog dari border dan kontrol
  - [x] Dialog standar memakai jarak minimum 8px antar bagian sehingga footer tidak menempel pada border atau kontrol
  - [x] Dialog bertata letak kustom (p-0/gap-0) tetap rapat sesuai rancangannya
  - [x] Tombol tutup tetap berada di atas konten yang bergulir
  - [x] Verifikasi: typecheck dan tes dialog terkait
**Done**
- Tema, density, dan mode navigasi
  - [x] Terang/gelap/sistem
  - [x] Density dan radius sudut
  - [x] Sidebar/menubar dan sembilan set ikon
- Bantuan keyboard dan pembaca layar
  - [x] Overlay bantuan keyboard dapat dibuka dari tombol TopBar dan pintasan ?; ? diabaikan saat mengetik atau saat dialog lain terbuka
  - [x] Overlay memuat pintasan global dan kontekstual: palet Ctrl/Cmd+K, cari /, sidebar Ctrl/Cmd+B, tambah Ctrl/Cmd+N, bantuan ?, serta navigasi grid/Board
  - [x] Dialog memakai judul/deskripsi yang terbaca pembaca layar, focus trap, Escape, dan mengembalikan fokus
  - [x] Pencarian halaman pindah ke /; Ctrl/Cmd+K hanya milik palet; chip, tooltip, dan aria-keyshortcuts diperbarui
  - [x] Verifikasi: tes komponen overlay/pintasan, typecheck, dan pemeriksaan keyboard

### DA11.4 Halaman Board `For Review`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- Pencarian Board lewat TopBar
  - [x] Pencarian TopBar di Board mencakup semua aplikasi dan modul
  - [x] Hasil muncul sebagai popup tepat di bawah input search, dikelompokkan per aplikasi lalu modul dengan konteks sub-modul dan status
  - [x] Klik hasil membuka aplikasi/modul terkait, mengosongkan pencarian, menutup popup, dan menyorot poin termasuk membuka kolom/kartu yang terlipat
  - [x] Popup menutup saat klik di luar atau Escape; fokus ulang input membuka lagi selama kata kunci masih ada
  - [x] Saat pencarian kosong, Board kembali menampilkan modul aktif seperti biasa
  - [x] Pemeriksaan: tes popup/pencarian, tes sorotan, dan typecheck
- Batasi akses Board hanya untuk super_admin
  - [x] Admin tidak lagi memiliki izin papan.lihat dan papan.ubah
  - [x] Menu dan rute Board hanya dapat diakses super_admin
  - [x] Pemeriksaan: tes izin dan typecheck hijau
- Pencarian global non-Board dengan pengaturan per halaman
  - [x] Pengaturan Pencarian global menyediakan checkbox per halaman; default nonaktif, dengan Daftar Kelas, Buku Induk Santri, Buku Induk Guru, dan Tagihan aktif
  - [x] Endpoint pencarian hanya mengembalikan halaman yang aktif dan boleh diakses pengguna
  - [x] Popup TopBar di halaman non-Board menampilkan hasil lintas halaman; Board tetap memakai pencarian Board sendiri
  - [x] Klik hasil membuka detail bila tersedia, selain itu halaman terfilter yang tepat
  - [x] Halaman target membaca kata kunci dari URL dan memfilter datanya
  - [x] Pemeriksaan: tes backend/frontend dan typecheck hijau
- Pengaturan visibilitas navigasi terpusat dengan delegasi admin
  - [x] Super_admin mengatur visibilitas navigasi global yang tersimpan di server
  - [x] Admin dapat mengatur tampilan pribadinya hanya untuk entri yang tidak dinonaktifkan super_admin
  - [x] Sidebar, menubar, dan tab memakai gabungan setelan global dan pribadi; URL langsung tetap membuka konten
  - [x] Dialog menyesuaikan mode: super_admin mengubah global, admin mengubah pilihan pribadi; tampilkan semua sesuai mode
  - [x] Pemeriksaan: tes backend/frontend, typecheck, schema, dan izin hijau
- Samakan font NIS di tab Nomor Peserta
  - [x] Kolom NIS memakai font yang sama dengan kolom lain di tabel nomor peserta
  - [x] Pemeriksaan: typecheck hijau
**Done**
- Kolom status tanpa sub-modul terlipat saat Board dibuka
  - [x] Kolom tanpa sub-modul tertutup saat halaman Board dibuka
  - [x] Kolom yang punya sub-modul terbuka
  - [x] Kolom Done selalu tertutup secara default
  - [x] Bukaan manual pengguna tetap setelah data disegarkan
  - [x] Verifikasi: 27 tes komponen Board lulus + npm run typecheck
- Rail modul menandai modul yang punya pekerjaan For Review
  - [x] Modul dengan poin For Review berlatar warna berbeda di rail modul
  - [x] Modul tanpa For Review tetap netral
  - [x] Warna tetap terbaca saat modul itu sedang aktif
  - [x] Verifikasi: tes pustaka + typecheck + pratinjau visual
- Alur pemilihan, riset, dan konfirmasi pekerjaan melalui Board
  - [x] Seluruh 103 poin To Do dikembalikan ke Backlog dengan riwayat perubahan
  - [x] Pengguna memilih To Do hanya pada alur kerja aplikasi yang efektif Aktif
  - [x] To Do dipakai untuk riset hanya-baca dan penyusunan syarat selesai
  - [x] Hasil riset menyertakan rekomendasi UI atau menyatakan tidak ada dampak UI
  - [x] Poin tetap To Do sampai subpoin final dan izin pengerjaan disetujui
  - [x] Maksimal satu In Progress per aplikasi dan urutan beberapa To Do ditentukan
  - [x] Setelah disetujui poin masuk In Progress, dikerjakan, lalu masuk For Review
- Kartu sub-modul di Board bisa dilipat dan tertutup secara bawaan
  - [x] Seluruh area header kartu selain tombol aksi dapat membuka/menutup kartu; semua kartu tertutup saat Board dibuka
  - [x] Kepala kartu yang tertutup tetap menampilkan kode, nama, dan ringkasan kemajuan
  - [x] Membuka kartu menampilkan meter, daftar poin, dan form tambah poin; aksi tambah/ubah otomatis membuka kartu
  - [x] Keadaan buka/tutup tetap terjaga saat data Board disegarkan dan dapat dioperasikan lewat keyboard
  - [x] Pemeriksaan: typecheck dan tes komponen Board hijau
- Field Requirement pada setiap poin Board
  - [x] Setiap poin punya requirement opsional yang tampil di bawah teks poin bila terisi
  - [x] Requirement dapat diisi, diubah, dan dikosongkan lewat mode ubah poin lalu tersimpan di Board
  - [x] Form tambah poin menerima requirement opsional
  - [x] Data poin lama tetap aman; requirement kosong tidak mengubah tampilan
  - [x] Pemeriksaan: tes backend Board, tes komponen Board, dan typecheck hijau
- Label status Board memakai istilah teknis saja
  - [x] Kolom, dropdown, riwayat, dan pengumuman Board memakai Backlog, To Do, In Progress, For Review, Done
  - [x] PETA-MODUL dan keluaran perintah Board memakai istilah teknis yang sama
  - [x] Pesan validasi dan bantuan perintah tidak lagi memakai label penjelas status
  - [x] Pemeriksaan: tes backend Board, tes komponen Board, dan typecheck hijau
- Rail modul menandai For Review dengan jumlah poin
  - [x] Rail modul tidak lagi menampilkan angka selesai/total
  - [x] Modul yang punya poin For Review menampilkan jumlah poin For Review di rail
  - [x] Latar khusus For Review pada rail dihapus; penandanya hanya angka tersebut
  - [x] Lencana memakai latar primary dan warnanya tetap sama saat rail dipilih maupun tidak dipilih
  - [x] Pemeriksaan: typecheck dan tes komponen Board hijau
- Requirement poin diproses menjadi subpoin lalu dikosongkan
  - [x] Field poin disebut Requirement (instruksi khusus) di form tambah dan editor
  - [x] Requirement tampil di kartu dengan label jelas dan tidak dianggap catatan permanen
  - [x] Aturan workflow wajib di AGENTS.md: riset requirement, tambah subpoin, kosongkan requirement setelah subpoin tersimpan, tanpa melewati konfirmasi
  - [x] Pemeriksaan: typecheck dan tes komponen Board hijau

## DA12. Dokumen & Berkas

### DA12.1 Arsip Dokumen `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
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

### DA12.2 Impor & Ekspor Berkas `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
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

### MO0.1 Kerangka & Distribusi `Backlog`
**Backlog**
- Kerangka aplikasi mobile
  - [ ] Pilihan stack dan struktur proyek
  - [ ] Navigasi dan tema dasar
  - [ ] Konfigurasi API dan sesi
- Build dan distribusi rilis
  - [ ] Build debug dan rilis
  - [ ] Distribusi uji internal
  - [ ] Tanda tangan dan rilis toko
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MO1. Akun & Onboarding

### MO1.1 API Autentikasi `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Login wali lewat API
  - [x] Sanctum
  - [x] multi-identifier
  - [x] peran orang_tua

### MO1.2 UI Mobile `Backlog`
**Backlog**
- Login dan onboarding wali
  - [ ] email/HP
  - [ ] OTP
  - [ ] pilih santri
- Verifikasi relasi wali-santri
  - [ ] data wali
  - [ ] data santri
  - [ ] batas akses
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MO2. Profil Santri

### MO2.1 API Portal `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Rute portal wali
  - [x] portal/*
  - [x] role orang_tua
  - [x] agregator baca

### MO2.2 UI Profil `Backlog`
**Backlog**
- Biodata dan dokumen anak
  - [ ] lihat
  - [ ] unduh
  - [ ] pengajuan perubahan
- Riwayat belajar
  - [ ] per lembaga
  - [ ] kelas
  - [ ] status aktif
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MO3. Tagihan & Pembayaran

### MO3.1 API Keuangan `Backlog`
**Backlog**
- API tagihan dan pembayaran untuk portal wali
  - [ ] Daftar tagihan per anak
  - [ ] Riwayat pembayaran
  - [ ] Sisa tunggakan per anak
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

### MO3.2 UI Tagihan `Backlog`
**Backlog**
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
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MO4. Presensi & Perilaku

### MO4.1 API Presensi `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Tabel presensi santri
  - [x] sesi
  - [x] kehadiran
  - [x] pelanggaran

### MO4.2 UI Presensi `Backlog`
**Backlog**
- Presensi harian anak
  - [ ] per sesi
  - [ ] izin/sakit
  - [ ] rekap
- Pelanggaran
  - [ ] jenis
  - [ ] poin
  - [ ] tindak lanjut
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MO5. Tahfizh

### MO5.1 API Tahfizh `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Tabel target dan setoran
  - [x] target
  - [x] setoran
  - [x] rekap

### MO5.2 UI Tahfizh `Backlog`
**Backlog**
- Target dan setoran
  - [ ] ziyadah
  - [ ] murajaah
  - [ ] grafik
- Rekap tahfizh
  - [ ] periode
  - [ ] catatan guru
  - [ ] unduh
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MO6. PSB & Pengajuan

### MO6.1 API PSB `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Pendaftaran dan pengajuan
  - [x] PSB
  - [x] biodata
  - [x] dokumen

### MO6.2 UI PSB `Backlog`
**Backlog**
- PSB online
  - [ ] formulir
  - [ ] unggah dokumen
  - [ ] status
- Pengajuan biodata
  - [ ] satu aktif
  - [ ] batal
  - [ ] verifikasi
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MO7. Notifikasi

### MO7.1 Push & WhatsApp `Backlog`
**Backlog**
- Notifikasi tagihan dan presensi
  - [ ] push
  - [ ] WhatsApp
  - [ ] deep link
- Preferensi notifikasi
  - [ ] jenis
  - [ ] jam tenang
  - [ ] per anak
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)
---

# Aplikasi: Mobile Guru

## MG0. Fondasi & Rilis

### MG0.1 Kerangka & Distribusi `Backlog`
**Backlog**
- Kerangka aplikasi mobile
  - [ ] Pilihan stack dan struktur proyek
  - [ ] Navigasi dan tema dasar
  - [ ] Konfigurasi API dan sesi
- Build dan distribusi rilis
  - [ ] Build debug dan rilis
  - [ ] Distribusi uji internal
  - [ ] Tanda tangan dan rilis toko
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MG1. Akun & Login

### MG1.1 API Autentikasi `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Login guru lewat API
  - [x] Sanctum
  - [x] multi-identifier
  - [x] peran guru

### MG1.2 UI Guru `Backlog`
**Backlog**
- Login mobile dan profil guru
  - [ ] email/HP
  - [ ] sesi perangkat
  - [ ] penempatan
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MG2. Jadwal Mengajar

### MG2.1 API Jadwal `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Jadwal per kelas
  - [x] slot
  - [x] anti bentrok
  - [x] per TA

### MG2.2 UI Jadwal `Backlog`
**Backlog**
- Agenda mengajar guru
  - [ ] hari ini
  - [ ] minggu
  - [ ] filter
- Detail kelas
  - [ ] mapel
  - [ ] jam
  - [ ] ruang
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MG3. Input Nilai

### MG3.1 API Nilai `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Nilai per kegiatan evaluatif
  - [x] komponen
  - [x] impor
  - [x] leger

### MG3.2 UI Input `Backlog`
**Backlog**
- Input nilai per kelas
  - [ ] mapel
  - [ ] komponen
  - [ ] validasi
- Rekap dan submit nilai
  - [ ] kunci
  - [ ] status
  - [ ] koreksi
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MG4. Presensi Pegawai

### MG4.1 API Presensi `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Tabel presensi pegawai
  - [x] status harian
  - [x] rekap
  - [x] koreksi

### MG4.2 UI Presensi `Backlog`
**Backlog**
- Absen harian guru
  - [ ] masuk/pulang
  - [ ] lokasi
  - [ ] riwayat
- Izin dan cuti
  - [ ] pengajuan
  - [ ] persetujuan
  - [ ] lampiran
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MG5. Setoran Tahfizh

### MG5.1 API Tahfizh `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Tabel setoran tahfizh
  - [x] target
  - [x] setoran
  - [x] rekap

### MG5.2 UI Setoran `Backlog`
**Backlog**
- Input setoran
  - [ ] ziyadah
  - [ ] murajaah
  - [ ] catatan
- Rekap santri
  - [ ] per kelas
  - [ ] periode
  - [ ] unduh
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MG6. Pengampu & Kelas

### MG6.1 API Pengampu `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Pivot pengampu
  - [x] kelas × mapel
  - [x] guru
  - [x] per TA

### MG6.2 UI Pendampingan `Backlog`
**Backlog**
- Daftar kelas dan mapel
  - [ ] TA aktif
  - [ ] daftar siswa
  - [ ] filter
- Catatan kelas
  - [ ] jurnal
  - [ ] tindak lanjut
  - [ ] riwayat
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MG7. Pengajuan & Izin

### MG7.1 Alur Pengajuan `Backlog`
**Backlog**
- Pengajuan izin guru
  - [ ] jenis
  - [ ] lampiran
  - [ ] atasan
- Status pengajuan
  - [ ] riwayat
  - [ ] notifikasi
  - [ ] pembatalan
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)
---

# Aplikasi: Mobile Pimpinan

## MP0. Fondasi & Rilis

### MP0.1 Kerangka & Distribusi `Backlog`
**Backlog**
- Kerangka aplikasi mobile
  - [ ] Pilihan stack dan struktur proyek
  - [ ] Navigasi dan tema dasar
  - [ ] Konfigurasi API dan sesi
- Build dan distribusi rilis
  - [ ] Build debug dan rilis
  - [ ] Distribusi uji internal
  - [ ] Tanda tangan dan rilis toko
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MP1. Akun & Login

### MP1.1 API Autentikasi `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Login pimpinan lewat API
  - [x] Sanctum
  - [x] multi-identifier
  - [x] batas izin

### MP1.2 UI Pimpinan `Backlog`
**Backlog**
- Login mobile pimpinan
  - [ ] email/HP
  - [ ] sesi perangkat
  - [ ] profil
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MP2. Dashboard Eksekutif

### MP2.1 API Ringkasan `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Ringkasan lintas modul
  - [x] dashboard/ringkasan
  - [x] izin per blok
  - [x] null bila tak berizin

### MP2.2 UI KPI `Backlog`
**Backlog**
- KPI dan tren
  - [ ] per lembaga
  - [ ] periode
  - [ ] perbandingan
- Statistik pimpinan lanjutan
  - [ ] modul 504
  - [ ] ekspor
  - [ ] jadwal kirim
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MP3. Statistik Keuangan

### MP3.1 API Keuangan `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Data tagihan dan pembayaran
  - [x] tagihan
  - [x] terbayar
  - [x] tunggakan

### MP3.2 UI Keuangan `Backlog`
**Backlog**
- Tren keuangan
  - [ ] per lembaga
  - [ ] per kas
  - [ ] periode
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MP4. Statistik Santri & PSB

### MP4.1 API Santri & PSB `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Data santri dan PSB
  - [x] jumlah aktif
  - [x] funnel PSB
  - [x] per lembaga

### MP4.2 UI Santri `Backlog`
**Backlog**
- Statistik santri
  - [ ] per jenjang
  - [ ] siklus
  - [ ] mutasi
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MP5. Statistik Akademik

### MP5.1 API Akademik `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Data nilai dan kehadiran
  - [x] nilai
  - [x] jadwal
  - [x] presensi

### MP5.2 UI Akademik `Backlog`
**Backlog**
- Distribusi nilai dan kehadiran
  - [ ] per kelas
  - [ ] per mapel
  - [ ] peringatan
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MP6. Laporan & Ekspor

### MP6.1 Laporan `Backlog`
**Backlog**
- Laporan PDF/Excel
  - [ ] periode
  - [ ] per lembaga
  - [ ] filter
- Jadwal kirim laporan
  - [ ] email/WA
  - [ ] rekap berkala
  - [ ] riwayat
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MP7. Notifikasi & Alert

### MP7.1 Alert `Backlog`
**Backlog**
- Ambang batas otomatis
  - [ ] tunggakan
  - [ ] kehadiran
  - [ ] nilai
- Push dan riwayat alert
  - [ ] kegiatan evaluatif
  - [ ] penerima
  - [ ] tindak lanjut
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)
---

# Aplikasi: Mobile Kasir

## MK0. Fondasi & Rilis

### MK0.1 Kerangka & Distribusi `Backlog`
**Backlog**
- Kerangka aplikasi mobile
  - [ ] Pilihan stack dan struktur proyek
  - [ ] Navigasi dan tema dasar
  - [ ] Konfigurasi API dan sesi
- Build dan distribusi rilis
  - [ ] Build debug dan rilis
  - [ ] Distribusi uji internal
  - [ ] Tanda tangan dan rilis toko
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MK1. Akun & Login

### MK1.1 API Autentikasi `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Login kasir lewat API
  - [x] Sanctum
  - [x] multi-identifier
  - [x] batas izin

### MK1.2 UI Kasir `Backlog`
**Backlog**
- Login dan profil kasir
  - [ ] role kasir
  - [ ] perangkat
  - [ ] shift
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

### MK1.3 Peran & Izin Kasir `Backlog`
**Backlog**
- Peran dan izin kasir untuk aplikasi mobile
  - [ ] Buat peran kasir
  - [ ] Izin kasir: pembayaran, kwitansi, tunggakan
  - [ ] Uji login dan akses kasir
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MK2. Kasir Harian

### MK2.1 API Kasir `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Pembayaran dan pembatalan
  - [x] kasir
  - [x] saldo terkunci
  - [x] batal/hapus

### MK2.2 UI Kasir `Backlog`
**Backlog**
- Cari santri dan pilih tagihan
  - [ ] pencarian
  - [ ] filter
  - [ ] rincian
- Bayar dan cetak
  - [ ] metode
  - [ ] konfirmasi
  - [ ] kwitansi
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MK3. Kwitansi

### MK3.1 API Kwitansi `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Kwitansi dan cetak ulang
  - [x] nomor
  - [x] data bayar
  - [x] riwayat

### MK3.2 UI Kwitansi `Backlog`
**Backlog**
- Cetak thermal dan bagikan
  - [ ] thermal
  - [ ] PDF
  - [ ] WhatsApp
- Nomor kwitansi runut
  - [ ] per kas
  - [ ] per tahun
  - [ ] format final
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MK4. Tunggakan

### MK4.1 API Tunggakan `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Crosstab tunggakan
  - [x] per santri/kelas
  - [x] total
  - [x] terbayar

### MK4.2 UI Tunggakan `Backlog`
**Backlog**
- Daftar tunggakan kasir
  - [ ] aging
  - [ ] surat
  - [ ] pengingat
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MK5. Tutup Buku & Rekap

### MK5.1 API Rekap `Backlog`
**Backlog**
- Rekap per posisi kas
  - [ ] tunai
  - [ ] bank
  - [ ] periode
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

### MK5.2 UI Tutup Buku `Backlog`
**Backlog**
- Tutup buku harian
  - [ ] rekap
  - [ ] kunci
  - [ ] buka kunci
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MK6. Dispensasi

### MK6.1 API Dispensasi `Done`
**Backlog**
- (kosong)
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Dispensasi dan grup santri
  - [x] disponsasi
  - [x] grup custom
  - [x] tagihan

### MK6.2 UI Dispensasi `Backlog`
**Backlog**
- Pengajuan dan persetujuan
  - [ ] ajukan
  - [ ] setujui
  - [ ] riwayat
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## MK7. Offline & Sinkronisasi

### MK7.1 Mode Offline `Backlog`
**Backlog**
- Cache data tagihan
  - [ ] santri
  - [ ] tagihan
  - [ ] saldo
- Antrean transaksi
  - [ ] simpan lokal
  - [ ] retry
  - [ ] status
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

### MK7.2 Sinkronisasi `Backlog`
**Backlog**
- Sinkron dan konflik
  - [ ] timestamp
  - [ ] konflik
  - [ ] audit
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)
---

# Aplikasi: Landing Page Pesantren

## LP0. Fondasi & Peluncuran

### LP0.1 Fondasi Teknis `Backlog`
**Backlog**
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
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

### LP0.2 Peluncuran `Backlog`
**Backlog**
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
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## LP1. Profil & Identitas

### LP1.1 Struktur Halaman `Backlog`
**Backlog**
- Halaman profil pesantren
  - [ ] sejarah
  - [ ] visi-misi
  - [ ] struktur
- Profil per lembaga
  - [ ] MI
  - [ ] MD
  - [ ] MTS
  - [ ] MLN
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

### LP1.2 Konten Identitas `Backlog`
**Backlog**
- Fasilitas dan prestasi
  - [ ] fasilitas
  - [ ] prestasi
  - [ ] galeri
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## LP2. PSB Online

### LP2.1 Formulir PSB `Backlog`
**Backlog**
- Formulir pendaftaran publik
  - [ ] jalur
  - [ ] data calon
  - [ ] unggah
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- Prototipe formulir PSB publik berjalan
  - [x] Pilihan lembaga dan paket
  - [x] Data calon dan cek NIK
  - [x] Unggah bukti transfer
  - [x] Nomor pendaftaran

### LP2.2 Status & Biaya `Backlog`
**Backlog**
- Cek status dan biaya
  - [ ] status
  - [ ] biaya
  - [ ] konfirmasi
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## LP3. Berita & Pengumuman

### LP3.1 CMS Berita `Backlog`
**Backlog**
- Kelola berita dan pengumuman
  - [ ] kategori
  - [ ] editor
  - [ ] jadwal terbit
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

### LP3.2 Tampilan Publik `Backlog`
**Backlog**
- Daftar dan detail berita
  - [ ] daftar
  - [ ] detail
  - [ ] pencarian
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## LP4. Galeri & Fasilitas

### LP4.1 Album `Backlog`
**Backlog**
- Album foto dan video
  - [ ] kategori
  - [ ] lazy load
  - [ ] caption
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

### LP4.2 Virtual Tour `Backlog`
**Backlog**
- Tur 360 dan peta
  - [ ] 360
  - [ ] peta
  - [ ] aksesibilitas
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## LP5. Kontak & WhatsApp

### LP5.1 Kontak `Backlog`
**Backlog**
- Form kontak dan lokasi
  - [ ] form
  - [ ] maps
  - [ ] jam layanan
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

### LP5.2 WhatsApp `Backlog`
**Backlog**
- WhatsApp dan antispam
  - [ ] deep link
  - [ ] template
  - [ ] antispam
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## LP6. SEO & Analytics

### LP6.1 SEO Teknis `Backlog`
**Backlog**
- Metadata dan sitemap
  - [ ] metadata
  - [ ] sitemap
  - [ ] schema.org
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

### LP6.2 Analytics `Backlog`
**Backlog**
- Analytics dan consent
  - [ ] GA4
  - [ ] event PSB
  - [ ] consent
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## LP7. Multi-lembaga & Bahasa

### LP7.1 Multi-lembaga `Backlog`
**Backlog**
- Halaman per lembaga
  - [ ] jenjang
  - [ ] navigasi
  - [ ] konten
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

### LP7.2 Bahasa & Aksesibilitas `Backlog`
**Backlog**
- Bahasa dan aksesibilitas
  - [ ] ID/EN
  - [ ] kontras
  - [ ] keyboard
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

## LP8. Keamanan & Performa

### LP8.1 Keamanan `Backlog`
**Backlog**
- Keamanan publik
  - [ ] HTTPS
  - [ ] anti-spam
  - [ ] rate limit
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
- (kosong)

### LP8.2 Performa `Backlog`
**Backlog**
- Performa halaman
  - [ ] cache
  - [ ] gambar
  - [ ] Lighthouse
**To Do**
- (kosong)
**In Progress**
- (kosong)
**For Review**
- (kosong)
**Done**
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
