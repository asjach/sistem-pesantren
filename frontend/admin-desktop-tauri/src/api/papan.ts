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

/**
 * Satu sub-modul beserta poin-poinnya.
 *
 * `status` di sini adalah status TURUNAN dari poin (dihitung backend),
 * bukan nilai yang disimpan sendiri. Yang dipindah di papan adalah poinnya,
 * jadi jangan pakai field ini sebagai sumber untuk menggeser kolom.
 */
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

/** Ringkasan dipisah: poin (yang bergerak) dan sub-modul (turunan). */
export interface RingkasanPapan {
  butir: Record<StatusPapan, number>;
  sub: Record<StatusPapan, number>;
}

export interface DataPapan {
  modul: ModulPapan[];
  ringkasan: RingkasanPapan;
  status: StatusPapan[];
}

export interface RiwayatPapan {
  kode: string;
  /** Deskripsi poin yang dipindah; null untuk baris lama sebelum model poin. */
  butir: string | null;
  dari: StatusPapan | null;
  ke: StatusPapan;
  catatan: string | null;
  oleh: string;
  waktu: string;
}

/** Muat seluruh papan: modul, sub-modul, poin, dan ringkasan per status. */
export function muatPapan() {
  return api<DataPapan>('/papan');
}

/** Pindahkan satu POIN; status sub-modulnya menyusul secara turunan. */
export function pindahStatusPapan(kode: string, butirId: number, status: StatusPapan, catatan?: string) {
  return api<{ kode: string; id: number; status: StatusPapan; status_sub_modul: StatusPapan }>(
    `/papan/${encodeURIComponent(kode)}/butir/${butirId}/status`,
    { method: 'PATCH', body: JSON.stringify({ status, catatan }) },
  );
}

/** Tambah poin di bawah sebuah sub-modul. */
export function tambahButirPapan(kode: string, status: StatusPapan, deskripsi: string) {
  return api<ButirPapan>(`/papan/${encodeURIComponent(kode)}/butir`, {
    method: 'POST',
    body: JSON.stringify({ status, deskripsi }),
  });
}

/** Hapus satu poin milik sebuah sub-modul. */
export function hapusButirPapan(kode: string, id: number) {
  return api<{ message: string }>(`/papan/${encodeURIComponent(kode)}/butir/${id}`, {
    method: 'DELETE',
  });
}

/** Riwayat perpindahan status poin, terbaru lebih dulu. */
export function muatRiwayatPapan(kode?: string, batas = 20) {
  const qs = new URLSearchParams();
  if (kode) qs.set('kode', kode);
  qs.set('batas', String(batas));
  return api<{ riwayat: RiwayatPapan[] }>(`/papan/riwayat?${qs.toString()}`);
}
