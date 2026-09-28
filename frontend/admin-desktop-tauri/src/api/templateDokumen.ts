import { api, apiUpload, postBlob } from './client';
import { appendQueryParam, type ScalarOrArray } from './query';
import type { Paginate } from './master';
import type {
  AsetDokumen,
  DefinisiTemplate,
  HasilIsi,
  KatalogNilai,
  JenisTemplate,
  KategoriTemplate,
  TemplateLengkap,
  TemplateRingkas,
  UkuranHalaman,
} from '@/lib/template/tipe';

export type { AsetDokumen, DefinisiTemplate, KatalogNilai, TemplateLengkap, TemplateRingkas };

export interface TemplateListParams {
  q?: string;
  kategori?: KategoriTemplate | null;
  jenis?: JenisTemplate | null;
  aktif?: boolean | null;
  jenjang?: ScalarOrArray<string> | null;
  sort?: string[];
  arah?: 'naik' | 'turun';
  page?: number;
  per_page?: number;
  signal?: AbortSignal;
}

export function listTemplate(params: TemplateListParams = {}) {
  const q = new URLSearchParams();
  if (params.q) q.set('q', params.q);
  if (params.kategori) q.set('kategori', params.kategori);
  if (params.jenis) q.set('jenis', params.jenis);
  if (params.aktif !== null && params.aktif !== undefined) q.set('aktif', params.aktif ? '1' : '0');
  appendQueryParam(q, 'jenjang', params.jenjang);
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  q.set('page', String(params.page ?? 1));
  q.set('per_page', String(params.per_page ?? 50));
  return api<Paginate<TemplateRingkas>>(`/admin/template-dokumen?${q.toString()}`, { signal: params.signal });
}

export function ambilKatalogNilai(signal?: AbortSignal) {
  return api<{ data: KatalogNilai }>('/admin/template-dokumen/katalog', { signal }).then((r) => r.data);
}

export function ambilTemplate(id: number, signal?: AbortSignal) {
  return api<{ data: TemplateLengkap }>(`/admin/template-dokumen/${id}`, { signal }).then((r) => r.data);
}

export interface TemplateInput {
  nama: string;
  kode?: string | null;
  kategori: KategoriTemplate;
  jenis: JenisTemplate;
  deskripsi?: string | null;
  jenjang?: string | null;
  aktif?: boolean;
  definisi?: DefinisiTemplate;
  /** Hanya untuk jenis 'html'; server menolak untuk template PDF. */
  jumlah_halaman?: number;
  halaman?: UkuranHalaman[];
}

export function createTemplate(input: TemplateInput) {
  return api<{ pesan: string; data: TemplateLengkap }>('/admin/template-dokumen', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((r) => r.data);
}

export function updateTemplate(id: number, input: Partial<TemplateInput>) {
  return api<{ pesan: string; data: TemplateLengkap }>(`/admin/template-dokumen/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }).then((r) => r.data);
}

export function deleteTemplate(id: number) {
  return api<{ pesan: string }>(`/admin/template-dokumen/${id}`, { method: 'DELETE' });
}

export function duplikatTemplate(id: number) {
  return api<{ pesan: string; data: TemplateLengkap }>(`/admin/template-dokumen/${id}/duplikat`, {
    method: 'POST',
  }).then((r) => r.data);
}

/** Unggah berkas PDF template; backend membaca jumlah halamannya. */
export function unggahBerkasTemplate(id: number, berkas: File) {
  const body = new FormData();
  body.append('berkas', berkas);
  return apiUpload<{ pesan: string; data: TemplateLengkap }>(`/admin/template-dokumen/${id}/berkas`, body).then(
    (r) => r.data,
  );
}

/**
 * Isi template dengan satu record, lalu ambil PDF-nya sebagai objek URL.
 * Nama berkas berasal dari Content-Disposition di server.
 */
export function isiTemplate(id: number, hasil: HasilIsi) {
  return postBlob(`/admin/template-dokumen/${id}/isi`, { ...hasil, unduh: true }, `template-${id}.pdf`);
}
