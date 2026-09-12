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

/** Tinggi baris grid (px). */
export const MIN_ROW_H = 26;
export const MAX_ROW_H = 200;
/** Ukuran huruf isi tabel (px). */
export const MIN_FONT_PX = 9;
export const MAX_FONT_PX = 24;
export const DEFAULT_FONT_PX = 13;
/** Nilai SelectItem "ikut bawaan" (Radix tidak mengizinkan string kosong). */
export const FONT_FAMILY_DEFAULT = '_bawaan';

export interface FontOption {
  value: string;
  label: string;
  group: 'sistem' | 'google' | 'aptos';
}

/** Pilihan jenis huruf isi tabel — sans-serif (tanpa kaki), relatif ramping.
 *  Nilai berformat "<font-family>|<font-weight>"; `FONT_FAMILY_DEFAULT`
 *  berarti ikut font & ketebalan bawaan aplikasi. */
export const FONT_OPTIONS: FontOption[] = [
  { value: FONT_FAMILY_DEFAULT, label: 'Bawaan', group: 'sistem' },
  // Font sistem (terpasang di OS pengguna).
  { value: '"Helvetica Neue", Helvetica, Arial, sans-serif|400', label: 'Helvetica Neue', group: 'sistem' },
  { value: '"Helvetica Neue", Helvetica, Arial, sans-serif|300', label: 'Helvetica Neue Light', group: 'sistem' },
  { value: '"Segoe UI", "Noto Sans", Roboto, Arial, sans-serif|400', label: 'Segoe UI', group: 'sistem' },
  { value: 'Calibri, Candara, "Segoe UI", Optima, sans-serif|400', label: 'Calibri', group: 'sistem' },
  { value: 'Arial, "Helvetica Neue", Helvetica, sans-serif|400', label: 'Arial', group: 'sistem' },
  { value: 'Tahoma, Geneva, sans-serif|400', label: 'Tahoma', group: 'sistem' },
  { value: '"Trebuchet MS", Tahoma, sans-serif|400', label: 'Trebuchet MS', group: 'sistem' },
  { value: '"Lucida Sans Unicode", "Lucida Grande", sans-serif|400', label: 'Lucida Sans', group: 'sistem' },
  // Aptos & Aptos Narrow — dibundel lokal di src/assets/fonts (berjalan offline).
  { value: '"Aptos", sans-serif|400', label: 'Aptos', group: 'aptos' },
  { value: '"Aptos", sans-serif|700', label: 'Aptos Bold', group: 'aptos' },
  { value: '"Aptos Narrow", sans-serif|400', label: 'Aptos Narrow', group: 'aptos' },
  { value: '"Aptos Narrow", sans-serif|700', label: 'Aptos Narrow Bold', group: 'aptos' },
  // Google Fonts — sudah diunduh ke src/assets/fonts (berjalan offline).
  { value: '"Inter", sans-serif|300', label: 'Inter Light', group: 'google' },
  { value: '"Inter", sans-serif|400', label: 'Inter', group: 'google' },
  { value: '"Roboto", sans-serif|300', label: 'Roboto Light', group: 'google' },
  { value: '"Roboto", sans-serif|400', label: 'Roboto', group: 'google' },
  { value: '"Open Sans", sans-serif|300', label: 'Open Sans Light', group: 'google' },
  { value: '"Open Sans", sans-serif|400', label: 'Open Sans', group: 'google' },
  { value: '"Lato", sans-serif|300', label: 'Lato Light', group: 'google' },
  { value: '"Lato", sans-serif|400', label: 'Lato', group: 'google' },
  { value: '"Noto Sans", sans-serif|300', label: 'Noto Sans Light', group: 'google' },
  { value: '"Noto Sans", sans-serif|400', label: 'Noto Sans', group: 'google' },
  { value: '"Source Sans 3", sans-serif|300', label: 'Source Sans 3 Light', group: 'google' },
  { value: '"Source Sans 3", sans-serif|400', label: 'Source Sans 3', group: 'google' },
  { value: '"Work Sans", sans-serif|300', label: 'Work Sans Light', group: 'google' },
  { value: '"Work Sans", sans-serif|400', label: 'Work Sans', group: 'google' },
  { value: '"Plus Jakarta Sans", sans-serif|300', label: 'Plus Jakarta Sans Light', group: 'google' },
  { value: '"Plus Jakarta Sans", sans-serif|400', label: 'Plus Jakarta Sans', group: 'google' },
];

/** Tinggi baris tunggal untuk SELURUH tabel (bukan per tabel). */
const GLOBAL_ROWH_KEY = 'simpes_grid_rowh';
/** Ukuran huruf tunggal untuk SELURUH tabel (bukan per tabel). */
const GLOBAL_FONT_KEY = 'simpes_grid_font';
/** Jenis huruf ISI tabel, tunggal untuk SELURUH tabel. */
const GLOBAL_FONT_FAMILY_KEY = 'simpes_grid_font_family';

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

interface GridPrefsState {
  rowH: number | null;
  fontPx: number | null;
  fontFamily: string;
  setRowH: (n: number | null) => void;
  setFontPx: (n: number | null) => void;
  setFontFamily: (v: string) => void;
}

const Ctx = createContext<GridPrefsState | null>(null);

/** Preferensi tampilan tabel global (berlaku semua tabel, tersimpan perangkat).
 *  Disediakan di Layout agar kontrol di top bar dan grid berbagi state sama. */
export function GridPrefsProvider({ children }: { children: ReactNode }) {
  const [rowH, setRowHState] = useState<number | null>(null);
  const [fontPx, setFontPxState] = useState<number | null>(null);
  const [fontFamily, setFontFamilyState] = useState(FONT_FAMILY_DEFAULT);

  useEffect(() => {
    loadRowH().then(setRowHState);
    loadFontPx().then(setFontPxState);
    loadFontFamily().then(setFontFamilyState);
  }, []);

  const setRowH = useCallback((n: number | null) => {
    setRowHState(n);
    if (n != null) prefSet(GLOBAL_ROWH_KEY, String(n)).catch(() => {});
  }, []);

  const setFontPx = useCallback((n: number | null) => {
    setFontPxState(n);
    if (n != null) prefSet(GLOBAL_FONT_KEY, String(n)).catch(() => {});
  }, []);

  const setFontFamily = useCallback((v: string) => {
    setFontFamilyState(v);
    prefSet(GLOBAL_FONT_FAMILY_KEY, v).catch(() => {});
  }, []);

  const value = useMemo<GridPrefsState>(
    () => ({ rowH, fontPx, fontFamily, setRowH, setFontPx, setFontFamily }),
    [rowH, fontPx, fontFamily, setRowH, setFontPx, setFontFamily],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGridPrefs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useGridPrefs di luar GridPrefsProvider');
  return ctx;
}
