import { ambilBerkas, api, apiUpload, downloadFile } from './client';
import { appendQueryParam, type ScalarOrArray } from './query';

/**
 * Modul Penilaian: nilai diikat PERISTIWA (ASAS/ASAT/UJIAN/UAP).
 * Peristiwa milik (jenjang, tahun ajaran) — bukan semester. Rapor & leger
 * dicetak per peristiwa; semester tetap dimensi instans pencatatan skor.
 */

export type CakupanPeristiwa = 'semua' | 'kecuali_akhir' | 'tingkat_akhir';
export type KurikulumPeristiwa = 'kemenag' | 'pesantren' | 'keduanya';
/** `akhir` = rapor akhir semester/tahun (ASAS/ASAT); `sementara` = rapor tengah
 *  periode; `tidak_ada` = nilai ujian/ijazah saja (UJIAN/UAP), tanpa rapor. */
export type JenisRapor = 'akhir' | 'sementara' | 'tidak_ada';

export interface PeristiwaNilai {
  id: number; jenjang: string; tahun_ajaran: string;
  kode: string; nama: string;
  cakupan: CakupanPeristiwa; kurikulum: KurikulumPeristiwa;
  jenis_rapor: JenisRapor;
  urutan: number; is_active: boolean;
  /** Terisi pada respons daftar. */
  jumlah_komponen?: number; total_bobot?: number;
}

export interface PeristiwaResp {
  peristiwa: PeristiwaNilai[];
  /** Tingkat akhir jenjang (dari urutan ref_tingkat) — dipakai cakupan. */
  tingkat_akhir: string | null;
}

export type SumberKomponen = 'manual' | 'rapor_otomatis' | 'peristiwa';

export interface KomponenNilai {
  id: number; peristiwa_id: number; nama: string; kode: string | null;
  bobot: number; sumber: SumberKomponen;
  /** Jumlah tingkat sebelumnya yang dirata-rata (hanya `rapor_otomatis`). */
  jumlah_tingkat_rapor: number | null;
  /** Peristiwa asal (hanya `peristiwa`) — mis. komponen "PTS" mengambil nilai
   *  akhir peristiwa PTS per mapel. */
  peristiwa_sumber_id: number | null;
  urutan: number; is_active: boolean;
}

export interface KomponenResp {
  komponen: KomponenNilai[];
  total_bobot: number;
  peristiwa: PeristiwaNilai;
}

export interface KkmBaris {
  kegiatan: string;
  komponen_nilai_id: number | null;
  kkm: number;
}

export interface PredikatBaris {
  id?: number;
  predikat: string;
  offset_bawah: number | null;
  keterangan?: string | null;
}

export interface Ekstrakurikuler {
  id: number; jenjang: string; tahun_ajaran: string; nama: string;
  pembimbing: string | null; is_active: boolean;
}

export interface PredikatEkskul {
  id: number; jenjang: string | null; predikat: string; deskripsi: string; urutan: number;
}

export interface PrestasiSantri {
  id: number; santri_id: number; tahun_ajaran: string; semester: string | null;
  prestasi: string; level: string | null; keterangan: string | null;
  santri?: { id: number; nama_lengkap: string };
}

export interface SelLeger {
  nilai: number | null; predikat: string | null; sumber: string | null; guru: string | null;
}

export interface KolomLeger { key: string; mapel_id: number; nama_mapel: string }

export interface BarisLeger {
  santri_id: number; nis_lokal: string | null; nama: string;
  kelas: string | null; tingkat: string | null;
  sel: Record<string, SelLeger | null>;
  rata_rata: number | null;
}

export interface LegerResp {
  peristiwa: PeristiwaNilai;
  kolom: KolomLeger[];
  baris: BarisLeger[];
  total: number; per_page: number; current_page: number; last_page: number;
}

export type ModeUrutanNomorPeserta = 'per_tingkat' | 'semua_tingkat';
export type SumberNomorPeserta = 'manual' | 'otomatis' | null;

export interface TokenNomorPeserta {
  token: string;
  label: string;
  contoh: string;
}

export interface BarisPesertaPeristiwa {
  santri_id: number;
  nama: string;
  jk: string | null;
  foto_url: string | null;
  nis_lokal: string | null;
  kelas_id: number | null;
  kelas: string | null;
  tingkat: string | null;
  no_absen: number | null;
  nomor_peserta: string | null;
  sumber_nomor: SumberNomorPeserta;
}

export interface PesertaPeristiwaResp {
  peristiwa: PeristiwaNilai;
  lembaga?: { jenjang: string; nama: string; logo_url: string | null } | null;
  pengaturan: { template: string; mode_urutan: ModeUrutanNomorPeserta };
  token: TokenNomorPeserta[];
  peserta: BarisPesertaPeristiwa[];
  ringkasan: { total: number; belum_bernomor: number; manual: number; otomatis: number };
}

export type FieldKartuPeserta =
  | 'nama' | 'nomor_peserta' | 'nis_lokal' | 'kelas' | 'tingkat'
  | 'peristiwa' | 'tahun_ajaran' | 'semester' | 'lembaga';
export type TipeElemenKartu = 'data' | 'teks' | 'foto';
export type RataTeksKartu = 'left' | 'center' | 'right';
export type GayaLatarKartu = 'klasik' | 'modern' | 'bersih' | 'foto';
export type TemplateBawaanKartu = 'klasik' | 'modern' | 'bersih';

export interface ElemenKartuPeserta {
  id: string;
  tipe: TipeElemenKartu;
  field?: FieldKartuPeserta | null;
  teks?: string | null;
  x: number;
  y: number;
  lebar: number;
  tinggi: number;
  ukuran_font: number;
  warna: string;
  tebal: boolean;
  rata: RataTeksKartu;
}

export interface DesainKartuServer {
  id: number;
  jenjang: string;
  nama: string;
  elemen: ElemenKartuPeserta[];
  warna_latar: string;
  gaya_latar: GayaLatarKartu;
  latar_ada: boolean;
  latar_url: string | null;
}

export interface PengaturanKartuPeserta {
  peristiwa_id: number;
  desain_id: number | null;
  template_bawaan: TemplateBawaanKartu;
  lebar_mm: number;
  tinggi_mm: number;
}

export interface DesainKartuResp {
  desain: DesainKartuServer[];
  pengaturan: PengaturanKartuPeserta;
}

export interface RaporMapel {
  nama_mapel: string; guru: string | null; nilai_akhir: number | null;
  predikat: string | null; terbilang: string; sumber: string | null;
}

export interface RaporResp {
  peristiwa: PeristiwaNilai;
  santri: { id: number; nama: string; nis_lokal: string | null; nisn: string | null; jk: string | null };
  identitas: { jenjang: string; kelas: string | null; tingkat: string | null; semester: string; tahun_ajaran: string };
  kop: {
    nama: string; alamat: string | null; kab_kota: string | null; logo_url: string | null;
    kepala: string | null; template_rapor: string; mode_rapor: string;
  };
  mapel: RaporMapel[];
  rekap: {
    jumlah: number | null; rata_rata: number | null;
    peringkat: number | null; peringkat_ordinal: string | null; peringkat_total: number;
  };
  catatan_wali: {
    sakit: number; izin: number; alpa: number;
    catatan: string | null; status_kenaikan: string | null;
  };
  ekskul: { nama: string; pembimbing: string | null; predikat: string | null; nilai: number | null; deskripsi: string | null }[];
  prestasi: { prestasi: string; level: string | null; keterangan: string | null }[];
  penandatangan: { wali_kelas: string | null; kepala: string | null };
}

export interface BarisRaporKelas {
  santri_id: number; nis_lokal: string | null; nama: string;
  mapel_terisi: number; mapel_total: number; lengkap: boolean; ada_catatan: boolean;
}

export interface RaporKelasResp {
  peristiwa: PeristiwaNilai;
  kolom: KolomLeger[];
  baris: BarisRaporKelas[];
  ringkasan: { santri: number; lengkap: number; tanpa_catatan: number; mapel: number };
}

type Lingkup = { jenjang?: ScalarOrArray<string>; tahun_ajaran?: ScalarOrArray<string> };

function lingkupQuery(params: Lingkup): URLSearchParams {
  const q = new URLSearchParams();
  appendQueryParam(q, 'jenjang', params.jenjang);
  appendQueryParam(q, 'tahun_ajaran', params.tahun_ajaran);
  return q;
}

export function daftarPeristiwa(params: Lingkup = {}) {
  return api<PeristiwaResp>(`/admin/penilaian/peristiwa?${lingkupQuery(params).toString()}`);
}

export function buatPeristiwa(data: {
  jenjang: string; tahun_ajaran: string; kode: string; nama: string;
  cakupan: CakupanPeristiwa; kurikulum?: KurikulumPeristiwa;
  jenis_rapor?: JenisRapor; urutan?: number; is_active?: boolean;
}) {
  return api<PeristiwaNilai>('/admin/penilaian/peristiwa', { method: 'POST', body: JSON.stringify(data) });
}

export function ubahPeristiwa(id: number, data: {
  nama?: string; cakupan?: CakupanPeristiwa; kurikulum?: KurikulumPeristiwa;
  jenis_rapor?: JenisRapor; urutan?: number; is_active?: boolean;
}) {
  return api<PeristiwaNilai>(`/admin/penilaian/peristiwa/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function hapusPeristiwa(id: number) {
  return api<{ pesan: string }>(`/admin/penilaian/peristiwa/${id}`, { method: 'DELETE' });
}

/** Muat bawaan: ASAS + ASAT + UJIAN (non-MD) + UAP, komponen, KKM 75, predikat A–D. */
export function muatBawaan(jenjang: string, tahunAjaran: string) {
  return api<{ pesan: string; peristiwa: string[] }>('/admin/penilaian/bawaan', {
    method: 'POST',
    body: JSON.stringify({ jenjang, tahun_ajaran: tahunAjaran }),
  });
}

export function daftarKomponen(peristiwaId: number) {
  return api<KomponenResp>(`/admin/penilaian/komponen?peristiwa_id=${peristiwaId}`);
}

export function buatKomponen(data: {
  peristiwa_id: number; nama: string; kode?: string | null; bobot?: number;
  sumber?: SumberKomponen; jumlah_tingkat_rapor?: number | null;
  peristiwa_sumber_id?: number | null;
  urutan?: number; is_active?: boolean;
}) {
  return api<KomponenNilai>('/admin/penilaian/komponen', { method: 'POST', body: JSON.stringify(data) });
}

export function ubahKomponen(id: number, data: {
  nama?: string; kode?: string | null; bobot?: number;
  sumber?: SumberKomponen; jumlah_tingkat_rapor?: number | null;
  peristiwa_sumber_id?: number | null;
  urutan?: number; is_active?: boolean;
}) {
  return api<KomponenNilai>(`/admin/penilaian/komponen/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function hapusKomponen(id: number) {
  return api<{ pesan: string }>(`/admin/penilaian/komponen/${id}`, { method: 'DELETE' });
}

export function daftarKkm(peristiwaId: number) {
  return api<{ baris: KkmBaris[] }>(`/admin/penilaian/kkm?peristiwa_id=${peristiwaId}`);
}

export function simpanKkm(peristiwaId: number, baris: KkmBaris[]) {
  return api<{ pesan: string }>('/admin/penilaian/kkm', {
    method: 'PUT',
    body: JSON.stringify({ peristiwa_id: peristiwaId, baris }),
  });
}

export function daftarPredikat(peristiwaId: number) {
  return api<{ baris: PredikatBaris[] }>(`/admin/penilaian/predikat?peristiwa_id=${peristiwaId}`);
}

export function simpanPredikat(peristiwaId: number, baris: PredikatBaris[]) {
  return api<{ pesan: string }>('/admin/penilaian/predikat', {
    method: 'PUT',
    body: JSON.stringify({ peristiwa_id: peristiwaId, baris }),
  });
}

/** Hitung ulang nilai akhir dari komponen. Baris impor dilewati kecuali `paksa`. */
export function hitungUlang(data: {
  peristiwa_id: number; semester: string; kelas_id?: number | null; paksa?: boolean;
}) {
  return api<{ pesan: string; dihitung: number; dilewati_impor: number; belum_lengkap: number }>(
    '/admin/penilaian/hitung',
    { method: 'POST', body: JSON.stringify(data) },
  );
}

export function daftarEkskul(params: Lingkup = {}) {
  return api<Ekstrakurikuler[]>(`/admin/penilaian/ekskul?${lingkupQuery(params).toString()}`);
}

export function buatEkskul(data: { jenjang: string; tahun_ajaran: string; nama: string; pembimbing?: string | null; is_active?: boolean }) {
  return api<Ekstrakurikuler>('/admin/penilaian/ekskul', { method: 'POST', body: JSON.stringify(data) });
}

export function ubahEkskul(id: number, data: { nama?: string; pembimbing?: string | null; is_active?: boolean }) {
  return api<Ekstrakurikuler>(`/admin/penilaian/ekskul/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function hapusEkskul(id: number) {
  return api<{ pesan: string }>(`/admin/penilaian/ekskul/${id}`, { method: 'DELETE' });
}

export function daftarPredikatEkskul() {
  return api<PredikatEkskul[]>('/admin/penilaian/predikat-ekskul');
}

export function simpanPredikatEkskul(baris: { jenjang: string | null; predikat: string; deskripsi: string; urutan?: number }[]) {
  return api<{ pesan: string }>('/admin/penilaian/predikat-ekskul', { method: 'PUT', body: JSON.stringify({ baris }) });
}

export function daftarPrestasi(params: { tahun_ajaran: string; santri_id?: number; q?: string }) {
  const q = new URLSearchParams();
  q.set('tahun_ajaran', params.tahun_ajaran);
  if (params.santri_id !== undefined) q.set('santri_id', String(params.santri_id));
  if (params.q) q.set('q', params.q);
  return api<PrestasiSantri[]>(`/admin/penilaian/prestasi?${q.toString()}`);
}

export function buatPrestasi(data: {
  santri_id: number; tahun_ajaran: string; semester?: string | null;
  prestasi: string; level?: string | null; keterangan?: string | null;
}) {
  return api<PrestasiSantri>('/admin/penilaian/prestasi', { method: 'POST', body: JSON.stringify(data) });
}

export function hapusPrestasi(id: number) {
  return api<{ pesan: string }>(`/admin/penilaian/prestasi/${id}`, { method: 'DELETE' });
}

export function legerNilai(params: {
  peristiwa_id: number; semester?: ScalarOrArray<string>;
  tingkat?: ScalarOrArray<string>; kelas_id?: ScalarOrArray<number>;
  q?: string; page?: number; per_page?: string;
}) {
  const q = new URLSearchParams();
  q.set('peristiwa_id', String(params.peristiwa_id));
  appendQueryParam(q, 'semester', params.semester);
  appendQueryParam(q, 'tingkat', params.tingkat);
  appendQueryParam(q, 'kelas_id', params.kelas_id);
  if (params.q) q.set('q', params.q);
  if (params.page) q.set('page', String(params.page));
  if (params.per_page) q.set('per_page', params.per_page);
  return api<LegerResp>(`/admin/penilaian/leger?${q.toString()}`);
}

export function daftarPesertaPeristiwa(params: {
  peristiwa_id: number; semester: string;
  tingkat?: ScalarOrArray<string>; kelas_id?: ScalarOrArray<number>; q?: string;
}) {
  const q = new URLSearchParams();
  q.set('peristiwa_id', String(params.peristiwa_id));
  q.set('semester', params.semester);
  appendQueryParam(q, 'tingkat', params.tingkat);
  appendQueryParam(q, 'kelas_id', params.kelas_id);
  if (params.q) q.set('q', params.q);
  return api<PesertaPeristiwaResp>(`/admin/penilaian/peserta-kartu?${q.toString()}`);
}

export function simpanPengaturanNomorPeserta(data: {
  peristiwa_id: number; semester: string; template: string; mode_urutan: ModeUrutanNomorPeserta;
}) {
  return api<{ pesan: string }>('/admin/penilaian/peserta-kartu/pengaturan', {
    method: 'PUT', body: JSON.stringify(data),
  });
}

export function ubahNomorPeserta(santriId: number, data: {
  peristiwa_id: number; semester: string; nomor_peserta: string | null;
}) {
  return api<{ pesan: string }>(`/admin/penilaian/peserta-kartu/${santriId}`, {
    method: 'PUT', body: JSON.stringify(data),
  });
}

export function generateNomorPeserta(data: {
  peristiwa_id: number; semester: string; template: string;
  mode_urutan: ModeUrutanNomorPeserta; buat_ulang_otomatis?: boolean;
}) {
  return api<{
    pesan: string;
    hasil: { dibuat: number; dipertahankan_manual: number; dipertahankan_otomatis: number; total_peserta: number };
  }>('/admin/penilaian/peserta-kartu/generate', {
    method: 'POST', body: JSON.stringify(data),
  });
}

export function daftarDesainKartu(peristiwaId: number) {
  const q = new URLSearchParams({ peristiwa_id: String(peristiwaId) });
  return api<DesainKartuResp>(`/admin/penilaian/desain-kartu?${q.toString()}`);
}

export function simpanDesainKartu(data: {
  peristiwa_id: number;
  id?: number;
  nama: string;
  warna_latar: string;
  gaya_latar: GayaLatarKartu;
  elemen: ElemenKartuPeserta[];
  latar?: File | null;
  hapus_latar?: boolean;
}) {
  const fd = new FormData();
  fd.set('peristiwa_id', String(data.peristiwa_id));
  if (data.id != null) fd.set('id', String(data.id));
  fd.set('nama', data.nama);
  fd.set('warna_latar', data.warna_latar);
  fd.set('gaya_latar', data.gaya_latar);
  fd.set('elemen', JSON.stringify(data.elemen));
  if (data.latar) fd.set('latar', data.latar);
  if (data.hapus_latar) fd.set('hapus_latar', '1');
  return apiUpload<{ pesan: string; desain: DesainKartuServer }>('/admin/penilaian/desain-kartu', fd);
}

export function simpanPengaturanKartu(data: {
  peristiwa_id: number;
  desain_id: number | null;
  template_bawaan: TemplateBawaanKartu | null;
  lebar_mm: number;
  tinggi_mm: number;
}) {
  return api<{ pesan: string; pengaturan: PengaturanKartuPeserta }>('/admin/penilaian/pengaturan-kartu', {
    method: 'PUT', body: JSON.stringify(data),
  });
}

export function hapusDesainKartu(id: number) {
  return api<{ pesan: string }>(`/admin/penilaian/desain-kartu/${id}`, { method: 'DELETE' });
}

export function unduhLeger(params: {
  peristiwa_id: number; semester?: ScalarOrArray<string>;
  tingkat?: ScalarOrArray<string>; kelas_id?: ScalarOrArray<number>; q?: string;
}) {
  const q = new URLSearchParams();
  q.set('peristiwa_id', String(params.peristiwa_id));
  appendQueryParam(q, 'semester', params.semester);
  appendQueryParam(q, 'tingkat', params.tingkat);
  appendQueryParam(q, 'kelas_id', params.kelas_id);
  if (params.q) q.set('q', params.q);
  return downloadFile(`/admin/penilaian/leger/unduh?${q.toString()}`, 'leger-nilai.xlsx');
}

export function ambilRapor(params: {
  santri_id: number; peristiwa_id: number; semester: string; peringkat?: '3' | '10' | 'semua';
}) {
  const q = new URLSearchParams();
  q.set('santri_id', String(params.santri_id));
  q.set('peristiwa_id', String(params.peristiwa_id));
  q.set('semester', params.semester);
  if (params.peringkat) q.set('peringkat', params.peringkat);
  return api<RaporResp>(`/admin/penilaian/rapor?${q.toString()}`);
}

export function raporKelas(params: {
  peristiwa_id: number; semester: string; kelas_id: number;
}) {
  const q = new URLSearchParams();
  q.set('peristiwa_id', String(params.peristiwa_id));
  q.set('semester', params.semester);
  q.set('kelas_id', String(params.kelas_id));
  return api<RaporKelasResp>(`/admin/penilaian/rapor-kelas?${q.toString()}`);
}

export type TipeImpor = 'nilai' | 'catatan_wali' | 'prestasi' | 'ekskul';

export function unduhTemplatePenilaian(tipe: TipeImpor, params: {
  jenjang: string; tahun_ajaran: string; peristiwa_id?: number; kelas_id?: number;
}) {
  const q = new URLSearchParams();
  q.set('tipe', tipe);
  q.set('jenjang', params.jenjang);
  q.set('tahun_ajaran', params.tahun_ajaran);
  if (params.peristiwa_id !== undefined) q.set('peristiwa_id', String(params.peristiwa_id));
  if (params.kelas_id !== undefined) q.set('kelas_id', String(params.kelas_id));
  return downloadFile(`/admin/penilaian/import-template?${q.toString()}`, `template-import-penilaian-${tipe}.xlsx`);
}

export interface KirimPotonganPenilaian {
  sesi_id?: number;
  mode: 'periksa' | 'eksekusi';
  total: number;
  tipe: TipeImpor;
  tahun_ajaran: string;
  semester: string;
  jenjang: string[];
  peristiwa_id?: number | null;
  komponen_id?: number | null;
  baris: Record<string, unknown>[];
  terakhir?: boolean;
}

export function potongImportPenilaian(input: KirimPotonganPenilaian) {
  return api<{
    sesi_id: number; offset: number; total: number; selesai: boolean;
    ringkasan: { baris_diproses: number; baris_valid: number; baris_gagal: number; baris_dilewati: number; dibuat: number; diperbarui: number };
    galat_baru: number;
    galat_contoh: { baris: number; nis_lokal: string | null; kolom: string; pesan: string }[];
    galat_unduh: boolean;
  }>('/admin/penilaian/import-potong', { method: 'POST', body: JSON.stringify(input) });
}

export function batalPotongPenilaian(sesiId: number) {
  return api<{ pesan: string }>(`/admin/penilaian/import-potong/${sesiId}/batal`, { method: 'POST' });
}

export function unduhGalatPenilaian(sesiId: number) {
  return downloadFile(`/admin/penilaian/import-potong/${sesiId}/galat`, 'galat-import-penilaian.csv');
}
