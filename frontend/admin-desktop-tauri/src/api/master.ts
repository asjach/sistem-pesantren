import { api } from './client';
import { PER_PAGE_DEFAULT } from '@/prefs';

export interface Lembaga {
  id: number;
  nama: string;
  kode: string | null;
  kelompok_psb?: 'combo_mi_md' | 'eksklusif' | null;
  is_seleksi?: boolean | null;
  parent?: { id: number; nama: string; kode: string | null } | null;
}

export interface Paginate<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export function listLembaga(params: { search?: string; page?: number; per_page?: number } = {}) {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  q.set('page', String(params.page ?? 1));
  q.set('per_page', String(params.per_page ?? PER_PAGE_DEFAULT));
  return api<Paginate<Lembaga>>(`/admin/lembaga?${q.toString()}`);
}

export interface LembagaInput {
  parent_id?: number | null;
  nama: string;
  nama_singkat?: string;
  kode?: string;
  mudir_am?: string;
  jenjang?: string;
  status?: 'negeri' | 'swasta';
  npsn?: string;
  nsm?: string;
  is_active?: boolean;
  kelompok_psb?: 'combo_mi_md' | 'eksklusif';
  is_seleksi?: boolean;
}

export function createLembaga(input: LembagaInput) {
  return api<Lembaga>('/admin/lembaga', { method: 'POST', body: JSON.stringify(input) });
}

export function updateLembaga(id: number, input: Partial<LembagaInput>) {
  return api<Lembaga>(`/admin/lembaga/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

export function deleteLembaga(id: number) {
  return api<{ message: string }>(`/admin/lembaga/${id}`, { method: 'DELETE' });
}

export interface Ringkasan {
  lembaga: number;
  pengguna: number;
  tahun_ajaran_aktif: number;
  kelas: number;
  tahun_aktif: { id: number; lembaga_id: number; nama: string; lembaga?: { id: number; nama: string } }[];
  santri: null;
  tagihan_terbuka: null;
  antrean_psb: null;
}

export function ringkasan(lembaga_id?: number) {
  const q = lembaga_id ? `?lembaga_id=${lembaga_id}` : '';
  return api<Ringkasan>(`/dashboard/ringkasan${q}`);
}

// ---------- Referensi (004: kamus global + shadow per lembaga) ----------

export interface ReferensiRow {
  id: number;
  lembaga_id: number | null;
  /** Kamus bebas memakai `nama`; status memakai `kode` + `label`. */
  nama?: string | null;
  kode?: string | null;
  label?: string | null;
  urutan: number;
  is_active: boolean;
  is_aktif_bawaan?: boolean | null;
  terminal_ke?: string | null;
}

export interface ReferensiInput {
  lembaga_id?: number | null;
  nama?: string;
  kode?: string;
  label?: string;
  urutan?: number;
}

export function referensiTypes() {
  return api<string[]>('/admin/referensi/types');
}

export function referensiList(tipe: string, lembaga_id?: number) {
  const q = lembaga_id ? `?lembaga_id=${lembaga_id}` : '';
  return api<ReferensiRow[]>(`/admin/referensi/${encodeURIComponent(tipe)}${q}`);
}

export function createReferensi(tipe: string, input: ReferensiInput) {
  return api<ReferensiRow>(`/admin/referensi/${encodeURIComponent(tipe)}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateReferensi(tipe: string, id: number, input: Omit<ReferensiInput, 'lembaga_id' | 'kode'>) {
  return api<ReferensiRow>(`/admin/referensi/${encodeURIComponent(tipe)}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deleteReferensi(tipe: string, id: number, lembaga_id?: number) {
  const q = lembaga_id ? `?lembaga_id=${lembaga_id}` : '';
  return api<{ pesan: string }>(`/admin/referensi/${encodeURIComponent(tipe)}/${id}${q}`, {
    method: 'DELETE',
  });
}

// ---------- Tahun ajaran (004, FB-004-01) ----------

export interface TahunAjaran {
  id: number;
  lembaga_id: number;
  nama: string;
  tanggal_mulai: string | null;
  tanggal_selesai: string | null;
  is_aktif: boolean;
  lembaga?: { id: number; nama: string; kode: string | null };
}

export function listTahunAjaran(params: { search?: string; lembaga_id?: number; page?: number; per_page?: number } = {}) {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.lembaga_id) q.set('lembaga_id', String(params.lembaga_id));
  q.set('page', String(params.page ?? 1));
  q.set('per_page', String(params.per_page ?? PER_PAGE_DEFAULT));
  return api<Paginate<TahunAjaran>>(`/admin/tahun-ajaran?${q.toString()}`);
}

export function createTahunAjaran(input: {
  lembaga_id: number;
  nama: string;
  tanggal_mulai?: string;
  tanggal_selesai?: string;
}) {
  return api<TahunAjaran>('/admin/tahun-ajaran', { method: 'POST', body: JSON.stringify(input) });
}

export function updateTahunAjaran(
  id: number,
  input: { nama?: string; tanggal_mulai?: string | null; tanggal_selesai?: string | null },
) {
  return api<TahunAjaran>(`/admin/tahun-ajaran/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deleteTahunAjaran(id: number) {
  return api<{ message: string }>(`/admin/tahun-ajaran/${id}`, { method: 'DELETE' });
}

export function setAktifTahunAjaran(id: number) {
  return api<TahunAjaran>(`/admin/tahun-ajaran/${id}/set-aktif`, { method: 'POST' });
}

// ---------- Kelas (004, FB-004-01) ----------

export interface Kelas {
  id: number;
  lembaga_id: number;
  tahun_ajaran_id: number;
  tingkat: string | null;
  nama_kelas: string;
  kapasitas: number | null;
  lembaga?: { id: number; nama: string };
  tahun_ajaran?: { id: number; nama: string } | null;
  tahunAjaran?: { id: number; nama: string } | null;
}

export function listKelas(
  params: { search?: string; lembaga_id?: number; tahun_ajaran_id?: number; tingkat?: string; page?: number; per_page?: number } = {},
) {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.lembaga_id) q.set('lembaga_id', String(params.lembaga_id));
  if (params.tahun_ajaran_id) q.set('tahun_ajaran_id', String(params.tahun_ajaran_id));
  if (params.tingkat) q.set('tingkat', params.tingkat);
  q.set('page', String(params.page ?? 1));
  q.set('per_page', String(params.per_page ?? PER_PAGE_DEFAULT));
  return api<Paginate<Kelas>>(`/admin/kelas?${q.toString()}`);
}

export function createKelas(input: {
  lembaga_id: number;
  tahun_ajaran_id: number;
  tingkat?: string;
  nama_kelas: string;
  kapasitas?: number;
}) {
  return api<Kelas>('/admin/kelas', { method: 'POST', body: JSON.stringify(input) });
}

export function updateKelas(
  id: number,
  input: { tingkat?: string | null; nama_kelas?: string; kapasitas?: number | null },
) {
  return api<Kelas>(`/admin/kelas/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

export function deleteKelas(id: number) {
  return api<{ message: string }>(`/admin/kelas/${id}`, { method: 'DELETE' });
}

// ---------- Pos keuangan (103 master, kode_pos unik global) ----------

export type TipePos = 'bulanan' | 'sekali_bayar' | 'semesteran' | 'tahunan';

export interface PosKeuangan {
  id: number;
  kode_pos: string;
  nama_pos: string;
  tipe: TipePos;
  keterangan: string | null;
}

export function listPos(params: { search?: string; page?: number; per_page?: number } = {}) {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  q.set('page', String(params.page ?? 1));
  q.set('per_page', String(params.per_page ?? PER_PAGE_DEFAULT));
  return api<Paginate<PosKeuangan>>(`/admin/pos-keuangan?${q.toString()}`);
}

export function createPos(input: { kode_pos: string; nama_pos: string; tipe: TipePos; keterangan?: string }) {
  return api<PosKeuangan>('/admin/pos-keuangan', { method: 'POST', body: JSON.stringify(input) });
}

export function updatePos(id: number, input: { nama_pos?: string; tipe?: TipePos; keterangan?: string | null }) {
  return api<PosKeuangan>(`/admin/pos-keuangan/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

export function deletePos(id: number) {
  return api<{ message: string }>(`/admin/pos-keuangan/${id}`, { method: 'DELETE' });
}

// ---------- Tarif biaya (103 master, triple FK) ----------

export type TipeSantriTarif = 'semua' | 'asrama' | 'non_asrama';

export interface TarifBiaya {
  id: number;
  pos_keuangan_id: number;
  lembaga_id: number;
  tahun_ajaran_id: number;
  tipe_santri: TipeSantriTarif;
  nominal: string | number;
  nominal_paket: string | number | null;
  pos?: { id: number; kode_pos: string; nama_pos: string };
  lembaga?: { id: number; nama: string; kode: string | null };
  tahun_ajaran?: { id: number; nama: string } | null;
  tahunAjaran?: { id: number; nama: string } | null;
}

export function listTarif(
  params: { lembaga_id?: number; pos_keuangan_id?: number; tahun_ajaran_id?: number; page?: number; per_page?: number } = {},
) {
  const q = new URLSearchParams();
  if (params.lembaga_id) q.set('lembaga_id', String(params.lembaga_id));
  if (params.pos_keuangan_id) q.set('pos_keuangan_id', String(params.pos_keuangan_id));
  if (params.tahun_ajaran_id) q.set('tahun_ajaran_id', String(params.tahun_ajaran_id));
  q.set('page', String(params.page ?? 1));
  q.set('per_page', String(params.per_page ?? PER_PAGE_DEFAULT));
  return api<Paginate<TarifBiaya>>(`/admin/tarif-biaya?${q.toString()}`);
}

export function createTarif(input: {
  pos_keuangan_id: number;
  lembaga_id: number;
  tahun_ajaran_id: number;
  tipe_santri?: TipeSantriTarif;
  nominal: number;
  nominal_paket?: number | null;
}) {
  return api<TarifBiaya>('/admin/tarif-biaya', { method: 'POST', body: JSON.stringify(input) });
}

export function updateTarif(id: number, input: { nominal?: number; nominal_paket?: number | null }) {
  return api<TarifBiaya>(`/admin/tarif-biaya/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

export function deleteTarif(id: number) {
  return api<{ message: string }>(`/admin/tarif-biaya/${id}`, { method: 'DELETE' });
}
