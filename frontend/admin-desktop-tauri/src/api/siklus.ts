import { api } from './client';
import type { Paginate } from './master';

// ---------- Siklus santri (102: naik/pindah/mutasi/lulus + mutasi & alumni) ----------

export interface MutasiKeluar {
  id: number;
  santri_id: number;
  lembaga_id: number;
  kelas_terakhir_id: number;
  tanggal_mutasi: string | null;
  alasan_mutasi: string | null;
  no_surat: string | null;
  nama_sekolah_tujuan: string | null;
  keterangan: string | null;
  santri?: { id: number; nama_lengkap: string; nis: string | null } | null;
  lembaga?: { id: number; nama: string; kode: string | null } | null;
  kelas_terakhir?: { id: number; nama_kelas: string } | null;
}

export interface Alumni {
  id: number;
  santri_id: number;
  lembaga_lulus_id: number;
  tahun_ajaran_lulus_id: number;
  nomor_ijazah: string | null;
  no_surat_ijazah: string | null;
  tanggal_lulus: string | null;
  kegiatan_setelah_lulus: string | null;
  penyerahan_ijazah: string | null;
  melanjutkan: string | null;
  catatan: string | null;
  santri?: { id: number; nama_lengkap: string; nis: string | null } | null;
  lembaga_lulus?: { id: number; nama: string; kode: string | null } | null;
  tahun_ajaran_lulus?: { id: number; nama: string } | null;
}

export function listMutasiKeluar(params: { lembaga_id?: number; page?: number; per_page?: number } = {}) {
  const q = new URLSearchParams();
  if (params.lembaga_id) q.set('lembaga_id', String(params.lembaga_id));
  q.set('page', String(params.page ?? 1));
  if (params.per_page) q.set('per_page', String(params.per_page));
  return api<Paginate<MutasiKeluar>>(`/admin/mutasi-keluar?${q.toString()}`);
}

export function listAlumni(params: { tahun_ajaran_lulus_id?: number; page?: number; per_page?: number } = {}) {
  const q = new URLSearchParams();
  if (params.tahun_ajaran_lulus_id) q.set('tahun_ajaran_lulus_id', String(params.tahun_ajaran_lulus_id));
  q.set('page', String(params.page ?? 1));
  if (params.per_page) q.set('per_page', String(params.per_page));
  return api<Paginate<Alumni>>(`/admin/alumni?${q.toString()}`);
}

export interface NaikKelasItem {
  santri_id: number;
  status: 'naik' | 'tidak_naik';
  nis?: string;
}

export function naikKelasMassal(input: {
  lembaga_id: number;
  tahun_ajaran_baru_id: number;
  tingkat: string;
  siswa: NaikKelasItem[];
}) {
  return api<{ pesan: string; berhasil: number; gagal: { santri_id: number | null; pesan: string }[] }>(
    '/admin/akademik/naik-kelas',
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function pindahKelas(riwayatId: number, kelasBaruId: number) {
  return api<{ pesan: string; data: unknown }>(`/admin/riwayat/${riwayatId}/pindah-kelas`, {
    method: 'POST',
    body: JSON.stringify({ kelas_baru_id: kelasBaruId }),
  });
}

export function setKelas(riwayatId: number, kelasId: number) {
  return api<{ pesan: string; data: unknown }>(`/admin/riwayat/${riwayatId}/set-kelas`, {
    method: 'POST',
    body: JSON.stringify({ kelas_id: kelasId }),
  });
}

export function berhentiJenjang(santriId: number, lembagaId: number) {
  return api<{ pesan: string; data: unknown }>(`/admin/santri/${santriId}/berhenti-jenjang`, {
    method: 'POST',
    body: JSON.stringify({ lembaga_id: lembagaId }),
  });
}

export function mutasiSantri(
  santriId: number,
  input: {
    lembaga_id: number;
    kelas_terakhir_id: number;
    tanggal_mutasi: string;
    alasan_mutasi: string;
    no_surat?: string;
    nama_sekolah_tujuan?: string;
    npsn_sekolah_tujuan?: string;
    nsm_sekolah_tujuan?: string;
    alamat_sekolah_tujuan?: string;
    keterangan?: string;
  },
) {
  return api<{ pesan: string; data: MutasiKeluar }>(`/admin/santri/${santriId}/mutasi`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function lulusSantri(
  santriId: number,
  input: {
    lembaga_id: number;
    tahun_ajaran_lulus_id: number;
    tanggal_lulus: string;
    hasil?: 'lulus' | 'tidak_lulus';
    nomor_ijazah?: string;
    no_surat_ijazah?: string;
    kegiatan_setelah_lulus?: string;
    penyerahan_ijazah?: 'sudah' | 'belum';
    melanjutkan?: 'ya' | 'tidak';
  },
) {
  return api<{ pesan: string; data: unknown }>(`/admin/santri/${santriId}/lulus`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
