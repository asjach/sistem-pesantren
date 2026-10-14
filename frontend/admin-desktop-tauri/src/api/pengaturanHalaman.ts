import { api } from './client';

/** Setelan tab satu halaman: urutan rute + rute yang disembunyikan. */
export interface PengaturanHalamanData {
  page_key: string;
  /** Rute tab sesuai urutan tampil. Rute baru dari kode ditambahkan di akhir. */
  urutan: string[];
  /** Rute yang disembunyikan; disimpan terpisah agar posisinya tidak hilang. */
  sembunyi: string[];
}

/** Muat setelan beberapa halaman sekaligus (muatan kecil). */
export function muatPengaturanHalaman(keys: string[]) {
  const qs = keys.map((k) => `keys[]=${encodeURIComponent(k)}`).join('&');
  return api<{ pesan: string; data: { peta: Record<string, PengaturanHalamanData> } }>(
    `/admin/pengaturan-halaman?${qs}`,
  );
}

/** Simpan urutan + sembunyi LENGKAP untuk satu halaman. */
export function simpanPengaturanHalaman(pageKey: string, urutan: string[], sembunyi: string[]) {
  return api<{ pesan: string; data: PengaturanHalamanData }>('/admin/pengaturan-halaman', {
    method: 'PUT',
    body: JSON.stringify({ page_key: pageKey, urutan, sembunyi }),
  });
}

/** Kembalikan urutan tab halaman ke bawaan kode. */
export function hapusPengaturanHalaman(pageKey: string) {
  return api<{ pesan: string }>(
    `/admin/pengaturan-halaman?page_key=${encodeURIComponent(pageKey)}`,
    { method: 'DELETE' },
  );
}
