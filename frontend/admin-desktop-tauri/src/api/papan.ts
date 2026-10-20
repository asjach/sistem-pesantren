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
  subpoin?: string[];
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
export function tambahButirPapan(kode: string, status: StatusPapan, deskripsi: string, subpoin: string[] = []) {
  return api<ButirPapan>(`/papan/${encodeURIComponent(kode)}/butir`, {
    method: 'POST',
    body: JSON.stringify({ status, deskripsi, subpoin }),
  });
}

/** Hapus satu poin milik sebuah sub-modul. */
export function hapusButirPapan(kode: string, id: number) {
  return api<{ message: string }>(`/papan/${encodeURIComponent(kode)}/butir/${id}`, {
    method: 'DELETE',
  });
}


/**
 * Ubah isi satu POIN: deskripsi, subpoin, dan/atau statusnya.
 *
 * Keduanya opsional — menyunting teks saja tidak perlu menyertakan status,
 * supaya tidak ada risiko status ikut berubah karena kelalaian pemanggil.
 */
export function ubahButirPapan(
  kode: string,
  id: number,
  ubah: { deskripsi?: string; subpoin?: string[]; status?: StatusPapan; catatan?: string },
) {
  return api<{ id: number; status: StatusPapan; deskripsi: string; status_sub_modul: StatusPapan }>(
    `/papan/${encodeURIComponent(kode)}/butir/${id}`,
    { method: 'PATCH', body: JSON.stringify(ubah) },
  );
}

/**
 * Geser satu POIN naik (-1) atau turun (1) di dalam sub-modulnya.
 *
 * Backend menjawab 409 bila poin sudah di ujung; pemanggil sebaiknya
 * menonaktifkan tombolnya lebih dulu supaya 409 jarang terjadi.
 */
export function geserButirPapan(kode: string, id: number, arah: -1 | 1) {
  return api<{ butir: ButirPapan[] }>(`/papan/${encodeURIComponent(kode)}/butir/${id}/urutan`, {
    method: 'PATCH',
    body: JSON.stringify({ arah }),
  });
}

/** Tambah sub-modul baru di bawah sebuah modul. */
export function tambahSubPapan(modulKode: string, kode: string, nama: string) {
  return api<{ kode: string; nama: string }>(`/papan/modul/${encodeURIComponent(modulKode)}/item`, {
    method: 'POST',
    body: JSON.stringify({ kode, nama }),
  });
}

/**
 * Ubah nama dan/atau kode sebuah sub-modul.
 *
 * Poin-poin di dalamnya TIDAK disentuh — beda dari seed ulang yang menghapus
 * lalu membuat ulang poin sehingga id dan statusnya hilang.
 */
export function ubahSubPapan(kode: string, ubah: { nama?: string; kode_baru?: string }) {
  return api<{ kode: string; nama: string }>(`/papan/item/${encodeURIComponent(kode)}`, {
    method: 'PATCH',
    body: JSON.stringify(ubah),
  });
}

/** Hapus sub-modul beserta SELURUH poinnya. */
export function hapusSubPapan(kode: string) {
  return api<{ message: string }>(`/papan/item/${encodeURIComponent(kode)}`, { method: 'DELETE' });
}
/** Riwayat perpindahan status poin, terbaru lebih dulu. */
export function muatRiwayatPapan(kode?: string, batas = 20) {
  const qs = new URLSearchParams();
  if (kode) qs.set('kode', kode);
  qs.set('batas', String(batas));
  return api<{ riwayat: RiwayatPapan[] }>(`/papan/riwayat?${qs.toString()}`);
}
