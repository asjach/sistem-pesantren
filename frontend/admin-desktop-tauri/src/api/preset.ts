import { api } from './client';

export interface PresetTabel {
  id: number;
  lembaga_id: number | null;
  table_key: string;
  nama: string;
  kolom: string[];
  /** Nama header kustom per key kolom; kosong = label bawaan. */
  label?: Record<string, string> | null;
  lembaga?: { id: number; nama: string; kode: string | null } | null;
}

export function listPresetTabel(tableKey: string) {
  return api<{ pesan: string; data: { presets: PresetTabel[]; aktif_preset_id: number | null } }>(
    `/admin/preset-tabel?table_key=${encodeURIComponent(tableKey)}`,
  );
}

export function createPresetTabel(input: {
  table_key: string;
  nama: string;
  lembaga_ids: number[];
  kolom: string[];
  label?: Record<string, string> | null;
}) {
  return api<{ pesan: string; data: PresetTabel[] }>('/admin/preset-tabel', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updatePresetTabel(
  id: number,
  input: { nama?: string; lembaga_id?: number | null; kolom?: string[]; label?: Record<string, string> | null },
) {
  return api<{ pesan: string; data: PresetTabel[] }>(`/admin/preset-tabel/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deletePresetTabel(id: number) {
  return api<{ pesan: string }>(`/admin/preset-tabel/${id}`, { method: 'DELETE' });
}

export function setPresetAktif(tableKey: string, presetId: number | null) {
  return api<{ pesan: string }>('/admin/preset-tabel/aktif', {
    method: 'POST',
    body: JSON.stringify({ table_key: tableKey, preset_id: presetId }),
  });
}
