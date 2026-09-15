import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { prefGet, prefSet } from '@/api/client';
import { FONT_FAMILY_DEFAULT, FONT_OPTIONS } from '@/fonts';

/** Tinggi baris grid (px). */
export const MIN_ROW_H = 20;
export const MAX_ROW_H = 200;
/** Tinggi baris header grid (px) — dipakai prop `headerRowHeight` DSG. */
export const MIN_HEADER_H = 20;
export const MAX_HEADER_H = 120;
export const DEFAULT_HEADER_H = 26;
/** Ukuran huruf isi tabel (px). */
export const MIN_FONT_PX = 9;
export const MAX_FONT_PX = 24;
export const DEFAULT_FONT_PX = 11;
/** Ukuran huruf baris HEADER tabel (px) — mandiri dari ukuran isi sel. */
export const DEFAULT_HEADER_FONT_PX = 11;

// Katalog jenis huruf dipakai bersama grid & antarmuka — sumber di src/fonts.ts.
export { FONT_OPTIONS, FONT_FAMILY_DEFAULT };
export type { FontOption } from '@/fonts';

/** Tinggi baris tunggal untuk SELURUH tabel (bukan per tabel). */
const GLOBAL_ROWH_KEY = 'simpes_grid_rowh';
/** Tinggi baris header tunggal untuk SELURUH tabel (bukan per tabel). */
const GLOBAL_HEADER_H_KEY = 'simpes_grid_headerh';
/** Ukuran huruf tunggal untuk SELURUH tabel (bukan per tabel). */
const GLOBAL_FONT_KEY = 'simpes_grid_font';
/** Jenis huruf ISI tabel, tunggal untuk SELURUH tabel. */
const GLOBAL_FONT_FAMILY_KEY = 'simpes_grid_font_family';
/** Perataan kolom per field (kunci field, bukan per tabel): berlaku di semua
 *  halaman. Hanya nilai bukan-bawaan (center/right) yang disimpan. */
const GLOBAL_ALIGN_KEY = 'simpes_grid_align';

/** Perataan isi kolom. Bawaan (tidak tersimpan) = kiri. */
export type AlignName = 'left' | 'center' | 'right';
export type AlignMap = Record<string, AlignName>;

async function loadRowH(): Promise<number | null> {
  try {
    const v = await prefGet(GLOBAL_ROWH_KEY);
    if (v == null || v.trim() === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.min(MAX_ROW_H, Math.max(MIN_ROW_H, Math.round(n)));
  } catch {
    return null;
  }
}

async function loadHeaderH(): Promise<number | null> {
  try {
    const v = await prefGet(GLOBAL_HEADER_H_KEY);
    if (v == null || v.trim() === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.min(MAX_HEADER_H, Math.max(MIN_HEADER_H, Math.round(n)));
  } catch {
    return null;
  }
}

async function loadFontPx(): Promise<number | null> {
  try {
    const v = await prefGet(GLOBAL_FONT_KEY);
    if (v == null || v.trim() === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.min(MAX_FONT_PX, Math.max(MIN_FONT_PX, Math.round(n)));
  } catch {
    return null;
  }
}

async function loadFontFamily(): Promise<string> {
  try {
    const v = await prefGet(GLOBAL_FONT_FAMILY_KEY);
    if (v == null || v === '') return FONT_FAMILY_DEFAULT;
    return FONT_OPTIONS.some((f) => f.value === v) ? v : FONT_FAMILY_DEFAULT;
  } catch {
    return FONT_FAMILY_DEFAULT;
  }
}

async function loadAlign(): Promise<AlignMap> {
  try {
    const v = await prefGet(GLOBAL_ALIGN_KEY);
    if (v == null || v.trim() === '') return {};
    const o = JSON.parse(v) as Record<string, unknown>;
    const out: AlignMap = {};
    for (const [k, a] of Object.entries(o)) {
      if (a === 'center' || a === 'right') out[k] = a;
    }
    return out;
  } catch {
    return {};
  }
}

interface GridPrefsState {
  rowH: number | null;
  headerH: number | null;
  fontPx: number | null;
  fontFamily: string;
  align: AlignMap;
  setRowH: (n: number | null) => void;
  setHeaderH: (n: number | null) => void;
  setFontPx: (n: number | null) => void;
  setFontFamily: (v: string) => void;
  setAlign: (fieldKey: string, a: AlignName) => void;
}

const Ctx = createContext<GridPrefsState | null>(null);

/** Preferensi tampilan tabel global (berlaku semua tabel, tersimpan perangkat).
 *  Disediakan di Layout agar kontrol di top bar dan grid berbagi state sama. */
export function GridPrefsProvider({ children }: { children: ReactNode }) {
  const [rowH, setRowHState] = useState<number | null>(null);
  const [headerH, setHeaderHState] = useState<number | null>(null);
  const [fontPx, setFontPxState] = useState<number | null>(null);
  const [fontFamily, setFontFamilyState] = useState(FONT_FAMILY_DEFAULT);
  const [align, setAlignState] = useState<AlignMap>({});

  useEffect(() => {
    loadRowH().then(setRowHState);
    loadHeaderH().then(setHeaderHState);
    loadFontPx().then(setFontPxState);
    loadFontFamily().then(setFontFamilyState);
    loadAlign().then(setAlignState);
  }, []);

  const setRowH = useCallback((n: number | null) => {
    setRowHState(n);
    // `null` = kembali ke kerapatan bawaan → kosongkan nilai tersimpan.
    prefSet(GLOBAL_ROWH_KEY, n != null ? String(n) : '').catch(() => {});
  }, []);

  const setHeaderH = useCallback((n: number | null) => {
    setHeaderHState(n);
    prefSet(GLOBAL_HEADER_H_KEY, n != null ? String(n) : '').catch(() => {});
  }, []);

  const setFontPx = useCallback((n: number | null) => {
    setFontPxState(n);
    if (n != null) prefSet(GLOBAL_FONT_KEY, String(n)).catch(() => {});
  }, []);

  const setFontFamily = useCallback((v: string) => {
    setFontFamilyState(v);
    prefSet(GLOBAL_FONT_FAMILY_KEY, v).catch(() => {});
  }, []);

  const setAlign = useCallback((fieldKey: string, a: AlignName) => {
    setAlignState((prev) => {
      const next = { ...prev };
      if (a === 'left') delete next[fieldKey];
      else next[fieldKey] = a;
      prefSet(GLOBAL_ALIGN_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<GridPrefsState>(
    () => ({ rowH, headerH, fontPx, fontFamily, align, setRowH, setHeaderH, setFontPx, setFontFamily, setAlign }),
    [rowH, headerH, fontPx, fontFamily, align, setRowH, setHeaderH, setFontPx, setFontFamily, setAlign],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGridPrefs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useGridPrefs di luar GridPrefsProvider');
  return ctx;
}
