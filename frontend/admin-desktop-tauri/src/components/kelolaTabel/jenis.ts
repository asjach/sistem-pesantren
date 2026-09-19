/** Tab dialog Kelola tabel. */
export type TabKelola = 'kolom' | 'urutan' | 'kontrol';

/** Kunci kontrol toolbar generik yang bisa ditampil/sembunyikan per tabel. */
export type KontrolToolbar = 'cari' | 'info' | 'urut' | 'kolom' | 'filter';

/** Kunci kontrol yang punya pengaturan lebar (px). */
export type KontrolLebar = 'cari' | 'urut' | 'kolom';

export const KONTROL_TOOLBAR: { kunci: KontrolToolbar; label: string; ket: string; lebar?: boolean }[] = [
  { kunci: 'cari', label: 'Kotak cari', ket: 'Kolom pencarian di tengah toolbar', lebar: true },
  { kunci: 'info', label: 'Info seleksi', ket: 'Teks "N baris dipilih"' },
  { kunci: 'urut', label: 'Dropdown Urutkan', ket: 'Pemilih urutan + tombol arah', lebar: true },
  { kunci: 'kolom', label: 'Dropdown Kolom', ket: 'Pemilih preset kolom', lebar: true },
  { kunci: 'filter', label: 'Filter halaman', ket: 'Filter khusus halaman di kiri toolbar — awas mengunci alur (mis. pilihan kelas tujuan)' },
];

/** Lebar bawaan kontrol (px) — sama dengan kelas Tailwind bawaan toolbar
 *  (`w-35` = 140, `w-44` = 176). Selalu ditampilkan sebagai angka meski
 *  belum ada preset tersimpan. */
export const LEBAR_BAWAHAN_TOOLBAR: Record<KontrolLebar, number> = {
  cari: 140,
  urut: 176,
  kolom: 176,
};

/** Status tampil per kontrol; absen/true/null = tampil, hanya false = sembunyi. */
export type VisToolbar = Record<KontrolToolbar, boolean>;

/** Lebar efektif per kontrol (px); kunci absen = bawaan. */
export type LebarToolbar = Record<KontrolLebar, number>;

export function bacaLebarToolbar(lebar: Record<string, number> | undefined): LebarToolbar {
  const px = (v: unknown, min = 40, maks = 480): number | null =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= maks ? Math.round(v) : null;
  return {
    cari: px(lebar?.cari) ?? LEBAR_BAWAHAN_TOOLBAR.cari,
    urut: px(lebar?.urut) ?? LEBAR_BAWAHAN_TOOLBAR.urut,
    kolom: px(lebar?.kolom) ?? LEBAR_BAWAHAN_TOOLBAR.kolom,
  };
}

export function bacaVisToolbar(vis: Record<string, boolean> | undefined): VisToolbar {
  return {
    cari: vis?.cari !== false,
    info: vis?.info !== false,
    urut: vis?.urut !== false,
    kolom: vis?.kolom !== false,
    filter: vis?.filter !== false,
  };
}

/** Event jendela setelah visibilitas tersimpan: tiap grid memuat ulang
 *  visibilitas tabelnya sendiri. */
export const EVENT_TOOLBAR_BERUBAH = 'simpes:toolbar-berubah';
