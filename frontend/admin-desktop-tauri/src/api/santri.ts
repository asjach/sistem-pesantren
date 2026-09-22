import { api, apiUpload, downloadFile } from './client';
import type { Paginate } from './master';

// ---------- Buku Induk santri (identitas murni) + keanggotaan per lembaga ----------

/** Keanggotaan santri di satu lembaga (`lembaga_santri`). */
export interface LembagaSantri {
  id: number;
  santri_id: number;
  jenjang: string;
  nis_lokal: string | null;
  nis_kemenag: string | null;
  tahaj_masuk: string | null;
  tingkat_masuk: string | null;
  no_urut: number | null;
  nama_sekolah_asal: string | null;
  npsn_sekolah_asal: string | null;
  nss_sekolah_asal: string | null;
  alamat_sekolah_asal: string | null;
  /** Keaktifan keanggotaan: 'Ya' | 'Tidak'. */
  is_active_lembaga: string;
  tgl_masuk: string | null;
  tgl_selesai: string | null;
  lembaga?: { jenjang: string; nama: string; nsm?: string | null } | null;
  /** Identitas santri lengkap (dipakai halaman Keanggotaan untuk menampilkan/mengedit). */
  santri?: SantriPenuh | null;
}

/** Daftar keanggotaan lintas santri (halaman Keanggotaan terpusat). */
export function listKeanggotaan(params: {
  jenjang?: string | null;
  is_active_lembaga?: boolean | null;
  tanpa_nis?: boolean;
  search?: string;
  sort?: string[];
  arah?: 'naik' | 'turun';
  page?: number;
  per_page?: number;
} = {}) {
  const q = new URLSearchParams();
  if (params.jenjang != null) q.set('jenjang', params.jenjang);
  if (params.is_active_lembaga != null) q.set('is_active_lembaga', params.is_active_lembaga ? '1' : '0');
  if (params.tanpa_nis) q.set('tanpa_nis', '1');
  if (params.search) q.set('search', params.search);
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  q.set('page', String(params.page ?? 1));
  q.set('per_page', String(params.per_page ?? 50));
  return api<Paginate<LembagaSantri>>(`/admin/lembaga-santri?${q.toString()}`);
}

/** Identitas santri — tanpa kolom relasional (lembaga/kelas ada di keanggotaan/riwayat). */
export interface Santri {
  id: number;
  nama_lengkap: string;
  nama_singkat: string | null;
  nik: string | null;
  nisn: string | null;
  tmp_lahir: string | null;
  tgl_lahir: string | null;
  jk: string | null;
  tipe_santri: string | null;
  /** Keaktifan pesantren (turunan): 'Ya' | 'Tidak'. */
  is_active_pst: string;
  foto_url?: string | null;
  lembaga_aktif?: LembagaSantri[];
}

/** Seluruh kolom profil `santri` (cermin `Santri::KOLOM_PROFIL` backend).
 *  Opsional agar endpoint ringkas (daftar, opsi) tetap kompatibel. */
export interface SantriPenuh extends Santri {
  anak_ke?: number | null;
  j_saudara?: number | null;
  no_hp_santri?: string | null;
  email_santri?: string | null;
  agama?: string | null;
  cita_cita?: string | null;
  hobi?: string | null;
  kebutuhan_khusus?: string | null;
  kebutuhan_disabilitas?: string | null;
  nomor_kip?: string | null;
  ayah_nama?: string | null;
  ayah_nik?: string | null;
  ayah_tmp_lahir?: string | null;
  ayah_tgl_lahir?: string | null;
  ayah_status?: string | null;
  ayah_pekerjaan?: string | null;
  ayah_pendidikan?: string | null;
  ayah_penghasilan?: string | null;
  ayah_telp?: string | null;
  ayah_alamat?: string | null;
  ayah_status_tempat_tinggal?: string | null;
  ibu_nama?: string | null;
  ibu_nik?: string | null;
  ibu_tmp_lahir?: string | null;
  ibu_tgl_lahir?: string | null;
  ibu_status?: string | null;
  ibu_pekerjaan?: string | null;
  ibu_pendidikan?: string | null;
  ibu_penghasilan?: string | null;
  ibu_telp?: string | null;
  ibu_alamat?: string | null;
  ibu_status_tempat_tinggal?: string | null;
  wali_nama?: string | null;
  wali_nik?: string | null;
  wali_tmp_lahir?: string | null;
  wali_tgl_lahir?: string | null;
  wali_status?: string | null;
  wali_pekerjaan?: string | null;
  wali_pendidikan?: string | null;
  wali_penghasilan?: string | null;
  wali_telp?: string | null;
  wali_alamat?: string | null;
  wali_status_tempat_tinggal?: string | null;
  yang_membiayai?: string | null;
  no_kk?: string | null;
  kepala_keluarga?: string | null;
  kewarganegaraan?: string | null;
  bahasa_sehari?: string | null;
  status_tempat_tinggal?: string | null;
  jarak_ke_pesantren?: string | null;
  waktu_tempuh?: string | null;
  transportasi?: string | null;
  tanggal_masuk?: string | null;
  provinsi?: string | null;
  kab_kota?: string | null;
  kecamatan?: string | null;
  desa_kelurahan?: string | null;
  rt?: string | null;
  rw?: string | null;
  alamat?: string | null;
  kode_pos?: string | null;
}

export interface DokumenSantri {
  id: number;
  santri_id: number | null;
  psb_calon_santri_id: number | null;
  jenis_dokumen_santri: string;
  path_file: string | null;
  status_verifikasi: 'menunggu' | 'valid' | 'ditolak';
  tidak_memiliki: boolean;
  catatan: string | null;
  file_url?: string;
}

export function listSantri(
  params: { is_active_pst?: boolean; jenjang?: string; q?: string; sort?: string[]; arah?: 'naik' | 'turun'; page?: number; per_page?: number; signal?: AbortSignal } = {},
) {
  const q = new URLSearchParams();
  if (params.is_active_pst !== undefined) q.set('is_active_pst', params.is_active_pst ? '1' : '0');
  if (params.jenjang) q.set('jenjang', params.jenjang);
  if (params.q) q.set('q', params.q);
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  q.set('page', String(params.page ?? 1));
  if (params.per_page != null) q.set('per_page', String(params.per_page));
  return api<Paginate<Santri>>(`/admin/santri?${q.toString()}`, { signal: params.signal });
}

export function createSantri(input: Record<string, string | number | null>) {
  return api<{ pesan: string; data: Santri }>('/admin/santri', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateSantri(id: number, changes: Record<string, string | number | null>) {
  return api<{ pesan: string; data: Santri }>(`/admin/santri/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  });
}

export interface ImportError {
  row: number;
  attribute: string;
  errors: string[];
}

export interface ImportPeriksa {
  pesan: string;
  siap_import: boolean;
  ringkasan: { baris_diproses: number; baris_valid: number; baris_gagal: number; baris_diperbarui?: number; baris_riwayat_dibuat?: number };
  errors: ImportError[];
}

// ---------- Import gabungan siswa (identitas + keanggotaan) ----------

/** Unduh template gabungan: blok keanggotaan dulu, lalu seluruh kolom profil. */
export function unduhTemplateSantriGabungan() {
  return downloadFile('/admin/santri/import-template-gabungan', 'template-import-siswa-gabungan.xlsx');
}

/** Unduh data existing (pra-isi santri_id) untuk round-trip update. Tanpa argumen = semua lingkup. */
export function unduhDataSantriGabungan(jenjangs?: string[]) {
  const q = jenjangs?.length ? `?${jenjangs.map((j) => `jenjang[]=${encodeURIComponent(j)}`).join('&')}` : '';
  return downloadFile(
    `/admin/santri/data-gabungan${q}`,
    jenjangs?.length === 1 ? `data-siswa-${jenjangs[0]}.xlsx` : 'data-siswa-pilihan.xlsx',
  );
}

export function importSantriGabungan(input: { file: File }) {
  const fd = new FormData();
  fd.set('file', input.file);
  return apiUpload<{ pesan: string; errors?: ImportError[] }>('/admin/santri/import-gabungan', fd);
}

/** Validasi file gabungan tanpa menulis (dry-run). */
export function periksaImportSantriGabungan(input: { file: File }) {
  const fd = new FormData();
  fd.set('file', input.file);
  return apiUpload<ImportPeriksa>('/admin/santri/import-periksa-gabungan', fd);
}

// ---------- Keanggotaan per lembaga ----------

export function listLembagaSantri(santriId: number) {
  return api<{ pesan: string; data: LembagaSantri[] }>(`/admin/santri/${santriId}/lembaga`);
}

export function createLembagaSantri(
  santriId: number,
  input: {
    jenjang: string;
    nis_lokal?: string | null;
    nis_kemenag?: string | null;
    tahaj_masuk?: string | null;
    tingkat_masuk?: string | null;
    no_urut?: number | null;
    nama_sekolah_asal?: string | null;
    npsn_sekolah_asal?: string | null;
    nss_sekolah_asal?: string | null;
    alamat_sekolah_asal?: string | null;
    is_active_lembaga?: 'Ya' | 'Tidak';
    tgl_masuk?: string | null;
    tgl_selesai?: string | null;
  },
) {
  return api<{ pesan: string; data: LembagaSantri }>(`/admin/santri/${santriId}/lembaga`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateLembagaSantri(
  id: number,
  input: {
    nis_lokal?: string | null;
    nis_kemenag?: string | null;
    tahaj_masuk?: string | null;
    tingkat_masuk?: string | null;
    no_urut?: number | null;
    nama_sekolah_asal?: string | null;
    npsn_sekolah_asal?: string | null;
    nss_sekolah_asal?: string | null;
    alamat_sekolah_asal?: string | null;
    is_active_lembaga?: 'Ya' | 'Tidak';
    tgl_masuk?: string | null;
    tgl_selesai?: string | null;
  },
) {
  return api<{ pesan: string; data: LembagaSantri }>(`/admin/lembaga-santri/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/** Generate NIS Kemenag manual: NSM(12) + YY tahun diterima + 4 digit akhir NIS lokal. */
export function generateNisk(id: number) {
  return api<{ pesan: string; data: LembagaSantri }>(`/admin/lembaga-santri/${id}/generate-nisk`, {
    method: 'POST',
  });
}

/** Generate NISK massal untuk semua baris cocok filter (lewati: sudah ada,
 *  NIS lokal kosong, lembaga MD). */
export function generateNiskBulk(filter: { jenjang?: string; is_active_lembaga?: boolean; search?: string }) {
  return api<{ pesan: string; data: { berhasil: number; dilewati: number; gagal: { id: number; pesan: string }[] } }>(
    '/admin/lembaga-santri/generate-nisk-bulk',
    { method: 'POST', body: JSON.stringify(filter) },
  );
}

// ---------- Samakan NIS paket MI↔MD ----------

export interface SamakanNisRincian {
  santri_id: number;
  nama: string;
  status: 'disamakan' | 'beda' | 'tabrakan';
  dari?: string;
  ke?: string;
  nis?: string;
  mi?: string;
  md?: string;
}

export interface SamakanNisHasil {
  pesan: string;
  periksa: boolean;
  ringkasan: { kandidat: number; disamakan: number; beda: number; tabrakan: number };
  rincian: SamakanNisRincian[];
}

/** Pratinjau (periksa=true, tanpa menulis) atau eksekusi penyamaan NIS MI↔MD. */
export function samakanNis(periksa: boolean) {
  return api<SamakanNisHasil>('/admin/santri/samakan-nis', {
    method: 'POST',
    body: JSON.stringify({ periksa }),
  });
}

export function uploadFotoSantri(santriId: number, file: File) {
  const fd = new FormData();
  fd.set('foto', file);
  return apiUpload<{ pesan: string; data: Santri }>(`/admin/santri/${santriId}/foto`, fd);
}

export function uploadDokumenSantri(
  santriId: number,
  input: { jenis_dokumen_santri: string; file: File; catatan?: string },
) {
  const fd = new FormData();
  fd.set('jenis_dokumen_santri', input.jenis_dokumen_santri);
  fd.set('file', input.file);
  if (input.catatan) fd.set('catatan', input.catatan);
  return apiUpload<{ pesan: string; data: DokumenSantri }>(`/admin/santri/${santriId}/dokumen`, fd);
}

export function listDokumenSantri(santriId: number) {
  return api<{ pesan: string; data: DokumenSantri[] }>(`/admin/santri/${santriId}/dokumen`);
}

export function tidakMemilikiDokumen(santriId: number, dokumenId: number, tidakMemiliki: boolean) {
  return api<{ pesan: string; data: DokumenSantri }>(`/admin/santri/${santriId}/dokumen/${dokumenId}/tidak-memiliki`, {
    method: 'POST',
    body: JSON.stringify({ tidak_memiliki: tidakMemiliki }),
  });
}
