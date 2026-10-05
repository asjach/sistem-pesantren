import { api } from './client';
import type { KunciFilterGlobal, ModeFilterGlobal } from '@/lib/filterHalaman';

/** Peta filter → tampil (true/absen) atau sembunyi (false). */
export type FilterTabel = Partial<Record<KunciFilterGlobal, boolean>>;
export type FilterModeTabel = Partial<Record<KunciFilterGlobal, ModeFilterGlobal>>;

export interface PengaturanTabelData {
  table_key: string;
  filter: FilterTabel;
  filter_mode: FilterModeTabel;
  /** Ada baris tersimpan (untuk status tombol Kembalikan). */
  ada: boolean;
}

/** Muat pengaturan beberapa tabel sekaligus (halaman tanpa tabel memakai
 *  page_key sebagai `table_key`). */
export function muatPengaturanTabel(keys: string[]) {
  const qs = keys.map((k) => `keys[]=${encodeURIComponent(k)}`).join('&');
  return api<{ pesan: string; data: Record<string, PengaturanTabelData> }>(
    `/admin/pengaturan-tabel?${qs}`,
  );
}

export function simpanPengaturanTabel(
  tableKey: string,
  filter: FilterTabel,
  filterMode: FilterModeTabel,
) {
  return api<{ pesan: string; data: PengaturanTabelData }>('/admin/pengaturan-tabel', {
    method: 'PUT',
    body: JSON.stringify({ table_key: tableKey, filter, filter_mode: filterMode }),
  });
}

export function hapusPengaturanTabel(tableKey: string) {
  return api<{ pesan: string }>(
    `/admin/pengaturan-tabel?table_key=${encodeURIComponent(tableKey)}`,
    { method: 'DELETE' },
  );
}
