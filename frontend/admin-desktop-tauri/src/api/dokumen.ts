import { api, apiUpload, downloadFile } from './client';
import { appendQueryParam, type ScalarOrArray } from './query';
import type { Paginate } from './master';
import type { DataExistingPayload } from '@/lib/excelDataExisting';
import type { PotongHasil } from '@/components/ImportBertahapUmumDialog';

// ---------- Tiga halaman dokumen (santri / pegawai-guru / lembaga) ----------

export type TipeDokumen = 'santri' | 'pegawai' | 'lembaga';

export interface DokumenRow {
  id: number;
  tipe: TipeDokumen;
  jenis_dokumen: string;
  pemilik: string | null;
  nis_lokal?: string | null;
  lembaga_jenjang?: string | null;
  lembaga_nama?: string | null;
  nama_file: string | null;
  status_verifikasi: 'menunggu' | 'valid' | 'ditolak';
  tidak_memiliki?: boolean;
  catatan: string | null;
  unduh_url: string;
}

const PER_TIPE: Record<TipeDokumen, { lihat: string; tambah: string; ubah: string; hapus: string }> = {
  santri: { lihat: 'dokumen_santri.lihat', tambah: 'dokumen_santri.tambah', ubah: 'dokumen_santri.ubah', hapus: 'dokumen_santri.hapus' },
  pegawai: { lihat: 'dokumen_pegawai.lihat', tambah: 'dokumen_pegawai.tambah', ubah: 'dokumen_pegawai.ubah', hapus: 'dokumen_pegawai.hapus' },
  lembaga: { lihat: 'dokumen_lembaga.lihat', tambah: 'dokumen_lembaga.tambah', ubah: 'dokumen_lembaga.ubah', hapus: 'dokumen_lembaga.hapus' },
};

export function izinDokumen(tipe: TipeDokumen) {
  return PER_TIPE[tipe];
}

function base(tipe: TipeDokumen): string {
  return `/admin/dokumen/${tipe}`;
}

export function listDokumen(tipe: TipeDokumen, params: {
  jenjang?: ScalarOrArray<string> | null;
  q?: string;
  status_verifikasi?: string;
  santri_id?: number;
  page?: number;
  per_page?: number;
  signal?: AbortSignal;
} = {}) {
  const q = new URLSearchParams();
  appendQueryParam(q, 'jenjang', params.jenjang);
  if (params.q) q.set('q', params.q);
  if (params.status_verifikasi) q.set('status_verifikasi', params.status_verifikasi);
  if (params.santri_id != null) q.set('santri_id', String(params.santri_id));
  q.set('page', String(params.page ?? 1));
  q.set('per_page', String(params.per_page ?? 50));
  return api<Paginate<DokumenRow>>(`${base(tipe)}?${q.toString()}`, { signal: params.signal });
}

export function simpanDokumen(tipe: TipeDokumen, input: Record<string, unknown>, file?: File) {
  if (file) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined && v !== null) fd.set(k, String(v));
    }
    fd.set('file', file);
    return apiUpload<{ pesan: string; data: DokumenRow }>(base(tipe), fd);
  }
  return api<{ pesan: string; data: DokumenRow }>(base(tipe), { method: 'POST', body: JSON.stringify(input) });
}

export function ubahDokumen(tipe: TipeDokumen, id: number, input: Record<string, unknown>) {
  return api<{ pesan: string; data: DokumenRow }>(`${base(tipe)}/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function unggahBerkasDokumen(tipe: TipeDokumen, id: number, file: File) {
  const fd = new FormData();
  fd.set('file', file);
  return apiUpload<{ pesan: string; data: DokumenRow }>(`${base(tipe)}/${id}/unggah`, fd);
}

export function hapusDokumen(tipe: TipeDokumen, id: number) {
  return api<{ pesan: string }>(`${base(tipe)}/${id}`, { method: 'DELETE' });
}

export function unduhBerkasDokumen(tipe: TipeDokumen, id: number, fallback: string) {
  return downloadFile(`${base(tipe)}/${id}/unduh`, fallback);
}

// ---------- Import daftar dokumen (potongan JSON bertahap) ----------

export const KOLOM_IMPORT_DOKUMEN: Record<TipeDokumen, string[]> = {
  santri: ['nis_lokal', 'jenjang', 'jenis_dokumen', 'status_verifikasi', 'tidak_memiliki', 'catatan'],
  pegawai: ['pegawai_id', 'nipp', 'nama_lengkap', 'jenjang', 'jenis_dokumen', 'status_verifikasi', 'catatan'],
  lembaga: ['jenjang', 'jenis_dokumen', 'status_verifikasi', 'catatan'],
};

export function unduhTemplateDokumen(tipe: TipeDokumen) {
  return downloadFile(`${base(tipe)}/import-template`, `template-import-dokumen-${tipe}.xlsx`);
}

export function importDokumenPotong(tipe: TipeDokumen, input: {
  sesi_id?: number;
  mode: 'periksa' | 'eksekusi';
  total?: number;
  baris: Record<string, unknown>[];
  terakhir?: boolean;
}) {
  return api<PotongHasil>(`${base(tipe)}/import-potong`, { method: 'POST', body: JSON.stringify(input) });
}

export function batalPotongDokumen(tipe: TipeDokumen, sesiId: number) {
  return api<{ pesan: string }>(`${base(tipe)}/import-potong/${sesiId}/batal`, { method: 'POST' });
}

export function unduhGalatDokumen(tipe: TipeDokumen, sesiId: number) {
  return downloadFile(`${base(tipe)}/import-potong/${sesiId}/galat`, `galat-import-dokumen-${tipe}.csv`);
}
