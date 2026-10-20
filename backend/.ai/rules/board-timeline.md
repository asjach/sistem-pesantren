---
paths:
  - '**'
---

# Timeline & perencanaan: Board

- **Timeline berlaku per aplikasi dan hanya saat status efektifnya `Aktif`.** Status efektif = master `timeline_master_aktif` DAN flag aplikasi. Cek popover "Timeline" di `/board`, `GET /api/board` (`timeline_master_aktif` + `aplikasi[].timeline_efektif`), `php artisan papan:lihat`, atau `papan_pengaturan` (`timeline_aktif` + `timeline_aktif:<aplikasi>`). **Bila ragu, anggap Draf.**
- **Saat efektif Aktif untuk aplikasi yang dikerjakan, Board adalah satu-satunya sumber timeline, prioritas, status, dan perencanaan aplikasi itu.** Sumber data: `backend/database/papan.sqlite` (koneksi `papan`), API `/api/board`, halaman `/board`.
- Jangan membuat atau memelihara roadmap, TODO, milestone, atau tabel gelombang terpisah di dokumen/file lain. PRD/arsitektur hanya memuat kebutuhan dan rancangan.
- Saat efektif Aktif, tulis rencana di Board sebagai aplikasi → modul → sub-modul → poin (status + subpoin checklist); buat modul baru bila area belum punya modul. Baca Board sebelum merencanakan; setelah mengubah rencana/status jalankan `php artisan papan:markdown --tulis`.
- `docs/PETA-MODUL.md` adalah turunan Board; jangan diedit manual. Saat efektif Aktif, Board menang bila ada konflik.
- Pengguna dapat menonaktifkan master/aplikasi kapan saja; bila Draf, berhenti memakai Board sebagai rujukan.

## Perilaku berdasarkan status

- **Aktif (master + aplikasi):** baca Board sebelum merencanakan; tulis semua rencana/perubahan status ke Board pada modul yang sesuai (atau buat modul baru); regenerasi PETA-MODUL; Board menang atas dokumen lain.
- **Draf (master mati atau aplikasi Draf):** gunakan PRD/kode sebagai rujukan; jangan memakai Board/PETA-MODUL aplikasi itu untuk timeline, prioritas, atau status; jangan menulis rencana baru ke Board sebagai timeline; jangan menyimpulkan progres dari Board; jangan mengaktifkan sendiri. Perubahan Board hanya untuk tugas membangun/memperbaiki Board itu sendiri.
- **Lintas aplikasi:** hanya pakai timeline bila semua aplikasi yang terlibat efektif Aktif; jika ada yang Draf, perlakukan seluruh pekerjaan sebagai Draf (fail closed).
