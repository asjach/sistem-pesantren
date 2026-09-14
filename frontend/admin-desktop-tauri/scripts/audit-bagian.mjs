#!/usr/bin/env node
/**
 * audit-bagian.mjs — deteksi otomatis bagian Bagian UI yang BELUM punya
 * elemen/komponen nyata di project, lalu tulis `src/parts-belum.gen.ts`.
 *
 * Cara kerja: pindai seluruh `src/**\/*.{ts,tsx}` (kecuali `parts.ts`, file
 * generated, dan `PartContohBagian.tsx` yang hanya pratinjau) untuk atribut
 * `data-slot`/`data-part`. Sebuah bagian dianggap ADA bila:
 *   - selektornya struktural (mis. `#root header`, `.simpes-dsg`, `#pager`), atau
 *   - salah satu token `[data-slot='…']`/`[data-part='…']`-nya ditemukan.
 * Dijalankan otomatis sebelum `dev`/`build`/`typecheck` (lihat package.json).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(root, 'src');
const PARTS = join(SRC, 'parts.ts');
const GEN = join(SRC, 'parts-belum.gen.ts');
// File yang tidak dipakai untuk deteksi: definisi daftar (parts.ts), keluaran
// script ini, daftar pengecualian KONTROL (partStyles.ts), dan markup pratinjau.
const LEWATI = new Set(['parts.ts', 'parts-belum.gen.ts', 'partStyles.ts', 'PartContohBagian.tsx']);

/** Probe untuk bagian ber-selektor struktural (tanpa data-slot/data-part). */
const PROBE = {
  ribbon: /<header[\s>]/,
  tab_ribbon: /tab_ribbon_/,
  judul_halaman: /<h[12][\s>]/,
  subjudul: /<h[34][\s>]/,
  teks_isi: /<main[\s>]/,
  kartu: /<section[\s>]/,
  tabel_header: /dsg-row-header/,
  tabel_sel: /simpes-dsg/,
  pager: /id="pager"/,
};

function berkas(dir) {
  const hasil = [];
  for (const nama of readdirSync(dir)) {
    const p = join(dir, nama);
    if (statSync(p).isDirectory()) hasil.push(...berkas(p));
    else if (/\.(ts|tsx)$/.test(nama) && !LEWATI.has(nama)) hasil.push(p);
  }
  return hasil;
}

/** Himpunan token `slot:<nilai>` / `part:<nilai>` yang ada di kode. */
const tokenAda = new Set();
const sumber = berkas(SRC).map((f) => readFileSync(f, 'utf8')).join('\n');
for (const m of sumber.matchAll(/data-(slot|part)=["']([^"']+)["']/g)) {
  tokenAda.add(`${m[1]}:${m[2]}`);
}

// Ambil pasangan id + sel tiap entri di parts.ts (entri diawali `{` lalu `id:`).
// Nilai `sel` bisa dibungkus kutip tunggal atau ganda.
const BELUM = [];
for (const m of readFileSync(PARTS, 'utf8').matchAll(
  /\{\s*id:\s*'([^']+)'[\s\S]*?sel:\s*(['"])([\s\S]*?)\2/g,
)) {
  const id = m[1];
  const sel = m[3];
  const token = [...sel.matchAll(/\[data-(slot|part)='([^']+)'\]/g)];
  // Sisa setelah membuang token data-slot/part = ada selektor struktural.
  const struktural = sel.replace(/\[data-(slot|part)='[^']+'\]/g, '').replace(/[\s,]/g, '') !== '';
  const adaToken = token.some((t) => tokenAda.has(`${t[1]}:${t[2]}`));
  // Bagian struktural diverifikasi lewat PROBE (bila ada); tanpa probe dianggap ada.
  const adaStruktural = struktural ? (PROBE[id] ? PROBE[id].test(sumber) : true) : false;
  if (!adaToken && !adaStruktural) BELUM.push(id);
}

const header = `// AUTO-GENERATED oleh scripts/audit-bagian.mjs — JANGAN diedit manual.
// Perbarui dengan: npm run audit:bagian (juga jalan otomatis sebelum dev/build).

/** Bagian yang belum punya elemen/komponen nyata di project (hanya pratinjau). */
export const BELUM_DIPAKAI: ReadonlySet<string> = new Set([
`;
const isi = BELUM.map((id) => `  '${id}',`).join('\n');
writeFileSync(GEN, `${header}${isi}\n]);\n`);

console.log(
  `audit-bagian: ${BELUM.length} bagian belum dipakai${
    BELUM.length ? ` (${BELUM.join(', ')})` : ''
  } → src/parts-belum.gen.ts`,
);
