/** Deteksi + konversi format foto HP (HEIC/WEBP) → JPEG.
 *
 *  Dipakai sebelum byte naik ke server: berkas berekstensi heic/heif/webp
 *  (atau ber-magic itu tetapi bernama .jpg) diubah jadi JPEG asli, karena
 *  validasi backend dan penampil hanya menerima jpg/jpeg/png/pdf.
 *  Lib `heic2any` (±1,3 MB) dimuat malas — hanya saat HEIC ditemui;
 *  WEBP didekode browser sendiri via kanvas (tanpa lib).
 *  Catatan: metadata EXIF tidak ikut (orientasi mengikuti piksel terdekode).
 */

/** Brand `ftyp` HEIC/HEIF umum (byte 4–7 = 'ftyp', 8–11 = brand). */
const BRAND_HEIC = new Set([
  'heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs',
  'mif1', 'msf1', 'heif', 'heih',
]);

/** Kualitas JPEG hasil konversi (dokumen harus tetap terbaca). */
export const KUALITAS_HEIC = 0.92;

/** True bila isi ber-magic container HEIC/HEIF. */
export function magicHeic(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const tag = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  if (tag !== 'ftyp') return false;
  const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
  return BRAND_HEIC.has(brand);
}

/** True bila isi ber-magic WEBP (`RIFF....WEBP`). */
export function magicWebp(bytes: Uint8Array): boolean {
  return bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}

/** Format yang perlu konversi sebelum ke server (null = langsung). */
export type FormatKonversi = 'heic' | 'webp';

/** Deteksi via ekstensi atau magic (menangkap `.jpg` berisi HEIC/WEBP). */
export function formatKonversi(namaFile: string, bytes: Uint8Array): FormatKonversi | null {
  const ext = namaFile.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'heic' || ext === 'heif' || magicHeic(bytes)) return 'heic';
  if (ext === 'webp' || magicWebp(bytes)) return 'webp';
  return null;
}

/** True bila perlu konversi: ekstensi heic/heif ATAU isi HEIC bernama lain. */
export function butuhKonversiHeic(namaFile: string, bytes: Uint8Array): boolean {
  return formatKonversi(namaFile, bytes) === 'heic';
}

/** Nama .jpg pendamping (ganti ekstensi; cek tabrakan urusan mesin). */
export function namaJpg(namaFile: string): string {
  const i = namaFile.lastIndexOf('.');
  return (i >= 0 ? namaFile.slice(0, i) : namaFile) + '.jpg';
}

/** Konversi byte HEIC → JPEG (browser/WebView saja). */
export async function konversiHeicKeJpg(data: Uint8Array, quality = KUALITAS_HEIC): Promise<Uint8Array> {
  const { default: heic2any } = await import('heic2any');
  const blob = new Blob([data.slice().buffer as ArrayBuffer], { type: 'image/heic' });
  const hasil = await heic2any({ blob, toType: 'image/jpeg', quality });
  const pertama = Array.isArray(hasil) ? hasil[0] : hasil;
  if (!pertama) throw new Error('Konversi HEIC gagal (tanpa keluaran).');
  return new Uint8Array(await pertama.arrayBuffer());
}

/** Konversi byte format browser (WEBP dkk.) → JPEG via kanvas. */
export async function konversiWebKeJpg(data: Uint8Array, mime: string, quality = KUALITAS_HEIC): Promise<Uint8Array> {
  const gambar = await createImageBitmap(new Blob([data.slice().buffer as ArrayBuffer], { type: mime }));
  try {
    const kanvas = document.createElement('canvas');
    kanvas.width = gambar.width;
    kanvas.height = gambar.height;
    const ctx = kanvas.getContext('2d');
    if (!ctx) throw new Error('Kanvas 2D tak tersedia.');
    ctx.drawImage(gambar, 0, 0);
    const blob: Blob | null = await new Promise((selesai) => kanvas.toBlob(selesai, 'image/jpeg', quality));
    if (!blob) throw new Error('Konversi gambar gagal (tanpa keluaran).');
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    gambar.close();
  }
}

/** Konversi byte sesuai format terdeteksi. */
export async function konversiKeJpg(data: Uint8Array, format: FormatKonversi, quality = KUALITAS_HEIC): Promise<Uint8Array> {
  return format === 'heic' ? konversiHeicKeJpg(data, quality) : konversiWebKeJpg(data, 'image/webp', quality);
}

/** Siapkan File untuk unggah server: konversi HEIC/WEBP → JPG bila perlu
 *  (nama ikut menjadi .jpg agar jujur). Format lain dikembalikan apa adanya. */
export async function siapkanFileUntukServer(file: File): Promise<{ file: File; dikonversi: boolean }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = formatKonversi(file.name, bytes);
  if (!format) return { file, dikonversi: false };
  const hasil = await konversiKeJpg(bytes, format);
  return {
    file: new File([hasil.slice().buffer as ArrayBuffer], namaJpg(file.name), { type: 'image/jpeg' }),
    dikonversi: true,
  };
}
