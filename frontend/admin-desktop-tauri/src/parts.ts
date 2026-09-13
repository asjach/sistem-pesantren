import { FONT_FAMILY_DEFAULT, FONT_OPTIONS } from './fonts';

/** 18 bagian UI yang bisa diatur atomik (Tampilan → Per bagian).
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

/** Gaya opsional per bagian. Field kosong = ikut komponen/tema (tidak ditimpa). */
export interface PartStyle {
  /** Nilai opsi src/fonts.ts ("<family>|<weight>"); `_bawaan` tidak disimpan. */
  font?: string;
  size?: number;
  bg?: string;
  fg?: string;
  border?: string;
  borderW?: number;
  radius?: number;
  padX?: number;
  padY?: number;
}

export type PartMap = Partial<Record<PartId, PartStyle>>;

export interface PartOverrides {
  terang: PartMap;
  gelap: PartMap;
}

export interface PartMeta {
  id: PartId;
  label: string;
  grup: string;
  hint: string;
  /** Selektor akar bagian (digabung otomatis dengan scope mode terang/gelap). */
  sel: string;
}

export const PARTS: PartMeta[] = [
  {
    id: 'ribbon',
    label: 'Bilah ribbon',
    grup: 'Struktur',
    hint: 'Strip atas berisi tab & panel menu.',
    sel: '#root header',
  },
  {
    id: 'tab_ribbon',
    label: 'Tab ribbon',
    grup: 'Struktur',
    hint: 'Tombol tab (Beranda, Master, …).',
    sel: "#root header button[id^='tab_ribbon_']",
  },
  {
    id: 'grup_ribbon',
    label: 'Grup ribbon',
    grup: 'Struktur',
    hint: 'Label & wadah kelompok tombol di ribbon.',
    sel: "[data-part='grup_ribbon']",
  },
  {
    id: 'menu_ribbon',
    label: 'Tombol menu ribbon',
    grup: 'Struktur',
    hint: 'Tombol besar navigasi per halaman.',
    sel: "[data-part='menu_ribbon']",
  },
  {
    id: 'judul_halaman',
    label: 'Judul halaman',
    grup: 'Teks',
    hint: 'Heading utama halaman (H1–H2).',
    sel: '#root main :is(h1, h2)',
  },
  {
    id: 'subjudul',
    label: 'Subjudul / seksi',
    grup: 'Teks',
    hint: 'Heading kecil pemisah seksi (H3–H4).',
    sel: '#root main :is(h3, h4)',
  },
  {
    id: 'teks_isi',
    label: 'Teks isi',
    grup: 'Teks',
    hint: 'Paragraf & teks konten halaman.',
    sel: '#root main',
  },
  {
    id: 'kartu',
    label: 'Kartu / panel',
    grup: 'Teks',
    hint: 'Panel ber-border (seksi form, ringkasan).',
    sel: '#root main section',
  },
  {
    id: 'badge',
    label: 'Badge / chip',
    grup: 'Teks',
    hint: 'Label kecil status.',
    sel: "[data-slot='badge']",
  },
  {
    id: 'tabel_header',
    label: 'Header tabel',
    grup: 'Tabel',
    hint: 'Baris judul kolom grid.',
    sel: '.simpes-dsg .dsg-row.dsg-row-header',
  },
  {
    id: 'tabel_sel',
    label: 'Sel tabel',
    grup: 'Tabel',
    hint: 'Isi sel (baca-saja & editor).',
    sel: '.simpes-dsg',
  },
  {
    id: 'pager',
    label: 'Pager',
    grup: 'Tabel',
    hint: 'Footer halaman tabel (Hal x / y).',
    sel: '#pager',
  },
  {
    id: 'toolbar_tabel',
    label: 'Toolbar tabel',
    grup: 'Tabel',
    hint: 'Bilah atas tabel (info baris, tombol aksi).',
    sel: "[data-part='toolbar_tabel']",
  },
  {
    id: 'tombol',
    label: 'Tombol',
    grup: 'Kontrol',
    hint: 'Semua tombol & tombol ikon aksi.',
    sel: "[data-slot='button']",
  },
  {
    id: 'label_form',
    label: 'Label form',
    grup: 'Kontrol',
    hint: 'Label di atas input.',
    sel: "[data-slot='label']",
  },
  {
    id: 'input_form',
    label: 'Input / select',
    grup: 'Kontrol',
    hint: 'Kotak isian dan select.',
    sel: "[data-slot='input'], [data-slot='select-trigger']",
  },
  {
    id: 'dropdown',
    label: 'Menu dropdown',
    grup: 'Overlay',
    hint: 'Menu melayang, pilihan select, menu klik-kanan.',
    sel: "[data-slot='dropdown-menu-content'], [data-slot='context-menu-content'], [data-slot='select-content']",
  },
  {
    id: 'dialog',
    label: 'Dialog / modal',
    grup: 'Overlay',
    hint: 'Jendela dialog & konfirmasi.',
    sel: "[data-slot='dialog-content'], [data-slot='alert-dialog-content']",
  },
];

export const PART_IDS: PartId[] = PARTS.map((p) => p.id);
export const PART_BY_ID = new Map<PartId, PartMeta>(PARTS.map((p) => [p.id, p]));
export const PART_GROUPS: string[] = [...new Set(PARTS.map((p) => p.grup))];
export const EMPTY_PARTS: PartOverrides = { terang: {}, gelap: {} };

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

/** Validasi + bersihkan satu gaya bagian (nilai asing dibuang). */
export function bersihkanGaya(v: unknown): PartStyle | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const s: PartStyle = {};
  if (typeof o.font === 'string' && o.font !== FONT_FAMILY_DEFAULT && FONT_VALUES.has(o.font)) {
    s.font = o.font;
  }
  for (const k of Object.keys(RENTANG) as (keyof typeof RENTANG)[]) {
    const n = angka(o[k], k);
    if (n != null) s[k] = n;
  }
  for (const k of ['bg', 'fg', 'border'] as const) {
    const c = typeof o[k] === 'string' ? o[k].toLowerCase() : '';
    if (HEX.test(c)) s[k] = c;
  }
  return Object.keys(s).length ? s : undefined;
}

/** Validasi struktur `simpes_parts` dari penyimpanan (aman terhadap data rusak). */
export function normalizeParts(v: unknown): PartOverrides {
  const hasil: PartOverrides = { terang: {}, gelap: {} };
  if (!v || typeof v !== 'object') return hasil;
  const o = v as Record<string, unknown>;
  for (const mode of ['terang', 'gelap'] as PartMode[]) {
    const src = o[mode];
    if (!src || typeof src !== 'object') continue;
    for (const id of PART_IDS) {
      const s = bersihkanGaya((src as Record<string, unknown>)[id]);
      if (s) hasil[mode][id] = s;
    }
  }
  return hasil;
}

/** Gabung patch ke gaya bagian; nilai `undefined` menghapus field.
 *  Mengembalikan `undefined` bila hasilnya kosong (bagian dianggap bawaan). */
export function gabungGaya(ada: PartStyle | undefined, patch: Partial<PartStyle>): PartStyle | undefined {
  const next: PartStyle = { ...ada };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete next[k as keyof PartStyle];
    else (next as Record<string, unknown>)[k] = v;
  }
  return bersihkanGaya(next);
}
