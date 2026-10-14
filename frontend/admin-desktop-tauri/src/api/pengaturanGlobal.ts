import { api } from './client';

/** Kunci setelan global yang boleh punya standar server. WAJIB selaras
 *  dengan `KUNCI` di `PengaturanGlobalController.php`. */
export type KunciGlobal = 'tinggi_baris' | 'tinggi_header';

/** Standar server: kunci → nilai. Absen = tidak ada standar (pakai bawaan). */
export type PetaGlobal = Partial<Record<KunciGlobal, number>>;

export function muatPengaturanGlobal() {
  return api<{ pesan: string; data: { peta: PetaGlobal } }>('/admin/pengaturan-global');
}

/** Simpan standar satu kunci; `null` = hapus standar (kembali ke bawaan). */
export function simpanPengaturanGlobal(kunci: KunciGlobal, nilai: number | null) {
  return api<{ pesan: string; data: { kunci: string; nilai: number | null } }>(
    '/admin/pengaturan-global',
    { method: 'PUT', body: JSON.stringify({ kunci, nilai }) },
  );
}

export function hapusPengaturanGlobal(kunci: KunciGlobal) {
  return api<{ pesan: string }>(
    `/admin/pengaturan-global?kunci=${encodeURIComponent(kunci)}`,
    { method: 'DELETE' },
  );
}
