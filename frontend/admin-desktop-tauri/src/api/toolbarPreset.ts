import { api } from './client';

/** Peta kontrol → tampil (true/absen) atau sembunyi (false). */
export type VisibilitasToolbar = Record<string, boolean>;

/** Peta kontrol → lebar px (urut/kolom/filter.*). */
export type LebarToolbarApi = Record<string, number>;

/** Peta kontrol → tinggi px; KUNCI-nya sama dengan lebar. */
export type TinggiToolbarApi = Record<string, number>;

/** Peta key kolom → perataan (satu nilai per kolom per tabel, bukan per preset). */
export type AlignKolomApi = Record<string, 'left' | 'center' | 'right'>;

export interface ToolbarPresetData {
  table_key: string;
  visibilitas: VisibilitasToolbar;
  lebar: LebarToolbarApi;
  /** Tinggi kotak kontrol (px); kunci sama dengan `lebar`. */
  tinggi: TinggiToolbarApi;
  /** Urutan key kolom data (global); kosong = urutan bawaan halaman. */
  urutan: string[];
  /** Perataan kolom (absen = tengah). */
  align: AlignKolomApi;
}

export function muatToolbarPreset(tableKey: string) {
  return api<{ pesan: string; data: ToolbarPresetData }>(
    `/admin/toolbar-preset?table_key=${encodeURIComponent(tableKey)}`,
  );
}

/** `tinggi` ditaruh paling AKHIR supaya pemanggil lama (posisional) tak
 *  bergeser. Kirim peta LENGKAP untuk `lebar`/`tinggi`: server mengganti
 *  seluruh peta, bukan menggabung. */
export function simpanToolbarPreset(tableKey: string, visibilitas?: VisibilitasToolbar, lebar?: LebarToolbarApi, urutan?: string[], align?: AlignKolomApi, tinggi?: TinggiToolbarApi) {
  return api<{ pesan: string; data: unknown }>('/admin/toolbar-preset', {
    method: 'PUT',
    body: JSON.stringify({
      table_key: tableKey,
      ...(visibilitas ? { visibilitas } : {}),
      ...(lebar ? { lebar } : {}),
      ...(tinggi ? { tinggi } : {}),
      ...(urutan ? { urutan } : {}),
      ...(align ? { align } : {}),
    }),
  });
}

export function hapusToolbarPreset(tableKey: string) {
  return api<{ pesan: string }>(`/admin/toolbar-preset?table_key=${encodeURIComponent(tableKey)}`, {
    method: 'DELETE',
  });
}
