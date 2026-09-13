import { prefGet, prefSet } from '@/api/client';
import { FONT_FAMILY_DEFAULT, FONT_OPTIONS } from './fonts';
import { PRESET_IDS, type ThemeName } from './themes';

export type { ThemeName };
export type ModeName = 'gelap' | 'terang' | 'sistem';

/** Tingkat "kaya warna" UI: netral (hemat warna), aksen (judul+ikon),
 *  kaya (aksen + tint permukaan + warna semantik). */
export type WarnaUIName = 'netral' | 'aksen' | 'kaya';
export const WARNA_UI: WarnaUIName[] = ['netral', 'aksen', 'kaya'];

/** Kerapatan baris grid: ramping 30px, sedang 38px, nyaman 48px. */
export type DensityName = 'ramping' | 'sedang' | 'nyaman';
export const DENSITY_PX: Record<DensityName, number> = {
  ramping: 30,
  sedang: 38,
  nyaman: 48,
};

/** Pagination bawaan SEMUA halaman tabel (baru maupun lama). */
export const PER_PAGE_DEFAULT = 100;
export const PER_PAGE_OPTIONS = [100, 250, 500, 1000] as const;
export type PerPage = (typeof PER_PAGE_OPTIONS)[number];

/** Normalisasi nilai simpanan/URL menjadi salah satu opsi (jatuh ke bawaan). */
export function normalizePerPage(v: unknown): PerPage {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return (PER_PAGE_OPTIONS as readonly number[]).includes(n) ? (n as PerPage) : PER_PAGE_DEFAULT;
}

const K = {
  theme: 'simpes_theme',
  customHex: 'simpes_custom_hex',
  mode: 'simpes_mode',
  sidebar: 'simpes_sidebar',
  density: 'simpes_density',
  fontUI: 'simpes_font_ui',
  warnaUI: 'simpes_warna_ui',
} as const;

export interface Prefs {
  theme: ThemeName;
  customHex: string;
  mode: ModeName;
  collapsed: boolean;
  density: DensityName;
  /** Jenis huruf antarmuka (nilai opsi src/fonts.ts; `_bawaan` = Aptos). */
  fontUI: string;
  /** Tingkat kekayaan warna UI (judul/ikon/permukaan/semantik). */
  warnaUI: WarnaUIName;
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'geist',
  customHex: '#2c5c38',
  mode: 'sistem',
  collapsed: false,
  density: 'sedang',
  fontUI: FONT_FAMILY_DEFAULT,
  warnaUI: 'kaya',
};

/** Luminance relatif (WCAG) 0..1 untuk hex #rrggbb. */
export function luminance(hex: string): number {
  const c = hex.replace('#', '');
  const f = (i: number) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(0) + 0.7152 * f(2) + 0.0722 * f(4);
}

/** Teks putih/hitam di atas aksen agar kontras ≥4.5:1. */
export function onAccentFor(hex: string): string {
  const l = luminance(hex);
  const contrastWhite = 1.05 / (l + 0.05);
  return contrastWhite >= 4.5 ? '#ffffff' : '#111511';
}

export function normalizeHex(v: string): string | null {
  let s = v.trim().toLowerCase();
  if (/^[0-9a-f]{6}$/.test(s)) s = `#${s}`;
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  return null;
}

export async function loadPrefs(): Promise<Prefs> {
  const [theme, customHex, mode, sidebar, density, fontUI, warnaUI] = await Promise.all([
    prefGet(K.theme),
    prefGet(K.customHex),
    prefGet(K.mode),
    prefGet(K.sidebar),
    prefGet(K.density),
    prefGet(K.fontUI),
    prefGet(K.warnaUI),
  ]);
  return {
    theme: PRESET_IDS.includes(theme ?? '') || theme === 'kustom'
      ? (theme as ThemeName)
      : DEFAULT_PREFS.theme,
    customHex: customHex && normalizeHex(customHex) ? (normalizeHex(customHex) as string) : DEFAULT_PREFS.customHex,
    mode: mode === 'gelap' || mode === 'terang' ? mode : 'sistem',
    collapsed: sidebar === '1',
    density: (['ramping', 'sedang', 'nyaman'] as string[]).includes(density ?? '')
      ? (density as DensityName)
      : 'sedang',
    fontUI: FONT_OPTIONS.some((f) => f.value === fontUI) ? (fontUI as string) : FONT_FAMILY_DEFAULT,
    warnaUI: (WARNA_UI as string[]).includes(warnaUI ?? '')
      ? (warnaUI as WarnaUIName)
      : DEFAULT_PREFS.warnaUI,
  };
}

export async function savePrefs(p: Prefs): Promise<void> {
  await Promise.all([
    prefSet(K.theme, p.theme),
    prefSet(K.customHex, p.customHex),
    prefSet(K.mode, p.mode),
    prefSet(K.sidebar, p.collapsed ? '1' : '0'),
    prefSet(K.density, p.density),
    prefSet(K.fontUI, p.fontUI),
    prefSet(K.warnaUI, p.warnaUI),
  ]);
}
