import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

/** ESLint (flat config) untuk admin-desktop-tauri.
 *
 *  Dipasang 2026-10-19 — project sebelumnya TANPA lint sama sekali, jadi aturan
 *  di sini sengaja dikalibrasi pada tingkat "nyata berguna", bukan maksimal:
 *
 *  1. `tseslint.configs.recommended` — BUKAN *-type-checked. Naik ke
 *     `recommendedTypeChecked` kalau tim siap (butuh `parserOptions.project`,
 *     lint jadi jauh lebih lambat dan membanjiri `no-unsafe-*`).
 *
 *  2. react-hooks: HANYA dua aturan klasik.
 *     `eslint-plugin-react-hooks@7` kini membundel 16 aturan, 14 di antaranya
 *     aturan React Compiler (`set-state-in-effect`, `refs`, `purity`, `gating`,
 *     `immutability`, …) yang mengasumsikan React 19 + Compiler. Project ini
 *     React 18.3.1 dan memang banyak memakai pola useEffect-untuk-memuat-data —
 *     mengaktifkannya akan memunculkan 276 temuan palsu sekali jalan. Kalau
 *     nanti migrasi ke Compiler, nyalakan via `reactHooks.configs.recommended`.
 *
 *  3. Repo memang memakai `eslint-disable` sebagai pengecualian TERENCANA.
 *     Sisa ±40 komentar, mayoritas `react-hooks/exhaustive-deps` di sekitar
 *     useEffect pemuat-data (deps tak lengkap memang disengaja). Yang sudah
 *     mati dibersihkan; ESLint melapornya sebagai "Unused eslint-disable
 *     directive", jadi kebocorannya kelihatan.
 *
 *  4. Dua aturan dimatikan dengan alasan tertulis di tempatnya masing-masing:
 *     - `react-refresh/only-export-components` (konvensi ekspor repo)
 *     - seluruh aturan a11y di `src/components/excel/**` (milik
 *       react-datasheet-grid: sel grid bukan tombol, gagang seret bukan tombol)
 *     Keduanya PILIHAN yang bisa dibalik — baca komentarnya dulu.
 *
 *  Jalankan:  npm run lint        (daftar temuan)
 *             npm run lint:fix    (perbaiki otomatis)
 *
 *  CATATAN SANDBOX: bila stdout dibungkus socket IPC (mis. dieksekusi lewat
 *  agen), laporan besar bisa mati dengan `Error: write EPIPE`. Tambahkan
 *  `--output-file /tmp/keluaran.txt` supaya ESLint menulis ke berkas.
 */

export default tseslint.config(
  /* ---------- yang TIDAK dilint ---------- */
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'src-tauri/**',
      // Berkas hasil generate: isinya mesin, bukan tulisan manusia.
      '**/*.gen.ts',
    ],
  },

  /* ---------- skrip Node (scripts/*.mjs, vite.config.ts, & config ini) ---------- */
  {
    // Tiga baris tanda tangan di bawah sengaja TIDAK menempel dengan prop pada
    // baris sebelumnya: scaffold bawaan `typescript-eslint` membaca prop yang
    // menempel sebagai "dipakai" lalu butuh deps eksplisit di setiap penggunaan
    // — 30 peringatan setandan yang salah, dan solusinya (memaksa deps di setiap
    // pemakaian) salah alamat. Sisipkan baris kosong kalau nanti perlu scaffold.
    files: ['**/*.mjs', '**/*.js', 'vite.config.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },

  /* ---------- sumber aplikasi ---------- */
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      // Hanya dua aturan React Hooks yang klasik & aman untuk React 18.
      // `exhaustive-deps` disengaja jadi warn: repo punya 40 pengecualian
      // resmi (lihat komentar eslint-disable di sekitar useEffect data-load).
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      ...jsxA11y.configs.recommended.rules,

      /* DIMATIKAN dengan sengaja — ini PILIHAN, bukan kelalaian.
         Aturan ini minta tiap berkas hanya mengekspor KOMPONEN, supaya Fast
         Refresh bisa memperbarui satu komponen tanpa me-reload sekitarnya.
         Repo ini sengaja memakai konvensi sebaliknya: konfigurasi duduk
         SEBELAH komponennya — `FIELDS_SANTRI` di atas <SantriTable>,
         registry `tipeInput.tsx` (tipe + konstanta + satu komponen aksi),
         `tabKeuangan.tsx` (15 ekspor kembar). Konfigurasi di sebelah
         pemakainya jauh lebih mudah dibaca daripada dipisah ke berkas lain
         yang harus dibuka bersamaan.

         Mematikan aturan ini berarti HMR kurang teliti saat pengeditan:
         ubah konstanta → komponen sekitarnya ikut ter-refresh. Untuk
         aplikasi desktop Tauri itu tidak terasa.

         Kalau kelak ingin dinyalakan kembali: pekerjaannya memecah ~40 berkas
         (paling padat `keuangan/tabKeuangan.tsx` 15 titik,
         `components/tipeInput.tsx` 11 titik) — itu refactor tersendiri, bukan
         bawaan lint. JANGAN dinyalakan tanpa itu. */
      'react-refresh/only-export-components': 'off',

      // `console.log` sisa debug mudah lolos; warn/error dibiarkan.
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Konvensi repo ini: parameter yang ADA TAPI TIDAK DIPAKAI diberi awalan
      // `_` (mis. `_opsi`, `_data`) — dipakai untuk mempertahankan bentuk
      // tanda tangan fungsi tanpa memicu peringatan. Tanpa pola ini, ESLint
      // mengeluhkan 29 parameter yang justru sudah ditandai dengan benar.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          // Nama komponen & tipe yang tak dipakai tetap dilaporkan: beda dengan
          // parameter, keduanya hampir selalu berarti kode mati.
          args: 'after-used',
          ignoreRestSiblings: true,
        },
      ],

      // TypeScript sudah memeriksa ini; menyalakannya lagi dobel & sering
      // salah kaprah untuk tipe yang di-import lintas berkas.
      'no-undef': 'off',

      // `any` masih terpakai (adapter DSG dll). Disurvei dulu lewat peringatan.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  /* ---------- berkas tes ---------- */
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },

  /* ---------- wadah tahun popover: grup yang bisa difokuskan ---------- */
  /* Tombol TAHUN (grid 5×N) di dalam wadah yang:
       - sudah punya `role="group"` + `aria-label` EKSPLISIT (pola grup
         berlabel — sah di ARIA),
       - `tabIndex={0}` + `onKeyDown` (PageUp/PageDown/Home) — jadi wadahnya
         memang sengaja bisa difokuskan dan menangani papan tik.

     Dua aturan a11y `no-noninteractive-element-interactions` &
     `no-noninteractive-tabindex` mengeluh karena menganggap `group` tak
     interaktif, lalu "solusi"-nya adalah mengganti role menjadi `toolbar`.
     JANGAN: itu mengubah kontrak ARIA yang sudah DIKUJI — 44 tes mengunci
     `role="group"` dengan nama "Tahun <awal>–<akhir>" (lihat
     `PopoverBulan.test.tsx` & `PopoverKalender.test.tsx`), dan mengganti role
     dari `group` ke `toolbar` memecahkannya semua.

     Pola "focusable labelled group + keyboard handler" di sini disengaja dan
     benar. Yang salah adalah aturannya, jadi aturannya yang dimatikan — bukan
     DOM/ARIA-nya yang dipaksa berubah. */
  {
    files: [
      'src/components/PopoverBulan.tsx',
      'src/components/PopoverKalender.tsx',
    ],
    rules: {
      'jsx-a11y/no-noninteractive-element-interactions': 'off',
      'jsx-a11y/no-noninteractive-tabindex': 'off',
    },
  },

  /* ---------- sanitizer HTML: karakter kontrol memang sasaran ---------- */
  /* `sanitasiHtml.ts` MEMBUANG karakter kontrol dari teks & URL — regex yang
     mencocokkan `\u0000-\u001F` / `\u007F` adalah SELURUH fiturnya, bukan
     kecelakaan. Aturan `no-control-regex` (ada untuk menangkap regex yang
     tak sengaja memuat karakter kontrol) jadi keliru di sini.
     Tidak ditulis sebagai eslint-disable di dalam berkas karena berkas itu
     memuat karakter kontrol literal — menyuntingnya andal lebih mudah dari
     config. */
  {
    files: ['src/components/info/sanitasiHtml.ts'],
    rules: {
      'no-control-regex': 'off',
    },
  },

  /* ---------- lapisan integrasi react-datasheet-grid ---------- */
  /* Aturan a11y di bawah mengasumsikan setiap hal yang bisa diklik adalah
     TOMBOL. Di dalam grid itu keliru, dan menambahkan role/tabIndex palsu
     justru merusak pembaca layar (menyatakan sesuatu yang bukan kenyataan).
     Yang benar-benar terjadi di sini:

     - `cells.tsx`  : sel spreadsheet. Sel BUKAN tombol — navigasinya pakai
                      panah di tingkat grid (dimiliki react-datasheet-grid).
                      Menambahkan role="button" + tabIndex akan membuat setiap
                      sel jadi perhentian Tab, sehingga mengetik di editor sel
                      harus melewati N perhentian lebih dulu.
     - `header.tsx` : GAGANG SERET lebar kolom. Pointer-only by design (seret);
                      pengguna keyboard memakai AutoFit lewat menu klik kanan.
                      Menyebut gagang seret sebagai tombol = bohong ke AT.
     - `autoFocus`  : editor sel WAJIB fokus saat terbuka. Tanpa itu sel tak
                      bisa langsung diketik — fitur inti grid. Kakak satu modul
                      (baris 50) sudah memakai eslint-disable untuk hal yang
                      sama; override ini membuatnya seragam.

     Utang yang dicatat, bukan disembunyikan: dukungan keyboard untuk seret
     lebar kolom memang BELUM ada. Itu pekerjaan fitur (bukan lint), dan
     ditandai di sini supaya jaraknya terlihat. */
  {
    files: ['src/components/excel/**/*.{ts,tsx}'],
    rules: {
      'jsx-a11y/no-static-element-interactions': 'off',
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-noninteractive-element-interactions': 'off',
      'jsx-a11y/no-noninteractive-tabindex': 'off',
      'jsx-a11y/interactive-supports-focus': 'off',
      'jsx-a11y/role-has-required-aria-props': 'off',
      'jsx-a11y/no-autofocus': 'off',
    },
  },
);
