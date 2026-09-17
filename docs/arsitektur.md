# Arsitektur SIMPES (Part A — Bab 2–8)

> Pecahan dari `PRD.md` (v2.56). changelog induk tetap di `PRD.md`.
> "Bab 1" → `PRD.md`; "Bab 9–14 + Lampiran" → `operasi.md`; "§N" → `backend-detail.md`.


## 2. Gambaran Sistem

### 2.1 Deskripsi Umum

SIMPES adalah backend API-first Laravel 13 + frontend terpisah, modular berurutan (`001→004→100→102→200→203`).

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
- Paket MI-MD opsional: 1 input usia SD jadi 2 keikutsertaan (primer MI, non-asrama, lifecycle tidak divergen). MI saja / MD saja tetap boleh.
- Tenant: pivot `user_lembaga` satu-satunya; tanpa tabel `pesantren` (Modul 003 Auth Login).

### 2.3 Peran Pengguna

| Peran | Tenant | Hak utama |
|---|---|---|
| `super_admin` | Semua, tanpa pivot | Semua izin (terkunci di matriks); tulis global `ref_*`; buat semua peran; kelola matriks izin |
| `admin` | Full tanpa pivot = semua; scoped dengan pivot = subset via `isAdminFull()` | Semua izin kecuali `izin.*`, `tampilan_standar.lihat`, `server.lihat`, `lembaga.tambah`; CRUD `001–004` (kecuali tambah lembaga = super_admin), `100–102`, attach/detach `user_lembaga`; tak boleh mutasi/hapus pemegang `admin/super_admin` maupun role diri sendiri |
| `guru` | Wajib pivot ≥1 | Modul 202 Nilai-Rapor: input miliknya/walasnya |
| `orang_tua` | Wajib pivot, via `wali_santri_relasi` | Modul 203 Portal Wali + Modul 100 PSB Penerimaan daftar + ajukan/batal (1 aktif/santri) |
| `santri` | Wajib pivot | Portal terbatas |
| `asrama` | Wajib pivot `user_asrama` (ditetapkan super_admin saja) | Modul 505 Asrama (**pasca production**; peran belum di-seed sekarang): penghuni/kamar/izin pulang/kegiatan; keuangan mengikuti perumusan ulang modul keuangan |
| (`kasir` — dihapus sementara; kembali saat modul keuangan dirumuskan ulang) | Wajib pivot ≥1 | Menunggu modul keuangan |

Aturan terkunci:
- 6 peran final: `super_admin, admin, guru, orang_tua, santri, asrama`; **efektif sekarang 5** — `asrama` menyusul pasca production (Modul 505); guard wajib `sanctum`; multi-peran didukung. 4 peran lama (`admin_pesantren, admin_lembaga, kasir_pesantren, kasir_lembaga`) dihapus; gabung jadi `admin` / `kasir` (Modul 003 Auth Login). Role `kasir` dihapus sementara dari seed/kode (v2.38); riwayatnya tetap di changelog.
- Tenant pivot `user_lembaga`; `users` tanpa kolom tenant; 1 akun multi-lembaga via `lembaga_ids[]` (mis. 1 akun `admin` untuk MI+MD); non-admin tidak boleh list users. Peran `asrama` memakai pivot tambahan `user_asrama` (1 akun boleh multi-asrama) dan **tidak** memberi akses `user_lembaga`.
- Pemberian peran via `assignableRolesFor()`: `super_admin` ke semua 6; `admin` hanya `guru,orang_tua,santri` (tidak boleh buat sesama `admin/super_admin`, dan **tidak boleh** memberi `asrama` — khusus super_admin); tambah lembaga via attach/detach oleh `super_admin`/admin full; larang hapus diri sendiri. **Pengecualian create**: saat *membuat user* saja, `admin` (full/scoped) boleh memberi role `admin` — batas lembaga ⊆ kewenangan pembuat (boleh subset; scoped tanpa `lembaga_ids` memakai pivot sendiri, sehingga tak bisa melahirkan admin global). Jalur `update`/`assignRole`/`removeRole`/`import` tetap tanpa role `admin`.
- Login multi-identifier `email/phone/username` + `password`, throttle 6/mnt, tulis `login_audits` + `last_login_at`. Buat user hanya oleh admin manual atau Import Excel; register publik tidak dibuka.

### 2.3.x Matriks Izin (Kelola Izin)

Kewenangan terdiri dari dua dimensi yang dikombinasikan (AND):
- **Aksi** — izin `modul.aksi` (`lihat/tambah/ubah/hapus` per modul + izin halaman pseudo `daftar_kelas/pindah_kelas/kenaikan/kelulusan/rekap_santri/mutasi_keluar/tampilan_standar/server/izin`), dikelola super_admin lewat halaman Kelola Izin (matriks checkbox role × izin, simpan per role). Katalog kanonis: `IzinKatalog::MODUL_AKSI` (satu sumber kebenaran untuk seeder, validasi API, dan audit FE).
- **Cakupan data** — pivot `user_lembaga` (`bolehPesantren()`/`canAccessLembaga()`); tidak berubah oleh matriks.

Aturan terkunci:
- Role `super_admin` selalu full (barisnya terkunci di matriks; API menolak `PUT` untuknya) — anti-lockout.
- Halaman Kelola Izin + endpoint `/api/admin/izin` hanya pemilik `izin.*` (= super_admin).
- Portal orang_tua/santri dan grup campuran (`portal/psb/{calon}/dokumen`) tetap role-based (pengecualian terdokumentasi, di luar matriks).
- Aturan struktural tetap di kode (bukan matriks): tambah lembaga, sebar standar tampilan, mutasi target privileged, dan kunci role diri = super_admin saja.
- Halaman baru wajib didaftarkan di katalog + `HALAMAN.permission`; `frontend/admin-desktop-tauri/scripts/audit-izin.mjs` (predev/prebuild/pretypecheck) dan test pengerasan route menggagalkan drift.

### 2.4 Asumsi dan Batasan

| ID | Asumsi (kode + nama modul) |
|---|---|
| A1 | Online; API-first Laravel 13 / PHP 8.4+ / MySQL / Sanctum `sanctum` (Modul 001 Inisiasi, 003 Auth Login) |
| A2 | Single-pesantren via `lembaga`; tenant pivot `user_lembaga` saja (Modul 003) |
| A3 | Bahasa Indonesia persis DB: `santri`, `riwayat_belajar`, `tahun_ajaran` (AGENTS) |
| A4 | Data awal Excel per lembaga ke staging lalu verifikasi lalu production; dedup `nik+nama+tgl_lahir` (Modul 101 Santri, 003) |
| A5 | NIK wajib boleh fiktif tanpa flag (Modul 101) |
| A6 | `kurikulum`, `dokumen_wajib_lembaga`, `ref_*` per lembaga; kontak/logo null fallback root, root null placeholder (Modul 004 Referensi-Master, 100 PSB Penerimaan) |
| A7 | FE terpisah Tauri/PySide/RN; Flutter dihentikan; base `API_BASE_URL` fallback `127.0.0.1:8000/api` (Modul 003) |
| A8 | Kapasitas/kinerja ikut Bab 3.2 NFR-01 sampai NFR-07; anggaran Bab 9 |

| ID | Batasan (kode + nama modul) |
|---|---|
| B1 | Migration per-modul per-file (timestamp bawaan, urutan FK); spec di `docs/SCHEMA.md`; file besar single-file lama dihapus (v1.3.1) |
| B2 | Register publik ditutup; buat user hanya admin manual/import (Modul 003) |
| B3 | Guard wajib `sanctum`; throttle login 6/mnt; middleware `permission:` + `authorize` + `canAccessLembaga` wajib (Modul 003) |
| B4 | UNIQUE nullable tidak cegah duplikat NULL MySQL; dedup wajib service (`RefService`, import 101) (Modul 002) |
| B5 | Kolom pemakai `ref_*` string tanpa FK; shadow global hanya `is_active` (Modul 004) |
| B7 | Scope G0-G3 production dulu; G4+ TBD; `500-505`, `900-901` ditutup sementara (Bab 1.4) |

---

## 3. Analisis Kebutuhan

### 3.1 Functional Requirement (G0–G3 detail; pasca persiapan)

| ID                     | Modul (kode + nama)                               | Functional Requirement                                                                                           | Status doc            |
| ---------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------- |
| FR-003                 | 003 Auth Login                                    | Login multi-identifier, 6 peran (efektif 5; `asrama` pasca production, `kasir` dihapus sementara v2.38), import, audit, matriks izin Kelola Izin (super_admin) | Detail (G0)           |
| FR-004                 | 004 Referensi-Master                              | `lembaga`, `tahun_ajaran`, `kelas`, 34 `ref_*` via `RefService`                                                  | Detail (G0)           |
| FR-100                 | 100 PSB Penerimaan Santri                         | 2-jalur via `is_seleksi` + override null ikut default, kuota saat input, waiting_list, paket MI-MD opsional, ACC | Detail (G1+G3 daftar) |
| FR-101                 | 101 Santri Master                                 | `id` stabil; NIK fiktif boleh; dedup; `status_global` turunan (default false); `lembaga_id` boleh NULL (legacy, terlihat semua admin) | Detail (G1)           |
| FR-102                 | 102 Siklus Santri                                 | status_awal/akhir, naik/pindah/mutasi/lulus                                                                      | Detail (G1)           |
| FR-203                 | 203 Portal Wali subset                            | Daftar + pengajuan                                                                                               | Detail (G3)           |
| FR-200, FR-201, FR-202 | 200 Pegawai, 201 Kurikulum-Mapel, 202 Nilai-Rapor | Skema siap, UI belakangan                                                                                        | Persiapan (G5/G7)     |
| FR-505                 | 505 Asrama                                        | Entitas `asrama` (bukan lembaga)+`user_asrama`+peran `asrama`; kamar, penghuni, izin pulang, kegiatan; keuangan menyusul perumusan ulang | Gambaran umum (**pasca production**) |

### 3.2 Non-Functional Requirement

| ID | Non-Functional Requirement |
|---|---|
| NFR-01 | <3 dtk; cache `RefService` 300 dtk |
| NFR-02 | 3.000 santri aktif; `per_page=50` + opsi "Semua" (`per_page=0`, batas 100.000) |
| NFR-03 | Bcrypt/argon2, throttle login 6/mnt, `lockForUpdate`, `latest('id')` |
| NFR-04 | Uptime 99%/bulan |
| NFR-05 | Sederhana; `control id snake_case` |
| NFR-06 | API-first; FE Tauri/PySide/RN |
| NFR-07 | Backup harian + rollback |

### 3.3 Use Case

| ID | Actor | Functional Requirement | Modul |
|---|---|---|---|
| UC-G0-01 | `super_admin`, `admin` | Login + kelola `users` (import, audit) | 003 Auth Login |
| UC-G0-00 | `super_admin` | Kelola matriks izin role × modul (Kelola Izin) | 003 Auth Login |
| UC-G0-02 | `super_admin`, `admin` | Kelola `lembaga`, `tahun_ajaran`, `kelas`, `ref_*` | 004 Referensi-Master |
| UC-G1-01 | `admin`, `orang_tua` | PSB daftar, verifikasi, seleksi opsional, ACC + paket MI-MD | 100 PSB Penerimaan |
| UC-G1-02 | `admin` | Kelola `santri` + import dedup | 101 Santri Master |
| UC-G1-03 | `admin` | Naik/pindah/mutasi/lulus (`riwayat_belajar`) | 102 Siklus Santri |
| UC-G3-01 | `orang_tua`, `santri` | Portal daftar + pengajuan | 203 Portal Wali subset |
| UC-Pasca | `guru` + pasca | Pegawai, kurikulum-mapel, nilai-rapor, `500-505` | 200, 201, 202, 500-505 TBD |

---

## 4. Model Proses Bisnis (logika saja)

| ID | Modul (kode + nama) | Aturan | Input, Proses, Output |
|---|---|---|---|
| 4.1 | 100 PSB Penerimaan | Master kegiatan → gelombang (anti-overlap, otomatis saat daftar) → kuota pendaftaran per lembaga; 2-jalur via `lembaga.is_seleksi` (override null ikut default); kuota pool gabungan per kelompok kunci saat input (penuh ke waiting_list); paket MI-MD opsional (1 calon + baris `psb_calon_lembaga`, primer MI, non-asrama) | Input: NIK wajib (fiktif boleh), dokumen wajib per lembaga. Proses: cek-NIK ke daftar ke verifikasi ke seleksi opsional ke pemberkasan ke lengkapi ke ACC tunggal; aksi massal verifikasi/masuk daftar ulang/ACC/undur diri/hapus (soft delete + restore). Output: nomor `PSB_*`, `santri`, `riwayat_belajar` aktif (1 per lembaga) |
| 4.2 | 101 Santri Master (buku induk), 102 Siklus Santri | `santri` = identitas murni + `status_global` (turunan: ada `riwayat_belajar.is_aktif`); keanggotaan per lembaga di `lembaga_santri` (`nis_lokal`, `nis_kemenag` manual, `is_active`, `tgl_mulai`/`tgl_selesai`); `riwayat_belajar` tanpa `nis` (jejak kelas/semester) | Input identitas: ACC PSB, dialog manual, import Excel identitas. Keanggotaan/riwayat: ACC PSB, dialog Riwayat Belajar, import riwayat terpisah (kunci `nik` → fallback `nis_lokal`+lembaga), kenaikan, kelulusan. Proses: salin ganjil→genap; kenaikan massal per-item (kelas menyusul); pindah/set/keluar kelas; mutasi & kelulusan menutup riwayat + keanggotaan (arsip `mutasi_keluar`/`alumni`). Output: `riwayat_belajar`, `lembaga_santri`, `mutasi_keluar`, `alumni` |
| 4.3 | (Dihapus — Modul Keuangan dirumuskan ulang dari awal; lihat entri changelog 2.36) | — | — |
| 4.4 | 203 Portal Wali G3 | Daftar + pengajuan (1 aktif/santri); envelope `pesan/data` | Input: akun `orang_tua` via `wali_santri_relasi`. Proses: list anak ke detail. Output: pengajuan |
| 4.5 | 200 Pegawai, 201 Kurikulum-Mapel, 202 Nilai-Rapor persiapan | Skema siap: `kurikulum`, pivot `kurikulum_mapel` (tingkat/kkm/urutan), `pengampu` 4 lapis, `mode_rapor`, `semester` | Dibangun G5/G7; arsip 201/202 |
| 4.6 | 505 Asrama (gambaran umum v1.10 — **pasca production**) | Asrama entitas sendiri (bukan `lembaga`); pengurus via peran `asrama` + `user_asrama`; kamar & penghuni punya siklus mandiri; daftar per jenjang/JK dari query (bukan kolom); keuangan asrama menyusul perumusan ulang | Input: `asrama` + `asrama_kamar`, penempatan `asrama_penghuni` (kamar menyusul), `asrama_izin_pulang`, `asrama_kegiatan`. Proses: izin pulang diajukan lalu diproses (setujui/tolak), penghuni keluar (tutup baris). Output: daftar penghuni per asrama/jenjang/JK, riwayat izin. Presensi asrama & kegiatan harian detail ditunda (TBD) |

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
| FR-003 | 003 Auth Login | `users`, `user_lembaga`, `user_asrama`, `login_audits`, `permissions`, `role_has_permissions` | Detail |
| FR-004 | 004 Referensi-Master | `lembaga`, `tahun_ajaran`, `kelas`, 34 `ref_*` | Detail |
| FR-100 | 100 PSB Penerimaan | `psb_*`, `dokumen_santri` | Detail |
| FR-101 | 101 Santri Master | `santri` | Detail |
| FR-102 | 102 Siklus Santri | `riwayat_belajar`, `mutasi_keluar`, `alumni` | Detail |
| FR-203 | 203 Portal Wali subset | `wali_*`, `pengajuan_biodata_santri` | Detail G3 |
| FR-200, FR-201, FR-202 | 200 Pegawai, 201 Kurikulum-Mapel, 202 Nilai-Rapor | Lihat arsip | Persiapan |
| FR-505 | 505 Asrama | `asrama`, `asrama_kamar`, `asrama_penghuni`, `asrama_izin_pulang`, `asrama_kegiatan`, `user_asrama` | Gambaran umum (**pasca production**) |

### 5.3 Alur Data Utama (G0–G3)

| ID | Alur | Tahapan |
|---|---|---|
| 5.3.1 | PSB 100 | cek-NIK ke daftar ke verifikasi ke ACC ke `santri+riwayat` |
| 5.3.2 | Siklus 102 | salin ganjil-genap ke naik massal ke penempatan ke mutasi/lulus |
| 5.3.4 | Nilai 202 persiapan | simpan massal ke hitung ke portal (dibangun G5) |
| 5.3.5 | Asrama 505 (gambaran umum) | daftar penghuni ke penempatan kamar ke izin pulang ke proses (setujui/tolak/kembali) |

---

## 6. Perancangan Basis Data (format umum)

> Tipe logis umum, bukan sintaks Laravel. Rincian kolom lengkap di ERD Lampiran A + Modul 002 Skema Database.

| ID | Modul (kode + nama) | Tabel inti | Relasi kunci |
|---|---|---|---|
| 6.1 | 003 Auth Login, 004 Referensi-Master | `lembaga`, 34 `ref_*`, `users`, `user_lembaga`, `tahun_ajaran`, `pegawai`, `kelas` | `lembaga 1—N tahun_ajaran/kelas`; `kelas.walas_id` inline; ref global + shadow lembaga |
| 6.2 | 101 Santri Master, 102 Siklus Santri | `santri`, `riwayat_belajar`, `mutasi_keluar`, `alumni` | `santri 1—N riwayat_belajar`; `riwayat N—1 kelas`; `id` stabil, NIK index tanpa unique; `santri.lembaga_id` nullable (cache, fallback riwayat), `status_global` turunan |
| 6.3 | 100 PSB Penerimaan | `psb_*`, `dokumen_santri` | `calon` ke `santri` saat ACC; dokumen pindah ke santri |
| 6.5 | 200 Pegawai, 201 Kurikulum-Mapel, 202 Nilai-Rapor, 203 Portal Wali | `kurikulum_mapel` pivot, `wali_*`, `pengajuan_biodata_santri` | `kurikulum N—M mapel` via `kurikulum_mapel`; wali via `wali_santri_relasi` |
| 6.6 | 505 Asrama (gambaran umum — **pasca production**) | `asrama`, `asrama_kamar`, `asrama_penghuni`, `asrama_izin_pulang`, `asrama_kegiatan`, `user_asrama` | `asrama 1—N kamar/penghuni/izin/kegiatan`; `santri 1—N penghuni`; pengurus via `user_asrama` (asrama bukan `lembaga`) |

Contoh kamus ringkas:

**`santri`:** `id INT PK`; `nik VARCHAR(16) INDEX nullable` (fiktif boleh, dedup service); `nis VARCHAR(20) nullable` (maks 20 karakter); `status_global BOOLEAN DEFAULT false` (turunan: punya ≥1 riwayat aktif); `lembaga_id INT FK NULL` (legacy tanpa track; cache), `kelas_id INT FK NULL`.
**`riwayat_belajar`:** `status_awal VARCHAR`; `status_akhir VARCHAR`; `is_aktif BOOLEAN` (tulis via service); `semester CHAR(1)`.
**`asrama`:** `id INT PK`; `jenis_kelamin ENUM(L,P)`; `user_asrama(user_id, asrama_id)`; tidak memakai `riwayat_belajar`.

---

## 7. Perancangan Antarmuka

| App | Modul (kode + nama) | Fitur | Kontrak |
|---|---|---|---|
| Desktop Admin G0-G1 | 001-004, 100 PSB Penerimaan, 101 Santri Master, 102 Siklus Santri | CRUD penuh referensi, PSB, santri/siklus | `control id snake_case`, `per_page=50` + "Semua", tangani 401/403/422/429 |
| Mobile Kasir G2 | DITUNDA — menunggu perumusan ulang modul keuangan | — | Sama |
| Mobile Ortu G3 | 100 daftar, 203 Portal Wali subset | Daftar + ajukan/batal | Sama |
| Pasca TBD | 200 Pegawai, 201 Kurikulum-Mapel, 202 Nilai-Rapor, 500+ | Pegawai, nilai, presensi | TBD |

### 7.1 Prinsip
- Bahasa Indonesia di seluruh label, toast, dan aria; `id` elemen `snake_case` (NFR-05); nilai DB snake_case dipetakan ke label tampil (mis. status PSB).
- Angka memakai format Indonesia (`id-ID`); tanggal memakai locale `id-ID`.
- Tanpa internet: font dibundel lokal, token dihitung runtime — tambah tema tanpa sentuh CSS.

### 7.2 Tema, mode, dan token
- 25 preset tema (termasuk Hijau Pesantren bawaan dan set populer ala VSCode); tiap tema berisi palet terang + gelap + warna sidebar.
- Mode Terang/Gelap/Sistem (sistem mengikuti OS) + varian Kaya warna (netral/aksen/kaya); bawaan: tema `geist`, mode sistem, warna kaya.
- Teks tombol dihitung otomatis (kontras ≥4,5:1); ikon header/ribbon/sidebar/akun mengikuti warna aksen; border global lembut (12% via color-mix, tanpa shadow kartu); radius seragam 4 px.
- Token runtime per bagian (~100 id: tabel, form, dialog, toast, sidebar, dsb.) — font, ukuran, radius, padding, warna per mode; fallback CSS bila standar belum diatur.

### 7.3 Navigasi
- Dua mode per perangkat: sidebar rail (lipat ke ikon via tombol & Ctrl/Cmd+B, 5 grup) atau menubar; pemilih di submenu Navigasi pada menu akun, sejajar submenu Tema (25 pilihan), Set ikon (9 set), dan Kaya warna.
- Menu akun kanan atas: pengalih lembaga aktif, tahun ajaran aktif, strip mode terang/gelap/sistem, lalu keluar.
- Bar judul halaman + baris tools kontekstual; halaman menyumbang tools via slot (tab ganda bila halaman + tabel sama-sama punya tools); tombol lipat baris tools per perangkat.

### 7.4 Tabel (pola Excel)
- Wrapper tunggal `ExcelTable`: seleksi gaya spreadsheet, resize kolom drag, AutoFit (klik-2× gagang, klik-kanan header, atau semua kolom), edit klik-2× langsung simpan, salin blok TSV siap tempel ke Excel.
- Kerapatan Ramping/Sedang/Nyaman (20/24/30 px) + tinggi baris manual; bekukan N kolom; tinggi header otomatis mengikuti judul multibaris; ukuran huruf sel (bawaan 11 px) dan header (bawaan 11 px) mandiri.
- Preset kolom per tabel (bawaan "Lengkap" terkunci + buatan user, multi-generate per lembaga); pilihan terakhir diingat per user.
- Aksi baris ≤3 tampil langsung, >3 diringkas ke dropdown titik-tiga; pagination 10/50/100/500 + "Semua"; skeleton saat muat, teks "Belum ada data." saat kosong.

### 7.5 Komponen dan umpan balik
- Basis Radix + shadcn (tombol, dialog, dropdown, select, checkbox, tooltip, skeleton, dsb.); stepper vertikal/horizontal untuk angka; combobox preset kolom dengan dialog kelola.
- Dialog konfirmasi hapus, dialog pratinjau (import/samakan), toast sukses/gagal Bahasa Indonesia di tengah atas.
- Form tambah/ubah berupa modal; tombol utama kanan atas halaman.

### 7.6 Font
- Bawaan tabel: Roboto Light (300), sel dan header masing-masing 11 px; UI: Aptos (isi), display (judul), Aptos Narrow, monospace kode.
- 29 opsi font (sistem + Aptos + Google Fonts yang disimpan lokal sehingga offline); pilihan tersimpan per perangkat dan tersinkron antara ribbon dan halaman Tampilan.

### 7.7 Pengaturan tampilan
- Halaman Tampilan (pribadi): cari bagian, pratinjau langsung, reset per bagian/banyak/semua; badge "Standar lembaga · versi N" + tombol kembali ke standar bila admin menyebar standar.
- Halaman Standar (super_admin): sebar satu paket tampilan ke lembaga terpilih; klien memantau versi dan memuat ulang otomatis.

---

## 8. Implementasi

### 8.1 Tumpukan Terkunci

Laravel 13 / PHP 8.4+, Sanctum (`sanctum`), Spatie (`sanctum`), MySQL, Excel, DomPDF, Service Layer. FE: Tauri/PySide/RN (Flutter dihentikan).

### 8.2 Strategi Migration (per alur, per-modul per-file)

Migration per-modul (timestamp bawaan, urutan FK); spec di `docs/SCHEMA.md`. Urutan `lembaga` ke `ref_*` ke `users` (`0001` bawaan) ke `user_lembaga` ke `tahun_ajaran` ke `pegawai` ke `kelas` ke `santri` ke riwayat ke PSB ke lanjutan; blok asrama (`asrama*`, `user_asrama`) menyusul setelah presensi.

| ID | Alur (Bab 4) | Modul | Tabel (BLOK) |
|---|---|---|---|
| 8.2.1 | PSB | 100 PSB Penerimaan | `psb_gelombang`, `psb_kuota_biaya`, `psb_calon_santri`, `dokumen_santri`, `dokumen_wajib_lembaga`, `psb_log_status` |
| 8.2.2 | Santri/Siklus | 101 Santri Master, 102 Siklus Santri | `santri`, `riwayat_belajar`, `mutasi_keluar`, `alumni` |
| 8.2.4 | Akademik/Nilai/Portal | 200, 201, 202, 203 | `kurikulum*`, `pengampu_mapel`, `nilai_santri`, `rapor_catatan_wali`, `wali_*` |
| 8.2.5 | Asrama (gambaran umum — **pasca production**, belum dibuat) | 505 Asrama | `asrama`, `asrama_kamar`, `asrama_penghuni`, `asrama_izin_pulang`, `asrama_kegiatan`, `user_asrama`; perubahan `santri` (lembaga_id nullable, status_global default false — dibahas terpisah) |

### 8.3 Konvensi Kode

| ID | Aturan Kode | Modul |
|---|---|---|
| 8.3.1 | Guard `sanctum` + middleware `permission:` + `canAccessLembaga` / `isAdminFull` | 003 Auth Login |
| 8.3.2 | `DB::transaction` + `lockForUpdate` | 102 |
| 8.3.3 | Key Excel flat; NIK null ke `create()` | 003, 101 |
| 8.3.4 | `latest('id')` | Semua list |

---
