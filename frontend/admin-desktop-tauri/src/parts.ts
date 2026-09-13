import { FONT_FAMILY_DEFAULT, FONT_OPTIONS } from './fonts';

/** 18 bagian UI yang bisa diatur atomik (Tampilan → Bagian UI).
 *  `font`, `size`, dan `kotak` (border/radius/padding) berlaku untuk KEDUA mode;
 *  hanya warna (bg/fg/border) yang dipisah per mode terang/gelap.
 *  Tiap bagian punya `sel` (selektor akar) untuk generator gaya runtime
 *  (src/partStyles.ts); sebagian memakai atribut `data-part` yang dipasang di
 *  komponen (TopBar, ExcelTable), sisanya selektor struktural yang sudah ada. */
export type PartId =
  | 'ribbon'
  | 'tab_ribbon'
  | 'grup_ribbon'
  | 'menu_ribbon'
  | 'judul_halaman'
  | 'subjudul'
  | 'teks_isi'
  | 'kartu'
  | 'badge'
  | 'tabel_header'
  | 'tabel_sel'
  | 'pager'
  | 'toolbar_tabel'
  | 'tombol'
  | 'label_form'
  | 'input_form'
  | 'dropdown'
  | 'dialog';

export type PartMode = 'terang' | 'gelap';

/** Tipografi & kotak — SATU set untuk kedua mode. Field kosong = bawaan. */
export interface PartGaya {
  /** Nilai opsi src/fonts.ts ("<family>|<weight>"); `_bawaan` tidak disimpan. */
  font?: string;
  size?: number;
  borderW?: number;
  radius?: number;
  padX?: number;
  padY?: number;
}

/** Warna — dipisah per mode. Field kosong = bawaan. */
export interface PartWarna {
  bg?: string;
  fg?: string;
  border?: string;
}

export type PetaGaya = Partial<Record<PartId, PartGaya>>;
export type PetaWarna = Partial<Record<PartId, PartWarna>>;

export interface PartOverrides {
  /** Tipografi & kotak (berlaku kedua mode). */
  gaya: PetaGaya;
  /** Warna mode terang. */
  terang: PetaWarna;
  /** Warna mode gelap. */
  gelap: PetaWarna;
}

export interface PartMeta {
  id: PartId;
  label: string;
  grup: string;
  /** Sub-kelompok di dalam grup (dua tingkat di daftar Bagian UI). */
  sub?: string;
  /** Bagian kontrol/overlay: boleh menimpa seluruh isinya (termasuk kontrol).
   *  Bagian kontainer tidak menimpa kontrol di dalamnya (tombol/input/label/
   *  badge/dropdown/dialog punya pengaturannya sendiri) agar proporsi terjaga. */
  kendali?: boolean;
  /** Selektor elemen pengukuran nilai bawaan di pratinjau (opsional). */
  ukurSel?: string;
  hint: string;
  /** Selektor akar bagian (digabung otomatis dengan scope mode terang/gelap). */
  sel: string;
}

export const PARTS: PartMeta[] = [
  {
    id: 'ribbon',
    label: 'Bilah ribbon',
    grup: 'Struktur',
    sub: 'Ribbon',
    hint: 'Strip atas berisi tab & panel menu.',
    sel: '#root header',
  },
  {
    id: 'tab_ribbon',
    label: 'Tab ribbon',
    grup: 'Struktur',
    sub: 'Ribbon',
    kendali: true,
    hint: 'Tombol tab (Beranda, Master, …).',
    sel: "#root header button[id^='tab_ribbon_']",
  },
  {
    id: 'grup_ribbon',
    label: 'Grup ribbon',
    grup: 'Struktur',
    sub: 'Grup & menu',
    hint: 'Label & wadah kelompok tombol di ribbon.',
    sel: "[data-part='grup_ribbon']",
  },
  {
    id: 'menu_ribbon',
    label: 'Tombol menu ribbon',
    grup: 'Struktur',
    sub: 'Grup & menu',
    kendali: true,
    hint: 'Tombol besar navigasi per halaman.',
    sel: "[data-part='menu_ribbon']",
  },
  {
    id: 'judul_halaman',
    label: 'Judul halaman',
    grup: 'Teks',
    sub: 'Judul',
    hint: 'Heading utama halaman (H1–H2).',
    sel: '#root main :is(h1, h2)',
  },
  {
    id: 'subjudul',
    label: 'Subjudul / seksi',
    grup: 'Teks',
    sub: 'Judul',
    hint: 'Heading kecil pemisah seksi (H3–H4).',
    sel: '#root main :is(h3, h4)',
  },
  {
    id: 'teks_isi',
    label: 'Teks isi',
    grup: 'Teks',
    sub: 'Konten',
    hint: 'Paragraf & teks konten halaman.',
    sel: '#root main',
  },
  {
    id: 'kartu',
    label: 'Kartu / panel',
    grup: 'Teks',
    sub: 'Konten',
    hint: 'Panel ber-border (seksi form, ringkasan).',
    sel: '#root main section',
  },
  {
    id: 'badge',
    label: 'Badge / chip',
    grup: 'Teks',
    sub: 'Konten',
    kendali: true,
    hint: 'Label kecil status.',
    sel: "[data-slot='badge']",
  },
  {
    id: 'tabel_header',
    label: 'Header tabel',
    grup: 'Tabel',
    sub: 'Grid',
    ukurSel: '.dsg-cell-header-container',
    hint: 'Baris judul kolom grid.',
    sel: '.simpes-dsg .dsg-row.dsg-row-header',
  },
  {
    id: 'tabel_sel',
    label: 'Sel tabel',
    grup: 'Tabel',
    sub: 'Grid',
    ukurSel: '.dsg-cell',
    hint: 'Isi sel (baca-saja & editor).',
    sel: '.simpes-dsg',
  },
  {
    id: 'pager',
    label: 'Pager',
    grup: 'Tabel',
    sub: 'Bilah bantu',
    hint: 'Footer halaman tabel (Hal x / y).',
    sel: '#pager',
  },
  {
    id: 'toolbar_tabel',
    label: 'Toolbar tabel',
    grup: 'Tabel',
    sub: 'Bilah bantu',
    hint: 'Bilah atas tabel (info baris, tombol aksi).',
    sel: "[data-part='toolbar_tabel']",
  },
  {
    id: 'label_form',
    label: 'Label form',
    grup: 'Kontrol',
    sub: 'Form',
    kendali: true,
    hint: 'Label di atas input.',
    sel: "[data-slot='label']",
  },
  {
    id: 'input_form',
    label: 'Input / select',
    grup: 'Kontrol',
    sub: 'Form',
    kendali: true,
    hint: 'Kotak isian dan select.',
    sel: "[data-slot='input'], [data-slot='select-trigger']",
  },
  {
    id: 'tombol',
    label: 'Tombol',
    grup: 'Kontrol',
    sub: 'Aksi',
    kendali: true,
    hint: 'Semua tombol & tombol ikon aksi.',
    sel: "[data-slot='button']",
  },
  {
    id: 'dropdown',
    label: 'Menu dropdown',
    grup: 'Overlay',
    sub: 'Melayang',
    kendali: true,
    hint: 'Menu melayang, pilihan select, menu klik-kanan.',
    sel: "[data-slot='dropdown-menu-content'], [data-slot='context-menu-content'], [data-slot='select-content']",
  },
  {
    id: 'dialog',
    label: 'Dialog / modal',
    grup: 'Overlay',
    sub: 'Melayang',
    kendali: true,
    hint: 'Jendela dialog & konfirmasi.',
    sel: "[data-slot='dialog-content'], [data-slot='alert-dialog-content']",
  },
];

export const PART_IDS: PartId[] = PARTS.map((p) => p.id);
export const PART_BY_ID = new Map<PartId, PartMeta>(PARTS.map((p) => [p.id, p]));
export const PART_GROUPS: string[] = [...new Set(PARTS.map((p) => p.grup))];
export const EMPTY_PARTS: PartOverrides = { gaya: {}, terang: {}, gelap: {} };

const HEX = /^#[0-9a-f]{6}$/i;
const FONT_VALUES = new Set(FONT_OPTIONS.map((f) => f.value));
/** Rentang aman tiap properti numerik (px). */
export const RENTANG: Record<'size' | 'borderW' | 'radius' | 'padX' | 'padY', [number, number]> = {
  size: [8, 72],
  borderW: [0, 8],
  radius: [0, 32],
  padX: [0, 64],
  padY: [0, 64],
};

function angka(v: unknown, kunci: keyof typeof RENTANG): number | undefined {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return undefined;
  const [lo, hi] = RENTANG[kunci];
  const r = Math.round(n);
  return r < lo || r > hi ? undefined : r;
}

/** Validasi + bersihkan gaya tipografi/kotak (nilai asing dibuang). */
export function bersihkanGaya(v: unknown): PartGaya | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const s: PartGaya = {};
  if (typeof o.font === 'string' && o.font !== FONT_FAMILY_DEFAULT && FONT_VALUES.has(o.font)) {
    s.font = o.font;
  }
  for (const k of Object.keys(RENTANG) as (keyof typeof RENTANG)[]) {
    const n = angka(o[k], k);
    if (n != null) s[k] = n;
  }
  return Object.keys(s).length ? s : undefined;
}

/** Validasi + bersihkan warna bagian (hex saja; nilai asing dibuang). */
export function bersihkanWarna(v: unknown): PartWarna | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const s: PartWarna = {};
  for (const k of ['bg', 'fg', 'border'] as const) {
    const c = typeof o[k] === 'string' ? (o[k] as string).toLowerCase() : '';
    if (HEX.test(c)) s[k] = c;
  }
  return Object.keys(s).length ? s : undefined;
}

/** Validasi `simpes_parts` dari penyimpanan (aman terhadap data rusak).
 *  Bentuk lama (semua properti terpisah per mode) dimigrasi: properti
 *  tipografi/kotak diambil dari mode terang (fallback gelap); warna tetap
 *  dipertahankan per mode masing-masing. */
export function normalizeParts(v: unknown): PartOverrides {
  const hasil: PartOverrides = { gaya: {}, terang: {}, gelap: {} };
  if (!v || typeof v !== 'object') return hasil;
  const o = v as Record<string, unknown>;
  if (o.gaya && typeof o.gaya === 'object') {
    for (const id of PART_IDS) {
      const g = bersihkanGaya((o.gaya as Record<string, unknown>)[id]);
      if (g) hasil.gaya[id] = g;
    }
    for (const mode of ['terang', 'gelap'] as PartMode[]) {
      const src = o[mode];
      if (!src || typeof src !== 'object') continue;
      for (const id of PART_IDS) {
        const w = bersihkanWarna((src as Record<string, unknown>)[id]);
        if (w) hasil[mode][id] = w;
      }
    }
    return hasil;
  }
  const lamaTerang = (o.terang && typeof o.terang === 'object' ? o.terang : {}) as Record<string, unknown>;
  const lamaGelap = (o.gelap && typeof o.gelap === 'object' ? o.gelap : {}) as Record<string, unknown>;
  for (const id of PART_IDS) {
    const g = bersihkanGaya({ ...(lamaGelap[id] as object), ...(lamaTerang[id] as object) });
    if (g) hasil.gaya[id] = g;
    const wt = bersihkanWarna(lamaTerang[id]);
    if (wt) hasil.terang[id] = wt;
    const wg = bersihkanWarna(lamaGelap[id]);
    if (wg) hasil.gelap[id] = wg;
  }
  return hasil;
}

/** Gabung patch ke gaya; nilai `undefined` menghapus field (kosong = undefined). */
export function gabungGaya(ada: PartGaya | undefined, patch: Partial<PartGaya>): PartGaya | undefined {
  const next: PartGaya = { ...ada };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete next[k as keyof PartGaya];
    else (next as Record<string, unknown>)[k] = v;
  }
  return bersihkanGaya(next);
}

/** Gabung patch ke warna; nilai `undefined` menghapus field (kosong = undefined). */
export function gabungWarna(ada: PartWarna | undefined, patch: Partial<PartWarna>): PartWarna | undefined {
  const next: PartWarna = { ...ada };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete next[k as keyof PartWarna];
    else (next as Record<string, unknown>)[k] = v;
  }
  return bersihkanWarna(next);
}
