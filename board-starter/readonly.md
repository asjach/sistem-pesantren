# Setup Board lokal dan memulai project

Paket ini menyediakan Board lokal minimal: Node.js, HTML/CSS/JavaScript biasa,
dan SQLite bawaan Node.js. Tanpa dependency npm, proses build, atau framework.
UI minimalis memakai dark mode; semua asset disajikan lokal sehingga Board
dapat berjalan offline. Aturan Luffy dan kru netral terhadap model serta harness;
aktivitas AI mengikuti akses dan kemampuan lingkungan yang dipilih pengguna.

## 1. Menyalin paket

Salin isi paket, termasuk `.gitignore`, ke root project tujuan. Jika project
sudah memiliki instruksi atau file bernama sama, gabungkan dengan sadar; jangan
menimpanya. Board dan aturan inti tidak membutuhkan folder konfigurasi khusus
harness. Folder `adapters/` hanya contoh opsional; jangan memasang konfigurasinya
otomatis. Paket tidak membawa data Board SIMPES, akun, atau kode aplikasi SIMPES.

```text
project-baru/
├── AGENTS.md                 ← instruksi discovery dan workflow
├── FLOW.md                   ← aturan data dan akses API/CLI
├── KRU.md                    ← profil Luffy dan sembilan spesialis
├── HARNESS.md                ← pemuatan instruksi, kemampuan, dan fallback
├── readonly.md               ← panduan ini
├── server.mjs                ← server lokal dan penyimpanan Board
├── store.mjs                 ← validasi workflow dan transaksi SQLite
├── cli.mjs                   ← akses Board bagi agen
├── public/                   ← halaman Board
├── adapters/                ← konfigurasi harness opsional, bukan syarat runtime
├── .gitignore
├── data/board.sqlite         ← dibuat saat server pertama berjalan
└── .local/access.json        ← akses CLI, dibuat saat server berjalan
```

`BRIEF.md` dibuat kemudian dari hasil discovery yang Anda konfirmasi. Runtime
Board terpisah dari stack software yang nantinya Anda bangun maupun model AI
yang Anda gunakan. Runtime Board tetap memerlukan Node.js; agnostik terhadap
model/harness tidak berarti runtime dan semua tool otomatis tersedia.

## 2. Menjalankan sampai halaman Board tampil

Pasang **Node.js 24.15 atau lebih baru** dengan modul bawaan `node:sqlite`.
Gunakan rilis Node.js yang masih didukung. Perintah ini sama di terminal macOS,
PowerShell/Command Prompt Windows, dan Linux:

```bash
node --version
node server.mjs
```

Jalankan perintah dari folder paket yang sudah disalin. Buka alamat yang
ditampilkan server, default:

```text
http://127.0.0.1:4310/board
```

Alamat `/` juga membuka halaman Board. Biarkan terminal server berjalan selama
Anda atau agen menggunakan Board; hentikan dengan `Ctrl+C`. Untuk membuka
kembali, jalankan perintah yang sama. Tidak perlu `npm install`.

Server hanya mendengarkan `127.0.0.1`. Ini tool untuk satu komputer, bukan
layanan internet atau kolaborasi antar-komputer. Browser tidak memerlukan akun
Board tersendiri. Server memberi browser sesi lokal dan proteksi request write;
CLI memakai token lokal yang berbeda. Jangan membagikan `.local/access.json`.

### Mengubah port atau lokasi data

```bash
node server.mjs --port 4311
node server.mjs --data ./data-eksperimen/board.sqlite
```

Path data relatif dihitung dari lokasi `server.mjs`, bukan tergantung folder
terminal. Default database adalah `data/board.sqlite` di dalam paket. Jalankan
satu server untuk satu database. CLI mengakses instance yang terakhir tercatat
di `.local/access.json`; jangan menjalankan beberapa instance dari salinan
paket yang sama bersamaan. Gunakan salinan folder terpisah untuk project lain.

## 3. Menggunakan halaman Board

1. Periksa area kerja, modul, dan submodul; sesuaikan namanya dengan project.
2. Master workflow dan workflow area kerja awalnya Draf. Aktifkan keduanya
   sendiri ketika Anda siap menjadikan Board sumber workflow.
3. Minta Luffy menyusun Backlog dari brief yang disepakati, atau tambahkan poin
   melalui halaman Board. Poin baru selalu masuk Backlog.
4. Pilih pekerjaan dengan memindahkan poin ke To Do melalui kontrol status.
5. Minta Luffy merisetnya. Setujui scope/subpoin sebelum pengerjaan dimulai.
6. Luffy mencatat persetujuan dan memindahkan poin ke In Progress. Maksimal satu
   poin In Progress per area kerja.
7. Setelah implementasi dan verifikasi, Luffy memindahkan poin ke For Review.
   Anda mencoba hasilnya, menerima ke Done atau meminta revisi dalam poin sama.

Detail poin memuat requirement, checklist, dan catatan. Requirement menjadi
subpoin setelah riset dan persetujuan, lalu dikosongkan agar tidak diproses ulang.
Catatan tersimpan pada detail poin; riwayat menyimpan perpindahan status dan
perubahan workflow. Checklist lengkap tidak otomatis Done.
Perubahan status memakai kontrol eksplisit, tanpa ketergantungan drag-and-drop.

## 4. Memulai discovery bersama Luffy

Buka root project tujuan sebagai workspace agen. Jalankan server, kemudian
kirim prompt berikut, dengan mengganti contoh gagasan sesuai kebutuhan Anda:

```text
Hay Luffy, kita buat aplikasi Pengelolaan Password khusus untuk komputer saya.
Baca AGENTS.md, FLOW.md, KRU.md, HARNESS.md, dan readonly.md yang saya sediakan.
Gunakan model yang saya pilih dan periksa kemampuan harness yang tersedia.
Mulai dari discovery karena spesifikasinya belum ada. Pakai opsi interaktif
jika tersedia; ajukan pertanyaan bertahap dan beri rekomendasi. Jangan mengulang
informasi yang sudah diberikan. Jika tidak ada sub-agent, gunakan role berurutan
dan nyatakan bahwa itu pemeriksaan mandiri, bukan review independen.

Tampilkan brief dan fondasi teknis untuk saya konfirmasi, lalu simpan yang
disepakati sebagai BRIEF.md. Sepakati versi pertama yang kecil tetapi berguna.
Board sudah tersedia dalam paket ini; bantu jalankan bila belum berjalan,
pandu saya menyesuaikan struktur kosong melalui UI, dan biarkan workflow Draf
sampai saya aktifkan.
Setelah Aktif, turunkan hasil yang diperlukan menjadi Backlog. Saya akan memilih
To Do dan menyetujui scope tiap poin sebelum implementasi.
```

Menyalin paket atau membuka Board tidak otomatis menjalankan AI. Discovery
dimulai ketika Anda mengirim pesan pada agen. Untuk melanjutkan sesi, minta
“Luffy, baca brief dan Board, lanjutkan pekerjaan yang sudah saya setujui”.
Jika harness tidak otomatis memuat `AGENTS.md`, gunakan mekanisme instruksi
project/prompt yang didukung. Jika agen tidak mempunyai akses file, berikan
isinya melalui unggahan atau percakapan; path saja tidak memberi akses.

Pertanyaan menyesuaikan project: untuk software meliputi tujuan, pengguna,
alur, fitur, platform, data/izin, online/offline, integrasi, deployment, batas
biaya, dan penerimaan. Untuk riset, buku, atau laporan, gunakan tujuan, sumber,
metode/struktur, pembaca/penerima, format, dan standar bukti yang relevan.
Tidak perlu menjawab seluruh kemungkinan pertanyaan sekaligus.

## 5. Memakai kru pada model dan harness pilihan Anda

`AGENTS.md` memberi aturan bersama dan identitas coordinator Luffy; `KRU.md`
adalah profil role yang netral. Tidak ada model, provider, API key, atau format
tool tertentu yang diwajibkan. Role dapat dijalankan model yang sama atau berbeda
sesuai pilihan pengguna dan kemampuan harness.

Luffy memilih mode sesuai kemampuan nyata: sub-agent paralel untuk tugas
independen, sub-agent berurutan bila concurrency terbatas, atau satu agen
berganti perspektif role bila delegasi tidak tersedia. Target 2–3 sub-agent
tunduk pada batas lingkungan. Pemeriksaan oleh satu agen tidak boleh diklaim
sebagai review oleh agen terpisah. Detail fallback ada di `HARNESS.md`.

Jika harness memakai format profil native, petakan role dari `KRU.md` ke format
yang didukung. Contoh opsional khusus Codex ada di `adapters/codex/README.md`.
Folder konfigurasi khusus itu tidak otomatis dipasang saat menyalin paket.
Anda dapat memakai aturan Markdown tanpa memasang adapter apa pun.

Board menyimpan scope, persetujuan, revisi, dan hasil; Board tidak mengeksekusi
AI atau menampilkan percakapan kru live. Luffy satu-satunya penulis Board dari
tim. Akses dan biaya AI mengikuti layanan yang dipilih, bukan nama karakter.

## 6. Akses agen dan troubleshooting

Saat server berjalan, dari root paket:

```bash
node cli.mjs baca
node cli.mjs riwayat
```

CLI membaca alamat dan token otomatis; jangan menyalin token ke chat atau
commit. Operasi write beserta contoh JSON ada di `FLOW.md`. Agen harus membaca
ulang setelah write dan menggunakan API/CLI, bukan mengedit database langsung.
CLI hanya perlu kemampuan menjalankan Node.js, tanpa SDK atau plugin AI.
Jika harness hanya memiliki akses HTTP, kontrak API yang sama dapat digunakan
melalui akses agen yang disediakan secara aman oleh lingkungan.

Agen remote/cloud belum tentu dapat mengakses `127.0.0.1` komputer Anda. Jangan
membuka server ke publik untuk mengatasinya secara otomatis. Bila command dan
API tidak tersedia, gunakan pendampingan manual: pengguna menerapkan payload,
kemudian memberikan hasil/readback yang relevan. Gerbang Board tetap berlaku;
jangan memulai perubahan sebelum penyimpanan yang diwajibkan terkonfirmasi.

- **Node terlalu lama / `node:sqlite` tidak ada:** pasang Node.js yang memenuhi
  versi minimum lalu buka kembali terminal.
- **Port digunakan:** pilih `--port` lain dan gunakan alamat yang dicetak server.
- **CLI gagal terhubung:** pastikan server masih berjalan dari paket yang sama.
- **Akses ditolak setelah restart:** baca ulang konfigurasi akses melalui CLI;
  muat ulang halaman browser. Jangan memakai token dari instance lama.
- **Board tetap Draf:** master DAN flag area kerja harus aktif. Agen tidak
  mengaktifkannya atas inisiatif sendiri.

Untuk backup atau memindahkan data, hentikan server dengan `Ctrl+C`, lalu salin
folder paket beserta `data/`. File akses `.local/` dibuat kembali saat startup;
jangan membagikannya. Jangan menyimpan password/kredensial produk sebagai contoh
di brief, Board, test, atau catatan. Database Board berisi metadata pekerjaan,
bukan penyimpanan rahasia aplikasi yang Anda bangun.

Keberhasilan setup ditandai halaman Board dapat dibuka, default Draf, struktur
dapat disunting, data bertahan setelah restart, dan CLI membaca data yang sama.
Kompatibilitas dirancang lintas platform; hasil pengujian pada satu sistem
operasi tidak otomatis membuktikan pengujian native di dua sistem lainnya.

## 7. Menjalankan pengujian

Tidak memerlukan dependency test tambahan:

```bash
node --test tests/board.test.mjs
```

Tes memakai database dan port lokal sementara, bukan data pekerjaan Anda.
Tes mencakup persistence, master/flag, pembatasan aktor, persetujuan dan scope,
checklist, revisi/reopen, revision conflict, urutan, HTTP, Unicode, serta CLI.
Jika sandbox agen melarang membuka port localhost, gunakan mekanisme izin
lingkungan; jangan menganggap kegagalan izin sebagai keberhasilan test.
