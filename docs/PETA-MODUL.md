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
| `php artisan papan:tandai E.3 128 sedang --catatan="..."` | Pindahkan satu **poin** |
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
(`sudah` | `sedang` | `akan` | `ditunda`), dan status sub-modul **dihitung otomatis**
dari poin-poinnya: ada poin `sedang` → sub-modul `sedang`; kalau tidak, ada poin
`akan` → `akan`; semua `ditunda` → `ditunda`; selain itu (semua sudah) → `sudah`.
Jadi satu poin yang belum selesai sudah cukup menahan sub-modul tetap `akan`.

Konsekuensinya, di UI satu sub-modul bisa muncul di beberapa kolom sekaligus —
memang begitu yang diinginkan: `E.3` yang separuh selesai tampil sebagai kartu di
kolom **Sudah** dan **Akan** bersamaan.

Modul di berkas ini **dihasilkan** `papan:markdown --tulis`; bagian SEDANG
DIKERJAKAN dan RINCIAN TEKNIS LAINNYA dipertahankan apa adanya. Jadi setelah
mengubah status lewat command, jalankan `--tulis` supaya berkas ini ikut segar,
lalu commit markdown-nya sebagai jejak yang tahan lama.

**Status timeline:** Board berada pada status **Draf** sampai diaktifkan. Timeline
hanya menjadi rujukan agen/pengguna saat status Board **Aktif**; saat Draf,
PRD dan kode yang berlaku.

## Cara baca

Empat status dipakai konsisten di seluruh berkas:

- **SUDAH** — kode ada, terhubung, dipakai dari UI.
- **SEDANG** — dikerjakan sekarang. Hanya boleh **satu** sub-modul bertanda ini.
- **AKAN** — belum ada kode, sudah dirancang cukup untuk dikerjakan.
- **DITUNDA** — belum dikerjakan dan sengaja ditunda; bisa karena masih rencana
  awal atau menunggu pelaksanaan pasca production.

Status yang tidak berlaku ditulis **(kosong)** agar tidak tampak terlewat.

---

# Aplikasi: Desktop Admin

## DA1. Fondasi & Infrastruktur

### DA1.1 Setup & Runtime `SUDAH`
**SUDAH**
- Proyek Laravel 13, Vite, dan Tauri berjalan
  - [x] API-first
  - [x] Sanctum
  - [x] SQLite/MySQL siap
- Konfigurasi dev dan produksi terdokumentasi
  - [x] .env contoh
  - [x] CORS localhost
  - [x] perintah artisan/npm
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### DA1.2 Skema Database `SUDAH`
**SUDAH**
- Migrasi dan skema pesantren terkendali
  - [x] 84 file migrasi
  - [x] 126 tabel termasuk framework
  - [x] SCHEMA.md
- Database papan terpisah dari database pesantren
  - [x] koneksi papan
  - [x] migrasi path papan
  - [x] tidak ikut migrate:fresh
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### DA1.3 Referensi & Master `SUDAH`
**SUDAH**
- Kamus referensi per lembaga
  - [x] 34 tabel kamus
  - [x] RefService ber-cache
  - [x] fan-out
- CRUD Lembaga, Tahun Ajaran, dan Kelas
  - [x] scope tenant
  - [x] validasi jenjang
  - [x] kode unik
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

## DA2. Autentikasi & Pengguna

### DA2.1 Login & Sesi `SUDAH`
**SUDAH**
- Login multi-identifier
  - [x] email/HP/username
  - [x] throttle 6/menit
  - [x] login_audits
- Kunci diri dan anti-eskalasi
  - [x] tidak bisa hapus diri
  - [x] role tidak naik sendiri
  - [x] kebijakan izin
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### DA2.2 Peran & Izin `SUDAH`
**SUDAH**
- Lima peran efektif dan matriks izin
  - [x] super_admin/admin/guru/orang_tua/santri
  - [x] IzinKatalog
  - [x] PermissionSeeder
- Mode lembaga dan pesantren
  - [x] X-Lembaga-Aktif
  - [x] scope tenant
  - [x] act-as
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### DA2.3 Akun PTK `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Undangan dan aktivasi akun guru
  - [ ] email/WA
  - [ ] token sekali pakai
  - [ ] reset kata sandi
- Sinkron akun dengan data pegawai
  - [ ] tautan pegawai_id
  - [ ] peran guru/kasir
  - [ ] nonaktif otomatis
**DITUNDA**
- (kosong)

## DA3. PSB & Santri

### DA3.1 PSB `SUDAH`
**SUDAH**
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
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### DA3.2 Santri `SUDAH`
**SUDAH**
- CRUD santri dan NIS
  - [x] SantriPolicy
  - [x] impor satu pintu
  - [x] samakan NIS massal
- Foto dan dokumen santri
  - [x] unggah
  - [x] jenis dokumen
  - [x] viewer
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### DA3.3 Siklus Santri `SUDAH`
**SUDAH**
- Naik kelas, pindah, mutasi, lulus
  - [x] massal/otomatis
  - [x] arsip
  - [x] MI-MD
- Roster dan status global
  - [x] riwayat_belajar
  - [x] status turunan
  - [x] beku kelas
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### DA3.4 Presensi Santri `DITUNDA`
**SUDAH**
- Tabel presensi dan pelanggaran
  - [x] sesi_presensi
  - [x] presensi_santri
  - [x] pelanggaran_santri
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- UI presensi dan pelanggaran
  - [ ] input per sesi
  - [ ] rekap kehadiran
  - [ ] poin pelanggaran

### DA3.5 Asrama `DITUNDA`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- Fondasi asrama
  - [ ] tabel asrama/kamar/penghuni
  - [ ] peran asrama
  - [ ] pivot user_asrama
- Alur izin pulang dan kegiatan
  - [ ] pengajuan
  - [ ] persetujuan
  - [ ] kalender kegiatan

## DA4. Kepegawaian

### DA4.1 Pegawai `SUDAH`
**SUDAH**
- Master pegawai global
  - [x] EMIS
  - [x] keaktifan_pegawai
  - [x] sertifikasi
- Walas dan akun PTK
  - [x] setWalas tiga lapis
  - [x] penautan akun
  - [x] dokumen
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### DA4.2 Presensi Pegawai `DITUNDA`
**SUDAH**
- Tabel presensi pegawai
  - [x] presensi_pegawai
  - [x] status harian
  - [x] rekap
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- UI absensi guru
  - [ ] input harian
  - [ ] koreksi
  - [ ] izin/cuti

## DA5. Kurikulum

### DA5.1 Mata Pelajaran `AKAN`
**SUDAH**
- Master mapel dan KKM
  - [x] per jenjang
  - [x] kelompok formal/pesantren
  - [x] urutan rapor
**SEDANG**
- (kosong)
**AKAN**
- Salin mapel antar tahun ajaran
  - [ ] pilih sumber
  - [ ] pratinjau
  - [ ] hindari duplikat
**DITUNDA**
- (kosong)

### DA5.2 Pengampu `DITUNDA`
**SUDAH**
- Pivot kelas × mapel → guru
  - [x] validasi bentrok
  - [x] guru aktif
  - [x] per TA
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- Tes komponen halaman Pengampu
  - [ ] tes render
  - [ ] tes validasi
  - [ ] tes izin

### DA5.3 Jadwal Pelajaran `AKAN`
**SUDAH**
- Slot per jenjang dan anti bentrok
  - [x] bentrok kelas
  - [x] bentrok guru
  - [x] grid mingguan
- Jadwal per kelas
  - [x] template
  - [x] salin
  - [x] cetak
**SEDANG**
- (kosong)
**AKAN**
- Jadwal dari sudut guru
  - [ ] agenda mengajar
  - [ ] filter guru
  - [ ] tampilan mobile
- Cetak/unduh jadwal
  - [ ] PDF
  - [ ] Excel
  - [ ] kop
**DITUNDA**
- (kosong)

## DA6. Penilaian

### DA6.1 Nilai & Peristiwa `AKAN`
**SUDAH**
- Nilai per peristiwa
  - [x] PTS/ASAS/ASAT/UJIAN/UAP
  - [x] komponen/bobot
  - [x] sumber nilai
- Leger crosstab dan rapor
  - [x] ekspor Excel
  - [x] cetak per santri/kelas
  - [x] rekap
- Impor nilai
  - [x] empat template
  - [x] import-potong
  - [x] validasi
**SEDANG**
- (kosong)
**AKAN**
- Kunci dan buka kunci nilai
  - [ ] kunci setelah cetak
  - [ ] alasan buka
  - [ ] log audit
**DITUNDA**
- Bobot UJIAN final
  - [ ] UM 60
  - [ ] rata-rata rapor 40
  - [ ] kebijakan pesantren

### DA6.2 Cetak Rapor `AKAN`
**SUDAH**
- Rapor per santri/kelas
  - [x] kop
  - [x] identitas
  - [x] nilai + terbilang
- Validasi kelengkapan
  - [x] kelas lengkap
  - [x] tombol cetak terkunci
  - [x] halaman 2
**SEDANG**
- (kosong)
**AKAN**
- Cetak massal satu kelas
  - [ ] sekali klik
  - [ ] peringkat per batch
  - [ ] snapshot penanda tangan
- Absensi otomatis
  - [ ] sesi_presensi
  - [ ] override leger
  - [ ] rekap kehadiran
**DITUNDA**
- (kosong)

### DA6.3 Tahfizh `DITUNDA`
**SUDAH**
- Tabel tahfizh
  - [x] target_tahfiz
  - [x] setoran_tahfiz
  - [x] rekap_tahfiz_santri
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- UI tahfizh
  - [ ] ziyadah
  - [ ] murajaah
  - [ ] rekap per santri

## DA7. Keuangan

### DA7.1 Tagihan & Tarif `AKAN`
**SUDAH**
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
**SEDANG**
- (kosong)
**AKAN**
- Kartu piutang per santri
  - [ ] lintas TA
  - [ ] surat tagihan
  - [ ] cetak
**DITUNDA**
- (kosong)

### DA7.2 Kasir & Kwitansi `AKAN`
**SUDAH**
- Kasir harian
  - [x] pembayaran
  - [x] saldo terkunci
  - [x] batal/hapus
- Kwitansi
  - [x] cetak
  - [x] cetak ulang
  - [x] dialog/tabel
**SEDANG**
- (kosong)
**AKAN**
- Nomor kwitansi runut
  - [ ] per lembaga/kas/tahun
  - [ ] format final
  - [ ] tidak ada hex acak
- Split payment
  - [ ] gabungan metode
  - [ ] sub-bayar
  - [ ] rincian
**DITUNDA**
- (kosong)

### DA7.3 Rekap & Tutup Buku `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
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
**DITUNDA**
- Tarif per asrama
  - [ ] menunggu modul asrama
  - [ ] tarif kamar
  - [ ] penghuni

### DA7.4 Tunggakan `AKAN`
**SUDAH**
- Crosstab tunggakan
  - [x] per santri/kelas
  - [x] total tagihan
  - [x] terbayar
**SEDANG**
- (kosong)
**AKAN**
- Aging 30/60/90
  - [ ] jatuh tempo
  - [ ] surat tagihan
  - [ ] ekspor
- Pengingat WhatsApp
  - [ ] template
  - [ ] antrean kirim
  - [ ] log
**DITUNDA**
- Tren penerimaan
  - [ ] bulanan
  - [ ] per TA
  - [ ] dasbor

### DA7.5 Audit & Kontrol `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
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
**DITUNDA**
- (kosong)

## DA8. Portal & Integrasi

### DA8.1 Portal Wali `AKAN`
**SUDAH**
- Jalur PSB lanjutan dan pengajuan biodata
  - [x] satu aktif per santri
  - [x] batal
  - [x] riwayat keluarga
**SEDANG**
- (kosong)
**AKAN**
- Dashboard portal wali
  - [ ] ringkasan anak
  - [ ] tagihan
  - [ ] pengumuman
- Aktor santri
  - [ ] peran santri
  - [ ] rute portal
  - [ ] batas data
**DITUNDA**
- (kosong)

### DA8.2 API Mobile & Publik `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
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
**DITUNDA**
- (kosong)

## DA9. Production & Operasional

### DA9.1 Deploy `DITUNDA`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- Deploy VPS dan production
  - [ ] domain
  - [ ] TLS
  - [ ] queue/scheduler
- Migrasi dan rollback
  - [ ] backup
  - [ ] urutan migrasi
  - [ ] rollback

### DA9.2 Backup & Restore `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Backup terjadwal
  - [ ] DB pesantren
  - [ ] DB papan
  - [ ] retensi
- Uji restore
  - [ ] RTO/RPO
  - [ ] dokumentasi
  - [ ] simulasi
**DITUNDA**
- (kosong)

### DA9.3 Monitoring & Log `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Log aplikasi dan error
  - [ ] Laravel log
  - [ ] error tracking
  - [ ] rotasi
- Monitoring uptime
  - [ ] health check
  - [ ] disk/DB
  - [ ] alert
**DITUNDA**
- (kosong)

## DA10. Dashboard & Laporan

### DA10.1 Dashboard Ringkas `SUDAH`
**SUDAH**
- Ringkasan lintas modul
  - [x] lembaga/santri/pegawai
  - [x] keuangan/siklus/PSB
  - [x] izin per blok
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### DA10.2 Statistik Pimpinan `DITUNDA`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- Dashboard eksekutif
  - [ ] KPI
  - [ ] tren
  - [ ] perbandingan lembaga
- Ekspor laporan pimpinan
  - [ ] PDF/Excel
  - [ ] jadwal kirim
  - [ ] filter periode
---

# Aplikasi: Mobile Orang Tua

## MO1. Akun & Onboarding

### MO1.1 API Autentikasi `SUDAH`
**SUDAH**
- Login wali lewat API
  - [x] Sanctum
  - [x] multi-identifier
  - [x] peran orang_tua
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### MO1.2 UI Mobile `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Login dan onboarding wali
  - [ ] email/HP
  - [ ] OTP
  - [ ] pilih santri
- Verifikasi relasi wali-santri
  - [ ] data wali
  - [ ] data santri
  - [ ] batas akses
**DITUNDA**
- (kosong)

## MO2. Profil Santri

### MO2.1 API Portal `SUDAH`
**SUDAH**
- Rute portal wali
  - [x] portal/*
  - [x] role orang_tua
  - [x] agregator baca
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### MO2.2 UI Profil `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Biodata dan dokumen anak
  - [ ] lihat
  - [ ] unduh
  - [ ] pengajuan perubahan
- Riwayat belajar
  - [ ] per lembaga
  - [ ] kelas
  - [ ] status aktif
**DITUNDA**
- (kosong)

## MO3. Tagihan & Pembayaran

### MO3.1 API Keuangan `SUDAH`
**SUDAH**
- Data tagihan dan pembayaran
  - [x] tagihan
  - [x] kwitansi
  - [x] tunggakan
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### MO3.2 UI Tagihan `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
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
**DITUNDA**
- (kosong)

## MO4. Presensi & Perilaku

### MO4.1 API Presensi `SUDAH`
**SUDAH**
- Tabel presensi santri
  - [x] sesi
  - [x] kehadiran
  - [x] pelanggaran
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### MO4.2 UI Presensi `DITUNDA`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- Presensi harian anak
  - [ ] per sesi
  - [ ] izin/sakit
  - [ ] rekap
- Pelanggaran
  - [ ] jenis
  - [ ] poin
  - [ ] tindak lanjut

## MO5. Tahfizh

### MO5.1 API Tahfizh `SUDAH`
**SUDAH**
- Tabel target dan setoran
  - [x] target
  - [x] setoran
  - [x] rekap
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### MO5.2 UI Tahfizh `DITUNDA`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- Target dan setoran
  - [ ] ziyadah
  - [ ] murajaah
  - [ ] grafik
- Rekap tahfizh
  - [ ] periode
  - [ ] catatan guru
  - [ ] unduh

## MO6. PSB & Pengajuan

### MO6.1 API PSB `SUDAH`
**SUDAH**
- Pendaftaran dan pengajuan
  - [x] PSB
  - [x] biodata
  - [x] dokumen
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### MO6.2 UI PSB `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- PSB online
  - [ ] formulir
  - [ ] unggah dokumen
  - [ ] status
- Pengajuan biodata
  - [ ] satu aktif
  - [ ] batal
  - [ ] verifikasi
**DITUNDA**
- (kosong)

## MO7. Notifikasi

### MO7.1 Push & WhatsApp `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Notifikasi tagihan dan presensi
  - [ ] push
  - [ ] WhatsApp
  - [ ] deep link
- Preferensi notifikasi
  - [ ] jenis
  - [ ] jam tenang
  - [ ] per anak
**DITUNDA**
- (kosong)
---

# Aplikasi: Mobile Guru

## MG1. Akun & Login

### MG1.1 API Autentikasi `SUDAH`
**SUDAH**
- Login guru lewat API
  - [x] Sanctum
  - [x] multi-identifier
  - [x] peran guru
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### MG1.2 UI Guru `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Login mobile dan profil guru
  - [ ] email/HP
  - [ ] sesi perangkat
  - [ ] penempatan
**DITUNDA**
- (kosong)

## MG2. Jadwal Mengajar

### MG2.1 API Jadwal `SUDAH`
**SUDAH**
- Jadwal per kelas
  - [x] slot
  - [x] anti bentrok
  - [x] per TA
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### MG2.2 UI Jadwal `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Agenda mengajar guru
  - [ ] hari ini
  - [ ] minggu
  - [ ] filter
- Detail kelas
  - [ ] mapel
  - [ ] jam
  - [ ] ruang
**DITUNDA**
- (kosong)

## MG3. Input Nilai

### MG3.1 API Nilai `SUDAH`
**SUDAH**
- Nilai per peristiwa
  - [x] komponen
  - [x] impor
  - [x] leger
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### MG3.2 UI Input `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Input nilai per kelas
  - [ ] mapel
  - [ ] komponen
  - [ ] validasi
- Rekap dan submit nilai
  - [ ] kunci
  - [ ] status
  - [ ] koreksi
**DITUNDA**
- (kosong)

## MG4. Presensi Pegawai

### MG4.1 API Presensi `SUDAH`
**SUDAH**
- Tabel presensi pegawai
  - [x] status harian
  - [x] rekap
  - [x] koreksi
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### MG4.2 UI Presensi `DITUNDA`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- Absen harian guru
  - [ ] masuk/pulang
  - [ ] lokasi
  - [ ] riwayat
- Izin dan cuti
  - [ ] pengajuan
  - [ ] persetujuan
  - [ ] lampiran

## MG5. Setoran Tahfizh

### MG5.1 API Tahfizh `SUDAH`
**SUDAH**
- Tabel setoran tahfizh
  - [x] target
  - [x] setoran
  - [x] rekap
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### MG5.2 UI Setoran `DITUNDA`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- Input setoran
  - [ ] ziyadah
  - [ ] murajaah
  - [ ] catatan
- Rekap santri
  - [ ] per kelas
  - [ ] periode
  - [ ] unduh

## MG6. Pengampu & Kelas

### MG6.1 API Pengampu `SUDAH`
**SUDAH**
- Pivot pengampu
  - [x] kelas × mapel
  - [x] guru
  - [x] per TA
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### MG6.2 UI Pendampingan `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Daftar kelas dan mapel
  - [ ] TA aktif
  - [ ] daftar siswa
  - [ ] filter
- Catatan kelas
  - [ ] jurnal
  - [ ] tindak lanjut
  - [ ] riwayat
**DITUNDA**
- (kosong)

## MG7. Pengajuan & Izin

### MG7.1 Alur Pengajuan `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Pengajuan izin guru
  - [ ] jenis
  - [ ] lampiran
  - [ ] atasan
- Status pengajuan
  - [ ] riwayat
  - [ ] notifikasi
  - [ ] pembatalan
**DITUNDA**
- (kosong)
---

# Aplikasi: Mobile Pimpinan

## MP1. Akun & Login

### MP1.1 API Autentikasi `SUDAH`
**SUDAH**
- Login pimpinan lewat API
  - [x] Sanctum
  - [x] multi-identifier
  - [x] batas izin
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### MP1.2 UI Pimpinan `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Login mobile pimpinan
  - [ ] email/HP
  - [ ] sesi perangkat
  - [ ] profil
**DITUNDA**
- (kosong)

## MP2. Dashboard Eksekutif

### MP2.1 API Ringkasan `SUDAH`
**SUDAH**
- Ringkasan lintas modul
  - [x] dashboard/ringkasan
  - [x] izin per blok
  - [x] null bila tak berizin
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### MP2.2 UI KPI `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- KPI dan tren
  - [ ] per lembaga
  - [ ] periode
  - [ ] perbandingan
**DITUNDA**
- Statistik pimpinan lanjutan
  - [ ] modul 504
  - [ ] ekspor
  - [ ] jadwal kirim

## MP3. Statistik Keuangan

### MP3.1 API Keuangan `SUDAH`
**SUDAH**
- Data tagihan dan pembayaran
  - [x] tagihan
  - [x] terbayar
  - [x] tunggakan
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### MP3.2 UI Keuangan `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Tren keuangan
  - [ ] per lembaga
  - [ ] per kas
  - [ ] periode
**DITUNDA**
- (kosong)

## MP4. Statistik Santri & PSB

### MP4.1 API Santri & PSB `SUDAH`
**SUDAH**
- Data santri dan PSB
  - [x] jumlah aktif
  - [x] funnel PSB
  - [x] per lembaga
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### MP4.2 UI Santri `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Statistik santri
  - [ ] per jenjang
  - [ ] siklus
  - [ ] mutasi
**DITUNDA**
- (kosong)

## MP5. Statistik Akademik

### MP5.1 API Akademik `SUDAH`
**SUDAH**
- Data nilai dan kehadiran
  - [x] nilai
  - [x] jadwal
  - [x] presensi
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### MP5.2 UI Akademik `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Distribusi nilai dan kehadiran
  - [ ] per kelas
  - [ ] per mapel
  - [ ] peringatan
**DITUNDA**
- (kosong)

## MP6. Laporan & Ekspor

### MP6.1 Laporan `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Laporan PDF/Excel
  - [ ] periode
  - [ ] per lembaga
  - [ ] filter
- Jadwal kirim laporan
  - [ ] email/WA
  - [ ] rekap berkala
  - [ ] riwayat
**DITUNDA**
- (kosong)

## MP7. Notifikasi & Alert

### MP7.1 Alert `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Ambang batas otomatis
  - [ ] tunggakan
  - [ ] kehadiran
  - [ ] nilai
- Push dan riwayat alert
  - [ ] peristiwa
  - [ ] penerima
  - [ ] tindak lanjut
**DITUNDA**
- (kosong)
---

# Aplikasi: Mobile Kasir

## MK1. Akun & Login

### MK1.1 API Autentikasi `SUDAH`
**SUDAH**
- Login kasir lewat API
  - [x] Sanctum
  - [x] multi-identifier
  - [x] batas izin
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### MK1.2 UI Kasir `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Login dan profil kasir
  - [ ] role kasir
  - [ ] perangkat
  - [ ] shift
**DITUNDA**
- (kosong)

## MK2. Kasir Harian

### MK2.1 API Kasir `SUDAH`
**SUDAH**
- Pembayaran dan pembatalan
  - [x] kasir
  - [x] saldo terkunci
  - [x] batal/hapus
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### MK2.2 UI Kasir `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Cari santri dan pilih tagihan
  - [ ] pencarian
  - [ ] filter
  - [ ] rincian
- Bayar dan cetak
  - [ ] metode
  - [ ] konfirmasi
  - [ ] kwitansi
**DITUNDA**
- (kosong)

## MK3. Kwitansi

### MK3.1 API Kwitansi `SUDAH`
**SUDAH**
- Kwitansi dan cetak ulang
  - [x] nomor
  - [x] data bayar
  - [x] riwayat
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### MK3.2 UI Kwitansi `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Cetak thermal dan bagikan
  - [ ] thermal
  - [ ] PDF
  - [ ] WhatsApp
- Nomor kwitansi runut
  - [ ] per kas
  - [ ] per tahun
  - [ ] format final
**DITUNDA**
- (kosong)

## MK4. Tunggakan

### MK4.1 API Tunggakan `SUDAH`
**SUDAH**
- Crosstab tunggakan
  - [x] per santri/kelas
  - [x] total
  - [x] terbayar
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### MK4.2 UI Tunggakan `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Daftar tunggakan kasir
  - [ ] aging
  - [ ] surat
  - [ ] pengingat
**DITUNDA**
- (kosong)

## MK5. Tutup Buku & Rekap

### MK5.1 API Rekap `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Rekap per posisi kas
  - [ ] tunai
  - [ ] bank
  - [ ] periode
**DITUNDA**
- (kosong)

### MK5.2 UI Tutup Buku `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Tutup buku harian
  - [ ] rekap
  - [ ] kunci
  - [ ] buka kunci
**DITUNDA**
- (kosong)

## MK6. Dispensasi

### MK6.1 API Dispensasi `SUDAH`
**SUDAH**
- Dispensasi dan grup santri
  - [x] disponsasi
  - [x] grup custom
  - [x] tagihan
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

### MK6.2 UI Dispensasi `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Pengajuan dan persetujuan
  - [ ] ajukan
  - [ ] setujui
  - [ ] riwayat
**DITUNDA**
- (kosong)

## MK7. Offline & Sinkronisasi

### MK7.1 Mode Offline `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Cache data tagihan
  - [ ] santri
  - [ ] tagihan
  - [ ] saldo
- Antrean transaksi
  - [ ] simpan lokal
  - [ ] retry
  - [ ] status
**DITUNDA**
- (kosong)

### MK7.2 Sinkronisasi `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Sinkron dan konflik
  - [ ] timestamp
  - [ ] konflik
  - [ ] audit
**DITUNDA**
- (kosong)
---

# Aplikasi: Landing Page Pesantren

## LP1. Profil & Identitas

### LP1.1 Struktur Halaman `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Halaman profil pesantren
  - [ ] sejarah
  - [ ] visi-misi
  - [ ] struktur
- Profil per lembaga
  - [ ] MI
  - [ ] MD
  - [ ] MTS
  - [ ] MLN
**DITUNDA**
- (kosong)

### LP1.2 Konten Identitas `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Fasilitas dan prestasi
  - [ ] fasilitas
  - [ ] prestasi
  - [ ] galeri
**DITUNDA**
- (kosong)

## LP2. PSB Online

### LP2.1 Formulir PSB `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Formulir pendaftaran publik
  - [ ] jalur
  - [ ] data calon
  - [ ] unggah
**DITUNDA**
- (kosong)

### LP2.2 Status & Biaya `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Cek status dan biaya
  - [ ] status
  - [ ] biaya
  - [ ] konfirmasi
**DITUNDA**
- (kosong)

## LP3. Berita & Pengumuman

### LP3.1 CMS Berita `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Kelola berita dan pengumuman
  - [ ] kategori
  - [ ] editor
  - [ ] jadwal terbit
**DITUNDA**
- (kosong)

### LP3.2 Tampilan Publik `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Daftar dan detail berita
  - [ ] daftar
  - [ ] detail
  - [ ] pencarian
**DITUNDA**
- (kosong)

## LP4. Galeri & Fasilitas

### LP4.1 Album `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Album foto dan video
  - [ ] kategori
  - [ ] lazy load
  - [ ] caption
**DITUNDA**
- (kosong)

### LP4.2 Virtual Tour `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Tur 360 dan peta
  - [ ] 360
  - [ ] peta
  - [ ] aksesibilitas
**DITUNDA**
- (kosong)

## LP5. Kontak & WhatsApp

### LP5.1 Kontak `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Form kontak dan lokasi
  - [ ] form
  - [ ] maps
  - [ ] jam layanan
**DITUNDA**
- (kosong)

### LP5.2 WhatsApp `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- WhatsApp dan antispam
  - [ ] deep link
  - [ ] template
  - [ ] antispam
**DITUNDA**
- (kosong)

## LP6. SEO & Analytics

### LP6.1 SEO Teknis `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Metadata dan sitemap
  - [ ] metadata
  - [ ] sitemap
  - [ ] schema.org
**DITUNDA**
- (kosong)

### LP6.2 Analytics `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Analytics dan consent
  - [ ] GA4
  - [ ] event PSB
  - [ ] consent
**DITUNDA**
- (kosong)

## LP7. Multi-lembaga & Bahasa

### LP7.1 Multi-lembaga `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Halaman per lembaga
  - [ ] jenjang
  - [ ] navigasi
  - [ ] konten
**DITUNDA**
- (kosong)

### LP7.2 Bahasa & Aksesibilitas `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Bahasa dan aksesibilitas
  - [ ] ID/EN
  - [ ] kontras
  - [ ] keyboard
**DITUNDA**
- (kosong)

## LP8. Keamanan & Performa

### LP8.1 Keamanan `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Keamanan publik
  - [ ] HTTPS
  - [ ] anti-spam
  - [ ] rate limit
**DITUNDA**
- (kosong)

### LP8.2 Performa `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Performa halaman
  - [ ] cache
  - [ ] gambar
  - [ ] Lighthouse
**DITUNDA**
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
