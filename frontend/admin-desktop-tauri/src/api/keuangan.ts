import { api } from './client';
import type { Paginate } from './master';
import { appendQueryParam, type ScalarOrArray } from './query';

export interface JenisTagihan { id: number; nama: string; tipe: 'bulanan' | 'non_bulanan'; jenjang: string | null; is_active: boolean }

export interface Tarif {
  id: number; jenjang: string; tahun_ajaran: string; jenis_id: number;
  tingkat: string | null; nominal: number; is_active: boolean;
  jenis?: { id: number; nama: string };
}

export interface TagihanRow {
  id: number; santri_id: number; jenjang: string; tahun_ajaran: string;
  jenis_id: number; periode: string | null; nominal: number; terbayar: number;
  status: 'belum' | 'sebagian' | 'lunas'; jatuh_tempo: string | null;
  jenis?: { nama: string };
  santri?: { nama_lengkap: string };
}

/** Baris tab Tunggakan: belum lunas dan sudah lewat batas waktunya. */
export interface TunggakanRow {
  santri_id: number; nama: string; total_tagihan: number; terbayar: number;
  tunggakan: number; jumlah_tagihan: number;
  /** Jatuh tempo paling awal di antara tagihan yang punya batas waktu. */
  terlambat_terlama: string | null;
  /** Ada tagihan terlambat yang tidak punya tanggal batas sama sekali. */
  tanpa_jatuh_tempo: boolean;
}

export function daftarJenis(params: { sort?: string[]; arah?: 'naik' | 'turun' } = {}) {
  const q = new URLSearchParams();
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  const s = q.toString();
  return api<JenisTagihan[]>(`/admin/keuangan/jenis${s ? `?${s}` : ''}`);
}

export function ubahJenis(id: number, data: { nama: string; tipe: 'bulanan' | 'non_bulanan'; jenjang?: string | null; is_active: boolean }) {
  return api<JenisTagihan>(`/admin/keuangan/jenis/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function buatJenis(nama: string, tipe: 'bulanan' | 'non_bulanan', jenjang?: string | null) {
  return api<JenisTagihan>('/admin/keuangan/jenis', { method: 'POST', body: JSON.stringify({ nama, tipe, jenjang: jenjang ?? null }) });
}

export function daftarTarif(params: { jenjang?: ScalarOrArray<string>; tahun_ajaran?: ScalarOrArray<string>; sort?: string[]; arah?: 'naik' | 'turun' } = {}) {
  const q = new URLSearchParams();
  appendQueryParam(q, 'jenjang', params.jenjang);
  appendQueryParam(q, 'tahun_ajaran', params.tahun_ajaran);
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
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

export function daftarTagihan(params: { page?: string; per_page?: string; jenjang?: ScalarOrArray<string>; tahun_ajaran?: ScalarOrArray<string>; jenis_id?: string; status?: string; belum_lunas?: boolean; terlambat?: boolean; santri?: string; santri_id?: number | string; sort?: string[]; arah?: 'naik' | 'turun' } = {}) {
  const q = new URLSearchParams();
  if (params.page) q.set('page', params.page);
  if (params.per_page) q.set('per_page', params.per_page);
  appendQueryParam(q, 'jenjang', params.jenjang);
  appendQueryParam(q, 'tahun_ajaran', params.tahun_ajaran);
  if (params.jenis_id) q.set('jenis_id', params.jenis_id);
  if (params.status) q.set('status', params.status);
  if (params.belum_lunas) q.set('belum_lunas', '1');
  if (params.terlambat) q.set('terlambat', '1');
  if (params.santri) q.set('santri', params.santri);
  if (params.santri_id !== undefined && params.santri_id !== '') q.set('santri_id', String(params.santri_id));
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  const s = q.toString();
  return api<Paginate<TagihanRow>>(`/admin/keuangan/tagihan${s ? `?${s}` : ''}`);
}

export function generateTagihan(data: {
  tahun_ajaran: string; jenis_id: number; periode?: string | null; periode_sampai?: string | null;
  jatuh_tempo?: string | null; nominal: number; santri: { santri_id: number; nominal?: number | null }[];
}) {
  return api<{ dibuat: number; dilewati: number }>('/admin/keuangan/tagihan/generate', { method: 'POST', body: JSON.stringify(data) });
}

export type KelompokKandidat = 'mi_saja' | 'md_saja' | 'mi' | 'md' | 'mi_md' | 'aktif' | 'kelas_akhir' | 'selain_kelas_akhir' | 'custom';

export interface KandidatTagihanRow {
  santri_id: number; nama_lengkap: string; jk: string | null; nisn: string | null; nis_lokal: string | null;
  jenjang: string; tingkat: string | null; kelas: string | null; kelas_id: number | null;
  status_akhir: string | null;
}

export function kandidatTagihan(params: {
  tahun_ajaran: string; kelompok: KelompokKandidat; jenis_id?: number | ''; periode?: string;
  periode_sampai?: string; q?: string; page?: number; per_page?: string; sort?: string[]; arah?: 'naik' | 'turun';
}) {
  const q = new URLSearchParams();
  q.set('tahun_ajaran', params.tahun_ajaran);
  q.set('kelompok', params.kelompok);
  if (params.jenis_id !== undefined && params.jenis_id !== '') q.set('jenis_id', String(params.jenis_id));
  if (params.periode) q.set('periode', params.periode);
  if (params.periode_sampai) q.set('periode_sampai', params.periode_sampai);
  if (params.q) q.set('q', params.q);
  if (params.page) q.set('page', String(params.page));
  if (params.per_page) q.set('per_page', params.per_page);
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  return api<Paginate<KandidatTagihanRow>>(`/admin/keuangan/tagihan/kandidat?${q.toString()}`);
}

export type TipeDispensasi = 'persen' | 'nominal' | 'bebas';

export interface DispensasiAturan {
  id: number; dispensasi_id: number; jenis_id: number | null;
  tipe: TipeDispensasi; nilai: number;
  jenis?: { id: number; nama: string } | null;
}

export interface Dispensasi {
  id: number; nama: string; keterangan: string | null; tahun_ajaran: string;
  santri_ids: number[] | null; is_active: boolean;
  aturan: DispensasiAturan[];
}

export interface DispensasiAturanInput {
  jenis_id: number | null; tipe: TipeDispensasi; nilai: number;
}

export interface DispensasiInput {
  nama: string; keterangan?: string | null; tahun_ajaran: string;
  aturan: DispensasiAturanInput[]; santri_ids?: number[] | null;
  is_active?: boolean;
}

export function daftarDispensasi(params: { tahun_ajaran?: string; jenis_id?: number | ''; is_active?: boolean; santri_id?: number; sort?: string[]; arah?: 'naik' | 'turun' } = {}) {
  const q = new URLSearchParams();
  if (params.tahun_ajaran) q.set('tahun_ajaran', params.tahun_ajaran);
  if (params.jenis_id !== undefined && params.jenis_id !== '') q.set('jenis_id', String(params.jenis_id));
  if (params.is_active !== undefined) q.set('is_active', params.is_active ? '1' : '0');
  if (params.santri_id !== undefined) q.set('santri_id', String(params.santri_id));
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  const s = q.toString();
  return api<Dispensasi[]>(`/admin/keuangan/dispensasi${s ? `?${s}` : ''}`);
}

export function buatDispensasi(data: DispensasiInput) {
  return api<Dispensasi>('/admin/keuangan/dispensasi', { method: 'POST', body: JSON.stringify(data) });
}

export function ubahDispensasi(id: number, data: DispensasiInput) {
  return api<Dispensasi>(`/admin/keuangan/dispensasi/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function hapusDispensasi(id: number) {
  return api<{ pesan: string }>(`/admin/keuangan/dispensasi/${id}`, { method: 'DELETE' });
}

export interface CrosstabSel {
  id: number; nominal: number; terbayar: number; sisa: number;
  status: 'belum' | 'sebagian' | 'lunas'; jatuh_tempo: string | null;
  /** Sudah lewat jatuh tempo & belum lunas (dasar hitungan tunggakan). */
  terlambat: boolean;
  tahun_ajaran: string;
}

export interface CrosstabKolom {
  key: string; jenis_id: number; jenis_nama: string;
  tipe: 'bulanan' | 'non_bulanan'; periode: string | null;
}

export interface CrosstabBaris {
  santri_id: number; nama: string; jenjang: string;
  /** Nama ayah & ibu; dipakai ringkasan di popover aksi sel. */
  ayah_nama: string | null; ibu_nama: string | null;
  sel: Record<string, CrosstabSel>;
  total_tagihan: number; total_terbayar: number;
  /** Sisa tagihan yang sudah lewat jatuh tempo saja. */
  tunggakan: number;
}

export interface CrosstabTagihan {
  kolom: CrosstabKolom[];
  baris: CrosstabBaris[];
  total: number; per_page: number; current_page: number; last_page: number;
}

export function crosstabTagihan(params: {
  tahun_ajaran?: ScalarOrArray<string>; jenjang?: ScalarOrArray<string>; jenis_id?: number | '';
  status?: string; belum_lunas?: boolean; terlambat?: boolean; santri?: string;
  page?: number; per_page?: string; sort?: string[]; arah?: 'naik' | 'turun';
} = {}) {
  const q = new URLSearchParams();
  appendQueryParam(q, 'tahun_ajaran', params.tahun_ajaran);
  appendQueryParam(q, 'jenjang', params.jenjang);
  if (params.jenis_id !== undefined && params.jenis_id !== '') q.set('jenis_id', String(params.jenis_id));
  if (params.status) q.set('status', params.status);
  if (params.belum_lunas) q.set('belum_lunas', '1');
  if (params.terlambat) q.set('terlambat', '1');
  if (params.santri) q.set('santri', params.santri);
  if (params.page) q.set('page', String(params.page));
  if (params.per_page) q.set('per_page', params.per_page);
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  const s = q.toString();
  return api<CrosstabTagihan>(`/admin/keuangan/tagihan/crosstab${s ? `?${s}` : ''}`);
}

export function hapusTagihan(id: number) {
  return api<{ pesan: string }>(`/admin/keuangan/tagihan/${id}`, { method: 'DELETE' });
}

/**
 * Ubah tagihan yang sudah terlanjur dibuat: nominal, tahun ajaran, jatuh tempo.
 * Jenis & periode tidak bisa diubah — keduanya bagian kunci unik tagihan.
 */
export function ubahTagihan(id: number, data: { nominal: number; tahun_ajaran: string; jatuh_tempo: string | null }) {
  return api<TagihanRow>(`/admin/keuangan/tagihan/${id}`, { method: 'PUT', body: JSON.stringify(data) });
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

export function daftarTunggakan(params: { sort?: string[]; arah?: 'naik' | 'turun' } = {}) {
  const q = new URLSearchParams();
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  const s = q.toString();
  return api<{ per_santri: TunggakanRow[] }>(`/admin/keuangan/tunggakan${s ? `?${s}` : ''}`);
}
