import { api, apiUpload, downloadFile } from './client';
import type { Paginate } from './master';
import type { ImportError, ImportPeriksa, LembagaSantri, Santri, SantriPenuh } from './santri';

// ---------- Riwayat belajar (102) + siklus akademik ----------

// ---------- Halaman MI-MD (3 tabel berdampingan) ----------

export interface MiMdBarisMi {
  santri_id: number;
  nama: string;
  nis_mi: string | null;
  kelas_mi: string | null;
}

export interface MiMdBarisMd {
  santri_id: number;
  nama: string;
  nis_md: string | null;
  kelas_md: string | null;
  juga_mi: boolean;
}

export interface MiMdBarisBeda {
  santri_id: number;
  nama: string;
  kelas_mi: string | null;
  kelas_md: string | null;
}

export interface MiMdData {
  lembaga: { mi_id: string; md_id: string };
  tahun_ajaran: string | null;
  mi_only: MiMdBarisMi[];
  md_semua: MiMdBarisMd[];
  beda_kelas: MiMdBarisBeda[];
}

/** Tiga dataset MI-MD untuk satu tahun ajaran (default TA aktif di backend). */
export function listMiMd(params: { tahun_ajaran?: string } = {}) {
  const q = params.tahun_ajaran ? `?tahun_ajaran=${encodeURIComponent(params.tahun_ajaran)}` : '';
  return api<MiMdData>(`/admin/mi-md${q}`);
}

/** Sejajarkan kelas by-nama dua arah; hasil per item berhasil/gagal. */
export function samakanKelasMiMd(items: Array<{ santri_id: number; arah: 'ke_mi' | 'ke_md' }>) {
  return api<{ pesan: string; berhasil: number; gagal: Array<{ santri_id: number; pesan: string }> }>(
    '/admin/mi-md/samakan-kelas',
    { method: 'POST', body: JSON.stringify({ items }) },
  );
}

/** Daftarkan santri MI Only ke keanggotaan MD (NIS mewarisi MI). */
export function daftarkanMdMiMd(items: Array<{ santri_id: number }>) {
  return api<{ pesan: string; berhasil: number; gagal: Array<{ santri_id: number; pesan: string }> }>(
    '/admin/mi-md/daftarkan-md',
    { method: 'POST', body: JSON.stringify({ items }) },
  );
}

/** Hapus FISIK jejak MD (anggota + riwayat); tanpa arsip. */
export function hapusMdMiMd(items: Array<{ santri_id: number }>) {
  return api<{ pesan: string; berhasil: number; gagal: Array<{ santri_id: number; pesan: string }> }>(
    '/admin/mi-md/hapus-md',
    { method: 'POST', body: JSON.stringify({ items }) },
  );
}

export interface MutasiKeluar {
  id: number;
  santri_id: number;
  jenjang: string;
  kelas_terakhir_id: number | null;
  tanggal_mutasi: string | null;
  alasan_mutasi: string | null;
  no_surat: string | null;
  nama_sekolah_tujuan: string | null;
  keterangan: string | null;
  santri?: { id: number; nama_lengkap: string; nisn: string | null } | null;
  lembaga?: { jenjang: string; nama: string } | null;
  kelas_terakhir?: { id: number; nama_kelas: string } | null;
}

export interface Alumni {
  id: number;
  santri_id: number;
  tahun_ajaran_lulus: string;
  nomor_ijazah: string | null;
  no_surat_ijazah: string | null;
  tanggal_lulus: string | null;
  kegiatan_setelah_lulus: string | null;
  penyerahan_ijazah: string | null;
  melanjutkan: string | null;
  catatan: string | null;
  kelas_lulus_id: number | null;
  santri?: { id: number; nama_lengkap: string; nisn: string | null } | null;
  lembaga_lulus?: { jenjang: string; nama: string } | null;
  tahunAjaranLulus?: { nama: string } | null;
  kelas_lulus?: { id: number; nama_kelas: string } | null;
}

/** Baris riwayat belajar — muatan penuh 3 tabel (`daftar-kelas`):
 *  `riwayat_belajar` + `santri` (semua kolom) + `lembaga_anggota`. */
export interface RiwayatRow {
  id: number;
  santri_id: number;
  tahun_ajaran: string;
  jenjang: string;
  kelas_id: number | null;
  semester: string;
  tgl_masuk: string | null;
  no_absen: number | null;
  tingkat: string | null;
  status_awal: string | null;
  status_akhir: string | null;
  /** Jejak akademik aktif: 'Ya' | 'Tidak'. */
  is_active_riwayat: string;
  created_at?: string | null;
  updated_at?: string | null;
  /** NIS lokal dari keanggotaan (`lembaga_santri`) — dilampirkan backend pada daftar. */
  nis_lokal?: string | null;
  /** Baris keanggotaan santri+lembaga (aktif diutamakan) — muatan penuh. */
  lembaga_anggota?: LembagaSantri | null;
  santri?: SantriPenuh | null;
  kelas?: { id: number; nama_kelas: string; tingkat: string | null } | null;
  lembaga?: { jenjang: string; nama: string } | null;
  tahunAjaran?: { nama: string } | null;
}

/** Tambah param berulang `key[]=…` untuk filter multi (nilai tunggal/array). */
function appendMulti(q: URLSearchParams, key: string, v?: string | number | Array<string | number>) {
  if (v == null) return;
  const arr = Array.isArray(v) ? v : [v];
  for (const x of arr) if (x !== '') q.append(`${key}[]`, String(x));
}

export function listRiwayatBelajar(params: {
  jenjang?: string;
  tahun_ajaran?: string;
  semester?: string;
  tingkat?: string | string[];
  kelas_id?: number | number[];
  tanpa_kelas?: boolean;
  dengan_kelas?: boolean;
  q?: string;
  is_active_riwayat?: boolean;
  status_awal?: string;
  status_akhir?: string;
  sort?: string[];
  arah?: 'naik' | 'turun';
  page?: number;
  per_page?: number;
  signal?: AbortSignal;
} = {}) {
  const q = new URLSearchParams();
  if (params.jenjang) q.set('jenjang', params.jenjang);
  if (params.tahun_ajaran) q.set('tahun_ajaran', params.tahun_ajaran);
  if (params.semester) q.set('semester', params.semester);
  if (params.tingkat) appendMulti(q, 'tingkat', params.tingkat);
  if (params.kelas_id) appendMulti(q, 'kelas_id', params.kelas_id);
  if (params.tanpa_kelas) q.set('tanpa_kelas', '1');
  if (params.dengan_kelas) q.set('dengan_kelas', '1');
  if (params.q) q.set('q', params.q);
  if (params.is_active_riwayat !== undefined) q.set('is_active_riwayat', params.is_active_riwayat ? '1' : '0');
  if (params.status_akhir) q.set('status_akhir', params.status_akhir);
  if (params.status_awal) q.set('status_awal', params.status_awal);
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  q.set('page', String(params.page ?? 1));
  if (params.per_page != null) q.set('per_page', String(params.per_page));
  return api<Paginate<RiwayatRow>>(`/admin/riwayat-belajar?${q.toString()}`, { signal: params.signal });
}

/** Dialog input riwayat / penerimaan santri ke lembaga (satu pintu). */
export function createRiwayatBelajar(input: {
  santri_id: number;
  jenjang: string;
  tahun_ajaran: string;
  kelas_id?: number | null;
  tingkat?: string | null;
  no_absen?: number | null;
  status_awal?: string | null;
  tgl_masuk?: string | null;
  nis_lokal?: string | null;
}) {
  return api<{ pesan: string; data: RiwayatRow }>('/admin/riwayat-belajar', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function setKelas(riwayatId: number, kelasId: number) {
  return api<{ pesan: string; data: RiwayatRow }>(`/admin/riwayat-belajar/${riwayatId}/set-kelas`, {
    method: 'POST',
    body: JSON.stringify({ kelas_id: kelasId }),
  });
}

export function pindahKelas(riwayatId: number, kelasBaruId: number) {
  return api<{ pesan: string; data: RiwayatRow }>(`/admin/riwayat-belajar/${riwayatId}/pindah-kelas`, {
    method: 'POST',
    body: JSON.stringify({ kelas_id: kelasBaruId }),
  });
}

/** Batalkan penempatan kelas (kelas_id=NULL). */
export function keluarKelas(riwayatId: number) {
  return api<{ pesan: string; data: RiwayatRow }>(`/admin/riwayat-belajar/${riwayatId}/keluar-kelas`, {
    method: 'POST',
  });
}

/** Ubah kolom skalar riwayat (semester/tingkat/no_absen/tgl_masuk).
 *  Status & kelas dikunci backend (pintu lifecycle / set-pindah-kelas). */
export function updateRiwayatBelajar(id: number, changes: Record<string, string | number | null>) {
  return api<{ pesan: string; data: RiwayatRow }>(`/admin/riwayat-belajar/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  });
}

/** Batalkan baris riwayat aktif (hard delete fisik). */
export function batalRiwayat(riwayatId: number) {
  return api<{ pesan: string }>(`/admin/riwayat-belajar/${riwayatId}`, {
    method: 'DELETE',
  });
}

/** Panel kiri halaman ganjil: anggota aktif tanpa riwayat (siap dipanah masuk). */
export function listBelumMasukRiwayat(params: {
  jenjang: string;
  tahun_ajaran: string;
  q?: string;
  page?: number;
  per_page?: number;
  signal?: AbortSignal;
}) {
  const q = new URLSearchParams();
  q.set('jenjang', params.jenjang);
  q.set('tahun_ajaran', params.tahun_ajaran);
  if (params.q) q.set('q', params.q);
  q.set('page', String(params.page ?? 1));
  if (params.per_page != null) q.set('per_page', String(params.per_page));
  return api<Paginate<LembagaSantri>>(`/admin/riwayat-belajar/belum-masuk?${q.toString()}`, { signal: params.signal });
}

/** Panel kiri halaman Pindah Semester: ganjil aktif tanpa baris genap. */
export function listBelumGenap(params: {
  jenjang: string;
  tahun_ajaran: string;
  tingkat?: string | string[];
  kelas_id?: number | number[];
  q?: string;
  page?: number;
  per_page?: number;
  signal?: AbortSignal;
}) {
  const q = new URLSearchParams();
  q.set('jenjang', params.jenjang);
  q.set('tahun_ajaran', params.tahun_ajaran);
  if (params.tingkat) appendMulti(q, 'tingkat', params.tingkat);
  if (params.kelas_id) appendMulti(q, 'kelas_id', params.kelas_id);
  if (params.q) q.set('q', params.q);
  q.set('page', String(params.page ?? 1));
  if (params.per_page != null) q.set('per_page', String(params.per_page));
  return api<Paginate<RiwayatRow>>(`/admin/riwayat-belajar/belum-genap?${q.toString()}`, { signal: params.signal });
}

// ---------- Import riwayat belajar (terpisah dari import identitas) ----------

export function unduhTemplateRiwayatBelajar() {
  return downloadFile('/admin/riwayat-belajar/import-template', 'template-import-riwayat-belajar.xlsx');
}

export function importRiwayatBelajar(input: { file: File }) {
  const fd = new FormData();
  fd.set('file', input.file);
  return apiUpload<{ pesan: string; errors?: ImportError[] }>('/admin/riwayat-belajar/import-lengkap', fd);
}

export function periksaImportRiwayatBelajar(input: { file: File }) {
  const fd = new FormData();
  fd.set('file', input.file);
  return apiUpload<ImportPeriksa>('/admin/riwayat-belajar/import-periksa', fd);
}

// ---------- Import riwayat bertahap (potongan JSON dari browser) ----------

export interface ImportPotongRingkasan {
  baris_diproses: number;
  baris_valid: number;
  baris_gagal: number;
  baris_dilewati: number;
  dibuat: number;
  diperbarui: number;
}

export interface ImportPotongGalat {
  baris: number;
  nis_lokal: string | null;
  kolom: string;
  pesan: string;
}

export interface ImportPotongHasil {
  sesi_id: number;
  offset: number;
  total: number;
  selesai: boolean;
  ringkasan: ImportPotongRingkasan;
  galat_baru: number;
  galat_contoh: ImportPotongGalat[];
  galat_unduh: boolean;
}

/** Kirim satu potongan baris (maks 1000); panggilan pertama tanpa sesi_id
 *  membuat sesi (wajib mode + total). */
export function potongImportRiwayat(input: {
  sesi_id?: number;
  mode: 'periksa' | 'eksekusi';
  total?: number;
  baris: Record<string, unknown>[];
  terakhir?: boolean;
}) {
  return api<ImportPotongHasil>('/admin/riwayat-belajar/import-potong', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Batalkan sesi import bertahap milik sendiri. */
export function batalPotongImport(sesiId: number) {
  return api<{ pesan: string }>(`/admin/riwayat-belajar/import-potong/${sesiId}/batal`, {
    method: 'POST',
  });
}

/** Unduh CSV galat sesi milik sendiri. */
export function unduhGalatPotong(sesiId: number) {
  return downloadFile(`/admin/riwayat-belajar/import-potong/${sesiId}/galat`, 'galat-import-riwayat.csv');
}

// ---------- Daftar kelas & rekap ----------

export function daftarKelas(params: {
  jenjang: string;
  tahun_ajaran?: string;
  semester?: string;
  kelas_id?: number;
  tingkat?: string;
  /** Basis status_akhir: aktif = gabungan 5 status; nonaktif = keluar. */
  kelompok_status?: 'aktif' | 'nonaktif';
  /** Matikan default TA/semester agar bisa lintas periode. */
  lintas_periode?: boolean;
}) {
  const q = new URLSearchParams({ jenjang: params.jenjang });
  if (params.tahun_ajaran) q.set('tahun_ajaran', params.tahun_ajaran);
  if (params.semester) q.set('semester', params.semester);
  if (params.kelas_id) q.set('kelas_id', String(params.kelas_id));
  if (params.tingkat) q.set('tingkat', params.tingkat);
  if (params.kelompok_status) q.set('kelompok_status', params.kelompok_status);
  if (params.lintas_periode) q.set('lintas_periode', '1');
  return api<{ jenjang: string; tahun_ajaran: string | null; semester: string | null; data: RiwayatRow[] }>(
    `/admin/akademik/daftar-kelas?${q.toString()}`,
  );
}

export interface RekapSantri {
  total_aktif: number;
  per_tahun_ajaran: { tahun_ajaran: string; jumlah_riwayat_aktif: number; l: number; p: number }[];
  per_tingkat: { lembaga: string | null; tingkat: string | null; jumlah: number; l: number; p: number }[];
  per_kelas: {
    kelas_id: number;
    kelas: string;
    tingkat: string | null;
    lembaga: string | null;
    tahun_ajaran: string | null;
    kapasitas: number | null;
    terisi: number;
    l: number;
    p: number;
    sisa: number | null;
  }[];
  usia_per_tingkat: {
    tingkat: string | null;
    jumlah: number;
    rata_usia: number;
    min: number;
    max: number;
    kelompok: Record<string, number>;
  }[];
}

export function rekapSantri(params: { jenjang?: string; tahun_ajaran?: string; semester?: string; keaktifan?: string } = {}) {
  const q = new URLSearchParams();
  if (params.jenjang) q.set('jenjang', params.jenjang);
  if (params.tahun_ajaran) q.set('tahun_ajaran', params.tahun_ajaran);
  if (params.semester) q.set('semester', params.semester);
  if (params.keaktifan) q.set('keaktifan', params.keaktifan);
  return api<RekapSantri>(`/admin/akademik/rekap-santri?${q.toString()}`);
}

// ---------- Aksi siklus ----------

export function listMutasiKeluar(params: { jenjang?: string; q?: string; sort?: string[]; arah?: 'naik' | 'turun'; page?: number; per_page?: number } = {}) {
  const q = new URLSearchParams();
  if (params.jenjang) q.set('jenjang', params.jenjang);
  if (params.q) q.set('q', params.q);
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  q.set('page', String(params.page ?? 1));
  if (params.per_page != null) q.set('per_page', String(params.per_page));
  return api<Paginate<MutasiKeluar>>(`/admin/mutasi-keluar?${q.toString()}`);
}

export function listAlumni(
  params: { jenjang?: string; tahun_ajaran_lulus?: string; q?: string; sort?: string[]; arah?: 'naik' | 'turun'; page?: number; per_page?: number } = {},
) {
  const q = new URLSearchParams();
  if (params.jenjang) q.set('jenjang', params.jenjang);
  if (params.tahun_ajaran_lulus) q.set('tahun_ajaran_lulus', params.tahun_ajaran_lulus);
  if (params.q) q.set('q', params.q);
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  q.set('page', String(params.page ?? 1));
  if (params.per_page != null) q.set('per_page', String(params.per_page));
  return api<Paginate<Alumni>>(`/admin/alumni?${q.toString()}`);
}

// ---------- Import arsip mutasi keluar ----------

export interface ImportMutasiRingkasan {
  baris_diproses: number;
  baris_valid: number;
  baris_gagal: number;
  dibuat: number;
  dilewati: number;
}

export interface ImportMutasiHasil {
  pesan: string;
  siap_import: boolean;
  ringkasan: ImportMutasiRingkasan;
  errors: ImportError[];
}

/** Unduh template Excel import arsip mutasi keluar. */
export function unduhTemplateMutasi() {
  return downloadFile('/admin/mutasi-keluar/import-template', 'template-import-mutasi-keluar.xlsx');
}

function formImportMutasi(file: File) {
  const fd = new FormData();
  fd.set('file', file);
  return fd;
}

/** Periksa file arsip mutasi tanpa menulis (dry-run). */
export function periksaImportMutasi(file: File) {
  return apiUpload<ImportMutasiHasil>('/admin/mutasi-keluar/import-periksa', formImportMutasi(file));
}

/** Eksekusi import arsip mutasi (baris sama dilewati, gagal dilaporkan). */
export function importMutasiFile(file: File) {
  return apiUpload<{ pesan: string; ringkasan: ImportMutasiRingkasan; errors?: ImportError[] }>(
    '/admin/mutasi-keluar/import',
    formImportMutasi(file),
  );
}

/** Salin ganjil→genap massal per lembaga; tanpa `siswa` = semua baris ganjil aktif. */
export function salinGenapMassal(input: {
  jenjang: string;
  tanggal_masuk: string;
  siswa?: { santri_id: number; kelas_id?: number; no_absen?: number }[];
}) {
  return api<{ pesan: string; berhasil: number; gagal: { santri_id: number | null; pesan: string }[] }>(
    '/admin/akademik/salin-genap',
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export interface NaikKelasItem {
  santri_id: number;
  status: 'naik' | 'tidak_naik';
  tgl_masuk?: string;
  no_absen?: number;
}

export function naikKelasMassal(input: {
  jenjang: string;
  tahun_ajaran_baru: string;
  tingkat: string;
  siswa: NaikKelasItem[];
}) {
  return api<{ pesan: string; berhasil: number; gagal: { santri_id: number | null; pesan: string }[] }>(
    '/admin/akademik/naik-kelas',
    { method: 'POST', body: JSON.stringify(input) },
  );
}

/** Batalkan hasil kenaikan: hapus baris baru + buka kembali baris asal. */
export function batalKenaikan(santriId: number, jenjang: string) {
  return api<{ pesan: string }>(
    `/admin/santri/${santriId}/batal-kenaikan`,
    { method: 'POST', body: JSON.stringify({ jenjang }) },
  );
}

/** Batalkan salin semester: hapus baris genap + buka kembali ganjil (TA sama). */
export function batalSalin(santriId: number, jenjang: string) {
  return api<{ pesan: string }>(
    `/admin/santri/${santriId}/batal-salin`,
    { method: 'POST', body: JSON.stringify({ jenjang }) },
  );
}

/** Kenaikan otomatis: TA + kelas tujuan dibuatkan bila belum ada.
 *  Baris hasil memuat kelas/tingkat/TA tujuan yang baru dibuat. */
export interface HasilKenaikan { santri_id: number; nama: string | null; kelas: string | null; tingkat: string | null; tahun_ajaran: string | null; }

export function naikKelasOtomatis(input: {
  jenjang: string;
  siswa: { santri_id: number; status: 'naik' | 'tidak_naik'; tgl_masuk: string }[];
}) {
  return api<{ pesan: string; berhasil: number; gagal: { santri_id: number | null; pesan: string }[]; data: HasilKenaikan[] }>(
    '/admin/akademik/naik-kelas-otomatis',
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function lulusSantri(
  santriId: number,
  input: {
    jenjang: string;
    tahun_ajaran_lulus: string;
    tanggal_lulus: string;
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

export function tidakLulusSantri(santriId: number, jenjang: string) {
  return api<{ pesan: string; data: RiwayatRow }>(`/admin/santri/${santriId}/tidak-lulus`, {
    method: 'POST',
    body: JSON.stringify({ jenjang }),
  });
}

export function mutasiSantri(
  santriId: number,
  input: {
    jenjang: string;
    tanggal_mutasi: string;
    alasan_mutasi: string;
    kelas_terakhir_id?: number;
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

export function berhentiJenjang(santriId: number, jenjang: string) {
  return api<{ pesan: string; data: unknown }>(`/admin/santri/${santriId}/berhenti-jenjang`, {
    method: 'POST',
    body: JSON.stringify({ jenjang }),
  });
}

/** Profil santri: identitas + keanggotaan + riwayat + mutasi + alumni. */
export interface ProfilSantri {
  santri: Santri;
  keanggotaan: import('./santri').LembagaSantri[];
  riwayat: RiwayatRow[];
  mutasi: MutasiKeluar[];
  alumni: Alumni[];
}

export function profilSantri(santriId: number) {
  return api<ProfilSantri>(`/admin/santri/${santriId}/profil`);
}
