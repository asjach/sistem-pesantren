import { api } from './client';

export type AlignKolom = 'left' | 'center' | 'right';
/** Gaya penulisan label otomatis dari nama kolom. */
export type ModeLabel = 'upper' | 'proper' | 'lower';

/** Atribut kamus satu kolom (kunci peta: "tabel.kolom"). */
export interface KamusKolomAttr {
  label: string | null;
  align: AlignKolom | null;
  lebar: number | null;
  kunci_lebar: boolean;
  tooltip: string | null;
  format: string | null;
}

export type KamusPeta = Record<string, KamusKolomAttr>;

export interface LabelKolom {
  id: number;
  tabel: string;
  kolom: string;
  label: string | null;
  align: AlignKolom | null;
  lebar: number | null;
  kunci_lebar: boolean;
  tooltip: string | null;
  format: string | null;
}

/** Satu tabel database + daftar kolomnya (untuk pemilih otomatis). */
export interface TabelSkema {
  tabel: string;
  kolom: string[];
}

export function petaKolom(tabel: string[]) {
  const q = new URLSearchParams({ tabel: tabel.join(',') });
  return api<{ pesan: string; data: KamusPeta }>(`/admin/kamus-kolom/peta?${q.toString()}`);
}

export function skemaKolom() {
  return api<{ pesan: string; data: TabelSkema[] }>('/admin/kamus-kolom/skema');
}

export function listKamusKolom(params: { tabel?: string; search?: string } = {}) {
  const q = new URLSearchParams();
  if (params.tabel) q.set('tabel', params.tabel);
  if (params.search) q.set('search', params.search);
  const s = q.toString();
  return api<{ pesan: string; data: LabelKolom[] }>(`/admin/kamus-kolom${s ? `?${s}` : ''}`);
}

export function createKamusKolom(input: Omit<LabelKolom, 'id'>) {
  return api<{ pesan: string; data: LabelKolom }>('/admin/kamus-kolom', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateKamusKolom(id: number, input: Omit<LabelKolom, 'id'>) {
  return api<{ pesan: string; data: LabelKolom }>(`/admin/kamus-kolom/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deleteKamusKolom(id: number) {
  return api<{ pesan: string }>(`/admin/kamus-kolom/${id}`, { method: 'DELETE' });
}

/** Isi label SEMUA kolom (seluruh tabel, kolom teknis dilewati) dari nama
 *  kolom + underscore → spasi, sesuai gaya `mode`. Label lama ditimpa. */
export function generasiLabel(mode: ModeLabel) {
  return api<{ pesan: string; data: { jumlah: number; tabel: number } }>('/admin/kamus-kolom/generasi', {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
}
