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

export const LEBAR_BAWAHAN_FILTER = 120;
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
 *  dan nilai tak dikenal diabaikan. Absen = preferensi pribadi, lalu tengah. */
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

/** Event jendela setelah susunan kolom sebuah preset berubah (mis. dari seret
 *  kolom di grid): pemilih preset tabel terkait memuat ulang daftarnya. */
export const EVENT_PRESET_BERUBAH = 'simpes:preset-berubah';
