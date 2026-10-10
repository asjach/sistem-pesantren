import { api } from './client';
import type { Paginate } from './master';
import type { Santri } from './santri';
import { appendQueryParam, type ScalarOrArray } from './query';

export interface JenisTagihan { id: number; nama: string; tipe: 'bulanan' | 'non_bulanan'; jenjang: string | null; keterangan: string | null; is_active: boolean }

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

export function daftarJenis(params: { sort?: string[]; arah?: 'naik' | 'turun' } = {}) {
  const q = new URLSearchParams();
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  const s = q.toString();
  return api<JenisTagihan[]>(`/admin/keuangan/jenis${s ? `?${s}` : ''}`);
}

export function ubahJenis(id: number, data: { nama: string; tipe: 'bulanan' | 'non_bulanan'; jenjang?: string | null; keterangan?: string | null; is_active: boolean }) {
  return api<JenisTagihan>(`/admin/keuangan/jenis/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function buatJenis(nama: string, tipe: 'bulanan' | 'non_bulanan', jenjang?: string | null, keterangan?: string | null) {
  return api<JenisTagihan>('/admin/keuangan/jenis', { method: 'POST', body: JSON.stringify({ nama, tipe, jenjang: jenjang ?? null, keterangan: keterangan ?? null }) });
}

export function hapusJenis(id: number) {
  return api<{ pesan: string }>(`/admin/keuangan/jenis/${id}`, { method: 'DELETE' });
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

export interface GenerateTagihanInput {
  tahun_ajaran: string; jenis_id: number; periode?: string | null; periode_sampai?: string | null;
  jatuh_tempo?: string | null; nominal: number; santri: { santri_id: number; nominal?: number | null }[];
}

export function generateTagihan(data: GenerateTagihanInput) {
  return api<{
    dibuat: number; diperbarui: number; tetap: number; dilewati: number;
    /** Tagihan yang dilewati: sudah ada pembayaran (bulanan) atau nominal baru < terbayar. */
    alasan: { santri_id: number; periode: string | null; nominal_sekarang: number; terbayar: number; sebab: string }[];
  }>('/admin/keuangan/tagihan/generate', { method: 'POST', body: JSON.stringify(data) });
}

/** Sumbangan satu paket pada satu baris: nominal sebelum → sesudah paket. */
export interface PratinjauLangkah {
  id: number; nama: string; tipe: 'persen' | 'nominal' | 'bebas'; nilai: number;
  sebelum: number; sesudah: number; potongan: number;
}

/** Satu baris (periode) hasil pratinjau generate. */
export interface PratinjauBaris {
  periode: string; nominal: number; potongan: number;
  dispensasi_ids: number[]; nama: string[];
  /** Paket yang benar-benar menyumbang potongan di baris ini (urut id). */
  langkah: PratinjauLangkah[];
  /** Sebab baris dilewati generate (sudah dibayar / nominal baru < terbayar). */
  sebab: string | null;
}

/** Pratinjau generate per santri — hitungan backend (sumber yang sama
 *  dengan generate; frontend tak lagi mencerminkan aturan grup/kuota). */
export interface PratinjauSantri {
  santri_id: number;
  /** Nilai periode pertama — yang ditampilkan tabel. */
  nominal: number; potongan: number;
  dispensasi_ids: number[] | null; dispensasi_nama: string[];
  /** Semua periode bernilai & berdispensasi sama (false = failover kuota). */
  seragam: boolean;
  /** Penerima paket berkuota yang tak kebagian kuota dalam rentang ini. */
  tak_kebagian: string[];
  periode: PratinjauBaris[];
}

/** Hitungan generate tanpa menulis apa pun — dipakai dialog Buat Tagihan. */
export function pratinjauTagihan(data: GenerateTagihanInput) {
  return api<PratinjauSantri[]>('/admin/keuangan/tagihan/pratinjau', { method: 'POST', body: JSON.stringify(data) });
}

/** Buat SATU tagihan manual (dipakai popover tambah dari sel kosong).
 *  Dispensasi tidak diterapkan otomatis (lihat dialog Buat Tagihan untuk
 *  pratinjau potongan) — nominal yang diketik adalah nominal final. */
export function buatTagihan(data: {
  santri_id: number; jenjang: string; tahun_ajaran: string; jenis_id: number;
  periode?: string | null; nominal: number; jatuh_tempo?: string | null;
}) {
  return api<TagihanRow>('/admin/keuangan/tagihan', { method: 'POST', body: JSON.stringify(data) });
}

export type KelompokKandidat = 'mi_saja' | 'md_saja' | 'mi' | 'md' | 'mi_md' | 'aktif' | 'kelas_akhir' | 'selain_kelas_akhir' | 'custom';

export interface KandidatTagihanRow {
  santri_id: number; nama_lengkap: string; jk: string | null; nisn: string | null; nis_lokal: string | null;
  jenjang: string; tingkat: string | null; kelas: string | null; kelas_id: number | null;
  status_akhir: string | null;
  /** Rekap tagihan yang sudah ada untuk periode terpilih (generate ulang). */
  tagihan_periode: number; tagihan_nominal: number; tagihan_terbayar: number;
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
  /** Kuota bulan (tagihan bulanan per santri); null = tanpa batas. */
  kuota_bulan: number | null;
  /** Grup eksklusivitas (maks 1 per tagihan); null = selalu digabung. */
  grup: string | null;
  santri_ids: number[] | null; is_active: boolean;
  aturan: DispensasiAturan[];
  /** Penerima termuat (nama asli + NIS/ortu); sumber prefill tabel penerima. */
  santri_tambahan?: Santri[] | null;
}

export interface DispensasiAturanInput {
  jenis_id: number | null; tipe: TipeDispensasi; nilai: number;
}

export interface DispensasiInput {
  nama: string; keterangan?: string | null; tahun_ajaran: string;
  kuota_bulan?: number | null;
  grup?: string | null;
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

/** Kuota terpakai per santri per paket (tagihan bulanan seumur hidup):
 *  `{ santri_id: { paket_id: terpakai } }`. Pratinjau agar tak over-janji;
 *  backend generate/Ubah tetap otoritatif. */
export function kuotaPakai(santriIds: number[]) {
  const q = new URLSearchParams();
  santriIds.forEach((id) => q.append('santri_ids[]', String(id)));
  const s = q.toString();
  return api<Record<number, Record<number, number>>>(`/admin/keuangan/dispensasi/kuota-pakai${s ? `?${s}` : ''}`);
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
  /** Jejak dispensasi dari generate (0/null bila manual/tanpa). */
  potongan?: number;
  dispensasi_ids?: number[] | null;
}

export interface CrosstabKolom {
  key: string; jenis_id: number; jenis_nama: string;
  tipe: 'bulanan' | 'non_bulanan'; periode: string | null;
}

export interface CrosstabBaris {
  santri_id: number; nama: string; jenjang: string;
  /** Nama ayah & ibu; dipakai ringkasan di popover aksi sel. */
  ayah_nama: string | null; ibu_nama: string | null;
  /** Kelas & tingkat dari riwayat belajar pada TA filter (semester genap
   *  menang; Santri MI-MD memakai kelas MI). */
  kelas: string | null; tingkat: string | null;
  /** Jenjang terdaftar pada TA filter (MI > MD > lainnya) — label gabungan. */
  jenjang_riwayat: string[];
  /** Id dokumen Pas Foto aktif pada jenjang baris (null = tanpa foto);
   *  dipakai avatar popover (byte diambil malas saat dibuka). */
  foto_dokumen_id: number | null;
  /** Ada foto profil santri (`santri.foto_url`) — fallback avatar kedua. */
  foto_profil: boolean;
  /** `status_akhir` riwayat pada TA filter + turunannya (bukan pindah_keluar). */
  status_akhir: string | null; aktif: boolean;
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
  /** Filter rail: tingkat (kode) & kelas (id, bukan nama) pada baris yang tampil. */
  tingkat?: ScalarOrArray<string>; kelas_id?: ScalarOrArray<number>;
  page?: number; per_page?: string; sort?: string[]; arah?: 'naik' | 'turun';
  /** Batalkan request lama saat filter/pencarian berubah (pola `useDaftarTabel`). */
  signal?: AbortSignal;
} = {}) {
  const q = new URLSearchParams();
  appendQueryParam(q, 'tahun_ajaran', params.tahun_ajaran);
  appendQueryParam(q, 'jenjang', params.jenjang);
  if (params.jenis_id !== undefined && params.jenis_id !== '') q.set('jenis_id', String(params.jenis_id));
  if (params.status) q.set('status', params.status);
  if (params.belum_lunas) q.set('belum_lunas', '1');
  if (params.terlambat) q.set('terlambat', '1');
  if (params.santri) q.set('santri', params.santri);
  appendQueryParam(q, 'tingkat', params.tingkat);
  appendQueryParam(q, 'kelas_id', params.kelas_id);
  if (params.page) q.set('page', String(params.page));
  if (params.per_page) q.set('per_page', params.per_page);
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  const s = q.toString();
  return api<CrosstabTagihan>(`/admin/keuangan/tagihan/crosstab${s ? `?${s}` : ''}`, { signal: params.signal });
}

export function hapusTagihan(id: number) {
  return api<{ pesan: string }>(`/admin/keuangan/tagihan/${id}`, { method: 'DELETE' });
}

/**
 * Ubah tagihan yang sudah terlanjur dibuat: nominal, tahun ajaran, jatuh tempo.
 * Jenis & periode tidak bisa diubah — keduanya bagian kunci unik tagihan.
 */
export function ubahTagihan(id: number, data: { nominal: number; tahun_ajaran: string; jatuh_tempo: string | null; dispensasi_ids?: number[] | null }) {
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
