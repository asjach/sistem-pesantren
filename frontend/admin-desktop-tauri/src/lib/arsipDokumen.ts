/** Arsip lokal berkas dokumen — KHUSUS aplikasi desktop (Tauri).
 *
 *  Alur: salin ke folder arsip per tipe pemilik
 *  (`Documents/SIMPES-Dokumen/{santri|pegawai|lembaga}/`), lalu (opsional,
 *  via checkbox) pindahkan file asli ke `<folder-asal>/sudah/`. Semua operasi
 *  aman-gagal: file asli tidak pernah dihapus sebelum salinan terverifikasi.
 *  Di browser biasa modul ini tidak dipakai (penjagaan `isTauri()` di halaman).
 */
import { isTauri, prefGet } from '@/api/client';

/** Nama folder tujuan file asli di lokasi sumbernya. */
export const FOLDER_SUDAH = 'sudah';
/** Akar arsip dokumen di dalam Documents. */
export const ROOT_ARSIP_DOKUMEN = 'SIMPES-Dokumen';
/** Akar arsip mode test di dalam Documents. */
export const ROOT_ARSIP_TEST = 'SIMPES-Dokumen-Test';
/** Kunci pref: root arsip custom (absolut). Kosong = bawaan Documents. */
export const PREF_FOLDER_ARSIP = 'simpes_folder_arsip';
/** Kunci pref: root arsip mode test (absolut). Kosong = bawaan Documents. */
export const PREF_FOLDER_ARSIP_TEST = 'simpes_folder_arsip_test';
/** Kunci pref: mode penyimpanan perangkat (`server` | `lokal` | `test`). */
export const PREF_MODE_DOKUMEN = 'simpes_mode_dokumen';
/** Mode penyimpanan yang dikenal. `test` = perilaku lokal ke folder uji. */
export type ModeDokumen = 'server' | 'lokal' | 'test';
/** Batas ukuran berkas (sama seperti validasi backend): 10 MB. */
export const BATAS_BERKAS = 10 * 1024 * 1024;
/** Ekstensi yang diterima (tanpa titik, huruf kecil). */
export const EKSTENSI_BOLEH = ['jpg', 'jpeg', 'png', 'pdf'];

export interface BerkasTerpilih {
  path: string;
  nama: string;
  ukuran: number;
  mime: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Stempel `YYYYMMDD_HHMMSS` waktu lokal (cermin format backend `Ymd_His`). */
export function stempelArsip(waktu = new Date()): string {
  return `${waktu.getFullYear()}${pad2(waktu.getMonth() + 1)}${pad2(waktu.getDate())}_${pad2(waktu.getHours())}${pad2(waktu.getMinutes())}${pad2(waktu.getSeconds())}`;
}

/** Slug satu segmen nama: huruf kecil, non-alfanumerik jadi `_`, maks 50 char. */
export function slugSegmen(teks: string): string {
  return teks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

/** Template nama arsip: `nama_jenis_catatan_timestamp.ext` (segmen kosong dilewati).
 *  Cermin aturan backend agar penamaan konsisten. */
export function namaArsip(nama: string, jenis: string, catatan: string, ext: string, waktu = new Date()): string {
  const segmen = [slugSegmen(nama), slugSegmen(jenis), slugSegmen(catatan), stempelArsip(waktu)].filter((s) => s !== '');
  const ekstensi = ext.toLowerCase().replace(/^\./, '');
  return `${segmen.join('_')}.${ekstensi}`;
}

export function ekstensiDariNama(nama: string): string {
  const i = nama.lastIndexOf('.');
  return i >= 0 ? nama.slice(i + 1).toLowerCase() : '';
}

export function mimeDariEkstensi(ext: string): string {
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  return 'image/jpeg';
}

export function formatUkuran(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Nama unik di dalam direktori (tambah `-2`, `-3`, … bila tabrakan). */
export async function namaUnik(dir: string, namaDasar: string): Promise<string> {
  const { exists } = await import('@tauri-apps/plugin-fs');
  const { basename, join } = await import('@tauri-apps/api/path');
  const titik = namaDasar.lastIndexOf('.');
  const dasar = titik >= 0 ? namaDasar.slice(0, titik) : namaDasar;
  const ekstensi = titik >= 0 ? namaDasar.slice(titik) : '';
  let calon = namaDasar;
  let n = 1;
  while (await exists(await join(dir, calon))) {
    n += 1;
    calon = `${dasar}-${n}${ekstensi}`;
  }
  return basename(await join(dir, calon));
}

/** Dialog pilih berkas dokumen (gambar/PDF) + validasi ukuran. Null = batal. */
export async function pilihBerkasDokumen(): Promise<BerkasTerpilih | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const { stat } = await import('@tauri-apps/plugin-fs');
  const { basename } = await import('@tauri-apps/api/path');
  const dipilih = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'Dokumen', extensions: [...EKSTENSI_BOLEH] }],
  });
  if (!dipilih || Array.isArray(dipilih)) return null;
  const path = String(dipilih);
  const nama = await basename(path);
  const ext = ekstensiDariNama(nama);
  if (!EKSTENSI_BOLEH.includes(ext)) throw new Error(`Berkas harus ${EKSTENSI_BOLEH.join('/').toUpperCase()}.`);
  const info = await stat(path);
  if ((info.size ?? 0) > BATAS_BERKAS) throw new Error('Berkas melebihi 10 MB.');
  return { path, nama, ukuran: info.size ?? 0, mime: mimeDariEkstensi(ext) };
}

/** Baca berkas lokal menjadi `File` untuk diunggah via API yang sudah ada. */
export async function bacaBerkasUntukUnggah(berkas: BerkasTerpilih): Promise<File> {
  const { readFile } = await import('@tauri-apps/plugin-fs');
  const bytes = await readFile(berkas.path);
  const buf = new Uint8Array(bytes).buffer as ArrayBuffer;
  return new File([buf], berkas.nama, { type: berkas.mime });
}

/** Selesaikan akar arsip: pref absolut bila diisi, sonst bawaan Documents. */
export async function akarArsip(folderPref: string, bawaan: string): Promise<string> {
  if (folderPref.trim() !== '') return folderPref;
  const { documentDir, join } = await import('@tauri-apps/api/path');
  return join(await documentDir(), bawaan);
}

/** Pemilik arsip: folder tujuan di bawah akar arsip. */
export type TipeArsip = 'santri' | 'pegawai' | 'lembaga';

/** Path lengkap arsip untuk satu nama berkas (tanpa menyentuh disk):
 *  `<akar>/<tipe>/nama`. `akar` = hasil `akarArsip()` (sudah final). */
export async function jalurArsip(namaFile: string, akar: string, tipe: TipeArsip): Promise<string> {
  const { join } = await import('@tauri-apps/api/path');
  return join(akar, tipe, namaFile);
}

/** Tata lama (pra-partisi): datar `<akar>/nama`, lalu `<akar>/<slug-jenis>/nama`. */
async function jalurArsipLama(namaFile: string, jenis: string, akar: string): Promise<string[]> {
  const { join } = await import('@tauri-apps/api/path');
  return [await join(akar, namaFile), await join(akar, slugSegmen(jenis) || 'lainnya', namaFile)];
}

/** Selesaikan lokasi baca: folder tipe dulu, lalu tata lama (kompatibel
 *  arsip yang telanjur tersimpan datar/per-jenis). Null bila tak ada. */
export async function cariArsip(namaFile: string, jenis: string, akar: string, tipe: TipeArsip): Promise<string | null> {
  const { exists } = await import('@tauri-apps/plugin-fs');
  const datar = await jalurArsip(namaFile, akar, tipe);
  if (await exists(datar)) return datar;
  for (const lama of await jalurArsipLama(namaFile, jenis, akar)) {
    if (await exists(lama)) return lama;
  }
  return null;
}

/** Tulis balik hasil edit viewer ke arsip perangkat (lokasi DB tak berubah).
 *  Menimpa di folder tempat berkas ditemukan (tata tipe/baru didahulukan);
 *  bila nama berubah (ganti format), salinan lama dibersihkan. */
export async function tulisBalikArsip(namaLama: string, namaBaru: string, jenis: string, data: Uint8Array, tipe: TipeArsip): Promise<void> {
  const { mkdir, writeFile } = await import('@tauri-apps/plugin-fs');
  const { join } = await import('@tauri-apps/api/path');
  const [a, b] = await Promise.all([
    prefGet(PREF_FOLDER_ARSIP).catch(() => null),
    prefGet(PREF_FOLDER_ARSIP_TEST).catch(() => null),
  ]);
  const akars = await Promise.all([
    akarArsip(typeof a === 'string' ? a : '', ROOT_ARSIP_DOKUMEN),
    akarArsip(typeof b === 'string' ? b : '', ROOT_ARSIP_TEST),
  ]);
  let folder: string | null = null;
  for (const akar of akars) {
    const ketemu = await cariArsip(namaLama, jenis, akar, tipe);
    if (ketemu) {
      const { dirname } = await import('@tauri-apps/api/path');
      folder = await dirname(ketemu);
      break;
    }
  }
  folder ??= await join(akars[0], tipe);
  await mkdir(folder, { recursive: true });
  await writeFile(await join(folder, namaBaru), data);
  if (namaBaru !== namaLama) {
    for (const akar of akars) await hapusArsip(namaLama, jenis, akar, tipe);
  }
}
/** Hapus salinan arsip di semua tata (tipe + lama); diam bila tak ada. */
export async function hapusArsip(namaFile: string, jenis: string, akar: string, tipe: TipeArsip): Promise<void> {
  const { exists, remove } = await import('@tauri-apps/plugin-fs');
  for (const target of [await jalurArsip(namaFile, akar, tipe), ...(await jalurArsipLama(namaFile, jenis, akar))]) {
    if (await exists(target)) await remove(target);
  }
}

/** Tulis byte ke arsip `<akar>/<tipe>/` dengan nama template (untuk hasil edisi).
 *  Mengembalikan path tujuan. */
export async function tulisArsip(data: Uint8Array, namaFile: string, akar: string, tipe: TipeArsip): Promise<string> {
  const { exists, mkdir, writeFile } = await import('@tauri-apps/plugin-fs');
  const { join } = await import('@tauri-apps/api/path');
  const folder = await join(akar, tipe);
  await mkdir(folder, { recursive: true });
  const tujuan = await join(folder, await namaUnik(folder, namaFile));
  await writeFile(tujuan, data);
  if (!(await exists(tujuan))) throw new Error('Salinan arsip tidak terbentuk.');
  return tujuan;
}

/** Ganti isi berkas di arsip perangkat (lokasi DB tak berubah).
 *  Menulis dengan nama template baru yang unik di folder tipe, memverifikasi,
 *  lalu membersihkan salinan lama di semua tata. Mengembalikan nama efektif. */
export async function tulisGantiArsip(input: {
  namaLama: string | null;
  jenis: string;
  pemilik: string;
  catatan: string;
  ext: string;
  data: Uint8Array;
  lokasi: 'lokal' | 'test';
  tipe: TipeArsip;
}): Promise<string> {
  const ext = input.ext.toLowerCase().replace(/^\./, '');
  if (!EKSTENSI_BOLEH.includes(ext)) throw new Error(`Berkas harus ${EKSTENSI_BOLEH.join('/').toUpperCase()}.`);
  if (input.data.length > BATAS_BERKAS) throw new Error('Berkas melebihi 10 MB.');
  const { exists, mkdir, writeFile } = await import('@tauri-apps/plugin-fs');
  const { join } = await import('@tauri-apps/api/path');
  const [a, b] = await Promise.all([
    prefGet(PREF_FOLDER_ARSIP).catch(() => null),
    prefGet(PREF_FOLDER_ARSIP_TEST).catch(() => null),
  ]);
  const akarDokumen = await akarArsip(typeof a === 'string' ? a : '', ROOT_ARSIP_DOKUMEN);
  const akarTest = await akarArsip(typeof b === 'string' ? b : '', ROOT_ARSIP_TEST);
  const folder = await join(input.lokasi === 'test' ? akarTest : akarDokumen, input.tipe);
  await mkdir(folder, { recursive: true });
  const namaBaru = await namaUnik(folder, namaArsip(input.pemilik, input.jenis, input.catatan, ext));
  const tujuan = await join(folder, namaBaru);
  await writeFile(tujuan, input.data);
  if (!(await exists(tujuan))) throw new Error('Salinan arsip tidak terbentuk.');
  if (input.namaLama) {
    for (const akar of [akarDokumen, akarTest]) await hapusArsip(input.namaLama, input.jenis, akar, input.tipe);
  }
  return namaBaru;
}

/** Pindahkan file asli ke `<folder-asal>/sudah/`. Rename atomik dulu;
 *  bila gagal (mis. lintas volume) fallback salin + verifikasi ukuran + hapus.
 *  Mengembalikan path tujuan. */
export async function pindahKeSudah(pathSumber: string): Promise<string> {
  const { copyFile, exists, mkdir, remove, rename, size } = await import('@tauri-apps/plugin-fs');
  const { basename, dirname, join } = await import('@tauri-apps/api/path');
  const folderSudah = await join(await dirname(pathSumber), FOLDER_SUDAH);
  await mkdir(folderSudah, { recursive: true });
  const tujuanAkhir = await join(folderSudah, await namaUnik(folderSudah, await basename(pathSumber)));
  try {
    await rename(pathSumber, tujuanAkhir);
    return tujuanAkhir;
  } catch {
    await copyFile(pathSumber, tujuanAkhir);
    const [asal, salinan] = await Promise.all([size(pathSumber), size(tujuanAkhir)]);
    if (asal !== salinan) {
      await remove(tujuanAkhir);
      throw new Error('Salinan tak sama besar; file asli dipertahankan.');
    }
    await remove(pathSumber);
    if (await exists(pathSumber)) throw new Error('File asli gagal dihapus setelah disalin.');
    return tujuanAkhir;
  }
}

/** Penjaga ganda: hanya desktop yang boleh memanggil operasi file lokal. */
export function wajibDesktop(): void {
  if (!isTauri()) throw new Error('Arsip lokal hanya tersedia di aplikasi desktop.');
}
