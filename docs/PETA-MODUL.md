# PETA MODUL — Status & Rencana Terpusat

> **Satu-satunya tempat** untuk menjawab "modul ini sudah sampai mana, sedang
> apa, dan akan apa". Dokumen lain (PRD, arsitektur, backend-detail, operasi)
> **tidak lagi** memuat daftar status/rencana — mereka hanya menunjuk ke sini.

- **Terakhir diperbarui:** 2026-10-19
- **Cara pakai:** cari modulnya di §1 (kolom **Sudah / Sedang / Akan**), lalu
  lompat ke §3 untuk rincian teknis butir sisanya.
- **Aturan menulis:** setiap perubahan status/rencana **wajib** mengubah file
  ini lebih dulu. Bila peta dan kode berbeda, peta yang salah — perbaiki peta.

## Kosakata status

| Istilah | Arti |
|---|---|
| **Sudah** | Kode ada, terhubung, dipakai dari UI. Bukan jaminan lolos uji runtime di mesin lain. |
| **Sebagian** | Jalur utama ada, tetapi celahnya disebut eksplisit di kolom Catatan. |
| **Sedang** | Sedang dikerjakan **sekarang**. Ciri: ada perubahan belum ter-commit, atau disetujui pengguna sebagai pekerjaan berjalan. Hanya boleh **satu** modul bertanda ini. |
| **Akan** | Belum ada kode; sudah dirancang cukup untuk dikerjakan. |
| **Ditunda** | Belum ada kode dan **belum** dirancang; sengaja tidak dikerjakan dalam waktu dekat. |

> Catatan: **Sudah/Sebagian/Akan/Ditunda** menggantikan istilah lama
> **Live/Sebagian/Rencana** di `backend-detail.md` §10 (matriks lama itu sudah
> dipindah ke file ini).

---

## 1. Peta modul

### 1.1 Fondasi

| Modul | Sudah | Sedang | Akan | Catatan |
|---|---|---|---|---|
| **001 Setup** | Proyek Laravel 13, `.env`, guard `sanctum` | — | — | Fondasi selesai |
| **002 Skema DB** | 84 file migrasi; `migrate:fresh` hijau (126 tabel termasuk tabel framework) | — | — | Spec kolom di [SCHEMA.md](SCHEMA.md); jumlah tabel dihitung dari DB, bukan angka statis |
| **003 Auth & Pengguna** | Login multi-identifier (email/telepon/username), throttle, `login_audits`, 5 peran, kunci diri, anti-eskalasi, act-as lembaga, `UsersImport` | — | — | Peran `kasir` **tidak pernah dibuat** (dihapus v2.38); peran `asrama` masih rancangan |
| **004 Referensi & Master** | 34 tabel kamus per lembaga (fan-out), `RefService` ber-cache, CRUD Lembaga/Kelas/TA, visibilitas TA per lembaga | — | — | `kedudukan`/`asrama` versi lama tidak dipakai |
| **Dashboard ringkas** | `GET /api/dashboard/ringkasan`: blok lembaga, santri, pegawai, keuangan, siklus, PSB; tiap blok digerbangi izin modulnya | — | Statistik pimpinan (504) | Bukan executive dashboard |

### 1.2 PSB & Santri

| Modul | Sudah | Sedang | Akan | Catatan |
|---|---|---|---|---|
| **100 PSB** | Master kegiatan → gelombang (anti-tumpang) → kuota per lembaga; 2 jalur (`membutuhkan_seleksi`); pendaftaran publik + captcha dilewati; verifikasi/seleksi/daftar ulang/ACC/undur diri; bulk semua tahap; import; dokumen; promosi ke santri | — | — | Jalur publik dibatasi throttle per endpoint |
| **101 Santri** | CRUD + `SantriPolicy`, import satu pintu, kamus, kolom NIS, samakan NIS, foto, dokumen per santri | — | — | — |
| **102 Siklus** | Salin genap, naik kelas (massal & otomatis), pindah kelas, mutasi keluar + arsip, lulus/batal, roster + arsip, MI-MD, beku kelas, `berhenti-jenjang` | — | — | Alumni `kelas_lulus_id` live (v2.52) |

### 1.3 Kepegawaian & Kurikulum

| Modul | Sudah | Sedang | Akan | Catatan |
|---|---|---|---|---|
| **200 Pegawai** | Master `pegawai` global (+11 kolom EMIS), multi-lembaga via `keaktifan_pegawai`, `tugas_utama`, sertifikasi (auto-sync), keluarga, dokumen, penautan akun manual, `setWalas` 3 lapis | — | — | D3: master global + scope per penempatan |
| **201 Kurikulum & Mapel** | 3 halaman: Mata Pelajaran (KKM + urutan + kamus `ref_mapel`), Pengampu (kelas × mapel → guru), Jadwal Pelajaran (slot per jenjang + matriks hari × slot, anti-bentrok kelas & guru), template jadwal, hari libur | — | Jadwal **per guru**; cetak/unduh jadwal per kelas; salin mapel antar-TA; halaman Pengampu belum punya tes komponen | Tabel `kurikulum*` **dihapus v2.413**; daftar mapel kelas = baris `pengampu_mapel` itu sendiri |

### 1.4 Penilaian

| Modul | Sudah | Sedang | Akan | Catatan |
|---|---|---|---|---|
| **202 Penilaian** | Nilai terikat **peristiwa** (bukan semester): CRUD peristiwa + "Muat bawaan" 5 peristiwa (PTS/ASAS/ASAT/UJIAN/UAP) + `jenis_rapor`; komponen & bobot 3 sumber (manual / rapor N tingkat / peristiwa lain); KKM; predikat; ekskul; prestasi; hitung ulang; leger crosstab per peristiwa + unduh Excel; rapor + pratinjau cetak; cek kelengkapan per kelas; impor 4 template | — | Kunci semester + jejak cetak; cetak massal satu klik; absensi otomatis dari `presensi_santri`; unduh "data existing" di dialog impor; snapshot penanda tangan; bobot UJIAN bawaan masih placeholder; salin peristiwa antar-TA | 4 halaman: Master, Impor, Leger, Rapor. PTS = rapor sementara; UJIAN/UAP tidak berapor. Prasyarat mapel & pengampu **sudah terpenuhi** |

### 1.5 Keuangan

| Modul | Sudah | Sedang | Akan | Catatan |
|---|---|---|---|---|
| **Keuangan (G2)** | Master jenis tagihan + tarif per lembaga/TA; generate tagihan (satu layar, invarian anti-duplikat, dispensasi otomatis, kuota per bulan); kasir/harian; kwitansi cetak + cetak ulang; crosstab tagihan; dispensasi (CRUD + rekap kuota); grup custom; batal/hapus transaksi; dasbor ringkas | — | **13 butir lanjutan** — rincian & urusan teknis di §3.1 | 13 fitur lanjutan **belum ada kodenya**. Fondasi **sudah**; kwitansi cetak & dasbor dasar **sudah** (v2.422/v2.423) |

### 1.6 Portal & Klien

| Modul | Sudah | Sedang | Akan | Catatan |
|---|---|---|---|---|
| **203 Portal Wali** | Jalur PSB lanjutan (lengkapi, ajukan daftar ulang, riwayat), riwayat keluarga, pengajuan biodata (1 aktif/santri, bisa dibatalkan); `wali_santri_relasi` + `wali_portal_logs` | — | Dashboard portal + ringkasan tagihan; **aktor santri** (belum ada rute portal untuk santri) | Rute portal hanya `role:orang_tua`. Agregator baca-saja belum ada — `/api/dashboard/ringkasan` bukan rute portal |
| **Klien `admin-desktop-tauri`** | 48 halaman, 10 grup nav (Beranda, Data Induk, PSB, Santri, PTK, Dokumen, Keuangan, Penilaian, Kurikulum, Pengaturan), 2 mode (lembaga/pesantren), 123 file tes | — | Jalur peran **guru** (default izin `[]`) | **Keputusan terkunci:** klien ini untuk `super_admin` + `admin` lembaga **saja**. Guru/orang_tua/santri **tidak** memakai klien ini |
| **4 klien mobile** | — | — | `kasir-mobile`, `orangtua-mobile`, `pimpinan-mobile`, `guru-mobile` — belum di-scaffold | Kasir = **halaman desktop**, bukan aplikasi terpisah |

### 1.7 Pasca production

| Modul | Sudah | Sedang | Akan | Catatan |
|---|---|---|---|---|
| **500 Presensi Santri** | Tabel ada (`sesi_presensi`, `presensi_santri`, `pelanggaran_santri`) | — | UI presensi + UI pelanggaran | `presensi_santri.kelas_id` masih NOT NULL — perlu penyesuaian skema sebelum dipakai untuk kegiatan non-kelas |
| **501 Presensi Pegawai** | Tabel `presensi_pegawai` ada | — | UI absensi guru | — |
| **502 Jadwal Pelajaran** | **Sudah** — masuk modul 201 (slot jam, jadwal per kelas, anti-bentrok) | — | — | Tidak lagi dihitung sebagai "pasca" |
| **503 Tahfizh** | Tabel ada (`target_tahfiz`, `setoran_tahfiz`, `rekap_tahfiz_santri`) | — | UI tahfizh | — |
| **504 Statistik Pimpinan** | — | — | Dashboard eksekutif pimpinan | Ringkas, bukan `/api/dashboard/ringkasan` |
| **505 Asrama** | — | **Ditunda** | — | **Hanya digambar.** Tabel/peran/pivot belum dibuat; pasca production, tidak dikerjakan dalam waktu dekat. Yang dijaga: peran baru cukup ditambah saat itu |
| **900/901 Deploy** | — | — | VPS deploy + konfigurasi production | — |

---

## 2. Sedang dikerjakan

> Bagian ini **wajib** sinkron dengan kenyataan. Bila kosong, artinya tidak ada
> pekerjaan berjalan.

**Kosong.** Belum ada modul yang disetujui sebagai pekerjaan berjalan. Kandidat
berikutnya ada di §3.1 (**4. Rekap per kas** + **12. Ekspor laporan**).

---

## 3. Rincian teknis butir sisa

Format tiap butir: **nama** — apa yang dibuat (backend: endpoint/tabel/service;
frontend: halaman/komponen), lalu syarat atau keputusan yang masih menggantung.

### 3.1 Keuangan — 13 butir lanjutan

Urutan lama yang tercatat di PRD (kwitansi → tutup buku → penomoran) **sudah
tidak akurat** karena kwitansi selesai. Urutan yang diusulkan sekarang:
**4 → 1 → 7 → 5/11 → 6 → 8 → 9 → 10 → 2 → 13 → 12**.

| # | Butir | Status | Rincian teknis |
|---|---|---|---|
| **3** | Cetak/ulang kwitansi | **Sudah** (v2.423) | `KwitansiCetak.tsx`; tombol dari dialog bayar + tabel harian; 1 halaman berkop; unduh = dialog cetak → Simpan sebagai PDF |
| **13** | Dasbor ringkasan | **Sebagian** | Sudah: total tagihan/terbayar/tunggakan + komposisi lunas/belum/sebagian. Belum: **tren penerimaan bulanan**, rincian per TA |
| **4** | Rekap per kas | **Akan** | **BE:** endpoint agregasi baru (mis. `GET /keuangan/rekap-kas`) menjumlah `transaksi_pembayaran` per kolom `kas` (`tunai_tu`/`bank_lembaga`/`bank_pesantren`) per tanggal atau periode + scope jenjang. Belum ada endpoint apa pun untuk ini — yang ada hanya `pembayaran/harian`, `transaksi`, `tagihan/crosstab`, `dispensasi/rekap`. **FE:** tab/halaman rekap + tabel per posisi kas. Izin: pakai `keuangan.lihat` |
| **1** | Laporan tunggakan (aging) | **Akan** | **BE:** agregasi umur piutang 30/60/90+ dari `jatuh_tempo` per santri/kelas/lembaga. **FE:** halaman aging + dasar surat tagihan. Baca-saja, tidak menyentuh aturan tulis |
| **7** | Penomoran kwitansi runut | **Akan** | **Butuh keputusan format dulu** (mis. `KW-MI-2026-000123`): runut per lembaga/kas per tahun. **BE:** kolom nomor + penghasil urut (tabel counter atau `MAX+1` dengan penguncian); ganti hex acak. **FE:** tampilkan nomor di kwitansi/tabel |
| **5** | Mutasi kas harian | **Akan** | Arus masuk per kas per hari + selisih kas tercatat vs terhitung. **BE:** agregasi harian per kas (bisa satu endpoint dengan #4, beda pengelompokan) |
| **11** | Tutup buku harian | **Akan** | **Menyentuh aturan tulis.** **BE:** tabel tanggal terkunci + penolakan tambah/batal/hapus bertanggal ≤ tanggal kunci; perlu jalur buka-kunci beralasan. **FE:** dialog tutup/buka buku |
| **6** | Jejak audit | **Akan** | **BE:** tabel log baru (siapa mencatat/membatalkan/menghapus + alasan wajib). Kini hanya `diterima_oleh` pembuat. Menyentuh hampir semua aksi keuangan |
| **8** | Maker-checker pembatalan | **Akan** | Pencatat ≠ penyetuju batal/hapus. Butuh #6 lebih dulu karena bergantung pada log/alasan |
| **9** | Kartu piutang per santri | **Akan** | Seluruh tagihan + pembayaran + sisa lintas TA dalam satu keluaran; bisa jadi surat tagihan resmi (menjawab tunggakan alumni) |
| **10** | Split payment | **Akan** | Satu kwitansi boleh gabungan metode/kas. **BE:** rincian sub-bayar di `transaksi_pembayaran` — perubahan bentuk data |
| **2** | Pengingat tunggakan | **Akan** | Penanda di crosstab + pengingat berkala. WhatsApp menyusul (modul notifikasi G8); hari ini hanya penanda visual yang bisa dikerjakan |
| **12** | Ekspor laporan | **Akan** | Excel/PDF untuk crosstab, transaksi harian, rekap per jenis, tunggakan. **Pakai ulang pola `unduhLeger`** (`maatwebsite/excel` sudah terpasang). Tidak ada dependensi baru |

### 3.2 Penilaian — butir sisa

| Butir | Status | Rincian teknis |
|---|---|---|
| Kunci semester + jejak cetak | **Akan** | BE: kunci impor/edit setelah batch rapor pertama dicetak + log cetak (siapa, kapan, berapa santri, parameter peringkat); buka-kunci tercatat alasannya |
| Cetak massal satu klik | **Akan** | FE: pilih kelas → pratinjau → cetak semua; parameter peringkat sekali per batch (sudah ada opsinya) |
| Absensi otomatis dari presensi | **Akan** | BE: hitung ketidakhadiran dari `sesi_presensi`/`presensi_santri`; kolom leger sakit/izin/alpa jadi override bila presensi kosong |
| Unduh "data existing" di dialog impor | **Akan** | FE: tombol unduh data yang sudah ada — pola `data-existing` sudah dipakai modul lain |
| Snapshot penanda tangan | **Akan** | BE: bekukan nama + gelar wali/kepala saat batch pertama dicetak agar cetak ulang identik |
| Bobot UJIAN bawaan | **Akan** | Masih placeholder (UM 60 / Rata-rata Rapor 40) — menunggu kebijakan pesantren |
| Salin peristiwa antar-TA | **Akan** | Kini tiap TA dibuat ulang atau klik "Muat bawaan" |

### 3.3 Kurikulum — butir sisa

| Butir | Status | Rincian teknis |
|---|---|---|
| Jadwal per guru | **Akan** | FE: tampilan jadwal dari sudut guru (kini hanya per kelas) |
| Cetak/unduh jadwal per kelas | **Akan** | FE: keluaran cetak/Excel |
| Salin mapel antar-TA | **Akan** | FE: kelas tingkat atas ← kelas tingkat bawah |
| Tes endpoint tersisa | **Akan** | `kurikulum/slot` CRUD penuh, `guruAktif`, `indexMapel` filter |
| Tes komponen halaman Pengampu | **Akan** | `KurikulumPengampuPage` belum punya tes |

### 3.4 Portal & klien — butir sisa

| Butir | Status | Rincian teknis |
|---|---|---|
| Dashboard portal wali | **Akan** | BE: agregator baca-saja (rute `portal/*`, `role:orang_tua`) |
| Ringkasan tagihan di portal | **Akan** | BE: tagihan milik anak dari akun wali |
| Aktor santri | **Akan** | Belum ada rute portal untuk santri; peran `santri` ada tetapi tanpa portal |
| 4 aplikasi mobile | **Akan** | `kasir-mobile`, `orangtua-mobile`, `pimpinan-mobile`, `guru-mobile` |

### 3.5 Keputusan offline

Lampiran F `operasi.md` (OFF-01…OFF-09) berstatus **keputusan desain — belum
diimplementasikan**. Bila modul offline mulai dikerjakan, pindahkan butirnya ke
peta ini dan tandai **Sedang**.

---

## 4. Peta izin & peran (ringkas)

Sumber kanonis: `backend/app/Services/IzinKatalog.php`. Baris matriks Kelola
Izin, validasi API, dan audit FE semuanya diturunkan dari file itu.

- **Peran efektif (5):** `super_admin`, `admin`, `guru`, `orang_tua`, `santri`.
  Peran `kasir` dihapus v2.38; peran `asrama` masih rancangan (505).
- **Izin = aksi**, bukan cakupan data. Cakupan lembaga diatur pivot
  `user_lembaga` + header `X-Lembaga-Aktif` (`lembaga_aktif`).
- **Admin lembaga** = semua izin **kecuali** `EKSKLUSIF_SUPER_ADMIN` (17 nama:
  lembaga.tambah, server.lihat, izin.*, preset_tabel.*, semester.aktivasi,
  urut_preset.*, toolbar_preset.*, pengaturan_halaman.*).
- **Guru** = **default izin kosong** (`[]`). Klien desktop menolak peran guru —
  itu keputusan, bukan celah.

---

## 5. Rujukan

| Butuh apa | Ke mana |
|---|---|
| Daftar tabel & kolom | [SCHEMA.md](SCHEMA.md) |
| Endpoint, service, aturan per modul | [backend-detail.md](backend-detail.md) |
| Rancangan produk & alur bisnis | [PRD.md](PRD.md) |
| Arsitektur, peran, matriks izin, UI | [arsitektur.md](arsitektur.md) |
| Uji, penyebaran, pelatihan, TBD | [operasi.md](operasi.md) |
| Riwayat perubahan (append-only) | [CHANGELOG.md](CHANGELOG.md) |
