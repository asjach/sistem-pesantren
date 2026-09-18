/** Tab dialog Kelola tabel. */
export type TabKelola = 'kolom' | 'urutan' | 'kontrol';

/** Kunci kontrol toolbar generik yang bisa ditampil/sembunyikan per tabel. */
export type KontrolToolbar = 'cari' | 'info' | 'urut' | 'kolom' | 'filter';

export const KONTROL_TOOLBAR: { kunci: KontrolToolbar; label: string; ket: string }[] = [
  { kunci: 'cari', label: 'Kotak cari', ket: 'Kolom pencarian di tengah toolbar' },
  { kunci: 'info', label: 'Info seleksi', ket: 'Teks "N baris dipilih"' },
  { kunci: 'urut', label: 'Dropdown Urutkan', ket: 'Pemilih urutan + tombol arah' },
  { kunci: 'kolom', label: 'Dropdown Kolom', ket: 'Pemilih preset kolom' },
  { kunci: 'filter', label: 'Filter halaman', ket: 'Filter khusus halaman di kiri toolbar — awas mengunci alur (mis. pilihan kelas tujuan)' },
];

/** Status tampil per kontrol; absen/true/null = tampil, hanya false = sembunyi. */
export type VisToolbar = Record<KontrolToolbar, boolean>;

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
