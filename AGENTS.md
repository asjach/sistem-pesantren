# AGENTS.md — SIMPES

## Aturan kerja
- UI & docs Bahasa Indonesia; `id` elemen snake_case (NFR-05).
- Jangan commit tanpa diminta.

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
