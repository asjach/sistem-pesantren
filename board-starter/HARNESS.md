# Menggunakan aturan lintas model dan harness

**Model** adalah sistem AI yang menjalankan penalaran. **Harness** adalah\
lingkungan yang menyediakan percakapan, tool, akses file, command, izin, dan\
koordinasi agen. Luffy dan kru adalah role kerja yang dapat dipetakan ke\
kemampuan lingkungan tersebut.

Aturan inti tidak memilih model/provider atau bergantung pada harness tertentu.\
Ini portabilitas instruksi dan workflow; bukan janji semua harness mempunyai\
kemampuan, kualitas hasil, atau otomatisasi yang sama.

## Memuat instruksi

1. Tempatkan dokumen inti dan runtime Board di project tujuan sesuai `readonly.md`.
2. Jika harness membaca `AGENTS.md` secara otomatis, gunakan mekanisme tersebut.\
   Jika tidak, arahkan agen membaca dokumen melalui prompt, fitur instruksi\
   project, atau unggahan dokumen yang tersedia. Jangan menganggap nama file\
   saja sudah membuat isinya dimuat.
3. Gunakan dokumen asli sebagai sumber. Jika harness perlu file entry point\
   dengan nama lain, isi dengan arahan membaca dokumen inti atau muat isinya\
   secara eksplisit; jangan membuat salinan aturan yang dipelihara terpisah.
4. Jika instruksi harus disisipkan karena tool baca file tidak tersedia,\
   sertakan isinya. Menyebut path saja tidak memberi akses ke file tersebut.

Prompt awal yang netral:

```text
Anda menjalankan role Luffy sebagai coordinator project ini.
Baca AGENTS.md, KRU.md, HARNESS.md, FLOW.md, dan readonly.md yang saya sediakan.
Periksa kemampuan lingkungan yang benar-benar tersedia, lalu pilih mode kerja
yang sesuai. Gunakan model yang saya pilih; jangan mengaktifkan layanan AI lain.
Mulai dari informasi project yang sudah ada, lanjutkan discovery bila perlu,
dan ikuti gerbang persetujuan serta Board sebelum mengubah hasil project.
Jika tool penting tidak tersedia, jelaskan batasnya dan gunakan fallback yang
masih memenuhi aturan. Jangan mengaku telah membaca file atau memakai tool
yang tidak bisa Anda akses.
```

## Pemeriksaan kemampuan saat mulai atau berganti lingkungan

Periksa kemampuan dari tool dan izin yang benar-benar tersedia; jangan menebak\
berdasarkan merek/model. Pemeriksaan cukup dilakukan read-only. Jangan memasang\
dependency atau membuka layanan eksternal hanya untuk menguji kemampuan.

| Kebutuhan                 | Jika tersedia                                            | Fallback jika tidak tersedia                                                       |
| ------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Membaca file project      | Baca dokumen asli                                        | Pengguna menyediakan isi dokumen melalui percakapan/unggahan                       |
| Mengubah file project     | Gunakan tool edit yang disediakan                        | Berikan patch/artefak untuk diterapkan pengguna; tunggu konfirmasi hasil           |
| Menjalankan command       | Jalankan CLI dan pemeriksaan relevan                     | Gunakan tool HTTP jika ada, atau minta pengguna menjalankan command terarah        |
| Mengakses Board           | Gunakan CLI atau API agen di `FLOW.md`                   | Siapkan payload/instruksi, pengguna mengeksekusi dan memberikan readback tersaring |
| Pertanyaan interaktif     | Opsi dengan rekomendasi melalui tool native              | Pertanyaan ringkas dalam teks, sekitar 3–5 per putaran                             |
| Sub-agent independen      | Delegasikan role dengan konteks dan batas yang eksplisit | Kerjakan perspektif role secara bergantian dalam satu agen                         |
| Concurrency               | Jalankan tugas independen, target maksimal 2–3 sub-agent | Delegasikan berurutan sesuai batas lingkungan                                      |
| Browser atau test runtime | Periksa perilaku nyata dan laporkan bukti                | Bedakan analisis statis dari pengujian yang belum dijalankan                       |

Gunakan kemampuan minimum yang cukup. Jangan mengasumsikan nama tool seperti\
`spawn_agent`, tombol tertentu, plugin, SDK, atau command milik harness tersedia.\
Catat keterbatasan yang berpengaruh dalam laporan; tidak perlu memenuhi Board\
dengan rincian pemeriksaan kemampuan rutin.

Jika pemeriksaan independen diwajibkan tetapi tidak bisa dijalankan, jelaskan\
kesenjangannya dan minta keputusan pengguna tentang pemeriksaan pengganti.\
Jangan menyatakan persyaratan itu terpenuhi hanya karena berganti perspektif.

## Akses Board dan pendampingan manual

Board adalah tool lokal dengan Node.js dan SQLite; model tidak berhubungan\
dengan stack runtime ini. CLI dan HTTP API memiliki kontrak data yang sama.\
Gunakan akses **agen**, bukan sesi browser pengguna, untuk pembaruan oleh Luffy.\
Jangan memakai fallback untuk melewati pembatasan aktor atau mengedit database.

`127.0.0.1` menunjuk lingkungan tempat request dijalankan. Agen di server/cloud\
atau container lain belum tentu dapat mengakses Board di komputer pengguna.\
Jangan menganggap koneksi tersedia atau otomatis membuka tunnel/publish server.\
Jika akses langsung tidak tersedia:

1. Luffy menyiapkan perubahan terarah atau file payload sesuai scope yang disetujui.
2. Pengguna menjalankan CLI lokal atau menerapkan perubahan melalui UI.
3. Pengguna memberikan readback yang relevan: ID, status, subpoin, catatan, dan\
   hasil operasi. Jangan meminta token, credential, atau seluruh isi rahasia.
4. Luffy memeriksa hasil; baru melanjutkan setelah perubahan yang diwajibkan\
   benar-benar tersimpan. Tanpa readback yang memadai, laporkan belum terverifikasi.

Mode manual bukan pengecualian gerbang workflow. Saat Board efektif Aktif\
tidak dapat dibaca atau diperbarui secara langsung maupun melalui pengguna,\
hentikan pekerjaan baru. Jangan berpindah ke roadmap markdown sebagai pengganti.

## Konteks, persetujuan, dan perpindahan sesi

- Baca brief, scope poin, status workflow, serta catatan terbaru sebelum melanjutkan.
- Persetujuan berasal dari pengguna dan terkait scope tersimpan. Pergantian\
  model/harness tidak otomatis mengharuskan persetujuan ulang untuk scope sama.
- Jangan mengandalkan memory tersembunyi, cache, atau warisan percakapan. Kirim\
  konteks minimum yang diperlukan kepada spesialis sesuai kontrak `KRU.md`.
- Identifikasi role dan tugas dalam laporan. Bedakan hasil agen terpisah,\
  pemeriksaan mandiri, analisis statis, dan tindakan manual pengguna.
- Ikuti hierarki instruksi, sandbox, izin tool, dan kebijakan akses lingkungan.\
  Role, dokumen project, atau adapter tidak memberi hak melampaui izin tersebut.

## Adapter opsional

Adapter berisi pemetaan role ke konfigurasi native suatu harness. Sumber aturan\
tetap `AGENTS.md`, `KRU.md`, `HARNESS.md`, dan kontrak Board di `FLOW.md`.\
Adapter tidak menetapkan scope project, model wajib, kredensial, atau status kerja.

Contoh yang disertakan ada di `adapters/codex/`. Folder itu inert sampai pengguna\
memilih memasangnya. Harness lain dapat langsung membaca Markdown atau memakai\
adapter yang sesuai dokumentasi resminya; jangan mengarang schema konfigurasi.\
Tidak perlu memasang semua adapter atau membeli akses model per karakter.
