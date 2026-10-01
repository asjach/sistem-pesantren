/** Arsip lokal berkas dokumen — KHUSUS aplikasi desktop (Tauri).
 *
 *  Pola seragam `{lokasi}/{tipe}/` cermin server (`server/{tipe}/`):
 *  `SIMPES-Dokumen/lokal/{santri|pegawai|lembaga}/` (dan root uji
 *  `SIMPES-Dokumen-Test/test/{...}/`). Alur: salin ke folder arsip, lalu
 *  (opsional, via checkbox) pindahkan file asli ke `<folder-asal>/sudah/`.
 *  Semua operasi aman-gagal: file asli tidak pernah dihapus sebelum salinan
 *  terverifikasi. Di browser biasa modul ini tidak dipakai (penjagaan
 *  `isTauri()` di halaman).
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

/** Lokasi arsip perangkat: segmen pertama di bawah akar. */
export type LokasiArsip = 'lokal' | 'test';

/** Folder `<akar>/<lokasi>/<tipe>/` (tanpa menyentuh disk). */
export async function folderArsip(akar: string, lokasi: LokasiArsip, tipe: TipeArsip): Promise<string> {
  const { join } = await import('@tauri-apps/api/path');
  return join(akar, lokasi, tipe);
}

/** Path lengkap arsip untuk satu nama berkas (tanpa menyentuh disk).
 *  `akar` = hasil `akarArsip()` (sudah final). */
export async function jalurArsip(namaFile: string, akar: string, tipe: TipeArsip, lokasi: LokasiArsip): Promise<string> {
  const { join } = await import('@tauri-apps/api/path');
  return join(await folderArsip(akar, lokasi, tipe), namaFile);
}

/** Tata lama (pra-segmen-lokasi): `<akar>/<tipe>/nama`, datar `<akar>/nama`,
 *  lalu `<akar>/<slug-jenis>/nama`. */
async function jalurArsipLama(namaFile: string, jenis: string, akar: string, tipe: TipeArsip): Promise<string[]> {
  const { join } = await import('@tauri-apps/api/path');
  return [
    await join(akar, tipe, namaFile),
    await join(akar, namaFile),
    await join(akar, slugSegmen(jenis) || 'lainnya', namaFile),
  ];
}

/** Selesaikan lokasi baca: tata baru dulu, lalu tata lama (kompatibel
 *  arsip yang telanjur tersimpan). Null bila tak ada. */
export async function cariArsip(namaFile: string, jenis: string, akar: string, tipe: TipeArsip, lokasi: LokasiArsip): Promise<string | null> {
  const { exists } = await import('@tauri-apps/plugin-fs');
  const baru = await jalurArsip(namaFile, akar, tipe, lokasi);
  if (await exists(baru)) return baru;
  for (const lama of await jalurArsipLama(namaFile, jenis, akar, tipe)) {
    if (await exists(lama)) return lama;
  }
  return null;
}

/** Tulis balik hasil edit viewer ke arsip perangkat (lokasi DB tak berubah).
 *  Menimpa di folder tempat berkas ditemukan (tata tipe/baru didahulukan);
 *  bila nama berubah (ganti format), salinan lama dibersihkan. */
export async function tulisBalikArsip(namaLama: string, namaBaru: string, jenis: string, data: Uint8Array, tipe: TipeArsip, lokasi: LokasiArsip): Promise<void> {
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
    const ketemu = await cariArsip(namaLama, jenis, akar, tipe, lokasi);
    if (ketemu) {
      const { dirname } = await import('@tauri-apps/api/path');
      folder = await dirname(ketemu);
      break;
    }
  }
  folder ??= await folderArsip(akars[0], lokasi, tipe);
  await mkdir(folder, { recursive: true });
  await writeFile(await join(folder, namaBaru), data);
  if (namaBaru !== namaLama) {
    for (const akar of akars) await hapusArsip(namaLama, jenis, akar, tipe, lokasi);
  }
}
/** Hapus salinan arsip di semua tata (baru + lama); diam bila tak ada. */
export async function hapusArsip(namaFile: string, jenis: string, akar: string, tipe: TipeArsip, lokasi: LokasiArsip): Promise<void> {
  const { exists, remove } = await import('@tauri-apps/plugin-fs');
  for (const target of [await jalurArsip(namaFile, akar, tipe, lokasi), ...(await jalurArsipLama(namaFile, jenis, akar, tipe))]) {
    if (await exists(target)) await remove(target);
  }
}

/** Tulis byte ke arsip `<akar>/<lokasi>/<tipe>/` dengan nama template (untuk hasil edisi).
 *  Mengembalikan path tujuan. */
export async function tulisArsip(data: Uint8Array, namaFile: string, akar: string, tipe: TipeArsip, lokasi: LokasiArsip): Promise<string> {
  const { exists, mkdir, writeFile } = await import('@tauri-apps/plugin-fs');
  const { join } = await import('@tauri-apps/api/path');
  const folder = await folderArsip(akar, lokasi, tipe);
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
  const folder = await folderArsip(input.lokasi === 'test' ? akarTest : akarDokumen, input.lokasi, input.tipe);
  await mkdir(folder, { recursive: true });
  const namaBaru = await namaUnik(folder, namaArsip(input.pemilik, input.jenis, input.catatan, ext));
  const tujuan = await join(folder, namaBaru);
  await writeFile(tujuan, input.data);
  if (!(await exists(tujuan))) throw new Error('Salinan arsip tidak terbentuk.');
  if (input.namaLama) {
    for (const akar of [akarDokumen, akarTest]) await hapusArsip(input.namaLama, input.jenis, akar, input.tipe, input.lokasi);
  }
  return namaBaru;
}

/** Normalisasi mtime stat (Date | milidetik | detik → detik epoch); cadangan bila tak valid. */
export function normalisasiMtime(mtime: Date | number | null | undefined, cadangan = 0): number {
  if (mtime == null) return cadangan;
  const detik = mtime instanceof Date ? mtime.getTime() / 1000 : mtime > 1e11 ? mtime / 1000 : mtime;
  return Number.isFinite(detik) && detik >= 0 ? Math.floor(detik) : cadangan;
}

/** Baca byte + mtime (detik) satu arsip; null bila tak ada di semua tata. */
export async function bacaArsip(
  namaFile: string,
  jenis: string,
  akar: string,
  tipe: TipeArsip,
  lokasi: LokasiArsip,
): Promise<{ bytes: Uint8Array; mtime: number } | null> {
  const { readFile, stat } = await import('@tauri-apps/plugin-fs');
  const target = await cariArsip(namaFile, jenis, akar, tipe, lokasi);
  if (!target) return null;
  const [bytes, info] = await Promise.all([readFile(target), stat(target)]);
  return { bytes: new Uint8Array(bytes), mtime: normalisasiMtime(info.mtime) };
}

/** Tulis byte dengan NAMA TEPAT (tanpa akhiran `-2`) untuk cermin; menimpa
 *  bila ada, lalu membersihkan duplikat tata lama. Mengembalikan path tujuan. */
export async function tulisTepatArsip(
  data: Uint8Array,
  namaFile: string,
  akar: string,
  tipe: TipeArsip,
  lokasi: LokasiArsip,
): Promise<string> {
  const { exists, mkdir, remove, writeFile } = await import('@tauri-apps/plugin-fs');
  const { join } = await import('@tauri-apps/api/path');
  const folder = await folderArsip(akar, lokasi, tipe);
  await mkdir(folder, { recursive: true });
  const tujuan = await join(folder, namaFile);
  await writeFile(tujuan, data);
  if (!(await exists(tujuan))) throw new Error('Salinan arsip tidak terbentuk.');
  for (const lama of await jalurArsipLama(namaFile, '', akar, tipe)) {
    if (lama !== tujuan && (await exists(lama))) await remove(lama);
  }
  return tujuan;
}

/** Ganti nama berkas arsip di tempat (ke folder kanonis bila dari tata lama).
 *  Rename atomik dulu; lintas volume fallback salin + verifikasi + hapus.
 *  Mengembalikan path tujuan. */
export async function gantiNamaArsip(
  namaLama: string,
  namaBaru: string,
  jenis: string,
  akar: string,
  tipe: TipeArsip,
  lokasi: LokasiArsip,
): Promise<string> {
  const { copyFile, exists, mkdir, remove, rename, size } = await import('@tauri-apps/plugin-fs');
  const { join } = await import('@tauri-apps/api/path');
  const asal = await cariArsip(namaLama, jenis, akar, tipe, lokasi);
  if (!asal) throw new Error('Berkas lama tidak ditemukan di arsip.');
  const folder = await folderArsip(akar, lokasi, tipe);
  await mkdir(folder, { recursive: true });
  const tujuan = await join(folder, namaBaru);
  if (asal !== tujuan) {
    try {
      await rename(asal, tujuan);
    } catch {
      await copyFile(asal, tujuan);
      const [a, b] = await Promise.all([size(asal), size(tujuan)]);
      if (a !== b) {
        await remove(tujuan);
        throw new Error('Salinan tak sama besar; nama lama dipertahankan.');
      }
      await remove(asal);
      if (await exists(asal)) throw new Error('Berkas lama gagal dihapus setelah disalin.');
    }
  }
  if (!(await exists(tujuan))) throw new Error('Ganti nama arsip gagal.');
  for (const lama of await jalurArsipLama(namaLama, jenis, akar, tipe)) {
    if (lama !== asal && (await exists(lama))) await remove(lama);
  }
  return tujuan;
}

/** Kandidat (akar, lokasi) perangkat untuk satu nilai penyimpanan: test →
 *  uji; lokal → dokumen; server/cermin → keduanya (dokumen dulu). */
export async function kandidatAkarArsip(penyimpanan: string): Promise<{ akar: string; lokasi: LokasiArsip }[]> {
  const [a, b] = await Promise.all([
    prefGet(PREF_FOLDER_ARSIP).catch(() => null),
    prefGet(PREF_FOLDER_ARSIP_TEST).catch(() => null),
  ]);
  const akarDokumen = await akarArsip(typeof a === 'string' ? a : '', ROOT_ARSIP_DOKUMEN);
  const akarTest = await akarArsip(typeof b === 'string' ? b : '', ROOT_ARSIP_TEST);
  if (penyimpanan === 'test') return [{ akar: akarTest, lokasi: 'test' }];
  if (penyimpanan === 'lokal') return [{ akar: akarDokumen, lokasi: 'lokal' }];
  return [
    { akar: akarDokumen, lokasi: 'lokal' },
    { akar: akarTest, lokasi: 'test' },
  ];
}

/** Cari byte lokal di semua kandidat (cermin = dua-duanya); null bila tak ada.
 *  Mengembalikan juga (akar, lokasi) tempat ditemukan — dasar tulis balik. */
export async function cariLokal(
  namaFile: string,
  jenis: string,
  tipe: TipeArsip,
  penyimpanan: string,
): Promise<{ bytes: Uint8Array; mtime: number; akar: string; lokasi: LokasiArsip } | null> {
  for (const { akar, lokasi } of await kandidatAkarArsip(penyimpanan)) {
    const hasil = await bacaArsip(namaFile, jenis, akar, tipe, lokasi);
    if (hasil) return { ...hasil, akar, lokasi };
  }
  return null;
}

/** Target tulis perangkat: lokasi file ditemukan, atau bawaan (dokumen/lokal). */
export async function targetTulisLokal(
  namaFile: string,
  jenis: string,
  tipe: TipeArsip,
  penyimpanan: string,
): Promise<{ akar: string; lokasi: LokasiArsip }> {
  const ketemu = await cariLokal(namaFile, jenis, tipe, penyimpanan);
  if (ketemu) return { akar: ketemu.akar, lokasi: ketemu.lokasi };
  return (await kandidatAkarArsip(penyimpanan))[0];
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
