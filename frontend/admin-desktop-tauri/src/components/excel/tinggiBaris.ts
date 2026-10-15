/** Tinggi baris tabel: ikut isi + dapat diseret per baris (per tabel). */

/** Lantai/ plafon tinggi baris (px). */
export const MIN_BARIS_H = 18;
/** Batas atas tinggi otomatis — teks panjang tetap dibatasi agar baris tidak
 *  memakan seluruh tinggi tabel. */
export const MAX_BARIS_H = 240;

/** Pilihan cepat tinggi baris (px) untuk tombol putar di footer tabel:
 *  setiap klik berpindah ke nilai berikutnya (melingkar). */
export const TINGGI_BARIS_OPSI = [20, 24, 28, 32] as const;

/** Tinggi baris bawaan tabel (px) — dipakai saat tabel belum punya tinggi
 *  sendiri, dan slider global pun belum disetel. */
export const TINGGI_BARIS_BAWAAN = 24;

/** Nilai berikut saat tombol tinggi baris diputar: pilihan setelah `sekarang`
 *  (melingkar). Nilai di luar daftar (mis. bawaan kerapatan 30px) → pilihan
 *  terkecil yang lebih besar, atau pilihan pertama bila sudah melewati semua. */
export function tinggiBarisBerikut(sekarang: number): number {
  const opsi: readonly number[] = TINGGI_BARIS_OPSI;
  const i = opsi.indexOf(sekarang);
  if (i >= 0) return opsi[(i + 1) % opsi.length];
  return opsi.find((v) => v > sekarang) ?? opsi[0];
}

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
  /** Faktor tinggi baris huruf. Sel data mewarisi `line-height` body (1.45,
   *  lihat `@layer base` di index.css) — pemanggil sebaiknya mengisi dari
   *  hasil ukur `getComputedStyle`, bukan mengandalkan bawaan ini. */
  lineHeight?: number;
  /** Padding mendatar sel kiri+kanan (px). Bawaan = cerminan
   *  `--part-tabel_sel-padx` bawaan (8px+8px); pemanggil sebaiknya mengisi
   *  dari hasil ukur `getComputedStyle` agar tetap tepat bila pengguna
   *  mengubahnya di Pengaturan → Tampilan. */
  padX?: number;
}): number {
  const faktor = params.lineHeight ?? 1.35;
  const padX = params.padX ?? PAD_X_SEL;
  const tinggiBarisTeks = Math.max(1, Math.round(params.fontPx * faktor));
  const plafon = params.maxH ?? MAX_BARIS_H;

  let baris = 1;
  for (let i = 0; i < params.lebarTeks.length; i += 1) {
    const tersedia = (params.lebarKolom[i] ?? 0) - padX;
    baris = Math.max(baris, hitungBarisTeks(params.lebarTeks[i], tersedia));
  }

  const perlu = baris * tinggiBarisTeks + PAD_Y_SEL;
  return Math.min(plafon, Math.max(params.minH, perlu));
}