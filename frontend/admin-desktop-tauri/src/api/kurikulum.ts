import { api, downloadFile } from './client';
import { appendQueryParam, type ScalarOrArray } from './query';
import type { PotongHasil } from '@/components/ImportBertahapUmumDialog';

/**
 * Modul Mapel & Pengampu (BLOK 5): master mapel per jenjang (KKM + urutan
 * tampil rapor), pengampu (kelas × mapel → guru dari keaktifan_pegawai),
 * slot jam & jadwal pelajaran (Modul 502).
 *
 * Modul kurikulum (per jenjang) + komposisi + cakupan tingkat sudah DIHAPUS:
 * daftar mapel sebuah kelas YAITUH baris `pengampu_mapel` itu sendiri.
 */

export type KelompokMapel = 'formal' | 'pesantren';

export interface MataPelajaran {
  id: number; jenjang: string;
  nama_mapel: string; kode_mapel: string | null;
  /** Singkatan tampilan (mis. 'Mat.'); null = tak ada singkatan. */
  singkatan: string | null;
  kelompok: KelompokMapel; is_active: boolean;
  /** KKM mapel (satu tempat per jenjang); null = predikat manual (modul 202). */
  kkm: number | null;
  /** Urutan tampil di rapor/leger (0 = ikut abjad). */
  urutan: number;
}

export interface GuruAktif {
  keaktifan_pegawai_id: number; pegawai_id: number;
  nama_lengkap: string; nip: string | null;
  gelar_depan: string | null; gelar_belakang: string | null; jenis_kelamin: string | null;
}

export interface PengampuBaris {
  mata_pelajaran_id: number; nama_mapel: string; kelompok: KelompokMapel;
  is_active: boolean;
  /** KKM mapel (dari master mapel) — tampil saja, diubah di halaman Mapel. */
  kkm: number | null;
  pengampu_id: number | null;
  keaktifan_pegawai_id: number | null;
  guru: string | null;
}

export interface PengampuResp {
  kelas: { id: number; nama_kelas: string; tingkat: string | null; jenjang: string };
  baris: PengampuBaris[];
}

export type JenisSlot = 'pelajaran' | 'istirahat' | 'pembiasaan';

export const JENIS_SLOT_LABEL: Record<JenisSlot, string> = {
  pelajaran: 'Pelajaran',
  istirahat: 'Istirahat',
  pembiasaan: 'Pembiasaan',
};

export const JENIS_SLOT_OPTIONS = (Object.keys(JENIS_SLOT_LABEL) as JenisSlot[])
  .map((value) => ({ value, label: JENIS_SLOT_LABEL[value] }));

export interface SlotJam {
  id: number; jenjang: string; kelas_id: number | null; hari: string | null;
  nama_slot: string | null; jenis: JenisSlot;
  jam_mulai: string | null; jam_selesai: string | null;
  urutan: number;
}

/** Slot yang dikirim endpoint jadwal (tanpa kolom jenjang). */
export type SlotJadwal = Omit<SlotJam, 'jenjang'>;

export interface JadwalBaris {
  id: number; hari: string; slot_jam_id: number;
  /** Null = sel baru berisi guru; mapel menyusul. */
  pengampu_mapel_id: number | null;
  mata_pelajaran_id: number | null; keaktifan_pegawai_id: number | null;
  nama_mapel: string | null; guru: string | null;
  /** Nama panggilan & singkat guru (opsional; fallback ke nama lengkap). */
  guru_nama_panggilan: string | null; guru_nama_singkat: string | null;
  /** Kode & singkatan mapel untuk opsi format tampilan jadwal. */
  kode_mapel: string | null; singkatan: string | null;
  /** Data guru untuk format Ust./Usth., dengan/tanpa gelar, atau kode. */
  guru_gelar_depan: string | null; guru_gelar_belakang: string | null;
  guru_jenis_kelamin: string | null;
  /** ID pegawai (master guru) untuk opsi "Kode guru". */
  guru_pegawai_id: number | null;
  /** True bila sel hanya berisi guru (mapel belum diisi). */
  guru_saja?: boolean;
  ruangan: string | null;
}

export interface JadwalResp {
  kelas: { id: number; nama_kelas: string; tingkat: string | null; jenjang: string };
  hari: string[];
  hari_libur?: string[];
  slot: SlotJadwal[];
  baris: JadwalBaris[];
  /** Semua pengampu kelas — pilihan tiap sel; mapel yang sudah dipakai di
   *  slot lain tetap bisa dipilih lagi (2 JP atau lebih). */
  pengampu: { id: number; nama_mapel: string | null; guru: string | null }[];
  /** Pengampu yang belum terjadwal sama sekali (inventaris). */
  belum_terjadwal: { id: number; nama_mapel: string | null; guru: string | null }[];
}

export const HARI_LABEL: Record<string, string> = {
  senin: 'Senin', selasa: 'Selasa', rabu: 'Rabu', kamis: 'Kamis',
  jumat: 'Jumat', sabtu: 'Sabtu', minggu: 'Minggu', ahad: 'Ahad',
};

// ---------------------------------------------------------------- mapel

export function daftarMapel(params: { jenjang: string; q?: string; kelompok?: KelompokMapel; keaktifan?: 'aktif' | 'nonaktif' | 'semua' }) {
  const q = new URLSearchParams();
  q.set('jenjang', params.jenjang);
  if (params.q) q.set('q', params.q);
  if (params.kelompok) q.set('kelompok', params.kelompok);
  if (params.keaktifan) q.set('keaktifan', params.keaktifan);
  return api<MataPelajaran[]>(`/admin/kurikulum/mapel?${q.toString()}`);
}

export function buatMapel(data: {
  jenjang: string; nama_mapel: string; kelompok: KelompokMapel;
  kode_mapel?: string | null; singkatan?: string | null; is_active?: boolean;
  kkm?: number | null; urutan?: number;
}) {
  return api<MataPelajaran>('/admin/kurikulum/mapel', { method: 'POST', body: JSON.stringify(data) });
}

export function ubahMapel(id: number, data: {
  nama_mapel?: string; kelompok?: KelompokMapel; kode_mapel?: string | null;
  singkatan?: string | null; is_active?: boolean;
  kkm?: number | null; urutan?: number;
}) {
  return api<MataPelajaran>(`/admin/kurikulum/mapel/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function hapusMapel(id: number) {
  return api<{ pesan: string }>(`/admin/kurikulum/mapel/${id}`, { method: 'DELETE' });
}

/** Satu baris contoh di dialog aksi kamus (perubahan nilai atau mapel baru). */
export interface ContohKamus {
  nama_mapel: string; kode_mapel: string | null; singkatan: string | null;
}

/** Ringkasan "terapkan dari kamus": jumlah mapel yang diisi + contoh perubahannya. */
export interface TerapkanKamusHasil {
  pesan: string; jenjang: string;
  /** Mapel yang kolomnya terisi — pada `mode: periksa` artinya "akan terisi". */
  diubah: number;
  /** Nama cocok di kamus, tapi kode & singkatannya sudah terisi. */
  sudah_lengkap: number;
  /** Nama tak ada di kamus (atau entri kamusnya tanpa kode & singkatan). */
  tanpa_kamus: number;
  /** Sampel perubahan (maks 5) untuk dialog konfirmasi. */
  contoh: ContohKamus[];
}

/** Isi kode & singkatan mapel jenjang ini dari kamus `ref_mapel` berdasarkan
 *  nama yang sama (beda huruf besar/kecil diabaikan). `mode: 'periksa'` hanya
 *  menghitung (dialog pratinjau), `'eksekusi'` menyimpan. */
export function terapkanKamusMapel(input: { jenjang: string; timpa?: boolean; mode: 'periksa' | 'eksekusi' }) {
  return api<TerapkanKamusHasil>('/admin/kurikulum/mapel/terapkan-kamus', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ---------- Import mapel bertahap (potongan JSON dari browser) ----------

/** Kolom template import mapel (multi-lembaga; `is_active` kosong = aktif/pertahankan). */
export const KOLOM_IMPORT_MAPEL = ['jenjang', 'nama_mapel', 'kelompok', 'kode_mapel', 'is_active'];

/** Unduh template Excel import mapel. */
export function unduhTemplateMapel() {
  return downloadFile('/admin/kurikulum/mapel/import-template', 'template-import-mapel.xlsx');
}

/** Kirim satu potongan baris mapel (maks 1000); panggilan pertama tanpa
 *  sesi_id membuat sesi (wajib mode + total). */
export function importMapelPotong(input: {
  sesi_id?: number;
  mode: 'periksa' | 'eksekusi';
  total?: number;
  baris: Record<string, unknown>[];
  terakhir?: boolean;
}) {
  return api<PotongHasil>('/admin/kurikulum/mapel/import-potong', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Batalkan sesi import mapel milik sendiri. */
export function batalPotongMapel(sesiId: number) {
  return api<{ pesan: string }>(`/admin/kurikulum/mapel/import-potong/${sesiId}/batal`, { method: 'POST' });
}

/** Unduh CSV galat sesi import mapel milik sendiri. */
export function unduhGalatMapel(sesiId: number) {
  return downloadFile(`/admin/kurikulum/mapel/import-potong/${sesiId}/galat`, 'galat-import-mapel.csv');
}

// ------------------------------------------------------- guru & pengampu

export function daftarGuruAktif(params: { jenjang: string; tahun_ajaran: string }) {
  const q = new URLSearchParams();
  q.set('jenjang', params.jenjang);
  q.set('tahun_ajaran', params.tahun_ajaran);
  return api<GuruAktif[]>(`/admin/kurikulum/guru-aktif?${q.toString()}`);
}

export function daftarPengampu(kelasId: number) {
  return api<PengampuResp>(`/admin/kurikulum/pengampu?kelas_id=${kelasId}`);
}

/** Baris pengampu yang sudah berlabel kelasnya (untuk tabel multi-kelas). */
export type PengampusBaris = PengampuBaris & { kelas_id: number; nama_kelas: string };

export interface PengampusResp {
  /** Kelas sesuai urutan permintaan (pilihan pengguna di rel Kelas). */
  kelas: { id: number; nama_kelas: string; tingkat: string | null; jenjang: string }[];
  /** Baris gabungan semua kelas; tiap baris membawa `kelas_id` + `nama_kelas`. */
  baris: PengampusBaris[];
}

/** Pengampu BANYAK kelas dalam SATU request. Endpoint per-kelas (`daftarPengampu`)
 *  berarti N request yang saling antre saat server memprosesnya berurutan — itu
 *  yang membuat tabel pengampu terasa lambat. */
export function daftarPengampus(kelasIds: number[]) {
  const q = kelasIds.map((id) => `kelas_ids[]=${id}`).join('&');
  return api<PengampusResp>(`/admin/kurikulum/pengampus?${q}`);
}

/** Sync pengampu satu kelas: baris di luar daftar dihapus (ditolak bila
 *  sudah punya nilai/jadwal). */
export function simpanPengampu(kelasId: number, baris: {
  mata_pelajaran_id: number; keaktifan_pegawai_id: number | null;
}[]) {
  return api<{ pesan: string }>('/admin/kurikulum/pengampu', {
    method: 'PUT',
    body: JSON.stringify({ kelas_id: kelasId, baris }),
  });
}

/** Salin daftar mapel dari kelas lain: baris mapel yang belum ada di kelas
 *  tujuan ditambahkan TANPA guru (guru diisi kemudian di tabel). */
export function salinPengampu(kelasId: number, dariKelasId: number) {
  return api<{ pesan: string; ditambah: number }>('/admin/kurikulum/pengampu/salin', {
    method: 'POST',
    body: JSON.stringify({ kelas_id: kelasId, dari_kelas_id: dariKelasId }),
  });
}

// ---------- Import pengampu bertahap (potongan JSON dari browser) ----------

/** Kolom template import pengampu (multi-lembaga/TA; `guru` = NIP/nama, kosong = tanpa guru). */
export const KOLOM_IMPORT_PENGAMPU = ['jenjang', 'tahun_ajaran', 'nama_kelas', 'nama_mapel', 'guru'];

/** Unduh template Excel import pengampu. */
export function unduhTemplatePengampu() {
  return downloadFile('/admin/kurikulum/pengampu/import-template', 'template-import-pengampu.xlsx');
}

/** Kirim satu potongan baris pengampu (maks 1000); panggilan pertama tanpa
 *  sesi_id membuat sesi (wajib mode + total). Tanpa penghapusan. */
export function importPengampuPotong(input: {
  sesi_id?: number;
  mode: 'periksa' | 'eksekusi';
  total?: number;
  baris: Record<string, unknown>[];
  terakhir?: boolean;
}) {
  return api<PotongHasil>('/admin/kurikulum/pengampu/import-potong', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Batalkan sesi import pengampu milik sendiri. */
export function batalPotongPengampu(sesiId: number) {
  return api<{ pesan: string }>(`/admin/kurikulum/pengampu/import-potong/${sesiId}/batal`, { method: 'POST' });
}

/** Unduh CSV galat sesi import pengampu milik sendiri. */
export function unduhGalatPengampu(sesiId: number) {
  return downloadFile(`/admin/kurikulum/pengampu/import-potong/${sesiId}/galat`, 'galat-import-pengampu.csv');
}

// ------------------------------------------------------- slot & jadwal

export function daftarJadwal(kelasId: number) {
  return api<JadwalResp>(`/admin/kurikulum/jadwal?kelas_id=${kelasId}`);
}

export function buatJadwal(data: {
  pengampu_mapel_id: number; slot_jam_id: number; hari: string; ruangan?: string | null;
}) {
  return api<JadwalBaris>('/admin/kurikulum/jadwal', { method: 'POST', body: JSON.stringify(data) });
}

/** Isi/kosongkan satu sel: mapel + guru; pengampu kelas dibuat/diperbarui. */
export function simpanSelJadwal(data: {
  kelas_id: number; slot_jam_id: number; hari: string;
  mata_pelajaran_id: number | null; keaktifan_pegawai_id: number | null;
}) {
  return api<{ pesan: string; jadwal: JadwalBaris | null }>('/admin/kurikulum/jadwal/sel', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function hapusJadwal(id: number) {
  return api<{ pesan: string }>(`/admin/kurikulum/jadwal/${id}`, { method: 'DELETE' });
}

// ------------------------------------------------- template jadwal generik

export interface TemplateJadwal {
  id: number; jenjang: string; tingkat: string | null; kelas_id: number | null;
  nama: string;
  deskripsi: string | null; is_active: boolean; baris_count?: number;
}

export interface TemplateJadwalBaris {
  id: number; hari: string | null; urutan_slot: number;
  nama_slot: string | null; jenis: JenisSlot;
  jam_mulai: string | null; jam_selesai: string | null;
}

export interface TemplateJadwalDetail {
  template: TemplateJadwal;
  baris: TemplateJadwalBaris[];
}

export interface TerapkanHasil {
  pesan: string; kelas: number; dibuat: number; bisa_dipasang: number;
  slot_dibuat: number; slot_bisa_dibuat: number; slot_dihapus: number;
  dilewati: { sel: string; alasan: string }[];
}

export function daftarTemplateJadwal(jenjang: string) {
  return api<TemplateJadwal[]>(`/admin/kurikulum/template-jadwal?jenjang=${encodeURIComponent(jenjang)}`);
}

export function buatTemplateJadwal(data: {
  jenjang: string; tingkat?: string | null; kelas_id?: number | null;
  nama: string; deskripsi?: string | null; is_active?: boolean;
}) {
  return api<TemplateJadwal>('/admin/kurikulum/template-jadwal', { method: 'POST', body: JSON.stringify(data) });
}

export function ubahTemplateJadwal(id: number, data: {
  nama?: string; tingkat?: string | null; kelas_id?: number | null;
  deskripsi?: string | null; is_active?: boolean;
}) {
  return api<TemplateJadwal>(`/admin/kurikulum/template-jadwal/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function hapusTemplateJadwal(id: number) {
  return api<{ pesan: string }>(`/admin/kurikulum/template-jadwal/${id}`, { method: 'DELETE' });
}

export function detailTemplateJadwal(id: number) {
  return api<TemplateJadwalDetail>(`/admin/kurikulum/template-jadwal/${id}`);
}

export function tambahBarisTemplate(id: number, data: {
  hari?: string | null; nama_slot?: string | null; jenis?: JenisSlot;
  jam_mulai?: string | null; jam_selesai?: string | null; urutan_slot?: number;
}) {
  return api<TemplateJadwalBaris>(`/admin/kurikulum/template-jadwal/${id}/baris`, { method: 'POST', body: JSON.stringify(data) });
}

export function ubahBarisTemplate(barisId: number, data: {
  hari?: string | null; nama_slot?: string | null; jenis?: JenisSlot;
  jam_mulai?: string | null; jam_selesai?: string | null; urutan_slot?: number;
}) {
  return api<TemplateJadwalBaris>(`/admin/kurikulum/template-jadwal/baris/${barisId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function hapusBarisTemplate(barisId: number) {
  return api<{ pesan: string }>(`/admin/kurikulum/template-jadwal/baris/${barisId}`, { method: 'DELETE' });
}

export function terapkanTemplate(id: number, data: {
  sasaran: 'kelas' | 'tingkat' | 'jenjang';
  sasaran_id: string;
  tahun_ajaran?: string | null;
  mode?: 'pratinjau' | 'eksekusi'; timpa?: boolean;
}) {
  return api<TerapkanHasil>(`/admin/kurikulum/template-jadwal/${id}/terapkan`, { method: 'POST', body: JSON.stringify(data) });
}

// ------------------------------------------------------- hari libur mingguan

export interface HariLiburResp {
  jenjang: string; semua_hari: string[]; hari_aktif: string[]; hari_libur: string[];
}

export function daftarHariLibur(jenjang: string) {
  return api<HariLiburResp>(`/admin/kurikulum/hari-libur?jenjang=${encodeURIComponent(jenjang)}`);
}

export function simpanHariLibur(data: { jenjang: string; hari_libur: string[] }) {
  return api<HariLiburResp>('/admin/kurikulum/hari-libur', { method: 'PUT', body: JSON.stringify(data) });
}
