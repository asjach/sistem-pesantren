export type AlignKolom = 'left' | 'center' | 'right';

/** Lebar total BAWAAN kotak combobox filter (px) saat belum ada setelan
 *  tersimpan: dipakai `KotakLabel` (tanpa override) dan dropdown
 *  Urutkan/Kolom (`PresetUrut`/`PresetKolom`). */
export const LEBAR_BAWAHAN_FILTER = 160;

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

/** Label nama header kolom tersimpan (key kolom → teks pengganti); kunci
 *  asing dan nilai kosong diabaikan. Absen = pakai label field/bawaan. */
export function bacaLabel(label: Record<string, unknown> | undefined): Record<string, string> {
  const hasil: Record<string, string> = {};
  for (const [k, v] of Object.entries(label ?? {})) {
    if (!/^[a-z0-9_]{1,60}$/.test(k)) continue;
    const teks = typeof v === 'string' ? v.trim() : '';
    if (teks !== '') hasil[k] = teks;
  }
  return hasil;
}

/** Event jendela setelah setelan tabel tersimpan: tiap grid dengan tableKey
 *  sama memuat ulang. */
export const EVENT_TOOLBAR_BERUBAH = 'simpes:toolbar-berubah';

/** Sebarkan perubahan toolbar agar grid lain dengan tableKey sama memuat ulang. */
export function kabariToolbar(tableKey: string) {
  window.dispatchEvent(new CustomEvent(EVENT_TOOLBAR_BERUBAH, { detail: { tableKey } }));
}

/** Event jendela setelah susunan kolom sebuah preset berubah (mis. dari seret
 *  kolom di grid): pemilih preset tabel terkait memuat ulang daftarnya. */
export const EVENT_PRESET_BERUBAH = 'simpes:preset-berubah';
