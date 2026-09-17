import { api, apiUpload, downloadFile } from './client';
import type { Paginate } from './master';
import type { DokumenSantri } from './santri';

// ---------- PSB (100: antrean, verifikasi/seleksi/ACC, dokumen) ----------

export const PSB_STATUS = [
  'baru',
  'terverifikasi',
  'lolos',
  'tidak_lolos',
  'pemberkasan',
  'ajukan_daftar_ulang',
  'daftar_ulang',
  'mengundurkan_diri',
  'ditolak',
  'waiting_list',
] as const;

export type PsbStatus = (typeof PSB_STATUS)[number];

export interface PsbCalonLembaga {
  id: number;
  lembaga_id: number;
  peran: 'primer' | 'anggota' | string;
  masuk_tingkat: string | null;
  lembaga?: { id: number; nama: string; kode: string | null } | null;
}

export interface PsbCalon {
  id: number;
  no_pendaftaran: string | null;
  nik: string;
  nama_lengkap: string;
  jk: string | null;
  tgl_lahir: string | null;
  tipe_santri: string | null;
  status_pendaftaran: PsbStatus;
  email_ortu: string | null;
  telp_ortu: string | null;
  tanggal_daftar: string | null;
  lembaga_id: number;
  gelombang_id: number;
  catatan_admin: string | null;
  lembaga_tujuan?: { id: number; nama: string; kode: string | null } | null;
  lembaga_detail?: PsbCalonLembaga[];
  gelombang?: { id: number; nama: string } | null;
  butuh_seleksi?: boolean;
  butuh_pemberkasan?: boolean;
  deleted_at?: string | null;
}

export function listAntrean(params: { status: string; lembaga_id?: number; sort?: string[]; arah?: 'naik' | 'turun'; page?: number; per_page?: number; terhapus?: boolean }) {
  const q = new URLSearchParams();
  q.set('status', params.status);
  if (params.lembaga_id) q.set('lembaga_id', String(params.lembaga_id));
  if (params.terhapus) q.set('terhapus', '1');
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  q.set('page', String(params.page ?? 1));
  if (params.per_page != null) q.set('per_page', String(params.per_page));
  return api<{ pesan: string; data: Paginate<PsbCalon>; badge: Record<string, number> }>(
    `/psb/antrean-daftar-ulang?${q.toString()}`,
  );
}

export function verifikasiCalon(id: number) {
  return api<{ pesan: string; data: PsbCalon }>(`/psb/${id}/verifikasi`, { method: 'POST' });
}

export function seleksiCalon(id: number, input: { lolos: boolean; catatan?: string }) {
  return api<{ pesan: string; data: PsbCalon }>(`/psb/${id}/seleksi`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function daftarUlangCalon(id: number, input: { lolos?: boolean; catatan?: string } = {}) {
  return api<{ pesan: string; data: PsbCalon }>(`/psb/${id}/daftar-ulang`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function undurDiriCalon(id: number, catatan?: string) {
  return api<{ pesan: string; data: PsbCalon }>(`/psb/${id}/undur-diri`, {
    method: 'POST',
    body: JSON.stringify({ catatan }),
  });
}

export function batalkanFaseCalon(id: number, catatan?: string) {
  return api<{ pesan: string; data: PsbCalon }>(`/psb/${id}/batalkan-fase`, {
    method: 'POST',
    body: JSON.stringify({ catatan }),
  });
}

export function accCalon(id: number, nis?: string) {
  return api<{ pesan: string; data: unknown }>(`/psb/${id}/acc-daftar-ulang`, {
    method: 'POST',
    body: JSON.stringify({ nis: nis || null }),
  });
}

export function hapusCalon(id: number) {
  return api<{ pesan: string }>(`/psb/${id}`, { method: 'DELETE' });
}

export function pulihkanCalon(id: number) {
  return api<{ pesan: string; data: PsbCalon }>(`/psb/${id}/pulihkan`, { method: 'POST' });
}

export function promosiCalon(id: number) {
  return api<{ pesan: string; data: PsbCalon }>(`/psb/${id}/promosi`, { method: 'POST' });
}

export interface BulkGagal {
  id: number;
  no_pendaftaran: string | null;
  nama_lengkap: string | null;
  pesan: string;
}

export interface BulkHasil {
  berhasil: number[];
  gagal: BulkGagal[];
}

export function bulkVerifikasi(ids: number[]) {
  return api<{ pesan: string; data: BulkHasil }>('/psb/bulk/verifikasi', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

export function bulkSeleksi(ids: number[], lolos: boolean, catatan?: string) {
  return api<{ pesan: string; data: BulkHasil }>('/psb/bulk/seleksi', {
    method: 'POST',
    body: JSON.stringify({ ids, lolos, catatan }),
  });
}

export function bulkAcc(ids: number[], nis?: Record<number, string>) {
  const bersih = Object.fromEntries(
    Object.entries(nis ?? {}).filter(([, v]) => (v ?? '').trim() !== ''),
  );
  return api<{ pesan: string; data: BulkHasil }>('/psb/bulk/acc-daftar-ulang', {
    method: 'POST',
    body: JSON.stringify(Object.keys(bersih).length > 0 ? { ids, nis: bersih } : { ids }),
  });
}

export function bulkDaftarUlang(ids: number[], lolos?: boolean, catatan?: string) {
  return api<{ pesan: string; data: BulkHasil }>('/psb/bulk/daftar-ulang', {
    method: 'POST',
    body: JSON.stringify({ ids, ...(lolos !== undefined ? { lolos } : {}), catatan }),
  });
}

export function bulkUndurDiri(ids: number[], catatan?: string) {
  return api<{ pesan: string; data: BulkHasil }>('/psb/bulk/undur-diri', {
    method: 'POST',
    body: JSON.stringify({ ids, catatan }),
  });
}

export function bulkBatalkanFase(ids: number[], catatan?: string) {
  return api<{ pesan: string; data: BulkHasil }>('/psb/bulk/batalkan-fase', {
    method: 'POST',
    body: JSON.stringify({ ids, catatan }),
  });
}

export function bulkHapus(ids: number[]) {
  return api<{ pesan: string; data: BulkHasil }>('/psb/bulk/hapus', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

export function bulkPulihkan(ids: number[]) {
  return api<{ pesan: string; data: BulkHasil }>('/psb/bulk/pulihkan', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

export function importPsb(input: { gelombang_id: number; lembaga_id: number; file: File }) {
  const fd = new FormData();
  fd.set('gelombang_id', String(input.gelombang_id));
  fd.set('lembaga_id', String(input.lembaga_id));
  fd.set('file', input.file);
  return apiUpload<{ pesan: string; errors?: { row: number; attribute: string; errors: string[] }[] }>('/psb/import', fd);
}

export function downloadTemplatePsb() {
  return downloadFile('/psb/import-template', 'template-import-psb.xlsx');
}

export interface PsbGelombang {
  id: number;
  psb_kegiatan_id: number | null;
  nomor: number | null;
  nama: string;
  tgl_buka: string | null;
  tgl_tutup: string | null;
  kegiatan?: { id: number; nama: string; tahun_ajaran_id?: number } | null;
  tahun_ajaran?: { id: number; nama: string } | null;
}

export function listGelombangPsb(params: { kegiatan_id?: number; tahun_ajaran_id?: number } = {}) {
  const q = new URLSearchParams();
  if (params.kegiatan_id) q.set('kegiatan_id', String(params.kegiatan_id));
  if (params.tahun_ajaran_id) q.set('tahun_ajaran_id', String(params.tahun_ajaran_id));
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return api<{ pesan: string; data: PsbGelombang[] }>(`/psb/gelombang${suffix}`);
}

// ---------- Master modul PSB: kegiatan, gelombang, kuota ----------

export interface PsbKegiatan {
  id: number;
  /** Kegiatan PSB se-pesantren: satu per tahun ajaran, kuota per lembaga. */
  tahun_ajaran_id: number;
  nama: string;
  is_aktif: boolean;
  gelombang_count?: number;
  tahun_ajaran?: { id: number; nama: string } | null;
}

export interface PsbGelombangMaster {
  id: number;
  psb_kegiatan_id: number;
  nomor: number;
  nama: string;
  tgl_buka: string | null;
  tgl_tutup: string | null;
  kegiatan?: { id: number; nama: string } | null;
}

export interface PsbKuotaBiayaRow {
  id: number;
  gelombang_id: number;
  lembaga_id: number;
  tipe_santri: 'semua' | 'asrama' | 'non_asrama';
  kuota: number | null;
  paket_tersedia: boolean;
  membutuhkan_seleksi: boolean | null;
  membutuhkan_pemberkasan: boolean;
}

export interface PsbLembagaOpsi {
  id: number;
  kode: string | null;
  nama: string;
  kelompok_psb: string | null;
  is_seleksi: boolean;
  punya_asrama?: boolean;
}

export function listPsbKegiatan() {
  return api<{ pesan: string; data: PsbKegiatan[] }>('/admin/psb/kegiatan');
}

export function createPsbKegiatan(input: { tahun_ajaran_id: number; nama: string; is_aktif?: boolean }) {
  return api<{ pesan: string; data: PsbKegiatan }>('/admin/psb/kegiatan', { method: 'POST', body: JSON.stringify(input) });
}

export function updatePsbKegiatan(id: number, input: { tahun_ajaran_id?: number; nama?: string; is_aktif?: boolean }) {
  return api<{ pesan: string; data: PsbKegiatan }>(`/admin/psb/kegiatan/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

export function deletePsbKegiatan(id: number) {
  return api<{ pesan: string }>(`/admin/psb/kegiatan/${id}`, { method: 'DELETE' });
}

export function createPsbGelombang(input: {
  psb_kegiatan_id: number;
  nama: string;
  tgl_buka: string;
  tgl_tutup: string;
}) {
  return api<{ pesan: string; data: PsbGelombangMaster }>('/admin/psb/gelombang', { method: 'POST', body: JSON.stringify(input) });
}

export function updatePsbGelombang(id: number, input: { nama?: string; tgl_buka?: string; tgl_tutup?: string }) {
  return api<{ pesan: string; data: PsbGelombangMaster }>(`/admin/psb/gelombang/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

export function deletePsbGelombang(id: number) {
  return api<{ pesan: string }>(`/admin/psb/gelombang/${id}`, { method: 'DELETE' });
}

/** Lembaga penerima santri baru (untuk pemilih lembaga lintas tab PSB). */
export function listLembagaPsb() {
  return api<{ pesan: string; data: PsbLembagaOpsi[] }>('/admin/psb/lembaga');
}

export function getKuotaBiaya(gelombangId: number) {
  return api<{
    pesan: string;
    data: { gelombang: PsbGelombangMaster; lembaga: PsbLembagaOpsi[]; rows: PsbKuotaBiayaRow[] };
  }>(`/admin/psb/kuota-biaya?gelombang_id=${gelombangId}`);
}

export interface KuotaBiayaInput {
  gelombang_id: number;
  lembaga_id: number;
  tipe_santri: 'semua' | 'asrama' | 'non_asrama';
  kuota?: number | null;
  paket_tersedia?: boolean;
  membutuhkan_seleksi?: boolean | null;
  membutuhkan_pemberkasan?: boolean;
}

export function upsertKuotaBiaya(input: KuotaBiayaInput) {
  return api<{ pesan: string; data: PsbKuotaBiayaRow }>('/admin/psb/kuota-biaya', { method: 'POST', body: JSON.stringify(input) });
}

export function deleteKuotaBiaya(id: number) {
  return api<{ pesan: string }>(`/admin/psb/kuota-biaya/${id}`, { method: 'DELETE' });
}

export interface PsbCalonInput {
  gelombang_id: number;
  lembaga_id: number;
  tipe_santri: 'asrama' | 'non_asrama';
  nik: string;
  nama_lengkap: string;
  jk?: 'L' | 'P';
  tgl_lahir?: string;
  email_ortu?: string;
  telp_ortu?: string;
  nama_ayah?: string;
  nama_ibu?: string;
  is_pindahan?: boolean;
  masuk_tingkat?: string;
}

/** Input pendaftar manual oleh admin (bukan jalur pendaftaran publik). */
export function createCalonPsb(input: PsbCalonInput) {
  return api<{ pesan: string; data: PsbCalon }>('/psb/calon', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ---------- Dokumen calon + dokumen wajib ----------

export function listDokumenCalon(calonId: number) {
  return api<{ pesan: string; data: DokumenSantri[] }>(`/portal/psb/${calonId}/dokumen`);
}

export function verifikasiDokumen(dokumenId: number, input: { status: 'menunggu' | 'valid' | 'ditolak'; catatan?: string }) {
  return api<{ pesan: string; data: DokumenSantri }>(`/psb/dokumen/${dokumenId}/verifikasi`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface DokumenWajib {
  id: number;
  psb_kegiatan_id: number;
  lembaga_id: number;
  jenis_dokumen_santri: string;
  is_wajib: boolean;
  lembaga?: { id: number; nama: string; kode: string | null } | null;
}

export function listDokumenWajib(kegiatanId: number, lembagaId?: number) {
  const q = new URLSearchParams({ psb_kegiatan_id: String(kegiatanId) });
  if (lembagaId) q.set('lembaga_id', String(lembagaId));
  return api<{ pesan: string; data: DokumenWajib[] }>(`/admin/dokumen-wajib?${q.toString()}`);
}

export function simpanDokumenWajib(input: {
  psb_kegiatan_id: number;
  lembaga_id: number;
  jenis_dokumen_santri: string;
  is_wajib?: boolean;
}) {
  return api<{ pesan: string; data: DokumenWajib }>('/admin/dokumen-wajib', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function hapusDokumenWajib(id: number) {
  return api<{ pesan: string }>(`/admin/dokumen-wajib/${id}`, { method: 'DELETE' });
}
