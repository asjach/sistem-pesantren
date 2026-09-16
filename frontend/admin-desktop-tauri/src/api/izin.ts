import { api } from './client';

export interface PeranMatriks {
  name: string;
  terkunci: boolean;
  permissions: string[];
}

export interface MatriksIzin {
  katalog: Record<string, string[]>;
  roles: PeranMatriks[];
}

export function getMatriks() {
  return api<{ pesan: string; data: MatriksIzin }>('/admin/izin');
}

export function simpanIzin(role: string, permissions: string[]) {
  return api<{ pesan: string; data: { role: string; permissions: string[] } }>('/admin/izin', {
    method: 'PUT',
    body: JSON.stringify({ role, permissions }),
  });
}
