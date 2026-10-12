import { api } from './client';

/** Setelan satu komponen kustom. Semua nilai opsional: yang absen = bawaan
 *  pemanggil (lihat `ukuranKombo.ts` untuk batas px-nya).
 *
 *  Tipe `null` hanya dipakai di sisi klien saat MENYIMPAN perubahan: `null`
 *  berarti hapus kunci itu (kembali ke bawaan). Payload ke server tak pernah
 *  memuat `null`. */
export interface SetelanKomponen {
  /** Tinggi kotak (px). */
  tinggi?: number;
  /** Lebar TOTAL kotak (px). */
  lebar?: number;
  /** Lebar label terkunci (px). */
  lebarLabel?: number;
  /** Lebar kontrol terkunci (px). */
  lebarKontrol?: number;
  /** True = sisi yang mengembang saat total diubah adalah LABEL. */
  expandLabel?: boolean;
  /** True = label transparan (tanpa latar, teks bertitik dua). */
  labelTransparan?: boolean;
  /** Label opsi yang jadi nilai AWAL combobox. */
  nilaiDefault?: string;
  /** Tipe kontrol input (registry `tipeInput.tsx`), mis. `nominal`. */
  tipeKontrol?: string;
  /** PENGATURAN khusus tipe aktif (mis. `preset` nominal cepat pada tipe
   *  `nominal`): kunci pengaturan → nilai. Bentuknya bebas per tipe — registry
   *  `tipeInput.tsx` yang tahu artinya; server hanya membatasi kedalamannya
   *  (skalar atau larik skalar, maks 20 kunci). */
  tipe?: Record<string, unknown>;
}

/** Setelan + tanda "hapus kunci ini" (`null`) — bentuk kiriman dari UI. */
export type UbahSetelanKomponen = { [K in keyof SetelanKomponen]?: SetelanKomponen[K] | null };

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