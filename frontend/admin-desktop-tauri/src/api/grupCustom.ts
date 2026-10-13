import { api } from './client';

/** Grup santri custom: kelompok bentukan manual (mis. peserta ekskul). */
export interface GrupSantriCustom {
  id: number;
  nama: string;
  keterangan: string | null;
  created_at: string;
  updated_at: string;
  /** Anggota (santri pilihan manual). */
  santri: { id: number; nama_lengkap: string }[];
}

/** Daftar grup + anggotanya. */
export function daftarGrupCustom() {
  return api<GrupSantriCustom[]>('/admin/keuangan/grup-custom');
}

/** Buat grup baru. */
export function buatGrupCustom(data: { nama: string; keterangan?: string | null }) {
  return api<GrupSantriCustom>('/admin/keuangan/grup-custom', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Ubah nama/keterangan grup. */
export function ubahGrupCustom(id: number, data: { nama: string; keterangan?: string | null }) {
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
