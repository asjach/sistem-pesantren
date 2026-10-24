# Flow inti Board

Dokumen ini menjelaskan kontrak paket Board lokal, bukan daftar pekerjaan project.
Diekstrak dari aturan Board dan model data SIMPES; nama aplikasi, domain bisnis,
stack, autentikasi, dan path penyimpanan SIMPES tidak ikut menjadi requirement.
Fase discovery dan bootstrap dalam `readonly.md` adalah adaptasi untuk project
dari nol, termasuk aplikasi, riset, buku, dan laporan.

## Flow keputusan

```text
Sesi dimulai → Periksa materi dan brief yang sudah ada
Project kosong / kebutuhan belum jelas → Discovery bertahap sesuai jenis project
→ Ringkasan kebutuhan → Pengguna mengonfirmasi → Simpan BRIEF.md
Board belum berjalan → node server.mjs → Board Draf
Pengguna mengaktifkan master + aplikasi → Board efektif Aktif

Brief terkonfirmasi → Hasil yang dibutuhkan → Backlog
Pengguna memilih → To Do
Agen membaca requirement → riset → usulan acceptance criteria
Pengguna menyetujui scope dan izin mulai
→ simpan subpoin → kosongkan requirement → catat persetujuan → In Progress
Agen mengerjakan → verifikasi → centang subpoin → catat verifikasi → For Review
Pengguna menerima evaluasi → Done
Pengguna meminta revisi → In Progress → For Review
Pengguna memerintahkan reopen Done → In Progress
```

Master atau flag aplikasi mati berarti Draf. Perubahan flag saat pengerjaan
berlangsung langsung mengubah aturan yang berlaku menjadi aturan Draf.

Discovery boleh dilakukan sebelum Board tersedia. Brief adalah sumber kebutuhan;
Board adalah sumber urutan dan status kerja setelah Aktif. Konfirmasi brief,
izin setup Board, dan izin mengerjakan poin adalah keputusan dengan scope berbeda;
gunakan izin yang sudah diberikan tanpa meminta ulang untuk scope yang sama.

## Penyesuaian menurut jenis project

| Jenis | Contoh yang digali saat discovery | Contoh hasil yang direview |
| --- | --- | --- |
| Aplikasi | Pengguna, alur, fitur, platform, data, integrasi, deployment | Alur utama dapat digunakan sesuai acceptance criteria |
| Riset | Pertanyaan, metode, sumber/data, batas kajian, standar bukti | Analisis dan kesimpulan terlacak ke data/sumber |
| Buku | Pembaca, gagasan, genre, outline, gaya, panjang, referensi | Bab atau naskah memenuhi tujuan, struktur, dan gaya |
| Laporan | Penerima, tujuan keputusan, periode, data, format, hitungan | Laporan akurat, lengkap, dan memenuhi format penerima |

Ini contoh pertanyaan dan hasil, bukan scope atau Backlog default. Project lain
atau gabungan disesuaikan dengan keluaran dan kebutuhan pengguna.

## Model data minimal

```text
Project
└── Aplikasi
    └── Modul
        └── Submodul
            └── Poin [status, requirement, urutan]
                └── Subpoin [teks, selesai]
```

Project adalah batas satu instalasi. `Aplikasi`
adalah nama field teknis untuk **area kerja**, bukan pembatas jenis project.
Untuk satu area, buat satu area kerja default. Modul dan submodul mengelompokkan
hasil; poin yang berpindah antar-column. Contoh pengelompokan buku adalah area
“Naskah buku”, modul bagian buku, dan submodul bab; discovery menentukan struktur
aktual. Board sendiri tetap sebuah tool lokal meskipun hasil project bukan software.

| Entitas | Field inti |
| --- | --- |
| Pengaturan | `workflow_master_aktif`, default `false` |
| Aplikasi | `id`, `nama`, `workflow_aktif` default `false`, array `modul` |
| Modul | `id`, `nama`, array `sub`; parent mengikuti nesting |
| Submodul | `id`, `nama`, array `butir`; parent mengikuti nesting |
| Poin | `id`, `deskripsi`, `status`, `keterangan`, `subpoin`, `catatan` |
| Subpoin | `teks`, `selesai`; boleh disimpan sebagai array JSON pada poin |
| Catatan poin | `jenis`, `teks`, `oleh`, `waktu`, snapshot `scope`, dan penanda `digunakan`; tersimpan di `poin.catatan` |
| Riwayat status/workflow | `id`, `poin_id`, `dari`, `ke`, `oleh`, `catatan`, `waktu`; tabel events tersendiri |

Ini model logis. Implementasi minimal menyimpan document hierarki Board dan
revision di SQLite, serta riwayat dalam tabel tersendiri. Tidak membutuhkan
schema bisnis SIMPES. Response `GET /api/board` memakai `aplikasi[].modul[].sub[]`
dan daftar poin `butir[]` pada submodul. Gunakan ID yang dibaca dari response,
bukan mengandalkan ID contoh dalam panduan. Urutan ditentukan posisi dalam
array, tanpa field `urutan` atau `kode` terpisah. ID parent dikirim saat create,
sedangkan parent pada response dapat diketahui dari nesting.

`workflow_efektif` dihitung dari master AND flag aplikasi, bukan disimpan
sebagai flag ketiga. Status submodul dihitung dari poin, bukan disunting manual.

Urutan status turunan mengikuti sumber: tanpa poin → `backlog`; jika ada
`in_progress` → `in_progress`; berikutnya jika ada `todo` → `todo`; jika ada
`backlog` → `backlog`; jika ada `for_review` → `for_review`; selain itu → `done`.
Ini urutan evaluasi kondisi, bukan urutan column Kanban.

## Kontrak perilaku

- Lima status valid: `backlog`, `todo`, `in_progress`, `for_review`, `done`.
- Data bertahan setelah reload dan restart; database adalah sumber data utama.
- Status dan riwayat perubahannya disimpan dalam satu transaction.
- Mengubah deskripsi/checklist tidak otomatis mengubah status.
- Mengirim field yang tidak terkait tidak boleh menimpa data lain. Bedakan
  field tidak dikirim dengan `keterangan: ""` yang memang berarti dikosongkan.
- Checklist selesai tidak otomatis mengubah poin menjadi Done.
- Tolak For Review/Done jika checklist kosong atau masih ada subpoin belum selesai.
- Batasi satu In Progress per aplikasi, termasuk perubahan simultan.
- Pertahankan urutan stabil; urutan menjadi acuan “paling atas”.
- Jalur UI dan agen memakai service yang sama untuk validasi dan penyimpanan.
- Label aktor berasal dari jalur akses yang sesuai. Field `oleh` bukan bukti
  bahwa pengguna telah memberi persetujuan dalam percakapan.

Service membedakan sesi browser pengguna dari bearer agen. Agen tidak boleh
mengaktifkan workflow, memilih To Do, memindahkan poin ke Backlog/Done, atau
menghapus poin. Pengguna melakukannya melalui halaman Board. Ketika workflow
Draf, agen tidak menulis rencana workflow. Pengguna menyesuaikan struktur awal
melalui UI. Pembatasan ini tidak menjadikan catatan persetujuan sebagai bukti
kriptografis: Luffy bertanggung jawab mencatat persetujuan yang benar-benar
diberikan dalam percakapan, bukan membuat persetujuannya sendiri.

Start agen memerlukan catatan `persetujuan`; revisi For Review ke In Progress
memerlukan `revisi`; reopen Done memerlukan `keputusan` dan alasan sesuai
perintah eksplisit pengguna. Masuk For Review memerlukan catatan `verifikasi`.
Server mengikat catatan pada snapshot deskripsi dan teks checklist. Karena itu,
simpan deskripsi/subpoin final dahulu, baru buat catatan. Perubahan nilai
`selesai` saja tidak mengubah scope. Catatan `persetujuan`, `revisi`, atau
`keputusan` yang sesuai scope dan belum digunakan dikonsumsi saat masuk In
Progress. Catatan verifikasi harus baru untuk setiap siklus For Review;
verifikasi siklus terdahulu tidak dapat dipakai kembali setelah revisi/reopen.
Melanjutkan sesi pada In Progress yang sama tidak meminta persetujuan ulang.
Luffy memastikan isi catatan sesuai instruksi nyata pengguna. Server memeriksa
scope dan pemakaian catatan, bukan keaslian persetujuan dalam percakapan.

Catatan dibaca melalui `poin.catatan` pada `GET /api/board`; endpoint riwayat
hanya memuat events status/workflow, termasuk event pembuatan/penghapusan poin.
Events itu ditambahkan melalui service; catatan memiliki metadata pemakaian
yang diperbarui ketika memenuhi gerbang transisi.
Write wajib menggunakan revision (`If-Match`); tanpa header server mengembalikan
428. Jika konflik (409), baca ulang dan selaraskan
perubahan agar checklist atau catatan sesi lain tidak tertimpa.

Deskripsi, teks subpoin, dan requirement dikunci setelah masuk In Progress,
For Review, atau Done. Checkbox masih dapat diperbarui selama memenuhi gerbang
status. Perubahan scope membutuhkan perencanaan ulang oleh pengguna melalui
Backlog atau poin baru. Urutan naik/turun berlaku pada poin berstatus sama di
submodul yang sama, sesuai column yang terlihat.

## API dan CLI lokal

Jalankan `node server.mjs`, lalu gunakan CLI dari folder paket. CLI membaca
alamat dan bearer dari `.local/access.json`, mengirim revision terbaru untuk
write, dan tidak mencetak token. Jangan menulis database secara langsung.

| Endpoint | Input / hasil |
| --- | --- |
| `GET /api/board` | Hierarki, master, status efektif aplikasi, `revision` |
| `PATCH /api/workflow` | `{aktif, aplikasi_id?}`; tanpa ID berarti master; hanya pengguna |
| `POST /api/aplikasi` | `{nama}`; hanya pengguna |
| `PATCH /api/aplikasi/:id` | `{nama}` |
| `POST /api/modul` | `{nama, aplikasi_id}` |
| `PATCH /api/modul/:id` | `{nama}` |
| `POST /api/submodul` | `{nama, modul_id}` |
| `PATCH /api/submodul/:id` | `{nama}` |
| `POST /api/poin` | `{submodul_id, deskripsi, keterangan?, subpoin?}`; selalu Backlog |
| `PATCH /api/poin/:id` | Field terarah: `deskripsi`, `keterangan`, `subpoin`, `status`, `catatan` |
| `POST /api/poin/:id/catatan` | `{jenis, teks}`; jenis: `persetujuan`, `revisi`, `verifikasi`, `keputusan`, `catatan` |
| `POST /api/poin/:id/urutan` | `{arah: -1}` atau `{arah: 1}` |
| `DELETE /api/poin/:id` | Hapus hanya melalui jalur pengguna |
| `GET /api/riwayat?poin_id=:id` | Events status poin; tanpa parameter termasuk events workflow; tidak memuat daftar catatan poin |

Browser memperoleh akses sesi dari `GET /api/session` dan mengirim header
`x-board-token` untuk API. CLI memakai `Authorization: Bearer …`. Server hanya
menerima akses lokal dan tidak menyajikan file data/token melalui public assets.

```bash
node cli.mjs baca
node cli.mjs riwayat
node cli.mjs riwayat 12
node cli.mjs tambah --file poin.json
node cli.mjs ubah 12 --file perubahan.json
node cli.mjs catat 12 --file catatan.json
node cli.mjs urut 12 --file urutan.json
```

ID 12 adalah contoh. Untuk menghindari perbedaan escaping JSON antarterminal,
gunakan file JSON UTF-8 pada macOS, Windows, dan Linux. File payload hanya input
sementara untuk CLI, bukan sumber workflow kedua. Contoh `poin.json`:

```json
{
  "submodul_id": 3,
  "deskripsi": "Pengguna dapat membuka dan mengunci penyimpanan",
  "keterangan": "Riset alur pembukaan sesuai brief"
}
```

Setelah pengguna menyetujui subpoin final dan workflow Aktif, simpan scope lebih
dahulu. Contoh `perubahan.json` (belum mengubah status):

```json
{
  "keterangan": "",
  "subpoin": [
    {"teks": "Penyimpanan baru dapat dibuat sesuai brief", "selesai": false},
    {"teks": "Penyimpanan dapat dibuka dan dikunci kembali", "selesai": false},
    {"teks": "Kegagalan pembukaan ditampilkan jelas", "selesai": false}
  ]
}
```

Jalankan `node cli.mjs ubah 12 --file perubahan.json`. Lalu contoh
`catatan.json` untuk mencatat persetujuan nyata pengguna pada scope tersimpan:

```json
{
  "jenis": "persetujuan",
  "teks": "Pengguna menyetujui pembuatan, pembukaan, dan penguncian sesuai subpoin final; mengizinkan mulai pada percakapan saat ini."
}
```

Jalankan `node cli.mjs catat 12 --file catatan.json`. Terakhir, contoh
`mulai.json` untuk mulai:

```json
{
  "status": "in_progress"
}
```

Jalankan `node cli.mjs ubah 12 --file mulai.json`. Jangan mengirim contoh sebagai
persetujuan nyata. Sesudah implementasi, tandai checklist, tambahkan catatan
`verifikasi` berisi pemeriksaan yang benar-benar dilakukan, lalu ubah status
menjadi `for_review`. Akhiri setiap write dengan `node cli.mjs baca` untuk
memastikan data tersimpan. Untuk revisi, simpan catatan `revisi` terbaru sebelum
masuk In Progress. Untuk reopen Done, simpan `keputusan` terbaru dan kirim alasan
melalui field `catatan` pada PATCH status. Perintah pengguna harus nyata dan
eksplisit; agen hanya mencatatnya. Jangan memasukkan rahasia dalam payload,
catatan poin, atau riwayat.

## Integrasi kru software

Luffy membaca brief dan Board, memilih spesialis di `KRU.md`, serta memberikan
kontrak tugas. Hanya Luffy memperbarui Board; delegasi bukan poin tambahan.
Sub-agent mengembalikan bukti, hasil, keterbatasan, dan verifikasi. QA/review
independen disesuaikan risiko; evaluasi pengguna tetap gerbang Done. Tugas yang
menulis bagian sama berjalan berurutan. Board tidak menjalankan AI secara otomatis.

Aturan role tidak bergantung model atau harness tertentu. Pemuatan instruksi,
delegasi, pertanyaan interaktif, dan akses file/Board disesuaikan kemampuan nyata
sesuai `HARNESS.md`. Tidak ada tool dengan nama tertentu atau konfigurasi vendor
yang menjadi syarat workflow. API/CLI menggunakan JSON, bukan SDK model AI.
Adapter native bersifat opsional dan tidak mengubah gerbang persetujuan/status.

Jika hanya satu agen tersedia, pemeriksaan memakai perspektif role secara
berurutan dan dilaporkan sebagai pemeriksaan mandiri. Jika akses Board harus
melalui pengguna, tunggu readback terkonfirmasi sebelum pekerjaan dimulai atau
dinyatakan siap review. Jangan menganggap fallback menghapus verifikasi wajib.

## Contoh instruksi pengguna kepada agen

- “Mulai project ini.” — agen memeriksa brief dan memulai discovery bila perlu.
- “Saya ingin menyusun buku panduan untuk pemula.” — agen menggali kebutuhan buku.
- “Saya ingin meneliti topik ini dan membuat laporan.” — agen menggali riset dan laporan.
- “Baca Board dan jelaskan status workflow aplikasi ini.”
- “Susun usulan hasil project ini sebagai Backlog.” — hanya saat efektif Aktif.
- “Riset poin To Do nomor 12, baca requirement, lalu usulkan subpoin final.”
- “Saya setuju subpoin poin 12 tersebut. Mulai kerjakan.”
- “Lanjutkan poin In Progress yang sudah saya setujui.”
- “Poin 12 perlu revisi: pesan error belum terlihat. Kerjakan dalam poin itu.”
- “Saya sudah mengevaluasi poin 12 dan menerima hasilnya. Pindahkan ke Done.”
- “Buka kembali poin 12 untuk memperbaiki hasil ekspor.”

Nomor 12 hanya contoh. Pemilihan Backlog ke To Do dilakukan pengguna di Board;
agen tidak menafsirkan permintaan riset sebagai izin memilih Backlog sendiri.
