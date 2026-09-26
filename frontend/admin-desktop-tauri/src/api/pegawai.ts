import { api, downloadFile } from './client';
import type { DataExistingPayload } from '@/lib/excelDataExisting';
import { appendQueryParam, type ScalarOrArray } from './query';
import type { Paginate } from './master';
import type { PotongHasil } from '@/components/ImportBertahapUmumDialog';

// ---------- Buku Induk Guru ----------

export interface Pegawai {
  id: number;
  user_id: number | null;
  nip: string | null;
  nik: string | null;
  nama_lengkap: string;
  gelar_depan: string | null;
  gelar_belakang: string | null;
  jenis_kelamin: string;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  no_hp: string | null;
  email_pribadi: string | null;
  email_gws: string | null;
  status_aktif: string;
  tgl_mulai_kerja: string | null;
  pendidikan_terakhir: string | null;
  jenis_ptk: string | null;
  status_pernikahan: string | null;
  agama: string | null;
  gol_darah: string | null;
  penempatan?: LembagaPegawai[];
  akun?: { id: number; name: string; email: string | null } | null;
}

export function listPegawai(params: {
  q?: string;
  jenjang?: ScalarOrArray<string> | null;
  tahun_ajaran?: ScalarOrArray<string>;
  status_aktif?: string;
  sort?: string[];
  arah?: 'naik' | 'turun';
  page?: number;
  per_page?: number;
  signal?: AbortSignal;
} = {}) {
  const q = new URLSearchParams();
  if (params.q) q.set('q', params.q);
  appendQueryParam(q, 'jenjang', params.jenjang);
  appendQueryParam(q, 'tahun_ajaran', params.tahun_ajaran);
  if (params.status_aktif) q.set('status_aktif', params.status_aktif);
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  q.set('page', String(params.page ?? 1));
  q.set('per_page', String(params.per_page ?? 50));
  return api<Paginate<Pegawai>>(`/admin/pegawai?${q.toString()}`, { signal: params.signal });
}

export function createPegawai(input: Record<string, unknown>) {
  return api<{ pesan: string; data: Pegawai }>('/admin/pegawai', { method: 'POST', body: JSON.stringify(input) });
}

export function updatePegawai(id: number, input: Record<string, unknown>) {
  return api<{ pesan: string; data: Pegawai }>(`/admin/pegawai/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deletePegawai(id: number) {
  return api<{ pesan: string }>(`/admin/pegawai/${id}`, { method: 'DELETE' });
}

export function tautkanAkunPegawai(id: number, userId: number | null) {
  return api<{ pesan: string; data: Pegawai }>(`/admin/pegawai/${id}/tautkan-akun`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
}

// ---------- Penempatan (lembaga_pegawai) ----------

export interface LembagaPegawai {
  id: number;
  pegawai_id: number;
  jenjang: string;
  nipp: string | null;
  tugas_utama: string;
  is_active_lembaga: string;
  tgl_masuk: string | null;
  tgl_selesai: string | null;
  tahaj_masuk: string | null;
  pegawai?: Pegawai | null;
  lembaga?: { jenjang: string; nama: string } | null;
}

export function listPenempatanPegawai(params: {
  jenjang?: ScalarOrArray<string> | null;
  is_active_lembaga?: boolean | null;
  q?: string;
  sort?: string[];
  arah?: 'naik' | 'turun';
  page?: number;
  per_page?: number;
  signal?: AbortSignal;
} = {}) {
  const q = new URLSearchParams();
  appendQueryParam(q, 'jenjang', params.jenjang);
  if (params.is_active_lembaga != null) q.set('is_active_lembaga', params.is_active_lembaga ? '1' : '0');
  if (params.q) q.set('q', params.q);
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  q.set('page', String(params.page ?? 1));
  q.set('per_page', String(params.per_page ?? 50));
  return api<Paginate<LembagaPegawai>>(`/admin/pegawai-lembaga?${q.toString()}`, { signal: params.signal });
}

export function tempatkanPegawai(pegawaiId: number, input: Record<string, unknown>) {
  return api<{ pesan: string; data: LembagaPegawai }>(`/admin/pegawai/${pegawaiId}/tempatkan`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updatePenempatanPegawai(id: number, input: Record<string, unknown>) {
  return api<{ pesan: string; data: LembagaPegawai }>(`/admin/pegawai-lembaga/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function nonaktifkanPenempatan(id: number, tglSelesai?: string) {
  return api<{ pesan: string; data: LembagaPegawai }>(`/admin/pegawai-lembaga/${id}/nonaktifkan`, {
    method: 'POST',
    body: JSON.stringify(tglSelesai ? { tgl_selesai: tglSelesai } : {}),
  });
}

export function aktifkanPenempatan(id: number) {
  return api<{ pesan: string; data: LembagaPegawai }>(`/admin/pegawai-lembaga/${id}/aktifkan`, { method: 'POST' });
}

// ---------- Riwayat keaktifan (keaktifan_pegawai) ----------

export interface KeaktifanPegawai {
  id: number;
  pegawai_id: number;
  jenjang: string;
  tahun_ajaran: string;
  tugas_utama: string;
  status_keaktifan: string;
  pegawai?: Pegawai | null;
  lembaga?: { jenjang: string; nama: string } | null;
}

export function listKeaktifanPegawai(params: {
  jenjang?: ScalarOrArray<string> | null;
  tahun_ajaran?: ScalarOrArray<string>;
  status_keaktifan?: string;
  q?: string;
  sort?: string[];
  arah?: 'naik' | 'turun';
  page?: number;
  per_page?: number;
  signal?: AbortSignal;
} = {}) {
  const q = new URLSearchParams();
  appendQueryParam(q, 'jenjang', params.jenjang);
  appendQueryParam(q, 'tahun_ajaran', params.tahun_ajaran);
  if (params.status_keaktifan) q.set('status_keaktifan', params.status_keaktifan);
  if (params.q) q.set('q', params.q);
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  q.set('page', String(params.page ?? 1));
  q.set('per_page', String(params.per_page ?? 50));
  return api<Paginate<KeaktifanPegawai>>(`/admin/pegawai-keaktifan?${q.toString()}`, { signal: params.signal });
}

export function simpanKeaktifanPegawai(input: Record<string, unknown>) {
  return api<{ pesan: string; data: KeaktifanPegawai }>('/admin/pegawai-keaktifan', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function aktifkanMassalKeaktifan(input: { jenjang: string; tahun_ajaran: string; pegawai_id?: number[] }) {
  return api<{ pesan: string; data: { dibuat: number } }>('/admin/pegawai-keaktifan/aktifkan-massal', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function nonaktifkanKeaktifan(id: number) {
  return api<{ pesan: string; data: KeaktifanPegawai }>(`/admin/pegawai-keaktifan/${id}/nonaktifkan`, { method: 'POST' });
}

// ---------- Import Buku Induk ----------

export const KOLOM_IMPORT_PEGAWAI = [
  'pegawai_id', 'nama_lengkap', 'nip', 'nik', 'jenis_kelamin',
  'gelar_depan', 'gelar_belakang', 'tempat_lahir', 'tanggal_lahir',
  'no_hp', 'email_pribadi', 'email_gws', 'status_aktif',
  'tgl_mulai_kerja', 'pendidikan_terakhir', 'jenis_ptk',
  'status_pernikahan', 'agama', 'gol_darah',
];

export function unduhTemplatePegawai() {
  return downloadFile('/admin/pegawai/import-template', 'template-import-pegawai.xlsx');
}

export function dataPegawaiExisting() {
  return api<DataExistingPayload>('/admin/pegawai/data-existing');
}

export function importPegawaiPotong(input: {
  sesi_id?: number;
  mode: 'periksa' | 'eksekusi';
  total?: number;
  baris: Record<string, unknown>[];
  terakhir?: boolean;
}) {
  return api<PotongHasil>('/admin/pegawai/import-potong', { method: 'POST', body: JSON.stringify(input) });
}

export function batalPotongPegawai(sesiId: number) {
  return api<{ pesan: string }>(`/admin/pegawai/import-potong/${sesiId}/batal`, { method: 'POST' });
}

export function unduhGalatPegawai(sesiId: number) {
  return downloadFile(`/admin/pegawai/import-potong/${sesiId}/galat`, 'galat-import-pegawai.csv');
}
