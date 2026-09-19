import { api } from './client';

export interface SemesterLembaga {
  lembaga_id: number;
  kode: string | null;
  nama: string;
  /** '1' = Ganjil, '2' = Genap, null = belum diatur. */
  semester: '1' | '2' | null;
  label: string | null;
}

export function daftarSemester() {
  return api<{ data: SemesterLembaga[] }>('/admin/semester-aktif');
}

export function tetapkanSemester(lembaga_id: number, semester: '1' | '2') {
  return api<{ pesan: string; data: Pick<SemesterLembaga, 'lembaga_id' | 'semester' | 'label'> }>(
    '/admin/semester-aktif',
    { method: 'PUT', body: JSON.stringify({ lembaga_id, semester }) },
  );
}
