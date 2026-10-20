# Part A — Dokumentasi Proyek (ID) — Sistem Informasi Manajemen Pesantren (SIMPES)

| Atribut | Keterangan |
|---|---|
| Versi Dokumen | 3.0 (header KAPITAL) |
| Versi Produk | 2.467 (lihat [CHANGELOG.md](CHANGELOG.md)) |
| Tanggal | 19 Oktober 2026 |
| Status | PRD produk SIMPES — acuan tunggal kebutuhan dan rancangan; status/timeline ada di Board |
| Penyusun | Solo dev + Yayasan |
| Skema versi | **Dokumen**: restrukturisasi = X.0; satu bab final = X.Y; perbaikan kecil = X.Y.Z. **Produk**: nomor rilis dicatat di [CHANGELOG.md](CHANGELOG.md). |

> **Konvensi.** Bahasa Indonesia persis DB. Logika saja, tanpa kode mentah, format kode + nama modul. Tanpa asumsi umum. Aturan bisa berubah via Lampiran E. Penulisan Bab 3 (tanpa simbol paragraf).

> **Timeline & perencanaan.** Satu-satunya sumber timeline, prioritas, status, dan rencana kerja adalah **Board** (`/board`, API `/api/board`, DB `backend/database/papan.sqlite`), dan hanya berlaku per aplikasi saat status efektifnya **Aktif** (master + flag aplikasi). Dokumen ini hanya memuat kebutuhan dan rancangan; jangan menulis roadmap/status di sini. Ringkasan status di [PETA-MODUL.md](PETA-MODUL.md) adalah turunan Board.

## Riwayat Perubahan

Changelog produk dipisah ke [CHANGELOG.md](CHANGELOG.md) agar dokumen ini tetap berisi kondisi produk saat ini, bukan riwayat aktivitas. Versi produk terakhir: **2.467** (2026-10-19). Rincian teknis tetap tersedia di `git log`.

> Rujukan antar-file: "Bab 2–8" → `arsitektur.md`; "Bab 9–14 + Lampiran" → `operasi.md`; "§N / Part B" → `backend-detail.md`.

- [1. Pendahuluan](#1-pendahuluan) (file ini)
- [2. Gambaran Sistem](arsitektur.md#2-gambaran-sistem) … [8. Implementasi](arsitektur.md#8-implementasi)
- [9. Manajemen Proyek](operasi.md#9-manajemen-proyek-hybrid-solo) … [14. Pemeliharaan dan Dukungan](operasi.md#14-pemeliharaan-dan-dukungan)
- [Lampiran A, C–H](operasi.md#lampiran-a--erd-sumber-kebenaran) + Pembahasan Selanjutnya
- [Part B — Detail Backend (EN)](backend-detail.md#part-b--detail-backend-en-dari-backenddocsprdmd-2026-09-09)
- [Riwayat perubahan produk](CHANGELOG.md)

## 1. Pendahuluan

### 1.1 Tujuan Dokumen

Dokumen ini adalah PRD produk SIMPES — dasar pembangunan dan pemeliharaan aplikasi. Acuan tunggal: kebutuhan, proses, rancangan, dan rencana uji/penyebaran. Status, prioritas, dan timeline implementasi ada di **Board** (lihat aturan di `AGENTS.md`). Kriteria selesai per bab: ringkas, tercermin di kode + test, TBD eksplisit.

### 1.2 Latar Belakang

Pengelolaan santri, keuangan, akademik, dan operasional masih manual/spreadsheet:

- Data santri (biodata, dokumen, riwayat belajar) tersebar.
- Nilai, kurikulum, dan induk santri tidak terintegrasi per lembaga.
- Komunikasi orang_tua/wali tidak real-time.
- Pimpinan sulit mendapat laporan per lembaga maupun gabungan.

Pesantren menaungi beberapa lembaga — MI, MD, MTs, Mu'allimin — sebagai baris `lembaga` berjenjang (PK `jenjang`, tanpa root). Tiap lembaga punya `tahun_ajaran`, `kurikulum`, `kelas`, pegawai sendiri; sebagian santri aktif di >1 lembaga (mis. MTS + MD, paket MI-MD).

**Asrama bukan `lembaga`** (v1.10, **belum diimplementasikan**): asrama punya kepengurusan, gedung, kamar, dan siklus penghuni sendiri; didaftarkan sebagai entitas `asrama` + peran `asrama` + pivot `user_asrama` (Modul 505). Santri asrama tetap terikat lembaga akademiknya untuk urusan akademik/PSB; penanda keuangan asrama ditetapkan saat modul keuangan dirumuskan ulang. Tidak ada tabel/role/pivot asrama yang dibuat sekarang — desain ini arah agar sistem sekarang mendekati bentuk akhirnya.

**Santri legacy:** santri lama tanpa jejak `riwayat_belajar`. Sumber kebenaran lembaga adalah `riwayat_belajar`. `status_global` bukan input manual — turunan "punya ≥1 riwayat aktif" (default nonaktif sampai ditempatkan).

### 1.3 Tujuan Proyek

1. Sistem terpusat untuk santri, pegawai/guru, dan pengguna lintas lembaga via model single-pesantren (`lembaga`).
2. Digitalisasi PSB 2-jalur, santri, siklus/riwayat per lembaga, **serta keuangan** (tagihan–tunggakan–pembayaran), yang menjadi tahap terakhir sebelum production.
3. Akademik (mapel, pengampu, nilai, rapor) — daftar mapel kelas = baris `pengampu_mapel`; modul kurikulum + pivot `kurikulum_mapel` dihapus pada v2.413.
4. Kepegawaian (master, keaktifan, walas, sertifikasi).
5. Portal wali read-only + pengajuan.
6. Laporan real-time per lembaga + gabungan dengan tenant ketat.
7. Admin scoped mandiri per lembaga namun terintegrasi.

### 1.4 Ruang Lingkup

> **Status per modul (sudah / sedang / akan / ditunda), prioritas, dan urutan pengerjaan terpusat di Board.** Ringkasan di [PETA-MODUL.md](PETA-MODUL.md) adalah turunannya. Bab ini hanya memuat ruang lingkup produk, bukan roadmap/gelombang/status.

Ruang lingkup produk mencakup fondasi/auth, PSB & santri, kepegawaian & kurikulum, penilaian/rapor, keuangan, portal wali, serta aplikasi klien (Desktop Admin, mobile ortu/guru/pimpinan/kasir, dan landing page). Rincian fitur, status, dan urutan per aplikasi ada di Board. Kurikulum/nilai termasuk cakupan produk; status terkini ada di Board.

### 1.5 Definisi Singkat

Lihat Lampiran D. Inti: `lembaga` (PK `jenjang`: MI/MD/MTS/MLN), `tahun_ajaran`, `kelas` (`walas_id→pegawai`), **5 peran** (`super_admin, admin, guru, orang_tua, santri` — inilah isi `RoleSeeder`; peran `asrama` dan `kasir` **tidak pernah dibuat**, `kasir` dihapus v2.38 dan `asrama` masih rancangan), matriks izin (`IzinKatalog`), `riwayat_belajar`.

### 1.6 Referensi

- Wawancara pengurus (Agu 2026), kurikulum 2026/2027, tata tertib.

---

## Modul Keuangan — Konsep (v2.286)
- Inti: pencatatan **tagihan**, **tunggakan**, **pembayaran** santri (lembaga & asrama). Penerimaan lain (dana BOS), pengeluaran, tabungan, pindah buku, barcode/WhatsApp/kasir-mobile masuk menyusul.
- Jenis tagihan: bulanan/rutin (Infaq Bulanan, Infaq Bulanan Asrama) vs sekali (ASAS, ASAT, Ujian, HIPA, Pendaftaran, Biaya Masuk, biaya asrama lain). HIPA setahun sekali; kelas akhir diganti Biaya Ujian (HIPA sudah termasuk). Cakupan per jenis: global (semua lembaga) atau khusus satu lembaga; daftar tarif & generate menyaring jenis yang berlaku untuk lembaga itu.
- Tarif per lembaga + tahun ajaran; nominal boleh berubah per TA. Santri yang punya riwayat di dua lembaga (mis. MI + MD) tetap ditagih satu kali, di lembaga primer MI — mekanisme ini berlaku di tabel tagihan, sehingga tarif tidak perlu satu baris per kombinasi keanggotaan. Perubahan status/penyesuaian tarif: tagihan lama tetap; nominal baru berlaku di tagihan periode berikutnya; pembayaran lama dikreditkan.
- Keringanan: putra pegawai (override tarif). Status tagihan: belum/sebagian/lunas; batal/hapus pembayaran menyesuaikan total tagihan; hapus tagihan permanen (wajib batalkan dulu pembayaran aktifnya). Pindah/mutasi: tunggakan tetap lembaga asal.
- Pembayaran: TU/Admin/Kasir lembaga berkemampuan sama (catat + hapus/batal), kwitansi karakter acak; kas memetakan posisi uang (tunai TU | bank lembaga | bank pesantren). Asrama: dibayar melalui TU lalu dicatat di kas asrama (bukan pendapatan lembaga). Tunggakan dibaca per siswa/kelas/semua (admin, TU, bendahara, pimpinan, orang tua).

### Alur Buat Tagihan (generate) — diterapkan 2026-10-19
- **Satu layar, tanpa tombol Lanjut**: kriteria (tarif, periode, kelompok) dan tabel Santri tampil bersamaan; tabel mulai dimuat begitu kelompok tersedia. Alasan: keluhan utama adalah jumlah langkah, bukan isi field.
- **Konfirmasi tetap ada, diringkas**: satu paragraf + tombol; angka ringkasan sudah tampil di footer, jadi tidak diulang.
- **Istilah hasil**: **Kelompok** = penyaring populasi (Semua/MI/MD/Custom; Custom memakai grup santri custom); **Dilewati** = baris tidak dibuat/diubah (sudah dibayar atau nominal baru < terbayar); **Tetap** = tagihan sudah ada dan nominalnya sama; **Manual** = nominal diketik tanpa dispensasi.
- **Invarian generate**: tidak pernah membuat duplikat; tagihan bulanan yang sudah dibayar dilewati; non-bulanan dilewati bila nominal baru < terbayar; dispensasi aktif diterapkan otomatis hanya untuk paket yang memuat Santri itu dan lingkup jenjangnya cocok (null = semua lembaga), termasuk saat paket dipilih manual di tab Ubah; kuota dialokasikan ke N bulan pertama per Santri; paket se-grup tidak menumpuk ("menempel menang"); generate tidak pernah menambah penerima.
- **Jatuh tempo**: jenis bulanan otomatis tanggal 10 per periode; non-bulanan boleh dikosongkan (berarti langsung tunggakan).

### Konsep Fitur Keuangan
Daftar di bawah adalah **konsep** fitur lanjutan keuangan. **Status dan urutan pengerjaannya ada di Board** — jangan salin statusnya ke sini.

1. **Laporan tunggakan (aging)** — umur piutang 30/60/90+ hari per santri/kelas/lembaga dari `jatuh_tempo`; dasar surat tagihan & prioritas penagihan.
2. **Pengingat tunggakan** — penanda di crosstab + pengingat berkala (WhatsApp menyusul lewat modul notifikasi).
3. **Kwitansi cetak** — struk per transaksi berkop lembaga: nomor kwitansi, santri, rincian tagihan, total, metode/kas, kasir (`diterima_oleh`), tanggal; cetak ulang dari tabel harian.
4. **Rekap per kas** — penerimaan per posisi kas (`tunai_tu`/`bank_lembaga`/`bank_pesantren`) per tanggal/periode; dasar hitung fisik vs catatan.
5. **Mutasi kas harian** — arus masuk per kas per hari; selisih kas tercatat vs terhitung.
6. **Jejak audit** — log siapa mencatat/membatalkan/menghapus transaksi (kini hanya `diterima_oleh` pembuat); alasan batal/hapus wajib diisi.
7. **Penomoran kwitansi runut** — ganti hex acak jadi runut per lembaga/kas per tahun (mis. `KW-MI-2026-000123`) agar celah nomor terdeteksi.
8. **Maker-checker pembatalan** — pencatat ≠ penyetuju batal/hapus (atau minimal alasan tertulis wajib tersimpan).
9. **Kartu piutang per santri** — seluruh tagihan + pembayaran + sisa lintas TA dalam satu keluaran; bisa jadi surat tagihan resmi (menjawab tunggakan alumni).
10. **Split payment** — satu kwitansi boleh gabungan metode/kas (mis. tunai + transfer); rincian per sub-bayar di `transaksi_pembayaran`.
11. **Tutup buku harian** — kunci tanggal yang sudah direkonsiliasi (tolak tambah/batal/hapus mundur).
12. **Ekspor laporan** — Excel/PDF untuk crosstab, transaksi harian, rekap per jenis, tunggakan (pakai ulang pola ekspor modul lain).
13. **Dasbor ringkasan** — total tagihan vs terbayar vs tunggakan per lembaga/TA + tren penerimaan bulanan.

### Modul Penilaian (fondasi; status & sisa di Board)
Keputusan terkunci: (1) nilai akhir dihitung hanya bila SEMUA komponen berbobot terisi (pratinjau melaporkan yang kurang); (2) bobot bawaan per jenjang UH 20 + Tugas 20 + PTS 20 + ASAS 40 (= 100), bisa diubah per TA; (3) offset predikat A ≥ KKM+20, B ≥ KKM+10, C di antaranya, D < KKM, berjangkar ke KKM `AKHIR`. Spesimen rapor per jenjang (MI/MD/MTS) sudah ada pada pengurus — jadi acuan template cetak saat implementasi.
- **Dua jalur input, komponen tidak di-hardcode.** (A) Hitung: master `komponen_nilai` + bobot per (jenjang, TA) — sekolah bebas tambah/hapus/nonaktifkan komponen (UH, Tugas, PTS, ASAS/ASAT/UAP/UJIAN/UM); tabel `nilai_komponen` (santri, pengampu_mapel, TA, semester, komponen → skor, unik); `nilai_akhir` = Σ skor×bobot, `sumber='hitung'`. (B) Impor langsung: leger wide nilai akhir → `nilai_akhir`, `sumber='impor'`, komponen boleh kosong. Tabel `nilai_santri` dipakai apa adanya (formatif/sumatif dibiarkan 0). Impor menimpa hasil hitungan (dengan hitungan baris tertimpa di pratinjau); hitung-ulang melewati baris impor kecuali dicentang paksa; kolom `sumber` tampil sebagai lencana di leger.
- **KKM tunggal per peristiwa**: master `kkm_kegiatan` per (kegiatan — baris komponen + satu baris khusus `AKHIR`, jenjang, TA). Skor komponen merah bila < KKM komponennya; nilai akhir (kedua jalur) merah bila < KKM `AKHIR`; predikat dari offset di atas.
- **Template leger ditetapkan kita**: kolom tetap `nis_lokal | nama | jenjang | kelas | sakit | izin | alpa | catatan_wali` + kolom mapel dinamis dari lingkup impor (jenjang + kelas + TA); `nis_lokal` kunci pencocokan, nama pembanding. Mode impor: per-komponen (satu komponen per file) atau nilai-akhir. Mesin satu: template/pratinjau/eksekusi bertahap (pola `import-potong`); nilai di luar 0–100 ditolak; absensi + catatan wali ikut kolom file yang sama (input guru/wali tetap di aplikasi lain).
- **Keluaran**: rapor per santri per jenjang (format berbeda tiap jenjang) via cetak browser → PDF (tanpa dependensi baru; satu komponen pratinjau per jenjang + stylesheet print, merah bila < KKM, blok tanda tangan wali + kepala); leger akhir crosstab (santri × mapel) + unduh Excel (`maatwebsite/excel` sudah ada). Leger rincian komponen per mapel opsional (menyusul bila diminta).
- **Cakupan implementasi**: backend 3 master kecil (`komponen_nilai` + bobot, `kkm_kegiatan`, `rentang_predikat`) + impor leger + endpoint rapor & leger + `docs/SCHEMA.md`; frontend halaman nilai (Master, Impor Leger, Leger, Rapor).

#### Spesimen Rapor MI & MD (2026-10-16 — acuan template cetak)
Sampel: rapor semester genap 2025/2026 kelas 1A MI & 1B MD. Struktur SAMA, isi/kop berbeda.
- **Kop**: MI = Kemenag + "MIS PERSIS RAHAYU" + alamat lengkap + 2 logo; MD = "PESANTREN PERSATUAN ISLAM 45 RAHAYU / MD PERSIS RAHAYU" + alamat + 1–2 logo. Data kop tersedia di `lembaga` (nama, alamat, `logo_url`, `mudir_am` = kepala); pemilih template per lembaga SUDAH ADA (`lembaga.template_rapor`, `mode_rapor`). Tugas ops: isi `logo_url` tiap lembaga.
- **Identitas**: MI = Nama, NIS (bertitik `25.26.01.0054`), NISN | Madrasah, Kelas/Semester (`1A MI /Genap`), TA. MD = Nama, NIS, Kelas | Madrasah, Semester, TA (TANPA NISN). NIS bertitik hanya format tampil; pencocokan impor harus menormalkan titik/spasi.
- **Tabel nilai**: NO | MATA PELAJARAN (nama + `Guru: {sapaan} {nama}, {gelar}`) | NILAI AKHIR | TERBILANG per-digit kata (`sembilan enam`; desimal `… koma …`). Sapaan: L → `Ust.`, P → `Ibu` (dari `pegawai.jenis_kelamin` + `gelar_depan/belakang`; perlu konfirmasi). Guru per mapel dari `pengampu_mapel`.
- **Rekap**: Jumlah (Σ), Rata-Rata, Peringkat (angka + ordinal: `1→pertama`, `6→keenam`). Format desimal BEDA: MI 2 desimal koma (`86,67`), MD 1 desimal titik (`96.4`) — jadikan setelan template per jenjang. Helper `terbilang()` yang ada TIDAK cocok (ia ejaan baku "Seratus"); butuh helper baru: terbilang per-digit + ordinal.
- **Halaman 2**: Status Kenaikan (kotak `NAIK KELAS`), Ekstrakurikuler (MI: nama+pembimbing+predikat A/B+deskripsi; MD: kegiatan+nilai angka+keterangan), Prestasi (jenis+keterangan), Ketidakhadiran (Sakit/Izin/Alpa × Hari — dari `rapor_catatan_wali`), Catatan Wali (dari kolom leger), Tanggapan Ortu (kotak kosong, tulis tangan), TTD: Ortu (garis), Wali Kelas + nama (dari `kelas.walas_id`), Kepala (`lembaga.mudir_am`), tempat+tanggal cetak (`Bandung, 20 Juni 2026` — parameter saat cetak, bawaan: kab_kota + hari ini).
- **Celah data (butuh keputusan)**: (a) ekskul + prestasi TAK ADA tabelnya — usulan tabel `nilai_ekstrakurikuler` generik (santri, TA, semester, kegiatan, pembimbing, predikat, deskripsi, nilai) diisi lewat kolom tambahan leger ATAU tab input manual; (b) status kenaikan (naik/tidak) — usulan kolom di `rapor_catatan_wali`, diisi wali (aturan otomatis berisiko salah); (c) peringkat hanya terisi sebagian sampel (10 besar?) — konfirmasi aturan tampilnya; (d) tanggal/tempat rapor per batch cetak, bukan per santri.

#### Keputusan lanjutan modul penilaian (2026-10-16)
- **Empat template impor terpisah** (bukan satu file): (1) **nilai/leger** (`nis_lokal|nama|jenjang|kelas|mapel1…N`); (2) **catatan wali** (`nis_lokal|nama|kelas|sakit|izin|alpa|catatan|status_kenaikan`) — sekaligus sumber status naik/tidak; (3) **prestasi** (hanya santri berprestasi): `nis_lokal|nama|kelas|prestasi|level|keterangan` (satu baris per prestasi; santri boleh beberapa baris); (4) **ekskul** (`nis_lokal|nama|kelas|ekskul1|predikat1|ekskul2|predikat2|…`, hanya peserta). Tiap template: unduh → pratinjau → eksekusi (mesin impor satu).
- **Peringkat = parameter cetak** (bukan data): pilihan 3 besar / 10 besar / semua, bawaan 10 besar; di luar cutoff sel peringkat dikosongkan seperti spesimen.
- **MTS/MLN tanpa template sendiri**: menggabung 2 kurikulum (kemenag + pesantren), kurikulum = daftar pelajaran. Aturannya: daftar mapel rapor = gabungan mapel yang BERNILAI untuk santri×semester itu (urut templat/kurikulum), sehingga kurikulum gabungan terlayani tanpa cabang khusus. Perlu konfirmasi bahwa ini cukup (vs. daftar mapel baku per kurikulum).
- **Tabel baru**: master `ekstrakurikuler` (kegiatan, pembimbing, jenjang, tahun_ajaran, aktif) + `nilai_ekstrakurikuler` (santri, TA, semester, ekstrakurikuler_id, predikat, deskripsi, nilai; pembimbing diambil dari master, bukan dari file impor) + `prestasi_santri` (santri, TA, semester, prestasi, level, keterangan). Petakan predikat ekskul→deskripsi (bisa diubah via master `predikat_ekskul`, bawaan: A→Sangat Baik, B→Baik, C→Cukup, D→Kurang, E→Kurang Sekali).

#### Pengaman implementasi modul penilaian (2026-10-16 — disetujui untuk diimplementasikan)
- **Kunci semester + jejak cetak**: impor/edit nilai semester terkunci setelah batch rapor pertama dicetak (buka-kunci tercatat alasannya); log cetak (siapa, kapan, berapa santri, parameter peringkat).
- **Cek kelengkapan sebelum cetak**: dasbor per kelas — santri dengan mapel belum lengkap, absensi/catatan kosong, mapel tanpa pengampu (nama guru tampil per baris rapor). **Sudah ada**: ringkasan/indikator per santri + **tombol cetak diblokir** selama masih ada santri yang nilainya belum lengkap (alasan tampil di tooltip tombol).
- **Absensi dari presensi**: ketidakhadiran dihitung otomatis dari `sesi_presensi`/`presensi_santri`; kolom leger sakit/izin/alpa jadi override bila presensi kosong.
- **Cetak massal per kelas**: pilih kelas → pratinjau daftar → cetak semua sekaligus; opsi peringkat (3/10/semua, bawaan 10) sekali per batch.
- **Tes unit fungsi murni**: terbilang per-digit, ordinal peringkat, jumlah, rata-rata, aturan predikat vs KKM (murah dites, mahal bila salah di ratusan rapor).
- **Bekukan penanda tangan**: nama + gelar wali/kepala di-snapshot saat batch pertama dicetak agar cetak ulang identik.

#### Modul penilaian (2026-10-16, revisi per-peristiwa)

> **Status & butir sisa terpusat di [PETA-MODUL.md](PETA-MODUL.md) bagian D.1 dan D.2.**
> Paragraf di bawah adalah **model & keputusan rancangan** (mengapa begitu),
> bukan daftar status. Jangan salin status ke sini.

**Model terkunci (dikonfirmasi pengguna)**: nilai diikat **PERISTIWA** — `peristiwa_nilai` per (jenjang, TA), tanpa semester; `komponen_nilai` (bobot jadi kolom, `sumber` manual/rapor_otomatis) MILIK satu peristiwa; `kkm_kegiatan` & `rentang_predikat` per peristiwa; `nilai_santri` unik per (santri, pengampu, TA, semester, peristiwa). Cakupan peserta peristiwa: `semua` (ASAS), `kecuali_akhir` (ASAT), `tingkat_akhir` (UJIAN & UAP) — tingkat akhir = `ref_tingkat.urutan` tertinggi jenjang. UJIAN dilewati untuk jenjang MD (jalur Kemenag); komponen UJIAN = UM (manual, bawaan 60) + Rata-rata Rapor (otomatis dari rata-rata rapor `jumlah_tingkat_rapor` tingkat sebelumnya, bawaan 2, boleh ditimpa impor).
**Sudah jalan**: lihat [PETA-MODUL.md](PETA-MODUL.md) bagian D.1 dan D.2 (daftar fitur yang live) — riwayat per versi di [CHANGELOG.md](CHANGELOG.md) v2.401–v2.404.
**Belum dikerjakan**: lihat [PETA-MODUL.md](PETA-MODUL.md) bagian D.1 dan D.2.
**Prasyarat di luar modul ini**: **SUDAH TERPENUHI** ([changelog](CHANGELOG.md) v2.405, disederhanakan v2.413) — `mata_pelajaran` & `pengampu_mapel` kini punya halaman pengelola lengkap (grup nav "Kurikulum"): master mapel per jenjang (termasuk KKM + urutan rapor) dan pengampu (kelas × mapel → guru dari keaktifan pegawai; daftar mapel kelas ditambah lewat "Tambah mapel", "Salin dari kelas lain", atau import). Selama tabel-tabel itu masih 0 baris (mis. DB yang belum diisi), leger/rapor memang tampil tanpa kolom mapel — itu soal data, bukan kode.
**Keputusan yang diambil saat implementasi**: (a) impor `nilai` memakai kolom mapel dinamis (seluruh header file diterima) — `konfigurasi.kolomDariFile` ditambahkan ke `ImportBertahapUmumDialog` (aditif); (b) ekstrakurikuler yang belum ada di master **dibuat otomatis** saat impor; (c) `predikat_ekskul` global (jenjang null) hanya super_admin; (d) migrasi restrukturisasi memindahkan konfigurasi lama ke peristiwa ASAS dan **menghapus** tabel `komponen_nilai_bobot`; (e) **PTS = peristiwa sendiri** (keputusan pengguna 2026-10-16, mengoreksi v2.403): rapor sementara + komponen "PTS" di ASAS/ASAT **bersumber dari peristiwa PTS** (`sumber='peristiwa'`) sehingga guru mengisi PTS sekali; rujukan antar-peristiwa **satu tingkat** (tanpa rekursi) dan ditolak bila diri sendiri / beda jenjang / beda TA.

#### Modul mapel & pengampu (2026-10-17)

> **Status & butir sisa terpusat di [PETA-MODUL.md](PETA-MODUL.md) bagian C.2 dan bagian C.2.**
> Paragraf di bawah adalah **model & keputusan rancangan**.

**Model terkini**: daftar mapel sebuah kelas **YAITUH** baris `pengampu_mapel` kelas itu (kelas × mapel → guru via `keaktifan_pegawai`, null = belum ada guru). Modul kurikulum (per jenjang) + komposisi (`kurikulum_mapel` + cakupan tingkat `kurikulum_mapel_tingkat`) + peta `kelas_kurikulum` **DIHAPUS** pada v2.413 bersama seluruh endpoint & halamannya. `mata_pelajaran` — KKM + urutan tampil rapor pindah ke master mapel (`kkm` decimal null = predikat manual; `urutan` int default 0) sehingga kolom itu tak hilang. `slot_jam_pelajaran` per jenjang; `jadwal_pelajaran` = pengampu × slot × hari (+ruangan) dengan penjaga bentrok ganda. Kamus nama mapel lintas jenjang: `ref_mapel` (kelola di halaman Referensi).
**Sudah jalan**: 3 halaman grup nav "Kurikulum" (Mata Pelajaran, Pengampu, Jadwal Pelajaran) — daftar fitur & status ada di Board. Izin `kurikulum.{lihat,tambah,ubah,hapus}`.
**Belum dikerjakan**: [PETA-MODUL.md](PETA-MODUL.md) bagian C.2.
**Catatan data**: `mata_pelajaran` & `pengampu_mapel` di DB dev masih **0 baris** — modul siap dipakai, tinggal mengisi master mapel lalu menambah/salin mapel per kelas agar Leger/Rapor Penilaian menampilkan kolom mapel.


