/** Arsip lokal berkas dokumen — KHUSUS aplikasi desktop (Tauri).
 *
 *  Alur: salin ke folder khusus dokumen
 *  (`Documents/SIMPES-Dokumen/<jenis>/`), lalu (opsional, via checkbox)
 *  pindahkan file asli ke `<folder-asal>/sudah/`. Semua operasi aman-gagal:
 *  file asli tidak pernah dihapus sebelum salinan terverifikasi.
 *  Di browser biasa modul ini tidak dipakai (penjagaan `isTauri()` di halaman).
 */
import { isTauri } from '@/api/client';

/** Nama folder tujuan file asli di lokasi sumbernya. */
export const FOLDER_SUDAH = 'sudah';
/** Akar arsip dokumen di dalam Documents. */
export const ROOT_ARSIP_DOKUMEN = 'SIMPES-Dokumen';
/** Kunci pref: root arsip custom (absolut). Kosong = bawaan Documents. */
export const PREF_FOLDER_ARSIP = 'simpes_folder_arsip';
/** Kunci pref: mode penyimpanan perangkat (`server` | `lokal`). */
export const PREF_MODE_DOKUMEN = 'simpes_mode_dokumen';
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

/** Salin berkas ke `<root>/<jenis>/` dengan nama template.
 *  `root` absolut custom (pref) atau bawaan Documents. Mengembalikan path tujuan. */
export async function salinKeArsip(pathSumber: string, namaFile: string, jenis: string, root?: string | null): Promise<string> {
  const { copyFile, exists, mkdir } = await import('@tauri-apps/plugin-fs');
  const { documentDir, join } = await import('@tauri-apps/api/path');
  const akar = root && root.trim() !== '' ? root : await join(await documentDir(), ROOT_ARSIP_DOKUMEN);
  const folderJenis = await join(akar, slugSegmen(jenis) || 'lainnya');
  await mkdir(folderJenis, { recursive: true });
  const tujuan = await join(folderJenis, await namaUnik(folderJenis, namaFile));
  await copyFile(pathSumber, tujuan);
  if (!(await exists(tujuan))) throw new Error('Salinan arsip tidak terbentuk.');
  return tujuan;
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
