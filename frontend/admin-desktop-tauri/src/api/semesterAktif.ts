import { api } from './client';

export interface SemesterLembaga {
  jenjang: string;
  nama: string;
  /** '1' = Ganjil, '2' = Genap, null = belum diatur. */
  semester: '1' | '2' | null;
  label: string | null;
}

export function daftarSemester(params: { sort?: string[]; arah?: 'naik' | 'turun' } = {}) {
  const q = new URLSearchParams();
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return api<{ data: SemesterLembaga[] }>(`/admin/semester-aktif${suffix}`);
}

export function tetapkanSemester(jenjang: string, semester: '1' | '2') {
  return api<{ pesan: string; data: Pick<SemesterLembaga, 'jenjang' | 'semester' | 'label'> }>(
    '/admin/semester-aktif',
    { method: 'PUT', body: JSON.stringify({ jenjang, semester }) },
  );
}
