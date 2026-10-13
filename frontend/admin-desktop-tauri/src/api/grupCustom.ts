import { api } from './client';
import { appendQueryParam, type ScalarOrArray } from './query';

/** Grup santri custom: kelompok bentukan manual (mis. peserta ekskul). */
export interface AnggotaGrupCustom {
  id: number;
  nama_lengkap: string;
  jk: string | null;
  /** NIS lokal (dari riwayat TA tampil; null bila tak ada). */
  nis: string | null;
  /** Kelas pada TA tampil (null bila tak ada). */
  kelas: string | null;
  /** Jenjang pada TA tampil (null bila tak ada). */
  jenjang: string | null;
}

export interface GrupSantriCustom {
  id: number;
  nama: string;
  keterangan: string | null;
  jenjang: string | null;
  tahun_ajaran: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  /** Anggota (diperkaya nis/kelas/jenjang dari riwayat TA tampil). */
  santri: AnggotaGrupCustom[];
}

/** Daftar grup + anggotanya (saring lingkup topBar bila diisi). */
export function daftarGrupCustom(params: { jenjang?: ScalarOrArray<string>; tahun_ajaran?: ScalarOrArray<string> } = {}) {
  const q = new URLSearchParams();
  appendQueryParam(q, 'jenjang', params.jenjang);
  appendQueryParam(q, 'tahun_ajaran', params.tahun_ajaran);
  const qs = q.toString();
  return api<GrupSantriCustom[]>(`/admin/keuangan/grup-custom${qs ? `?${qs}` : ''}`);
}

/** Buat grup baru. */
export function buatGrupCustom(data: { nama: string; keterangan?: string | null; jenjang?: string | null; tahun_ajaran?: string | null; is_active?: boolean }) {
  return api<GrupSantriCustom>('/admin/keuangan/grup-custom', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Ubah grup (nama wajib; sisanya mengikuti yang dikirim). */
export function ubahGrupCustom(id: number, data: { nama: string; keterangan?: string | null; jenjang?: string | null; tahun_ajaran?: string | null; is_active?: boolean }) {
  return api<GrupSantriCustom>(`/admin/keuangan/grup-custom/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/** Hapus grup (anggota ikut bersih). */
export function hapusGrupCustom(id: number) {
  return api<{ pesan: string }>(`/admin/keuangan/grup-custom/${id}`, { method: 'DELETE' });
}

/** Tambah anggota (idempotent: yang sudah masuk dilewati). */
export function tambahAnggotaGrup(id: number, santriIds: number[]) {
  return api<GrupSantriCustom>(`/admin/keuangan/grup-custom/${id}/anggota`, {
    method: 'POST',
    body: JSON.stringify({ santri_ids: santriIds }),
  });
}

/** Keluarkan satu anggota. */
export function hapusAnggotaGrup(id: number, santriId: number) {
  return api<GrupSantriCustom>(`/admin/keuangan/grup-custom/${id}/anggota/${santriId}`, {
    method: 'DELETE',
  });
}
