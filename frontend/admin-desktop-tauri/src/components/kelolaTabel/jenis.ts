/** Kunci kontrol toolbar generik yang bisa ditampil/sembunyikan per tabel.
 *  Kotak cari tidak ada lagi (pencarian tunggal di topBar). */
export type KontrolToolbar = 'info' | 'urut' | 'kolom' | 'filter';

export type AlignKolom = 'left' | 'center' | 'right';

/** Kunci kontrol yang punya pengaturan lebar (px). */
export type KontrolLebar = 'urut' | 'kolom';

export const KONTROL_TOOLBAR: { kunci: KontrolToolbar; label: string; ket: string; lebar?: boolean }[] = [
  { kunci: 'urut', label: 'Dropdown Urutkan', ket: 'Pemilih urutan + tombol arah', lebar: true },
  { kunci: 'kolom', label: 'Dropdown Kolom', ket: 'Pemilih preset kolom', lebar: true },
  { kunci: 'filter', label: 'Filter halaman', ket: 'Combobox filter halaman selain Dropdown Urutkan dan Dropdown Kolom' },
];

export const LEBAR_BAWAHAN_FILTER = 200;
export const LEBAR_BAWAHAN_TOOLBAR: Record<KontrolLebar, number> = {
  urut: LEBAR_BAWAHAN_FILTER,
  kolom: LEBAR_BAWAHAN_FILTER,
};

/** Status tampil per kontrol; absen/true/null = tampil, hanya false = sembunyi. */
export type VisToolbar = Record<KontrolToolbar, boolean>;

/** Lebar efektif per kontrol (px); kunci absen = bawaan. */
export type LebarToolbar = Record<KontrolLebar, number>;

/** Prefiks kunci lebar filter halaman di peta `lebar` preset. */
export const AWALAN_LEBAR_FILTER = 'filter.';

/** Lebar filter halaman tersimpan (kunci filter → px); kunci asing diabaikan. */
export function bacaLebarFilter(lebar: Record<string, number> | undefined): Record<string, number> {
  const hasil: Record<string, number> = {};
  for (const [k, v] of Object.entries(lebar ?? {})) {
    if (!k.startsWith(AWALAN_LEBAR_FILTER) || typeof v !== 'number' || !Number.isFinite(v)) continue;
    const kunci = k.slice(AWALAN_LEBAR_FILTER.length);
    if (/^[a-z0-9_]{1,60}$/.test(kunci)) hasil[kunci] = Math.min(480, Math.max(40, Math.round(v)));
  }
  return hasil;
}

/** Rentang tinggi kotak kontrol (px) — selaras dengan validasi backend
 *  (`tinggi.*` integer 20–120) dan popover. */
export const TINGGI_KONTROL_MIN = 20;
export const TINGGI_KONTROL_MAKS = 120;

/** Kunci peta ukuran (`lebar`/`tinggi`) di server untuk sebuah kontrol
 *  combobox (dikenali dari `htmlFor`-nya). */
export function kunciUkuranServer(htmlFor: string): string {
  if (htmlFor.startsWith('select_urut_')) return 'urut';
  if (htmlFor.startsWith('select_preset_kolom_')) return 'kolom';
  return `${AWALAN_LEBAR_FILTER}${htmlFor}`;
}

/** Tinggi kotak kontrol tersimpan (kunci htmlFor → px); kunci asing diabaikan.
 *  Prefiks `filter.` dibuang agar sejajar dengan `bacaLebarFilter`. */
export function bacaTinggiFilter(tinggi: Record<string, number> | undefined): Record<string, number> {
  const hasil: Record<string, number> = {};
  for (const [k, v] of Object.entries(tinggi ?? {})) {
    if (!k.startsWith(AWALAN_LEBAR_FILTER) || typeof v !== 'number' || !Number.isFinite(v)) continue;
    const kunci = k.slice(AWALAN_LEBAR_FILTER.length);
    if (/^[a-z0-9_]{1,60}$/.test(kunci)) {
      hasil[kunci] = Math.min(TINGGI_KONTROL_MAKS, Math.max(TINGGI_KONTROL_MIN, Math.round(v)));
    }
  }
  return hasil;
}

/** Sufiks kunci lebar label/kontrol terkunci di peta `lebar` preset. */
export const SUFIKS_LEBAR_LABEL = '.label';
export const SUFIKS_LEBAR_KONTROL = '.kontrol';
/** Sufiks penanda LABEL yang mengembang (`= 1`; absen = kontrol mengembang). */
export const SUFIKS_EXPAND_LABEL = '.expand';
/** Sufiks penanda label TRANSPARAN (`= 1`; absen = label ber-bg). */
export const SUFIKS_LABEL_TRANSPARAN = '.labeltransparan';

/** Rentang lebar label/kontrol terkunci (px) — selaras dengan `ukuranKombo`
 *  dan validasi backend. */
export const LEBAR_LABEL_MIN = 40;
export const LEBAR_LABEL_MAKS = 400;
export const LEBAR_KONTROL_MIN = 40;
export const LEBAR_KONTROL_MAKS = 1200;

/** Lebar label terkunci per kontrol (kunci htmlFor → px). Kunci asing dan
 *  kunci lebar total diabaikan; prefiks `filter.` dibuang. */
export function bacaLebarLabelFilter(lebar: Record<string, number> | undefined): Record<string, number> {
  return bacaLebarSufiks(lebar, SUFIKS_LEBAR_LABEL, LEBAR_LABEL_MIN, LEBAR_LABEL_MAKS);
}

/** Lebar kontrol terkunci per kontrol (kunci htmlFor → px). */
export function bacaLebarKontrolFilter(lebar: Record<string, number> | undefined): Record<string, number> {
  return bacaLebarSufiks(lebar, SUFIKS_LEBAR_KONTROL, LEBAR_KONTROL_MIN, LEBAR_KONTROL_MAKS);
}

/** Kontrol yang LABEL-nya mengembang saat total diubah (kunci htmlFor).
 *  Kunci asing dan nilai selain `1` diabaikan; prefiks `filter.` dibuang. */
export function bacaExpandLabelFilter(lebar: Record<string, number> | undefined): Record<string, boolean> {
  return bacaFlagFilter(lebar, SUFIKS_EXPAND_LABEL);
}

/** Kontrol yang labelnya TRANSPARAN (kunci htmlFor → boolean).
 *  `1` = transparan, `0` = ber-bg eksplisit; absen = ikut bawaan. */
export function bacaLabelTransparanFilter(lebar: Record<string, number> | undefined): Record<string, boolean> {
  const hasil: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(lebar ?? {})) {
    if (!k.startsWith(AWALAN_LEBAR_FILTER) || !k.endsWith(SUFIKS_LABEL_TRANSPARAN)) continue;
    if (v !== 0 && v !== 1) continue;
    const kunci = k.slice(AWALAN_LEBAR_FILTER.length, -SUFIKS_LABEL_TRANSPARAN.length);
    if (/^[a-z0-9_]{1,60}$/.test(kunci)) hasil[kunci] = v === 1;
  }
  return hasil;
}

function bacaFlagFilter(lebar: Record<string, number> | undefined, sufiks: string): Record<string, boolean> {
  const hasil: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(lebar ?? {})) {
    if (!k.startsWith(AWALAN_LEBAR_FILTER) || !k.endsWith(sufiks)) continue;
    if (v !== 1) continue;
    const kunci = k.slice(AWALAN_LEBAR_FILTER.length, -sufiks.length);
    if (/^[a-z0-9_]{1,60}$/.test(kunci)) hasil[kunci] = true;
  }
  return hasil;
}

function bacaLebarSufiks(lebar: Record<string, number> | undefined, sufiks: string, min: number, maks: number): Record<string, number> {
  const hasil: Record<string, number> = {};
  for (const [k, v] of Object.entries(lebar ?? {})) {
    if (!k.startsWith(AWALAN_LEBAR_FILTER) || !k.endsWith(sufiks)) continue;
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const kunci = k.slice(AWALAN_LEBAR_FILTER.length, -sufiks.length);
    if (/^[a-z0-9_]{1,60}$/.test(kunci)) hasil[kunci] = Math.min(maks, Math.max(min, Math.round(v)));
  }
  return hasil;
}

export function bacaLebarToolbar(lebar: Record<string, number> | undefined): LebarToolbar {
  const px = (v: unknown, min = 40, maks = 480): number | null =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= maks ? Math.round(v) : null;
  return {
    urut: px(lebar?.urut) ?? LEBAR_BAWAHAN_TOOLBAR.urut,
    kolom: px(lebar?.kolom) ?? LEBAR_BAWAHAN_TOOLBAR.kolom,
  };
}

export function bacaVisToolbar(vis: Record<string, boolean> | undefined): VisToolbar {
  return {
    info: true,
    urut: vis?.urut !== false,
    kolom: vis?.kolom !== false,
    filter: vis?.filter !== false,
  };
}

/** Perataan kolom tersimpan (key kolom → left|center|right); kunci asing
 *  dan nilai tak dikenal diabaikan. Absen = tengah. */
export function bacaAlign(align: Record<string, unknown> | undefined): Partial<Record<string, AlignKolom>> {
  const hasil: Partial<Record<string, AlignKolom>> = {};
  for (const [k, v] of Object.entries(align ?? {})) {
    if (!/^[a-z0-9_]{1,60}$/.test(k)) continue;
    if (v === 'left' || v === 'center' || v === 'right') hasil[k] = v;
  }
  return hasil;
}

/** Event jendela setelah visibilitas tersimpan: tiap grid memuat ulang
 *  visibilitas tabelnya sendiri. */
export const EVENT_TOOLBAR_BERUBAH = 'simpes:toolbar-berubah';

/** Sebarkan perubahan toolbar agar grid lain dengan tableKey sama memuat ulang. */
export function kabariToolbar(tableKey: string) {
  window.dispatchEvent(new CustomEvent(EVENT_TOOLBAR_BERUBAH, { detail: { tableKey } }));
}

/** Event jendela setelah susunan kolom sebuah preset berubah (mis. dari seret
 *  kolom di grid): pemilih preset tabel terkait memuat ulang daftarnya. */
export const EVENT_PRESET_BERUBAH = 'simpes:preset-berubah';
