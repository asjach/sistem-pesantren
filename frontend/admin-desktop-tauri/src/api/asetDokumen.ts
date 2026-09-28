import { api, apiUpload } from './client';
import type { Paginate } from './master';
import type { AsetDokumen } from '@/lib/template/tipe';

export type { AsetDokumen };

export interface AsetListParams {
  q?: string;
  jenjang?: string | null;
  sort?: string[];
  arah?: 'naik' | 'turun';
  page?: number;
  per_page?: number;
  signal?: AbortSignal;
}

export function listAset(params: AsetListParams = {}) {
  const q = new URLSearchParams();
  if (params.q) q.set('q', params.q);
  if (params.jenjang) q.set('jenjang', params.jenjang);
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  q.set('page', String(params.page ?? 1));
  q.set('per_page', String(params.per_page ?? 50));
  return api<Paginate<AsetDokumen>>(`/admin/aset-dokumen?${q.toString()}`, { signal: params.signal });
}

export function createAset(input: { nama: string; jenjang?: string | null; berkas: File }) {
  const body = new FormData();
  body.append('nama', input.nama);
  if (input.jenjang) body.append('jenjang', input.jenjang);
  body.append('berkas', input.berkas);
  return apiUpload<{ pesan: string; data: AsetDokumen }>('/admin/aset-dokumen', body).then((r) => r.data);
}

export function deleteAset(id: number) {
  return api<{ pesan: string }>(`/admin/aset-dokumen/${id}`, { method: 'DELETE' });
}
