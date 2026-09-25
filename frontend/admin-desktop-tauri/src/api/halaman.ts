import { api } from './client';
import type { KunciFilterGlobal, ModeFilterGlobal } from '@/lib/filterHalaman';

/** Peta filter → tampil (true/absen) atau sembunyi (false). */
export type FilterHalaman = Partial<Record<KunciFilterGlobal, boolean>>;
export type FilterModeHalaman = Partial<Record<KunciFilterGlobal, ModeFilterGlobal>>;

export interface PengaturanHalamanData {
  page_key: string;
  filter: FilterHalaman;
  filter_mode: FilterModeHalaman;
}

export function muatPengaturanHalaman(pageKey: string) {
  return api<{ pesan: string; data: PengaturanHalamanData }>(
    `/admin/pengaturan-halaman?page_key=${encodeURIComponent(pageKey)}`,
  );
}

export function simpanPengaturanHalaman(
  pageKey: string,
  filter: FilterHalaman,
  filterMode: FilterModeHalaman,
) {
  return api<{ pesan: string; data: PengaturanHalamanData }>('/admin/pengaturan-halaman', {
    method: 'PUT',
    body: JSON.stringify({ page_key: pageKey, filter, filter_mode: filterMode }),
  });
}

export function hapusPengaturanHalaman(pageKey: string) {
  return api<{ pesan: string }>(`/admin/pengaturan-halaman?page_key=${encodeURIComponent(pageKey)}`, {
    method: 'DELETE',
  });
}
