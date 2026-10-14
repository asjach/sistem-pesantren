import { api } from './client';

export interface PresetTabel {
  id: number;
  jenjang: string | null;
  table_key: string;
  nama: string;
  kolom: string[];
  /** Preset bawaan tabel (dipakai bila user belum memilih preset). */
  is_default: boolean;
  lembaga?: { jenjang: string; nama: string } | null;
}

export function listPresetTabel(tableKey: string) {
  return api<{
    pesan: string;
    data: {
      presets: PresetTabel[];
      aktif_preset_id: number | null;
      default_preset_id: number | null;
      /** Susunan "Lengkap kustom" saat tanpa preset (null = semua kolom). */
      aktif_kolom: string[] | null;
    };
  }>(
    `/admin/preset-tabel?table_key=${encodeURIComponent(tableKey)}`,
  );
}

export function createPresetTabel(input: {
  table_key: string;
  nama: string;
  kolom: string[];
}) {
  return api<{ pesan: string; data: PresetTabel[] }>('/admin/preset-tabel', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updatePresetTabel(
  id: number,
  input: { nama?: string; kolom?: string[] },
) {
  return api<{ pesan: string; data: PresetTabel[] }>(`/admin/preset-tabel/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deletePresetTabel(id: number) {
  return api<{ pesan: string }>(`/admin/preset-tabel/${id}`, { method: 'DELETE' });
}

/** Simpan pilihan preset aktif. Saat `presetId` null, `kolom` menyimpan
 *  susunan "Lengkap kustom" supaya bertahan antar muat ulang.
 *
 *  Nama header kolom TIDAK lagi lewat sini: itu setelan per TABEL di
 *  `simpanToolbarPreset` (`toolbar_preset.label`), bukan per preset. */
export function setPresetAktif(
  tableKey: string,
  presetId: number | null,
  kolom?: string[] | null,
) {
  return api<{ pesan: string }>('/admin/preset-tabel/aktif', {
    method: 'POST',
    body: JSON.stringify({
      table_key: tableKey,
      preset_id: presetId,
      ...(presetId === null ? { kolom: kolom ?? [] } : {}),
    }),
  });
}
