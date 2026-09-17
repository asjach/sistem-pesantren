import { prefGet } from '@/api/client';
import { formatNilai } from '@/lib/nilaiTampil';
import type { ExcelField } from './types';

export const MIN_COL_W = 50;

/** Batas lebar hasil AutoFit (Excel juga membatasi, ~255 karakter). */
export const AUTOFIT_MAX_W = 480;

/** Ruang napas agar teks tidak menempel garis kolom saat AutoFit. */
export const AUTOFIT_BUFFER = 16;

/** Lebar kolom Aksi saat belum terukur (3 tombol ikon + padding + napas). */
export const ACTIONS_DEFAULT_W = 124;

/** Lebar kolom checklist (kolom data pertama). */
export const CHECK_W = 44;

/** Lantai lebar kolom Aksi (1 tombol ikon + padding). */
export const ACTIONS_MIN_W = 56;

/** Penanda "kapasitas aksi > 3" per tableKey; hanya tumbuh selama sesi (tidak
 *  pernah turun) agar layout ikon vs hamburger tidak berubah-ubah mengikuti
 *  data yang sedang tampil. Nilai = jumlah aksi maksimum yang pernah terlihat
 *  pada tabel tersebut. */
export const AKSI_RINGKAS = new Map<string, number>();

/** Id sintetis baris input paling bawah (mode Input). */
export const INPUT_ROW_ID = '__input__';

export function widthsKey(tableKey: string) {
  // v2: hasil AutoFit tidak lagi disimpan (lihat onAutoFit). Kunci lama berisi
  // lebar basi yang membekukan kolom dinamis (status/aksi) — diabaikan sekali.
  return `simpes_grid_${tableKey}_w_v2`;
}

/** Pref jumlah kolom beku (freeze pane kiri) per tabel; 0 = tanpa beku. */
export function freezeKey(tableKey: string) {
  return `simpes_grid_${tableKey}_freeze`;
}

export async function loadFreeze(key: string): Promise<number> {
  try {
    const v = await prefGet(key);
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  } catch {
    return 0;
  }
}

export async function loadWidths(key: string): Promise<Record<string, number>> {
  try {
    const v = await prefGet(key);
    const o = JSON.parse(v ?? '{}') as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, n] of Object.entries(o)) {
      if (typeof n === 'number' && Number.isFinite(n)) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

/** Cache lebar kolom per tabel untuk SESI berjalan (di memori, tidak disimpan).
 *  Kunjungan ulang ke halaman yang sama memakai lebar yang sudah final sehingga
 *  grid dapat dirender sekali jadi — tata letak tidak bergeser lagi. */
export interface WidthCacheEntry {
  widths: Record<string, number>;
  autoWidths: Record<string, number>;
}

export const widthCache = new Map<string, WidthCacheEntry>();

export function readWidthCache(tableKey: string): WidthCacheEntry | null {
  return widthCache.get(tableKey) ?? null;
}

export function writeWidthCache(tableKey: string, patch: Partial<WidthCacheEntry>) {
  const prev = widthCache.get(tableKey) ?? { widths: {}, autoWidths: {} };
  widthCache.set(tableKey, { ...prev, ...patch });
}

/** Cache tinggi final tabel kompak per tabel (sesi). Dipakai sebagai tinggi
 *  placeholder saat memuat ulang halaman agar tabel tidak berubah tinggi. */
export const tinggiCache = new Map<string, number>();

export let ukurHostEl: HTMLDivElement | null = null;

export function hostUkur(): HTMLDivElement | null {
  if (typeof document === 'undefined') return null;
  if (!ukurHostEl) {
    const h = document.createElement('div');
    h.className = 'simpes-dsg';
    h.setAttribute('aria-hidden', 'true');
    h.style.cssText =
      'position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;white-space:nowrap';
    h.innerHTML =
      '<div class="dsg-row dsg-row-header"><div class="dsg-cell dsg-cell-header">' +
      '<div class="dsg-cell-header-container"><span data-ukur="head"></span></div></div></div>' +
      '<div class="dsg-row"><div class="dsg-cell"><span data-ukur="cell"></span></div></div>';
    document.body.appendChild(h);
    ukurHostEl = h;
  }
  return ukurHostEl;
}

/** Teks yang BENAR-BENAR dirender sel untuk sebuah nilai grid. Kolom `select`
 *  menampilkan label pilihannya (`Ikut lembaga`), bukan nilai mentahnya
 *  (`default`), dan kolom ber-format kamus (angka/tanggal/ya_tidak) memakai
 *  hasil `formatNilai` — pengukuran lebar kolom (AutoFit & lebar awal) wajib
 *  memakai teks ini, kalau tidak kolom jadi sempit dan isi terpotong. */
export function teksTampilSel(f: ExcelField, raw: unknown, format?: string | null): string {
  if (raw == null) return '';
  if (f.kind === 'toggle') return '';
  const s = String(raw);
  if (f.kind === 'select') {
    return (f.choices ?? []).find((c) => c.value === s)?.label ?? s;
  }
  return format ? formatNilai(s, format) : s;
}

/** Editor sel DSG (input teks / select) sedang terbuka dan fokus? */
export function hasOpenEditor(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!el?.classList?.contains('dsg-input') || !!el?.classList?.contains('simpes-dsg-select');
}
