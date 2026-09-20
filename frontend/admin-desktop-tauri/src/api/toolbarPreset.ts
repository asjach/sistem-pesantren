import { api } from './client';

/** Peta kontrol → tampil (true/absen) atau sembunyi (false). */
export type VisibilitasToolbar = Record<string, boolean>;

/** Peta kontrol → lebar px (hanya cari/urut/kolom). */
export type LebarToolbarApi = Record<string, number>;

export interface ToolbarPresetData {
  table_key: string;
  visibilitas: VisibilitasToolbar;
  lebar: LebarToolbarApi;
  /** Urutan key kolom data (global); kosong = urutan bawaan halaman. */
  urutan: string[];
}

export function muatToolbarPreset(tableKey: string) {
  return api<{ pesan: string; data: ToolbarPresetData }>(
    `/admin/toolbar-preset?table_key=${encodeURIComponent(tableKey)}`,
  );
}

export function simpanToolbarPreset(tableKey: string, visibilitas?: VisibilitasToolbar, lebar?: LebarToolbarApi, urutan?: string[]) {
  return api<{ pesan: string; data: unknown }>('/admin/toolbar-preset', {
    method: 'PUT',
    body: JSON.stringify({
      table_key: tableKey,
      ...(visibilitas ? { visibilitas } : {}),
      ...(lebar ? { lebar } : {}),
      ...(urutan ? { urutan } : {}),
    }),
  });
}

export function hapusToolbarPreset(tableKey: string) {
  return api<{ pesan: string }>(`/admin/toolbar-preset?table_key=${encodeURIComponent(tableKey)}`, {
    method: 'DELETE',
  });
}
