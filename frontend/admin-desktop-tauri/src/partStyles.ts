import { fontParts } from './fonts';
import { onAccentFor } from './prefs';
import { findPreset, type ThemeName } from './themes';
import {
  PARTS,
  PART_BY_ID,
  type PartId,
  type PartMap,
  type PartMode,
  type PartOverrides,
  type PartStyle,
} from './parts';

/** Gaya per bagian di-generate runtime ke satu <style id> (urutan terakhir,
 *  menang atas utilitas Tailwind normal). Hanya properti yang DIISI yang
 *  ditulis — properti kosong tidak menyentuh tampilan bawaan komponen. */

const STYLE_ID = 'simpes_part_styles';

/** Kontrol yang TIDAK ikut ditimpa oleh bagian kontainer (tombol/input/label/
 *  badge/overlay punya bagiannya sendiri) — menjaga proporsi antar kontrol. */
const KONTROL =
  "[data-slot='button'], [data-slot='input'], [data-slot='select-trigger'], [data-slot='label'], " +
  "[data-slot='badge'], [data-slot='toggle'], [data-slot='toggle-group-item'], " +
  "[data-slot='dropdown-menu-content'], [data-slot='context-menu-content'], [data-slot='select-content'], " +
  "[data-slot='dialog-content'], [data-slot='alert-dialog-content'], [data-slot='checkbox'], " +
  "[data-slot='switch'], [data-slot='slider-thumb'], button, input, select, textarea";

/** Pengecualian kontrol (hanya untuk bagian kontainer, bukan bagian kendali). */
function tolakKontrol(kendali?: boolean): string {
  return kendali ? '' : `:not(:where(${KONTROL})):not(:where(${KONTROL}) *)`;
}

/** Aturan pewarnaan teks dimatikan untuk elemen dengan warna semantik
 *  (tombol hapus, peringatan, dsb.) dan penanda data-part-abaikan. */
const TOLAK_WARNA =
  ":not(.text-destructive):not(.text-warning):not(.text-success):not(.text-info)" +
  ":not(.text-primary-foreground):not(.text-accent-foreground):not(.text-secondary-foreground)" +
  ':not([data-part-abaikan]):not([data-part-abaikan] *)';

function gayaPermukaan(s: PartStyle): string[] {
  const d: string[] = [];
  if (s.bg) d.push(`background-color:${s.bg}!important`);
  if (s.border) d.push(`border-color:${s.border}!important`);
  if (s.borderW != null) d.push(`border-width:${s.borderW}px!important`, 'border-style:solid!important');
  if (s.radius != null) d.push(`border-radius:${s.radius}px!important`);
  if (s.padX != null) d.push(`padding-left:${s.padX}px!important`, `padding-right:${s.padX}px!important`);
  if (s.padY != null) d.push(`padding-top:${s.padY}px!important`, `padding-bottom:${s.padY}px!important`);
  return d;
}

function gayaTeks(s: PartStyle): string[] {
  const d: string[] = [];
  if (s.font) {
    const { family, weight } = fontParts(s.font);
    d.push(`font-family:${family}!important`, `font-weight:${weight}!important`);
  }
  if (s.size != null) d.push(`font-size:${s.size}px!important`);
  if (s.fg) d.push(`color:${s.fg}!important`);
  return d;
}

/** Peta variabel CSS `--part-<id>-*` untuk satu gaya (dipakai stylesheet &
 *  pratinjau editor; rantai fallback index.css mengonsumsi variabel ini). */
export function variabelBagian(id: PartId, s: PartStyle): Record<string, string> {
  const v: Record<string, string> = {};
  if (s.font) {
    const { family, weight } = fontParts(s.font);
    v[`--part-${id}-font`] = family;
    v[`--part-${id}-weight`] = weight;
  }
  if (s.size != null) v[`--part-${id}-size`] = `${s.size}px`;
  if (s.bg) v[`--part-${id}-bg`] = s.bg;
  if (s.fg) v[`--part-${id}-fg`] = s.fg;
  if (s.border) v[`--part-${id}-border`] = s.border;
  if (s.borderW != null) v[`--part-${id}-bw`] = `${s.borderW}px`;
  if (s.radius != null) v[`--part-${id}-radius`] = `${s.radius}px`;
  if (s.padX != null) v[`--part-${id}-padx`] = `${s.padX}px`;
  if (s.padY != null) v[`--part-${id}-pady`] = `${s.padY}px`;
  return v;
}

/** Blok `{ --part-… }` untuk scope mode terang/gelap. */
function blokVariabel(scope: string, id: PartId, s: PartStyle): string {
  const v = variabelBagian(id, s);
  const decls = Object.entries(v).map(([k, val]) => `${k}:${val}`);
  return decls.length ? `${scope}{${decls.join(';')}}` : '';
}

/** Variabel wajah tema (terang/gelap) untuk kanvas pratinjau editor — meniru
 *  yang dipasang `applyPrefs` di <html>, supaya pratinjau mengikuti mode yang
 *  sedang diedit, bukan mode global aplikasi. */
export function variabelWajah(theme: ThemeName, gelap: boolean, customHex: string): Record<string, string> {
  const t = theme === 'kustom' ? null : findPreset(theme);
  const bg = t ? (gelap ? t.gelap.bg : t.terang.bg) : gelap ? '#101511' : '#f2f5f1';
  const fg = t ? (gelap ? t.gelap.fg : t.terang.fg) : gelap ? '#e8ede8' : '#1d241e';
  const accent = theme === 'kustom' ? customHex : gelap ? t!.gelap.accent : t!.terang.accent;
  const mix = (a: string, pa: number, b: string) => `color-mix(in srgb, ${a} ${pa}%, ${b})`;
  return {
    '--background': bg,
    '--foreground': fg,
    '--accent': accent,
    '--on-accent': onAccentFor(accent),
    '--sidebar': t ? t.sidebar : gelap ? '#0d1f12' : '#17351f',
    '--sidebar-deep': t ? t.sidebarDeep : gelap ? '#0a180e' : '#122b1a',
    '--accent-readable': mix(accent, 72, fg),
    '--card': mix(fg, 5, bg),
    '--card-foreground': fg,
    '--popover': mix(fg, 5, bg),
    '--popover-foreground': fg,
    '--primary': accent,
    '--primary-foreground': onAccentFor(accent),
    '--secondary': mix(fg, 8, bg),
    '--secondary-foreground': fg,
    '--muted': mix(fg, 8, bg),
    '--muted-foreground': mix(fg, 68, bg),
    '--accent-soft': mix(accent, 16, bg),
    '--accent-soft-foreground': mix(accent, 70, fg),
    '--border': mix(fg, 12, bg),
    '--input': mix(fg, 12, bg),
    '--ring': accent,
    '--destructive': gelap ? '#e0685f' : '#a12622',
    '--destructive-foreground': gelap ? '#1a0b0a' : '#ffffff',
    '--warning': gelap ? '#fbbf24' : '#b45309',
    '--warning-foreground': gelap ? '#fcd34d' : '#92400e',
    '--success': mix('#16a34a', 72, fg),
    '--success-foreground': '#ffffff',
    '--info': mix('#2563eb', 72, fg),
    '--info-foreground': '#ffffff',
  };
}

/** CSS pratinjau editor: deklarasi sama seperti aslinya, tanpa scope mode
 *  (mode dipilih lewat tab) dan tanpa pengecualian antar-bagian. */
export function bangunCssPratinjau(id: PartId, s: PartStyle): string {
  const root = '#pratinjau_bagian [data-pratinjau-part]';
  const desc = `${root} *${tolakKontrol(PART_BY_ID.get(id)?.kendali)}`;
  const permukaan = gayaPermukaan(s);
  const teks = gayaTeks(s);
  let css = '';
  if (permukaan.length || teks.length) css += `${root}{${[...permukaan, ...teks].join(';')}}\n`;
  if (teks.length) css += `${desc}{${teks.join(';')}}\n`;
  return css;
}

function aturanMode(scope: string, map: PartMap): string {
  let css = '';
  for (const meta of PARTS) {
    const s = map[meta.id];
    if (!s) continue;
    const root = `${scope} :is(${meta.sel})`;
    // Keturunan: kecuali elemen yang merupakan akar bagian LAIN (dan isinya) —
    // supaya bagian bersarang (mis. tab di dalam ribbon) tidak saling timpa.
    const lain = PARTS.filter((p) => p.id !== meta.id)
      .map((p) => p.sel)
      .join(',');
    const desc =
      `${scope} :is(${meta.sel}) :where(*)` +
      tolakKontrol(meta.kendali) +
      `:not(:where(${lain})):not(:where(${lain}) *)` +
      TOLAK_WARNA;
    const permukaan = gayaPermukaan(s);
    const teks = gayaTeks(s);
    if (permukaan.length || teks.length) css += `${root}{${[...permukaan, ...teks].join(';')}}\n`;
    if (teks.length) css += `${desc}{${teks.join(';')}}\n`;
    const vars = blokVariabel(scope, meta.id, s);
    if (vars) css += `${vars}\n`;
  }
  return css;
}

export function bangunCssBagian(parts: PartOverrides): string {
  return aturanMode(':root:not(.dark)', parts.terang) + aturanMode('.dark', parts.gelap);
}

/** Tulis/ganti satu elemen <style> berisi seluruh aturan bagian. */
export function terapkanGayaBagian(parts: PartOverrides): void {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = bangunCssBagian(parts);
}
