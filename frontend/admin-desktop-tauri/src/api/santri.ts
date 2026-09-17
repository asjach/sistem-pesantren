import { api, apiUpload, downloadFile } from './client';
import type { Paginate } from './master';

// ---------- Buku Induk santri (identitas murni) + keanggotaan per lembaga ----------

/** Keanggotaan santri di satu lembaga (`lembaga_santri`). */
export interface LembagaSantri {
  id: number;
  santri_id: number;
  lembaga_id: number;
  nis_lokal: string | null;
  nis_kemenag: string | null;
  is_active: boolean;
  tgl_mulai: string | null;
  tgl_selesai: string | null;
  lembaga?: { id: number; nama: string; kode: string | null; nsm?: string | null } | null;
  santri?: { id: number; nama_lengkap: string; jk: string | null } | null;
}

/** Daftar keanggotaan lintas santri (halaman Keanggotaan terpusat). */
export function listKeanggotaan(params: {
  lembaga_id?: number | null;
  is_active?: boolean | null;
  tanpa_nis?: boolean;
  search?: string;
  sort?: string[];
  arah?: 'naik' | 'turun';
  page?: number;
  per_page?: number;
} = {}) {
  const q = new URLSearchParams();
  if (params.lembaga_id != null) q.set('lembaga_id', String(params.lembaga_id));
  if (params.is_active != null) q.set('is_active', params.is_active ? '1' : '0');
  if (params.tanpa_nis) q.set('tanpa_nis', '1');
  if (params.search) q.set('search', params.search);
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  q.set('page', String(params.page ?? 1));
  q.set('per_page', String(params.per_page ?? 50));
  return api<Paginate<LembagaSantri>>(`/admin/lembaga-santri?${q.toString()}`);
}

/** Identitas santri — tanpa kolom relasional (lembaga/kelas ada di keanggotaan/riwayat). */
export interface Santri {
  id: number;
  nama_lengkap: string;
  nama_singkat: string | null;
  nik: string | null;
  nisn: string | null;
  tmp_lahir: string | null;
  tgl_lahir: string | null;
  jk: string | null;
  tipe_santri: string | null;
  status_global: boolean;
  foto_url?: string | null;
  lembaga_aktif?: LembagaSantri[];
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

export function listSantri(
  params: { status_global?: boolean; lembaga_id?: number; q?: string; sort?: string[]; arah?: 'naik' | 'turun'; page?: number; per_page?: number } = {},
) {
  const q = new URLSearchParams();
  if (params.status_global !== undefined) q.set('status_global', params.status_global ? '1' : '0');
  if (params.lembaga_id) q.set('lembaga_id', String(params.lembaga_id));
  if (params.q) q.set('q', params.q);
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  q.set('page', String(params.page ?? 1));
  if (params.per_page != null) q.set('per_page', String(params.per_page));
  return api<Paginate<Santri>>(`/admin/santri?${q.toString()}`);
}

export function createSantri(input: Record<string, string | number | null>) {
  return api<{ pesan: string; data: Santri }>('/admin/santri', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateSantri(id: number, changes: Record<string, string | number | null>) {
  return api<{ pesan: string; data: Santri }>(`/admin/santri/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  });
}

/** Unduh template import identitas (buku induk). `lembagaId` hanya lingkup kamus dropdown. */
export function unduhTemplateSantri(lembagaId?: number) {
  const q = lembagaId ? `?lembaga_id=${lembagaId}` : '';
  return downloadFile(`/admin/santri/import-template${q}`, 'template-import-santri.xlsx');
}

export function importSantri(input: { file: File }) {
  const fd = new FormData();
  fd.set('file', input.file);
  return apiUpload<{ pesan: string; errors?: ImportError[] }>('/admin/santri/import-lengkap', fd);
}

export interface ImportError {
  row: number;
  attribute: string;
  errors: string[];
}

export interface ImportPeriksa {
  pesan: string;
  siap_import: boolean;
  ringkasan: { baris_diproses: number; baris_valid: number; baris_gagal: number; baris_diperbarui?: number; baris_tanpa_keanggotaan?: number };
  errors: ImportError[];
}

/** Validasi file import tanpa menulis (dry-run) — sumber tombol "Periksa". */
export function periksaImportSantri(input: { file: File }) {
  const fd = new FormData();
  fd.set('file', input.file);
  return apiUpload<ImportPeriksa>('/admin/santri/import-periksa', fd);
}

// ---------- Import gabungan siswa (identitas + keanggotaan) ----------

/** Unduh template gabungan: blok keanggotaan dulu, lalu seluruh kolom profil. */
export function unduhTemplateSantriGabungan() {
  return downloadFile('/admin/santri/import-template-gabungan', 'template-import-siswa-gabungan.xlsx');
}

/** Unduh data existing (pra-isi santri_id) untuk round-trip update. Tanpa argumen = semua lingkup. */
export function unduhDataSantriGabungan(ids?: number[]) {
  const q = ids?.length ? `?${ids.map((id) => `lembaga_id[]=${id}`).join('&')}` : '';
  return downloadFile(
    `/admin/santri/data-gabungan${q}`,
    ids?.length === 1 ? `data-siswa-${ids[0]}.xlsx` : 'data-siswa-pilihan.xlsx',
  );
}

export function importSantriGabungan(input: { file: File }) {
  const fd = new FormData();
  fd.set('file', input.file);
  return apiUpload<{ pesan: string; errors?: ImportError[] }>('/admin/santri/import-gabungan', fd);
}

/** Validasi file gabungan tanpa menulis (dry-run). */
export function periksaImportSantriGabungan(input: { file: File }) {
  const fd = new FormData();
  fd.set('file', input.file);
  return apiUpload<ImportPeriksa>('/admin/santri/import-periksa-gabungan', fd);
}

// ---------- Keanggotaan per lembaga ----------

export function listLembagaSantri(santriId: number) {
  return api<{ pesan: string; data: LembagaSantri[] }>(`/admin/santri/${santriId}/lembaga`);
}

export function createLembagaSantri(
  santriId: number,
  input: { lembaga_id: number; nis_lokal?: string | null; tgl_mulai?: string | null },
) {
  return api<{ pesan: string; data: LembagaSantri }>(`/admin/santri/${santriId}/lembaga`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateLembagaSantri(
  id: number,
  input: { nis_lokal?: string | null; is_active?: boolean; tgl_mulai?: string | null; tgl_selesai?: string | null },
) {
  return api<{ pesan: string; data: LembagaSantri }>(`/admin/lembaga-santri/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/** Generate NIS Kemenag manual: NSM(12) + YY tahun diterima + 4 digit akhir NIS lokal. */
export function generateNisk(id: number) {
  return api<{ pesan: string; data: LembagaSantri }>(`/admin/lembaga-santri/${id}/generate-nisk`, {
    method: 'POST',
  });
}

// ---------- Samakan NIS paket MI↔MD ----------

export interface SamakanNisRincian {
  santri_id: number;
  nama: string;
  status: 'disamakan' | 'beda' | 'tabrakan';
  dari?: string;
  ke?: string;
  nis?: string;
  mi?: string;
  md?: string;
}

export interface SamakanNisHasil {
  pesan: string;
  periksa: boolean;
  ringkasan: { kandidat: number; disamakan: number; beda: number; tabrakan: number };
  rincian: SamakanNisRincian[];
}

/** Pratinjau (periksa=true, tanpa menulis) atau eksekusi penyamaan NIS MI↔MD. */
export function samakanNis(periksa: boolean) {
  return api<SamakanNisHasil>('/admin/santri/samakan-nis', {
    method: 'POST',
    body: JSON.stringify({ periksa }),
  });
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
