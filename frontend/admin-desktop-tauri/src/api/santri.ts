import { api, apiUpload } from './client';
import type { Paginate } from './master';

// ---------- Santri (101: master profil + import + foto/dokumen) ----------

export interface Santri {
  id: number;
  lembaga_id: number;
  kelas_id: number | null;
  nama_lengkap: string;
  nama_singkat: string | null;
  nik: string | null;
  nisn: string | null;
  nis: string | null;
  tmp_lahir: string | null;
  tgl_lahir: string | null;
  jk: string | null;
  tipe_santri: string | null;
  status_global: boolean;
  foto_url?: string | null;
  lembaga?: { id: number; nama: string; kode: string | null } | null;
  kelas?: { id: number; nama_kelas: string } | null;
}

export interface DokumenSantri {
  id: number;
  santri_id: number | null;
  psb_calon_santri_id: number | null;
  jenis_dokumen_santri: string;
  path_file: string | null;
  status_verifikasi: 'menunggu' | 'valid' | 'ditolak';
  tidak_memiliki: boolean;
  catatan: string | null;
  file_url?: string;
}

export function listSantri(params: { status_global?: boolean; page?: number; per_page?: number } = {}) {
  const q = new URLSearchParams();
  if (params.status_global !== undefined) q.set('status_global', params.status_global ? '1' : '0');
  q.set('page', String(params.page ?? 1));
  if (params.per_page) q.set('per_page', String(params.per_page));
  return api<Paginate<Santri>>(`/admin/santri?${q.toString()}`);
}

export function updateSantri(id: number, changes: Record<string, string | number | null>) {
  return api<{ pesan: string; data: Santri }>(`/admin/santri/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  });
}

export function importSantri(input: { tahun_ajaran_id: number; lembaga_id?: number; file: File }) {
  const fd = new FormData();
  fd.set('tahun_ajaran_id', String(input.tahun_ajaran_id));
  if (input.lembaga_id) fd.set('lembaga_id', String(input.lembaga_id));
  fd.set('file', input.file);
  return apiUpload<{ pesan: string; errors?: { row: number; attribute: string; errors: string[] }[] }>(
    '/admin/santri/import-lengkap',
    fd,
  );
}

export function uploadFotoSantri(santriId: number, file: File) {
  const fd = new FormData();
  fd.set('foto', file);
  return apiUpload<{ pesan: string; data: Santri }>(`/admin/santri/${santriId}/foto`, fd);
}

export function uploadDokumenSantri(
  santriId: number,
  input: { jenis_dokumen_santri: string; file: File; catatan?: string },
) {
  const fd = new FormData();
  fd.set('jenis_dokumen_santri', input.jenis_dokumen_santri);
  fd.set('file', input.file);
  if (input.catatan) fd.set('catatan', input.catatan);
  return apiUpload<{ pesan: string; data: DokumenSantri }>(`/admin/santri/${santriId}/dokumen`, fd);
}

export function listDokumenSantri(santriId: number) {
  return api<{ pesan: string; data: DokumenSantri[] }>(`/admin/santri/${santriId}/dokumen`);
}

export function tidakMemilikiDokumen(santriId: number, dokumenId: number, tidakMemiliki: boolean) {
  return api<{ pesan: string; data: DokumenSantri }>(`/admin/santri/${santriId}/dokumen/${dokumenId}/tidak-memiliki`, {
    method: 'POST',
    body: JSON.stringify({ tidak_memiliki: tidakMemiliki }),
  });
}
