# Operasi & Lampiran SIMPES (Part A — Bab 9–14 + Lampiran)

> Pecahan dari `PRD.md` (v2.56). changelog induk tetap di `PRD.md`.
> "Bab 1" → `PRD.md`; "Bab 2–8" → `arsitektur.md`; "§N" → `backend-detail.md`.


## 9. Manajemen Proyek (Hybrid Solo)

**Metode:** Fase-gate + Kanban WIP=1. Fondasi waterfall (`001–004` stabil dulu). Modul tarik 1-1 sesuai dependensi. Siklus 1 minggu: tarik → kerjakan → demo pengurus → done.
```
[001-004] ▶ [100-102] ▶ [200-203 subset] ▶ [UAT]
```

**Roadmap:**

| Gel. | ID-Modul | App | Status |
|---|---|---|---|
| G0 | 001-004 fondasi | Desktop | Production awal |
| G1 | 100 PSB Penerimaan, 101 Santri Master, 102 Siklus Santri | Desktop | Production awal |
| G2 | DITUNDA — menunggu perumusan ulang modul keuangan | — | Ditunda |
| G3 | 100 daftar, 203 Portal Wali subset | Mobile ortu | Production awal |
| G4+ | 200 Pegawai, 201 Kurikulum-Mapel, 202 Nilai-Rapor, 500-505, notif/gateway | Menyusul | Pasca, TBD |

Estimasi solo: G0 3–4 mgg; G1 4–5; G2 2–3; G3 3–4. Total G0–G3 ±4–5 bln.

| Peran | Tanggung jawab (RACI ringkas) |
|---|---|
| `super_admin` | A global |
| `admin` scoped | R lembaganya |
| `guru`, `orang_tua` | R input miliknya |
| Solo dev + QA | R bangun/uji |

| ID | Risiko | Mitigasi (kode) |
|---|---|---|
| R-01 | Tenant bocor | Cek `canAccessLembaga` + TC lintas lembaga (Modul 003) |
| R-03 | Excel berantakan | Bersihkan + staging (Modul 101, 003) |
| R-04 | Kasir non-komputer | Ditunda bersama G2 |
| R-05 | Scope creep | Kunci G0–G3 dulu |

**Aturan bisa berubah:** catat Masalah ke Usulan ke Dampak (skema/API/FE) ke putus (terima/tunda/tolak) ke tulis Lampiran E + naik versi `X.Y.Z`. Ubah UI tanpa ubah API: catat ringan. Ubah logika/skema: wajib analisis dampak paket/tenant/kontrak FE v1 (tambah opsional dulu, jangan breaking).

---

## 10. Rencana Pengujian (fokus G0–G3)

Unit, integrasi (Modul 100 PSB Penerimaan ke 101 Santri Master), sistem, UAT.

| ID | Modul (kode + nama) | Skenario | Harapan |
|---|---|---|---|
| TC-01 | 003 Auth Login | Login + throttle | 200/429 + audit |
| TC-02 | 003 Auth Login | Assign peran | Ditolak bila di luar hak |
| TC-05 | 101 Santri Master | Impor santri | Skip baris gagal |
| TC-06 | 102 Siklus Santri | Naik massal | Partial berhasil/gagal |
| TC-07 | 203 Portal Wali subset | Daftar + pengajuan | 1 aktif/santri |
| TC-08 | 003 Auth Login | Tenant lembaga | 403 lintas lembaga |

---

## 11. Penyebaran dan Migrasi Data

| Tahap | Aktivitas (kode + nama modul) |
|---|---|
| 11.1 | Staging ke production malam hari ke rollback backup (Modul 900 Deploy VPS, 901 Konfigurasi Produksi TBD) |
| 11.2 | Migrasi Excel per lembaga via `SantriLengkapImport` / `UsersImport` ke dedup `nik+nama+tgl_lahir` ke gabung ganda lintas lembaga ke staging ke verifikasi ke production (Modul 101 Santri Master, 003 Auth Login) |

| ID | Checklist |
|---|---|
| C-01 | UAT lulus |
| C-02 | `lembaga` / `tahun_ajaran` / `ref_*` / `kurikulum` terkonfigurasi |
| C-03 | Paket MI-MD terverifikasi |
| C-04 | Akun 5 peran sekarang teruji (peran `asrama` diuji saat Modul 505 / pasca production) |
| C-05 | Training/backup/SSL selesai |

---

## 12. Keamanan Sistem

| ID | Kontrol | Modul |
|---|---|---|
| K-01 | Bcrypt/argon2 | 003 Auth Login |
| K-02 | Guard `sanctum` + middleware `permission:` + tenant `canAccessLembaga` | 003 |
| K-03 | Transaksi terkunci | 102 |
| K-04 | Audit (`login_audits`, `psb_log_status`, `wali_portal_logs`) | 003, 100, 203 |
| K-05 | Backup offsite + SSL; privasi internal | 900/901 TBD |
| K-06 | Izin asrama (v1.10): mengikuti perumusan ulang modul keuangan | 505 |

---

## 13. Pelatihan dan Dokumentasi Pengguna

| Sesi | Peserta | App | Modul + Materi |
|---|---|---|---|
| 1 | `admin` | Desktop | 004, 100, 101, 102: referensi, PSB, santri/siklus |
| 2 | `kasir` | — | DITUNDA — menunggu perumusan ulang modul keuangan |
| 3 | `orang_tua` | Mobile ortu | 100, 203: daftar |

Manual per peran, video pendek, FAQ.

---

## 14. Pemeliharaan dan Dukungan

Garansi 3 bln; respons 1×24 jam. G4+ dibuka setelah G0–G3 stabil production.

---

## Lampiran A — ERD (Sumber Kebenaran)

Diagram Crow's Foot diringkas di Bab 6 (`arsitektur.md`) dan `docs/SCHEMA.md`. File visual menyusul; hingga ada, keduanya berlaku dengan interpretasi tipe logis.

## Lampiran C — Isu Terbuka / TBD

G4: Modul Guru (pegawai), Dokumen Guru/Santri, Absensi Guru (Modul 501 stub). G5: Laporan Keuangan (menunggu perumusan ulang modul keuangan), Input Nilai tanpa rapor (Modul 202 subset). G6: Statistik Pengurus (Modul 504 ringkas). G7: Absen Santri (500), **Asrama (505 — gambaran umum v1.10: entitas `asrama`+`user_asrama`+peran `asrama`; PASCA PRODUCTION, tidak dikerjakan dalam waktu dekat)**, Tahfizh (503), Rapor (202). G8: Notifikasi, Pengumuman, Gateway, Fingerprint (belum ada). Fase 3–4 cadangan.

TBD khusus asrama (v1.10 — semua pasca production):
- Implementasi asrama tidak dalam waktu dekat; tidak ada tabel/peran/pivot dibuat sekarang.
- Yang perlu dijaga sekarang agar tidak menutup jalan: peran baru cukup ditambah saat itu.
- Perubahan `santri` (`lembaga_id` nullable, `status_global` turunan) **bukan** bagian asrama — **sudah diimplementasikan** (v1.10.2).
- Presensi kegiatan asrama: `sesi_presensi.kategori` sudah ada, tetapi `presensi_santri.kelas_id` masih NOT NULL — perlu penyesuaian skema sebelum dipakai.
- Tarif beda antar-asrama (putra/putri) belum diakomodasi; menunggu perumusan ulang modul keuangan.
- Bentuk tabel kamar/penghuni/izin/kegiatan masih **gambaran umum**, bisa berubah saat implementasi.

## Lampiran D — Glosarium (Opsi A)

SIMPES; santri; lembaga (MI=SD formal, MD=SD non-formal paralel, MTS=SMP, MLN=Aliyah beda nama; kode hardcoded; PK id INT); tahun_ajaran; kelas; pegawai/guru; 6 peran (`super_admin, admin, guru, orang_tua, santri, asrama` — efektif 5 sekarang; `asrama` pasca production, `kasir` dihapus sementara v2.38); PSB (`is_seleksi`); riwayat_belajar; asrama (entitas sendiri — bukan `lembaga`; kamar, penghuni, izin pulang, kegiatan; pasca production); pengurus asrama (peran `asrama` + pivot `user_asrama`); santri legacy (tanpa jejak riwayat).

## Lampiran E — Catatan Perubahan Aturan

| Tgl | Aturan | Sebelum ke Sesudah | Alasan | Dampak |
|---|---|---|---|---|
| 2026-09-10 | Bab 2.2 poin 1 | Paket wajib ke opsional (MI/MD mandiri boleh) | Fleksibilitas SD | Bab 3 FR-100, Bab 4.1 |
| 2026-09-10 | Bab 2.2 poin 2 | `psb_butuh_seleksi_default` ke `lembaga.is_seleksi`; override null ikut default | Sederhanakan nama | Modul 002, 004, 100; kontrak FE |
| 2026-09-10 | Bab 2.2 poin 3 | `MUA` ke `MLN`; istilah beku ke hardcoded; PK tetap id INT | Samakan singkatan | Seed kode, nomor PSB, filter FE |
| 2026-09-10 | Bab 2.2 poin 4 | Fallback tambah placeholder bila root null | Kop dokumen G0 | Profil lembaga, kuitansi |
| 2026-09-10 | OFF-01 s/d OFF-10 | Online-only ke online-first + SQLite lokal (detail Lampiran F) | PC putus-nyambung | Kontrak FE, API bayar (`client_op_id`), SOP kasir |
| 2026-09-10 | status_awal | `naik_kelas` ke `kenaikan`; ACC dari flag `is_pindahan`; `masuk_tingkat` per jenjang; `tidak_lulus` buka baris mengulang | Putusan domain | 100/102, seeder, tests |
| 2026-09-10 | sesi 2a-2d, 4a | Token per-device; staf 30 hari / murni ortu-santri 365 hari; revokasi saat peran berubah; `logout-all`; prune harian; SQLite tanpa enkripsi (SOP akun OS + kunci layar) | PC admin + HP hilang | AuthController, UserManagement, scheduler, tests |
| 2026-09-11 | kunci role diri | Bebas ubah role sendiri ke 403 semua peran (`update` key `roles` + `assignRole`; `removeRole` sudah 403); admin tetap tak bisa beri `admin/super_admin` | Admin tak bisa naikkan diri; super_admin pun terkunci | UserManagement, tests, FE users |
| 2026-09-11 | auto-attach lembaga | Buat lembaga tanpa auto-akses ke scoped pembuat auto-attach pivot (full/super_admin tidak di-attach) | Lembaga baru langsung bisa dikelola pembuatnya | LembagaController, tests, FE lembaga |
| 2026-09-11 | anti-eskalasi admin | Admin bisa hapus super_admin / tambah role ke super_admin / tambah lembaga ke tutup: mutasi target pemegang `admin/super_admin` (update/assign/remove/attach/detach/destroy) 403 bila actor bukan super_admin; `store` lembaga 403 bila bukan super_admin (gantikan auto-attach v1.9.1) | Hanya super_admin kelola admin & lembaga | UserManagement, LembagaController, tests, FE users/lembaga |
| 2026-09-14 | buat admin oleh admin | Larangan role `admin` dilonggarkan **khusus create**: `admin` (full/scoped) boleh membuat user ber-role `admin`, lembaga ⊆ kewenangannya (boleh subset; scoped tanpa `lembaga_ids` = pivot sendiri, tak bisa jadi admin global). Jalur update/assignRole/removeRole/import tetap dilarang; admin tetap tak bisa memutasi sesama/admin | admin_lembaga bisa menambah admin di lembaganya tanpa menunggu super_admin | UserManagement (`creatableRolesFor`), UserRoleGuardTest, FE users |
| 2026-09-14 | desain santri & asrama (v1.10, gambaran umum) | (1) `santri.lembaga_id` NOT NULL → **nullable** = legacy tanpa track, terlihat **semua admin**, sumber kebenaran lembaga = `riwayat_belajar`; (2) `status_global` default true + hardcode → **turunan murni** default false (= punya ≥1 riwayat aktif); (3) asrama dari flag biaya di lembaga → **entitas sendiri** (bukan `lembaga`) + peran `asrama` (6 → 7 peran) + pivot `user_asrama`, super_admin saja; (4) keuangan asrama ditandai lewat `pos_keuangan.kategori` | Data lama tanpa jejak riwayat/pembayaran perlu hidup tanpa tenant; kepengurusan asrama terpisah dari lembaga | SCHEMA (santri, pos_keuangan, BLOK 11), PRD 2.3/4.2/4.6/6/8.2/12, policy/tenant scope 101, seeder peran, tests |
| 2026-09-14 | lingkup asrama (v1.10.1) | Asrama (505) dipastikan **pasca production** — tidak dikerjakan dalam waktu dekat, tidak ada tabel/peran/pivot sekarang. Poin (1)(2) di atas (santri legacy/status_global) dipisah dari asrama dan dibahas sendiri | Fokus G0–G3 production; desain dicatat agar sistem sekarang mendekati bentuk akhir tanpa menutup jalan | Lampiran C, PRD 1.2/2.3/3.1/4.6/5.2/6.6/8.2.5, SCHEMA BLOK 11 |

## Lampiran F — Keputusan Offline (terkunci v1.4)

Scope: desktop admin + kasir (nanti). Mobile ortu wajib online (tanpa lapisan offline).

| ID | Keputusan |
|---|---|
| OFF-01 | SQLite lokal = replika baca + draft; MySQL server satu-satunya sumber kebenaran; tanpa sync-engine dua-arah |
| OFF-02 | Baca-lokal + sync bertingkat: struktural 60 mnt, kamus 60 mnt full-pull, tarif 30 mnt, santri list 10 mnt (detail live), users 10 mnt full-pull, status transaksi 2 mnt + refresh fokus/pasca-tulis; delta via `updated_since` (endpoint baru, kecil) |
| OFF-03 | Pemicu sync: login penuh (jaminan minimal), interval, tutup best-effort, pasca-tulis, reconnect, manual |
| OFF-04 | Online = live langsung; offline = fallback SQLite + banner + timer dashboard sejak `last_seen_server` + label basi; tulis transaksi mati |
| OFF-05 | Login-offline: verifier perangkat 30 hari, semua peran, password tiap buka, salah 5x kunci 5 mnt, akun baru/PC baru/kedaluwarsa wajib online, revokasi berlaku online-berikutnya |
| OFF-06 | Token: staf 30 hari, murni `orang_tua/santri` 365 hari, nama per-device; auto-login desktop admin+kasir; revokasi saat peran berubah + `logout-all`; prune harian; pencabutan berlaku seketika saat online |
| OFF-07 | Opsi B payment-intent: snapshot-only, nominal fixed, nomor `LOKAL-*` + struk SEMENTARA, 1 pintu, tutup-hari terkunci, dorong per-item via API bayar + `client_op_id`, void/ACC final online-only |
| OFF-08 | Perubahan tarif/pos tulis-hanya-online (pull 30 mnt) |
| OFF-09 | Tanpa merge otomatis: tolak 409 `{kode, alasan, server_state, bisa_aksi[]}`, pilih manual per item + audit pilihan |
| OFF-10 | Validasi server tak berubah (tenant, peran, ref efektif, kuota, kunci billing, counter) |

TBD (tidak dikunci): enkripsi SQLite, bentuk endpoint delta, LAN-fallback, UAT chaos.

## Lampiran G — Operasional Agen (indeks; salinan dari AGENTS.md + `.opencode/`)

> Catatan penyimpanan: `AGENTS.md` (root/backend/frontend) ikut repo; `.opencode/`
> masuk `.gitignore` (konfigurasi lokal — tidak terbawa clone). Lampiran ini
> memastikan isi operasional penting tetap terdokumentasi di PRD.

### G.1 Aturan tetap agen
- UI & docs Bahasa Indonesia; `id` elemen `snake_case` (NFR-05).
- Commit: agen wajib menawarkan (bukan menunggu diminta) hanya bila `git status`
  kotor DAN salah satu pemicu: (1) pindah topik — tawarkan SEBELUM eksekusi topik
  baru; (2) ±5 permintaan berfile sejak commit terakhir; (3) akan ada perubahan
  besar (>5 file / ±150 baris / fitur-migrasi-API / lintas modul); (4) sisa kotor
  sesi sebelumnya di awal sesi baru. Format `<tipe>: <ringkasan Indonesia>`,
  satu commit = satu perubahan logis; tanpa rahasia/artefak.
- Akun reviewer `super_admin` AKTIF selama pra-production (detail kredensial di
  `AGENTS.md` root; dibuat ulang bila hilang akibat reset DB; dinonaktifkan
  permanen saat production).
- Playwright/browser otomatis wajib persetujuan pengguna; nyala/mati
  `artisan serve` + `vite dev` boleh tanpa konfirmasi; hapus screenshot
  sementara di root repo boleh tanpa konfirmasi.
- Backend: ikuti panduan Laravel Boost (`backend/AGENTS.md`); migrasi via
  `php artisan make:*`; gaya via Pint; uji via PHPUnit (narrowest dulu).

### G.2 Slash command lokal (`command/`)
- `/ui-review` — proses anotasi visual UI + console error lalu perbaiki per nomor;
  input berupa JSON anotasi tempelan (`elemen[]` + `gambar[]`); verifikasi
  `typecheck` + `build` (+ test backend bila tersentuh); tutup dengan ringkasan
  selesai vs butuh klarifikasi.

### G.3 Skills aktif (`skills/`) — dipakai saat pemicunya muncul
| Skill | Dipakai saat |
|---|---|
| `laravel-best-practices` | Tulis/review/refactor kode Laravel (controller, model, migrasi, policy, job, query) |
| `shadcn` | Tambah/cari/perbaiki komponen shadcn, registri, preset |
| `ui-styling` | Bangun UI shadcn/Tailwind, tema, dark mode, layout responsif |
| `ui-ux-pro-max` | Desain/review/perbaiki antarmuka + aksesibilitas + tipografi + chart |
| `design-system` | Token desain, spesifikasi komponen, slide strategis |
| `design` | Logo, CIP + mockup, slide, banner, ikon, foto sosial |
| `banner-design` | Banner sosmed/iklan/hero/cetak |
| `slides` | Presentasi HTML + Chart.js |
| `brand` | Voice, identitas visual, kepatuhan brand |
| `tauri-v2` | Konfigurasi Tauri, command Rust, IPC, permissions, build desktop/mobile |
| `vercel-react-best-practices` | Optimasi performa React/Next.js |
| `find-skills` | Cari/install skill baru saat butuh kemampuan tambahan |

## Pembahasan Selanjutnya (sesi baru)

- v1.4 paket offline terkunci. Next: scaffold Tauri / backend 100 (sesuai pilihan).

---
