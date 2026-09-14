# Dokumentasi Proyek — Sistem Informasi Manajemen Pesantren (SIMPES)

| Atribut | Keterangan |
|---|---|
| Versi Dokumen | 1.9.7 (tabel master ExcelTable + font offline + desktop 0.5.0) |
| Tanggal | 10 September 2026 |
| Status | Proyek ini = menyusun dokumentasi, bukan coding app. G0–G3 didetailkan; G4+ roadmap |
| Penyusun | Solo dev + Yayasan |
| Arsip acuan (read-only) | `Step-By-Step Sistem Pesantren/Backend/` + `Frontend/admin-flutter-desktop/docs/` |
| Skema versi | Major restruktur = X.0; final 1 bab = X.Y; kecil docs = X.Y.Z |

> **Konvensi.** Bahasa Indonesia persis DB. Logika saja, tanpa kode mentah, format kode + nama modul. Tanpa asumsi umum. Aturan bisa berubah via Lampiran E. Penulisan Bab 3 (tanpa simbol paragraf).

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 2026-09-10 | Baseline restrukturisasi; arsip dibekukan; G0–G3 production |
| 1.1 | 2026-09-10 | Final Bab 2–7 (tabel ID-Modul, FR/NFR English, UC, asumsi/batasan) |
| 1.1.1 | 2026-09-10 | Bab 8 ke tabel ID-Modul (kecil docs) |
| 1.1.2 | 2026-09-10 | Bab 9 ke tabel + perbaiki RACI admin (kecil docs) |
| 1.1.3 | 2026-09-10 | Bab 10 pisah Modul + sisip TC-07 portal (kecil docs) |
| 1.1.4 | 2026-09-10 | Bab 11-14 + Lampiran B ke tabel, perbaiki admin (kecil docs) |
| 1.2 | 2026-09-10 | Verifikasi akhir Lampiran A-E; perbaiki baris TBD (minor) |
| 1.3 | 2026-09-10 | Pindah ke root docs/PRD.md + gabung backend PRD Part B (minor) |
| 1.3.1 | 2026-09-10 | docs/SCHEMA.md baru + migration per-modul 15 file, hapus single-file (patch) |
| 1.3.2 | 2026-09-10 | attach/detach lembaga, resolve fallback, 3 bug referensi, dashboard terdokumentasi, .env.example MySQL (patch) |
| 1.4 | 2026-09-10 | Kunci paket offline OFF-01 s/d OFF-10 (minor) |
| 1.5 | 2026-09-10 | Modul 100 PSB full live: 69 routes, 10 tests hijau; is_seleksi ganti psb_butuh_seleksi_default (minor) |
| 1.6 | 2026-09-10 | Modul 101 Santri live: policy+kamus+import+CRUD, 10 tests hijau, suite 22/22 (minor) |
| 1.7 | 2026-09-10 | Modul 102 Siklus live: service+8 endpoint, 9 tests hijau, suite 31/31; gerbang AND target (minor) |
| 1.7.1 | 2026-09-10 | status_awal final: kenaikan (naik), is_pindahan+masuk_tingkat PSB, tidak_lulus buka mengulang (patch) |
| 1.8 | 2026-09-10 | Sesi: token per-device, staf 30 hari / ortu-santri 365 hari, revokasi saat peran berubah, logout-all, prune harian; SQLite tanpa enkripsi (minor) |
| 1.9 | 2026-09-10 | Modul 103 transaksi live: generate+bayar+void, kuitansi PDF+thermal, client_op_id, 10 tests hijau, suite 49/49 (minor) |
| 1.9.1 | 2026-09-11 | Kunci role diri (update+assign 403 semua peran, admin tak bisa buat admin), auto-attach pivot buat lembaga, FE users (opsi+kelola role/lembaga) + tambah lembaga; 8 tests hijau, suite 57/57 (patch) |
| 1.9.2 | 2026-09-11 | Anti-eskalasi: non-super_admin 403 mutasi/hapus pemegang admin/super_admin (update/assign/remove/attach/detach/destroy), tambah lembaga hanya super_admin (gantikan auto-attach v1.9.1); FE kunci baris privileged + form lembaga super_admin-only; 12 tests hijau, suite 61/61 (patch) |
| 1.9.3 | 2026-09-11 | Desktop Tauri: src-tauri asli (store plugin, id pesantren), token/base-URL via plugin-store + halaman Pengaturan (ganti backend tanpa rebuild), bundle macOS .app + .dmg aarch64 VALID & jalan; CI Win/Linux tunda (patch) |
| 1.9.4 | 2026-09-11 | Design overhaul FE v0.4.0: tokens + komponen (toolbar, table-wrap, badge/chip, check-pills, alert), layout responsif, empty-state semua tabel; tanpa ubah logika/API; dmg rebuilt (patch) |
| 1.9.5 | 2026-09-11 | Pause desktop: hapus `src-tauri/target` (±1 GB) + `.app/.dmg`; source Tauri tersimpan, resume via `tauri:build`; percobaan web-only (patch, docs-only) |
| 1.9.6 | 2026-09-11 | Migrasi FE v0.5.0 ke Tailwind v4 + shadcn (10 komponen Radix): galeri 20 tema Top Populer ala VSCode data-driven (`src/themes.ts`, palet resmi) + kustom, teks tombol otomatis via `onAccentFor` (40/40 pasang ≥4.5:1), border global lembut (12% via color-mix, tanpa shadow kartu) + mode Gelap/Terang/Sistem per perangkat, galeri kartu pratinjau, Ctrl/Cmd+B sidebar, grid Excel `react-data-grid` pin beta.40 (resize kolom persist, density + drag tinggi baris, checkbox + salin TSV, kolom Aksi Lihat/Ubah/Hapus role-gated, ikut 20 tema; sorting off, seleksi per halaman) untuk 6 tabel master, form tambah 6 halaman jadi modal + tombol kanan atas, pagination semua list, dialog/toast/skeleton, favicon, catch-all, min window; QA build + kontras + screenshot; tanpa ubah backend/API (patch) |
| 1.9.7 | 2026-09-11 | Tabel master pindah ke `react-datasheet-grid` (wrapper `ExcelTable`, 6 halaman): 3 lib tabel lama + CSS-nya dicabut (react-data-grid/ag-grid/react-data-table-component) dan `ViewDialog` dipisah; seleksi gaya spreadsheet (outline 1px tunggal menimpa garis grid, tint, header kolom + nomor baris tersorot, lubang jangkar hanya saat edit); resize kolom 1:1 + AutoFit (klik 2× gagang, tombol semua kolom, otomatis saat muat & saat font berubah) + resize serentak untuk multi-kolom terseleksi; edit klik-2× langsung tersimpan (`quickEditRef` + simpan satu baris); toolbar satu baris (cari+filter+kontrol+tambah) dengan grup fungsi (mode edit/tampilan/alat/draft), petunjuk pindah ke tooltip; kontrol global ukuran huruf, tinggi baris, dan jenis huruf (9 font sistem + 8 Google Fonts **offline**: 32 `@font-face` dari `src/assets/fonts`, 1,4 MB, skrip `scripts/fonts-offline.py`; isi tabel saja, header tetap `--font-display`); garis kolom & baris terakhir digambar di dalam sel; label tombol jadi "+ Pengguna"/"+ Tahun Ajaran"/dst; desktop Tauri 0.5.0 dibangun ulang (`.app` 11 MB, `.dmg` 4 MB, font ter-embed); tanpa ubah backend/API (patch) |
| 1.10 | 2026-09-14 | Desain (gambaran umum, bisa berubah; docs-only): `santri.lembaga_id` boleh NULL = legacy tanpa track (sumber kebenaran lembaga = `riwayat_belajar`, kolom jadi cache), terlihat semua admin; `santri.status_global` turunan murni default false (= punya ≥1 riwayat aktif); asrama = entitas sendiri (bukan `lembaga`) + peran `asrama` (7 peran) + pivot `user_asrama`; keuangan asrama ditandai lewat `pos_keuangan.kategori` (matriks izin: generate dari lembaga, update hanya pos asrama, delete admin lembaga); presensi/kegiatan asrama ditunda (TBD) |
| 1.10.1 | 2026-09-14 | Klarifikasi lingkup (docs-only): **Asrama (505) = rencana PASCA PRODUCTION** (tidak dikerjakan dalam waktu dekat; tidak ada tabel/peran/pivot dibuat sekarang). Desain dicatat sebagai arah agar keputusan sekarang tidak menutup jalan; perubahan `santri` (legacy/`status_global`) dibahas terpisah dari asrama |
| 1.10.2 | 2026-09-14 | Implementasi bagian **santri** v1.10 (bukan asrama): `santri.lembaga_id` nullable + FK nullOnDelete (legacy tanpa track), `status_global` turunan murni default false + backfill dari riwayat aktif, legacy terlihat semua admin (scope/policy/otorisasi), penempatan kelas & kenaikan mengadopsi lembaga saat NULL, import tidak hardcode `true`; tes baru legacy + adopsi; suite 113/113 hijau |
| 1.10.3 | 2026-09-14 | Input manual santri (legacy) via `POST /admin/santri` + aturan lembaga: admin scoped 1 lembaga → otomatis, admin rangkap/full/super → opsional (null = legacy); import Excel mendukung `lembaga_id` per baris & tanpa lembaga (tanpa riwayat), tahun ajaran wajib hanya bila lembaga diisi; **template Excel** `GET /admin/santri/import-template` (semua kolom profil + `lembaga_id`, sel bertipe teks) + tombol unduh di dialog Import; FE dialog Tambah; suite 116/116 hijau |

## Daftar Isi

1. Pendahuluan
2. Gambaran Sistem
3. Analisis Kebutuhan
4. Model Proses Bisnis
5. Perancangan Sistem
6. Perancangan Basis Data
7. Perancangan Antarmuka
8. Implementasi (rencana dokumen)
9. Manajemen Proyek (rencana dokumen)
10. Rencana Pengujian
11. Penyebaran dan Migrasi Data
12. Keamanan Sistem
13. Pelatihan dan Dokumentasi Pengguna
14. Pemeliharaan dan Dukungan
- Lampiran A — ERD (sumber kebenaran)
- Lampiran B — Matriks Ketertelusuran ke Arsip
- Lampiran C — Isu Terbuka / TBD
- Lampiran D — Glosarium
- Lampiran E — Catatan Perubahan Aturan

---

## 1. Pendahuluan

### 1.1 Tujuan Dokumen

Proyek ini menyusun Project Documentation SIMPES (bukan coding app). Dokumen ini acuan tunggal: kebutuhan, proses, rancangan, rencana uji/penyebaran, plus lampiran ketertelusuran ke arsip. Kriteria selesai per bab: ringkas, logika terverifikasi ke arsip/keputusan, TBD eksplisit.

### 1.2 Latar Belakang

Pengelolaan santri, keuangan, akademik, dan operasional masih manual/spreadsheet:

- Data santri (biodata, dokumen, riwayat belajar) tersebar.
- Tagihan SPP dan pembayaran rawan salah catat.
- Nilai, kurikulum, dan induk santri tidak terintegrasi per lembaga.
- Komunikasi orang_tua/wali tidak real-time.
- Pimpinan sulit mendapat laporan per lembaga maupun gabungan.

Pesantren menaungi beberapa lembaga — MI, MD, MTs, Mu'allimin — dalam satu pesantren (root `lembaga kode=PESANTREN`). Tiap lembaga punya `tahun_ajaran`, `kurikulum`, `kelas`, pegawai, dan `tarif_biaya` sendiri; sebagian santri aktif di >1 lembaga (mis. MTS + MD, paket MI-MD).

**Asrama bukan `lembaga`** (v1.10, **implementasi pasca production**): asrama punya kepengurusan, gedung, kamar, dan siklus penghuni sendiri; didaftarkan sebagai entitas `asrama` + peran `asrama` + pivot `user_asrama` (Modul 505). Santri asrama tetap terikat lembaga akademiknya untuk urusan akademik/PSB; keuangan asrama ditandai lewat `pos_keuangan.kategori`. Tidak ada tabel/role/pivot asrama yang dibuat sekarang — desain ini arah agar sistem sekarang mendekati bentuk akhirnya.

**Santri legacy:** `santri.lembaga_id` boleh NULL untuk data lama yang lembaganya tidak punya jejak `riwayat_belajar`/mutasi/kenaikan/pembayaran. Sumber kebenaran lembaga adalah `riwayat_belajar`; kolom ini cache terakhir dan diisi saat penempatan kelas. `status_global` bukan input manual — turunan "punya ≥1 riwayat aktif" (default nonaktif sampai ditempatkan).

### 1.3 Tujuan Proyek

1. Sistem terpusat untuk santri, pegawai/guru, dan pengguna lintas lembaga via model single-pesantren (`lembaga`).
2. Digitalisasi PSB 2-jalur, santri, siklus/riwayat, dan keuangan per lembaga.
3. Akademik (kurikulum, mapel, pengampu, nilai, rapor) dengan pivot `kurikulum_mapel`.
4. Kepegawaian (master, keaktifan, walas, sertifikasi).
5. Portal wali read-only + pengajuan.
6. Laporan real-time per lembaga + gabungan dengan tenant ketat.
7. Admin scoped mandiri per lembaga namun terintegrasi.

### 1.4 Ruang Lingkup

**Production awal (G0–G3, prioritas):**
- G0: auth, referensi/master (001–004). Desktop admin_lembaga (pengganti Excel).
- G1: PSB, santri (kelas, mutasi, naik, lulus), keuangan dasar (100–103). Desktop.
- G2: input keuangan mobile (subset 103, tombol besar untuk kasir non-komputer).
- G3: ortu mobile (daftar + history bayar; subset 100/103/203). Setelah ini production.

**Pasca (detail ditunda, kecuali ada di arsip):**
- G4: guru, dokumen guru/santri, absensi guru. G5: laporan keuangan, input nilai (tanpa rapor). G6: pengurus mobile (statistik). G7: absen santri, asrama (**Modul 505 sudah digambarkan** — entitas+peran+pivot; UI/migrasi menyusul), tahfizh, rapor. G8: notifikasi, pengumuman, gateway, fingerprint.

**Kurikulum/nilai:** dibangun belakangan (G5/G7), skema disiapkan sekarang (pivot, tingkat, mode_rapor) agar minim rombak.

### 1.5 Definisi Singkat

Lihat Lampiran D. Inti: `lembaga` (root PESANTREN + MI/MD/MTS/MUA), `tahun_ajaran`, `kelas` (`walas_id→pegawai`), 7 peran (`super_admin, admin, kasir, guru, orang_tua, santri, asrama` — `asrama` pasca production), `tagihan/pembayaran`, `riwayat_belajar`, `asrama` (entitas sendiri, bukan lembaga; pasca production).

### 1.6 Referensi (arsip, read-only)

- [[Step-By-Step Sistem Pesantren/Backend/AGENTS|AGENTS — Konvensi]]
- [[Step-By-Step Sistem Pesantren/Backend/000_Catatan Pembahasan|000 Keputusan Terkunci]]
- [[Step-By-Step Sistem Pesantren/Backend/002_Skema_Database|002 Skema (implementasi)]]
- Wawancara pengurus (Agu 2026), kurikulum 2026/2027, tata tertib.

---

## 2. Gambaran Sistem

### 2.1 Deskripsi Umum

SIMPES adalah backend API-first Laravel 13 + frontend terpisah, modular berurutan (`001→004→100→103→200→203`).

### 2.2 Struktur Lembaga

| Kode      | Nama           | Sifat                    | Kohort             | Aturan daftar (Modul 100 PSB Penerimaan)                        |
| --------- | -------------- | ------------------------ | ------------------ | --------------------------------------------------------------- |
| PESANTREN | Root pesantren | Induk (`parent_id` null) | —                  | Fallback kontak/logo bila null di anak; root null pakai placeholder |
| MI        | Ibtidaiyah     | Formal                   | SD                 | Langsung contoh hari ini; mandiri boleh; paket MD opsional      |
| MD        | Diniyah        | Non-formal paralel       | SD (sama dgn MI)   | Langsung contoh hari ini; mandiri boleh; paket MI opsional      |
| MTS       | Tsanawiyah     | Formal                   | SMP                | Seleksi contoh hari ini; eksklusif                              |
| MLN       | Mu'allimin     | Formal khas              | Aliyah (nama beda) | Seleksi contoh hari ini; eksklusif                              |

Aturan terkunci:
- Hierarki via `parent_id` ke root; PK tetap `lembaga.id` INT. `kode` hardcoded, unik global, wajib isi (PESANTREN, MI, MD, MTS, MLN). Ganti kode via Lampiran E.
- Seleksi via flag: default `lembaga.is_seleksi`; override `psb_kuota_biaya.membutuhkan_seleksi` null = ikut default. Contoh hari ini MI/MD langsung, MTS/MLN seleksi; bisa dibalik per gelombang.
- Paket MI-MD opsional: 1 input usia SD jadi 2 keikutsertaan (primer MI, non-asrama, 1 tagihan paket, lifecycle tidak divergen). MI saja / MD saja tetap boleh.
- Tenant: pivot `user_lembaga` satu-satunya; tanpa tabel `pesantren` (Modul 003 Auth Login).

### 2.3 Peran Pengguna

| Peran | Tenant | Hak utama |
|---|---|---|
| `super_admin` | Semua, tanpa pivot | Semua; tulis global `ref_*`; buat semua peran |
| `admin` | Full tanpa pivot = semua; scoped dengan pivot = subset via `isAdminFull()` | CRUD `001–004` (kecuali tambah lembaga = super_admin), `100–103`, attach/detach `user_lembaga`; tak boleh mutasi/hapus pemegang `admin/super_admin` maupun role diri sendiri |
| `kasir` | Wajib pivot ≥1, hanya lembaganya via `canAccessLembaga()` | Modul 103 Keuangan: generate/tagihan/bayar/kuitansi; tanpa void (void = admin); kas pusat null hanya admin full |
| `guru` | Wajib pivot ≥1 | Modul 202 Nilai-Rapor: input miliknya/walasnya |
| `orang_tua` | Wajib pivot, via `wali_santri_relasi` | Modul 203 Portal Wali + Modul 100 PSB Penerimaan daftar + Modul 103 history bayar + ajukan/batal (1 aktif/santri) |
| `santri` | Wajib pivot | Portal terbatas |
| `asrama` | Wajib pivot `user_asrama` (ditetapkan super_admin saja) | Modul 505 Asrama (**pasca production**; peran belum di-seed sekarang): penghuni/kamar/izin pulang/kegiatan; keuangan: baca lembaga terkait santri asramanya, update hanya baris ber-pos kategori asrama, tanpa delete |

Aturan terkunci:
- 7 peran final: `super_admin, admin, kasir, guru, orang_tua, santri, asrama`; **efektif sekarang 6** — `asrama` menyusul pasca production (Modul 505); guard wajib `sanctum`; multi-peran didukung. 4 peran lama (`admin_pesantren, admin_lembaga, kasir_pesantren, kasir_lembaga`) dihapus; gabung jadi `admin` / `kasir` (Modul 003 Auth Login).
- Tenant pivot `user_lembaga`; `users` tanpa kolom tenant; 1 akun multi-lembaga via `lembaga_ids[]` (mis. 1 akun `admin` untuk MI+MD); non-admin tidak boleh list users. Peran `asrama` memakai pivot tambahan `user_asrama` (1 akun boleh multi-asrama) dan **tidak** memberi akses `user_lembaga`.
- Pemberian peran via `assignableRolesFor()`: `super_admin` ke semua 7; `admin` hanya `kasir,guru,orang_tua,santri` (tidak boleh buat sesama `admin/super_admin`, dan **tidak boleh** memberi `asrama` — khusus super_admin); tambah lembaga via attach/detach oleh `super_admin`/admin full; larang hapus diri sendiri. **Pengecualian create**: saat *membuat user* saja, `admin` (full/scoped) boleh memberi role `admin` — batas lembaga ⊆ kewenangan pembuat (boleh subset; scoped tanpa `lembaga_ids` memakai pivot sendiri, sehingga tak bisa melahirkan admin global). Jalur `update`/`assignRole`/`removeRole`/`import` tetap tanpa role `admin`.
- Login multi-identifier `email/phone/username` + `password`, throttle 6/mnt, tulis `login_audits` + `last_login_at`. Buat user hanya oleh admin manual atau Import Excel; register publik tidak dibuka.

### 2.4 Asumsi dan Batasan

| ID | Asumsi (kode + nama modul) |
|---|---|
| A1 | Online; API-first Laravel 13 / PHP 8.4+ / MySQL / Sanctum `sanctum` (Modul 001 Inisiasi, 003 Auth Login) |
| A2 | Single-pesantren via `lembaga`; tenant pivot `user_lembaga` saja (Modul 003) |
| A3 | Bahasa Indonesia persis DB: `santri`, `riwayat_belajar`, `tahun_ajaran` (AGENTS) |
| A4 | Data awal Excel per lembaga ke staging lalu verifikasi lalu production; dedup `nik+nama+tgl_lahir` (Modul 101 Santri, 003) |
| A5 | NIK wajib boleh fiktif tanpa flag (Modul 101) |
| A6 | `kurikulum`, `tarif_biaya`, `dokumen_wajib_lembaga`, `ref_*` per lembaga; kontak/logo null fallback root, root null placeholder (Modul 004 Referensi-Master, 100 PSB Penerimaan, 103 Keuangan) |
| A7 | FE terpisah Tauri/PySide/RN; Flutter dihentikan; base `API_BASE_URL` fallback `127.0.0.1:8000/api` (Modul 003) |
| A8 | Kapasitas/kinerja ikut Bab 3.2 NFR-01 sampai NFR-07; anggaran Bab 9 |

| ID | Batasan (kode + nama modul) |
|---|---|
| B1 | Migration per-modul per-file (timestamp bawaan, urutan FK); spec di `docs/SCHEMA.md`; file besar single-file lama dihapus (v1.3.1) |
| B2 | Register publik ditutup; buat user hanya admin manual/import (Modul 003) |
| B3 | Guard wajib `sanctum`; throttle login 6/mnt; `authorize` + `canAccessLembaga` wajib (Modul 003) |
| B4 | UNIQUE nullable tidak cegah duplikat NULL MySQL; dedup wajib service (`RefService`, `KeuanganService`, import 101) (Modul 002) |
| B5 | Kolom pemakai `ref_*` string tanpa FK; shadow global hanya `is_active` (Modul 004) |
| B6 | Void hanya admin; kas pusat null hanya admin full; `kasir` hanya lembaganya (Modul 103) |
| B7 | Scope G0-G3 production dulu; G4+ TBD; `500-505`, `900-901` ditutup sementara (Bab 1.4) |

---

## 3. Analisis Kebutuhan

### 3.1 Functional Requirement (G0–G3 detail; pasca persiapan)

| ID                     | Modul (kode + nama)                               | Functional Requirement                                                                                           | Status doc            |
| ---------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------- |
| FR-003                 | 003 Auth Login                                    | Login multi-identifier, 7 peran (efektif 6; `asrama` pasca production), import, audit                             | Detail (G0)           |
| FR-004                 | 004 Referensi-Master                              | `lembaga`, `tahun_ajaran`, `kelas`, 36 `ref_*` via `RefService`                                                  | Detail (G0)           |
| FR-100                 | 100 PSB Penerimaan Santri                         | 2-jalur via `is_seleksi` + override null ikut default, kuota saat input, waiting_list, paket MI-MD opsional, ACC | Detail (G1+G3 daftar) |
| FR-101                 | 101 Santri Master                                 | `id` stabil; NIK fiktif boleh; dedup; `status_global` turunan (default false); `lembaga_id` boleh NULL (legacy, terlihat semua admin) | Detail (G1)           |
| FR-102                 | 102 Siklus Santri                                 | status_awal/akhir, naik/pindah/mutasi/lulus                                                                      | Detail (G1)           |
| FR-103                 | 103 Keuangan                                      | Tagihan idempoten, bayar terkunci, kuitansi, void; subset mobile G2; `pos_keuangan.kategori` (akademik/asrama)  | Detail (G1+G2)        |
| FR-203                 | 203 Portal Wali subset                            | Daftar + history bayar + pengajuan                                                                               | Detail (G3)           |
| FR-200, FR-201, FR-202 | 200 Pegawai, 201 Kurikulum-Mapel, 202 Nilai-Rapor | Skema siap, UI belakangan                                                                                        | Persiapan (G5/G7)     |
| FR-505                 | 505 Asrama                                        | Entitas `asrama` (bukan lembaga)+`user_asrama`+peran `asrama`; kamar, penghuni, izin pulang, kegiatan; keuangan via pos asrama | Gambaran umum (**pasca production**) |

### 3.2 Non-Functional Requirement

| ID | Non-Functional Requirement |
|---|---|
| NFR-01 | <3 dtk; cache `RefService` 300 dtk |
| NFR-02 | 3.000 santri aktif; `per_page=20` |
| NFR-03 | Bcrypt/argon2, throttle login 6/mnt, `lockForUpdate`, `latest('id')` |
| NFR-04 | Uptime 99%/bulan |
| NFR-05 | Sederhana; `control id snake_case` |
| NFR-06 | API-first; FE Tauri/PySide/RN |
| NFR-07 | Backup harian + rollback |

### 3.3 Use Case

| ID | Actor | Functional Requirement | Modul |
|---|---|---|---|
| UC-G0-01 | `super_admin`, `admin` | Login + kelola `users` (import, audit) | 003 Auth Login |
| UC-G0-02 | `super_admin`, `admin` | Kelola `lembaga`, `tahun_ajaran`, `kelas`, `ref_*` | 004 Referensi-Master |
| UC-G1-01 | `admin`, `orang_tua` | PSB daftar, verifikasi, seleksi opsional, ACC + paket MI-MD | 100 PSB Penerimaan |
| UC-G1-02 | `admin` | Kelola `santri` + import dedup | 101 Santri Master |
| UC-G1-03 | `admin` | Naik/pindah/mutasi/lulus (`riwayat_belajar`) | 102 Siklus Santri |
| UC-G1-04 | `admin`, `kasir` | Generate/bayar/kuitansi/void (`tagihan`, `pembayaran`) + subset mobile G2 | 103 Keuangan |
| UC-G3-01 | `orang_tua`, `santri` | Portal daftar + history bayar + pengajuan | 203 Portal Wali subset |
| UC-Pasca | `guru` + pasca | Pegawai, kurikulum-mapel, nilai-rapor, `500-505` | 200, 201, 202, 500-505 TBD |

---

## 4. Model Proses Bisnis (logika saja)

| ID | Modul (kode + nama) | Aturan | Input, Proses, Output |
|---|---|---|---|
| 4.1 | 100 PSB Penerimaan | Master kegiatan → gelombang (anti-overlap, otomatis saat daftar) → kuota/biaya pendaftaran per lembaga; biaya masuk & asrama per lembaga; 2-jalur via `lembaga.is_seleksi` (override null ikut default); kuota pool gabungan per kelompok kunci saat input (penuh ke waiting_list); paket MI-MD opsional (1 calon + baris `psb_calon_lembaga`, primer MI, non-asrama, 1 tagihan) | Input: NIK wajib (fiktif boleh), dokumen wajib per lembaga. Proses: cek-NIK ke daftar ke verifikasi ke seleksi opsional ke pemberkasan ke lengkapi ke ACC tunggal; aksi massal verifikasi/masuk daftar ulang/ACC/undur diri/hapus (soft delete + restore). Output: nomor `PSB_*`, `santri`, `riwayat_belajar` aktif (1 per lembaga), `tagihan` masuk + asrama |
| 4.2 | 101 Santri Master, 102 Siklus Santri | `id` stabil; `is_aktif` true iff aktif; `status_global` TURUNAN murni (= punya ≥1 riwayat aktif, default false); `lembaga_id` boleh NULL = legacy tanpa track (cache; sumber kebenaran `riwayat_belajar`, terlihat semua admin); mutasi/lulus per lembaga | Input: biodata + `kelas`; **input manual** (`POST /admin/santri`, legacy) + **import Excel** (kolom `lembaga_id` opsional per baris). Aturan lembaga: admin scoped 1 lembaga → otomatis; admin rangkap/full/super → opsional (null = legacy murni). Proses: salin ganjil ke genap; naik massal per-item (`kelas_id` null lalu penempatan); pindah/set validasi se-lembaga/tahun/tingkat; penempatan kelas mengadopsi lembaga saat `lembaga_id` NULL. Output: `riwayat_belajar`, `mutasi_keluar`, `alumni` |
| 4.3 | 103 Keuangan G1 dasar + G2 mobile | Idempoten `(santri,pos,periode)`; bayar `total==sum`, kunci baris; kuitansi retry; void reversal; pos kategori `asrama` untuk keuangan asrama | Input G2 disederhanakan (tombol besar). Proses: generate ke bayar terkunci ke kuitansi ke void bila perlu. Output: `tagihan`, `pembayaran`, `jurnal_kas`, kuitansi |
| 4.4 | 203 Portal Wali G3 | Daftar + history bayar + pengajuan (1 aktif/santri); envelope `pesan/data` | Input: akun `orang_tua` via `wali_santri_relasi`. Proses: list anak ke detail. Output: history, pengajuan |
| 4.5 | 200 Pegawai, 201 Kurikulum-Mapel, 202 Nilai-Rapor persiapan | Skema siap: `kurikulum`, pivot `kurikulum_mapel` (tingkat/kkm/urutan), `pengampu` 4 lapis, `mode_rapor`, `semester` | Dibangun G5/G7; arsip 201/202 |
| 4.6 | 505 Asrama (gambaran umum v1.10 — **pasca production**) | Asrama entitas sendiri (bukan `lembaga`); pengurus via peran `asrama` + `user_asrama`; kamar & penghuni punya siklus mandiri; daftar per jenjang/JK dari query (bukan kolom); keuangan asrama via pos kategori `asrama` | Input: `asrama` + `asrama_kamar`, penempatan `asrama_penghuni` (kamar menyusul), `asrama_izin_pulang`, `asrama_kegiatan`. Proses: izin pulang diajukan lalu diproses (setujui/tolak), penghuni keluar (tutup baris). Output: daftar penghuni per asrama/jenjang/JK, riwayat izin, tagihan ber-pos asrama. Presensi asrama & kegiatan harian detail ditunda (TBD) |

---

## 5. Perancangan Sistem

### 5.1 Arsitektur

```
[Frontend] → [Backend Laravel 13 API (/api, sanctum+role:)] → [MySQL]
Service Layer + Policy + transaction; notifikasi DB agregat.
```

### 5.2 Modul (G0–G3 detail; pasca 1 baris)

| ID | Modul (kode + nama) | Tabel inti | Status |
|---|---|---|---|
| FR-003 | 003 Auth Login | `users`, `user_lembaga`, `user_asrama`, `login_audits` | Detail |
| FR-004 | 004 Referensi-Master | `lembaga`, `tahun_ajaran`, `kelas`, 36 `ref_*` | Detail |
| FR-100 | 100 PSB Penerimaan | `psb_*`, `dokumen_santri` | Detail |
| FR-101 | 101 Santri Master | `santri` | Detail |
| FR-102 | 102 Siklus Santri | `riwayat_belajar`, `mutasi_keluar`, `alumni` | Detail |
| FR-103 | 103 Keuangan | `pos_keuangan`, `tarif_biaya`, `tagihan`, `pembayaran`, `akun_kas`, `jurnal_kas` | Detail |
| FR-203 | 203 Portal Wali subset | `wali_*`, `pengajuan_biodata_santri` | Detail G3 |
| FR-200, FR-201, FR-202 | 200 Pegawai, 201 Kurikulum-Mapel, 202 Nilai-Rapor | Lihat arsip | Persiapan |
| FR-505 | 505 Asrama | `asrama`, `asrama_kamar`, `asrama_penghuni`, `asrama_izin_pulang`, `asrama_kegiatan`, `user_asrama` | Gambaran umum (**pasca production**) |

### 5.3 Alur Data Utama (G0–G3)

| ID | Alur | Tahapan |
|---|---|---|
| 5.3.1 | PSB 100 | cek-NIK ke daftar ke verifikasi ke ACC ke `santri+riwayat+tagihan` |
| 5.3.2 | Siklus 102 | salin ganjil-genap ke naik massal ke penempatan ke mutasi/lulus |
| 5.3.3 | Bayar 103 | generate ke bayar terkunci ke kuitansi ke void bila perlu |
| 5.3.4 | Nilai 202 persiapan | simpan massal ke hitung ke portal (dibangun G5) |
| 5.3.5 | Asrama 505 (gambaran umum) | daftar penghuni ke penempatan kamar ke izin pulang ke proses (setujui/tolak/kembali) |

---

## 6. Perancangan Basis Data (format umum)

> Tipe logis umum, bukan sintaks Laravel. Rincian kolom lengkap di ERD Lampiran A + Modul 002 Skema Database.

| ID | Modul (kode + nama) | Tabel inti | Relasi kunci |
|---|---|---|---|
| 6.1 | 003 Auth Login, 004 Referensi-Master | `lembaga`, 36 `ref_*`, `users`, `user_lembaga`, `tahun_ajaran`, `pegawai`, `kelas` | `lembaga 1—N tahun_ajaran/kelas`; `kelas.walas_id` inline; ref global + shadow lembaga |
| 6.2 | 101 Santri Master, 102 Siklus Santri | `santri`, `riwayat_belajar`, `mutasi_keluar`, `alumni` | `santri 1—N riwayat_belajar`; `riwayat N—1 kelas`; `id` stabil, NIK index tanpa unique; `santri.lembaga_id` nullable (cache, fallback riwayat), `status_global` turunan |
| 6.3 | 100 PSB Penerimaan | `psb_*`, `dokumen_santri` | `calon` ke `santri` saat ACC; dokumen pindah ke santri |
| 6.4 | 103 Keuangan | `pos_keuangan`, `tarif_biaya`, `tagihan`, `pembayaran`, `akun_kas`, `jurnal_kas` | `pos 1—N tagihan 1—N pembayaran`; `pos_keuangan.kategori` menandai pos asrama |
| 6.5 | 200 Pegawai, 201 Kurikulum-Mapel, 202 Nilai-Rapor, 203 Portal Wali | `kurikulum_mapel` pivot, `wali_*`, `pengajuan_biodata_santri` | `kurikulum N—M mapel` via `kurikulum_mapel`; wali via `wali_santri_relasi` |
| 6.6 | 505 Asrama (gambaran umum — **pasca production**) | `asrama`, `asrama_kamar`, `asrama_penghuni`, `asrama_izin_pulang`, `asrama_kegiatan`, `user_asrama` | `asrama 1—N kamar/penghuni/izin/kegiatan`; `santri 1—N penghuni`; pengurus via `user_asrama` (asrama bukan `lembaga`) |

Contoh kamus ringkas:

**`santri`:** `id INT PK`; `nik VARCHAR(16) INDEX nullable` (fiktif boleh, dedup service); `nis VARCHAR nullable`; `status_global BOOLEAN DEFAULT false` (turunan: punya ≥1 riwayat aktif); `lembaga_id INT FK NULL` (legacy tanpa track; cache), `kelas_id INT FK NULL`.
**`riwayat_belajar`:** `status_awal VARCHAR`; `status_akhir VARCHAR`; `is_aktif BOOLEAN` (tulis via service); `semester CHAR(1)`.
**`asrama`:** `id INT PK`; `jenis_kelamin ENUM(L,P)`; `user_asrama(user_id, asrama_id)`; tidak memakai `riwayat_belajar`.

---

## 7. Perancangan Antarmuka

| App | Modul (kode + nama) | Fitur | Kontrak |
|---|---|---|---|
| Desktop Admin G0-G1 | 001-004, 100 PSB Penerimaan, 101 Santri Master, 102 Siklus Santri, 103 Keuangan | CRUD penuh referensi, PSB, santri/siklus, keuangan | `control id snake_case`, `per_page=20`, tangani 401/403/422/429 |
| Mobile Kasir G2 | 103 Keuangan subset | Bayar, kuitansi tombol besar | Sama |
| Mobile Ortu G3 | 100 daftar, 103 history, 203 Portal Wali subset | Daftar + history bayar + ajukan/batal | Sama |
| Pasca TBD | 200 Pegawai, 201 Kurikulum-Mapel, 202 Nilai-Rapor, 500+ | Pegawai, nilai, presensi | TBD |

---

## 8. Implementasi

### 8.1 Tumpukan Terkunci

Laravel 13 / PHP 8.4+, Sanctum (`sanctum`), Spatie (`sanctum`), MySQL, Excel, DomPDF, Service Layer. FE: Tauri/PySide/RN (Flutter dihentikan).

### 8.2 Strategi Migration (per alur, per-modul per-file)

Migration per-modul (timestamp bawaan, urutan FK); spec di `docs/SCHEMA.md` (ditulis ulang dari vault 002). Urutan `lembaga` ke `ref_*` ke `users` (`0001` bawaan) ke `user_lembaga` ke `tahun_ajaran` ke `pegawai` ke `kelas` ke `santri` ke riwayat ke PSB ke keuangan ke lanjutan; blok asrama (`asrama*`, `user_asrama`) menyusul setelah presensi.

| ID | Alur (Bab 4) | Modul | Tabel (BLOK) |
|---|---|---|---|
| 8.2.1 | PSB | 100 PSB Penerimaan | `psb_gelombang`, `psb_kuota_biaya`, `psb_calon_santri`, `dokumen_santri`, `dokumen_wajib_lembaga`, `psb_log_status` |
| 8.2.2 | Santri/Siklus | 101 Santri Master, 102 Siklus Santri | `santri`, `riwayat_belajar`, `mutasi_keluar`, `alumni` |
| 8.2.3 | Keuangan | 103 Keuangan | `pos_keuangan`, `tarif_biaya`, `tagihan`, `akun_kas`, `pembayaran`, `jurnal_kas` |
| 8.2.4 | Akademik/Nilai/Portal | 200, 201, 202, 203 | `kurikulum*`, `pengampu_mapel`, `nilai_santri`, `rapor_catatan_wali`, `wali_*` |
| 8.2.5 | Asrama (gambaran umum — **pasca production**, belum dibuat) | 505 Asrama | `asrama`, `asrama_kamar`, `asrama_penghuni`, `asrama_izin_pulang`, `asrama_kegiatan`, `user_asrama`; perubahan `santri` (lembaga_id nullable, status_global default false — dibahas terpisah) |

### 8.3 Konvensi Kode

| ID | Aturan Kode | Modul |
|---|---|---|
| 8.3.1 | Guard `sanctum` + `canAccessLembaga` / `isAdminFull` | 003 Auth Login |
| 8.3.2 | `DB::transaction` + `lockForUpdate` | 102, 103 |
| 8.3.3 | Key Excel flat; NIK null ke `create()` | 003, 101 |
| 8.3.4 | `latest('id')` | Semua list |

---

## 9. Manajemen Proyek (Hybrid Solo)

**Metode:** Fase-gate + Kanban WIP=1. Fondasi waterfall (`001–004` stabil dulu). Modul tarik 1-1 sesuai dependensi. Siklus 1 minggu: tarik → kerjakan → demo pengurus → done.
```
[001-004] ▶ [100-103] ▶ [200-203 subset] ▶ [UAT]
```

**Roadmap:**

| Gel. | ID-Modul | App | Status |
|---|---|---|---|
| G0 | 001-004 fondasi | Desktop | Production awal |
| G1 | 100 PSB Penerimaan, 101 Santri Master, 102 Siklus Santri, 103 Keuangan dasar | Desktop | Production awal |
| G2 | 103 Keuangan subset bayar | Mobile kasir | Production awal |
| G3 | 100 daftar, 103 history, 203 Portal Wali subset | Mobile ortu | Production awal |
| G4+ | 200 Pegawai, 201 Kurikulum-Mapel, 202 Nilai-Rapor, 500-505, notif/gateway | Menyusul | Pasca, TBD |

Estimasi solo: G0 3–4 mgg; G1 4–5; G2 2–3; G3 3–4. Total G0–G3 ±4–5 bln.

| Peran | Tanggung jawab (RACI ringkas) |
|---|---|
| `super_admin` | A global |
| `admin` scoped | R lembaganya |
| `kasir`, `guru`, `orang_tua` | R input miliknya |
| Solo dev + QA | R bangun/uji |

| ID | Risiko | Mitigasi (kode) |
|---|---|---|
| R-01 | Tenant bocor | Cek `canAccessLembaga` + TC lintas lembaga (Modul 003) |
| R-02 | Race tagihan/kuitansi | Kunci + retry (Modul 103 Keuangan) |
| R-03 | Excel berantakan | Bersihkan + staging (Modul 101, 003) |
| R-04 | Kasir non-komputer | Uji lapangan G2 |
| R-05 | Scope creep | Kunci G0–G3 dulu |

**Aturan bisa berubah:** catat Masalah ke Usulan ke Dampak (skema/API/FE) ke putus (terima/tunda/tolak) ke tulis Lampiran E + naik versi `X.Y.Z`. Ubah UI tanpa ubah API: catat ringan. Ubah logika/skema: wajib analisis dampak paket/tenant/kontrak FE v1 (tambah opsional dulu, jangan breaking).

---

## 10. Rencana Pengujian (fokus G0–G3)

Unit, integrasi (Modul 100 PSB Penerimaan ke 101 Santri Master ke 103 Keuangan), sistem, UAT.

| ID | Modul (kode + nama) | Skenario | Harapan |
|---|---|---|---|
| TC-01 | 003 Auth Login | Login + throttle | 200/429 + audit |
| TC-02 | 003 Auth Login | Assign peran | Ditolak bila di luar hak |
| TC-03 | 103 Keuangan | Generate tagihan | Tanpa duplikat |
| TC-04 | 103 Keuangan | Bayar | 422/409 bila tak seimbang/lunas |
| TC-05 | 101 Santri Master | Impor santri | Skip baris gagal |
| TC-06 | 102 Siklus Santri | Naik massal | Partial berhasil/gagal |
| TC-07 | 203 Portal Wali subset | Daftar + history + pengajuan | 1 aktif/santri |
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
| C-02 | `lembaga` / `tahun_ajaran` / `ref_*` / `kurikulum` / `tarif_biaya` terkonfigurasi |
| C-03 | Paket MI-MD terverifikasi |
| C-04 | Akun 6 peran sekarang teruji (peran `asrama` diuji saat Modul 505 / pasca production) |
| C-05 | Training/backup/SSL selesai |

---

## 12. Keamanan Sistem

| ID | Kontrol | Modul |
|---|---|---|
| K-01 | Bcrypt/argon2 | 003 Auth Login |
| K-02 | Guard `sanctum` + tenant `canAccessLembaga` | 003 |
| K-03 | Transaksi terkunci | 102, 103 |
| K-04 | Audit (`login_audits`, `psb_log_status`, `wali_portal_logs`, jurnal) | 003, 100, 203, 103 |
| K-05 | Backup offsite + SSL; privasi internal | 900/901 TBD |
| K-06 | Izin asrama (v1.10): pengurus `asrama` baca keuangan lembaga terkait santri asramanya; update hanya baris ber-pos kategori `asrama`; delete hanya admin lembaga; generate tagihan dari lembaga | 505, 103 |

---

## 13. Pelatihan dan Dokumentasi Pengguna

| Sesi | Peserta | App | Modul + Materi |
|---|---|---|---|
| 1 | `admin` | Desktop | 004, 100, 101, 102: referensi, PSB, santri/siklus |
| 2 | `kasir` | Mobile kasir | 103: bayar, kuitansi tombol besar |
| 3 | `orang_tua` | Mobile ortu | 100, 103, 203: daftar, history bayar |

Manual per peran, video pendek, FAQ.

---

## 14. Pemeliharaan dan Dukungan

Garansi 3 bln; respons 1×24 jam. G4+ dibuka setelah G0–G3 stabil production.

---

## Lampiran A — ERD (Sumber Kebenaran)

Diagram Crow's Foot diturunkan dari [[Step-By-Step Sistem Pesantren/Backend/002_Skema_Database|002]] dan diringkas di Bab 6. File visual menyusul; hingga ada, tabel Bab 6 + arsip 002 berlaku dengan interpretasi tipe logis.

## Lampiran B — Matriks Ketertelusuran ke Arsip (read-only)

| ID | Modul (kode + nama) | Arsip |
|---|---|---|
| FR-003 | 003 Auth Login | [[Step-By-Step Sistem Pesantren/Backend/003_Authentication\|003]] |
| FR-004 | 004 Referensi-Master | [[Step-By-Step Sistem Pesantren/Backend/004_Modul Referensi dan Master Data\|004]] |
| FR-100 | 100 PSB Penerimaan | [[Step-By-Step Sistem Pesantren/Backend/100_Modul PSB\|100]] |
| FR-101 | 101 Santri Master | [[Step-By-Step Sistem Pesantren/Backend/101_Modul Santri\|101]] |
| FR-102 | 102 Siklus Santri | [[Step-By-Step Sistem Pesantren/Backend/102_Modul Riwayat Santri\|102]] |
| FR-103 | 103 Keuangan | [[Step-By-Step Sistem Pesantren/Backend/103_Modul Keuangan\|103]] |
| FR-203 | 203 Portal Wali | [[Step-By-Step Sistem Pesantren/Backend/203_Modul Portal Orang Tua\|203]] |
| FR-200, FR-201, FR-202 | 200 Pegawai, 201 Kurikulum-Mapel, 202 Nilai-Rapor | Persiapan, arsip 200/201/202 |
| TBD-Pasca | 500 Presensi Santri, 501 Presensi Guru, 502 Jadwal, 503 Tahfizh, 504 Pimpinan, 505 Asrama | TBD pasca |
| TBD-Infra | 900 Deploy VPS, 901 Konfigurasi Produksi | TBD infra |
| FE-UI | Frontend LANGKAH UI | `Frontend/admin-flutter-desktop/docs/` |
| DB-002 | Skema DB Bab 6 | [[Step-By-Step Sistem Pesantren/Backend/002_Skema_Database\|002]] |
| KONV | Konvensi Bab 8 | [[Step-By-Step Sistem Pesantren/Backend/AGENTS\|AGENTS]], [[Step-By-Step Sistem Pesantren/Backend/000_Catatan Pembahasan\|000]] |

## Lampiran C — Isu Terbuka / TBD

G4: Modul Guru (pegawai), Dokumen Guru/Santri, Absensi Guru (Modul 501 stub). G5: Laporan Keuangan (jurnal 103), Input Nilai tanpa rapor (Modul 202 subset). G6: Statistik Pengurus (Modul 504 ringkas). G7: Absen Santri (500), **Asrama (505 — gambaran umum v1.10: entitas `asrama`+`user_asrama`+peran `asrama`; PASCA PRODUCTION, tidak dikerjakan dalam waktu dekat)**, Tahfizh (503), Rapor (202). G8: Notifikasi, Pengumuman, Gateway, Fingerprint (belum ada). Fase 3–4 cadangan.

TBD khusus asrama (v1.10 — semua pasca production):
- Implementasi asrama tidak dalam waktu dekat; tidak ada tabel/peran/pivot dibuat sekarang.
- Yang perlu dijaga sekarang agar tidak menutup jalan: `tagihan` tetap memakai `lembaga_id` (penanda asrama nanti lewat `pos_keuangan.kategori`, tanpa mengubah `tagihan`), dan peran baru cukup ditambah saat itu.
- Perubahan `santri` (`lembaga_id` nullable, `status_global` turunan) **bukan** bagian asrama — **sudah diimplementasikan** (v1.10.2).
- Presensi kegiatan asrama: `sesi_presensi.kategori` sudah ada, tetapi `presensi_santri.kelas_id` masih NOT NULL — perlu penyesuaian skema sebelum dipakai.
- Tarif beda antar-asrama (putra/putri) belum diakomodasi `tarif_biaya` (per lembaga × tipe_santri); sementara lewat `tarif_khusus_santri`.
- Bentuk tabel kamar/penghuni/izin/kegiatan masih **gambaran umum**, bisa berubah saat implementasi.

## Lampiran D — Glosarium (Opsi A)

SIMPES; santri; lembaga (MI=SD formal, MD=SD non-formal paralel, MTS=SMP, MLN=Aliyah beda nama; kode hardcoded; PK id INT); tahun_ajaran; kelas; pegawai/guru; 7 peran (`super_admin, admin, kasir, guru, orang_tua, santri, asrama` — efektif 6 sekarang; `asrama` pasca production); PSB (`is_seleksi`); tagihan/pembayaran; riwayat_belajar; asrama (entitas sendiri — bukan `lembaga`; kamar, penghuni, izin pulang, kegiatan; pasca production); pengurus asrama (peran `asrama` + pivot `user_asrama`); santri legacy (`santri.lembaga_id` NULL, tanpa track riwayat).

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

## Pembahasan Selanjutnya (sesi baru)

- v1.4 paket offline terkunci. Next: scaffold Tauri / backend 100 (sesuai pilihan).

---

# Part B — Detail Backend (EN, dari backend/docs/PRD.md 2026-09-09)

> Digabung ke root docs per keputusan sesi. File lama `backend/docs/PRD.md` kini pointer.

## Sistem Pesantren — Product Requirements Document (PRD)

> Scope: entire system (backend + all frontends).
> Source of truth for backend behavior: step-by-step build guides in the docs vault
> (`Backend/001`–`004`, `100`–`103`, `200`–`203`; decisions `000` no.1–51).
> Status as of 2026-09-09. Language: English.

### 1. Overview

Sistem Pesantren is an integrated information system for a single pesantren
(Islamic boarding school) that runs several educational units (lembaga:
MI, MD, MTs, Mu'allimin) under one root identity.

Vision: one identity per santri (`santri.id`), one billing pipeline,
one reference dictionary — serving six operator roles through
purpose-built frontends that all consume a single Laravel API.

Non-goals: multi-pesantren SaaS (explicitly dropped, decision no.40);
web session UI (API-first, token auth only).

### 2. System architecture

```
                        ┌─────────────────────────────┐
                        │  Backend (Laravel 13 API)   │  backend/
                        │  Sanctum tokens, /api/*     │
                        └──────────────┬──────────────┘
           ┌───────────────┬───────────┼───────────┬───────────────┐
           ▼               ▼           ▼           ▼               ▼
   admin-desktop   admin-desktop  kasir      orangtua      pimpinan     guru
   -tauri          -pyside        -mobile    -mobile       -mobile      -mobile
   (Tauri 2)       (PySide6)      (RN)       (RN)          (RN)         (RN)
```

All frontends are separate projects under `frontend/` (never merged):

| App | Folder | Stack | Users |
|---|---|---|---|
| Admin desktop (primary) | `frontend/admin-desktop-tauri` | Tauri 2 | super_admin, admin |
| Admin desktop (alt) | `frontend/admin-desktop-pyside` | PySide6 | super_admin, admin |
| Kasir mobile | `frontend/kasir-mobile-react-native` | React Native | kasir (+admin) |
| Orang tua mobile | `frontend/orangtua-mobile-react-native` | React Native | orang_tua |
| Pimpinan mobile | `frontend/pimpinan-mobile-react-native` | React Native | pimpinan (reads executive aggregates) |
| Guru mobile | `frontend/guru-mobile-react-native` | React Native | guru |

> Note: the legacy Flutter `desktop/` project was deleted 2026-09-09 and is
> superseded by `frontend/*` above. The empty workspace `mobile/` folder is
> unrelated to this layout.

Backend ↔ frontend contract: JSON over HTTPS, `Authorization: Bearer <sanctum>`,
envelope `{pesan, data}` for portal endpoints, standard pagination elsewhere.

### 3. Tech stack

* Backend: Laravel 13 (PHP 8.4+), Sanctum (`guard: sanctum`), Spatie Permission
  (`guard_name: sanctum`), MySQL, Maatwebsite Excel, DomPDF (kuitansi/rapor),
  Service Layer pattern, `DB::transaction()` + `lockForUpdate()` for critical ops.
* Admin Tauri: Tauri 2 + frontend webview (to be decided: React/Vue/Svelte).
* Admin PySide: PySide6 (Qt for Python), desktop offline-tolerant forms.
* Mobile (×4): React Native (shared API client design, separate apps/releases).
* Infra: single VPS deployment (docs `900`–`901`, currently closed).

### 4. Actors & roles

Seven roles, hierarchical (decision no.40): `super_admin` → `admin` (full =
no `user_lembaga` pivot; scoped = via pivot) → `kasir` / `guru` →
`orang_tua` / `santri`. Plus `asrama` (pengurus asrama, pivot `user_asrama`,
v1.10; **pasca production** — efektif sekarang 6 peran). One user may hold multiple roles.

* `assignableRolesFor()`: super_admin grants all 7; admin grants
  `kasir, guru, orang_tua, santri` (no privilege escalation; `asrama`
  dan `admin` khusus super_admin, kecuali create-admin v1.9.x).
* Tenant choke point: `User::lembagaIds()` (pivot `user_lembaga` only —
  `users` has NO tenant column), `canAccessLembaga()`, `isAdminFull()`.
* Convention (locked): LIST may be wide (all accessible lembaga);
  ACTION is strict AND per-lembaga. Non-admins get empty user lists
  (`whereRaw('1 = 0')`); kasir sees only own lembaga.

### 5. Backend modules

Status legend: ✅ implemented & migrated · 🟡 spec locked, not implemented ·
🔲 closed (kept as draft, opens on demand).

#### Phase 0 — Foundation ✅ (migrated, seeded)

**001 Setup.** Laravel 13 project, `.env`, `auth.php` (`guard: sanctum`).
Status: ✅ project exists.

**002 Database schema.** Per-module migration files (default timestamps, FK order;
spec in `docs/SCHEMA.md`, rewritten from vault single-file spec): `lembaga` (root `kode=PESANTREN` + units via `parent_id`) → 36 `ref_*`
→ `users` (+pivot/audit) → `tahun_ajaran` → `pegawai` → `kelas`
(`walas_id → pegawai` inline) → santri/riwayat → PSB → finance →
HR-academic → grades → presensi → tahfizh → wali portal. ~80 tables.
MySQL 64-char index pitfall: 4 composite uniques use short `uq_*` names.
Status: ✅ `migrate:fresh` green (100 tables incl. framework/package tables).

**003 Authentication & users.** Multi-identifier login (email/phone/username),
throttle + `login_audits`, 6 roles, `UsersImport` (flat keys, intra-file
dedup, `lembaga_ids[]` pivot sync), `UserPolicy`.
API: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`,
`GET|POST /api/admin/users`, `PUT|DELETE /api/admin/users/{user}`,
`POST /api/admin/users/import`, role assign/remove,
`POST|DELETE /api/admin/users/{user}/lembaga` (attach/detach, multi-lembaga).
Status: ✅ 36 routes live.

**Dashboard (ekstra, di luar vault — didokumentasikan v1.3.2).**
`GET /api/dashboard/ringkasan` (`auth:sanctum`, semua peran, scope tenant +
opsional `?lembaga_id=`): hitungan `lembaga/pengguna/tahun_ajaran_aktif/kelas`
+ daftar tahun aktif. Bukan executive dashboard 504. Slot `santri`,
`tagihan_terbuka`, `antrean_psb` = null (placeholder modul lanjutan).

**004 Reference & master data.** 36 kamus tables (global row
`lembaga_id=null` + per-lembaga rows; shadow = on/off only for globals),
`RefService::effective()/kodeAktif()/forget()` (cached), `ReferensiSeeder`
(decision no.51 values), `Lembaga/TahunAjaran/Kelas` CRUD with tenant scope.
API: `GET /api/admin/referensi/types`, `GET|POST /api/admin/referensi/{tipe}`,
`DELETE /api/admin/referensi/{tipe}/{id}`, lembaga/TA/kelas CRUD.
Status: ✅ migrated + seeded (agama 6, tingkat 12, tugas 2, …).

#### Phase 1 — Core operations 🟡 (spec locked, not implemented)

**100 PSB (new-student admission).** Master kegiatan → gelombang (tanggal shared,
anti-overlap, satu kegiatan aktif; tanpa status gelombang — gerbang pendaftaran publik
otomatis murni dari tanggal buka/tutup) → kuota/biaya pendaftaran per lembaga; biaya masuk (paket) & asrama per
lembaga via `psb_biaya_lembaga` (`ASRAMA` pos terpisah saat ACC). Two flexible
paths via `membutuhkan_seleksi` (direct vs selection); combined pool quota per
`kelompok_psb` (combo khusus MI/MD; pool value on the primary lembaga's
`psb_kuota_biaya` row) + `waiting_list`; MI-MD package (1 calon +
`psb_calon_lembaga` child rows, 1 grouped number `PSB_{tahun}_MIMD_{gel}_{seq}`,
single ACC → 1 santri + 2 riwayat, single bill); identity `nik+nama+tgl_lahir`
dedup (NIK may be fictitious); 9 statuses (no `seleksi`); `no_pendaftaran` race →
catch 1062 regenerate (max 3×). Bulk actions admin: verifikasi, seleksi,
ACC, hapus; hapus = soft delete (block bila ada pembayaran; tagihan `PSB_REG`
belum bayar → `dibatalkan`) + restore.
Stories: public daftar (+paket) via gelombang yang sedang dibuka (tanggal), admin verify/ACC/hapus,
wali portal lengkapi/ajukan-daftar-ulang, TU verifies `dokumen_santri`. Alur status admin:
`baru` → verifikasi → `terverifikasi` → tombol "Masuk daftar ulang" (lembaga ber-seleksi
meminta konfirmasi lolos/tidak lolos; tidak lolos → `tidak_lolos`) → status `pemberkasan` →
wali ajukan daftar ulang (`ajukan_daftar_ulang`) **atau** admin boleh langsung ACC dari
`pemberkasan` → status `daftar_ulang` + santri dibuat (NIS opsional diisi saat ACC —
tunggal atau massal per calon — dan ikut tersimpan ke `santri.nis` + `riwayat_belajar.nis`;
boleh dikosongkan lalu diisi menyusul lewat import). Pengunduran diri (status
`mengundurkan_diri`, aksi baris + massal) tersedia dari fase terdaftar, daftar ulang, dan
diterima; data lama berstatus `ditolak` dimigrasikan ke `mengundurkan_diri`. Bila calon yang
sudah diterima (santri dibuat lewat ACC) mengundurkan diri, data `santri` + arsip
`riwayat_belajar`-nya dihapus (tagihan belum bayar dibatalkan; pembayaran yang sudah ada
menahan proses) dan calon kembali murni sebagai riwayat PSB. NIS wajib unik (master + arsip);
diisi opsional saat ACC atau menyusul via import/kenaikan. Batalkan fase
(kembali ke status sebelumnya dari log `psb_log_status`, aksi baris + massal) tersedia untuk
semua fase kecuali fase diterima/`daftar_ulang` (santri sudah dibuat).
`butuh_pemberkasan` hanya penanda
lengkapi berkas. Ketentuan dokumen
per kegiatan PSB × lembaga (`dokumen_wajib_lembaga`) bersifat penekanan — tidak menahan
daftar ulang; saat ACC baris checklist dibuat di `dokumen_santri` (boleh ditandai
"tidak memiliki"). Import
Excel ikut membuat tagihan pendaftaran.
Status: ✅ live (fitur tests hijau). Captcha + PDF bukti ditunda.

**101 Santri master.** 74-column EMIS profile; NIK/NISN index-only + service
dedup; `updateOrCreate` only when NIK present (+ intra-file guard);
`status_global` bool (false iff ALL riwayat non-active);
`SantriPolicy` (guru excluded from admin list).
Status: ✅ live (CRUD scoped, import-lengkap, kamus, foto/dokumen; 10 tests).
Tambahan vs vault: mapping import penuh (tanpa drop diam-diam), `uploadFoto`,
`tipe_santri` rule, `kewarganegaraan` default WNI. Recalc `status_global` tetap di 102.

**Preset tampilan kolom tabel (lintas modul).** Combobox di toolbar setiap tabel
(`ExcelTable`) berisi bawaan "Lengkap" + preset buatan user; preset menyimpan
daftar kolom (`preset_tabel.kolom`) per tabel & per lembaga. Saat membuat preset,
user dapat memilih satu atau beberapa lembaga tujuan (multi-generate); tiap lembaga
lalu dapat mengedit salinannya sendiri. Pilihan terakhir per user per tabel diingat
di `preset_tabel_aktif`. Salin TSV mengikuti kolom yang terlihat.
Status: ✅ live.

**Aksi baris tabel (lintas modul).** Bila jumlah tombol aksi baris lebih dari 3,
otomatis diringkas menjadi dropdown (ikon titik-tiga vertikal) berisi seluruh aksi +
labelnya; 1–3 aksi tetap tampil langsung. Berlaku di semua tabel `ExcelTable`.

**102 Santri lifecycle.** `riwayat_belajar` (`status_awal`: santri_baru/
mengulang/pindahan; `status_akhir`: aktif/naik/tidak_naik/pindah_keluar/
lulus/tidak_lulus; `is_aktif` true iff `aktif`; semester 1/2; per-item mass
promotion with `{berhasil, gagal[]}`); graduation via `alumni` (last-wins),
exit via `mutasi_keluar`; package-aware (`nonAktifkanRiwayat`).
Status: ✅ live (8 endpoints, 10 tests). Gerbang AND per-lembaga target
(canAccess + riwayat-aktif). `pindah_keluar` ikut seeder no.51; `tidak_lulus`
buka baris mengulang tapel-berikut (tanpa alumni).

**103 Finance.** `pos_keuangan` (global `kode_pos`), `tarif_biaya`
(+`nominal_paket`), `tagihan` (idempotent `[santri,pos,periode]`),
`pembayaran` (`no_kuitansi` locked counter + 1062 retry, `client_op_id` Opsi B), `akun_kas`
(null = central), `jurnal_kas`; `lockForUpdate` pay flow; admin void with
reversal; kasir scoped to own lembaga.
Status: ✅ live (generate, bayar multi/partial, void, kuitansi PDF+thermal; 10 tests).

#### Phase 2 — Academic 🟡 (spec locked, not implemented)

**200 Personnel.** Global `pegawai` master (+11 EMIS cols), multi-lembaga via
`keaktifan_pegawai`, `tugas_utama` kamus, one-to-one `pegawai_sertifikasi`
(auto-sync flag), `keluarga_pegawai`, `pegawai_dokumen`, manual account link
(full-admin only), `setWalas()` 3-layer validation (FE filters active keaktifan).
Status: 🟡 `pegawai` table exists; service/policy pending.

**201 Curriculum & subjects.** `kurikulum` per lembaga, `kurikulum_mapel`
(explicit mapel + `tingkat` null=all + `kkm` null=manual + `urutan`),
`kelas_kurikulum` dual pivot, `tunjukPengampu` 4-layer validation;
class members read from `riwayat_belajar` (no `kelas_santri` table).
Status: 🟡 tables exist; service/policy pending.

**202 Grades & rapor.** Centralized mass input (admin/pengampu/wali, per-item
partial `{berhasil, gagal[]}`), `akhir=(formatif+sumatif)/2`, fixed predicates
A90/B80/C70/D (KKM = archive), `keputusan_kenaikan`, PDF rapor
(terpisah/digabung views).
Status: 🟡 tables exist; `PenilaianService` pending.

**203 Parent portal.** Read-only aggregator (dashboard, bill summary) +
biodata proposals (1 active/santri, cancellable) via `PengajuanBiodataService`
(100); `wali_santri_relasi` + `wali_portal_logs`; `SantriPolicy::view` +
`{pesan, data}` envelope.
Status: 🟡 tables exist; portal service/controller pending.

#### Phase 5 + Infra 🔲 (closed drafts, open on demand)

`500` presensi santri · `501` presensi staff (stub) · `502` jadwal (slot,
conflict validation) · `503` tahfizh (ziyadah/murajaah) · `504` pimpinan
dashboard · `900` VPS deploy · `901` production config. Small tenant gates
already merged; full specs untouched until reactivated.

### 6. Frontend apps (scope per app)

All apps: Sanctum token login (identifier + password), secure token storage,
tenant-aware lists (filter by accessible `lembaga`), Indonesian UI.

#### 6.1 `frontend/admin-desktop-tauri` (primary admin)

Users: super_admin, admin. Full CRUD: users/roles, lembaga, tahun ajaran,
kelas (+`setWalas` picker from active keaktifan), 36 kamus (global vs lembaga
views), pos/tarif, plus (when backend lands): PSB antrean (verify/ACC/tolak,
paket ops), santri master + import, siklus (naik/pindah/mutasi/lulus),
billing/pay/void + kuitansi print, pegawai + keaktifan/sertifikasi,
kurikulum/mapel/pengampu, nilai massal + rapor print, wali proposals approval.
Status: 🟢 shell v0.5.0 live (Tailwind+shadcn: 20 tema ala VSCode data-driven + kustom, Gelap/Terang/Sistem per perangkat, galeri pratinjau, border lembut tanpa shadow, sidebar rail + Ctrl/Cmd+B, pagination, dialog/toast/skeleton). Tabel master memakai `react-datasheet-grid` lewat wrapper `ExcelTable` (seleksi gaya spreadsheet, resize + AutoFit, edit klik-2× langsung simpan) dengan kontrol global ukuran/tinggi/jenis huruf; **Google Fonts disimpan lokal di repo** (`src/assets/fonts`, 8 keluarga × Light/Regular) sehingga aplikasi berjalan **tanpa internet** — dihasilkan ulang via `scripts/fonts-offline.py`. Desktop Tauri 0.5.0 dibangun (`.app` 11 MB, `.dmg` 4 MB, aarch64, belum ditandatangani); build desktop hanya dijalankan bila diminta. Belum: PSB/santri/siklus/keuangan transaksi, 200+.

#### 6.2 `frontend/admin-desktop-pyside` (alternate admin)

Same scope as 6.1 (feature parity target), PySide6 implementation for
environments preferring Qt/Python (bulk Excel import, PDF printing).
Status: 🔲 not scaffolded.

#### 6.3 `frontend/kasir-mobile-react-native`

Users: kasir (+admin). Scope: daily cashier ops — tagihan list per lembaga,
`bayar` (multi-item, total==sum), kuitansi view/share, void request view,
kas selection (own lembaga; central read-only), PSB payment trace.
Offline: queue-and-sync for payments is OUT (online only, race safety).
Status: 🔲 not scaffolded (backend billing pending).

#### 6.4 `frontend/orangtua-mobile-react-native`

Users: orang_tua. Scope (203): children list → detail (profil, kelas,
tagihan + status, nilai/rapor, presensi poin, tahfizh rekap), ajukan/batalkan
biodata edits (whitelist fields, NIK needs full-admin), PSB lanjutan for
registered NIK, document upload status. Read-only except proposals/uploads.
Status: 🔲 not scaffolded (backend 203 pending).

#### 6.5 `frontend/pimpinan-mobile-react-native`

Users: pimpinan. This is NOT an admin app — it is a read-only statistics app
for strategic decisions. Scope (504): total santri keseluruhan, santri per
lembaga, enrollment per gelombang, jumlah guru, kehadiran guru, keuangan
(tertagih vs terbayar per pos/periode), tunggakan, kehadiran santri, tahfizh
progress, alumni/mutasi counts. No mutations whatsoever.
Status: 🔲 not scaffolded (backend 504 closed).

#### 6.6 `frontend/guru-mobile-react-native`

Users: guru. Scope: my classes (walas + pengampu), anggota kelas
(from active riwayat), nilai input per pengampu (massal per-item),
catatan wali, presensi sesi (when 500 opens), jadwal mengajar (when 502
opens), setoran tahfizh input (when 503 opens).
Status: 🔲 not scaffolded (backend 201/202 pending).

### 7. Data model summary

* Tenant: `lembaga` tree (`parent_id`, root `kode=PESANTREN`); `user_lembaga`
  pivot is the ONLY tenant store.
* Kamus pattern: consumer columns are free strings (no FK); `ref_*` tables
  provide suggestions via `RefService::effective(tipe, lembagaId)`; global
  rows shadowable on/off per lembaga.
* Identity: `santri.id` stable; NIK attribute (required, may be fictitious),
  dedup `nik+nama+tgl_lahir`.
* Lifecycle: `riwayat_belajar.is_aktif` (iff `status_akhir='aktif'`);
  `santri.status_global` recalculated; graduation/exit in `alumni` /
  `mutasi_keluar`, never on santri.
* Idempotency: `[santri,pos,periode]` bills, `no_kuitansi` belt, 1062 re-read.

### 8. API conventions

* Prefix `/api`, `auth:sanctum` + `role:` middleware; admin group
  `role:super_admin|admin`; portal group `role:orang_tua`.
* Service layer (thin controllers); policies per model; `latest('id')`;
  Excel imports use flat keys; NIK-null uses `create()`.
* See live contract: `php artisan route:list --path=api` (36 routes).

### 9. Non-functional requirements

* Concurrency: `lockForUpdate` on kuota/nomor/tagihan/kuitansi/riwayat;
  1062 retry (max 3–4) with re-read.
* Security: Sanctum tokens, throttle login (6/min) + `login_audits`,
  no privilege escalation (`assignableRolesFor`), tenant AND-checks on writes.
* Data: `migrate:fresh` allowed pre-production (no backfill); seeds via
  `ReferensiSeeder` (no.51) + `RoleSeeder` (6 roles).
* MySQL: index names ≤64 chars (`uq_*` short names); multi-NULL uniques
  guarded in service, not relied on.

### 10. Implementation status matrix

| Area | Spec | Migrated | Seeded | API live |
|---|---|---|---|---|
| 001 setup | ✅ | n/a | n/a | n/a |
| 002 schema (~80 tables) | ✅ | ✅ | n/a | n/a |
| 003 auth/users | ✅ | ✅ | ✅ roles | ✅ |
| 004 ref/master (36 kamus, lembaga/TA/kelas) | ✅ | ✅ | ✅ no.51 | ✅ |
| 103 pos/tarif master | ✅ | ✅ | — | ✅ |
| 100 PSB full (daftar, paket, verify/ACC, portal, dokumen, import) | ✅ | ✅ | — | ✅ (69 routes, 10 tests) |
| 101 Santri (CRUD, import, kamus, policy) | ✅ | ✅ | — | ✅ (10 tests) |
| 102 Siklus (naik, pindah, mutasi, lulus, list) | ✅ | ✅ | — | ✅ (9 tests) |
| 103-tx/200/201/202/203 | ✅ specs | ✅ tables | — | 🔲 |
| Fase 5 (500–505), infra (900–901) | 🔲 drafts | ✅ tables | — | 🔲 |
| 6 frontend apps | §6 above | n/a | n/a | 🔲 |

### 11. Roadmap

1. Backend services in vault order: 100 → 101 → 102 → 103-tx → 200 → 201 → 202 → 203 (each: service + policy + controller + tests).
2. Scaffold `admin-desktop-tauri` auth/users shell against live 003/004 APIs.
3. Scaffold remaining frontends as their backend slices land.
4. Reactivate Fase 5 + infra when core is live.
5. Harden: load test, audit logs review, backup/restore runbook.

### 12. Out of scope

Multi-pesantren SaaS, web-session UI, offline payment queueing, payroll,
accounting beyond kas journal, SMS gateway (notifications are in-app +
aggregate badge, free tier).

### 13. Glossary

santri (student) · lembaga (unit: MI/MD/MTs/Mu'allimin) · tahun ajaran
(academic year) · rombel/kelas (class) · wali (guardian/parent user) ·
walas (homeroom teacher, `kelas.walas_id → pegawai`) · PSB (admission) ·
Daftar ulang (re-enrollment) · Kuitansi (receipt) · Rapor (report card) ·
Tahfizh (Qur'an memorization: ziyadah/murajaah) · KBM (teaching activity).
