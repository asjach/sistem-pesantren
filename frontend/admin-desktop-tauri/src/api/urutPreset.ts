import { api } from './client';

export type ArahUrut = 'naik' | 'turun';

/** Satu opsi urut yang tampil di dropdown: kode backend berurut + label +
 *  arah bawaan + penanda bawaan (dipakai saat halaman pertama dibuka). */
export interface OpsiUrut {
  kode: string[];
  label: string;
  arah: ArahUrut | null;
  bawaan: boolean;
}

/** Kode urut yang diizinkan backend + kolom DB-nya (untuk dialog pengelolaan). */
export interface KodeUrut {
  kode: string;
  kolom: string[];
}

export interface PresetUrutData {
  table_key: string;
  opsi: OpsiUrut[];
  tersedia: KodeUrut[];
}

export function muatUrutPreset(tableKey: string) {
  return api<{ pesan: string; data: PresetUrutData }>(
    `/admin/urut-preset?table_key=${encodeURIComponent(tableKey)}`,
  );
}

export function simpanUrutPreset(tableKey: string, opsi: OpsiUrut[]) {
  return api<{ pesan: string; data: unknown }>('/admin/urut-preset', {
    method: 'PUT',
    body: JSON.stringify({ table_key: tableKey, opsi }),
  });
}

export function hapusUrutPreset(tableKey: string) {
  return api<{ pesan: string }>(`/admin/urut-preset?table_key=${encodeURIComponent(tableKey)}`, {
    method: 'DELETE',
  });
}
