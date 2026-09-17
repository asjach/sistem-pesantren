import { AUTOFIT_BUFFER, AUTOFIT_MAX_W, MIN_COL_W } from './helpers';
import { measureActionsWidth, measureTextWidth } from './measure';
import type { ExcelField } from './types';

export interface OpsiAutoFit {
  fields: ExcelField[];
  rows: { id: string | number }[];
  /** Label efektif kolom (kamus/preset) untuk header. */
  labelKolom: (key: string, bawaan: string) => string;
  /** Teks tampil satu sel (format kamus sudah diterapkan). */
  teksSel: (f: ExcelField, rowId: string, key: string) => string;
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
  // Ambil sel data TEKS: bukan gutter (padding 5px) dan bukan sel checkbox
  // (padding 0) — keduanya punya padding berbeda dari sel isi sehingga
  // lebar hasil AutoFit jadi kurang.
  const cellEl =
    root.querySelector<HTMLElement>(
      '.dsg-row:not(.dsg-row-header) .dsg-cell:not(.dsg-cell-gutter):not(:has(> input.dsg-checkbox))',
    ) ??
    root.querySelector<HTMLElement>('.dsg-row:not(.dsg-row-header) .dsg-cell:not(.dsg-cell-gutter)');
  const headEl = root.querySelector<HTMLElement>('.dsg-row-header .dsg-cell');
  if (!cellEl || !headEl) return null;
  const ctx = o.dapatkanCtx();
  if (!ctx) return null;

  const fontOf = (cs: CSSStyleDeclaration) =>
    `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const padOf = (cs: CSSStyleDeclaration) =>
    (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);

  const csHead = getComputedStyle(headEl);
  const headCont = headEl.querySelector<HTMLElement>('.dsg-cell-header-container');
  const padHead = padOf(csHead) + (headCont ? padOf(getComputedStyle(headCont)) : 0);
  const csCell = getComputedStyle(cellEl);
  const padCell = padOf(csCell);

  // Canvas dipakai hanya untuk MENYARING kandidat terlebar (cepat), lalu
  // kandidat itu diukur presisi dengan span DOM. Selisih canvas vs DOM
  // berasal dari tabular-nums/kerning, jadi ambil margin lebar.
  const CANDIDATE_MARGIN = 40;
  ctx.font = fontOf(csCell);
  const values: { v: string; cw: number }[] = [];
  let maxCw = 0;
  for (const r of o.rows) {
    const v = o.teksSel(f, String(r.id), key);
    if (!v) continue;
    const cw = ctx.measureText(v).width;
    if (cw > maxCw) maxCw = cw;
    values.push({ v, cw });
  }

  let w = measureTextWidth(o.labelKolom(f.key, f.label), csHead) + padHead + AUTOFIT_BUFFER;
  for (const { v, cw } of values) {
    if (cw < maxCw - CANDIDATE_MARGIN) continue;
    w = Math.max(w, measureTextWidth(v, csCell) + padCell + AUTOFIT_BUFFER);
  }
  return Math.min(AUTOFIT_MAX_W, Math.max(MIN_COL_W, Math.ceil(w)));
}
