# Changelog — SIMPES

Riwayat perubahan **produk** SIMPES, urut menaik: entri terbaru di bagian bawah. Changelog adalah catatan keputusan, bukan catatan aktivitas.

> **Versi dokumen vs versi produk.** Angka di dokumen ini adalah versi produk. Versi dokumen PRD dikelola terpisah di [PRD.md](PRD.md).

<!-- Konvensi changelog: urut menaik (terlama di atas); entri baru selalu ditambahkan di BAWAH.
     HANYA perubahan fundamental atau signifikan yang dicatat sebagai versi sendiri — satu entri
     boleh mewadili banyak commit. Perbaikan kecil, chore, dan perapian TIDAK mendapat versi;
     semuanya tinggal terlihat di riwayat git. Satu entri maksimal 2 kalimat. -->

## Aturan pencatatan versi (ditetapkan 2026-10-19)

Changelog adalah **catatan keputusan**, bukan catatan aktivitas. Yang ditulis ke
versi hanya perubahan yang memenuhi salah satu syarat:

- **fundamental** — mengubah model data, aturan bisnis, batas keamanan/tenant, atau kontrak API;
- **signifikan** — menambah/menghapus modul atau halaman, mengubah alur kerja utama pengguna, atau keputusan desain yang menutup jalan lain.

Di luar itu **tidak** diberi versi: perbaikan bug kecil, perapian kode, chore
(format/lint/dependensi), dan penyesuaian visual. Perubahan sekecil itu tetap
tercatat penuh di riwayat git (`git log`), jadi tidak ada yang hilang — hanya
tidak mengotori changelog yang mestinya dibaca orang lain.

**Setiap entri memakai satu kategori** agar pembaca bisa memindai changelog tanpa
membaca seluruh isinya:

| Kategori | Untuk perubahan |
|---|---|
| `[Keamanan]` | siapa boleh melihat/mengubah apa, kredensial, izin, batas antar lembaga |
| `[Ketepatan]` | angka, tanggal, dan hasil yang harus sama di mana pun |
| `[Tampilan]` | cara pengguna melihat dan menggerakkan layar |
| `[Alur]` | urutan langkah yang harus dikerjakan pengguna |
| `[Kinerja]` | kecepatan dan beban kerja |
| `[Dokumen]` | isi dokumen proyek itu sendiri |

Aturan praktis:

1. **Sebek mungkin** — kumpulkan banyak commit yang satu tujuan ke satu entri;
   jangan memecah jadi versi kecil. Kalau dua kategori bisa digabung, gabung.
2. Satu entri **maksimal 2 kalimat** dan ditulis dalam **bahasa umum** — sebut
   efeknya bagi pengguna, bukan nama tabel, fungsi, atau berkas. Detail teknis
   (nama kolom, tes, asersi) tetap untuk pesan commit git.
3. Rincian bertumpuk (nama tes, jumlah asersi, daftar berkas) tetap untuk pesan commit git, bukan untuk changelog.
4. Kalau sebuah perubahan ternyata insignificant, **tidak** naik versi sama sekali.
5. **Nomor boleh melompat.** Angka versi tetap naik tiap perubahan, tapi hanya
   yang memenuhi syarat yang ditulis di tabel. Jadi nomor yang hilang berarti
   "perubahannya tidak cukup penting untuk dicatat" — bukan entri hilang.
   Riwayat lengkap tetap ada di `git log`.
6. Tabel changelog **diklasifikasi ulang** (lihat entri 2.421): dari 460 entri
   menjadi 121, hanya yang fundamental/signifikan, satu kalimat per entri.

## Riwayat versi produk

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 2026-09-10 | [Infrastruktur] Baseline proyek ditetapkan; arsip lama dibekukan, modul inti G0-G3 masuk produksi |
| 1.1 | 2026-09-10 | [Dokumen] PRD final: ID modul, kebutuhan fungsional/nonfungsional, use case, asumsi |
| 1.3.2 | 2026-09-10 | [Keamanan] Pengguna bisa ditugaskan atau dilepas dari lembaga; data pindah ke MySQL |
| 1.4 | 2026-09-10 | [Alur] Cakupan paket offline dikunci pada daftar OFF-01 sampai OFF-10 |
| 1.5 | 2026-09-10 | [Alur] Modul PSB (100) dibuka untuk dipakai; status seleksi jadi bawaan |
| 1.6 | 2026-09-10 | [Alur] Modul Santri (101) hidup: kamus, kebijakan, impor, dan CRUD |
| 1.7 | 2026-09-10 | [Alur] Modul Siklus (102) hidup dengan layanan dan delapan endpoint |
| 1.7.1 | 2026-09-10 | [Alur] Status awal Santri final; yang tidak lulus boleh mendaftar ulang |
| 1.8 | 2026-09-10 | [Keamanan] Sesi memakai token per perangkat: berlaku 30/365 hari, bisa dicabut semua |
| 1.9 | 2026-09-10 | [Alur] Modul transaksi (103) dibuka untuk dipakai, lalu dihapus di versi 2.36 |
| 1.9.1 | 2026-09-11 | [Keamanan] Role pengguna terkunci pada dirinya sendiri; akun menempel otomatis ke lembaga |
| 1.9.2 | 2026-09-11 | [Keamanan] Admin tak bisa menaikkan role; menambah lembaga hanya super_admin |
| 1.9.6 | 2026-09-11 | [Infrastruktur] Frontend pindah ke Tailwind v4 dan shadcn; tabel Excel, modal, paginasi baru |
| 1.9.7 | 2026-09-11 | [Tampilan] Tabel data bergaya spreadsheet: seleksi sel, AutoFit, font offline |
| 1.10 | 2026-09-14 | [Dokumen] Desain data Santri legacy, status global, dan asrama ditetapkan |
| 1.10.1 | 2026-09-14 | [Dokumen] Modul Asrama (505) diputuskan sebagai pasca produksi |
| 1.10.2 | 2026-09-14 | [Ketepatan] Kolom legacy boleh kosong; status global dihitung turunan dan data lama diisi |
| 1.10.3 | 2026-09-14 | [Alur] Pengisian data Santri bisa manual lewat form atau template Excel |
| 1.10.4 | 2026-09-14 | [Alur] Impor jadi dua langkah: periksa dulu, baru simpan |
| 1.11 | 2026-09-15 | [Alur] Siklus punya UI desktop: enam tampilan, dialog, dan aksi massal |
| 1.12 | 2026-09-15 | [Keamanan] Tahun ajaran jadi milik tiap lembaga; portal PSB terverifikasi |
| 1.13 | 2026-09-15 | [Ketepatan] Nama kelas wajib unik per lembaga dan tahun ajaran |
| 2.0 | 2026-09-15 | [Alur] Data Santri dirombak: Buku Induk jadi murni, Santri per lembaga, 8 halaman baru |
| 2.2 | 2026-09-16 | [Tampilan] Baris per halaman 10-1000, bawaan 50 |
| 2.33 | 2026-09-16 | [Alur] Nilai awal dan opsi Semua dihapus dari combobox |
| 2.35 | 2026-09-16 | [Tampilan] Tombol Peran Sebagai dan Kotak Cari toolbar dibuang |
| 2.36 | 2026-09-16 | [Alur] Modul keuangan dihapus total dari backend dan tiga halaman |
| 2.37 | 2026-09-16 | [Alur] Sisa keuangan di PSB dihapus: flag lunas, nominal, dan tabel biaya |
| 2.38 | 2026-09-17 | [Keamanan] Izin Kelola dipetakan lewat matriks; role kasir dihapus |
| 2.39 | 2026-09-17 | [Alur] Impor digabung: Santri dan keanggotaan dalam satu file berlapis |
| 2.42 | 2026-09-17 | [Alur] Impor jadi satu pintu dan menerima identitas tanpa keanggotaan |
| 2.44 | 2026-09-17 | [Alur] NIS antar jenjang MI dan MD bisa disamakan dua arah |
| 2.48 | 2026-09-17 | [Alur] Halaman baru MI-MD: tiga panel, samakan kelas, dan pengecualian pasangan |
| 2.51 | 2026-09-17 | [Dokumen] Semua aturan bisnis dicatat lengkap di PRD |
| 2.52 | 2026-09-17 | [Alur] Kelas arsip dibekukan; sistem menandai otomatis kelas terakhir Santri |
| 2.56 | 2026-09-17 | [Dokumen] PRD dipecah menjadi 4 file tanpa mengubah isi |
| 2.57 | 2026-09-17 | [Dokumen] Referensi arsip lama dilepas dari PRD |
| 2.58 | 2026-09-17 | [Keamanan] Halaman Tampilan Standar dihapus; sebaran konten dikunci untuk super_admin |
| 2.61 | 2026-09-17 | [Alur] Pengecualian pasangan MI-MD berlaku global dan simetris |
| 2.62 | 2026-09-17 | [Tampilan] Header tabel bisa diklik untuk mengurutkan; Shift+klik urut hingga tiga kolom |
| 2.63 | 2026-09-17 | [Tampilan] Pengurutan lewat header berlaku di semua tabel daftar |
| 2.64 | 2026-09-17 | [Tampilan] Urutan bawaan daftar Santri: jenis kelamin lalu nama |
| 2.65 | 2026-09-17 | [Tampilan] Urutan dipindah ke dropdown toolbar beserta item gabungan |
| 2.72 | 2026-09-18 | [Tampilan] Kamus Label: generate label massal, cari tabel, ikon align dan switch kolom |
| 2.73 | 2026-09-18 | [Tampilan] Urutan kolom dipindah ke preset global per tabel lewat dialog Kelola urutan |
| 2.78 | 2026-09-22 | [Tampilan] Urutan kolom mengikuti preset tabel dan dihormati grid |
| 2.80 | 2026-09-22 | [Alur] Impor gabungan membuat riwayat belajar perdana otomatis dari tahun masuk |
| 2.81 | 2026-09-22 | [Kinerja] Impor file besar dibaca bertahap 500 baris |
| 2.82 | 2026-09-23 | [Ketepatan] Impor menormalkan tahun masuk dan tanggal nol dari Excel |
| 2.84 | 2026-09-23 | [Ketepatan] NIK dan nomor KK longgar: bukan 16 digit disimpan berawalan X- |
| 2.87 | 2026-09-23 | [Alur] Impor kelas menerima file multi-lembaga dan multi tahun ajaran |
| 2.92 | 2026-09-23 | [Alur] Impor kelas jadi upsert: nama cocok diperbarui, nama baru dibuat |
| 2.93 | 2026-09-23 | [Alur] Impor riwayat jadi upsert per kunci; sel kosong tidak menimpa |
| 2.96 | 2026-09-23 | [Alur] Salin semester bisa dibatalkan per baris atau sekaligus banyak baris |
| 2.97 | 2026-09-23 | [Alur] Syarat pindah semester: ganjil harus sudah berkelas |
| 2.107 | 2026-09-23 | [Ketepatan] Kriteria cocok impor Santri disederhanakan ke NIS dan jenjang |
| 2.117 | 2026-09-24 | [Ketepatan] Hanya periode terakhir per Santri dan jenjang yang ditandai aktif |
| 2.118 | 2026-09-24 | [Ketepatan] Rekap Santri dihitung dari tahun ajaran, termasuk tahun historis |
| 2.122 | 2026-09-24 | [Keamanan] Opsi Semua di dropdown lembaga selalu tampil selama punya akses |
| 2.123 | 2026-09-24 | [Alur] Status akhir semester ganjil yang lanjut ke genap memakai kode baru |
| 2.152 | 2026-09-24 | [Alur] Dialog Kelola Tabel dihapus; pengaturan tabel kini lewat Kelola Halaman |
| 2.153 | 2026-09-24 | [Kinerja] Daftar Kelas kini mengurut dan berpaginasi lewat server |
| 2.159 | 2026-09-25 | [Alur] Samakan dengan MI/MD hanya berlaku untuk Santri aktif di kedua jenjang |
| 2.161 | 2026-09-25 | [Ketepatan] Perbandingan Kelas hanya memuat Santri aktif di MI dan MD sekaligus |
| 2.163 | 2026-09-25 | [Alur] Setiap filter halaman bisa disimpan dalam mode Tunggal atau Jamak |
| 2.172 | 2026-09-25 | [Alur] Ganti lembaga tidak lagi menghapus filter tahun dan tingkat-kelas |
| 2.174 | 2026-09-25 | [Keamanan] Pilihan di Referensi bisa dihapus massal permanen, hanya yang punya izin |
| 2.179 | 2026-09-25 | [Alur] Riwayat Belajar jadi laporan saja, aksi masuk dan keluar kelas dihapus |
| 2.192 | 2026-09-25 | [Alur] Halaman Pindah Semester dihapus dari menu dan konfigurasi aplikasi |
| 2.221 | 2026-09-25 | [Alur] Tombol Salin ke Genap beserta alurnya dihapus dari Pindah Kelas |
| 2.235 | 2026-09-25 | [Kinerja] Semua impor file kini diproses bertahap per 1.000 baris |
| 2.240 | 2026-09-26 | [Ketepatan] Data tingkat awal menyesuaikan jenjang: MI/MD 1-6, MTS 7-9, MLN 10-12 |
| 2.241 | 2026-09-26 | [Alur] Tiga dialog impor mendapat tombol untuk mengunduh data yang sudah ada |
| 2.249 | 2026-09-26 | [Alur] Impor arsip mutasi keluar kini bisa memperbarui data yang sudah ada |
| 2.253 | 2026-09-26 | [Ketepatan] Arsip kelulusan unik per Santri dan lembaga lulus, bisa ada MI dan MD |
| 2.259 | 2026-09-26 | [Alur] Kenaikan Kelas hanya bisa dipakai saat semester aktif genap |
| 2.263 | 2026-09-26 | [Ketepatan] Kenaikan Kelas memakai tahun ajaran dari filter dan wajib satu pilihan |
| 2.267 | 2026-09-26 | [Ketepatan] Kelulusan memakai tahun ajaran dari filter, wajib satu, kandidat kelas akhir semester 2 |
| 2.270 | 2026-09-26 | [Alur] Kelulusan punya aksi batalkan satu baris maupun sekaligus |
| 2.278 | 2026-10-02 | [Alur] Halaman Kamus Label dan seluruh fiturnya dihapus dari aplikasi |
| 2.279 | 2026-10-02 | [Infrastruktur] Nama kolom tabel kini diambil dari kode, bukan disimpan di basis data |
| 2.284 | 2026-10-02 | [Tampilan] Halaman pengaturan Tampilan dihapus, termasuk alamat lamanya |
| 2.286 | 2026-10-03 | [Alur] Modul Keuangan dihidupkan lagi untuk mencatat tagihan, tunggakan, dan pembayaran |
| 2.287 | 2026-10-03 | [Alur] Tagihan kini bisa dihapus permanen |
| 2.288 | 2026-10-03 | [Alur] Pembayaran kini bisa dihapus permanen |
| 2.292 | 2026-10-04 | [Alur] PSB naik jadi grup navigasi sendiri di atas grup Santri |
| 2.294 | 2026-10-04 | [Alur] Halaman Santri Aktif menggabungkan Daftar Kelas, Rekap Santri, dan Pengajuan |
| 2.308 | 2026-10-04 | [Keamanan] Super admin yang bertindak sebagai lembaga tak lagi bisa membuat atau mengubah jenis |
| 2.313 | 2026-10-04 | [Alur] Pembuatan tagihan kini memakai kelompok santri, bukan paket |
| 2.314 | 2026-10-04 | [Alur] Untuk tagihan bulanan, bulan awal kini wajib diisi dan bulan akhir opsional |
| 2.321 | 2026-10-05 | [Infrastruktur] Konvensi label tabel-kolom dihapus; 74 label ditulis ulang jadi prosa |
| 2.329 | 2026-10-05 | [Tampilan] Baris section kolom dirapikan: hitung tampil disembunyikan |
| 2.336 | 2026-10-06 | [Ketepatan] Tunggakan bulanan kini dihitung per bulan dari tanggal jatuh tempo tiap periode |
| 2.339 | 2026-10-06 | [Alur] Aksi tagihan kini muncul dari klik kiri maupun kanan pada sel tagihan |
| 2.340 | 2026-10-06 | [Alur] Tagihan kini bisa diubah langsung tanpa dihapus dan dibuat ulang |
| 2.350 | 2026-10-06 | [Alur] Aksi tagihan dirombak jadi ringkasan di atas dan empat tab Bayar, Ubah, Hapus, Detail |
| 2.351 | 2026-10-06 | [Ketepatan] Jatuh tempo bulanan diubah ke tanggal 10 bulan berjalan, bukan bulan berikutnya |
| 2.357 | 2026-10-06 | [Alur] Pembuatan tagihan jadi dua tahap: tagihan yang ada diperbarui, bukan dilewati |
| 2.359.1 | 2026-10-07 | [Kinerja] Tabel tagihan dihitung langsung di database, jauh lebih cepat dan hemat memori |
| 2.359.2 | 2026-10-07 | [Alur] Pembayaran melebihi sisa tagihan kini ditolak agar kas dan status lunas tetap cocok |
| 2.359.3 | 2026-10-07 | [Ketepatan] Filter kelas di tabel tagihan kini memakai kelas yang benar dipakai tampil |
| 2.365 | 2026-10-09 | [Alur] Tarif bisa langsung ditambah dari tabel tanpa membuka dialog |
| 2.367 | 2026-10-09 | [Ketepatan] Tarif ganda dicegah di aplikasi, tak lagi bergantung pesan dari server |
| 2.368 | 2026-10-09 | [Alur] Tarif tidak lagi bisa ganda untuk lembaga, tahun ajaran, dan jenis yang sama |
| 2.370 | 2026-10-09 | [Tampilan] Tabel tanpa data tidak lagi membuat halaman kosong |
| 2.371 | 2026-10-11 | [Ketepatan] Tabel usia per tingkat di Rekap Santri kini benar untuk tahun ajaran historis |
| 2.401 | 2026-10-16 | [Alur] Modul Penilaian baru dibuat dengan grup navigasi sendiri |
| 2.402 | 2026-10-16 | [Alur] Nilai diikat ke peristiwa PTS, ASAS, ASAT, UJIAN, dan UAP |
| 2.403 | 2026-10-16 | [Alur] Peristiwa ditandai apakah ia menghasilkan rapor atau tidak |
| 2.404 | 2026-10-16 | [Ketepatan] Nilai PTS kini otomatis mengalir ke nilai akhir ASAS dan ASAT |
| 2.405 | 2026-10-16 | [Alur] Modul Kurikulum, Mata Pelajaran, dan Jadwal Pelajaran baru dibuat |
| 2.411 | 2026-10-17 | [Tampilan] Judul kolom bisa diseret untuk mengurutkan dan klik tak lagi memblok kolom |
| 2.412 | 2026-10-17 | [Tampilan] Kegagalan satu bagian tak lagi membuat seluruh layar kosong |
| 2.413 | 2026-10-17 | [Alur] Modul Kurikulum dihapus; mapel kelas kini diambil dari baris pengampu mapel |
| 2.414 | 2026-10-18 | [Tampilan] Tiap tabel punya halaman informasi sendiri yang muncul di ujung judul |
| 2.416 | 2026-10-19 | [Keamanan] Akses antar lembaga, transaksi keuangan, dan penyimpanan sandi desktop diperketat |
| 2.417 | 2026-10-19 | [Ketepatan] Kasir, tagihan, dan tunggakan pakai tanggal sama; daftar panjang dibatasi 10.000 baris |
| 2.418 | 2026-10-18 | [Tampilan] Perubahan isian dan geser kolom hanya jalan saat Mode Ubah aktif |
| 2.419 | 2026-10-19 | [Alur] Aksi massal keuangan melaporkan tagihan gagal dan alasan; kenaikan kelas minta konfirmasi |
| 2.420 | 2026-10-19 | [Kinerja] Generate tagihan 3.000 Santri turun dari 42.006 menjadi 24 permintaan |
| 2.421 | 2026-10-19 | [Dokumen] Audit enam berkas: changelog diklasifikasi ulang (460→121 entri, hanya fundamental/signifikan, satu kalimat + kategori per entri), rujukan tabel mati dibersihkan, angka skema diperbaiki |
| 2.422 | 2026-10-19 | [Alur] Rapor hanya bisa dicetak bila seluruh santri di kelas sudah lengkap nilainya, dengan alasan terkunci tampil di tombol |
| 2.423 | 2026-10-19 | [Alur] Kwitansi pembayaran kini bisa dicetak atau disimpan PDF, baik dari dialog setelah bayar maupun dari tabel pembayaran harian |
| 2.467 | 2026-10-19 | [Dokumen] Branch audit digabung ke main; 51 entri changelog lama dirangkum ke entri 2.416–2.421 dan rujukan dokumen diselaraskan |
| 2.468 | 2026-10-19 | [Dokumen] Status dan rencana per modul kini terpusat di `docs/PETA-MODUL.md` (sudah/sedang/akan/ditunda + rincian teknis butir sisa); daftar status di PRD, arsitektur, backend-detail, dan Lampiran C operasi dipindah ke sana dan tinggal menunjuk |
| 2.469 | 2026-10-19 | [Alur] Papan perkembangan proyek kini hidup di database SQLite terpisah (koneksi `papan`, tidak ikut `migrate:fresh`) dengan 7 modul, 27 sub-modul, dan 78 butir; status dibaca dan diubah lewat command `papan:lihat`, `papan:tandai`, dan `papan:butir` |
