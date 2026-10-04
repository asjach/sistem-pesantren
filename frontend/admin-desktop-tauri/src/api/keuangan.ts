import { api } from './client';
import type { Paginate } from './master';
import { appendQueryParam, type ScalarOrArray } from './query';

export interface JenisTagihan { id: number; nama: string; tipe: 'bulanan' | 'non_bulanan'; jenjang: string | null; is_active: boolean }

export interface Tarif {
  id: number; jenjang: string; paket: string; tahun_ajaran: string; jenis_id: number;
  tingkat: string | null; nominal: number; is_active: boolean;
  jenis?: { id: number; nama: string };
}

export interface TagihanRow {
  id: number; santri_id: number; jenjang: string; paket: string; tahun_ajaran: string;
  jenis_id: number; periode: string | null; nominal: number; terbayar: number;
  status: 'belum' | 'sebagian' | 'lunas'; jatuh_tempo: string | null;
  jenis?: { nama: string };
  santri?: { nama_lengkap: string };
}

export interface TunggakanRow {
  santri_id: number; nama: string; total_tagihan: number; terbayar: number;
  tunggakan: number; jumlah_tagihan: number;
}

export function daftarJenis() {
  return api<JenisTagihan[]>('/admin/keuangan/jenis');
}

export function ubahJenis(id: number, data: { nama: string; tipe: 'bulanan' | 'non_bulanan'; jenjang?: string | null; is_active: boolean }) {
  return api<JenisTagihan>(`/admin/keuangan/jenis/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function buatJenis(nama: string, tipe: 'bulanan' | 'non_bulanan', jenjang?: string | null) {
  return api<JenisTagihan>('/admin/keuangan/jenis', { method: 'POST', body: JSON.stringify({ nama, tipe, jenjang: jenjang ?? null }) });
}

export function daftarTarif(params: { jenjang?: ScalarOrArray<string>; tahun_ajaran?: ScalarOrArray<string> } = {}) {
  const q = new URLSearchParams();
  appendQueryParam(q, 'jenjang', params.jenjang);
  appendQueryParam(q, 'tahun_ajaran', params.tahun_ajaran);
  const s = q.toString();
  return api<Tarif[]>(`/admin/keuangan/tarif${s ? `?${s}` : ''}`);
}

export function buatTarif(data: Partial<Tarif>) {
  return api<Tarif>('/admin/keuangan/tarif', { method: 'POST', body: JSON.stringify(data) });
}

export function ubahTarif(id: number, nominal: number, is_active: boolean) {
  return api<Tarif>(`/admin/keuangan/tarif/${id}`, { method: 'PUT', body: JSON.stringify({ nominal, is_active }) });
}

export function hapusTarif(id: number) {
  return api<{ pesan: string }>(`/admin/keuangan/tarif/${id}`, { method: 'DELETE' });
}

export function daftarTagihan(params: { page?: string; per_page?: string; jenjang?: ScalarOrArray<string>; tahun_ajaran?: ScalarOrArray<string>; jenis_id?: string; status?: string; belum_lunas?: boolean; santri?: string; santri_id?: number | string } = {}) {
  const q = new URLSearchParams();
  if (params.page) q.set('page', params.page);
  if (params.per_page) q.set('per_page', params.per_page);
  appendQueryParam(q, 'jenjang', params.jenjang);
  appendQueryParam(q, 'tahun_ajaran', params.tahun_ajaran);
  if (params.jenis_id) q.set('jenis_id', params.jenis_id);
  if (params.status) q.set('status', params.status);
  if (params.belum_lunas) q.set('belum_lunas', '1');
  if (params.santri) q.set('santri', params.santri);
  if (params.santri_id !== undefined && params.santri_id !== '') q.set('santri_id', String(params.santri_id));
  const s = q.toString();
  return api<Paginate<TagihanRow>>(`/admin/keuangan/tagihan${s ? `?${s}` : ''}`);
}

export function generateTagihan(data: Record<string, unknown>) {
  return api<{ dibuat: number; dilewati: number }>('/admin/keuangan/tagihan/generate', { method: 'POST', body: JSON.stringify(data) });
}

export function hapusTagihan(id: number) {
  return api<{ pesan: string }>(`/admin/keuangan/tagihan/${id}`, { method: 'DELETE' });
}

export function catatPembayaran(data: Record<string, unknown>) {
  return api<{ id: number; no_kwitansi: string }>('/admin/keuangan/pembayaran', { method: 'POST', body: JSON.stringify(data) });
}

export function hapusPembayaran(id: number) {
  return api<{ pesan: string }>(`/admin/keuangan/pembayaran/${id}`, { method: 'DELETE' });
}

export interface PembayaranRow {
  id: number; tagihan_id: number; jumlah: number; metode: string; kas: string;
  no_kwitansi: string | null; status: 'aktif' | 'batal'; catatan: string | null; created_at: string;
}

export function riwayatPembayaran(tagihanId: number) {
  return api<PembayaranRow[]>(`/admin/keuangan/tagihan/${tagihanId}/pembayaran`);
}

export function daftarTunggakan() {
  return api<{ per_santri: TunggakanRow[] }>('/admin/keuangan/tunggakan');
}
