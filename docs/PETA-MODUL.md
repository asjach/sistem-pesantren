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
| `php artisan papan:lihat` | Daftar modul, sub-modul, dan butirnya |
| `php artisan papan:lihat E.3` | Satu sub-modul saja |
| `php artisan papan:lihat --riwayat` | Riwayat perpindahan status |
| `php artisan papan:tandai E.3 sedang --catatan="..."` | Pindahkan status |
| `php artisan papan:butir tambah E.3 --deskripsi="..."` | Tambah butir |
| `php artisan papan:butir hapus E.3 --id=128` | Hapus butir |
| `php artisan papan:markdown` | Pratinjau markdown hasil papan (tidak menulis) |
| `php artisan papan:markdown --tulis` | Tulis ulang berkas ini dari papan |

Bagian A–G di berkas ini **dihasilkan** `papan:markdown --tulis`; bagian H ke
bawah dipertahankan apa adanya. Jadi setelah mengubah status lewat command,
jalankan `--tulis` supaya berkas ini ikut segar, lalu commit markdown-nya
sebagai jejak yang tahan lama.

## Cara baca

Empat status dipakai konsisten di seluruh berkas:

- **SUDAH** — kode ada, terhubung, dipakai dari UI.
- **SEDANG** — dikerjakan sekarang. Hanya boleh **satu** sub-modul bertanda ini.
- **AKAN** — belum ada kode, sudah dirancang cukup untuk dikerjakan.
- **DITUNDA** — belum ada kode dan belum dirancang; sengaja tidak dikerjakan.

Status yang tidak berlaku ditulis **(kosong)** agar tidak tampak terlewat.

---

# A. Fondasi

## A.1 Setup (001) `SUDAH`
**SUDAH**
- Proyek Laravel 13 dengan `.env` dan guard `sanctum` sudah berjalan.
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

## A.2 Skema Database (002) `SUDAH`
**SUDAH**
- 84 file migrasi; `migrate:fresh` hijau dengan 126 tabel termasuk tabel framework.
- Spesifikasi kolom lengkap ada di [SCHEMA.md](SCHEMA.md).
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

## A.3 Autentikasi & Pengguna (003) `SUDAH`
**SUDAH**
- Login multi-identifier (email/telepon/username) dengan throttle dan `login_audits`, lima peran efektif.
- Ada kunci diri dan anti-eskalasi: pengguna tak bisa mengubah atau menghapus dirinya sendiri.
- Act-as lembaga lewat header `X-Lembaga-Aktif`; impor pengguna massal tersedia.
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

## A.4 Referensi & Master (004) `SUDAH`
**SUDAH**
- 34 tabel kamus per lembaga dengan fan-out, dilayani `RefService` ber-cache.
- CRUD Lembaga, Tahun Ajaran, dan Kelas lengkap dengan scope tenant.
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

## A.5 Dashboard Ringkas `SUDAH`
**SUDAH**
- `GET /api/dashboard/ringkasan` menyajikan blok lembaga, santri, pegawai, keuangan, siklus, dan PSB.
- Tiap blok digerbangi izin modulnya dan bernilai null bila akun tak berizin.
**SEDANG**
- (kosong)
**AKAN**
- Dashboard eksekutif pimpinan (modul 504) yang lebih ringkas dan terarah.
**DITUNDA**
- (kosong)
---

# B. PSB & Santri

## B.1 PSB (100) `SUDAH`
**SUDAH**
- Master kegiatan, gelombang anti-tumpang, dan kuota pendaftaran per lembaga.
- Dua jalur pendaftaran (langsung atau seleksi), plus verifikasi, seleksi, daftar ulang, ACC, dan undur diri.
- Aksi massal untuk semua tahap, impor, dokumen, dan promosi calon menjadi santri.
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

## B.2 Santri (101) `SUDAH`
**SUDAH**
- CRUD santri dengan `SantriPolicy`, impor satu pintu, kamus, dan kolom NIS.
- Foto dan dokumen per santri bisa diunggah; ada fitur samakan NIS massal.
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

## B.3 Siklus Santri (102) `SUDAH`
**SUDAH**
- Salin genap, naik kelas (massal dan otomatis), pindah kelas, mutasi keluar beserta arsipnya.
- Lulus/batal, roster dan arsip, penanganan MI-MD, beku kelas, serta berhenti jenjang.
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)
---

# C. Kepegawaian & Kurikulum

## C.1 Pegawai (200) `SUDAH`
**SUDAH**
- Master `pegawai` global dengan kolom EMIS, multi-lembaga lewat `keaktifan_pegawai`.
- Sertifikasi, keluarga, dokumen, penautan akun, dan `setWalas` dengan validasi tiga lapis.
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

## C.2 Kurikulum & Mata Pelajaran (201) `SUDAH`
**SUDAH**
- Tiga halaman jalan: Mata Pelajaran (KKM dan urutan), Pengampu (kelas × mapel → guru), Jadwal Pelajaran.
- Jadwal memakai slot per jenjang dan menolak bentrok kelas maupun bentrok guru.
**SEDANG**
- (kosong)
**AKAN**
- Tampilan jadwal dari sudut guru, bukan hanya per kelas.
- Cetak dan unduh jadwal per kelas.
- Salin daftar mapel antar tahun ajaran.
**DITUNDA**
- Tes endpoint yang belum tertulis dan tes komponen halaman Pengampu.
---

# D. Penilaian

## D.1 Nilai & Peristiwa (202) `SUDAH`
**SUDAH**
- Nilai diikat per peristiwa (PTS, ASAS, ASAT, UJIAN, UAP), bukan per semester.
- Komponen dan bobot bisa bersumber manual, dari rapor tingkat sebelumnya, atau dari peristiwa lain.
- Leger crosstab per peristiwa bisa diunduh Excel; rapor lengkap bisa dicetak per santri maupun per kelas.
- Empat template impor lewat mesin `import-potong`.
**SEDANG**
- (kosong)
**AKAN**
- Kunci impor/edit setelah batch rapor pertama dicetak, plus log cetak berisi siapa, kapan, dan berapa santri.
- Buka-kunci dengan alasan tercatat, karena mengubah nilai setelah rapor beredar harus bisa diaudit.
**DITUNDA**
- Bobot UJIAN bawaan (UM 60 / Rata-rata Rapor 40) masih placeholder, menunggu kebijakan pesantren.
- Salin peristiwa dari tahun ajaran sebelumnya; kini tiap TA dibuat ulang atau klik "Muat bawaan".

## D.2 Cetak Rapor `SUDAH`
**SUDAH**
- Rapor per santri dan per kelas dengan kop, identitas, nilai + terbilang, rekap, dan halaman 2.
- Cek kelengkapan kelas; tombol cetak terkunci selama masih ada santri yang nilainya belum lengkap.
**SEDANG**
- (kosong)
**AKAN**
- Cetak massal satu kelas dalam sekali klik, dengan parameter peringkat sekali per batch.
- Snapshot nama dan gelar penanda tangan saat batch pertama dicetak agar cetak ulang identik.
- Absensi otomatis dari `sesi_presensi`/`presensi_santri`; kolom leger jadi override bila presensi kosong.
- Tombol unduh data existing di dialog impor, memakai pola `data-existing`.
**DITUNDA**
- (kosong)
---

# E. Keuangan

## E.1 Tagihan & Tarif `SUDAH`
**SUDAH**
- Master jenis tagihan dan tarif per lembaga/tahun ajaran.
- Generate tagihan satu layar tanpa duplikat: bulanan terbayar dilewati, dispensasi dan kuota diterapkan otomatis.
- Crosstab tagihan, dispensasi, dan grup santri custom.
**SEDANG**
- (kosong)
**AKAN**
- Kartu piutang per santri lintas tahun ajaran, bisa dicetak sebagai surat tagihan resmi.
**DITUNDA**
- (kosong)

## E.2 Kasir & Kwitansi `SUDAH`
**SUDAH**
- Kasir harian, pencatatan pembayaran, batal/hapus transaksi dengan saldo terkunci barisnya.
- Kwitansi cetak dan cetak ulang, baik dari dialog setelah bayar maupun dari tabel harian.
**SEDANG**
- (kosong)
**AKAN**
- Penomoran kwitansi runut per lembaga/kas/tahun menggantikan hex acak.
- Split payment: satu kwitansi boleh gabungan metode atau kas, dengan rincian sub-bayar.
- Format nomor kwitansi (mis. `KW-MI-2026-000123`) belum ditetapkan; perlu keputusan dulu.
**DITUNDA**
- (kosong)

## E.3 Rekap & Tutup Buku Kas `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Rekap penerimaan per posisi kas (tunai TU, bank lembaga, bank pesantren) per tanggal atau periode.
- Mutasi kas harian untuk melihat arus masuk per kas per hari.
- Tutup buku harian yang menolak tambah/batal/hapus mundur, dengan jalur buka-kunci beralasan.
**DITUNDA**
- Tarif per asrama belum diakomodasi; menunggu modul 505 dibuka.

## E.4 Tunggakan `SUDAH`
**SUDAH**
- Crosstab tunggakan per santri/kelas dan dasbor ringkas (total tagihan, terbayar, tunggakan).
**SEDANG**
- (kosong)
**AKAN**
- Laporan aging 30/60/90+ hari dari `jatuh_tempo` sebagai dasar surat tagihan.
- Pengingat tunggakan: penanda di crosstab; WhatsApp menyusul lewat modul notifikasi G8.
**DITUNDA**
- Tren penerimaan bulanan dan rincian per tahun ajaran di dasbor.

## E.5 Audit & Kontrol `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Jejak audit: log siapa mencatat, membatalkan, atau menghapus transaksi, dengan alasan wajib.
- Maker-checker pembatalan agar pencatat tidak sekaligus menyetujui pembatalan.
- Ekspor laporan ke Excel/PDF untuk crosstab, transaksi harian, rekap per jenis, dan tunggakan.
**DITUNDA**
- (kosong)
---

# F. Portal & Klien

## F.1 Portal Wali (203) `SUDAH`
**SUDAH**
- Jalur PSB lanjutan, riwayat keluarga, dan pengajuan biodata (satu aktif per santri, bisa dibatalkan).
**SEDANG**
- (kosong)
**AKAN**
- Dashboard portal dan ringkasan tagihan untuk wali.
- Aktor santri, karena rute portal saat ini hanya untuk `orang_tua`.
**DITUNDA**
- (kosong)

## F.2 Klien Desktop admin-desktop-tauri `SUDAH`
**SUDAH**
- 48 halaman dalam 10 grup navigasi, dengan dua mode: lembaga dan pesantren.
- Dijaga 123 file tes; klien ini untuk `super_admin` dan `admin` lembaga saja.
**SEDANG**
- (kosong)
**AKAN**
- Jalur peran guru, yang izin bawaannya masih kosong.
**DITUNDA**
- (kosong)

## F.3 Aplikasi Mobile `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Empat klien belum di-scaffold: kasir, orang tua, pimpinan, dan guru.
**DITUNDA**
- (kosong)
---

# G. Pasca Production

## G.1 Presensi Santri (500) `SUDAH`
**SUDAH**
- Tabel `sesi_presensi`, `presensi_santri`, dan `pelanggaran_santri` sudah dibuat.
**SEDANG**
- (kosong)
**AKAN**
- UI presensi dan UI pelanggaran.
**DITUNDA**
- (kosong)

## G.2 Presensi Pegawai (501) `SUDAH`
**SUDAH**
- Tabel `presensi_pegawai` sudah dibuat.
**SEDANG**
- (kosong)
**AKAN**
- UI absensi guru.
**DITUNDA**
- (kosong)

## G.3 Jadwal Pelajaran (502) `SUDAH`
**SUDAH**
- Sudah live dan menjadi bagian modul 201, bukan lagi pekerjaan pasca production.
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- (kosong)

## G.4 Tahfizh (503) `SUDAH`
**SUDAH**
- Tabel `target_tahfiz`, `setoran_tahfiz`, dan `rekap_tahfiz_santri` sudah dibuat.
**SEDANG**
- (kosong)
**AKAN**
- UI tahfizh untuk ziyadah dan murajaah.
**DITUNDA**
- (kosong)

## G.5 Statistik Pimpinan (504) `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Dashboard eksekutif pimpinan yang ringkas, terpisah dari `/api/dashboard/ringkasan`.
**DITUNDA**
- (kosong)

## G.6 Asrama (505) `DITUNDA`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- (kosong)
**DITUNDA**
- Baru sebatas gambaran; tabel, peran, dan pivot belum dibuat.
- Pasca production dan tidak dikerjakan dalam waktu dekat.

## G.7 Deploy (900/901) `AKAN`
**SUDAH**
- (kosong)
**SEDANG**
- (kosong)
**AKAN**
- Deploy VPS dan konfigurasi production.
**DITUNDA**
- (kosong)

# H. SEDANG DIKERJAKAN

**Kosong.** Tidak ada sub-modul yang disetujui sebagai pekerjaan berjalan.

---

# I. RINCIAN TEKNIS LAINNYA

Bagian ini memuat hal teknis yang terlalu rinci untuk masuk ke bagian A–G, dan
tidak terikat pada modul Keuangan maupun Penilaian.

## I.1 Kurikulum & Mata Pelajaran (201)

### I.1.1 Jadwal per guru
- **FE:** tampilan jadwal dari sudut guru; saat ini baru per kelas.

### I.1.2 Cetak & unduh jadwal per kelas
- **FE:** keluaran cetak/Excel untuk jadwal yang sudah tersusun.

### I.1.3 Salin mapel antar tahun ajaran
- **FE:** kelas tingkat atas menyalin daftar mapel dari tingkat bawah.

### I.1.4 Tes tersisa
- Endpoint yang belum tertulis: `kurikulum/slot` CRUD penuh, `guruAktif`, `indexMapel` filter.
- `KurikulumPengampuPage` belum punya tes komponen.

## I.2 Portal

### I.2.1 Dashboard portal wali
- **BE:** agregator baca-saja lewat rute `portal/*` dengan penjaga `role:orang_tua`.

### I.2.2 Ringkasan tagihan di portal
- **BE:** tagihan milik anak, dibaca dari akun wali.

### I.2.3 Aktor santri
- **BE:** peran `santri` sudah ada, tetapi belum punya rute portal sendiri.

## I.3 Keputusan Offline

Lampiran F `operasi.md` (OFF-01…OFF-09) masih berstatus keputusan desain dan
belum diimplementasikan. Bila mulai dikerjakan, pindahkan butirnya ke bagian A–G
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
