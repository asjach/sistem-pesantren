---
paths:
  - '**'
---

# Timeline & perencanaan: Board

- **Timeline hanya berlaku saat status Board `Aktif`.** Cek badge "Timeline: Aktif/Draf" di `/board` atau field `timeline_aktif` pada `GET /api/board`. Saat `Draf`, Board belum menjadi rujukan; jangan mengaktifkannya sendiri — minta konfirmasi pengguna.
- **Saat Aktif, Board adalah satu-satunya sumber timeline, prioritas, status, dan perencanaan proyek.** Sumber data: `backend/database/papan.sqlite` (koneksi `papan`), API `/api/board`, halaman `/board`.
- Jangan membuat atau memelihara roadmap, TODO, milestone, atau tabel gelombang terpisah di dokumen/file lain. PRD/arsitektur hanya memuat kebutuhan dan rancangan.
- Saat Aktif, tulis rencana di Board sebagai aplikasi → modul → sub-modul → poin (status + subpoin checklist); buat modul baru bila area belum punya modul. Baca Board sebelum merencanakan; setelah mengubah rencana/status jalankan `php artisan papan:markdown --tulis`.
- `docs/PETA-MODUL.md` adalah turunan Board; jangan diedit manual. Saat Aktif, Board menang bila ada konflik.
- Pengguna dapat menonaktifkan timeline kapan saja; bila Draf, berhenti memakai Board sebagai rujukan.
