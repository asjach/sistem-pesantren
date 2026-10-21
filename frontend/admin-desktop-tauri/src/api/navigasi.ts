import { api } from './client';

export interface NavigasiSetelanResp {
  mode: 'global' | 'pribadi';
  global_tersembunyi: string[];
  pribadi_tersembunyi: string[];
  tersembunyi: string[];
}

export function muatNavigasiTersembunyi() {
  return api<NavigasiSetelanResp>('/admin/pengaturan-navigasi');
}

export function simpanNavigasiTersembunyi(tersembunyi: string[]) {
  return api<NavigasiSetelanResp & { pesan: string }>('/admin/pengaturan-navigasi', {
    method: 'PUT',
    body: JSON.stringify({ tersembunyi }),
  });
}
