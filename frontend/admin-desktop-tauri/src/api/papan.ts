import { api } from './client';

/** Status yang dipakai papan — sama dengan kosakata di docs/PETA-MODUL.md. */
export type StatusPapan = 'sudah' | 'sedang' | 'akan' | 'ditunda';

/** Empat kolom papan, dalam urutan tampil. */
export const KOLOM_PAPAN: StatusPapan[] = ['akan', 'sedang', 'sudah', 'ditunda'];

/** Judul kolom untuk tampilan. */
export const JUDUL_KOLOM: Record<StatusPapan, string> = {
  akan: 'Akan',
  sedang: 'Sedang',
  sudah: 'Sudah',
  ditunda: 'Ditunda',
};

export interface ButirPapan {
  id: number;
  status: StatusPapan;
  deskripsi: string;
}

export interface SubPapan {
  kode: string;
  nama: string;
  status: StatusPapan;
  butir: ButirPapan[];
}

export interface ModulPapan {
  kode: string;
  nama: string;
  sub: SubPapan[];
}

export interface DataPapan {
  modul: ModulPapan[];
  ringkasan: Record<StatusPapan, number>;
}

export interface RiwayatPapan {
  kode: string;
  dari: StatusPapan | null;
  ke: StatusPapan;
  catatan: string | null;
  oleh: string;
  waktu: string;
}

/** Muat seluruh papan: modul, sub-modul, butir, dan ringkasan per status. */
export function muatPapan() {
  return api<DataPapan>('/papan');
}

/** Pindahkan status satu sub-modul, dengan catatan opsional. */
export function pindahStatusPapan(kode: string, status: StatusPapan, catatan?: string) {
  return api<{ kode: string; nama: string; status: StatusPapan }>(
    `/papan/${encodeURIComponent(kode)}/status`,
    { method: 'PATCH', body: JSON.stringify({ status, catatan }) },
  );
}

/** Tambah butir di bawah sebuah sub-modul. */
export function tambahButirPapan(kode: string, status: StatusPapan, deskripsi: string) {
  return api<ButirPapan>(`/papan/${encodeURIComponent(kode)}/butir`, {
    method: 'POST',
    body: JSON.stringify({ status, deskripsi }),
  });
}

/** Hapus satu butir milik sebuah sub-modul. */
export function hapusButirPapan(kode: string, id: number) {
  return api<{ message: string }>(`/papan/${encodeURIComponent(kode)}/butir/${id}`, {
    method: 'DELETE',
  });
}

/** Riwayat perpindahan status, terbaru lebih dulu. */
export function muatRiwayatPapan(kode?: string, batas = 20) {
  const qs = new URLSearchParams();
  if (kode) qs.set('kode', kode);
  qs.set('batas', String(batas));
  return api<{ riwayat: RiwayatPapan[] }>(`/papan/riwayat?${qs.toString()}`);
}
