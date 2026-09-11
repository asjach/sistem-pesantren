# SIMPES Admin Desktop (v0.5.0)

Tampilan: Tailwind v4 + shadcn/ui (button/input/select/checkbox/table/badge/dialog/
sonner/skeleton, Radix) + `src/themes.ts` (data 20 tema) yang diterapkan runtime
oleh ThemeProvider; `src/index.css` hanya berisi nilai aman + turunan `color-mix`.

Tema (20 Top Populer ala VSCode, palet dari repositori resmi): **Hijau Pesantren**
(bawaan), **Monokai**, **One Dark Pro**, **Dracula**, **Nord**, **Tokyo Night**,
**Night Owl**, **Solarized**, **GitHub**, **Material Palenight**, **Gruvbox**,
**Catppuccin Mocha**, **Ayu Dark**, **Cobalt2**, **SynthWave '84**,
**Shades of Purple**, **Tomorrow Night Blue**, **Horizon**, **Panda**,
**Winter is Coming**, + **Kustom** (color picker). Teks tombol dihitung otomatis
(`onAccentFor`, 40/40 pasang ≥4.5:1). Tiap tema membawa latar & sidebar sendiri;
kartu/border/secondary/muted diturunkan via `color-mix` (border hanya 12% teks —
lembut). Mode **Gelap/Terang/Sistem** (Sistem ikut OS), tersimpan per perangkat.
Galeri pratinjau di Pengaturan > Tampilan.
Shortcut **Ctrl/Cmd+B** menyembunyikan sidebar jadi ikon saja.
Tambah tema = 1 objek di `src/themes.ts` (tanpa sentuh CSS).
Tambah komponen: `npx shadcn@latest add <nama> --yes`.

## Grid data ala Excel (`src/components/ExcelTable.tsx`)

Semua tabel master (users, lembaga, tahun-ajaran, kelas, pos, tarif) memakai
`react-datasheet-grid` (satu-satunya lib tabel; `react-data-grid`, `ag-grid`,
dan `react-data-table-component` sudah dicabut) lewat wrapper `ExcelTable`.
`ViewDialog` dipisah ke `src/components/ViewDialog.tsx`.

**Seleksi (gaya spreadsheet)**

- Klik sel = outline 1px; seret = blok; Shift+klik & Shift+panah = perluas;
  Ctrl/Cmd+A = seluruh tabel; klik header kolom / nomor baris = satu kolom/baris.
- Hanya ada satu garis (outline range) — garis grid di bawahnya ditimpa, bukan
  didampingi; header kolom + nomor baris ikut tersorot.
- Sel jangkar polos (lubang `clip-path` dipertahankan hanya saat mengedit),
  supaya input edit tetap terbaca.
- Garis kanan kolom terakhir & garis bawah baris terakhir digambar **di dalam**
  sel (`simpes-dsg-col-last` / `simpes-dsg-row-last::after`) karena `box-shadow`
  DSG terpotong tepi area scroll.

**Lebar kolom**

- Seret gagang tepi kanan judul → lebar 1:1 (gagang dipusatkan tepat di garis
  kolom), tersimpan per tabel per perangkat.
- Bila >1 kolom penuh terseleksi, menyeret salah satunya mengubah **semua**
  kolom terseleksi ke lebar yang sama (seperti Excel).
- **AutoFit**: klik 2× gagang, tombol toolbar (semua kolom), otomatis saat muat
  awal & saat ukuran/jenis huruf berubah. Diukur dari span DOM asli (canvas
  tidak bisa merepresentasikan `tabular-nums`) memakai font & padding nyata,
  memakai nilai terbesar antara judul kolom dan seluruh isi baris.

**Edit**

- Checkbox **Edit** (mode lama, ada tombol Simpan/Batal) **atau** klik 2× pada
  sel → langsung masuk edit dan **langsung tersimpan** per baris.
- Klik 2× pada sel dropdown membuka dropdown; klik 1× tetap baca-saja.
- Validasi per kolom tetap jalan; Escape membatalkan.

**Toolbar (satu baris, dikelompokkan)**

```
[cari][filter][Cari]   [Edit] │ [A ukuran][jenis huruf][tinggi] │ [Salin][AutoFit][Reset] │ [Simpan][Batal] │ [+ Pengguna]
```

- Grup: mode edit · tampilan (ukuran huruf 9–24px, jenis huruf, tinggi baris
  26–200px) · alat tabel · draft · tombol tambah halaman.
- **Global** (berlaku semua tabel, tersimpan per perangkat): ukuran huruf,
  tinggi baris, jenis huruf.
- Petunjuk "Seret untuk memblokir sel • Ctrl+C menyalin" ada di tooltip area
  tabel (bukan teks di toolbar); info baris tercentang muncul hanya saat ada.
- Checkbox baris + **Salin TSV** (siap tempel ke Excel); Ctrl+C menyalin sel.
- Kolom **Aksi** (Lihat/Ubah/Hapus) digerbang role per halaman; klik di dalam
  sel Aksi tidak mengubah seleksi grid.
- Sorting dimatikan; seleksi reset tiap ganti halaman; Referensi tetap chips.

**Jenis huruf (offline)**

`FONT_OPTIONS` = 9 font sistem + 8 Google Fonts (Inter, Roboto, Open Sans,
Lato, Noto Sans, Source Sans 3, Work Sans, Plus Jakarta Sans) masing-masing
varian Light/Regular. Google Fonts **diunduh ke repo** (`src/assets/fonts`,
32 `@font-face`, 1,4 MB) lewat `scripts/fonts-offline.py` — aplikasi tidak
pernah menghubungi fonts.googleapis/gstatic. Berlaku untuk **isi tabel** saja;
header kolom tetap `--font-display`.

Scope: login + dashboard ringkasan + pengguna (opsi role ikut peran login, kelola
role/lembaga per baris; role diri terkunci; baris admin/super_admin hanya untuk
super_admin) + lembaga (tambah/ubah/hapus hanya super_admin) + CRUD penuh
tahun-ajaran/kelas/pos-keuangan/tarif-biaya + referensi (read) + Pengaturan server,
lawan backend live. Belum: PSB/santri/siklus/keuangan transaksi, Modul 200+.

## Prasyarat

- Backend jalan: `php artisan serve --host=127.0.0.1 --port=8000` (MySQL `backend_ppi_45_rahayu`).
- Node 20+, npm 10+.
- Rust/cargo hanya perlu untuk build desktop (opsional untuk kerja web).
- Python 3 hanya perlu bila ingin mengunduh ulang Google Fonts offline.

## Jalan dev (web)

```sh
cp .env.example .env
npm install
npm run dev   # http://127.0.0.1:1420
```

Login: identifier email/phone/username + password (throttle 6/mnt, 429).
Token per-device `admin-desktop-tauri`, staf 30 hari (v1.8).

## Kontrak API dipakai

- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout(-all)`
- `GET /api/dashboard/ringkasan`
- `GET/POST /api/admin/users`, `DELETE /api/admin/users/{id}` (role diri terkunci 403 semua peran; target admin/super_admin hanya super_admin; admin tak bisa beri admin/super_admin)
- `POST/DELETE /api/admin/users/{id}/roles`, `POST/DELETE /api/admin/users/{id}/lembaga` (sama)
- `GET /api/admin/lembaga` semua peran; `POST/PUT/DELETE` hanya super_admin
- `GET/POST/PUT/DELETE /api/admin/tahun-ajaran` + `POST /{id}/set-aktif` (1 aktif/lembaga; aktif tak bisa dihapus 422)
- `GET/POST/PUT/DELETE /api/admin/kelas` (TA wajib se-lembaga 422; tingkat cek kamus 422)
- `GET/POST/PUT/DELETE /api/admin/pos-keuangan` (kode_pos unik global)
- `GET/POST/PUT/DELETE /api/admin/tarif-biaya` (triple FK pos+lembaga+TA; edit hanya nominal)
- `GET /api/admin/referensi/types`, `GET /api/admin/referensi/{tipe}`
- Semua list `per_page=100` bawaan (opsi 100/250/500/1000, tersimpan per tabel);
  `control id snake_case` (NFR-02/05).
- 401 → sesi dibersihkan + ke /login; 403 tenant; 422 validasi; 429 throttle.

## Tauri desktop (0.5.0 — build hanya bila diminta)

Status: build macOS aarch64 pernah dihasilkan; `.app` ±11 MB dan `.dmg` ±4 MB
(Google Fonts ikut ter-embed di dalam binary). `target/` tidak di-commit.

```sh
npm run tauri:dev    # jendela desktop lawan devUrl :1420 (hot-reload web)
npm run tauri:build  # -> src-tauri/target/release/bundle/{macos,dmg}
```

Catatan:
- **Jangan build desktop kecuali diminta** (hemat waktu/disk).
- Belum di-sign: macOS Gatekeeper → buka via klik kanan > Open saat pertama kali.
- Bila bundling DMG gagal karena volume lama masih ter-mount, lepas dulu:
  `hdiutil detach /Volumes/dmg.* -force` (atau `diskutil eject force`).
- Token + base URL tersimpan di plugin-store
  (`~/Library/Application Support/id.or.pesantren.simpes.admin/simpes.dat`).
- Ganti backend tanpa rebuild: menu Pengaturan → isi URL API → Simpan & uji koneksi.
- CI Windows/Linux (Fase 5) belum dibuat — butuh GitHub Actions matrix.

## Font offline

Google Fonts disimpan di `src/assets/fonts/` (hasil `scripts/fonts-offline.py`).
Menambah/mengurangi keluarga atau bobot: sunting daftar `FAMILIES` di skrip lalu
jalankan `python3 scripts/fonts-offline.py` (butuh internet **sekali** untuk
mengunduh; aplikasi tetap berjalan offline). Skrip memakai `curl` karena
verifikasi TLS `urllib` gagal di macOS.
