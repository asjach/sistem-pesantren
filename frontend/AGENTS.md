# AGENTS.md — Frontend SIMPES (`admin-desktop-tauri`)

## TES AKTIF — suspend dicabut 2026-10-13
Tes (vitest) berjalan kembali sesuai aturan di bawah. Jalankan tes tersempit
untuk perubahan logika; jangan menjalankan dua runner vitest bersamaan
(rebutan memori). Suite penuh ditawarkan lebih dulu bila menyentuh modul
bersama (lihat "KEBIJAKAN MENJALANKAN TES" di root). Baseline bersih per
2026-10-15: kegagalan baru adalah regresi.
**Setiap sesi, beri tahu pengguna status tes** (aktif/suspend) — sama seperti
pengingat akun reviewer; lihat bagian "STATUS TES" di root.

## Aturan test (logika + UI)

Rujukan wajib: `../docs/KEBIJAKAN-TES-UI.md` — tingkat tes, pola query/mock,
stub DSG, batas jsdom, dan checklist manual/browser.

- Tes **logika** wajib untuk perubahan percabangan, validasi, komputasi,
  transformasi, state/filter/preset/toolbar yang bercabang (`src/lib`, `src/api`,
  hooks).
- Tes **UI** dipakai untuk mengunci kontrak perilaku komponen bersama
  (interaksi, state tampil, empty/loading/error, keyboard/focus, accessible
  name/role) dan wiring halaman. Bukan untuk copy/teks, styling, layout, pixel,
  atau snapshot.
- Kontrak komponen bersama diuji sekali di komponennya; page test mem-mock
  komponen bersama atau hanya menguji wiring unik halaman.
- Tidak ada file yang otomatis mewajibkan test; yang menentukan adalah logika
  atau kontrak yang berubah.
- Gunakan `renderDenganTema` untuk provider, `_dsgStubDom` untuk DSG,
  role/label sebelum `data-testid`, `userEvent` untuk alur pengguna, dan
  `findBy*`/`waitFor` tanpa sleep tetap. `act(...)` warning adalah utang;
  perbaiki saat tes terkait disentuh.
- Bila tes berlaku: `npm run test` tersempit + `npm run typecheck` hijau.
- Bila perubahan menyentuh **modul bersama** (mis. `components/excelV2/ExcelTabelV2.tsx`,
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
- Istilah teknis (thumb, track, scrollbar, row, column, header, cell, render, dst.) tetap bahasa Inggris — lihat "ISTILAH TEKNIS" di `AGENTS.md` root.
- Alur kerja (workflow) & perencanaan proyek: **Board satu-satunya sumber saat statusnya Aktif** (lihat aturan di `AGENTS.md` utama/root); saat Draf jangan dipakai sebagai rujukan, dan jangan membuat peta jalan (roadmap), daftar pekerjaan (TODO), atau target tahap (milestone) terpisah.
- Commit mengikuti aturan di `AGENTS.md` root (jangan parafrase — ikuti 4 pemicu di sana).
- Playwright / browser otomatis wajib minta persetujuan pengguna dulu.
- Backend dev: `php artisan serve` (127.0.0.1:8000); frontend: `npm run dev`
  (localhost:1420). Boleh dinyalakan/dimatikan **tanpa** konfirmasi (ikut root).
