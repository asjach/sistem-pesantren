# Kebijakan Penggunaan Tes UI — SIMPES

Dokumen ini menetapkan kapan tes UI dipakai, apa yang diuji, dan batas
otomasinya. Berlaku untuk frontend admin desktop (React/Vite/Tauri), terutama
komponen bersama dan halaman yang memakainya.

Aturan menjalankan tes (tes tersempit, suite penuh untuk modul bersama, satu
runner, status suspend) tetap mengikuti `AGENTS.md` root dan
`frontend/AGENTS.md`. Dokumen ini melengkapi, bukan menggantikan, aturan itu.

## Prinsip

1. **Uji perilaku dan kontrak, bukan implementasi atau tampilan.** Tes harus
   gagal bila perilaku yang dilihat pengguna berubah, bukan karena nama kelas,
   struktur DOM internal, atau detail library berubah.
2. **Satu kontrak diuji sekali di pemiliknya.** Komponen bersama diuji di
   komponennya; halaman tidak mengulang detail internal komponen itu.
3. **Mock di batas sistem.** API, auth, preferensi perangkat, dan Tauri
   dimock; unit yang sedang diuji tidak dimock.
4. **Deterministik.** Tidak ada `sleep` tetap, urutan tes yang saling
   bergantung, atau assertion yang bergantung pada waktu/animasi.
5. **Yang tidak bisa diuji di jsdom diverifikasi manual/browser.** Layout,
   virtualisasi, geometri pointer, sticky/freeze, dan native Tauri bukan
   pekerjaan tes jsdom.

## Tingkat Tes

| Tingkat | Contoh di repo | Wajib bila | Bukan untuk |
| --- | --- | --- | --- |
| Pure logic/utility | `lib/*.test.ts`, `kolom.test.ts`, `seretIsiSel.test.ts` | percabangan, validasi, komputasi, transformasi data | DOM, styling |
| Hook | `useAntreanSimpan.test.ts`, `useLebarKolom` (via komponen), `useSalinTabel.test.ts` | state, efek, antrean, side effect, kegagalan | markup/CSS |
| Shared component | `ExcelTabelV2.test.tsx`, `GridV2.test.tsx`, `ui/resizable.test.tsx` | kontrak props/event, state tampil, empty/loading/error, keyboard/focus, accessible name/role | snapshot, pixel, kelas CSS |
| Page/integration | `pages/*.test.tsx` | wiring halaman ↔ komponen, izin/visibilitas, alur API yang dimock, side effect halaman | mengulang detail internal komponen bersama |
| Manual/browser | tabel, drag, scroll, Tauri | layout, virtualisasi, sticky/freeze, geometri drag, clipboard, print/PDF, native | dianggap otomatis oleh jsdom |
| E2E/visual regression | belum ada di repo | hanya dengan persetujuan pengguna dan keputusan tooling | menambah dependency diam-diam |

## Aturan per Tingkat

### Pure logic dan hook

- Uji cabang, batas nilai, validasi, dan failure mode yang penting.
- Hook yang butuh DOM boleh memakai `renderHook`; jangan menguji pemanggilan
  internal yang tidak mengubah perilaku.
- Nama `describe`/`it` deskriptif dalam Bahasa Indonesia; satu perilaku per
  tes bila memungkinkan.

### Shared component

- Uji **kontrak publik**: props, event, state transisi, cabang
  loading/empty/error, disabled, keyboard/focus, role dan accessible name.
- Jangan menguji kelas Tailwind, CSS variable, warna, lebar pixel, atau
  struktur DOM internal. Pengecualian hanya untuk kontrak struktural yang
  tidak bisa diamati di jsdom, dengan komentar alasan di tes.
- Gunakan `renderDenganTema` bila komponen memakai `@/icons`, `ThemeProvider`,
  atau `GridPrefsProvider`.
- DSG memakai `_dsgStubDom.tsx`. Stub **tidak** meniru layout, virtualisasi,
  geometri pointer, sticky/freeze, atau scrollbar; perilaku itu masuk checklist
  manual/browser.
- Query prioritas: role → label → teks → `data-testid`. `data-testid` hanya bila
  tidak ada query yang bisa dilihat pengguna; beri alasan singkat.
- `userEvent` untuk alur pengguna. `fireEvent` hanya untuk event tingkat rendah
  yang tidak didukung `userEvent` (mis. `contextMenu`, `clipboard`, `scroll`).
- Larangan snapshot (`toMatchSnapshot`). Assertion CSS yang sudah ada dicatat
  sebagai utang dan diganti saat tes itu disentuh.

### Page/integration

- Mock API/auth/filter/prefs di batas; gunakan fixture domain yang realistis.
- Uji yang dimiliki halaman: izin/visibilitas, pemuatan data,
  loading/empty/error, wiring ke komponen bersama, dan side effect.
- Untuk tes wiring, memock komponen bersama boleh (contoh `MiMdPage.test.tsx`);
  jangan mengulang seluruh perilaku internalnya di setiap halaman.

### Aksesibilitas

- Role, label, dan accessible name adalah kontrak; uji bila berubah.
- Uji keyboard/focus bila membawa logika: Escape, Tab, panah, pembatalan drag.
- Belum ada axe/audit otomatis. Menambahkannya hanya dengan persetujuan.
- Checklist manual: fokus terlihat (focus ring), urutan fokus, kontras,
  zoom, mode terang/gelap, ukuran layar sempit.

### Manual/browser

Gunakan browser otomatis hanya dengan persetujuan pengguna (lihat
`frontend/AGENTS.md`). Checklist minimal untuk tabel:

- layout dan lebar pembungkus; tidak ada scrollbar ganda;
- scroll horizontal/vertikal; sticky kiri/kanan dan freeze;
- tinggi baris/header, mode isi-lebar, resize dan reorder column;
- selection, edit sel, context menu, salin TSV, drag isi sel;
- empty/loading/error dan jumlah baris;
- native Tauri: clipboard plugin, dialog berkas, print/PDF, izin/kapabilitas.

Hasil pemeriksaan manual dicatat pada evaluasi Board; jangan membuat tes jsdom
palsu untuk perilaku yang tidak bisa diamati.

## Alat dan Pola

- Stack: Vitest + jsdom + React Testing Library + jest-dom + user-event;
  `css: false` di `vitest.config.ts`.
- Provider: `renderDenganTema` dari `src/test/utils.tsx`.
- Stub DSG: `src/components/excel/_dsgStubDom.tsx`.
- Mock: `vi.mock` di batas; fixture bersama lewat `vi.hoisted`; bersihkan mock
  dan `localStorage` di `beforeEach`/`afterEach`.
- Async: `findBy*`/`waitFor`; jangan pakai `setTimeout` tetap. Fake timer hanya
  untuk menguji timer.
- `act(...)` warning adalah utang; perbaiki saat tes terkait disentuh.
- Jangan menjalankan dua runner vitest bersamaan (lihat `AGENTS.md` root).

## Verifikasi dan Regresi

- Default: tes tersempit yang terdampak. Modul bersama → tawarkan suite penuh
  lebih dulu.
- Baseline bersih: kegagalan baru adalah regresi, bukan warisan.
- Bug fix: tambah regression test hanya bila ada kontrak/logika stabil. Bug
  layout/visual diverifikasi manual/browser dan dicatat; jangan membuat tes
  pixel yang rapuh.
- Perubahan dokumentasi/kebijakan: `git diff --check`; tidak perlu menjalankan
  suite penuh bila tidak ada kode yang berubah.
- Kebijakan suspend tes tetap berlaku dan tidak bisa dilanggar oleh dokumen ini.

## Audit Suite Saat Ini (2026-10-22)

- **149 file tes**: 76 `.ts` (logika/hook) dan 73 `.tsx` (komponen/halaman).
- Query: 39 file memakai `getByRole`, 17 `getByLabelText`, 40 `getByText`,
  7 `getByTestId`.
- Event/async: 43 file memakai `userEvent`, 34 `fireEvent`, 52 `waitFor`,
  14 `act`.
- Aksesibilitas: 1 assertion `toHaveAccessibleName`; belum ada axe.
- Visual: 0 snapshot; belum ada Playwright/visual regression.
- Komponen bersama: 55 file tes memakai `renderDenganTema`; 13 file memakai
  stub DSG; 77 file memakai `vi.mock`.
- Assertion CSS: 1 file (`ExcelTabelV2.test.tsx`) dengan pengecualian
  struktural `maxRows` yang beralasan; assertion CSS lain sudah diganti dengan
  kontrak perilaku saat audit ini.
- Temuan: cakupan perilaku kuat; utang utama adalah `act(...)` warning di
  beberapa tes GridV2 dan belum adanya audit aksesibilitas/visual otomatis.

## Checklist Review Tes

- [ ] Tes gagal bila perilaku yang dimaksud rusak.
- [ ] Menguji kontrak publik, bukan implementasi.
- [ ] Query memakai role/label; `data-testid` beralasan.
- [ ] Mock hanya di batas sistem.
- [ ] Tidak ada snapshot/CSS/pixel, kecuali pengecualian struktural beralasan.
- [ ] Deterministik; tidak ada sleep tetap/urutan bergantung.
- [ ] Kontrak komponen bersama tidak diulang di tes halaman.
- [ ] Perilaku yang mustahil di jsdom masuk checklist manual/browser.
- [ ] Tes tersempit + `typecheck` dijalankan; suite penuh ditawarkan untuk
  modul bersama.

## Rujukan

- `AGENTS.md` root — status Board, kebijakan menjalankan tes, suspend.
- `frontend/AGENTS.md` — aturan tes frontend (diperbarui mengikuti dokumen ini).
- `backend/AGENTS.md` — aturan tes backend (bukan UI).
- `vitest.config.ts`, `src/test/setup.ts`, `src/test/utils.tsx`.
- `src/components/excel/_dsgStubDom.tsx`.
