> Pecahan dari `PRD.md` (v2.56): file ini = Part B apa adanya (snapshot EN 2026-09-09).
> "Bab N / Lampiran" → `arsitektur.md` / `operasi.md`; changelog induk di `PRD.md`.


# Part B — Detail Backend (EN, dari backend/docs/PRD.md 2026-09-09)

> Digabung ke root docs per keputusan sesi. File lama `backend/docs/PRD.md` kini pointer.

## Sistem Pesantren — Product Requirements Document (PRD)

> Scope: entire system (backend + all frontends).
> Source of truth for backend behavior: step-by-step build guides in the docs vault
> (`Backend/001`–`004`, `100`–`102`, `200`–`203`; decisions `000` no.1–51).
> Status as of 2026-09-09. Language: English.

### 1. Overview

Sistem Pesantren is an integrated information system for a single pesantren
(Islamic boarding school) that runs several educational units (lembaga:
MI, MD, MTs, Mu'allimin) under one root identity.

Vision: one identity per santri (`santri.id`),
one reference dictionary — serving six operator roles through
purpose-built frontends that all consume a single Laravel API.

Non-goals: multi-pesantren SaaS (explicitly dropped, decision no.40);
web session UI (API-first, token auth only).

### 2. System architecture

```
                      ┌─────────────────────────────┐  backend/
                      │   Backend (Laravel 13 API)  │
                      │    Sanctum tokens, /api/*   │
                      └──────────────┬──────────────┘
       ┬──────────────┬──────────────┼──────────────┬──────────────┬
       ▼              ▼              ▼              ▼              ▼
 admin-desktop      kasir         orangtua       pimpinan         guru
     -tauri        -mobile        -mobile        -mobile        -mobile
   (Tauri 2)         (RN)           (RN)           (RN)          (RN)
```

All frontends are separate projects under `frontend/` (never merged):

| App | Folder | Stack | Users |
|---|---|---|---|
| Admin desktop (primary) | `frontend/admin-desktop-tauri` | Tauri 2 | super_admin, admin |
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
  (`guard_name: sanctum`), MySQL, Maatwebsite Excel, DomPDF (rapor),
  Service Layer pattern, `DB::transaction()` + `lockForUpdate()` for critical ops.
* Admin Tauri: Tauri 2 + frontend webview (to be decided: React/Vue/Svelte).
* Mobile (×4): React Native (shared API client design, separate apps/releases).
* Infra: single VPS deployment (docs `900`–`901`, currently closed).

### 4. Actors & roles

Six roles, hierarchical (decision no.40): `super_admin` → `admin` (full =
no `user_lembaga` pivot; scoped = via pivot) → `guru` →
`orang_tua` / `santri`. Plus `asrama` (pengurus asrama, pivot `user_asrama`,
v1.10; **pasca production** — efektif sekarang 5 peran; `kasir` dihapus
sementara v2.38). One user may hold multiple roles.

* `assignableRolesFor()`: super_admin grants all 6; admin grants
  `guru, orang_tua, santri` (no privilege escalation; `asrama`
  dan `admin` khusus super_admin, kecuali create-admin v1.9.x).
* Aksi vs cakupan (v2.38): *boleh melakukan apa* = izin matriks
  (`IzinKatalog`, `permission:` middleware, policy); *milik lembaga mana* =
  pivot (`User::lembagaIds()`, `canAccessLembaga()`, `isAdminFull()`).
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
HR-academic → grades → presensi → tahfizh → wali portal (23 file hasil squash).
MySQL 64-char index pitfall: 4 composite uniques use short `uq_*` names.
Status: ✅ `migrate:fresh` green (100 tables incl. framework/package tables).

**003 Authentication & users.** Multi-identifier login (email/phone/username),
password minimal 8 karakter, throttle + `login_audits`, 5 peran efektif (`kasir` dihapus sementara),
kunci diri (tak boleh ubah/cabut role sendiri, tak boleh hapus diri sendiri),
ganti role mencabut semua token (wajib login ulang), anti-eskalasi
(non-`super_admin` 403 memutasi/menghapus pemegang `admin`/`super_admin`),
act-as lembaga via header `X-Lembaga-Aktif`, `UsersImport` (flat keys, intra-file
dedup, `lembaga_ids[]` pivot sync), `UserPolicy`.
API: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`,
`GET|POST /api/admin/users`, `PUT|DELETE /api/admin/users/{user}`,
`POST /api/admin/users/import`, role assign/remove,
`POST|DELETE /api/admin/users/{user}/lembaga` (attach/detach, multi-lembaga).
Status: ✅ live.

**Dashboard (ekstra, di luar vault — didokumentasikan v1.3.2).**
`GET /api/dashboard/ringkasan` (`auth:sanctum`, semua peran, scope tenant +
opsional `?lembaga_id=`): hitungan `lembaga/pengguna/tahun_ajaran_aktif/kelas`
+ daftar tahun aktif. Bukan executive dashboard 504. Slot `santri`,
`antrean_psb` = null (placeholder modul lanjutan).

**004 Reference & master data.** 34 kamus tables (global row
`lembaga_id=null` + per-lembaga rows; shadow = on/off only for globals),
`RefService::effective()/kodeAktif()/forget()` (cached), urut tampil
`urutan` ASC tie-break `nama` ASC, `ReferensiSeeder`
(decision no.51 values), `Lembaga/TahunAjaran/Kelas` CRUD with tenant scope.
Aturan kamus: baris global diubah hanya `super_admin`; baris lembaga hanya
tenant pemilik; `kode` tak boleh diubah (kunci data), `nama` boleh; duplikat
kode/nama per scope → 422; global dihapus = shadow off per lembaga (bukan
fisik), milik lembaga = nonaktif, pulihkan hanya baris lembaga.
Aturan lembaga: tambah hanya `super_admin`; `kode/npsn/nsm` unik;
`kelompok_psb` combo hanya untuk kode MI/MD.
Aturan kelas: nama dinormalisasi (trim + rapat spasi), unik per
lembaga+tahun ajaran (case-insensitive, pre-check + tangkap 1062);
`kapasitas` minimal 1; `tingkat` harus dikenal di kamus efektif;
TA harus efektif; `kelas_id` menerima nama/id.
API: `GET /api/admin/referensi/types`, `GET|POST /api/admin/referensi/{tipe}`,
`DELETE /api/admin/referensi/{tipe}/{id}`, lembaga/TA/kelas CRUD.
Status: ✅ migrated + seeded (agama 6, tingkat 12, tugas 2, …).

#### Phase 1 — Core operations 🟡 (spec locked, not implemented)

**100 PSB (new-student admission).** Master kegiatan → gelombang (tanggal shared,
anti-overlap, satu kegiatan aktif; tanpa status gelombang — gerbang pendaftaran publik
otomatis murni dari tanggal buka/tutup) → kuota pendaftaran per lembaga. Two flexible
paths via `membutuhkan_seleksi` (direct vs selection); combined pool quota per
`kelompok_psb` (combo khusus MI/MD; pool value on the primary lembaga's
`psb_kuota_biaya` row) + `waiting_list`; MI-MD package (1 calon +
`psb_calon_lembaga` child rows, 1 grouped number `PSB_{tahun}_MIMD_{gel}_{seq}`,
single ACC → 1 santri + 2 riwayat); identity `nik+nama+tgl_lahir`
dedup (NIK may be fictitious); 9 statuses (no `seleksi`); `no_pendaftaran` race →
catch 1062 regenerate (max 3×). Bulk actions admin: verifikasi, seleksi,
ACC, hapus; hapus = soft delete + restore.
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
`riwayat_belajar`-nya dihapus dan calon kembali murni sebagai riwayat PSB. NIS wajib unik (master + arsip);
diisi opsional saat ACC atau menyusul via import/kenaikan. Batalkan fase
(kembali ke status sebelumnya dari log `psb_log_status`, aksi baris + massal) tersedia untuk
semua fase kecuali fase diterima/`daftar_ulang` (santri sudah dibuat).
`butuh_pemberkasan` hanya penanda
lengkapi berkas. Ketentuan dokumen
per kegiatan PSB × lembaga (`dokumen_wajib_lembaga`) bersifat penekanan — tidak menahan
daftar ulang; saat ACC baris checklist dibuat di `dokumen_santri` (boleh ditandai
"tidak memiliki"). Aturan pendaftaran: santri baru wajib tingkat entry
(MI/MD = 1, MTS = 7, MLN = 10), pindahan dari daftar tingkat yang diizinkan;
eksklusif (non-combo) tak boleh daftar ganda aktif, combo MI/MD maks 2
pendaftaran aktif; `no_pendaftaran` unik global (gagal 1062 generate ulang,
maks 3×); `cekNik` mengembalikan boolean saja (anti enumerasi); promosi
waiting→baru hanya bila kuota tersisa. Aturan kegiatan-gelombang: 1 kegiatan
per tahun ajaran, satu kegiatan aktif (aktifkan = matikan lainnya); gelombang
`tgl_tutup` ≥ `tgl_buka`, anti-overlap dalam kegiatan yang sama; hapus
kegiatan/gelombang ditolak bila sudah ada pendaftar. Status: ✅ live
(fitur tests hijau, suite 186/186). Captcha + PDF bukti ditunda.

**101 Santri master.** 74-column EMIS profile; NIK/NISN index-only + service
dedup; `updateOrCreate` only when NIK present (+ intra-file guard);
`status_global` bool (false iff ALL riwayat non-active);
`SantriPolicy` (guru excluded from admin list).
Aturan identitas: `nama_lengkap` + `jk` (L/P) wajib; NIK/No.KK/NIK ortu-wali
`digits:16`; NISN `digits:10`; NIS/nis_lokal maks 20 karakter; `nis_lokal` dan
`nis_kemenag` unik per lembaga (string kosong diabaikan); maks 1 baris aktif
per santri+lembaga. NISK: pola NSM(12 digit)+YY+4 digit akhir `nis_lokal`,
butuh `nis_lokal` terisi + tahun diterima, unik per lembaga.
Foto profil `jpg/jpeg/png` maks 2.048 KB.
Import satu pintu: template-data-periksa-eksekusi; berkas `xlsx/xls/csv` maks
10.240 KB; tulis gabungan butuh
`santri.tambah` DAN `santri.ubah`; pencocokan 4 lapis (santri_id eksak → NIK →
nis+lembaga → create wajib nama); sel kosong = pertahankan (tanpa pengosongan
via file); NIK kosong selalu create; kunci lembaga `kode_lembaga`
(case-insensitive) prioritas, fallback `lembaga_id`; baris luar tenant gagal
per baris (bukan 403); sel numerik/serial tanggal dinormalisasi sebelum
validasi; hanya sheet pertama (sheet Referensi diabaikan).
Samakan NIS MI↔MD: salin hanya bila tepat satu sisi bernomor + sisi tujuan tak
tabrakan; beda dua sisi / tabrakan hanya dilaporkan (tanpa auto-copy).
Status: ✅ live (CRUD scoped, import satu pintu identitas+gabungan, kamus, foto/dokumen, kolom NIS per lembaga, samakan NIS MI↔MD; suite 186/186).
Tambahan vs vault: mapping import penuh (tanpa drop diam-diam), `uploadFoto`,
`tipe_santri` rule, `kewarganegaraan` default WNI, kolom `kelas_id` menerima
nama kelas/id (dropdown template per lembaga+TA). Recalc `status_global` tetap di 102.

**Preset tampilan kolom tabel (lintas modul).** Combobox di toolbar setiap tabel
(`ExcelTable`) berisi bawaan "Lengkap" + preset buatan user; preset menyimpan
daftar kolom (`preset_tabel.kolom`) per tabel & per lembaga. Saat membuat preset,
user dapat memilih satu atau beberapa lembaga tujuan (multi-generate); tiap lembaga
lalu dapat mengedit salinannya sendiri. Pilihan terakhir per user per tabel diingat
di `preset_tabel_aktif`. Salin TSV mengikuti kolom yang terlihat. Preset
`lengkap` dikunci sistem; preset global hanya admin pesantren; nama unik per
tabel+lembaga.
Status: ✅ live.

**Aksi baris tabel (lintas modul).** Bila jumlah tombol aksi baris lebih dari 3,
otomatis diringkas menjadi dropdown (ikon titik-tiga vertikal) berisi seluruh aksi +
labelnya; 1–3 aksi tetap tampil langsung. Berlaku di semua tabel `ExcelTable`.

**Baris per halaman + "Semua" (lintas modul).** Opsi 10/50/100/500 + "Semua",
bawaan 50 per tabel; "Semua" dikirim `per_page=0` (batas 100.000), pager tetap
tampil agar bisa dikembalikan. Status: ✅ live.

**Pengaturan server (lintas modul).** Halaman pengaturan ganti base-URL backend
tanpa rebuild (token/base-URL via plugin-store di desktop); aksi uji koneksi +
kembalikan bawaan; izin `server.lihat` eksklusif `super_admin`. Status: ✅ live.

**Tampilan standar (lintas modul).** Sebaran standar tampilan ke lembaga
(`lembaga_ids` wajib; lembaga tak teresolusi → 422); izin `tampilan_standar.lihat`
eksklusif `super_admin`. Status: ✅ live.

**102 Santri lifecycle.** `riwayat_belajar` (`status_awal`: santri_baru/
mengulang/pindahan; `status_akhir`: aktif/naik/tidak_naik/pindah_keluar/
lulus/tidak_lulus; `is_aktif` true iff `aktif`; semester 1/2; per-item mass
promotion with `{berhasil, gagal[]}`); graduation via `alumni` (last-wins),
exit via `mutasi_keluar`; package-aware (`nonAktifkanRiwayat`).
Status: ✅ live (salin genap, naik/pindah/mutasi/lulus/berhenti massal per-item, halaman MI-MD tambah/hapus massal, beku kelas arsip; suite 186/186). Gerbang AND per-lembaga target
(canAccess + riwayat-aktif). `pindah_keluar` ikut seeder no.51; `tidak_lulus`
buka baris mengulang tapel-berikut (tanpa alumni).
Aturan penghapus: **X di halaman MI-MD = hapus fisik** jejak MD (anggota +
riwayat) tanpa arsip; pengarsipan resmi hanya lewat mutasi/kelulusan.
Aturan beku kelas arsip: `alumni.kelas_lulus_id` terisi otomatis dari riwayat
aktif terakhir saat lulus; `mutasi_keluar.kelas_terakhir_id` beku otomatis
dari riwayat aktif terakhir, input manual menang bila diisi (validasi
`nullable|exists:kelas,id` — sebelumnya input selalu terbuang).
Aturan rombel: `no_absen` unik per (kelas, tahun ajaran, semester), minimal 1;
kelas tujuan se-lembaga + se-TA, tingkat cocok bila keduanya terisi; hanya
riwayat aktif yang bisa diset/dipindah/dikosongkan kelasnya.
Aturan salin genap: wajib dari baris aktif semester 1; tolak bila baris
semester 2 tahun sama sudah ada. Aturan kenaikan: wajib dari semester 2 aktif;
`tidak_lulus` wajib TA berikut sudah ada (tingkat diwarisi, keanggotaan tetap
aktif). Daftar ulang jenjang: baris nonaktif lama tak diaktifkan ulang (buat
baris baru) kecuali reaktivasi arsip sendiri ber-NIS sama.
Import riwayat: upsert kunci (santri, TA, lembaga, semester); semester hanya
1/2; kelas by-nama (case-insensitive) atau id se-lembaga+TA; `status_awal`
bawaan `santri_baru`, `status_akhir` bawaan `aktif`; keanggotaan auto-create
(NIS unik); `is_active` parsing `1/0/aktif/ya/…`, tak dikenal = gagal baris.

**Pengajuan biodata (admin).** Antrean pengajuan perbaikan biodata dari wali:
setujui/tolak hanya untuk status `diajukan`; whitelist 17 field (luar daftar
ditolak); maks 1 antrean per santri; NIK hanya boleh diproses admin full;
setujui NIK didedup `nik+nama+tgl_lahir` kecualikan diri sendiri; batal hanya
oleh pemilik saat masih `diajukan`. Status: ✅ live (terpisah dari portal 203 🟡).

**Dokumen wajib.** Ketentuan dokumen per kegiatan PSB × lembaga; bersifat
penekanan — tidak menahan daftar ulang; saat ACC baris checklist dibuat
(boleh ditandai "tidak memiliki"). Jenis dokumen harus aktif di kamus lembaga;
berkas calon/santri `mimes:jpg,jpeg,png,pdf` maks 5.120 KB. Status: ✅ live.

**Tahun ajaran (perilaku).** Selalu milik lembaga operasional (root ditolak di
store/aksi/import); `nama` unik global; TA aktif tak boleh dihapus/disembunyikan;
hanya TA global bisa diaktifkan (satu aktif per transaksi); sembunyikan = baris
bayangan nonaktif per lembaga. Set-aktif/sembunyikan global hanya `super_admin`.
Status: ✅ live.

**Halaman MI-MD.** Tiga panel: MI Only, MD Semua (+ flag juga-MI), Beda Kelas
(perbandingan by-nama case-insensitive, null = ''). Aksi: daftarkan ke MD
(NIS warisi MI, `tgl_mulai` hari ini, idempoten), hapus fisik jejak MD
(izin `santri.ubah`; ditolak bila bukan-MI-aktif / tanpa anggota MD / ada arsip
alumni-mutasi MD), samakan kelas (pindah ke kelas senama di TA berjalan sisi
tujuan, butuh akses tulis tujuan). **Pengecualian tenant sadar**: akses MI atau
MD membuka kedua sisi — hanya di endpoint halaman ini; tulis tetap sisi target.
Izin halaman memakai ulang `rekap_santri.lihat`. Status: ✅ live.

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

Users: super_admin, admin. Full CRUD: users/roles (+ matriks Kelola Izin), lembaga, tahun ajaran,
kelas (Ambil/Copy antar lembaga, import/export nama), 34 kamus (global vs lembaga
views), PSB antrean (verify/seleksi/ACC/tolak/paket), santri master + import satu pintu
(kolom NIS per lembaga, samakan NIS MI↔MD), siklus (roster, salin genap, naik/pindah/mutasi/lulus/berhenti),
rekap, halaman MI-MD (tambah/hapus massal, samakan kelas), pengajuan biodata (setujui/tolak),
dokumen wajib, preset tabel, pengaturan server/tampilan.
Status: 🟢 shell v0.5.0 live (Tailwind+shadcn: 20 tema ala VSCode data-driven + kustom, Gelap/Terang/Sistem per perangkat, galeri pratinjau, border lembut tanpa shadow, navigasi menubar/ribbon/sidebar per perangkat, pagination 10/50/100/500 + "Semua", dialog/toast/skeleton). Tabel master memakai `react-datasheet-grid` lewat wrapper `ExcelTable` (seleksi gaya spreadsheet, resize + AutoFit, edit klik-2× langsung simpan, aksi baris >3 jadi dropdown, preset kolom per tabel) dengan kontrol global ukuran/tinggi/jenis huruf; **Google Fonts disimpan lokal di repo** (`src/assets/fonts`, 8 keluarga × Light/Regular) sehingga aplikasi berjalan **tanpa internet** — dihasilkan ulang via `scripts/fonts-offline.py`. Desktop Tauri 0.5.0 dibangun (`.app` 11 MB, `.dmg` 4 MB, aarch64, belum ditandatangani); build desktop hanya dijalankan bila diminta. Belum: modul 200+ (pegawai/kurikulum/nilai), Fase 5, portal ortu lanjutan.

#### 6.2 `frontend/kasir-mobile-react-native`

Users: kasir (+admin). Scope: DITUNDA — menunggu perumusan ulang modul keuangan dari awal.
Offline: queue-and-sync for payments is OUT (online only, race safety).
Status: 🔲 not scaffolded.

#### 6.3 `frontend/orangtua-mobile-react-native`

Users: orang_tua. Scope (203): children list → detail (profil, kelas,
nilai/rapor, presensi poin, tahfizh rekap), ajukan/batalkan
biodata edits (whitelist fields, NIK needs full-admin), PSB lanjutan for
registered NIK, document upload status. Read-only except proposals/uploads.
Status: 🔲 not scaffolded (backend 203 pending).

#### 6.4 `frontend/pimpinan-mobile-react-native`

Users: pimpinan. This is NOT an admin app — it is a read-only statistics app
for strategic decisions. Scope (504): total santri keseluruhan, santri per
lembaga, enrollment per gelombang, jumlah guru, kehadiran guru, keuangan
(menunggu perumusan ulang modul), kehadiran santri, tahfizh
progress, alumni/mutasi counts. No mutations whatsoever.
Status: 🔲 not scaffolded (backend 504 closed).

#### 6.5 `frontend/guru-mobile-react-native`

Users: guru. Scope: my classes (walas + pengampu), anggota kelas
(from active riwayat), nilai input per pengampu (massal per-item),
catatan wali, presensi sesi (when 500 opens), jadwal mengajar (when 502
opens), setoran tahfizh input (when 503 opens).
Status: 🔲 not scaffolded (backend 201/202 pending).

### 7. Data model summary

* Tenant: `lembaga` tree (`parent_id`, root `kode=PESANTREN`); `user_lembaga`
  pivot is the ONLY tenant store. Pengecualian tunggal: pasangan MI↔MD di
  halaman MI-MD (akses salah satu membuka kedua sisi baca; tulis tetap sisi
  target). Tulis gabungan butuh `santri.tambah` DAN `santri.ubah` (dua
  middleware = AND).
* Kamus pattern: consumer columns are free strings (no FK); `ref_*` tables
  provide suggestions via `RefService::effective(tipe, lembagaId)`; global
  rows shadowable on/off per lembaga.
* Identity: `santri.id` stable; NIK attribute (required, may be fictitious),
  dedup `nik+nama+tgl_lahir`.
* Lifecycle: `riwayat_belajar.is_aktif` (iff `status_akhir='aktif'`);
  `santri.status_global` recalculated; graduation/exit in `alumni` /
  `mutasi_keluar`, never on santri.

### 8. API conventions

* Prefix `/api`, `auth:sanctum` + `role:` middleware; admin group
  `role:super_admin|admin`; portal group `role:orang_tua`.
* Service layer (thin controllers); policies per model; `latest('id')`;
  Excel imports use flat keys; NIK-null uses `create()`.
* See live contract: `php artisan route:list --path=api` (144 routes, 101 di grup admin).

### 9. Non-functional requirements

* Concurrency: `lockForUpdate` on kuota/nomor/riwayat;
  1062 retry (max 3–4) with re-read.
* Security: Sanctum tokens, throttle login (6/min) + `login_audits`,
  no privilege escalation (`assignableRolesFor`), tenant AND-checks on writes.
* Data: `migrate:fresh` allowed pre-production (no backfill); seeds via
  `ReferensiSeeder` (no.51) + `RoleSeeder` (5 roles efektif; `kasir` dihapus sementara).
* MySQL: index names ≤64 chars (`uq_*` short names); multi-NULL uniques
  guarded in service, not relied on.

### 10. Implementation status matrix

| Area | Spec | Migrated | Seeded | API live |
|---|---|---|---|---|
| 001 setup | ✅ | n/a | n/a | n/a |
| 002 schema (23 migrasi hasil squash) | ✅ | ✅ | n/a | n/a |
| 003 auth/users | ✅ | ✅ | ✅ roles | ✅ |
| 004 ref/master (34 kamus, lembaga/TA/kelas) | ✅ | ✅ | ✅ no.51 | ✅ |
| 100 PSB full (daftar, paket MI-MD, verify/seleksi/ACC, portal, dokumen, import) | ✅ | ✅ | ✅ no.51 | ✅ (publik + admin + portal; suite 186/186) |
| 101 Santri (CRUD, import satu pintu, kamus, policy, kolom NIS, samakan NIS) | ✅ | ✅ | — | ✅ (suite 186/186) |
| 102 Siklus (salin genap, naik, pindah, mutasi, lulus, roster + arsip, halaman MI-MD, beku kelas) | ✅ | ✅ | — | ✅ (suite 186/186) |
| 200/201/202/203 | ✅ specs | ✅ tables | — | 🔲 |
| Fase 5 (500–505), infra (900–901) | 🔲 drafts | ✅ tables | — | 🔲 |
| 5 frontend apps | §6 above | n/a | n/a | ✅ 1 live (`admin-desktop-tauri`), 4 🔲 |

### 11. Roadmap

1. Inti ✅ live (100/101/102 + matriks izin + import satu pintu + halaman MI-MD): pemeliharaan + pengerasan (audit log review, load test, runbook backup/restore).
2. Berikutnya bila diminta: modul 200 → 201 → 202 → 203 (tiap modul: service + policy + controller + tests), lalu Fase 5 + infra (500–505, 900–901).
3. Aplikasi admin desktop tetap satu (`admin-desktop-tauri`); 5 aplikasi lain dibuka sesuai modul backend-nya.
4. `kelas_lulus_id` alumni sudah live (v2.52). **Modul keuangan (termasuk peran
`kasir`) dirumuskan ulang dari nol dan dikerjakan PALING AKHIR — tahap terakhir
sebelum production** (cakupan: jenis transaksi, metode bayar, peran loket
ditentukan saat tahap itu dimulai; tidak dibahas sekarang agar tidak merusak
susunan yang berjalan).

### 12. Out of scope

Multi-pesantren SaaS, web-session UI, offline payment queueing, payroll,
SMS gateway (notifications are in-app +
aggregate badge, free tier).

### 13. Glossary

santri (student) · lembaga (unit: MI/MD/MTs/Mu'allimin) · tahun ajaran
(academic year) · rombel/kelas (class) · wali (guardian/parent user) ·
walas (homeroom teacher, `kelas.walas_id → pegawai`) · PSB (admission) ·
Daftar ulang (re-enrollment) · Rapor (report card) ·
Tahfizh (Qur'an memorization: ziyadah/murajaah) · KBM (teaching activity).
