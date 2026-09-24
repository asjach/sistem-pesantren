import { api } from './client';

/** Peta filter → tampil (true/absen) atau sembunyi (false). */
export type FilterHalaman = Record<string, boolean>;

export interface PengaturanHalamanData {
  page_key: string;
  filter: FilterHalaman;
}

export function muatPengaturanHalaman(pageKey: string) {
  return api<{ pesan: string; data: PengaturanHalamanData }>(
    `/admin/pengaturan-halaman?page_key=${encodeURIComponent(pageKey)}`,
  );
}

export function simpanPengaturanHalaman(pageKey: string, filter: FilterHalaman) {
  return api<{ pesan: string; data: unknown }>('/admin/pengaturan-halaman', {
    method: 'PUT',
    body: JSON.stringify({ page_key: pageKey, filter }),
  });
}

export function hapusPengaturanHalaman(pageKey: string) {
  return api<{ pesan: string }>(`/admin/pengaturan-halaman?page_key=${encodeURIComponent(pageKey)}`, {
    method: 'DELETE',
  });
}
