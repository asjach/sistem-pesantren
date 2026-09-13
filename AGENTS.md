# AGENTS.md — SIMPES

## Aturan kerja
- UI & docs Bahasa Indonesia; `id` elemen snake_case (NFR-05).

## Aturan commit (pengingat otomatis)
Latar: pengguna mudah lupa commit — agen wajib menawarkan commit, bukan menunggu
diminta. Tawarkan lewat tool question (tampilkan daftar file berubah + usulan
pesan commit) hanya bila `git status` kotor dan salah satu pemicu ini terjadi:
1. Sudah **5 permintaan pengguna yang mengubah file** sejak commit terakhir
   (hitung hanya permintaan yang menghasilkan edit/tulis file, bukan tanya-jawab
   biasa; tawarkan sebelum melanjutkan permintaan berikutnya yang mengubah file).
2. Akan dimulai **perubahan besar**: > 5 file, diff besar (±150 baris),
   fitur/refactor baru, perubahan migrasi/skema/API, atau lintas modul.
3. Awal sesi baru masih ada perubahan belum ter-commit dari sesi sebelumnya
   (commit checkpoint dulu agar tidak tercampur pekerjaan baru).
4. Tugas selesai dan verifikasi lolos.

- Opsi tawaran: **Commit sekarang** (agen `git add` file terkait + commit dengan
  pesan usulan, lalu laporkan hash) atau **Nanti** (lanjut; hitungan direset 0).
- Format pesan: `<tipe>: <ringkasan Bahasa Indonesia>` — tipe: feat, fix, chore,
  docs, refactor, test, perf. Body berisi poin perubahan + hasil verifikasi
  (frontend: `npm run typecheck`/`build`; backend: tes terkait). Satu commit =
  satu perubahan logis; jangan mencampur fitur berbeda.
- Sebelum commit: inspeksi `git status` + `git diff`; dilarang commit rahasia/
  kredensial, screenshot sementara, dan artefak build.
- Setelah commit: laporkan hash + ringkasan singkat.

## Akun reviewer (AKTIF — jangan dibuat ulang/dihapus)
- Email: `reviewer.tmp@example.com`
- Password: `password`
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
