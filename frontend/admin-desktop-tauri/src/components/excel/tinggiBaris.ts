/** Tinggi baris tabel: ikut isi + dapat diseret per baris (per tabel). */

/** Lantai/ plafon tinggi baris (px). */
export const MIN_BARIS_H = 18;
/** Batas atas tinggi otomatis — teks panjang tetap dibatasi agar baris tidak
 *  memakan seluruh tinggi tabel. */
export const MAX_BARIS_H = 240;

/** Padding sel mendatar (px) — cerminan `--part-tabel_sel-padx` bawaan. */
export const PAD_X_SEL = 16;
/** Padding sel vertikal (px) atas + bawah. */
export const PAD_Y_SEL = 8;

/**
 * Jumlah baris teks saat teks membungkus pada lebar tersedia.
 * Pembulatan ke atas dengan toleransi kecil agar teks yang pas di tepi
 * tidak melompat jadi 2 baris.
 */
export function hitungBarisTeks(lebarTeks: number, lebarTersedia: number): number {
  if (lebarTeks <= 0 || lebarTersedia <= 0) return 1;
  return Math.max(1, Math.ceil(lebarTeks / lebarTersedia - 0.02));
}

/**
 * Tinggi baris mengikuti isi: baris tertinggi di antara seluruh kolom.
 * Lebar teks tiap kolom sudah terukur lebih dulu (`measureTextWidth`),
 * sehingga fungsi ini murni dan bisa diuji tanpa DOM.
 */
export function hitungTinggiBaris(params: {
  /** Lebar teks (px) per kolom pada baris ini. */
  lebarTeks: readonly number[];
  /** Lebar kolom (px) sesuai urutan `lebarTeks`. */
  lebarKolom: readonly number[];
  fontPx: number;
  minH: number;
  maxH?: number;
  /** Faktor tinggi baris huruf (1.5 = line-height sel bawaan). */
  lineHeight?: number;
}): number {
  const faktor = params.lineHeight ?? 1.35;
  const tinggiBarisTeks = Math.max(1, Math.round(params.fontPx * faktor));
  const plafon = params.maxH ?? MAX_BARIS_H;

  let baris = 1;
  for (let i = 0; i < params.lebarTeks.length; i += 1) {
    const tersedia = (params.lebarKolom[i] ?? 0) - PAD_X_SEL;
    baris = Math.max(baris, hitungBarisTeks(params.lebarTeks[i], tersedia));
  }

  const perlu = baris * tinggiBarisTeks + PAD_Y_SEL;
  return Math.min(plafon, Math.max(params.minH, perlu));
}