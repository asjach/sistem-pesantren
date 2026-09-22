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
    /** Kunci bagian → properti gaya/warna; null = hapus bagian itu dari standar. */
    gaya?: Record<string, Record<string, unknown> | null>;
    terang?: Record<string, Record<string, unknown> | null>;
    gelap?: Record<string, Record<string, unknown> | null>;
  };
  grid?: {
    rowH?: number | null;
    headerH?: number | null;
    align?: Record<string, AlignStandar>;
  };
  /** table_key → nama preset kolom yang aktif (null/'Lengkap' = semua kolom). */
  presetAktif?: Record<string, string | null>;
  /** table_key → (field → lebar px); null = hapus lebar standar tabel itu. */
  lebar?: Record<string, Record<string, number> | null>;
  /** table_key → jumlah kolom beku; null = hapus. */
  beku?: Record<string, number | null>;
}

export interface TampilanRespon {
  jenjang: string | null;
  versi: number;
  tampilan: TampilanData | null;
  diubah_oleh: string | null;
  diperbarui: string | null;
}

function q(jenjang?: string | null): string {
  return jenjang != null ? `?jenjang=${encodeURIComponent(jenjang)}` : '';
}

export function getPengaturanTampilan(jenjang?: string | null) {
  return api<{ pesan: string; data: TampilanRespon }>(`/admin/pengaturan-tampilan${q(jenjang)}`);
}

export function getVersiTampilan(jenjang?: string | null) {
  return api<{ pesan: string; data: { jenjang: string | null; versi: number } }>(
    `/admin/pengaturan-tampilan/versi${q(jenjang)}`,
  );
}

export function putPengaturanTampilan(input: {
  jenjangs: string[] | 'semua';
  sumber_jenjang?: string | null;
  data: TampilanData;
}) {
  return api<{ pesan: string; data: TampilanRespon[] }>('/admin/pengaturan-tampilan', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deletePengaturanTampilan(jenjang?: string | null) {
  return api<{ pesan: string }>(`/admin/pengaturan-tampilan${q(jenjang)}`, { method: 'DELETE' });
}
