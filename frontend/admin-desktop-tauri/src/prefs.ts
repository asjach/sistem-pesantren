import { prefGet, prefSet } from '@/api/client';
import { ICON_SET_DEFAULT, ICON_SETS, type IconSetId } from './iconSets';
import { EMPTY_PARTS, normalizeParts, type PartOverrides } from './parts';
import { PRESET_IDS, type ThemeName } from './themes';

export type { ThemeName };
export type ModeName = 'gelap' | 'terang' | 'sistem';

/** Tingkat "kaya warna" UI: netral (hemat warna), aksen (judul+ikon),
 *  kaya (aksen + tint permukaan + warna semantik). */
export type WarnaUIName = 'netral' | 'aksen' | 'kaya';
export const WARNA_UI: WarnaUIName[] = ['netral', 'aksen', 'kaya'];

/** Kerapatan baris grid: ramping 20px, sedang 24px, nyaman 30px.
 *  Bawaan 'sedang' (24px) — selaras tinggi kontrol. */
export type DensityName = 'ramping' | 'sedang' | 'nyaman';
export const DENSITY_PX: Record<DensityName, number> = {
  ramping: 20,
  sedang: 24,
  nyaman: 30,
};

/** Nilai "Semua" pada pilihan baris per halaman: dikirim sebagai `per_page=0`
 *  dan diartikan backend sebagai tanpa batas (semua baris dalam satu halaman). */
export const PER_PAGE_ALL = 0;

/** Pagination bawaan SEMUA halaman tabel (baru maupun lama).
 *  Bawaan 50/halaman; opsi kecil (10) untuk daftar pendek, besar (500) untuk
 *  borongan, dan "Semua" (0) untuk menampilkan seluruh baris. */
export const PER_PAGE_DEFAULT = 50;
export const PER_PAGE_OPTIONS = [10, 50, 100, 500, PER_PAGE_ALL] as const;
export type PerPage = (typeof PER_PAGE_OPTIONS)[number];

/** Normalisasi nilai simpanan/URL menjadi salah satu opsi (jatuh ke bawaan). */
export function normalizePerPage(v: unknown): PerPage {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return (PER_PAGE_OPTIONS as readonly number[]).includes(n) ? (n as PerPage) : PER_PAGE_DEFAULT;
}

const K = {
  theme: 'simpes_theme',
  mode: 'simpes_mode',
  sidebar: 'simpes_sidebar',
  density: 'simpes_density',
  warnaUI: 'simpes_warna_ui',
  parts: 'simpes_parts',
  iconSet: 'simpes_icon_set',
} as const;

export interface Prefs {
  theme: ThemeName;
  mode: ModeName;
  collapsed: boolean;
  density: DensityName;
  /** Tingkat kekayaan warna UI (judul/ikon/permukaan/semantik). */
  warnaUI: WarnaUIName;
  /** Gaya atomik per bagian UI (terpisah mode terang/gelap). */
  parts: PartOverrides;
  /** Set ikon antarmuka (9 koleksi, lihat src/iconSets.ts). */
  iconSet: IconSetId;
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'geist',
  mode: 'sistem',
  collapsed: false,
  density: 'sedang',
  warnaUI: 'kaya',
  parts: EMPTY_PARTS,
  iconSet: ICON_SET_DEFAULT,
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
  const [theme, mode, sidebar, density, warnaUI, partsRaw, iconSetRaw] = await Promise.all([
    prefGet(K.theme),
    prefGet(K.mode),
    prefGet(K.sidebar),
    prefGet(K.density),
    prefGet(K.warnaUI),
    prefGet(K.parts),
    prefGet(K.iconSet),
  ]);
  let parts = EMPTY_PARTS;
  try {
    if (partsRaw) parts = normalizeParts(JSON.parse(partsRaw));
  } catch {
    parts = EMPTY_PARTS;
  }
  return {
    theme: PRESET_IDS.includes(theme ?? '')
      ? (theme as ThemeName)
      : DEFAULT_PREFS.theme,
    mode: mode === 'gelap' || mode === 'terang' ? mode : 'sistem',
    collapsed: sidebar === '1',
    density: (['ramping', 'sedang', 'nyaman'] as string[]).includes(density ?? '')
      ? (density as DensityName)
      : 'sedang',
    warnaUI: (WARNA_UI as string[]).includes(warnaUI ?? '')
      ? (warnaUI as WarnaUIName)
      : DEFAULT_PREFS.warnaUI,
    parts,
    iconSet: ICON_SETS.some((s) => s.id === iconSetRaw) ? (iconSetRaw as IconSetId) : ICON_SET_DEFAULT,
  };
}

export async function savePrefs(p: Prefs): Promise<void> {
  await Promise.all([
    prefSet(K.theme, p.theme),
    prefSet(K.mode, p.mode),
    prefSet(K.sidebar, p.collapsed ? '1' : '0'),
    prefSet(K.density, p.density),
    prefSet(K.warnaUI, p.warnaUI),
    prefSet(K.parts, JSON.stringify(p.parts)),
    prefSet(K.iconSet, p.iconSet),
  ]);
}
