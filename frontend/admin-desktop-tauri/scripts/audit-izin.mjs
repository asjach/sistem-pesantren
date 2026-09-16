#!/usr/bin/env node
/**
 * audit-izin.mjs — silang-cek izin matriks FE vs katalog BE.
 *
 * - Setiap `permission: '…'` di `src/lib/halaman.ts` wajib ada di
 *   `IzinKatalog::MODUL_AKSI` (backend/app/Services/IzinKatalog.php).
 * - Setiap halaman baru otomatis tercakup: daftarkan di HALAMAN + katalog,
 *   matriks Kelola Izin menampilkannya tanpa kode tambahan.
 * Gagal (exit 1) bila ada kunci tak dikenal — dijalankan sebelum
 * `dev`/`build`/`typecheck` (lihat package.json).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const HALAMAN = join(root, 'src/lib/halaman.ts');
const KATALOG = join(root, '../../backend/app/Services/IzinKatalog.php');

const halaman = readFileSync(HALAMAN, 'utf8');
const katalogSrc = readFileSync(KATALOG, 'utf8');

const izinFe = [...halaman.matchAll(/permission:\s*'([^']+)'/g)].map((m) => m[1]);

const katalog = new Set();
for (const [, modul, daftar] of katalogSrc.matchAll(/'([a-z_]+)'\s*=>\s*\[([^\]]*)\]/g)) {
  for (const [, aksi] of daftar.matchAll(/'([a-z]+)'/g)) {
    katalog.add(`${modul}.${aksi}`);
  }
}

let gagal = false;
for (const izin of new Set(izinFe)) {
  if (!katalog.has(izin)) {
    console.error(`audit-izin: '${izin}' dipakai HALAMAN tapi tidak ada di IzinKatalog.`);
    gagal = true;
  }
}
if (izinFe.length === 0) {
  console.error('audit-izin: tidak ada permission di HALAMAN — registri rusak?');
  gagal = true;
}

if (gagal) {
  console.error(`audit-izin: ${izinFe.length} izin FE diperiksa, ada yang tak dikenal.`);
  process.exit(1);
}
console.log(`audit-izin: ${new Set(izinFe).size} izin halaman cocok dengan katalog.`);
