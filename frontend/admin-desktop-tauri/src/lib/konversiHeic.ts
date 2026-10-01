/** Deteksi + konversi HEIC/HEIF → JPEG (foto iPhone).
 *
 *  Dipakai jalur naik sinkron: berkas berekstensi heic (atau ber-magic HEIC
 *  tetapi bernama .jpg) diubah jadi JPEG asli sebelum diunggah, karena
 *  validasi backend dan penampil hanya menerima jpg/jpeg/png/pdf.
 *  Lib `heic2any` (±1,3 MB) dimuat malas — hanya saat HEIC ditemui.
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

/** True bila perlu konversi: ekstensi heic/heif ATAU isi HEIC bernama lain. */
export function butuhKonversiHeic(namaFile: string, bytes: Uint8Array): boolean {
  const ext = namaFile.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'heic' || ext === 'heif') return true;
  return magicHeic(bytes);
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
