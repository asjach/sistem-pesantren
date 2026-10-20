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

/** Satu baris checklist di bawah poin. */
export interface SubpoinPapan {
  teks: string;
  selesai: boolean;
}

export interface ButirPapan {
  id: number;
  status: StatusPapan;
  deskripsi: string;
  subpoin?: SubpoinPapan[];
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
  /** Kode aplikasi pemilik modul, mis. desktop-admin. */
  aplikasi?: string;
  sub: SubPapan[];
}

/** Satu tab horizontal Board beserta modul-modulnya. */
export interface AplikasiPapan {
  kode: string;
  nama: string;
  /** Status mentah aplikasi, sebelum memperhitungkan master switch. */
  timeline_aktif: boolean;
  /** true hanya bila master dan status aplikasi sama-sama aktif. */
  timeline_efektif: boolean;
  modul: ModulPapan[];
}

/** Ringkasan dipisah: poin (yang bergerak) dan sub-modul (turunan). */
export interface RingkasanPapan {
  butir: Record<StatusPapan, number>;
  sub: Record<StatusPapan, number>;
}

export interface DataPapan {
  aplikasi: AplikasiPapan[];
  /** Master switch; bila false semua timeline aplikasi efektif Draf. */
  timeline_master_aktif: boolean;
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
  return api<DataPapan>('/board');
}

/** Pindahkan satu POIN; status sub-modulnya menyusul secara turunan. */
export function pindahStatusPapan(kode: string, butirId: number, status: StatusPapan, catatan?: string) {
  return api<{ kode: string; id: number; status: StatusPapan; status_sub_modul: StatusPapan }>(
    `/board/${encodeURIComponent(kode)}/butir/${butirId}/status`,
    { method: 'PATCH', body: JSON.stringify({ status, catatan }) },
  );
}

/** Tambah poin di bawah sebuah sub-modul. */
export function tambahButirPapan(kode: string, status: StatusPapan, deskripsi: string, subpoin: SubpoinPapan[] = []) {
  return api<ButirPapan>(`/board/${encodeURIComponent(kode)}/butir`, {
    method: 'POST',
    body: JSON.stringify({ status, deskripsi, subpoin }),
  });
}

/** Hapus satu poin milik sebuah sub-modul. */
export function hapusButirPapan(kode: string, id: number) {
  return api<{ message: string }>(`/board/${encodeURIComponent(kode)}/butir/${id}`, {
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
  ubah: { deskripsi?: string; subpoin?: SubpoinPapan[]; status?: StatusPapan; catatan?: string },
) {
  return api<{ id: number; status: StatusPapan; deskripsi: string; status_sub_modul: StatusPapan }>(
    `/board/${encodeURIComponent(kode)}/butir/${id}`,
    { method: 'PATCH', body: JSON.stringify(ubah) },
  );
}

export interface StatusTimelinePapan {
  timeline_master_aktif: boolean;
  aplikasi: Record<string, { kode: string; timeline_aktif: boolean; timeline_efektif: boolean }>;
}

/** Aktifkan/nonaktifkan master timeline atau timeline satu aplikasi. */
export function setTimelinePapan(aktif: boolean, aplikasi?: string) {
  return api<StatusTimelinePapan>('/board/timeline', {
    method: 'PATCH',
    body: JSON.stringify(aplikasi ? { aktif, aplikasi } : { aktif }),
  });
}

/** Tambah modul baru di sebuah aplikasi; tab modul langsung muncul. */
export function tambahModulPapan(aplikasi: string, kode: string, nama: string) {
  return api<{ aplikasi: string; kode: string; nama: string }>('/board/modul', {
    method: 'POST',
    body: JSON.stringify({ aplikasi, kode, nama }),
  });
}

/** Tambah sub-modul baru di bawah sebuah modul. */
export function tambahSubPapan(modulKode: string, kode: string, nama: string) {
  return api<{ kode: string; nama: string }>(`/board/modul/${encodeURIComponent(modulKode)}/item`, {
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
  return api<{ kode: string; nama: string }>(`/board/item/${encodeURIComponent(kode)}`, {
    method: 'PATCH',
    body: JSON.stringify(ubah),
  });
}

/** Hapus sub-modul beserta SELURUH poinnya. */
export function hapusSubPapan(kode: string) {
  return api<{ message: string }>(`/board/item/${encodeURIComponent(kode)}`, { method: 'DELETE' });
}
/** Riwayat perpindahan status poin, terbaru lebih dulu. */
export function muatRiwayatPapan(kode?: string, batas = 20) {
  const qs = new URLSearchParams();
  if (kode) qs.set('kode', kode);
  qs.set('batas', String(batas));
  return api<{ riwayat: RiwayatPapan[] }>(`/board/riwayat?${qs.toString()}`);
}
