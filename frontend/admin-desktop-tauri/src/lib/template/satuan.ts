/**
 * Konversi milimeter ke piksel untuk kanvas editor.
 *
 * Inch adalah 25,4 mm dan CSS mendefinisikan 1 inci = 96 px, jadi 1 mm =
 * 96/25,4 px. Faktor ini yang dipakai pdf.js saat merender halaman dengan
 * `scale`, sehingga kotak medan dan gambar latar tepat bertumpuk.
 */
export const PX_PER_MM = 96 / 25.4;

export const MM_PER_INCH = 25.4;

export function mmKePx(mm: number, zoom = 1): number {
  return mm * PX_PER_MM * zoom;
}

export function pxKeMm(px: number, zoom = 1): number {
  if (zoom === 0) {
    return 0;
  }
  return px / (PX_PER_MM * zoom);
}

/** Bulatkan ke desimal agar tidak menyimpan galat pecahan yang menumpuk. */
export function bulatMm(nilai: number, desimal = 2): number {
  const faktor = 10 ** desimal;
  return Math.round(nilai * faktor) / faktor;
}

export function jepit(nilai: number, min: number, maks: number): number {
  return Math.min(maks, Math.max(min, nilai));
}

/** Terjemahkan ukuran satu-desimal menjadi bahasa manusia, mis. 12,5 mm. */
export function teksMm(nilai: number, desimal = 1): string {
  return `${nilai.toFixed(desimal).replace('.', ',')} mm`;
}

/** Baca angka dari input teks; menerima koma desimal ala Indonesia. */
export function bacaAngka(teks: string, bawaan = 0): number {
  const bersih = teks.replace(/\s/g, '').replace(',', '.');
  const angka = Number.parseFloat(bersih);
  return Number.isFinite(angka) ? angka : bawaan;
}
