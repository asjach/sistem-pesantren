# AGENTS.md — SIMPES

## Aturan kerja

- UI & docs Bahasa Indonesia; `id` elemen snake_case (NFR-05).

## ISTILAH TEKNIS — pakai istilah umum, jangan diterjemahkan

- Istilah teknis ditulis apa adanya dalam bahasa Inggris. Jangan membuat
  padanan Indonesia untuk istilah yang sudah lazim berbahasa Inggris.
- Berlaku untuk: komunikasi agen ke pengguna, komentar kode, nama variabel,
  nama fungsi, dan dokumentasi teknis.
- Contoh yang WAJIB dipakai: `thumb` (bukan jempol), `track` (bukan rel),
  `scrollbar` (bukan bilah gulir), `handle`, `focus ring` (bukan cincin fokus),
  `row`, `column`, `header`, `footer`, `cell`, `grid`, `container`, `toolbar`,
  `input`, `button`, `dropdown`, `overlay`, `hover`, `drag`, `render`.
- Teks yang dibaca pengguna akhir (label tombol, judul kolom, pesan galat,
  placeholder) TETAP Bahasa Indonesia sesuai aturan kerja di atas. Aturan ini
  hanya menyangkut istilah teknis, bukan copy UI.
- Bila ragu: pakai istilah yang muncul di dokumentasi resmi library atau di
  nama prop/API, bukan terjemahan bebas.

## KOORDINASI AGEN — LUFFY DAN KRU

- Agen utama berperan sebagai **Luffy**, coordinator yang bertanggung jawab
  kepada pengguna. Pembagian role software dan batas delegasi ada di
  [docs/KRU.md](docs/KRU.md); aturan pemakaian lintas model/harness dan fallback
  ada di [docs/HARNESS.md](docs/HARNESS.md). Baca keduanya sebelum mendelegasikan.
- Nama kru adalah label tanggung jawab dan gaya komunikasi, bukan identitas
  model, akun baru, izin tambahan, atau alasan mengabaikan aturan project.
  Aturan ini tidak mengharuskan provider, model, subscription, atau tool tertentu.
- **Hanya Luffy yang menulis Board dalam pekerjaan agen.** Sub-agent mengirim
  hasil dan bukti kepada Luffy; pengguna tetap berwenang mengubah Board melalui
  UI. Delegasi tidak mengubah gerbang persetujuan atau batas satu In Progress
  per aplikasi.
- Gunakan sub-agent hanya jika tersedia dan bermanfaat: biasanya 2–3 spesialis
  independen pada scope poin yang sama. Satu file hanya memiliki satu writer
  pada satu waktu. Jika tidak tersedia, gunakan role secara berurutan dalam
  satu agen dan jangan mengaku melakukan independent review.
- Setiap kru membaca instruksi folder dan skill yang berlaku sebelum bertindak.
  Kebijakan tes, anotasi, autentikasi, izin tool, dan suspend native Tauri tetap
  berlaku; delegasi tidak boleh digunakan untuk melewatinya.
- SIMPES adalah project existing: baca PRD, arsitektur, SCHEMA, kode, dan Board
  yang relevan sebelum bertanya. Jangan mengulang discovery dari nol atau
  membuat `BRIEF.md` yang menduplikasi sumber kebutuhan existing. Jangan membuat
  workflow, roadmap, atau status kru terpisah dari Board.

## ANOTASI UI (MODE DEV) — menandai elemen untuk agen

- Saat `npm run dev` (termasuk `tauri dev`), tombol anotasi di area akun
  TopBar (sebelum tombol bantuan) mengaktifkan **mode tandai**. Klik elemen
  mana pun, tulis instruksi, lalu Simpan. Panel daftar anotasi ada di tombol
  sebelahnya dan terbuka di area atas.
- Anotasi ditulis ke `frontend/admin-desktop-tauri/.dev/anotasi.json`
  (di-ignore git) dan memuat rute, selector, teks, komponen React, serta
  `sumber` berupa `src/...:baris`.
- Untuk instruksi dengan tujuan, pilih elemen asal, tulis instruksi, lalu
  klik **Pilih tujuan**. Breadcrumb dapat memilih parent/container. Tentukan
  posisi **Di dalam**, **Sebelum**, atau **Sesudah**, lalu Simpan. Field opsional
  `tujuan` menyimpan konteks elemen tujuan dan `posisi` (`di_dalam`, `sebelum`,
  `sesudah`). Agen wajib membaca asal, tujuan, dan posisi sebagai satu instruksi.
  Esc saat memilih tujuan kembali ke editor tanpa menghapus draft.
- **Detail tampilan** pada asal/tujuan menampilkan computed style browser.
  Nilai dapat disalin atau dimuat ulang. Snapshot `style` (properti CSS → nilai)
  dibaca kembali saat Simpan dan ikut disimpan pada konteks masing-masing elemen.
  Anotasi lama tanpa `style` tetap valid. Snapshot bukan lokasi rule CSS asalnya;
  background transparan tidak otomatis sama dengan background parent.
- **Preview tampilan** dapat mencoba nilai CSS pada asal/tujuan tanpa mengubah
  berkas kode. Pilih properti, isi nilai, lalu **Terapkan preview**. **Reset
  preview** memulihkan style awal. Pergantian elemen memulihkan preview elemen
  sebelumnya; Batal, Simpan berhasil, navigasi halaman, atau layer dilepas
  memulihkan seluruh preview. Simpan gagal mempertahankan preview dan draft.
  Field opsional `preview` berisi `sebelum`, `sesudah` (computed style), dan
  `perubahan` (nilai CSS yang diminta). Agen membaca ketiganya sebagai acuan
  perubahan, bukan menganggap preview sudah mengubah kode produk.
- **Pilih referensi tampilan** membandingkan asal dengan elemen acuan, terpisah
  dari **Pilih tujuan** pemindahan. Referensi mendukung breadcrumb, ganti/hapus,
  serta Esc kembali ke draft. Referensi hanya dibaca; tidak ada penerapan CSS
  otomatis. Perbandingan font, warna/background, border, padding, margin, dan gap
  menampilkan perbedaan lebih dahulu, dengan opsi **Tampilkan semua** dan **Muat
  ulang perbandingan**. Preview aktif ikut terbaca dan diberi penanda.
- Field opsional `referensi` menyimpan konteks dan snapshot style elemen acuan;
  `perbedaan_style` berisi daftar `{properti, asal, referensi}` berdasarkan
  snapshot terbaru saat Simpan. Nilai tidak tersedia adalah `null`, bukan
  disamakan dengan nol atau style parent. Agen wajib membedakan referensi style
  dari `tujuan` pemindahan; keduanya bisa menunjuk elemen yang sama dalam peran
  berbeda. Screenshot tetap hanya mencakup asal dan tujuan, bukan referensi.
- **Ambil screenshot** menyertakan area asal (biru) dan tujuan (jingga) yang
  terlihat, tanpa editor anotasi. Thumbnail bisa diperbesar, diambil ulang,
  atau dibuang. Perubahan pilihan, preview, scroll halaman, atau ukuran window
  memerlukan capture ulang. Gagal capture tidak menghapus draft; anotasi tetap
  bisa disimpan tanpa gambar. Screenshot dengan preview aktif diberi penanda.
- Field opsional `gambar` menyimpan `berkas` relatif terhadap `.dev/`, ukuran,
  waktu capture, dan `preview_aktif`. PNG berada di `.dev/screenshots/<id>.png`
  dan ikut dihapus lewat endpoint saat anotasi dihapus. Agen wajib membuka gambar
  terkait bila tersedia; bila membersihkan anotasi lewat file, hapus PNG terkait
  juga. Jangan commit screenshot. Render DOM bukan screenshot native: konten
  eksternal, canvas, sticky/fixed pada scroll, dan WebView perlu pemeriksaan visual.
- Pintasan `Ctrl/⌘+Shift+A` mengaktifkan atau mematikan mode tandai, termasuk
  saat dialog/modal terbuka. Untuk elemen di dalam dialog, editor instruksi
  ditempatkan di dialog agar tetap bisa difokuskan dan diketik.
- **Saat pengguna menyebut "cek anotasi" atau meminta perubahan atas elemen
  yang ditandai, baca file itu lebih dulu** sebelum menelusuri kode. Pakai
  `sumber`/`komponen` untuk membuka berkas yang tepat, verifikasi dengan kode,
  lalu kerjakan instruksinya.
- Setelah anotasi selesai ditindaklanjuti, hapus entri terkait dari file
  tersebut. Jangan biarkan anotasi selesai menumpuk dan jangan memasukkannya
  ke commit.
- Lapisan ini hanya hidup di dev (`import.meta.env.DEV`); build produksi tidak
  boleh memuatnya.

## SINKRONISASI SKEMA DAN DIAGRAM HUBUNGAN ENTITAS (ERD)

- `docs/SCHEMA.md` adalah sumber utama struktur basis data (database), sedangkan
  `docs/ERD.md` adalah diagram hubungan entitas (Entity Relationship Diagram/ERD)
  turunannya. Jika keduanya berbeda, `SCHEMA.md` yang berlaku.
- **Setiap perubahan pada `docs/SCHEMA.md` WAJIB diikuti pembuatan ulang
  `docs/ERD.md` dalam pekerjaan dan commit yang sama.** Ini mencakup penambahan,
  penghapusan, atau penggantian nama tabel/kolom; perubahan kunci utama (Primary
  Key/PK), kunci asing (Foreign Key/FK), kardinalitas hubungan, serta perubahan
  status tabel dari rancangan menjadi sudah diimplementasikan atau sebaliknya.
- Pembuatan ulang dilakukan dengan menyelaraskan seluruh blok ERD yang terdampak,
  bukan hanya menambahkan hubungan baru. Pertahankan pembagian diagram per bidang
  agar tetap terbaca dan pastikan setiap blok Mermaid memakai `erDiagram`.
- Setelah membuat ulang ERD, wajib periksa bahwa: 1) setiap entitas pada garis
  hubungan didefinisikan dalam blok yang sama; 2) arah dan kardinalitas hubungan
  sesuai `SCHEMA.md`; 3) tabel rancangan diberi penanda belum diimplementasikan;
  dan 4) `git diff --check` lulus.
- **Jangan menaruh diagram Mermaid di `docs/SCHEMA.md`.** Diagram tetap disimpan
  terpisah di `docs/ERD.md` dan harus menautkan kembali ke `SCHEMA.md`.
- Bila `docs/ERD.md` tidak dapat dibuat ulang atau diverifikasi, perubahan
  `docs/SCHEMA.md` dianggap belum selesai dan tidak boleh di-commit sebagai
  pekerjaan tuntas.

## SUMBER ALUR KERJA (WORKFLOW) & PERENCANAAN — BOARD (ATURAN UMUM)

- **Alur kerja (workflow) berlaku per aplikasi dan hanya saat status efektifnya `Aktif`.** Status efektif = pengaturan utama (master) `workflow_master_aktif` DAN penanda (flag) aplikasi `aplikasi[].workflow_aktif`. Cek: popover "Alur kerja (Workflow)" di `/board`, `GET /api/board` (`workflow_master_aktif` + `aplikasi[].workflow_efektif`), `php artisan papan:lihat` (pengaturan utama + status tiap aplikasi), atau basis data (database/DB) `papan` (`papan_pengaturan.workflow_aktif` untuk pengaturan utama dan `workflow_aktif:<aplikasi>` per aplikasi). **Bila status tidak bisa dipastikan, anggap Draf.**
- **Saat efektif Aktif untuk aplikasi yang dikerjakan, Board adalah satu-satunya sumber alur kerja (workflow), prioritas, status, dan perencanaan aplikasi itu.** Sumber data: `backend/database/papan.sqlite` (koneksi `papan`), antarmuka pemrograman aplikasi (API) `/api/board`, halaman `/board`.
- **Tidak ada alur kerja/peta jalan (workflow/roadmap) lain.** Jangan membuat atau memelihara peta jalan (roadmap), daftar pekerjaan (TODO), target tahap (milestone), tabel gelombang, atau jadwal terpisah di PRD, `operasi.md`, pelacak masalah (issue tracker), maupun file baru. PRD/arsitektur hanya memuat kebutuhan dan rancangan; status dan urutan pengerjaan tetap di Board.
- **Perubahan Board disimpan di database.** Tidak ada sinkronisasi file markdown.
- **Catatan perubahan (CHANGELOG) bukan alur kerja (workflow):** hanya riwayat rilis. Jangan mencatat rencana/progres di sana.

### Konfirmasi perubahan Board dan syarat perubahan kode

- **Perubahan data Board boleh saat Aktif maupun Draf, setelah konfirmasi
  eksplisit pengguna.** Sebelum write, tampilkan tindakan, poin/aplikasi yang
  terdampak, status efektif workflow, serta asal/tujuan bila ada pemindahan;
  tunggu pengguna menyetujui tindakan tersebut. Pembacaan tidak perlu konfirmasi.
- Satu konfirmasi boleh mencakup beberapa perubahan yang sudah dijelaskan,
  termasuk pembaruan status, subpoin, dan hasil verifikasi dalam scope pekerjaan
  yang disetujui. Jangan meminta konfirmasi ulang untuk paket yang sama; tindakan
  di luar paket tersebut memerlukan konfirmasi baru.
- **Full-access, hak super_admin, dan kemampuan write melalui tool/API/CLI/model
  atau database tidak menggantikan konfirmasi.** Jangan memakai jalur lain untuk
  melewati gerbang ini. Persetujuan penataan Board tidak mengaktifkan workflow
  dan tidak memberi izin implementasi. Larangan agen menetapkan Done tetap berlaku.
- **Perubahan kode wajib menunggu workflow aplikasi terkait efektif Aktif**
  (master DAN aplikasi aktif), lalu mengikuti gerbang riset, persetujuan scope,
  dan In Progress. Saat Draf atau status tidak dapat dipastikan, jangan mengubah
  kode, termasuk kode Board itu sendiri. Untuk perubahan kode lintas aplikasi,
  semua aplikasi yang benar-benar terdampak wajib efektif Aktif.

### Perilaku agen: Aktif vs Draf

| Status efektif | Yang WAJIB dilakukan | Yang DILARANG |
| --- | --- | --- |
| **Aktif** (master + aplikasi yang dikerjakan aktif) | 1) Baca Board sebelum merencanakan/mengerjakan; jadikan status dan urutan aplikasi itu acuan. 2) Tunggu pengguna memilih pekerjaan pada aplikasi yang status efektifnya Aktif dengan memindahkan poin dari Backlog ke To Do. 3) Riset poin To Do dari alur kerja aktif tersebut, sertakan rekomendasi tampilan dan pengalaman pengguna (UI/UX) bila relevan, susun rancangan subpoin, dan konfirmasikan hal yang belum jelas kepada pengguna. 4) Tampilkan subpoin final dan minta satu konfirmasi untuk mulai mengerjakan; selama belum disetujui, poin tetap To Do. 5) Setelah disetujui, catat subpoin final, pindahkan poin ke In Progress, dan mulai mengerjakan. 6) Setelah selesai, perbarui Board sampai For Review. 7) Pastikan perubahan Board tersimpan. 8) Jika dokumen lain bertentangan, Board yang menang. | Membuat roadmap/TODO/milestone terpisah; memindahkan Backlog ke To Do atas inisiatif agen; memakai To Do dari aplikasi yang efektif Draf; mengerjakan poin yang masih Backlog/To Do; memiliki lebih dari satu In Progress per aplikasi; menulis rencana hanya di PRD/chat; menyelesaikan tugas tanpa memperbarui Board; memindahkan poin ke Done secara otomatis. |
| **Draf** (pengaturan utama/master mati atau aplikasi itu belum aktif) | 1) Pakai PRD dan kode sebagai rujukan kebutuhan/status. 2) Saat pengguna meminta rencana, prioritas, atau "apa selanjutnya", beri tahu bahwa workflow aplikasi itu masih Draf dan sarankan pengguna mengaktifkan pengaturan utama + aplikasi terkait sebelum implementasi. 3) Boleh menambah, mengubah, atau memindahkan data Board setelah konfirmasi sesuai gerbang di atas; data tersebut belum menjadi workflow aktif. 4) Cek ulang status sebelum memakai Board lagi. | Memakai Board aplikasi itu sebagai acuan pelaksanaan workflow, prioritas, atau status implementasi; meriset/mengerjakan To Do sebagai penugasan dari workflow Draf; mengubah kode; menyimpulkan pekerjaan sudah/akan dari Board; mengaktifkan workflow sendiri. |

### Siklus wajib rencana dan penyelesaian saat Board Aktif

- **Rencana harus masuk Board lebih dahulu.** Setiap rencana implementasi,
  perbaikan, penataan ulang kode (refactor), perubahan skema, dokumentasi, atau
  pengujian mandiri yang akan dikerjakan wajib sudah memiliki poin dan subpoin di
  Board sebelum agen mulai mengubah berkas. Rencana yang belum tercatat dianggap
  belum siap dikerjakan. Dokumentasi dan pengujian rutin yang hanya mengikuti
  poin utama tunduk pada aturan batas isi Board di bawah, bukan menjadi poin
  terpisah.
- Gunakan alur status berikut: belum siap dijadwalkan = **Belum dijadwalkan
  (Backlog)**; siap dikerjakan = **Siap dikerjakan (To Do)**; saat pekerjaan
  dimulai = **Sedang dikerjakan (In Progress)**; implementasi selesai tetapi
  masih menunggu pemeriksaan/peninjauan = **Menunggu peninjauan (For Review)**;
  evaluasi manual pengguna diterima = **Selesai (Done)**.
- **Pengguna memilih pekerjaan.** Semua rencana baru masuk ke Belum dijadwalkan
  (Backlog). Hanya pengguna yang memindahkan poin dari Backlog ke Siap
  dikerjakan (To Do). Pemilihan itu berlaku sebagai pekerjaan agen hanya bila
  status efektif alur kerja aplikasi tersebut Aktif. Agen tidak boleh memilih
  atau memprioritaskan Backlog dengan memindahkannya sendiri.
- **To Do berarti siap diriset, belum siap diimplementasikan.** Agen boleh
  membaca kode, kebutuhan, skema, dan sumber terkait untuk memahami poin, tetapi
  belum boleh mengubah kode atau dokumen produk. Poin To Do dari aplikasi yang
  efektif Draf tidak boleh diriset atau dikerjakan berdasarkan Board.
- **Requirement poin adalah instruksi wajib.** Bila poin memiliki field
  `keterangan`, baca dan riset requirement itu sebelum menyusun subpoin. Subpoin
  final harus menjawab requirement; setelah subpoin tersimpan, kosongkan
  requirement (`keterangan: ""`). Requirement tidak membuka izin implementasi:
  gerbang konfirmasi dan status Board tetap berlaku. Lihat bagian "Requirement
  khusus pada poin Board".
- **For Review adalah gerbang evaluasi manual pengguna.** Setelah implementasi
  dan pemeriksaan otomatis selesai, agen memindahkan poin ke Menunggu peninjauan
  (For Review) dan berhenti. Agen tidak boleh memindahkan poin ke Selesai
  (Done), meskipun diminta membantu perpindahan setelah evaluasi.
- Nilai teknis status Menunggu peninjauan adalah `for_review`, bukan
  `in_review`.
- **Pending** (`pending`) tampil sebelum Backlog dan berada di luar pemilihan
  pekerjaan otomatis agen. Perpindahan ke maupun dari Pending hanya dilakukan
  pengguna melalui UI, atau agen atas instruksi langsung pengguna untuk poin
  terkait. Jangan memakai Pending atas inisiatif agen. Poin baru tetap Backlog.
  CLI memerlukan `--instruksi-pending` (atau `instruksi_pending` pada payload
  JSON) berisi instruksi nyata pengguna; field ini adalah catatan, bukan
  pengganti persetujuan atau autentikasi. Pemilihan ke To Do, konfirmasi scope,
  batas In Progress, dan gerbang For Review tetap berlaku.
- Hanya pengguna yang menentukan hasil evaluasi manual dan memindahkan poin
  dari For Review ke Done melalui UI Board. Jalur agen/CLI tidak digunakan
  untuk menetapkan Done; bila diminta, arahkan pengguna melakukan aksi di UI.
- Bila pengguna menolak hasil evaluasi atau meminta perbaikan, pindahkan poin
  dari Menunggu peninjauan (For Review) kembali ke Sedang dikerjakan (In
  Progress), selama tidak ada poin In Progress lain pada aplikasi yang sama.
  Catat alasan atau hasil evaluasi pada catatan poin, terpisah dari acceptance
  criteria, lalu kerjakan perbaikannya dalam poin yang sama selama hasil yang
  dituju tidak berubah.
- Poin Selesai (Done) hanya boleh dibuka kembali (reopen) ke Sedang dikerjakan
  (In Progress) atas perintah eksplisit pengguna. Catat alasan pembukaan kembali
  agar perubahan status dapat dipahami pada pemeriksaan berikutnya.
- Uncheck pada Done boleh menjadi perintah Reopen melalui UI hanya setelah
  pengguna mengonfirmasi penjelasan perubahan Done → In Progress. Pembatalan,
  kegagalan penyimpanan, atau adanya poin In Progress lain pada aplikasi yang
  sama tidak boleh mengubah checkbox, status, atau meninggalkan write parsial.
  Bila terhalang poin aktif, minta pengguna menyelesaikan atau mengembalikan
  poin aktif ke Backlog terlebih dahulu; agen tidak memilihkannya sendiri.
- Pekerjaan yang dibatalkan bukan pekerjaan Selesai (Done). Arsipkan atau hapus
  poin hanya atas keputusan eksplisit pengguna; jangan memindahkannya ke Done
  untuk sekadar membersihkan Board.
- **Board wajib diperbarui setelah menyelesaikan sesuatu.** Sebelum memberi
  jawaban akhir, agen harus mencentang subpoin yang selesai, mencatat hasil
  verifikasi yang relevan, dan memindahkan status poin ke Menunggu peninjauan
  (For Review). Jangan menyatakan implementasi siap dievaluasi bila Board belum
  selaras.
- Jika saat mengerjakan ditemukan pekerjaan tambahan yang belum tercatat,
  nilai dulu dengan aturan batas isi Board di bawah. Hanya pekerjaan yang layak
  menjadi poin/subpoin yang wajib ditambahkan sebelum dikerjakan.
- Setelah setiap penambahan atau pembaruan Board, pastikan data dan status
  tersimpan di database Board.
- Bila tidak ada satu pun aplikasi dengan status efektif Aktif, saran pengaktifan
  Board bersifat wajib tetapi keputusan tetap milik pengguna. Agen tidak boleh
  mengaktifkan pengaturan utama (master) atau aplikasi tanpa perintah pengguna.

### Menentukan pekerjaan selanjutnya saat Board Aktif

- Saat pengguna bertanya "apa selanjutnya", gunakan urutan berikut: 1) lanjutkan
  poin paling atas pada alur kerja efektif Aktif yang berstatus Sedang dikerjakan
  (In Progress) dan sudah mendapat konfirmasi pengerjaan; 2) bila tidak ada,
  riset poin To Do yang disebut langsung oleh pengguna pada alur kerja efektif
  Aktif; 3) bila pengguna tidak menyebut poin tertentu, riset poin To Do paling
  atas pada aplikasi yang sedang dibahas; 4) bila alur kerja aktif hanya memiliki
  Backlog, minta pengguna memilih pekerjaan dengan memindahkannya sendiri ke To
  Do.
- Poin Menunggu peninjauan (For Review) diberitahukan kepada pengguna sebagai
  pekerjaan yang menunggu evaluasi manual, bukan sebagai pekerjaan baru untuk
  agen. Agen baru mengerjakannya lagi bila pengguna memberi hasil evaluasi atau
  meminta perubahan.
- Adanya poin For Review tidak otomatis menghalangi agen mengambil poin To Do
  berikutnya, kecuali pengguna menetapkan bahwa evaluasi harus diselesaikan lebih
  dahulu.

### Gerbang riset, penyusunan subpoin, dan konfirmasi

- Untuk poin To Do pada aplikasi yang alur kerjanya efektif Aktif, lakukan riset
  hanya-baca (read-only) terlebih dahulu. Riset harus mencakup tujuan pengguna,
  keadaan kode/data saat ini, ketergantungan, risiko, dan hasil yang dapat
  dievaluasi secara manual.
- Bila pekerjaan berdampak pada antarmuka, hasil riset wajib menyertakan
  rekomendasi tampilan dan pengalaman pengguna (UI/UX). Bahas seperlunya alur
  pengguna, susunan informasi, keadaan memuat (loading), kosong (empty), gagal
  (error), dan berhasil (success), penyesuaian terhadap ukuran layar
  (responsive), kemudahan akses (accessibility), serta keselarasan dengan pola
  aplikasi yang sudah ada. Rekomendasi ini masih berupa rancangan untuk
  dikonfirmasi pengguna, bukan izin untuk mengubah produk.
- Bila pekerjaan tidak berdampak pada antarmuka, hasil riset cukup menyatakan
  **tidak ada dampak UI**; jangan memaksakan atau mengarang rekomendasi UI.
- Dari hasil riset, susun rancangan subpoin yang ringkas sesuai aturan batas isi
  Board. Subpoin harus berupa hasil yang dapat diperiksa atau syarat selesai
  (acceptance criteria), bukan catatan riset, nama berkas, atau langkah teknis.
  Tampilkan rancangan itu kepada pengguna dan tanyakan hanya keputusan yang
  benar-benar diperlukan untuk memastikan hasilnya sesuai maksud pengguna.
- Rancangan selama diskusi belum dianggap isi Board final. Jangan mengubah kode
  atau dokumen produk, dan jangan memindahkan poin ke In Progress, sampai
  pertanyaan penting dijawab dan pengguna menyetujui arah akhirnya.
- Jika tidak ada hal yang perlu ditanyakan, agen tetap menampilkan subpoin final
  dan meminta satu konfirmasi eksplisit untuk mulai mengerjakan. Selama pengguna
  belum menjawab, poin tetap To Do dan agen tidak mengubah produk.
- Setelah pengguna menyetujui subpoin final sekaligus mengizinkan pengerjaan,
  simpan poin/subpoin final ke Board, pindahkan statusnya ke Sedang dikerjakan
  (In Progress), pastikan perubahan tersimpan, lalu langsung mulai
  mengerjakan. Jangan meminta konfirmasi pengerjaan kedua untuk ruang lingkup
  yang sama.
- Batasi satu poin In Progress per aplikasi. Poin kedua baru boleh dimulai
  setelah poin pertama masuk For Review atau pengguna memindahkan poin pertama
  kembali ke Backlog.
- Bila riset menunjukkan satu poin terlalu besar, usulkan pemecahan sebelum
  pengerjaan. Poin tambahan dicatat sebagai Backlog dan hanya menjadi To Do bila
  pengguna memilihnya secara manual.
- Konfirmasi pengerjaan berlaku untuk ruang lingkup dan subpoin yang sudah
  disepakati; bila ruang lingkup berubah secara berarti, kembali ke tahap riset
  dan konfirmasi.
- Setelah seluruh subpoin dan verifikasi selesai, pindahkan poin ke Menunggu
  peninjauan (For Review). Status Selesai (Done) tetap menjadi keputusan manual
  pengguna melalui UI.

### Catatan, versi scope, dan data legacy

- Subpoin adalah acceptance criteria, bukan tempat menumpuk diskusi, persetujuan,
  revisi, atau hasil tes. Simpan catatan tersebut terpisah pada poin yang sama.
  Catatan persetujuan harus merujuk keputusan nyata pengguna; klaim agen tidak
  menggantikan persetujuan pengguna.
- Perubahan substantif pada hasil atau acceptance criteria yang telah disetujui
  memerlukan riset seperlunya, persetujuan pengguna, catatan alasan, dan snapshot
  versi scope baru pada poin yang sama sebelum implementasi scope baru.
  Pertahankan snapshot terdahulu agar perubahan dapat ditelusuri.
- Checkbox selesai/belum selesai dan penambahan catatan tidak menambah versi
  scope. Koreksi typo yang tidak mengubah makna cukup dicatat, bukan dianggap
  persetujuan scope baru. Jangan menyamarkan perubahan makna sebagai typo.
- Jika hasil yang dituju menjadi hasil mandiri yang berbeda, buat poin baru
  Backlog dan tunggu pengguna memilihnya; jangan menumpangkannya pada revisi
  poin aktif atau membuat daftar pekerjaan di luar Board.
- Pertahankan ID, status, dan riwayat poin existing. Pada write pertama yang
  menangani poin legacy, buat snapshot awal yang diberi penanda legacy dan
  waktu pencatatan sebenarnya; pembacaan saja tidak boleh memutasi data.
  Snapshot ini bukan bukti persetujuan atau verifikasi historis; jangan
  mengarang bukti atau memundurkan status secara massal.
- Aturan agen tetap wajib meskipun belum seluruhnya menjadi guardrail backend.
  Penerapan guardrail ketat lainnya memerlukan keputusan tersendiri; jangan
  menganggap seluruh jalur API/UI/CLI telah memiliki proteksi yang sama.

### Requirement khusus pada poin Board

Aturan ini **WAJIB** dan berlaku setiap kali sebuah poin Board memiliki field
`keterangan` yang terisi.

1. **Baca requirement sebelum riset.** Field `keterangan` adalah requirement
   khusus dari pengguna, bukan catatan permanen. Anggap isinya sebagai instruksi
   yang mengikat poin tersebut.
2. **Riset requirement lebih dahulu.** Riset hanya-baca harus menjawab tujuan,
   kendala, dan hasil yang diminta requirement. Subpoin yang disusun harus
   menjawab requirement tersebut, bukan mengulang teksnya.
3. **Simpan subpoin, lalu kosongkan requirement.** Setelah subpoin final
   tersimpan di poin yang sama (`keterangan: ""`), hapus isi requirement agar
   tidak diproses ulang. Jangan mengosongkannya sebelum subpoin tersimpan.
4. **Jangan melompati gerbang konfirmasi.** Menambahkan subpoin bukan izin untuk
   mulai mengimplementasikan; status poin dan konfirmasi pengguna tetap mengikuti
   alur Board.
5. **Tanyakan bila ambigu.** Bila requirement tidak jelas, tanyakan kepada
   pengguna sebelum mengubah atau mengosongkannya.
6. **Bukan pengganti subpoin.** Requirement tidak boleh menggantikan subpoin,
   menjadi roadmap terpisah, atau dianggap sebagai hasil pekerjaan.

### Saat pekerjaan gagal, terhenti, atau Board tidak dapat diperbarui

- Bila perubahan sudah dimulai tetapi belum selesai, pertahankan status Sedang
  dikerjakan (In Progress). Bila belum ada perubahan yang dimulai, pertahankan
  status Siap dikerjakan (To Do).
- Bila pemeriksaan atau pengujian yang wajib gagal, jangan pindahkan poin ke
  Menunggu peninjauan (For Review). Perbaiki dalam poin yang sama selama masih
  termasuk hasil yang disepakati.
- Catat hambatan pada Board hanya bila memerlukan keputusan pengguna, mengubah
  ruang lingkup pekerjaan, atau membuat pekerjaan tidak dapat dilanjutkan.
  Kegagalan percobaan dan rincian teknis rutin tidak perlu dimasukkan ke Board.
- Bila Board tidak dapat dibaca atau diperbarui ketika alur kerja (workflow)
  efektif Aktif, hentikan pekerjaan baru, beri tahu pengguna, dan jangan mengaku
  bahwa Board atau pekerjaan sudah selaras. Lanjutkan setelah Board kembali dapat
  dipakai atau pengguna memberi arahan.

### Batas isi Board agar tetap ringkas

- **Satu poin Board = satu hasil yang dapat dievaluasi pengguna secara manual
  pada For Review.** Jangan membuat satu poin per berkas, fungsi, lapisan teknis,
  perintah, atau langkah implementasi.
- Subpoin hanya memuat syarat selesai yang dapat diamati, keluaran penting,
  risiko utama, hasil verifikasi yang wajib, atau pemeriksaan manual pengguna.
  Usahakan sekitar 3–7 subpoin; bila jauh lebih banyak, pertimbangkan apakah ada
  dua hasil mandiri yang seharusnya dipisahkan.
- Hal berikut **tidak perlu masuk Board** sebagai poin atau subpoin tersendiri:
  1) pertanyaan, penjelasan, diskusi, dan konsultasi tanpa perubahan proyek;
  2) penyelidikan hanya-baca (read-only) dan pencarian penyebab;
  3) ide yang masih dibahas dan belum dipilih untuk dikerjakan;
  4) nama berkas, fungsi, kelas, komponen, atau baris kode yang diubah;
  5) langkah teknis internal seperti membuat pengendali (controller), kait React
  (hook), rute, kueri, atau fungsi pembantu;
  6) pemeriksaan rutin seperti pemeriksaan tipe (typecheck), tes, penataan kode
  (lint/format), dan pemeriksaan hasil perubahan;
  7) percobaan sementara, pendekatan gagal, dan pengulangan perintah;
  8) menyalakan server pengembangan, membersihkan berkas sementara, membuat
  screenshot pemeriksaan, atau kegiatan Git seperti commit/cabang/merge;
  9) pembaruan dokumen turunan wajib seperti `ERD.md`; dan
  10) perbaikan kecil, perubahan teks, impor, format, atau tes yang hanya
  mengikuti perubahan utama dan diperlukan agar poin induk berfungsi.
- Pekerjaan temuan menjadi poin baru hanya bila sedikitnya satu kondisi berikut
  terpenuhi: menghasilkan perilaku yang dapat dilihat pengguna; dapat ditunda
  tanpa menghalangi poin aktif; memerlukan keputusan/evaluasi manual tersendiri;
  mengubah aturan bisnis, skema basis data, izin, atau kontrak antarmuka
  pemrograman aplikasi (API); atau berdampak lintas modul/cukup besar untuk sesi
  terpisah. Selain itu, tangani sebagai bagian internal poin aktif.
- Dokumentasi atau pengujian menjadi poin tersendiri hanya bila menghasilkan
  keluaran mandiri yang dapat dievaluasi pengguna. Pemeriksaan rutin, tes yang
  mengikuti perubahan utama, serta dokumen turunan cukup menjadi syarat selesai,
  hasil verifikasi, atau bagian dari subpoin induk yang relevan; jangan dibuat
  sebagai poin rencana terpisah.

- **Perubahan kode lintas aplikasi:** hanya boleh dikerjakan jika SEMUA
  aplikasi yang terlibat berstatus efektif Aktif. Aplikasi dianggap terlibat bila
  perilaku yang dilihat pengguna, aturan bisnis, data, izin, atau kesepakatan
  komunikasi antaraplikasinya ikut berubah. Pemakaian komponen atau fungsi teknis
  bersama tidak otomatis membuat semua aplikasi pemakainya terlibat, kecuali
  perubahan tersebut turut mengubah perilaku atau kesepakatan komunikasinya.
  Bila salah satu aplikasi yang benar-benar terlibat masih Draf, perlakukan
  keseluruhan pekerjaan sebagai Draf (aman bila ragu/fail closed). Pemindahan
  atau penataan data Board lintas aplikasi tetap boleh setelah konfirmasi
  sesuai gerbang perubahan Board, tanpa mengaktifkan workflow aplikasi tujuan.
- **Mengaktifkan/menonaktifkan master atau aplikasi adalah keputusan pengguna.** Jangan mengubahnya sendiri; minta konfirmasi. Pengguna dapat menonaktifkan kapan saja, dan sejak saat itu aturan Draf berlaku untuk aplikasi tersebut sampai diaktifkan kembali.

## Skill (katalog otomatis)

Skill agen tersimpan di **`.agents/skills/`** (satu folder per skill, wajib  
berisi `SKILL.md`). Lokasi ini dipindai otomatis oleh harness, jadi skill di  
sini langsung tersedia tanpa dipanggil manual — cukup sebut namanya.

- **Jangan** menaruh skill baru di `.opencode/skills/`: folder itu hanya dibaca  
  OpenCode, **tidak** dibaca harness ini, dan di-ignore git (lihat  
  `.gitignore:15`) sehingga tidak ikut ter-clone.
- **Cara menambah skill**: salin foldernya ke `.agents/skills/<nama>/`, pastikan  
  `SKILL.md` punya frontmatter `name` + `description` (description-lah yang  
  memicu pemakaian otomatis), lalu pastikan jalan perintah di dalamnya tidak  
  memakai path absolut.
- **Path di dalam SKILL.md** harus menunjuk ke lokasinya yang sekarang  
  (`.agents/skills/<nama>/...`), bukan lokasi asal.
- Skill yang tersedia saat ini: `ui-ux-pro-max`, `design`, `design-system`,  
  `ui-styling`, `frontend-design`, `slides`, `banner-design`, `brand`,  
  `grill-with-ui`, `find-skills`, `laravel-best-practices`, `tauri-v2`.

### Skill yang SENGAJA TIDAK dipasang

Jangan tambahkan kembali tanpa alasan kuat — dua ini bertentangan dengan  
konvensi project, bukan sekadar tidak relevan:

- **`vercel-react-best-practices`** — membawa `AGENTS.md` **108 KB** yang  
  otomatis dimuat sebagai instruksi workspace dan **memakan anggaran instruksi  
  sampai terpotong**. Isinya ~40% khusus Next.js (RSC, `after()`,  
  `React.cache()`, Suspense streaming) padahal project ini **Vite SPA**.
- **`shadcn`** — punya blok **"Critical Rules — always enforced"** yang  
  mewajibkan menghapus `z-index` manual pada overlay dan memakai `rounded-*`.  
  Keduanya **merusak UI yang sudah terverifikasi** di sini:
  - `hover:z-10` pada sel crosstab **wajib** agar garis hover muncul di atas  
    sel tetangga (bukan overlay Radix, tapi grid ala Excel);
  - `--radius-semua: 0px` (`src/index.css`) bikin `rounded-*` tidak  
    berpengaruh — sempat ditulis lalu dibuang.

Skill yang **boleh** diikuti tapi perlu penilaian: `ui-styling` menampilkan  
`dark:`/`space-y-*` di contoh, bukan mewajibkan; `frontend-design` justru  
**menentang** kartu rounded seragam, jadi selaras dengan radius 0 project ini.

- Sebagian skill butuh **Python 3** (mis. `ui-ux-pro-max/scripts/search.py`).  
  Contoh: `python3 .agents/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system`.

Catatan: `.opencode/skills/` masih ada sebagai salinan OpenCode. Bila skill  
diperbarui, perbarui **keduanya** supaya tidak menyimpang.

### Pembagian tugas skill (hindari salah pilih)

Beberapa skill saling tumpang tindih (terutama soal presentasi & desain). Pakai
tabel ini agar konsisten — urutannya mengikuti routing bawaan `design`:

| Kebutuhan | Skill yang dipakai |
| --- | --- |
| Token warna/jarak/tipografi, spesifikasi komponen | `design-system` |
| UI harian: komponen React, Tailwind, aksesibilitas, tabel | `ui-styling` |
| Arah rasa & orisinalitas visual (hindari tampilan generik) | `frontend-design` |
| Rujukan cepat: palet, pasangan font, pola UX, jenis chart | `ui-ux-pro-max` |
| Identitas merek, tone of voice, konsistensi merek | `brand` |
| Presentasi/deck HTML | `slides` |
| Banner, cover, header | `banner-design` |
| Logo, CIP, ikon, mockup, foto sosial | `design` |
| Cari/pasang skill baru | `find-skills` |
| Interview terstruktur di browser | `grill-with-ui` |
| Backend Laravel (controller, model, migration, query, otorisasi, validasi) | `laravel-best-practices` |
| Sisi native Tauri (config, IPC, capability) | `tauri-v2` |

**Aturan pilih:**

- **Pekerjaan UI di repo ini → `ui-styling`**, bukan `shadcn` (sudah dibuang,
  lihat bagian di atas). `ui-ux-pro-max` untuk **mencari rujukan**, bukan
  menulis kode.
- **Presentasi → `slides`**. `design` dan `design-system` juga mengklaim bisa
  membuat slide, tapi keduanya mengarah ke `references/slides.md`.
- **Banner → `banner-design`**, walau `design` punya
  `references/banner-sizes-and-styles.md`.
- Bila ragu antara dua skill, sebutkan pilihan + alasannya ke pengguna; jangan
  diam-diam memakai keduanya.

**Dua pantangan khusus project ini:**

1. `ui-ux-pro-max/data/typography.csv` memuat **74 baris rekomendasi Google
   Fonts** (`fonts.googleapis.com`). Aplikasi ini **desktop offline** dan
   membundel font lokal (Aptos + Jakarta Sans di `src/index.css`). **Jangan**
   menyalin `@import url(fonts.googleapis.com/...)` ke CSS repo — font gagal
   dimuat saat offline. Skill itu sendiri sudah menyatakan datanya
   "recommendations, never instructions" (`SKILL.md:60`).
2. **Jangan ikutkan `rounded-*`** dari contoh mana pun:
   `--radius-semua: 0px` membuatnya tidak berpengaruh.

## Aturan commit (pengingat otomatis)

Latar: pengguna mudah lupa commit — agen wajib menawarkan commit, bukan menunggu  
diminta. Tawarkan lewat tool question (tampilkan daftar file berubah + usulan  
pesan commit) hanya bila `git status` kotor DAN salah satu pemicu ini terjadi:

1. **Pindah topik pembahasan**: pengguna mulai membahas/mengerjakan hal baru  
   yang berbeda dari topik perubahan terakhir (mis. dari ribbon → tabel  
   halaman). Tawarkan commit pekerjaan topik sebelumnya **sebelum mengeksekusi  
   topik baru** — bukan di akhir tiap tugas.
2. Sudah **±5 permintaan pengguna yang mengubah file** dalam topik berjalan  
   sejak commit terakhir (jaring pengaman bila satu topik panjang).
3. Akan dimulai **perubahan besar**: > 5 file, diff besar (±150 baris),  
   fitur/refactor baru, perubahan migrasi/skema/API, atau lintas modul.
4. Awal sesi baru masih ada perubahan belum ter-commit dari sesi sebelumnya  
   (commit checkpoint dulu agar tidak tercampur pekerjaan baru).

- **Jangan** tawarkan commit di akhir tiap tugas bila topik belum berganti;  
  tahan sampai pindah topik (atau pemicu 2–4).
- Opsi tawaran: **Commit sekarang** (agen `git add` file terkait + commit dengan  
  pesan usulan, lalu laporkan hash) atau **Nanti** (lanjut; hitungan direset 0).
- Format pesan: `<tipe>: <ringkasan Bahasa Indonesia>` — tipe: feat, fix, chore,  
  docs, refactor, test, perf. Body berisi poin perubahan + hasil verifikasi  
  (frontend: `npm run typecheck`/`build`; backend: tes terkait). Satu commit =  
  satu perubahan logis; jangan mencampur fitur berbeda.
- Sebelum commit: inspeksi `git status` + `git diff`; dilarang commit rahasia/  
  kredensial, screenshot sementara, dan artefak build.
- Setelah commit: laporkan hash + ringkasan singkat.

## STATUS TES — pemberitahuan rutin

**Setiap sesi, beri tahu pengguna status tes** (suspend atau aktif), sama  
seperti pengingat akun reviewer. Sertakan: apakah tes sedang dijeda, apa yang  
tetap dijalankan sebagai verifikasi, dan cara mencabutnya.

Contoh kalimat saat suspend aktif:

> "Pengingat rutin: tes FE & BE sedang **dijeda (suspend aktif)** atas  
> permintaan Anda. Verifikasi pakai `npm run typecheck` + `vendor/bin/pint --dirty`. Bilang saja bila mau saya cabut suspend-nya."

Contoh kalimat saat tes aktif:

> "Pengingat rutin: tes FE & BE **aktif kembali** (suspend dicabut 2026-10-13),  
> dijalankan seperti biasa. Verifikasi tetap boleh pakai `npm run typecheck` +  
> `vendor/bin/pint --dirty`. Bilang saja bila mau saya suspend lagi."

Saat suspend dicabut: sebutkan tes sudah aktif kembali dan dijalankan seperti  
biasa. Pemberitahuan ini WAJIB muncul di respons, bukan hanya di ringkasan  
internal.

## KEBIJAKAN MENJALANKAN TES — penilaian dampak

**Default: tes tersempit** yang terdampak (aturan test di `frontend/AGENTS.md`  
& `backend/AGENTS.md` tetap berlaku). Jangan menjalankan suite penuh otomatis  
tiap perubahan.

Suite penuh **direkomendasikan** — tawarkan ke pengguna lebih dulu, jangan  
dijalankan diam-diam maupun dilewati diam-diam — bila perubahan menyentuh  
**modul bersama**:

- **Frontend**: `components/excelV2/ExcelTabelV2.tsx` + `components/excel/**`, `api/*`,
  `index.css`, `components/ui/**`, `hooks/**`, `lib/**`, `auth/**`,
  `lembagaAktif`, `theme`, dan stub tes `components/excel/_dsgStubDom.tsx`.
- **Backend**: `Services/UrutKatalog.php`, `Concerns/*`, `Support/*`,  
  model/relasi bersama, migrasi, dan endpoint yang dipakai beberapa halaman.

Cukup **tes tersempit** bila dampaknya sempit: satu halaman + komponennya  
sendiri, copy/teks, styling atau layout lokal, satu tab/dialog.

- **Kebijakan tingkat/pola tes UI** (komponen bersama, batas jsdom, stub DSG,
  manual/browser): lihat `docs/KEBIJAKAN-TES-UI.md`.
- **"Hijau" = tak ada gagal BARU.** Per 2026-10-15 **baseline bersih**: kedua  
  kegagalan lama sudah hilang — `src/pages/KeuanganPage.test.tsx` 27/27 hijau,  
  dan `SchemaDocTest::test_tabel_dan_kolom_db_ikut_terdokumentasi` hijau.  
  Jadi kegagalan apa pun yang muncul sekarang adalah regresi, bukan warisan —  
  jangan diabaikan dengan alasan "sudah ada sebelumnya".
- **Jangan menjalankan dua runner vitest bersamaan** (tes tersempit + suite  
  penuh) — pernah kena SIGTERM/OOM (`exit 137`) karena rebutan memori.
- `npm run build` **selalu gagal di sandbox agen**: shim safe-delete memblokir  
  hapus `dist/assets` (bukan error kode). Verifikasi build pakai  
  `npx vite build --outDir /tmp/<nama>` lalu hapus direktori itu.

## SUSPEND TES — SEMENTARA (NON-AKTIF sejak 2026-10-13 — dicabut, ISI DISIMPAN)

**Status sekarang: TES AKTIF KEMBALI.** Bagian ini TIDAK dihapus atas permintaan  
pengguna (2026-10-13) — "jangan dihapus, karena mungkin nanti saya suspend  
lagi". Isinya disimpan sebagai arsip siap-pakai: untuk men-suspend TES lagi,  
ubah baris "Riwayat" di bawah jadi "Status: **AKTIF**" + tanggal hari itu, lalu  
terapkan kembali larangan pada daftar arsip.

Riwayat: suspend **AKTIF sejak 2026-02-14**, dicabut (tes diaktifkan kembali)  
**2026-10-13**. Saat pencabutan, tes penuh dijalankan sekali untuk memeriksa  
regresi yang menumpuk selama suspend.

--- ARSIP (berlaku hanya bila suspend diaktifkan lagi) ---

Aturan saat suspend AKTIF: tes frontend & backend dijeda atas permintaan  
pengguna (dianggap memperlambat pengembangan). Tes tidak berjalan otomatis di  
repo ini (tidak ada hook/CI/watch wajib); larangan ini berlaku pada agen agar  
tidak menjalankannya atas inisiatif sendiri.

- **Dilarang menjalankan** atas inisiatif sendiri: `npm run test` (vitest) di  
  `frontend/admin-desktop-tauri`, `php artisan test`/`vendor/bin/phpunit` di  
  `backend`, termasuk versi tersempit/terfilter.
- **Dilarang** membuat/memperbarui file `*.test.ts(x)` atau  
  `tests/**/*Test.php` selama suspend.
- **Dilarang** menawarkan commit dengan alasan "menunggu tes hijau".
- **Tetap jalan** (bukan tes, tidak boleh ikut dijeda): `npm run typecheck`,  
  `npm run build`, `npm run audit:bagian`, `npm run audit:izin`,  
  `vendor/bin/pint --dirty`. Verifikasi perubahan memakai ini + tinjauan manual.
- **Pengecualian**: hanya bila pengguna **secara eksplisit** meminta tes  
  dijalankan pada permintaan itu — sebutkan bahwa suspend masih aktif.
- **Cara mencabut**: hapus seluruh bagian ini, lalu kembali ke aturan test di  
  `frontend/AGENTS.md` dan `backend/AGENTS.md`. Saat mencabut, jalankan tes  
  penuh sekali untuk memastikan perubahan selama suspend tidak menumpuk regresi.  
  --- (2026-10-13: dicabut dengan cara berbeda — bagian ditandai NON-AKTIF dan  
  isinya disimpan atas permintaan pengguna; tes dijalankan penuh sekali) ---

## STATUS BUILD TAURI — pemberitahuan rutin

**Setiap sesi, beri tahu pengguna bahwa rebuild native Tauri sedang dijeda**  
(sama seperti pengingat tes & akun reviewer). Sertakan: build Tauri  
(`tauri build` / `cargo` / bundling native) tidak dijalankan selama  
verifikasi, dan cara mencabutnya.

Contoh kalimat saat suspend aktif:

> "Pengingat rutin: rebuild Tauri **dijeda (suspend aktif)** atas permintaan  
> Anda — verifikasi pakai `npm run typecheck` + `vendor/bin/pint --dirty`  
> (build web Vite diperbolehkan, bundling native Tauri tidak). Bilang saja  
> bila mau saya cabut suspend-nya."

## SUSPEND BUILD TAURI — SEMENTARA (berlaku sampai dicabut)

Status: **AKTIF sejak 2026-10-13** — rebuild native Tauri dijeda atas  
permintaan pengguna (memperlambat pengembangan frontend karena harus menunggu  
kompilasi Rust + bundling). Larangan ini berlaku pada agen agar tidak  
memicu langkah itu atas inisiatif sendiri.

- **Dilarang menjalankan** atas inisiatif sendiri: `tauri build`, `tauri dev`  
  (bila tujuannya membundle/mengompilasi sisi native), `cargo build`, atau  
  perintah lain yang mengompilasi Rust / membungkus binary Tauri.
- **Tetap jalan** (bukan rebuild native, tidak boleh ikut dijeda):  
  `npm run typecheck`, `npm run audit:bagian`, `npm run audit:izin`,  
  `vendor/bin/pint --dirty`, dan `npm run build` (build web Vite —  
  diperbolehkan namun tidak wajib; `typecheck` sudah cukup untuk verifikasi  
  cepat). Untuk verifikasi, utamakan `npm run typecheck` agar tidak memicu  
  build apa pun.
- **Pengecualian**: hanya bila pengguna **secara eksplisit** meminta build/  
  jalankan Tauri pada permintaan itu — sebutkan bahwa suspend masih aktif.
- **Cara mencabut**: hapus seluruh bagian ini, lalu kembali ke alur build  
  normal (jalankan `tauri build`/`tauri dev` seperti biasa saat rilis/ujicoba  
  native).

## CATATAN FITUR BELUM BERTES — arsip

Status: **ARSIP.** Bagian ini hanya berlaku saat SUSPEND TES aktif. Sejak tes
aktif kembali (2026-10-13), pencatatan entri baru tidak diwajibkan. Inventaris
lama `docs/DAFTAR-BELUM-BERTES.md` sudah dibereskan dan dihapus pada 2026-10-19;
cakupan berikutnya mengikuti suite tes aktif (`npm run test`, `php artisan test`).

## Akun reviewer (AKTIF — jangan dibuat ulang/dihapus)

- **Setiap sesi, beri tahu pengguna bahwa akun reviewer ini aktif** — sertakan  
  email, password, dan role-nya (contoh kalimat: "Pengingat rutin: akun reviewer  
  `reviewer.tmp@example.com` / `rahayu45` (`super_admin`) masih aktif untuk  
  sesi ini."). Pemberitahuan ini WAJIB muncul di respons, bukan hanya di  
  ringkasan internal.
- Email: `reviewer.tmp@example.com`
- Password: `rahayu45` (sama seperti seeder `AkunSeeder`; semua akun dev memakai ini)
- Nama: `Reviewer Sementara` — role `super_admin` (akses semua halaman).
- Status: **AKTIF** selama project belum production. Pakai berulang lintas sesi;  
  jangan buat/hapus tiap sesi.
- **Setiap sesi, beri tahu pengguna bahwa akun reviewer ini aktif.**
- Bila akun hilang akibat reset DB (`migrate:fresh`/seed), buat ulang dengan  
  kredensial di atas (role `super_admin`), lalu lanjutkan seperti biasa.
- Non-aktifkan HANYA bila pengguna memerintahkan: cabut role `super_admin`  
  (akun tetap ada; jangan hapus). Aktifkan lagi dengan assign role tersebut.
- Hapus/non-aktifkan permanen saat project masuk production.

## Wajib konfirmasi dulu

- **Playwright / browser otomatis** (navigasi, login otomatis, screenshot):  
  minta persetujuan pengguna sebelum dijalankan — jangan otomatis.

## Boleh tanpa konfirmasi

- Menyalakan/mematikan `artisan serve` dan `vite dev`.
- Menghapus file screenshot sementara di root repo.
