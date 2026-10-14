import { api } from './client';

/** Peta kontrol → tampil (true/absen) atau sembunyi (false). */
export type VisibilitasToolbar = Record<string, boolean>;

/** Peta key kolom → perataan (satu nilai per kolom per tabel, bukan per preset). */
export type AlignKolomApi = Record<string, 'left' | 'center' | 'right'>;

/** Peta key kolom → label tampil. Per TABEL, bukan per preset: preset hanya
 *  mengubah kolom mana yang tampil, bukan bagaimana kolom itu dinamai. */
export type LabelKolomApi = Record<string, string>;

export interface ToolbarPresetData {
  table_key: string;
  visibilitas: VisibilitasToolbar;
  /** DEPRECATED: peta lebar komponen. Sudah pindah ke `komponen_custom` dan tak
   *  lagi ditulis backend; tetap dikembalikan agar klien lama tak rusak. */
  lebar: Record<string, number>;
  /** @see ToolbarPresetData.lebar */
  tinggi: Record<string, number>;
  /** Urutan key kolom data (global); kosong = urutan bawaan halaman. */
  urutan: string[];
  /** Perataan kolom (absen = tengah). */
  align: AlignKolomApi;
  /** Label kolom khusus (absen = label bawaan kode). */
  label: LabelKolomApi;
  /** @see ToolbarPresetData.lebar */
  nilai_default: Record<string, string>;
}

export function muatToolbarPreset(tableKey: string) {
  return api<{ pesan: string; data: ToolbarPresetData }>(
    `/admin/toolbar-preset?table_key=${encodeURIComponent(tableKey)}`,
  );
}

/**
 * Simpan setelan TABEL. `lebar`/`tinggi`/`nilai_default` tak lagi diterima
 * backend — setelan komponen pindah ke `komponenCustom.ts`.
 *
 * `align` dan `label` ditaruh paling AKHIR supaya pemanggil lama (posisional)
 * tak bergeser.
 */
export function simpanToolbarPreset(
  tableKey: string,
  visibilitas?: VisibilitasToolbar,
  urutan?: string[],
  align?: AlignKolomApi,
  label?: LabelKolomApi,
) {
  return api<{ pesan: string; data: unknown }>('/admin/toolbar-preset', {
    method: 'PUT',
    body: JSON.stringify({
      table_key: tableKey,
      ...(visibilitas ? { visibilitas } : {}),
      ...(urutan ? { urutan } : {}),
      ...(align ? { align } : {}),
      ...(label !== undefined ? { label } : {}),
    }),
  });
}

export function hapusToolbarPreset(tableKey: string) {
  return api<{ pesan: string }>(`/admin/toolbar-preset?table_key=${encodeURIComponent(tableKey)}`, {
    method: 'DELETE',
  });
}
