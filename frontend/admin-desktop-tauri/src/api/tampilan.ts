import { api } from './client';

/** Perataan kolom per field (samakan dengan GridPrefs.AlignName). */
export type AlignStandar = 'left' | 'center' | 'right';

/** Standar tampilan satu lembaga; wadah JSON yang mudah ditambah bagian baru. */
export interface TampilanData {
  tema?: {
    theme?: string;
    mode?: string;
    warnaUI?: string;
    iconSet?: string;
    density?: string;
  };
  parts?: {
    gaya?: Record<string, Record<string, unknown>>;
    terang?: Record<string, Record<string, unknown>>;
    gelap?: Record<string, Record<string, unknown>>;
  };
  grid?: {
    rowH?: number | null;
    headerH?: number | null;
    align?: Record<string, AlignStandar>;
  };
  /** table_key → nama preset kolom yang aktif (null/'Lengkap' = semua kolom). */
  presetAktif?: Record<string, string | null>;
  /** table_key → (field → lebar px). */
  lebar?: Record<string, Record<string, number>>;
  /** table_key → jumlah kolom beku. */
  beku?: Record<string, number>;
}

export interface TampilanRespon {
  lembaga_id: number | null;
  versi: number;
  tampilan: TampilanData | null;
  diubah_oleh: string | null;
  diperbarui: string | null;
}

function q(lembagaId?: number | null): string {
  return lembagaId != null ? `?lembaga_id=${lembagaId}` : '';
}

export function getPengaturanTampilan(lembagaId?: number | null) {
  return api<{ pesan: string; data: TampilanRespon }>(`/admin/pengaturan-tampilan${q(lembagaId)}`);
}

export function getVersiTampilan(lembagaId?: number | null) {
  return api<{ pesan: string; data: { lembaga_id: number | null; versi: number } }>(
    `/admin/pengaturan-tampilan/versi${q(lembagaId)}`,
  );
}

export function putPengaturanTampilan(input: {
  lembaga_ids: number[] | 'semua';
  sumber_lembaga_id?: number | null;
  data: TampilanData;
}) {
  return api<{ pesan: string; data: TampilanRespon[] }>('/admin/pengaturan-tampilan', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deletePengaturanTampilan(lembagaId?: number | null) {
  return api<{ pesan: string }>(`/admin/pengaturan-tampilan${q(lembagaId)}`, { method: 'DELETE' });
}
