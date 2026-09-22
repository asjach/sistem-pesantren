import { api } from './client';

export interface SemesterLembaga {
  jenjang: string;
  nama: string;
  /** '1' = Ganjil, '2' = Genap, null = belum diatur. */
  semester: '1' | '2' | null;
  label: string | null;
}

export function daftarSemester() {
  return api<{ data: SemesterLembaga[] }>('/admin/semester-aktif');
}

export function tetapkanSemester(jenjang: string, semester: '1' | '2') {
  return api<{ pesan: string; data: Pick<SemesterLembaga, 'jenjang' | 'semester' | 'label'> }>(
    '/admin/semester-aktif',
    { method: 'PUT', body: JSON.stringify({ jenjang, semester }) },
  );
}
