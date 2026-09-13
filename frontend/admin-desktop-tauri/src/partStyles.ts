import { fontParts } from './fonts';
import { onAccentFor } from './prefs';
import { findPreset, type ThemeName } from './themes';
import {
  PARTS,
  PART_BY_ID,
  type PartGaya,
  type PartId,
  type PartOverrides,
  type PartWarna,
  type PetaGaya,
  type PetaWarna,
} from './parts';

/** Gaya per bagian di-generate runtime ke satu <style id> (urutan terakhir,
 *  menang atas utilitas Tailwind normal). Hanya properti yang DIISI yang
 *  ditulis — properti kosong tidak menyentuh tampilan bawaan komponen.
 *  Tipografi/kotak berlaku untuk kedua mode; warna dipisah terang/gelap. */

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

/** Deklarasi tipografi & kotak (berlaku kedua mode). `tanpa` berisi dimensi
 *  yang dinonaktifkan untuk bagian struktural (mis. ribbon). */
function deklGaya(g: PartGaya, tanpa?: readonly ('lebar' | 'tinggi')[]): { permukaan: string[]; teks: string[] } {
  const permukaan: string[] = [];
  if (g.borderW != null) permukaan.push(`border-width:${g.borderW}px!important`, 'border-style:solid!important');
  if (g.radius != null) permukaan.push(`border-radius:${g.radius}px!important`);
  if (g.padX != null) permukaan.push(`padding-left:${g.padX}px!important`, `padding-right:${g.padX}px!important`);
  if (g.padY != null) permukaan.push(`padding-top:${g.padY}px!important`, `padding-bottom:${g.padY}px!important`);
  if (g.lebar != null && !tanpa?.includes('lebar')) permukaan.push(`width:${g.lebar}px!important`);
  if (g.tinggi != null && !tanpa?.includes('tinggi')) permukaan.push(`height:${g.tinggi}px!important`);
  const teks: string[] = [];
  if (g.font) {
    const { family, weight } = fontParts(g.font);
    teks.push(`font-family:${family}!important`, `font-weight:${weight}!important`);
  }
  if (g.size != null) teks.push(`font-size:${g.size}px!important`);
  return { permukaan, teks };
}

/** Deklarasi warna (per mode). */
function deklWarna(w?: PartWarna): { permukaan: string[]; teks: string[] } {
  const permukaan: string[] = [];
  if (w?.bg) permukaan.push(`background-color:${w.bg}!important`);
  if (w?.border) permukaan.push(`border-color:${w.border}!important`);
  const teks: string[] = [];
  if (w?.fg) teks.push(`color:${w.fg}!important`);
  return { permukaan, teks };
}

/** Peta variabel CSS `--part-<id>-*` (dipakai rantai fallback index.css). */
export function variabelBagian(id: PartId, g?: PartGaya, w?: PartWarna): Record<string, string> {
  const tanpa = PART_BY_ID.get(id)?.tanpaDimensi;
  const v: Record<string, string> = {};
  if (g?.font) {
    const { family, weight } = fontParts(g.font);
    v[`--part-${id}-font`] = family;
    v[`--part-${id}-weight`] = weight;
  }
  if (g?.size != null) v[`--part-${id}-size`] = `${g.size}px`;
  if (g?.borderW != null) v[`--part-${id}-bw`] = `${g.borderW}px`;
  if (g?.radius != null) v[`--part-${id}-radius`] = `${g.radius}px`;
  if (g?.padX != null) v[`--part-${id}-padx`] = `${g.padX}px`;
  if (g?.padY != null) v[`--part-${id}-pady`] = `${g.padY}px`;
  if (g?.lebar != null && !tanpa?.includes('lebar')) v[`--part-${id}-lebar`] = `${g.lebar}px`;
  if (g?.tinggi != null && !tanpa?.includes('tinggi')) v[`--part-${id}-tinggi`] = `${g.tinggi}px`;
  if (w?.bg) v[`--part-${id}-bg`] = w.bg;
  if (w?.fg) v[`--part-${id}-fg`] = w.fg;
  if (w?.border) v[`--part-${id}-border`] = w.border;
  return v;
}

/** Satu blok aturan untuk sebuah bagian dalam scope mode tertentu. */
function blokBagian(scope: string, id: PartId, g?: PartGaya, w?: PartWarna): string {
  const meta = PART_BY_ID.get(id);
  if (!meta) return '';
  const gaya = deklGaya(g ?? {}, meta.tanpaDimensi);
  const warna = deklWarna(w);
  const permukaan = [...gaya.permukaan, ...warna.permukaan];
  const teks = [...gaya.teks, ...warna.teks];
  if (!permukaan.length && !teks.length) return '';
  const root = `${scope} :is(${meta.sel})`;
  let css = `${root}{${[...permukaan, ...teks].join(';')}}\n`;
  if (teks.length) {
    // Keturunan: kecuali elemen yang merupakan akar bagian LAIN (dan isinya) —
    // supaya bagian bersarang (mis. tab di dalam ribbon) tidak saling timpa.
    const lain = PARTS.filter((p) => p.id !== id)
      .map((p) => p.sel)
      .join(',');
    const desc =
      `${scope} :is(${meta.sel}) :where(*)` +
      tolakKontrol(meta.kendali) +
      `:not(:where(${lain})):not(:where(${lain}) *)` +
      TOLAK_WARNA;
    css += `${desc}{${teks.join(';')}}\n`;
  }
  return css;
}

/** Blok `{ --part-… }` untuk semua variabel bagian (gaya bersama + warna mode). */
function blokVariabel(scope: string, map: { gaya: PetaGaya; warna: PetaWarna }): string {
  const decls: string[] = [];
  for (const id of Object.keys(map.gaya) as PartId[]) {
    const v = variabelBagian(id, map.gaya[id], map.warna[id]);
    for (const [k, val] of Object.entries(v)) decls.push(`${k}:${val}`);
  }
  for (const [id, w] of Object.entries(map.warna) as [PartId, PartWarna][]) {
    if (map.gaya[id]) continue;
    const v = variabelBagian(id, undefined, w);
    for (const [k, val] of Object.entries(v)) decls.push(`${k}:${val}`);
  }
  return decls.length ? `${scope}{${decls.join(';')}}` : '';
}

export function bangunCssBagian(parts: PartOverrides): string {
  let css = '';
  for (const meta of PARTS) {
    const g = parts.gaya[meta.id];
    const wt = parts.terang[meta.id];
    const wg = parts.gelap[meta.id];
    if (!g && !wt && !wg) continue;
    css += blokBagian(':root:not(.dark)', meta.id, g, wt);
    css += blokBagian('.dark', meta.id, g, wg);
  }
  css += blokVariabel(':root:not(.dark)', { gaya: parts.gaya, warna: parts.terang });
  css += blokVariabel('.dark', { gaya: parts.gaya, warna: parts.gelap });
  return css;
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

/** CSS pratinjau editor: deklarasi sama seperti aslinya, tanpa scope mode
 *  (mode dipilih lewat tab) dan tanpa pengecualian antar-bagian. */
export function bangunCssPratinjau(id: PartId, g?: PartGaya, w?: PartWarna): string {
  const root = '#pratinjau_bagian [data-pratinjau-part]';
  const desc = `${root} *${tolakKontrol(PART_BY_ID.get(id)?.kendali)}`;
  const gaya = deklGaya(g ?? {}, PART_BY_ID.get(id)?.tanpaDimensi);
  const warna = deklWarna(w);
  const permukaan = [...gaya.permukaan, ...warna.permukaan];
  const teks = [...gaya.teks, ...warna.teks];
  let css = '';
  if (permukaan.length || teks.length) css += `${root}{${[...permukaan, ...teks].join(';')}}\n`;
  if (teks.length) css += `${desc}{${teks.join(';')}}\n`;
  return css;
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
