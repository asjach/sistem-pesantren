# Desain: Perbaikan alur Tambah Tagihan (generate tagihan)

Dokumen ini hasil wawancara terstruktur (`grill-with-ui`) tentang perbaikan alur
dialog **Buat Tagihan**. Semua keputusan di bawah sudah disepakati; dokumen ini
cukup untuk dikerjakan tanpa akses ke sesi wawancaranya.

Ringkasnya: dialog tiga langkah disatukan menjadi **satu layar**, karena akar
keluhannya bukan sekadar jumlah klik melainkan **urutan pertanyaan yang memaksa
tabel santri menunggu**. Panel konfirmasi dipertahankan tapi diringkas.

## Terms

Istilah yang dipakai konsisten di dokumen ini; kata di kolom "Hindari" jangan
dipakai untuk maksud yang sama.

| Istilah | Arti | Hindari |
| --- | --- | --- |
| **Kelompok** | Penyaring populasi santri di layar Daftar (Semua, MI, MD, Custom) | grup, filter santri |
| **Dilewati** | Baris tidak dibuat/diubah: sudah dibayar, atau nominal baru < terbayar | gagal, error, skip |
| **Tetap** | Tagihan sudah ada & nominalnya sama, jadi tidak ditulis ulang | sama, tidak berubah |
| **Manual** | Nominal diketik ulang; dispensasi **tidak** diterapkan | override, custom |
| **Frontier** | Pertanyaan yang prasyaratnya sudah selesai, boleh ditanyakan sekarang | batch, gelombang |

## Why

Masalah yang dilaporkan pengguna, dalam kalimatnya sendiri: **"terlalu banyak
langkah/klik"** pada alur Tambah Tagihan (Q1 → A). Pengguna memilih ini, bukan
opsi "kriteria membingungkan" — jadi keluhannya soal **jumlah langkah**, bukan
soal isi field.

Penyebabnya ditemukan dengan membaca kode, bukan dengan bertanya:

1. `GenerateTagihanDialog.tsx` memakai alur tiga tahap
   (`const TAHAP = ['Kriteria', 'Daftar', 'Hasil']`, baris 164), plus panel
   konfirmasi sebagai tampilan keempat.
2. **Akar masalahnya:** tahap Kriteria menanyakan `Tarif`, `Nominal Default`,
   `Dari Bulan`, `Sampai Bulan`, dan `Jatuh Tempo` — tetapi
   **`Kelompok` baru ditanyakan di tahap Daftar** (baris ~969).
3. Karena `muatSantri` bergantung pada `kelompok`
   (`useCallback` deps baris 493), tabel santri **tidak bisa mulai dimuat**
   sampai pengguna menekan "Lanjut". Ditambah debounce 250 ms, biayanya bukan
   satu klik ekstra melainkan **satu putaran tunggu server yang bisa dihindari**.
4. Dua sumber kebisingan tambahan: `Nominal Default` selalu terisi otomatis
   begitu Tarif dipilih (`pilihTarif`, baris 507-515) tetapi tetap tampil
   sebagai field wajib; dan `Jatuh Tempo` **dimatikan** untuk jenis bulanan
   (baris 917) sehingga hanya memakan ruang dan perhatian.

## Locked decisions

Keputusan yang sulit dibalik, mengejutkan tanpa konteks, dan punya trade-off
nyata.

### 1. Boleh menyentuh backend, tetapi tetap dihindari (Q2 → C)

Pengguna memberi izin perubahan sampai ke controller/validasi backend. **Namun
keputusan kerja ini: perbaikan tidak menyentuh backend kecuali menemukan bug.**

- **Yang ditolak:**
  - **A (kosmetik saja)** — ditolak karena keluhan "terlalu banyak langkah"
    tidak bisa diselesaikan dengan mengganti label. Menghapus satu layar
    mengubah struktur, bukan teks.
  - **B (boleh ubah alur, jangan sentuh API)** — sebenarnya paling dekat dengan
    hasil akhir, tetapi ditolak sebagai *batasan* karena pengguna ingin bebas
    bila ternyata perlu.
- **Konsekuensi yang harus dijaga:** `TagihanController::generateTagihan`
  (baris 642) punya logika dispensasi/kuota yang rawan: alokasi kuota per grup,
  aturan "menempel menang" (`grupMenempel`), failover kuota, dan
  `hitungBarisDispensasi`. Percabangan ini mudah rusak tanpa terlihat. Karena
  itu backend tidak disentuh tanpa alasan konkret.

### 2. Gabung menjadi satu layar (Q4 → A)

Tahap **Kriteria** dan **Daftar** disatukan: filter/kriteria di atas, tabel
santri langsung di bawahnya, **tanpa tombol "Lanjut"**.

- **Yang ditolak:**
  - **B (tetap 2 langkah, pindahkan Kelompok ke Kriteria)** — tidak dipilih
    karena masih menyisakan satu tombol yang tidak menambah informasi apa pun.
    Ini perbaikan setengah jalan.
  - **C (pangkas field saja)** — tidak menyentuh akar masalah; tabel tetap
    menunggu.
  - **D (hapus panel konfirmasi)** — berbahaya bila diambil sendirian, karena
    itu satu-satunya pengaman sebelum menulis ratusan baris ke database.
- **Kelemahan yang diterima sadar:** satu layar berarti form dan tabel berbagi
  ruang vertikal, sehingga di layar pendek tabelnya bisa terasa sempit.
- **Yang harus dijaga saat mengerjakan:** karena `Kelompok` dan `Tarif`
  kini berada di layar yang sama, pratinjau/daftar dapat dimuat lebih awal.
  Ketergantungan `muatSantri` pada `kelompok` **tidak berubah** — yang
  berubah hanya tempat menanyakannya.

### 3. Panel konfirmasi diringkas, bukan dihapus (Q7 → B)

Konfirmasi menjadi **satu paragraf + tombol**, tanpa rekap tabel
(tarif/periode/santri/estimasi).

- **Yang ditolak:**
  - **A (pertahankan apa adanya)** — rekapnya mubazir: footer layar tunggal
    **sudah** menampilkan `{terpilih.length} santri × {jumlahPeriode} bulan =
    {ringkasan.baris} tagihan · estimasi Rp {ringkasan.total}` (baris ~1097).
  - **C (hapus sama sekali)** — ditolak karena pengguna memilih backend boleh
    disentuh (Q2 → C), artinya kesalahan di sini berdampak **data**, bukan
    sekadar tampilan. Satu kali generate salah populasi jauh lebih mahal
    daripada satu klik.
- **Alasan:** simpan pengamannya, buang pengulangan angkanya.

## Routine choices

- **Q1 → A: keluhan utamanya adalah jumlah langkah/klik.** Ini berbeda dari
  rekomendasi agen (B: kriteria membingungkan); jawaban pengguna yang dipakai.
- **Q3 → A: agen boleh memakai browser** untuk memeriksa tampilan
  (Chrome DevTools Protocol). Server dev boleh dinyalakan tanpa konfirmasi:
  `php artisan serve` (127.0.0.1:8000) dan `npm run dev` (localhost:1420).
- **Q5 → A: rapikan jalur fokus keyboard DAN pangkas langkah.** Keduanya
  dikerjakan; merapikan fokus nyaris tanpa risiko.
- **Q6 → A: tombol Generate selalu tampil, mati sampai ada minimal 1 santri,
  dengan alasan singkat di sebelahnya.** Ini mempertahankan pola yang sudah ada
  (`disabled={busy || terpilih.length === 0}`, baris ~1104). Ditolak: tombol
  muncul-hilang (membuat tata letak bergeser saat daftar termuat) dan tombol
  aktif-yang-menampilkan-galat (menyerahkan pekerjaan ke pesan galat).

## Verified facts

Ditetapkan dengan membaca kode, bukan dengan bertanya:

- `GenerateTagihanDialog.tsx` = **1127 baris**; `TAHAP` didefinisikan di
  baris 164; `muatSantri` di baris 463-493; `pilihTarif` di baris 507-515;
  `FIELDS_TERPILIH` di baris 84-101; `ringkasan` (`{ total, baris }`) di
  baris 653-668.
- Backend: `TagihanController::generateTagihan` baris 642; pratinjau di baris
  832-an. Rute: `POST keuangan/tagihan/generate` (permission
  `keuangan.tambah`, `routes/api.php:102`), `POST keuangan/tagihan/pratinjau`
  (baris 105), `GET keuangan/tagihan/kandidat` (baris 106).
- Semantik backend yang **tidak boleh** berubah: generate tidak pernah membuat
  duplikat; tagihan bulanan yang sudah dibayar **dilewati**; non-bulanan
  dilewati bila nominal baru < terbayar; dispensasi aktif otomatis tiap
  generate (**hanya paket yang penerimanya memuat santri itu dan lingkup
  `dispensasi.jenjang`-nya cocok** dengan jenjang tagihan — null = semua
  lembaga; aturan lingkup yang sama juga berlaku saat paket dipilih manual di
  tab Ubah: dropdown hanya menawarkan paket selembaga + paket tanpa lingkup,
  dan `updateTagihan` menolak paket lembaga lain dengan 422, jadi hasilnya tak
  bisa berbeda dari generate); kuota dialokasikan ke N bulan pertama per santri; se-grup tak
  menumpuk ("menempel menang"); **generate tak pernah menambah penerima**.
- Test yang menyentuh area ini: `generateTagihanDialog.test.tsx`,
  `KeuanganPage.test.tsx`.
- Element id yang dipakai test (jangan diubah sembarangan):
  `sel_gen_tarif`, `inp_gen_nominal`, `inp_gen_dari`, `inp_gen_sampai`,
  `inp_gen_jatuh_tempo`, `sel_gen_kelompok`, `inp_gen_cari`,
  `sel_gen_status`, `sel_gen_urut`, `btn_gen_lanjut`*, `btn_gen_generate`,
  `btn_gen_ya`, `btn_gen_kembali`, `btn_gen_batal`, `btn_gen_periksa`,
  `btn_gen_tutup`, `btn_gen_otomatis_<id>`, `btn_gen_hapus_<id>`,
  `ringkas_galat_gen`, `ringkas_galat_daftar`, `judul_kriteria_gen`,
  `judul_daftar_gen`, `judul_hasil_gen`, `judul_konfirmasi_gen`.
  (*`btn_gen_lanjut` menjadi tidak terpakai bila satu layar diterapkan.)

## Risks

1. **Test lama akan pecah.** `generateTagihanDialog.test.tsx` dan
   `KeuanganPage.test.tsx` mengasumsikan keberadaan tombol "Lanjut" dan
   pemisahan dua tahap. Menghapus "Lanjut" mengharuskan test itu diperbarui —
   dan aturan repo mewajibkan test hanya untuk perubahan **logika**, sehingga
   pembaruan yang sah adalah pada alur/state, bukan sekadar tata letak.
2. **Regresi pada pemuatan daftar.** Menggabungkan layar berarti
   `muatSantri` dapat terpicu lebih awal (sebelum `Kelompok` dipilih).
   Penjaga yang ada sekarang, `if (kelompok === '') { setTerpilih([]); return; }`
   (baris 466), **harus dipertahankan** agar tidak terjadi request sia-sia.
3. **Pratinjau berkedip.** `useEffect` pratinjau memakai debounce 300 ms dan
   sengaja membiarkan nilai lama tampil sampai jawaban baru datang. Menambah
   field di layar yang sama menambah pemicu; `sigAuto` (himpunan santri) harus
   tetap menjadi satu-satunya penanda muat ulang.
4. **Ruang vertikal.** Kelemahan yang sudah diterima pada keputusan 2: di layar
   pendek tabel bisa terasa sempit.
5. **`Jatuh Tempo` non-bulanan.** Untuk jenis non-bulanan, jatuh tempo boleh
   dikosongkan yang berarti "langsung tunggakan". Menyembunyikannya di balik
   pengaturan lanjutan berisiko membuat opsi ini tidak ditemukan.

## Deferred

- **Pratinjau/regenerate visual** — tidak diminta; visual belum dibuat.
- **Perubahan backend** — ditunda meski diizinkan (Q2 → C). Dibuka kembali bila
  ditemukan bug konkret saat pengerjaan, mis. nominal manual yang tidak
  konsisten dengan `hitungBarisDispensasi`.
- **`Jatuh Tempo` untuk jenis bulanan** yang sekarang dimatikan: apakah lebih
  baik disembunyikan sepenuhnya atau tetap tampil menjelaskan "otomatis tanggal
  10". Akan dibuka kembali bila saat mengerjakan terasa mengganggu.
- **Kelompok "Custom"** — belum dibahas apa isinya.

## Open threads

- Diskusi soal **deteksi otomatis kiriman**: halaman menolak kiriman kedua
  selama kiriman sebelumnya belum diakui (aturan "one event in flight at a
  time", `page.html:275-281`, tenggang 5 menit). Sempat memblokir pengguna
  karena `agent.handled` tidak naik. **Bukan** bagian dari desain dialog;
  dicatat di sini hanya sebagai catatan operasional.
