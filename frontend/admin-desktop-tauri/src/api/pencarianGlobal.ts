import { api } from './client';

export interface HasilPencarianGlobal {
  id: number;
  judul: string;
  keterangan: string;
  kueri: string;
  target: string;
}

export interface GrupPencarianGlobal {
  halaman: string;
  label: string;
  hasil: HasilPencarianGlobal[];
}

export interface SetelanPencarianGlobal {
  page_key: string;
  label: string;
  aktif: boolean;
}

export function cariGlobal(q: string) {
  return api<{ hasil: GrupPencarianGlobal[] }>(
    `/admin/pencarian?q=${encodeURIComponent(q)}`,
  );
}

export function muatSetelanPencarian() {
  return api<{ data: SetelanPencarianGlobal[] }>('/admin/pencarian-global');
}

export function simpanSetelanPencarian(aktif: Record<string, boolean>) {
  return api<{ pesan: string; data: SetelanPencarianGlobal[] }>('/admin/pencarian-global', {
    method: 'PUT',
    body: JSON.stringify({ aktif }),
  });
}
