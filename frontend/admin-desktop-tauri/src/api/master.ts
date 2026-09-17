import { api, downloadFile } from './client';
import { PER_PAGE_DEFAULT } from '@/prefs';

export interface Lembaga {
  id: number;
  parent_id?: number | null;
  nama: string;
  nama_singkat?: string | null;
  kode: string | null;
  mudir_am?: string | null;
  jenjang?: string | null;
  status?: 'negeri' | 'swasta' | null;
  npsn?: string | null;
  nsm?: string | null;
  npwp?: string | null;
  no_izin_operasional?: string | null;
  tgl_izin?: string | null;
  no_sk_pendirian?: string | null;
  tgl_sk_pendirian?: string | null;
  tahun_berdiri?: number | null;
  no_sk_kemenkumham?: string | null;
  akreditasi?: 'A' | 'B' | 'C' | 'belum' | null;
  tgl_akreditasi?: string | null;
  penyelenggara?: string | null;
  provinsi?: string | null;
  kab_kota?: string | null;
  kecamatan?: string | null;
  desa?: string | null;
  rt?: string | null;
  rw?: string | null;
  kode_pos?: string | null;
  alamat?: string | null;
  lintang?: number | null;
  bujur?: number | null;
  telepon?: string | null;
  email?: string | null;
  website?: string | null;
  logo_url?: string | null;
  waktu_belajar?: 'pagi' | 'siang' | 'pagi_siang' | null;
  mode_rapor?: 'terpisah' | 'digabung' | null;
  template_rapor?: string | null;
  is_active?: boolean | null;
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

export function listLembaga(params: { search?: string; sort?: string[]; arah?: 'naik' | 'turun'; page?: number; per_page?: number } = {}) {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  q.set('page', String(params.page ?? 1));
  q.set('per_page', String(params.per_page ?? PER_PAGE_DEFAULT));
  return api<Paginate<Lembaga>>(`/admin/lembaga?${q.toString()}`);
}

export interface LembagaInput {
  parent_id?: number | null;
  nama: string;
  nama_singkat?: string | null;
  kode?: string | null;
  mudir_am?: string | null;
  jenjang?: string | null;
  status?: 'negeri' | 'swasta' | null;
  npsn?: string | null;
  nsm?: string | null;
  npwp?: string | null;
  no_izin_operasional?: string | null;
  tgl_izin?: string | null;
  no_sk_pendirian?: string | null;
  tgl_sk_pendirian?: string | null;
  tahun_berdiri?: number | string | null;
  no_sk_kemenkumham?: string | null;
  akreditasi?: 'A' | 'B' | 'C' | 'belum' | null;
  tgl_akreditasi?: string | null;
  penyelenggara?: string | null;
  provinsi?: string | null;
  kab_kota?: string | null;
  kecamatan?: string | null;
  desa?: string | null;
  rt?: string | null;
  rw?: string | null;
  kode_pos?: string | null;
  alamat?: string | null;
  lintang?: number | string | null;
  bujur?: number | string | null;
  telepon?: string | null;
  email?: string | null;
  website?: string | null;
  logo_url?: string | null;
  waktu_belajar?: 'pagi' | 'siang' | 'pagi_siang' | null;
  mode_rapor?: 'terpisah' | 'digabung' | null;
  template_rapor?: string | null;
  is_active?: boolean | null;
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
  tahun_aktif: { id: number; lembaga_id: number | null; nama: string; lembaga?: { id: number; nama: string } }[];
  santri: null;
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
  /** Semua tabel ref memakai `nama`; status juga punya `kode` (nilai yang disimpan). */
  nama?: string | null;
  kode?: string | null;
  urutan: number;
  is_active: boolean;
  is_aktif_bawaan?: boolean | null;
  terminal_ke?: string | null;
}

export interface ReferensiInput {
  lembaga_id?: number | null;
  nama?: string;
  kode?: string;
  urutan?: number;
}

export function referensiTypes() {
  return api<string[]>('/admin/referensi/types');
}

export function referensiList(tipe: string, lembaga_id?: number, termasukNonaktif = false) {
  const q = new URLSearchParams();
  if (lembaga_id) q.set('lembaga_id', String(lembaga_id));
  if (termasukNonaktif) q.set('termasuk_nonaktif', '1');
  const qs = q.toString();
  return api<ReferensiRow[]>(`/admin/referensi/${encodeURIComponent(tipe)}${qs ? `?${qs}` : ''}`);
}

/** Pulihkan baris lembaga yang nonaktif ("Tampilkan kembali"). */
export function pulihkanReferensi(tipe: string, id: number) {
  return api<ReferensiRow>(`/admin/referensi/${encodeURIComponent(tipe)}/${id}/pulihkan`, { method: 'POST' });
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
  /** NULL = TA global (berlaku semua lembaga); terisi = baris bayangan lembaga. */
  lembaga_id: number | null;
  nama: string;
  tanggal_mulai: string | null;
  tanggal_selesai: string | null;
  is_aktif: boolean;
  /** Tampil/tidak untuk lembaga (baris bayangan nonaktif = disembunyikan). */
  is_active: boolean;
  lembaga?: { id: number; nama: string; kode: string | null };
}

export function listTahunAjaran(params: {
  search?: string;
  lembaga_id?: number;
  termasuk_nonaktif?: boolean;
  sort?: string[];
  arah?: 'naik' | 'turun';
  page?: number;
  per_page?: number;
} = {}) {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.lembaga_id) q.set('lembaga_id', String(params.lembaga_id));
  if (params.termasuk_nonaktif) q.set('termasuk_nonaktif', '1');
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  q.set('page', String(params.page ?? 1));
  q.set('per_page', String(params.per_page ?? PER_PAGE_DEFAULT));
  return api<Paginate<TahunAjaran>>(`/admin/tahun-ajaran?${q.toString()}`);
}

export function createTahunAjaran(input: {
  nama: string;
  tanggal_mulai?: string;
  tanggal_selesai?: string;
}) {
  return api<TahunAjaran>('/admin/tahun-ajaran', { method: 'POST', body: JSON.stringify(input) });
}

/** Sembunyikan TA global untuk satu lembaga (baris bayangan). */
export function sembunyikanTahunAjaran(id: number, lembaga_id?: number) {
  return api<{ message: string }>(`/admin/tahun-ajaran/${id}/sembunyikan`, {
    method: 'POST',
    body: JSON.stringify(lembaga_id ? { lembaga_id } : {}),
  });
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
  /** Urutan tampil kelas dalam lingkup lembaga + tahun ajaran. */
  urutan: number;
  nama_kelas: string;
  kapasitas: number | null;
  lembaga?: { id: number; nama: string; kode: string | null };
  tahun_ajaran?: { id: number; nama: string } | null;
  tahunAjaran?: { id: number; nama: string } | null;
}

export function listKelas(
  params: { search?: string; lembaga_id?: number; tahun_ajaran_id?: number; tingkat?: string; sort?: string[]; arah?: 'naik' | 'turun'; page?: number; per_page?: number } = {},
) {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.lembaga_id) q.set('lembaga_id', String(params.lembaga_id));
  if (params.tahun_ajaran_id) q.set('tahun_ajaran_id', String(params.tahun_ajaran_id));
  if (params.tingkat) q.set('tingkat', params.tingkat);
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  q.set('page', String(params.page ?? 1));
  q.set('per_page', String(params.per_page ?? PER_PAGE_DEFAULT));
  return api<Paginate<Kelas>>(`/admin/kelas?${q.toString()}`);
}

export interface KelasItem {
  nama_kelas: string;
  tingkat?: string;
  kapasitas?: number;
  urutan?: number;
}

export function createKelas(input: {
  lembaga_id: number;
  tahun_ajaran_id: number;
  tingkat?: string;
  nama_kelas?: string;
  kapasitas?: number;
  urutan?: number;
  items?: KelasItem[];
}) {
  return api<Kelas | { pesan: string; data: Kelas[] }>('/admin/kelas', { method: 'POST', body: JSON.stringify(input) });
}

export function updateKelas(
  id: number,
  input: { tingkat?: string | null; nama_kelas?: string; kapasitas?: number | null; urutan?: number },
) {
  return api<Kelas>(`/admin/kelas/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

export function deleteKelas(id: number) {
  return api<{ message: string }>(`/admin/kelas/${id}`, { method: 'DELETE' });
}

// ---------- Import nama kelas pasangan MI↔MD ----------

export interface ImportNamaRincian {
  nama: string;
  tingkat: string | null;
  status: 'dibuat' | 'dilewati';
}

export interface ImportNamaHasil {
  pesan: string;
  periksa: boolean;
  sumber: { kode: string; tahun_ajaran: string | null };
  tujuan: { kode: string; tahun_ajaran: string | null };
  ringkasan: { sumber: number; dibuat: number; dilewati: number };
  rincian: ImportNamaRincian[];
}

/** Pratinjau (periksa=true) atau eksekusi salin nama+tingkat kelas MI↔MD (ambil/copy). */
export function importNamaKelas(
  input:
    | { lembaga_id: number; tahun_ajaran_id: number; dari_kode: 'MI' | 'MD'; periksa: boolean }
    | { dari_lembaga_id: number; dari_tahun_ajaran_id: number; ke_kode: 'MI' | 'MD'; periksa: boolean },
) {
  return api<ImportNamaHasil>('/admin/kelas/import-nama', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Unduh daftar nama kelas satu lembaga + TA (pasangan import-nama). */
export function unduhDaftarKelas(lembagaId: number, tahunAjaranId: number) {
  return downloadFile(
    `/admin/kelas/export-nama?lembaga_id=${lembagaId}&tahun_ajaran_id=${tahunAjaranId}`,
    `daftar-kelas-${lembagaId}.xlsx`,
  );
}
