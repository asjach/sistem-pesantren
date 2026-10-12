# AGENTS.md — SIMPES

## Aturan kerja
- UI & docs Bahasa Indonesia; `id` elemen snake_case (NFR-05).

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
> permintaan Anda. Verifikasi pakai `npm run typecheck` + `vendor/bin/pint
> --dirty`. Bilang saja bila mau saya cabut suspend-nya."

Saat suspend dicabut: sebutkan tes sudah aktif kembali dan dijalankan seperti
biasa. Pemberitahuan ini WAJIB muncul di respons, bukan hanya di ringkasan
internal.

## SUSPEND TES — SEMENTARA (berlaku sampai dicabut)

Status: **AKTIF sejak 2026-02-14** — tes frontend & backend dijeda atas
permintaan pengguna (dianggap memperlambat pengembangan). Tes tidak berjalan
otomatis di repo ini (tidak ada hook/CI/watch wajib); larangan ini berlaku pada
agen agar tidak menjalankannya atas inisiatif sendiri.

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
