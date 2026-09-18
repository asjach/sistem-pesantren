import { api } from './client';

/** Peta kontrol → tampil (true/absen) atau sembunyi (false). */
export type VisibilitasToolbar = Record<string, boolean>;

export interface ToolbarPresetData {
  table_key: string;
  visibilitas: VisibilitasToolbar;
}

export function muatToolbarPreset(tableKey: string) {
  return api<{ pesan: string; data: ToolbarPresetData }>(
    `/admin/toolbar-preset?table_key=${encodeURIComponent(tableKey)}`,
  );
}

export function simpanToolbarPreset(tableKey: string, visibilitas: VisibilitasToolbar) {
  return api<{ pesan: string; data: unknown }>('/admin/toolbar-preset', {
    method: 'PUT',
    body: JSON.stringify({ table_key: tableKey, visibilitas }),
  });
}

export function hapusToolbarPreset(tableKey: string) {
  return api<{ pesan: string }>(`/admin/toolbar-preset?table_key=${encodeURIComponent(tableKey)}`, {
    method: 'DELETE',
  });
}
