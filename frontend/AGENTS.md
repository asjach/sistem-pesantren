# AGENTS.md — Frontend SIMPES (`admin-desktop-tauri`)

## Akun reviewer (AKTIF — jangan dibuat ulang/dihapus)
- Email: `reviewer.tmp@example.com`
- Password: `password`
- Nama: `Reviewer Sementara` — role `super_admin` (akses semua halaman).
- Status: **AKTIF** selama project belum production. Pakai untuk uji manual /
  Playwright lintas sesi; jangan buat/hapus tiap sesi.
- **Setiap sesi, beri tahu pengguna bahwa akun reviewer ini aktif.**
- Bila akun hilang akibat reset DB (`migrate:fresh`/seed) di backend, buat ulang
  dengan kredensial di atas (role `super_admin`), lalu lanjutkan seperti biasa.
- Non-aktifkan HANYA bila pengguna memerintahkan (cabut role `super_admin` di
  backend; akun tetap ada). Hapus/non-aktifkan permanen saat production.

## Aturan kerja
- UI Bahasa Indonesia; `id` elemen snake_case (NFR-05).
- Commit mengikuti aturan di `AGENTS.md` root (agen menawarkan commit tiap ±5
  permintaan yang mengubah file / sebelum perubahan besar).
- Playwright / browser otomatis wajib minta persetujuan pengguna dulu.
- Backend dev: `php artisan serve` (127.0.0.1:8000); frontend: `npm run dev`
  (127.0.0.1:1420). Boleh dinyalakan/dimatikan tanpa konfirmasi.
