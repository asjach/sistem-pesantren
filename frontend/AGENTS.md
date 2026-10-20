# AGENTS.md — Frontend SIMPES (`admin-desktop-tauri`)

## TES AKTIF — suspend dicabut 2026-10-13
Tes (vitest) berjalan kembali sesuai aturan di bawah. Jalankan tes tersempit
untuk perubahan logika; jangan menjalankan dua runner vitest bersamaan
(rebutan memori). Suite penuh ditawarkan lebih dulu bila menyentuh modul
bersama (lihat "KEBIJAKAN MENJALANKAN TES" di root). Baseline bersih per
2026-10-15: kegagalan baru adalah regresi.
**Setiap sesi, beri tahu pengguna status tes** (aktif/suspend) — sama seperti
pengingat akun reviewer; lihat bagian "STATUS TES" di root.

## Aturan test (hanya logika)
- Tambah/perbarui `*.test.ts(x)` HANYA untuk perubahan logika (`src/lib`, `src/api`, hooks, transformasi/validasi/komputasi, state/filter/preset/toolbar yang bercabang).
- Tidak ada file yang otomatis mewajibkan test.
- Copy/teks, styling, layout TIDAK PERNAH wajib test.
- Bila test logika berlaku: `npm run test` tersempit + `npm run typecheck` hijau.
- Bila perubahan menyentuh **modul bersama** (mis. `components/ExcelTable.tsx`,
  `components/excel/**`, `api/*`, `index.css`, `components/ui/**`, `hooks/**`),
  **tawarkan suite penuh** ke pengguna lebih dulu — lihat "KEBIJAKAN
  MENJALANKAN TES" di `AGENTS.md` root.

## Akun reviewer (AKTIF — jangan dibuat ulang/dihapus)
- Email: `reviewer.tmp@example.com`
- Password: `rahayu45` (sama seperti seeder `AkunSeeder`; semua akun dev memakai ini)
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
- Timeline & perencanaan proyek: **Board satu-satunya sumber saat statusnya Aktif** (lihat aturan di `AGENTS.md` root); saat Draf jangan dipakai sebagai rujukan, dan jangan membuat roadmap/TODO/milestone terpisah.
- Commit mengikuti aturan di `AGENTS.md` root (jangan parafrase — ikuti 4 pemicu di sana).
- Playwright / browser otomatis wajib minta persetujuan pengguna dulu.
- Backend dev: `php artisan serve` (127.0.0.1:8000); frontend: `npm run dev`
  (localhost:1420). Boleh dinyalakan/dimatikan **tanpa** konfirmasi (ikut root).
