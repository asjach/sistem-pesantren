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
  'ditolak',
  'waiting_list',
] as const;

export type PsbStatus = (typeof PSB_STATUS)[number];

export interface PsbCalon {
  id: number;
  no_pendaftaran: string | null;
  nik: string;
  nama_lengkap: string;
  jk: string | null;
  tgl_lahir: string | null;
  tipe_santri: string | null;
  status_pendaftaran: PsbStatus;
  paket_grup_id: string | null;
  email_ortu: string | null;
  telp_ortu: string | null;
  tanggal_daftar: string | null;
  lembaga_id: number;
  gelombang_id: number;
  catatan_admin: string | null;
  lembaga_tujuan?: { id: number; nama: string; kode: string | null } | null;
  gelombang?: { id: number; nama: string } | null;
}

export function listAntrean(params: { status: string; lembaga_id?: number; page?: number; per_page?: number }) {
  const q = new URLSearchParams();
  q.set('status', params.status);
  if (params.lembaga_id) q.set('lembaga_id', String(params.lembaga_id));
  q.set('page', String(params.page ?? 1));
  if (params.per_page) q.set('per_page', String(params.per_page));
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

export function accCalon(id: number) {
  return api<{ pesan: string; data: unknown }>(`/psb/${id}/acc-daftar-ulang`, { method: 'POST' });
}

export function tolakCalon(id: number, catatan?: string) {
  return api<{ pesan: string; data: PsbCalon }>(`/psb/${id}/tolak`, {
    method: 'POST',
    body: JSON.stringify({ catatan }),
  });
}

export function promosiCalon(id: number) {
  return api<{ pesan: string; data: PsbCalon }>(`/psb/${id}/promosi`, { method: 'POST' });
}

export function accPaket(grup: string) {
  return api<{ pesan: string; data: unknown }>(`/psb/paket/${encodeURIComponent(grup)}/acc`, { method: 'POST' });
}

export function verifikasiPaket(grup: string) {
  return api<{ pesan: string; data: unknown }>(`/psb/paket/${encodeURIComponent(grup)}/verifikasi`, { method: 'POST' });
}

export function tolakPaket(grup: string, catatan?: string) {
  return api<{ pesan: string }>(`/psb/paket/${encodeURIComponent(grup)}/tolak`, {
    method: 'POST',
    body: JSON.stringify({ catatan }),
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
  tahun_ajaran_id: number;
  nama: string;
  tgl_buka: string | null;
  tgl_tutup: string | null;
  is_aktif: boolean;
  tahun_ajaran?: { id: number; nama: string } | null;
}

export function listGelombangPsb() {
  return api<{ pesan: string; data: PsbGelombang[] }>('/psb/gelombang');
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
  lembaga_id: number;
  jenis_dokumen_santri: string;
  is_wajib: boolean;
}

export function listDokumenWajib(lembagaId: number) {
  return api<{ pesan: string; data: DokumenWajib[] }>(`/admin/dokumen-wajib?lembaga_id=${lembagaId}`);
}

export function simpanDokumenWajib(input: { lembaga_id: number; jenis_dokumen_santri: string; is_wajib?: boolean }) {
  return api<{ pesan: string; data: DokumenWajib }>('/admin/dokumen-wajib', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function hapusDokumenWajib(id: number) {
  return api<{ pesan: string }>(`/admin/dokumen-wajib/${id}`, { method: 'DELETE' });
}
