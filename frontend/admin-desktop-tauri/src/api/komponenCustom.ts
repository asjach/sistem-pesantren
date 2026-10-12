import { api } from './client';

/** Peta setelan satu komponen (kunci setelan → nilai), contoh
 *  `{ tipeKontrol: 'nominal' }`. */
export type SetelanKomponen = Record<string, string>;

export interface KomponenCustomRow {
  table_key: string;
  komponen: string;
  setelan: SetelanKomponen;
}

export interface KomponenCustomData {
  /** Kunci gabung `table_key|komponen` → setelan. */
  peta: Record<string, SetelanKomponen>;
}

/** Muat setelan komponen custom. Tanpa `tableKey` semua baris dikembalikan
 *  (muatan kecil: hanya komponen yang benar-benar disetel) sehingga klien bisa
 *  melakukan cache satu kali untuk seluruh halaman. */
export function muatKomponenCustom(tableKey?: string) {
  const qs = tableKey === undefined ? '' : `?table_key=${encodeURIComponent(tableKey)}`;
  return api<{ pesan: string; data: KomponenCustomData }>(`/admin/komponen-custom${qs}`);
}

/** Simpan setelan satu komponen. `setelan` dikirim LENGKAP untuk komponen itu
 *  (server menimpa, bukan menggabung), jadi kunci yang tak dikirim kembali ke
 *  bawaan. */
export function simpanKomponenCustom(komponen: string, setelan: SetelanKomponen, tableKey = '') {
  return api<{ pesan: string; data: KomponenCustomRow }>('/admin/komponen-custom', {
    method: 'PUT',
    body: JSON.stringify({ table_key: tableKey, komponen, setelan }),
  });
}

/** Hapus setelan satu komponen → kembali ke bawaan pemanggil. */
export function hapusKomponenCustom(komponen: string, tableKey = '') {
  return api<{ pesan: string }>(
    `/admin/komponen-custom?table_key=${encodeURIComponent(tableKey)}&komponen=${encodeURIComponent(komponen)}`,
    { method: 'DELETE' },
  );
}