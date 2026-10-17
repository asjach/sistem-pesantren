import { api, downloadFile } from './client';
import { appendQueryParam, type ScalarOrArray } from './query';
import type { PotongHasil } from '@/components/ImportBertahapUmumDialog';

/**
 * Modul Kurikulum & Mapel (BLOK 5): master mapel per jenjang, kurikulum +
 * komposisi mapelnya (cakupan tingkat opsional + KKM), pemetaan kelas→kurikulum,
 * pengampu (kelas × mapel → guru dari keaktifan_pegawai), slot jam & jadwal
 * pelajaran (Modul 502).
 */

export type KelompokMapel = 'formal' | 'pesantren';

export interface MataPelajaran {
  id: number; jenjang: string;
  nama_mapel: string; kode_mapel: string | null;
  /** Singkatan tampilan (mis. 'Mat.'); null = tak ada singkatan. */
  singkatan: string | null;
  kelompok: KelompokMapel; is_active: boolean;
}

export interface Kurikulum {
  id: number; jenjang: string; nama: string; deskripsi: string | null;
  /** Terisi pada respons daftar. */
  mapel_count?: number; kelas_count?: number;
}

export interface KomposisiBaris {
  id: number; kurikulum_id: number; mata_pelajaran_id: number;
  /** Tingkat (nama) yang dicakup mapel ini; KOSONG = berlaku di semua tingkat. */
  tingkat: string[];
  kkm: number | null; urutan: number;
  mata_pelajaran: {
    id: number; nama_mapel: string; kelompok: KelompokMapel;
    kode_mapel: string | null; is_active: boolean;
  };
}

export interface KomposisiResp {
  kurikulum: Kurikulum;
  /** Mapel yang sudah masuk kurikulum (terurut). */
  baris: KomposisiBaris[];
  /** Mapel jenjang ini yang BELUM masuk kurikulum — untuk panel pilih. */
  tersedia: Pick<MataPelajaran, 'id' | 'nama_mapel' | 'kelompok' | 'kode_mapel' | 'is_active'>[];
  /** Tingkat yang berlaku untuk jenjang kurikulum — pilihan cakupan. */
  tingkatOpsi: { id: number; nama: string; jenjang: string | null; urutan?: number }[];
}

export interface KelasKurikulumBaris {
  id: number; nama_kelas: string; tingkat: string | null;
  /** Kurikulum yang terpasang pada kelas. */
  kurikulum_ids: number[];
}

export interface GuruAktif {
  keaktifan_pegawai_id: number; pegawai_id: number;
  nama_lengkap: string; nip: string | null;
  gelar_depan: string | null; gelar_belakang: string | null; jenis_kelamin: string | null;
}

export interface PengampuBaris {
  mata_pelajaran_id: number; nama_mapel: string; kelompok: KelompokMapel;
  is_active: boolean;
  /** Ada di komposisi kurikulum kelas. */
  dari_kurikulum: boolean;
  /** Baris komposisi kurikulum yang menyumbang mapel ini (bisa >1 saat kelas
   *  memakai beberapa kurikulum) — dipakai action "Keluarkan dari kurikulum". */
  komposisi_ids: number[];
  kurikulum_nama: string[];
  pengampu_id: number | null;
  keaktifan_pegawai_id: number | null;
  guru: string | null;
}

export interface PengampuResp {
  kelas: { id: number; nama_kelas: string; tingkat: string | null; jenjang: string };
  kurikulum: Pick<Kurikulum, 'id' | 'nama'>[];
  baris: PengampuBaris[];
}

export interface SlotJam {
  id: number; jenjang: string;
  nama_slot: string | null; jam_mulai: string | null; jam_selesai: string | null;
  urutan: number;
}

export interface JadwalBaris {
  id: number; hari: string; slot_jam_id: number; pengampu_mapel_id: number;
  nama_mapel: string | null; guru: string | null; ruangan: string | null;
}

export interface JadwalResp {
  kelas: { id: number; nama_kelas: string; tingkat: string | null; jenjang: string };
  hari: string[];
  slot: Pick<SlotJam, 'id' | 'nama_slot' | 'jam_mulai' | 'jam_selesai' | 'urutan'>[];
  baris: JadwalBaris[];
  /** Pengampu kelas yang belum terjadwal — pilihan untuk sel jadwal. */
  belum_terjadwal: { id: number; nama_mapel: string | null }[];
}

export const HARI_LABEL: Record<string, string> = {
  senin: 'Senin', selasa: 'Selasa', rabu: 'Rabu', kamis: 'Kamis',
  jumat: 'Jumat', sabtu: 'Sabtu', ahad: 'Ahad',
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
}) {
  return api<MataPelajaran>('/admin/kurikulum/mapel', { method: 'POST', body: JSON.stringify(data) });
}

export function ubahMapel(id: number, data: {
  nama_mapel?: string; kelompok?: KelompokMapel; kode_mapel?: string | null;
  singkatan?: string | null; is_active?: boolean;
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

// ------------------------------------------------------------- kurikulum

export function daftarKurikulum(jenjang: string) {
  return api<Kurikulum[]>(`/admin/kurikulum/kurikulum?jenjang=${encodeURIComponent(jenjang)}`);
}

export function buatKurikulum(data: { jenjang: string; nama: string; deskripsi?: string | null }) {
  return api<Kurikulum>('/admin/kurikulum/kurikulum', { method: 'POST', body: JSON.stringify(data) });
}

export function ubahKurikulum(id: number, data: { nama?: string; deskripsi?: string | null }) {
  return api<Kurikulum>(`/admin/kurikulum/kurikulum/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function hapusKurikulum(id: number) {
  return api<{ pesan: string }>(`/admin/kurikulum/kurikulum/${id}`, { method: 'DELETE' });
}

// ------------------------------------------------------------- komposisi

export function daftarKomposisi(kurikulumId: number) {
  return api<KomposisiResp>(`/admin/kurikulum/komposisi?kurikulum_id=${kurikulumId}`);
}

export function buatKomposisi(data: {
  kurikulum_id: number; mata_pelajaran_id: number;
  /** Tingkat yang dicakup; kosong/null = berlaku di semua tingkat. */
  tingkat?: string[]; kkm?: number | null; urutan?: number;
}) {
  return api<KomposisiBaris>('/admin/kurikulum/komposisi', { method: 'POST', body: JSON.stringify(data) });
}

export function ubahKomposisi(id: number, data: { tingkat?: string[]; kkm?: number | null; urutan?: number }) {
  return api<KomposisiBaris>(`/admin/kurikulum/komposisi/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

/**
 * Aksi massal: terapkan satu cakupan tingkat ke banyak baris komposisi sekaligus
 * (checkbox tabel komposisi). Daftar `tingkat` = SET, jadicakupan lama tiap baris
 * diganti — kosong berarti berlaku di semua tingkat.
 */
export function terapkanTingkatKomposisi(ids: number[], tingkat: string[]) {
  return api<{ tersentuh: number; tingkat: string[] }>('/admin/kurikulum/komposisi/tingkat-bulk', {
    method: 'PUT', body: JSON.stringify({ ids, tingkat }),
  });
}

export function hapusKomposisi(id: number) {
  return api<{ pesan: string }>(`/admin/kurikulum/komposisi/${id}`, { method: 'DELETE' });
}

// -------------------------------------------------------- kelas → kurikulum

export function daftarKelasKurikulum(params: { jenjang: string; tahun_ajaran: string }) {
  const q = new URLSearchParams();
  q.set('jenjang', params.jenjang);
  q.set('tahun_ajaran', params.tahun_ajaran);
  return api<{ kelas: KelasKurikulumBaris[] }>(`/admin/kurikulum/kelas?${q.toString()}`);
}

export function simpanKelasKurikulum(kelasId: number, kurikulumIds: number[]) {
  return api<{ pesan: string }>(`/admin/kurikulum/kelas/${kelasId}`, {
    method: 'PUT',
    body: JSON.stringify({ kurikulum_ids: kurikulumIds }),
  });
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
export function simpanPengampu(kelasId: number, baris: { mata_pelajaran_id: number; keaktifan_pegawai_id: number | null }[]) {
  return api<{ pesan: string }>('/admin/kurikulum/pengampu', {
    method: 'PUT',
    body: JSON.stringify({ kelas_id: kelasId, baris }),
  });
}

/** Buat baris pengampu untuk seluruh mapel kurikulum kelas yang belum punya. */
export function generatePengampu(kelasId: number) {
  return api<{ pesan: string; dibuat: number }>('/admin/kurikulum/pengampu/generate', {
    method: 'POST',
    body: JSON.stringify({ kelas_id: kelasId }),
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

export function daftarSlot(jenjang: string) {
  return api<SlotJam[]>(`/admin/kurikulum/slot?jenjang=${encodeURIComponent(jenjang)}`);
}

export function buatSlot(data: {
  jenjang: string; nama_slot?: string | null;
  jam_mulai?: string | null; jam_selesai?: string | null; urutan?: number;
}) {
  return api<SlotJam>('/admin/kurikulum/slot', { method: 'POST', body: JSON.stringify(data) });
}

export function ubahSlot(id: number, data: {
  nama_slot?: string | null; jam_mulai?: string | null; jam_selesai?: string | null; urutan?: number;
}) {
  return api<SlotJam>(`/admin/kurikulum/slot/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function hapusSlot(id: number) {
  return api<{ pesan: string }>(`/admin/kurikulum/slot/${id}`, { method: 'DELETE' });
}

export function daftarJadwal(kelasId: number) {
  return api<JadwalResp>(`/admin/kurikulum/jadwal?kelas_id=${kelasId}`);
}

export function buatJadwal(data: {
  pengampu_mapel_id: number; slot_jam_id: number; hari: string; ruangan?: string | null;
}) {
  return api<JadwalBaris>('/admin/kurikulum/jadwal', { method: 'POST', body: JSON.stringify(data) });
}

export function hapusJadwal(id: number) {
  return api<{ pesan: string }>(`/admin/kurikulum/jadwal/${id}`, { method: 'DELETE' });
}
