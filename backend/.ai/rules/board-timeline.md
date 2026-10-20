---
paths:
  - '**'
---

# Alur kerja dan perencanaan: Board

- **Alur kerja (workflow) berlaku per aplikasi dan hanya saat status efektifnya `Aktif`.** Status efektif = master `workflow_aktif` DAN penanda aplikasi `workflow_aktif:<aplikasi>`. Cek popover "Alur kerja (Workflow)" di `/board`, `GET /api/board`, `php artisan papan:lihat`, atau `papan_pengaturan`. **Bila ragu, anggap Draf.**
- **Saat efektif Aktif untuk aplikasi yang dikerjakan, Board adalah satu-satunya sumber alur kerja, prioritas, status, dan perencanaan aplikasi itu.** Sumber data: `backend/database/papan.sqlite` (koneksi `papan`), API `/api/board`, halaman `/board`.
- Jangan membuat atau memelihara roadmap, TODO, milestone, atau tabel gelombang terpisah di dokumen/file lain. PRD/arsitektur hanya memuat kebutuhan dan rancangan.
- Saat efektif Aktif, tulis rencana di Board sebagai aplikasi → modul → sub-modul → poin (status + daftar pemeriksaan/subpoin); buat modul baru bila area belum punya modul. Semua rencana baru masuk Backlog dan hanya pengguna yang memindahkannya ke To Do. To Do hanya menjadi pekerjaan agen bila alur kerja aplikasi tersebut efektif Aktif. Setelah mengubah rencana/status jalankan `php artisan papan:markdown --tulis`.
- `docs/PETA-MODUL.md` adalah turunan Board; jangan diedit manual. Saat efektif Aktif, Board menang bila ada konflik.
- Pengguna dapat menonaktifkan master/aplikasi kapan saja; bila Draf, berhenti memakai Board sebagai rujukan.

## Perilaku berdasarkan status

- **Aktif (master + aplikasi):** baca Board sebelum merencanakan; proses hanya To Do milik aplikasi yang alur kerjanya efektif Aktif. To Do hanya mengizinkan riset, bukan implementasi. Setelah riset, ajukan subpoin berupa hasil yang dapat diperiksa atau syarat selesai, beserta pertanyaan penting. Jika pekerjaan berdampak pada antarmuka, hasil riset wajib menyertakan rekomendasi tampilan dan pengalaman pengguna (UI/UX), termasuk keadaan utama antarmuka dan keselarasan dengan pola aplikasi; jika tidak, nyatakan **tidak ada dampak UI**. Poin tetap To Do sampai pengguna menyetujui subpoin final sekaligus mengizinkan pengerjaan. Setelah disetujui, simpan subpoin, pindahkan ke In Progress, lalu langsung kerjakan tanpa konfirmasi kedua. Maksimal satu In Progress per aplikasi. Pekerjaan selesai masuk For Review; hanya pengguna yang menetapkan Done.
- **Beberapa To Do:** dahulukan poin yang disebut pengguna; bila tidak ada, pilih poin paling atas pada aplikasi yang sedang dibahas. Bila poin terlalu besar, usulkan pemecahan dan tempatkan poin tambahannya di Backlog.
- **Draf (master mati atau aplikasi Draf):** gunakan PRD/kode sebagai rujukan; jangan memakai Board/PETA-MODUL aplikasi itu untuk alur kerja, prioritas, atau status; jangan menulis rencana baru ke Board; jangan menyimpulkan progres dari Board; jangan mengaktifkan sendiri. Perubahan Board hanya untuk tugas membangun/memperbaiki Board itu sendiri.
- **Lintas aplikasi:** hanya pakai alur kerja bila semua aplikasi yang terlibat efektif Aktif; jika ada yang Draf, perlakukan seluruh pekerjaan sebagai Draf (aman bila ragu/fail closed).
