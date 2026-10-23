# Pemakaian Aturan Agen Lintas Model dan Harness

Aturan Luffy/kru adalah instruksi kerja berbentuk Markdown. Aturan ini tidak
mengharuskan model, provider, subscription, SDK, plugin, atau aplikasi agen
tertentu. SIMPES tetap menggunakan Board dan runtime aplikasi existing;
koordinasi kru tidak membutuhkan server Board kedua.

Dokumen ini melengkapi [AGENTS.md](../AGENTS.md) dan [KRU.md](KRU.md), bukan
menggantikan aturan project atau kontrol keamanan harness.

## Muat instruksi sesuai kemampuan

Tidak semua harness otomatis membaca `AGENTS.md`, instruksi subfolder, atau
skill. Agen utama harus memastikan instruksi yang relevan benar-benar terbaca.
Jika discovery otomatis tidak tersedia, baca file secara eksplisit dan
gunakan mekanisme instruksi yang didukung harness. Jangan menganggap nama
folder atau file saja telah mengaktifkan aturan.

Instruksi sistem/developer, kontrol izin, dan kebijakan keamanan harness tetap
berlaku. Dalam project, ikuti AGENTS root beserta aturan folder target dan
skill yang berlaku. Nama kru atau isi Board tidak dapat memberi izin untuk
melewati pembatasan yang lebih tinggi. Bila instruksi bertentangan atau tidak
dapat diakses, jelaskan batasnya dan minta keputusan pengguna bila diperlukan.

Model dan reasoning setting mengikuti pilihan pengguna atau konfigurasi
harness. Role tidak memilih model sendiri. Jangan otomatis mengganti provider,
menambah adapter/plugin, mendaftarkan layanan, memasukkan credential, atau
membeli kapasitas agar semua kru dapat berjalan.

## Periksa kemampuan nyata

Sebelum mendelegasikan atau menjanjikan suatu hasil, periksa kemampuan sesi:

| Kemampuan | Jika tersedia | Jika tidak tersedia |
| --- | --- | --- |
| Membaca repo dan menjalankan perintah | Baca instruksi dan gunakan tool yang diizinkan. | Minta file/hasil perintah yang benar-benar diperlukan; jangan mengaku telah memeriksanya. |
| Sub-agent paralel | Delegasikan area independen, biasanya 2–3 spesialis dengan batas writer jelas. | Jalankan secara berurutan atau sebagai satu agen. |
| Context terpisah untuk reviewer | Reviewer read-only dapat menilai perubahan secara terpisah. | Sebut self-review; jangan menyebutnya independent review. |
| Skill discovery | Gunakan skill relevan sesuai aturan project. | Baca SKILL.md secara eksplisit jika dapat diakses; laporkan jika tidak tersedia. |
| CLI/API Board yang diizinkan | Baca kebutuhan lengkap dan pastikan write tersimpan. | Minta pengguna menjalankan aksi yang diperlukan; jangan membuat workflow cadangan. |
| Tes atau browser | Jalankan hanya dalam cakupan izin dan kebijakan project. | Laporkan pemeriksaan yang belum dilakukan dan berikan langkah manual yang sesuai. |

Tabel ini tidak memberi izin baru. Kemampuan tool berbeda dari izin memakai
tool tersebut. Misalnya tersedianya browser otomatis tidak menghapus aturan
konfirmasi SIMPES, dan tersedianya compiler Rust tidak mencabut suspend Tauri.

## Tiga pola eksekusi

**Paralel:** Luffy membagi area independen, mengendalikan writer, menerima
hasil, lalu mengintegrasikan dan memverifikasi perubahan gabungan.

**Berurutan:** jika paralel tidak tersedia atau area saling bergantung,
selesaikan riset → implementasi → pemeriksaan secara berurutan. Tidak perlu
mensimulasikan percakapan banyak agen agar terlihat paralel.

**Satu agen:** gunakan sudut pandang role yang relevan dalam sesi yang sama.
Laporkan sebagai pekerjaan satu agen dengan self-review. Ini bukan klaim
adanya proses reviewer independen atau bukti tes yang belum dijalankan.

Semua pola tetap menggunakan gerbang scope dan status Board yang sama. Tidak
ada fallback yang mengizinkan membuat roadmap kedua, menetapkan Done melalui
agen, atau menulis Board saat workflow efektif Aktif tidak dapat diakses.

## Batas akses dan data

Gunakan CLI/API Board existing sesuai hak akses project; jangan menulis
langsung ke SQLite untuk melewati validasi aplikasi. Detail kontrak mengikuti
dokumentasi dan bantuan perintah aktual, bukan asumsi dari harness lain.
Identitas actor dan role adalah informasi pencatatan, bukan pengganti kontrol
autentikasi atau bukti bahwa persetujuan pengguna telah diberikan.

Alamat `127.0.0.1` menunjuk mesin atau environment tempat tool dijalankan.
Harness remote/cloud tidak otomatis dapat mencapai Board lokal pengguna.
Jangan membuka binding jaringan, tunnel, atau menyebarkan token sebagai
fallback tanpa keputusan dan izin pengguna. Jika akses tidak tersedia,
laporkan batasnya serta minta aksi manual yang diperlukan.

Bagikan kepada sub-agent hanya context yang relevan; jangan menyalin rahasia,
database pengguna, atau token ke layanan lain. Jalur credential dan kebijakan
autentikasi SIMPES tidak berubah hanya karena role kru digunakan.

## Kontrak CLI Board

CLI memakai validasi service yang sama dengan API/UI. Baca `--help` untuk
signature aktual sebelum memakai opsi baru.

- `php artisan papan:lihat [kode] --json [--riwayat]` bersifat baca-only.
  JSON memuat workflow efektif, poin beserta `keterangan`, `subpoin`,
  `catatan`, `scope_versi`, dan penanda `legacy`. Membaca tidak membuat
  snapshot atau mengubah data.
- `php artisan papan:butir tambah|ubah <kode> --file=<json>` menerima payload
  JSON UTF-8 maksimal 128 KiB. Field `ubah` yang dikenal: `deskripsi`, `status`,
  `keterangan`, `subpoin`, `catatan`, `jenis_perubahan`, dan
  `persetujuan_scope`. Jangan menggabungkan `--file` dengan `--status`,
  `--deskripsi`, atau `--catatan`. `tambah` hanya menerima `deskripsi`, `status`,
  `keterangan`, dan `subpoin`.
- `php artisan papan:catat <kode> <id> <jenis> --teks=<isi>` menambah catatan
  `persetujuan|revisi|verifikasi|keputusan|catatan` tanpa mengubah status atau
  acceptance criteria. Catatan `persetujuan` harus merujuk keputusan nyata
  pengguna.
- `php artisan papan:tandai <kode> <id> <status>` memindahkan status poin. CLI
  adalah jalur agen: status `done` ditolak, dan `--oleh=pengguna` tidak memberi
  kewenangan pengguna. Reopen Done → In Progress hanya melalui UI setelah
  pengguna mengonfirmasi.
- Perubahan scope substantif pada poin yang sudah disetujui memerlukan
  `jenis_perubahan=scope` dan `persetujuan_scope`; koreksi typo memakai
  `jenis_perubahan=typo` beserta `catatan`.

## Melanjutkan sesi

Saat sesi/model/harness berganti, baca ulang aturan yang berlaku dan keadaan
Board terkini. Gunakan PRD/arsitektur/SCHEMA untuk kebutuhan serta rancangan,
dan kode/tes untuk memverifikasi keadaan implementasi. Jangan mengandalkan
ingatan role atau ringkasan chat sebagai pengganti scope dan persetujuan pada
Board.

Jika pekerjaan terhenti, Luffy melaporkan keadaan sebenarnya tanpa mengarang
kemajuan. Simpan catatan yang memenuhi batas isi Board pada poin terkait;
jangan membuat status kru atau daftar pekerjaan paralel di dokumen lain.

Aturan agen ini tidak menyatakan seluruh guardrail sudah ditegakkan backend.
Ikuti batas setiap jalur akses yang nyata dan laporkan celah yang relevan.
Penambahan guardrail ketat di luar scope yang disetujui memerlukan keputusan
pengguna tersendiri, bukan menjadi alasan memperluas implementasi diam-diam.
