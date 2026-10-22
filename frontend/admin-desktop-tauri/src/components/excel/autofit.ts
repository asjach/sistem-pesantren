import { AUTOFIT_BUFFER, AUTOFIT_MAX_W, MIN_COL_W } from './helpers';
import { PAD_JUDUL_X } from './header';
import { fontKanvas, measureActionsWidth, measureTextWidth } from './measure';
import type { BarisSel, ExcelField } from './types';

/** Batas baris pemindaian ukur: di atas ini diambil contoh merata (bukan
 *  semua baris) agar muat ribuan baris tetap cepat. Lebar dari contoh +
 *  buffer, dan pengguna bisa seret gagang bila ada outlier terlewat. */
export const BATAS_CONTOH_UKUR = 300;

/** Ambil contoh indeks tersebar bila melebihi batas. */
export function ambilContohBaris<T>(baris: readonly T[], batas = BATAS_CONTOH_UKUR): readonly T[] {
  if (baris.length <= batas) return baris;
  const keluar: T[] = [];
  for (let i = 0; i < batas; i += 1) {
    keluar.push(baris[Math.round((i * (baris.length - 1)) / (batas - 1))]);
  }
  return keluar;
}

/**
 * Gabung lebar segar dengan lebar sebelumnya secara MONOTON: kolom hanya
 * boleh membesar mengikuti data terlebar yang pernah terlihat, tak pernah
 * menyusut otomatis (pola Excel).
 *
 * Konteks: lebar diukur dari SAMPEL halaman aktif — halaman teks panjang vs
 * pendek membuat kolom berkedip kecil-besar-besar-kecil bila lebar segar
 * dipakai mentah, dan tiap perubahan lebar merambat ke estimasi tinggi baris
 * (berisiko remount + flash). Monoton memutus denyut itu: pindah halaman
 * tak lagi menggerakkan kolom kecuali ada data yang benar-benar lebih lebar.
 * Mengembalikan objek LAMA bila tak ada yang berubah (identitas stabil → tak
 * memicu render ulang berantai di `dsgColumns`/`tinggiBarisSatuan`).
 */
export function gabungLebarMaks(
  prev: Record<string, number>,
  segar: Record<string, number>,
): Record<string, number> {
  const semua = new Set([...Object.keys(prev), ...Object.keys(segar)]);
  let berubah = Object.keys(prev).length !== semua.size;
  const out: Record<string, number> = {};
  for (const k of semua) {
    const p = prev[k];
    const s = segar[k];
    const v = p === undefined ? s : s === undefined ? p : Math.max(p, s);
    if (v === undefined) continue;
    out[k] = v;
    if (!berubah && p !== v) berubah = true;
  }
  return berubah ? out : prev;
}

/** Baris sel dari `barisSel` kolom; kolom yang tak menyediakannya (atau
 *  mengembalikan undefined) memakai teks nilainya utuh sebagai SATU baris.
 *  Dipakai kedua jalur pengukuran (AutoFit DOM & lebar awal sinkron) supaya
 *  satu tak bisa mengukur differently dari yang lain. */
export function barisSelAtauTeks(
  dariKolom: BarisSel[] | undefined,
  teks: string,
): BarisSel[] {
  if (dariKolom !== undefined) return dariKolom;
  return teks === '' ? [] : [{ teks }];
}

/**
 * Lebar sel yang digambar beberapa baris: tiap baris diukur sendiri lalu
 * diambil yang TERLEBAR — bukan teksnya digabung jadi satu baris.
 *
 *  Tanpa ini, sel dua baris (mis. mapel di atas guru di bawah) terukur
 *  seolah dua teks itu bersebelahan, sehingga kolom selalu lebih lebar dari
 *  isinya. Ini kebalikan dari `lebarJudulDuaBaris` di atas: yang itu memecah
 * satu teks panjang ke DUA baris untuk menghemat ruang, yang ini mengukur
 * baris yang memang sudah dipisah oleh `renderCell`.
 */
export function lebarDariBaris(
  baris: readonly BarisSel[],
  ukur: (teks: string, ukuranPx?: number) => number,
): number {
  let w = 0;
  for (const b of baris) {
    if (b.teks === '') continue;
    w = Math.max(w, ukur(b.teks, b.ukuran));
  }
  return w;
}

export function lebarJudulDuaBaris(label: string, ukur: (text: string) => number): number {
  const kata = label.trim().split(/\s+/).filter(Boolean);
  if (kata.length < 2) return ukur(label);
  const lebarKata = kata.map(ukur);
  const lebarSpasi = ukur(' ');
  const total = lebarKata.reduce((jumlah, nilai) => jumlah + nilai, 0) + lebarSpasi * (kata.length - 1);
  let terbaik = total;
  let panjang = 0;
  for (let i = 0; i < kata.length - 1; i += 1) {
    panjang += lebarKata[i] + lebarSpasi;
    terbaik = Math.min(terbaik, Math.max(panjang, total - panjang));
  }
  return Math.max(...lebarKata, terbaik);
}

export interface OpsiAutoFit {
  fields: ExcelField[];
  rows: { id: string | number }[];
  /** Label efektif kolom (preset per tabel) untuk header. */
  labelKolom: (key: string, bawaan: string) => string;
  /** Teks tampil satu sel (format kolom sudah diterapkan). */
  teksSel: (f: ExcelField, rowId: string, key: string) => string;
  /** Baris-baris yang digambar dalam satu sel; kolom yang tak menyediakannya
   *  (atau mengembalikan undefined) memakai teks `teksSel` utuh sebagai satu
   *  baris. */
  barisSel?: (f: ExcelField, baris: { id: string | number }, key: string) => BarisSel[] | undefined;
  /** Konteks canvas (dibuat malas; null bila tak tersedia). */
  dapatkanCtx: () => CanvasRenderingContext2D | null;
}

/** Ukur lebar teks dengan font & padding nyata dari DOM (akurat ikut tema).
 *  `key === '__aksi'` diukur dari tombol yang benar-benar dirender. */
export function ukurAutoFit(root: HTMLElement | null, key: string, o: OpsiAutoFit): number | null {
  if (!root) return null;
  if (key === '__aksi') return measureActionsWidth(root);
  const f = o.fields.find((x) => x.key === key);
  if (!f) return null;

  // Sel contoh harus berasal dari KOLOM YANG DIUKUR. Memakai sel pertama grid
  // (dulu) mengambil kolom sticky/checkbox yang padding-nya 0, sehingga
  // padding kolom teks (mis. `px-2` di V2) tidak pernah ikut terhitung dan
  // hasil AutoFit terlalu sempit -> teks terpotong (elipsis).
  // Tentukan indeks kolom dari JUDUL kolom yang sesuai, bukan dari urutan
  // `fields`: kolom sticky (centang/beku) menambah anak di DOM sehingga
  // indeks field tidak sejajar dengan indeks anak baris.
  const selKolom = (baris: HTMLElement, idx: number): HTMLElement | null => {
    const anak = Array.from(baris.children) as HTMLElement[];
    return anak[idx] ?? null;
  };
  const barisContoh = Array.from(root.querySelectorAll<HTMLElement>('.dsg-row:not(.dsg-row-header)'));
  let cellEl: HTMLElement | null = null;
  const barisJudul = root.querySelector<HTMLElement>('.dsg-row.dsg-row-header');
  if (barisJudul) {
    const selJudul = Array.from(barisJudul.children) as HTMLElement[];
    const idx = selJudul.findIndex((h) => h.querySelector(`[data-gagang-lebar="${key}"]`));
    if (idx >= 0) {
      for (const b of barisContoh) {
        const c = selKolom(b, idx);
        if (c) { cellEl = c; break; }
      }
    }
  }
  if (!cellEl) {
    cellEl =
      root.querySelector<HTMLElement>(
        '.dsg-row:not(.dsg-row-header) .dsg-cell:not(.dsg-cell-gutter):not(:has(> input.dsg-checkbox))',
      ) ??
      root.querySelector<HTMLElement>('.dsg-row:not(.dsg-row-header) .dsg-cell:not(.dsg-cell-gutter)');
  }
  const headEl = root.querySelector<HTMLElement>('.dsg-row-header .dsg-cell');
  if (!cellEl || !headEl) return null;
  const ctx = o.dapatkanCtx();
  if (!ctx) return null;

  const padOf = (cs: CSSStyleDeclaration) =>
    (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  /** Baris sel: pakai `barisSel` bila kolom menyediakannya, kalau tidak
   *  teks datanya sendiri sebagai satu baris. */
  const barisCell = (baris: { id: string | number }): BarisSel[] =>
    barisSelAtauTeks(o.barisSel?.(f, baris, key), o.teksSel(f, String(baris.id), key));

  const csHead = getComputedStyle(headEl);
  const headCont = headEl.querySelector<HTMLElement>('.dsg-cell-header-container');
  const padHead =
    padOf(csHead) +
    (headCont ? padOf(getComputedStyle(headCont)) : 0) +
    PAD_JUDUL_X;
  const csCell = getComputedStyle(cellEl);
  // Padding teks bisa berada di pembungkus DALAM sel, bukan di `.dsg-cell`.
  // V2 merender isi sel sebagai `flex ... px-2`, sedangkan `.dsg-cell` sendiri
  // ber-padding 0 — memakai padOf(csCell) saja membuat hasil AutoFit ~16px
  // terlalu sempit sehingga teks terpotong (elipsis). Jumlahkan padding
  // pembungkus isi selama ia tidak menyerap lebar sel (bukan scroll container).
  const padIsiCell = (() => {
    let n = cellEl.firstElementChild as HTMLElement | null;
    let total = 0;
    let dalam = 0;
    while (n && dalam < 3) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none') break;
      total += padOf(cs);
      n = n.firstElementChild as HTMLElement | null;
      dalam += 1;
    }
    return total;
  })();
  const padCell = padOf(csCell) + padIsiCell;

  const CANDIDATE_MARGIN = 40;
  const values: { b: BarisSel[]; cw: number }[] = [];
  let maxCw = 0;
  for (const r of ambilContohBaris(o.rows)) {
    const b = barisCell(r);
    if (b.length === 0) continue;

    let cw = 0;
    for (const satu of b) {
      if (satu.teks === '') continue;
      ctx.font = fontKanvas(csCell, satu.ukuran);
      cw = Math.max(cw, ctx.measureText(satu.teks).width);
    }
    if (cw > maxCw) maxCw = cw;
    values.push({ b, cw });
  }

  let w = lebarJudulDuaBaris(
    o.labelKolom(f.key, f.label),
    (text) => measureTextWidth(text, csHead),
  ) + padHead + AUTOFIT_BUFFER;
  for (const { b, cw } of values) {
    if (cw < maxCw - CANDIDATE_MARGIN) continue;
    w = Math.max(
      w,
      lebarDariBaris(b, (teks, ukuran) => measureTextWidth(teks, csCell, ukuran)) +
        padCell +
        AUTOFIT_BUFFER,
    );
  }
  return Math.min(AUTOFIT_MAX_W, Math.max(MIN_COL_W, Math.ceil(w)));
}
