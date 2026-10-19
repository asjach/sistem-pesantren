# PETA MODUL — Status & Rencana Terpusat

> **Satu-satunya tempat** untuk menjawab "modul ini sudah sampai mana, sedang
> apa, dan akan apa". Dokumen lain (PRD, arsitektur, backend-detail, operasi)
> **tidak lagi** memuat daftar status/rencana — mereka hanya menunjuk ke sini.

- **Terakhir diperbarui:** 2026-10-19
- **Aturan menulis:** setiap perubahan status/rencana **wajib** mengubah file ini
  lebih dulu. Bila peta dan kode berbeda, peta yang salah — perbaiki peta.
- **Aturan mengisi:** tiap deskripsi **1–2 kalimat**, bukan daftar fitur. Rincian
  teknis butir sisa ada di bagian I.

## Cara baca

Empat status dipakai konsisten di seluruh berkas:

- **SUDAH** — kode ada, terhubung, dipakai dari UI.
- **SEDANG** — dikerjakan sekarang. Hanya boleh **satu** sub-modul bertanda ini.
- **AKAN** — belum ada kode, sudah dirancang cukup untuk dikerjakan.
- **DITUNDA** — belum ada kode dan belum dirancang; sengaja tidak dikerjakan.

Status yang tidak berlaku ditulis **(kosong)** agar tidak tampak terlewat.

---

# A. Fondasi

## A.1 Setup (001)
**SUDAH**
- Proyek Laravel 13 dengan `.env` dan guard `sanctum` sudah berjalan.

## A.2 Skema Database (002)
**SUDAH**
- 84 file migrasi; `migrate:fresh` hijau dengan 126 tabel termasuk tabel framework.
- Spesifikasi kolom lengkap ada di [SCHEMA.md](SCHEMA.md).

## A.3 Autentikasi & Pengguna (003)
**SUDAH**
- Login multi-identifier (email/telepon/username) dengan throttle dan `login_audits`, lima peran efektif.
- Ada kunci diri dan anti-eskalasi: pengguna tak bisa mengubah atau menghapus dirinya sendiri.
- Act-as lembaga lewat header `X-Lembaga-Aktif`; impor pengguna massal tersedia.

## A.4 Referensi & Master (004)
**SUDAH**
- 34 tabel kamus per lembaga dengan fan-out, dilayani `RefService` ber-cache.
- CRUD Lembaga, Tahun Ajaran, dan Kelas lengkap dengan scope tenant.

## A.5 Dashboard Ringkas
**SUDAH**
- `GET /api/dashboard/ringkasan` menyajikan blok lembaga, santri, pegawai, keuangan, siklus, dan PSB.
- Tiap blok digerbangi izin modulnya dan bernilai null bila akun tak berizin.

**AKAN**
- Dashboard eksekutif pimpinan (modul 504) yang lebih ringkas dan terarah.

# B. PSB & Santri

## B.1 PSB (100)
**SUDAH**
- Master kegiatan, gelombang anti-tumpang, dan kuota pendaftaran per lembaga.
- Dua jalur pendaftaran (langsung atau seleksi), plus verifikasi, seleksi, daftar ulang, ACC, dan undur diri.
- Aksi massal untuk semua tahap, impor, dokumen, dan promosi calon menjadi santri.

## B.2 Santri (101)
**SUDAH**
- CRUD santri dengan `SantriPolicy`, impor satu pintu, kamus, dan kolom NIS.
- Foto dan dokumen per santri bisa diunggah; ada fitur samakan NIS massal.

## B.3 Siklus Santri (102)
**SUDAH**
- Salin genap, naik kelas (massal dan otomatis), pindah kelas, mutasi keluar beserta arsipnya.
- Lulus/batal, roster dan arsip, penanganan MI-MD, beku kelas, serta berhenti jenjang.

# C. Kepegawaian & Kurikulum

## C.1 Pegawai (200)
**SUDAH**
- Master `pegawai` global dengan kolom EMIS, multi-lembaga lewat `keaktifan_pegawai`.
- Sertifikasi, keluarga, dokumen, penautan akun, dan `setWalas` dengan validasi tiga lapis.

## C.2 Kurikulum & Mata Pelajaran (201)
**SUDAH**
- Tiga halaman jalan: Mata Pelajaran (KKM dan urutan), Pengampu (kelas × mapel → guru), Jadwal Pelajaran.
- Jadwal memakai slot per jenjang dan menolak bentrok kelas maupun bentrok guru.

**AKAN**
- Tampilan jadwal dari sudut guru, bukan hanya per kelas.
- Cetak dan unduh jadwal per kelas.
- Salin daftar mapel antar tahun ajaran.

**DITUNDA**
- Tes endpoint yang belum tertulis dan tes komponen halaman Pengampu.

# D. Penilaian

## D.1 Penilaian (202)
**SUDAH**
- Nilai diikat per peristiwa (PTS, ASAS, ASAT, UJIAN, UAP), bukan per semester.
- Komponen dan bobot bisa bersumber manual, dari rapor tingkat sebelumnya, atau dari peristiwa lain.
- Leger crosstab per peristiwa bisa diunduh Excel; rapor lengkap bisa dicetak per santri maupun per kelas.
- Empat template impor lewat mesin `import-potong`; ada cek kelengkapan kelas sebelum cetak.

**AKAN**
- Kunci semester dan jejak cetak agar nilai tak berubah setelah rapor pertama dicetak.
- Cetak massal satu kelas dalam sekali klik.
- Absensi otomatis dari `presensi_santri` untuk mengisi kolom sakit/izin/alpa.
- Unduh data existing di dialog impor.
- Snapshot nama dan gelar penanda tangan saat batch pertama dicetak.

**DITUNDA**
- Bobot UJIAN bawaan (UM 60 / Rata-rata Rapor 40) masih placeholder, menunggu kebijakan pesantren.
- Salin peristiwa dari tahun ajaran sebelumnya.

# E. Keuangan

## E.1 Keuangan (G2)
**SUDAH**
- Master jenis tagihan dan tarif per lembaga/tahun ajaran; generate tagihan satu layar tanpa duplikat.
- Kasir harian, kwitansi cetak dan cetak ulang, crosstab tagihan, dispensasi, grup custom.
- Batal dan hapus transaksi dengan penyesuaian saldo yang terkunci barisnya.

**AKAN**
- Rekap penerimaan per posisi kas (tunai TU, bank lembaga, bank pesantren) per tanggal atau periode.
- Laporan tunggakan aging 30/60/90+ hari sebagai dasar surat tagihan.
- Penomoran kwitansi runut per lembaga/kas/tahun menggantikan hex acak.
- Mutasi kas harian untuk melihat arus masuk per kas per hari.
- Tutup buku harian untuk mengunci tanggal yang sudah direkonsiliasi.
- Jejak audit: log siapa mencatat, membatalkan, atau menghapus transaksi.
- Maker-checker pembatalan agar pencatat tidak sekaligus menyetujui pembatalan.
- Kartu piutang per santri lintas tahun ajaran.
- Split payment: satu kwitansi boleh gabungan metode atau kas.
- Pengingat tunggakan, dan ekspor laporan ke Excel/PDF.

**DITUNDA**
- Tarif per asrama belum diakomodasi; menunggu modul 505 dibuka.

# F. Portal & Klien

## F.1 Portal Wali (203)
**SUDAH**
- Jalur PSB lanjutan, riwayat keluarga, dan pengajuan biodata (satu aktif per santri, bisa dibatalkan).

**AKAN**
- Dashboard portal dan ringkasan tagihan untuk wali.
- Aktor santri, karena rute portal saat ini hanya untuk `orang_tua`.

## F.2 Klien Desktop `admin-desktop-tauri`
**SUDAH**
- 48 halaman dalam 10 grup navigasi, dengan dua mode: lembaga dan pesantren.
- Dijaga 123 file tes; klien ini untuk `super_admin` dan `admin` lembaga saja.

**AKAN**
- Jalur peran guru, yang izin bawaannya masih kosong.

## F.3 Aplikasi Mobile
**SUDAH**
- (kosong)

**AKAN**
- Empat klien belum di-scaffold: kasir, orang tua, pimpinan, dan guru.

# G. Pasca Production

## G.1 Presensi Santri (500)
**SUDAH**
- Tabel `sesi_presensi`, `presensi_santri`, dan `pelanggaran_santri` sudah dibuat.

**AKAN**
- UI presensi dan UI pelanggaran.

## G.2 Presensi Pegawai (501)
**SUDAH**
- Tabel `presensi_pegawai` sudah dibuat.

**AKAN**
- UI absensi guru.

## G.3 Jadwal Pelajaran (502)
**SUDAH**
- Sudah live dan menjadi bagian modul 201, bukan lagi pekerjaan pasca production.

## G.4 Tahfizh (503)
**SUDAH**
- Tabel `target_tahfiz`, `setoran_tahfiz`, dan `rekap_tahfiz_santri` sudah dibuat.

**AKAN**
- UI tahfizh untuk ziyadah dan murajaah.

## G.5 Statistik Pimpinan (504)
**SUDAH**
- (kosong)

**AKAN**
- Dashboard eksekutif pimpinan yang ringkas, terpisah dari `/api/dashboard/ringkasan`.

## G.6 Asrama (505)
**SUDAH**
- (kosong)

**AKAN**
- (kosong; dibuka pasca production)

**DITUNDA**
- Baru sebatas gambaran; tabel, peran, dan pivot belum dibuat.
- Pasca production dan tidak dikerjakan dalam waktu dekat.

## G.7 Deploy (900/901)
**SUDAH**
- (kosong)

**AKAN**
- Deploy VPS dan konfigurasi production.

---

# H. SEDANG DIKERJAKAN

**Kosong.** Tidak ada sub-modul yang disetujui sebagai pekerjaan berjalan.
Kandidat berikutnya: rekap per kas dan ekspor laporan (bagian I.1).

---

# I. RINCIAN TEKNIS BUTIR SISA

Bagian ini memuat hal teknis yang terlalu rinci untuk bagian A–G: endpoint,
tabel, service, halaman, dan keputusan yang masih menggantung.

## I.1 Keuangan

### I.1.1 Rekap per kas + ekspor laporan
- **BE:** endpoint agregasi baru (mis. `GET /keuangan/rekap-kas`) menjumlah `transaksi_pembayaran` per kolom `kas`.
- **FE:** tab rekap dengan tabel per posisi kas, plus unduh Excel memakai pola `unduhLeger` yang sudah ada.
- **Keputusan:** belum ada endpoint apa pun untuk ini; izin memakai `keuangan.lihat`.

### I.1.2 Laporan tunggakan aging
- **BE:** agregasi umur piutang 30/60/90+ dari `jatuh_tempo` per santri, kelas, atau lembaga.
- **FE:** halaman aging sebagai dasar surat tagihan. Baca-saja, tidak menyentuh aturan tulis.

### I.1.3 Penomoran kwitansi runut
- **Keputusan dulu:** format nomor, mis. `KW-MI-2026-000123`, runut per lembaga/kas/tahun.
- **BE:** kolom nomor plus penghasil urut (tabel counter atau `MAX+1` terkunci); menggantikan hex acak.

### I.1.4 Mutasi kas dan tutup buku harian
- **BE:** agregasi harian per kas, lalu tabel tanggal terkunci yang menolak tambah/batal/hapus mundur.
- **Perlu:** jalur buka-kunci beralasan, karena ini menyentuh aturan tulis.

### I.1.5 Jejak audit dan maker-checker
- **BE:** tabel log baru berisi siapa mencatat, membatalkan, atau menghapus, dengan alasan wajib.
- **Urutan:** maker-checker dikerjakan setelah jejak audit karena bergantung pada log dan alasan.

### I.1.6 Sisa butir keuangan
- Kartu piutang per santri lintas tahun ajaran, bisa dicetak sebagai surat tagihan resmi.
- Split payment: rincian sub-bayar di `transaksi_pembayaran` — perubahan bentuk data.
- Pengingat tunggakan: penanda di crosstab; WhatsApp menyusul lewat modul notifikasi G8.
- Ekspor laporan lain: crosstab, transaksi harian, rekap per jenis, dan tunggakan.

## I.2 Penilaian

### I.2.1 Kunci semester dan jejak cetak
- **BE:** kunci impor/edit setelah batch rapor pertama dicetak, plus log cetak berisi siapa, kapan, dan berapa santri.
- **Perlu:** buka-kunci dengan alasan tercatat.

### I.2.2 Cetak massal dan snapshot penanda tangan
- **FE:** pilih kelas, pratinjau, lalu cetak semua; parameter peringkat sekali per batch.
- **BE:** bekukan nama dan gelar wali/kepala saat batch pertama dicetak agar cetak ulang identik.

### I.2.3 Absensi otomatis dan unduh data existing
- **BE:** hitung ketidakhadiran dari `sesi_presensi`/`presensi_santri`; kolom leger jadi override bila presensi kosong.
- **FE:** tombol unduh data existing di dialog impor, memakai pola `data-existing`.

## I.3 Kurikulum

### I.3.1 Sisa pekerjaan kurikulum
- Jadwal dari sudut guru; saat ini baru per kelas.
- Cetak dan unduh jadwal per kelas.
- Salin mapel antar tahun ajaran: kelas tingkat atas dari tingkat bawah.
- Tes endpoint yang belum tertulis: `kurikulum/slot` CRUD penuh, `guruAktif`, `indexMapel` filter.

## I.4 Portal

### I.4.1 Sisa pekerjaan portal
- **BE:** agregator baca-saja untuk dashboard wali lewat rute `portal/*`.
- **BE:** ringkasan tagihan milik anak dari akun wali.
- **BE:** aktor santri — perannya ada, tetapi belum punya rute portal.

## I.5 Keputusan Offline

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
