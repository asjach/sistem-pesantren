import type { ExcelField } from '@/components/ExcelTable';
import { updateLembagaSantri, updateSantri } from '@/api/santri';
import { updateRiwayatBelajar, type RiwayatRow } from '@/api/siklus';

/** Kolom penuh Daftar Kelas: seluruh `riwayat_belajar` + `santri` + `lembaga_santri`.
 *  Kunci = nama kolom DB (datar, tanpa prefiks; tak ada tabrakan antar tabel).
 *  Static = FK/id turunan & kolom lifecycle (status/kelas) yang dikunci backend. */

const digitValidator = (len: number, nama: string) => (v: string | null) =>
  (!v || v.trim() === '' || new RegExp(`^\\d{${len}}$`).test(v.trim()) ? null : `${nama} harus ${len} digit angka.`);

/** NIK/no.KK longgar (maks 20): yang digitnya bukan 16 otomatis berawalan
 *  `X-` saat disimpan agar ketahuan tak valid. */
const nikValidator = (v: string | null) =>
  (!v || v.trim() === '' || v.trim().length <= 20 ? null : 'Maksimal 20 karakter.');

const tglValidator = (v: string | null) =>
  (!v || v.trim() === '' || /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? null : 'Format tanggal: YYYY-MM-DD.');

const angkaValidator = (v: string | null) => (!v || v.trim() === '' || /^\d+$/.test(v.trim()) ? null : 'Harus angka.');

const emailValidator = (v: string | null) =>
  (!v || v.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? null : 'Format email tidak valid.');

function teks(key: string, label: string, tabel: string, kolom: string, width = 140, maxLength = 255): ExcelField {
  return { key, label, width, kind: 'text', maxLength, sumber: { tabel, kolom } };
}

function tgl(key: string, label: string, tabel: string, kolom: string, width = 110): ExcelField {
  return { key, label, width, kind: 'text', maxLength: 10, validate: tglValidator, sumber: { tabel, kolom } };
}

function angka(key: string, label: string, tabel: string, kolom: string, width = 90): ExcelField {
  return { key, label, width, kind: 'text', maxLength: 4, validate: angkaValidator, sumber: { tabel, kolom } };
}

function pihakFields(prefix: 'ayah' | 'ibu' | 'wali', judul: string, boleh: boolean): ExcelField[] {
  const statis = !boleh;
  const t = (key: string, label: string, width = 140, maxLength = 255): ExcelField =>
    statis
      ? { key, label, width, kind: 'static', sumber: { tabel: 'santri', kolom: key } }
      : teks(key, label, 'santri', key, width, maxLength);
  return [
    t(`${prefix}_nama`, `${judul} — Nama`, 160),
    statis
      ? { key: `${prefix}_nik`, label: `${prefix}_nik`, width: 150, kind: 'static', sumber: { tabel: 'santri', kolom: `${prefix}_nik` } }
      : { key: `${prefix}_nik`, label: `${prefix}_nik`, width: 150, kind: 'text', maxLength: 20, validate: nikValidator, sumber: { tabel: 'santri', kolom: `${prefix}_nik` } },
    t(`${prefix}_tmp_lahir`, `${judul} — Tempat lahir`),
    statis
      ? { key: `${prefix}_tgl_lahir`, label: `${judul} — Tgl lahir`, width: 120, kind: 'static', sumber: { tabel: 'santri', kolom: `${prefix}_tgl_lahir` } }
      : tgl(`${prefix}_tgl_lahir`, `${judul} — Tgl lahir`, 'santri', `${prefix}_tgl_lahir`, 120),
    t(`${prefix}_status`, `${judul} — Status`, 110),
    t(`${prefix}_pekerjaan`, `${judul} — Pekerjaan`),
    t(`${prefix}_pendidikan`, `${judul} — Pendidikan`),
    t(`${prefix}_penghasilan`, `${judul} — Penghasilan`),
    t(`${prefix}_telp`, `${judul} — Telp`, 130, 20),
    t(`${prefix}_alamat`, `${judul} — Alamat`, 200, 500),
    t(`${prefix}_status_tempat_tinggal`, `${judul} — Tempat tinggal`, 150),
  ];
}

/** Kolom profil santri yang bisa diedit (cermin `Santri::KOLOM_PROFIL`). */
export const SANTRI_EDIT_KEYS = [
  'nama_lengkap', 'nama_singkat', 'nik', 'nisn', 'jk', 'tmp_lahir', 'tgl_lahir',
  'anak_ke', 'j_saudara', 'tipe_santri', 'no_hp_santri', 'email_santri', 'agama',
  'cita_cita', 'hobi', 'kebutuhan_khusus', 'kebutuhan_disabilitas', 'nomor_kip',
  'no_kk', 'kewarganegaraan', 'bahasa_sehari', 'status_tempat_tinggal',
  'jarak_ke_pesantren', 'waktu_tempuh', 'transportasi', 'tanggal_masuk', 'alamat',
  'rt', 'rw', 'kode_pos', 'provinsi', 'kab_kota', 'kecamatan', 'desa_kelurahan',
  'ayah_nama', 'ayah_nik', 'ayah_tmp_lahir', 'ayah_tgl_lahir', 'ayah_status',
  'ayah_pekerjaan', 'ayah_pendidikan', 'ayah_penghasilan', 'ayah_telp', 'ayah_alamat',
  'ayah_status_tempat_tinggal',
  'ibu_nama', 'ibu_nik', 'ibu_tmp_lahir', 'ibu_tgl_lahir', 'ibu_status',
  'ibu_pekerjaan', 'ibu_pendidikan', 'ibu_penghasilan', 'ibu_telp', 'ibu_alamat',
  'ibu_status_tempat_tinggal',
  'wali_nama', 'wali_nik', 'wali_tmp_lahir', 'wali_tgl_lahir', 'wali_status',
  'wali_pekerjaan', 'wali_pendidikan', 'wali_penghasilan', 'wali_telp', 'wali_alamat',
  'wali_status_tempat_tinggal', 'yang_membiayai',
];

/** Kolom skalar riwayat yang bisa diedit (sisanya dikunci backend). */
export const RIWAYAT_EDIT_KEYS = ['semester', 'tingkat', 'no_absen', 'tgl_masuk'];

/** Kolom keanggotaan yang bisa diedit. */
export const ANGGOTA_EDIT_KEYS = [
  'nis_lokal', 'nis_kemenag', 'anggota_aktif',
  'tahaj_masuk', 'tingkat_masuk', 'no_urut',
  'nama_sekolah_asal', 'npsn_sekolah_asal', 'nss_sekolah_asal', 'alamat_sekolah_asal',
  'anggota_tgl_masuk', 'tgl_selesai',
];

const TGL_SANTRI_KEYS = new Set(['tgl_lahir', 'ayah_tgl_lahir', 'ibu_tgl_lahir', 'wali_tgl_lahir', 'tanggal_masuk']);

function potongTgl(v: unknown): string | null {
  if (v == null || v === '') return null;
  return String(v).slice(0, 10);
}

function potongWaktu(v: unknown): string | null {
  if (v == null || v === '') return null;
  return String(v).slice(0, 19).replace('T', ' ');
}

function profilFields(boleh: boolean): ExcelField[] {
  if (!boleh) {
    return SANTRI_EDIT_KEYS.map((k) => ({
      key: k, label: k, width: 140, kind: 'static' as const, sumber: { tabel: 'santri', kolom: k },
    }));
  }
  return [
    teks('nama_singkat', 'Nama singkat', 'santri', 'nama_singkat'),
    { key: 'nik', label: 'nik', width: 160, kind: 'text', maxLength: 20, validate: nikValidator, sumber: { tabel: 'santri', kolom: 'nik' } },
    { key: 'nisn', label: 'nisn', width: 120, kind: 'text', maxLength: 10, validate: digitValidator(10, 'NISN'), sumber: { tabel: 'santri', kolom: 'nisn' } },
    { key: 'jk', label: 'jk', width: 60, kind: 'select', choices: [{ value: 'L', label: 'L' }, { value: 'P', label: 'P' }], sumber: { tabel: 'santri', kolom: 'jk' } },
    teks('tmp_lahir', 'Tempat lahir', 'santri', 'tmp_lahir'),
    tgl('tgl_lahir', 'Tgl lahir', 'santri', 'tgl_lahir'),
    angka('anak_ke', 'Anak ke', 'santri', 'anak_ke', 80),
    angka('j_saudara', 'Jml saudara', 'santri', 'j_saudara', 100),
    { key: 'tipe_santri', label: 'tipe_santri', width: 120, kind: 'select', choices: [{ value: 'asrama', label: 'asrama' }, { value: 'non_asrama', label: 'non_asrama' }], sumber: { tabel: 'santri', kolom: 'tipe_santri' } },
    teks('no_hp_santri', 'HP santri', 'santri', 'no_hp_santri', 130, 20),
    { key: 'email_santri', label: 'email_santri', width: 180, kind: 'text', maxLength: 255, validate: emailValidator, sumber: { tabel: 'santri', kolom: 'email_santri' } },
    teks('agama', 'Agama', 'santri', 'agama', 100),
    teks('cita_cita', 'Cita-cita', 'santri', 'cita_cita', 130),
    teks('hobi', 'Hobi', 'santri', 'hobi', 130),
    teks('kebutuhan_khusus', 'Kebutuhan khusus', 'santri', 'kebutuhan_khusus', 150),
    teks('kebutuhan_disabilitas', 'Disabilitas', 'santri', 'kebutuhan_disabilitas', 130),
    teks('nomor_kip', 'No. KIP', 'santri', 'nomor_kip', 130),
    { key: 'no_kk', label: 'no_kk', width: 150, kind: 'text', maxLength: 20, validate: nikValidator, sumber: { tabel: 'santri', kolom: 'no_kk' } },
    teks('kewarganegaraan', 'Kewarganegaraan', 'santri', 'kewarganegaraan', 130),
    teks('bahasa_sehari', 'Bahasa sehari-hari', 'santri', 'bahasa_sehari', 150),
    teks('status_tempat_tinggal', 'Tempat tinggal', 'santri', 'status_tempat_tinggal', 150),
    teks('jarak_ke_pesantren', 'Jarak', 'santri', 'jarak_ke_pesantren', 110),
    teks('waktu_tempuh', 'Waktu tempuh', 'santri', 'waktu_tempuh', 120),
    teks('transportasi', 'Transportasi', 'santri', 'transportasi', 130),
    tgl('tanggal_masuk', 'Tgl masuk santri', 'santri', 'tanggal_masuk'),
    teks('alamat', 'Alamat', 'santri', 'alamat', 220, 500),
    teks('rt', 'RT', 'santri', 'rt', 60, 3),
    teks('rw', 'RW', 'santri', 'rw', 60, 3),
    teks('kode_pos', 'Kode pos', 'santri', 'kode_pos', 90, 10),
    teks('provinsi', 'Provinsi', 'santri', 'provinsi', 150),
    teks('kab_kota', 'Kab/Kota', 'santri', 'kab_kota', 150),
    teks('kecamatan', 'Kecamatan', 'santri', 'kecamatan', 150),
    teks('desa_kelurahan', 'Desa/Kelurahan', 'santri', 'desa_kelurahan', 150),
    ...pihakFields('ayah', 'Ayah', true),
    ...pihakFields('ibu', 'Ibu', true),
    ...pihakFields('wali', 'Wali', true),
    teks('yang_membiayai', 'Yang membiayai', 'santri', 'yang_membiayai'),
  ];
}

/** Seluruh kolom grid Daftar Kelas. `bolehSantri` = izin santri.ubah,
 *  `bolehRiwayat` = izin riwayat_belajar.ubah (tanpa izin → static). */
export function medanDaftarKelas({ bolehSantri, bolehRiwayat }: { bolehSantri: boolean; bolehRiwayat: boolean }): ExcelField[] {
  const statis = (key: string, label: string, tabel: string, kolom: string, width = 110): ExcelField =>
    ({ key, label, width, kind: 'static', sumber: { tabel, kolom } });
  return [
    // Identitas + konteks baris (urutan lama dipertahankan di depan).
    bolehSantri
      ? { key: 'nama_lengkap', label: 'santri.nama_lengkap', width: 200, kind: 'text', maxLength: 255, sumber: { tabel: 'santri', kolom: 'nama_lengkap' }, validate: (v) => (v && v.trim() ? null : 'Nama wajib diisi.') }
      : statis('nama_lengkap', 'santri.nama_lengkap', 'santri', 'nama_lengkap', 200),
    bolehSantri
      ? { key: 'nis_lokal', label: 'nis_lokal', width: 110, kind: 'text', maxLength: 20, sumber: { tabel: 'lembaga_santri', kolom: 'nis_lokal' } }
      : statis('nis_lokal', 'nis_lokal', 'lembaga_santri', 'nis_lokal'),
    statis('lembaga', 'lembaga.jenjang', 'lembaga', 'jenjang'),
    statis('ta', 'tahun_ajaran.nama', 'tahun_ajaran', 'nama', 110),
    bolehRiwayat
      ? { key: 'semester', label: 'semester', width: 60, kind: 'select', choices: [{ value: '1', label: '1' }, { value: '2', label: '2' }], sumber: { tabel: 'riwayat_belajar', kolom: 'semester' } }
      : statis('semester', 'semester', 'riwayat_belajar', 'semester', 60),
    bolehRiwayat
      ? teks('tingkat', 'tingkat', 'riwayat_belajar', 'tingkat', 80, 20)
      : statis('tingkat', 'tingkat', 'riwayat_belajar', 'tingkat', 80),
    statis('kelas', 'kelas.nama_kelas', 'kelas', 'nama_kelas', 140),
    bolehRiwayat
      ? { key: 'no_absen', label: 'no_absen', width: 70, kind: 'text', maxLength: 4, validate: angkaValidator, sumber: { tabel: 'riwayat_belajar', kolom: 'no_absen' } }
      : statis('no_absen', 'no_absen', 'riwayat_belajar', 'no_absen', 70),
    statis('status_awal', 'status_awal', 'riwayat_belajar', 'status_awal', 130),
    statis('status_akhir', 'status_akhir', 'riwayat_belajar', 'status_akhir', 110),
    statis('is_active_riwayat', 'is_active_riwayat', 'riwayat_belajar', 'is_active_riwayat', 80),
    bolehRiwayat
      ? tgl('tgl_masuk', 'tgl_masuk', 'riwayat_belajar', 'tgl_masuk')
      : statis('tgl_masuk', 'tgl_masuk', 'riwayat_belajar', 'tgl_masuk'),
    // Keanggotaan (lembaga_santri).
    statis('anggota_id', 'anggota_id', 'lembaga_santri', 'id', 90),
    bolehSantri
      ? { key: 'nis_kemenag', label: 'nis_kemenag', width: 150, kind: 'text', maxLength: 20, sumber: { tabel: 'lembaga_santri', kolom: 'nis_kemenag' } }
      : statis('nis_kemenag', 'nis_kemenag', 'lembaga_santri', 'nis_kemenag', 150),
    bolehSantri
      ? { key: 'anggota_aktif', label: 'anggota_aktif', width: 90, kind: 'toggle', sumber: { tabel: 'lembaga_santri', kolom: 'is_active_lembaga' } }
      : statis('anggota_aktif', 'anggota_aktif', 'lembaga_santri', 'is_active_lembaga', 90),
    bolehSantri
      ? teks('tahaj_masuk', 'tahaj_masuk', 'lembaga_santri', 'tahaj_masuk', 120, 50)
      : statis('tahaj_masuk', 'tahaj_masuk', 'lembaga_santri', 'tahaj_masuk', 120),
    bolehSantri
      ? teks('tingkat_masuk', 'tingkat_masuk', 'lembaga_santri', 'tingkat_masuk', 110, 20)
      : statis('tingkat_masuk', 'tingkat_masuk', 'lembaga_santri', 'tingkat_masuk', 110),
    bolehSantri
      ? teks('no_urut', 'no_urut', 'lembaga_santri', 'no_urut', 90, 20)
      : statis('no_urut', 'no_urut', 'lembaga_santri', 'no_urut', 90),
    bolehSantri
      ? teks('nama_sekolah_asal', 'nama_sekolah_asal', 'lembaga_santri', 'nama_sekolah_asal', 180)
      : statis('nama_sekolah_asal', 'nama_sekolah_asal', 'lembaga_santri', 'nama_sekolah_asal', 180),
    bolehSantri
      ? teks('npsn_sekolah_asal', 'npsn_sekolah_asal', 'lembaga_santri', 'npsn_sekolah_asal', 130, 20)
      : statis('npsn_sekolah_asal', 'npsn_sekolah_asal', 'lembaga_santri', 'npsn_sekolah_asal', 130),
    bolehSantri
      ? teks('nss_sekolah_asal', 'nss_sekolah_asal', 'lembaga_santri', 'nss_sekolah_asal', 130, 30)
      : statis('nss_sekolah_asal', 'nss_sekolah_asal', 'lembaga_santri', 'nss_sekolah_asal', 130),
    bolehSantri
      ? teks('alamat_sekolah_asal', 'alamat_sekolah_asal', 'lembaga_santri', 'alamat_sekolah_asal', 200, 500)
      : statis('alamat_sekolah_asal', 'alamat_sekolah_asal', 'lembaga_santri', 'alamat_sekolah_asal', 200),
    bolehSantri
      ? { key: 'anggota_tgl_masuk', label: 'tgl_masuk', width: 110, kind: 'text', maxLength: 10, validate: tglValidator, sumber: { tabel: 'lembaga_santri', kolom: 'tgl_masuk' } }
      : statis('anggota_tgl_masuk', 'tgl_masuk', 'lembaga_santri', 'tgl_masuk'),
    bolehSantri
      ? { key: 'tgl_selesai', label: 'tgl_selesai', width: 110, kind: 'text', maxLength: 10, validate: tglValidator, sumber: { tabel: 'lembaga_santri', kolom: 'tgl_selesai' } }
      : statis('tgl_selesai', 'tgl_selesai', 'lembaga_santri', 'tgl_selesai'),
    // Profil santri penuh.
    ...profilFields(bolehSantri),
    statis('status_pst', 'is_active_pst', 'santri', 'is_active_pst', 100),
    statis('foto_url', 'foto_url', 'santri', 'foto_url', 160),
    // FK + timestamp (jejak teknis).
    statis('santri_id', 'santri_id', 'riwayat_belajar', 'santri_id', 90),
    statis('tahun_ajaran', 'tahun_ajaran', 'riwayat_belajar', 'tahun_ajaran', 110),
    statis('jenjang', 'jenjang', 'riwayat_belajar', 'jenjang', 100),
    statis('kelas_id', 'kelas_id', 'riwayat_belajar', 'kelas_id', 90),
    statis('rwy_dibuat', 'riwayat.created_at', 'riwayat_belajar', 'created_at', 160),
    statis('rwy_diubah', 'riwayat.updated_at', 'riwayat_belajar', 'updated_at', 160),
    statis('santri_dibuat', 'santri.created_at', 'santri', 'created_at', 160),
    statis('santri_diubah', 'santri.updated_at', 'santri', 'updated_at', 160),
    statis('anggota_dibuat', 'anggota.created_at', 'lembaga_santri', 'created_at', 160),
    statis('anggota_diubah', 'anggota.updated_at', 'lembaga_santri', 'updated_at', 160),
  ];
}

/** Nilai grid dari satu baris API. */
export function daftarKelasValues(r: RiwayatRow): Record<string, string | null> {
  const s = (r.santri ?? {}) as unknown as Record<string, unknown>;
  const a = (r.lembaga_anggota ?? {}) as unknown as Record<string, unknown>;
  const out: Record<string, string | null> = {
    nama_lengkap: (r.santri?.nama_lengkap ?? String(r.santri_id)) as string,
    nis_lokal: (r.lembaga_anggota?.nis_lokal ?? r.nis_lokal ?? null) as string | null,
    lembaga: r.lembaga?.jenjang ?? String(r.jenjang),
    ta: r.tahun_ajaran ?? null,
    semester: r.semester,
    tingkat: r.tingkat,
    kelas: r.kelas?.nama_kelas ?? '—',
    no_absen: r.no_absen !== null && r.no_absen !== undefined ? String(r.no_absen) : null,
    status_awal: r.status_awal,
    status_akhir: r.status_akhir,
    is_active_riwayat: r.is_active_riwayat,
    tgl_masuk: potongTgl(r.tgl_masuk),
    anggota_id: r.lembaga_anggota ? String(r.lembaga_anggota.id) : null,
    nis_kemenag: (r.lembaga_anggota?.nis_kemenag ?? null) as string | null,
    anggota_aktif: !r.lembaga_anggota ? null : r.lembaga_anggota.is_active_lembaga === 'Ya' ? 'ya' : 'tidak',
    tahaj_masuk: (a.tahaj_masuk ?? null) as string | null,
    tingkat_masuk: (a.tingkat_masuk ?? null) as string | null,
    no_urut: a.no_urut !== null && a.no_urut !== undefined ? String(a.no_urut) : null,
    nama_sekolah_asal: (a.nama_sekolah_asal ?? null) as string | null,
    npsn_sekolah_asal: (a.npsn_sekolah_asal ?? null) as string | null,
    nss_sekolah_asal: (a.nss_sekolah_asal ?? null) as string | null,
    alamat_sekolah_asal: (a.alamat_sekolah_asal ?? null) as string | null,
    anggota_tgl_masuk: potongTgl(a.tgl_masuk),
    tgl_selesai: potongTgl(a.tgl_selesai),
    status_pst: !r.santri ? null : r.santri.is_active_pst,
    foto_url: (r.santri?.foto_url ?? null) as string | null,
    santri_id: String(r.santri_id),
    tahun_ajaran: r.tahun_ajaran,
    jenjang: String(r.jenjang),
    kelas_id: r.kelas_id !== null && r.kelas_id !== undefined ? String(r.kelas_id) : null,
    rwy_dibuat: potongWaktu((r as unknown as Record<string, unknown>).created_at),
    rwy_diubah: potongWaktu((r as unknown as Record<string, unknown>).updated_at),
    santri_dibuat: potongWaktu(s.created_at),
    santri_diubah: potongWaktu(s.updated_at),
    anggota_dibuat: potongWaktu(a.created_at),
    anggota_diubah: potongWaktu(a.updated_at),
  };
  for (const k of SANTRI_EDIT_KEYS) {
    if (k === 'nama_lengkap') continue;
    const raw = s[k];
    if (raw == null || raw === '') {
      out[k] = null;
      continue;
    }
    out[k] = TGL_SANTRI_KEYS.has(k) ? potongTgl(raw) : String(raw);
  }
  return out;
}

/** Nilai teks grid → NULL bila kosong. */
function teksAtauNull(v: string | null | undefined): string | null {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
}

/** Simpan baris: rute per tabel tujuan (riwayat → PATCH riwayat,
 *  profil → PATCH santri, anggota → PATCH lembaga-santri). */
export function pakaiCommitDaftarKelas(rows: RiwayatRow[]) {
  return async function commitDaftarKelas(id: number, f: Record<string, string | null>) {
    const baris = rows.find((r) => r.id === id);
    if (!baris) return;

    const rw: Record<string, string | null> = {};
    for (const k of RIWAYAT_EDIT_KEYS) {
      if (f[k] !== undefined) rw[k] = k === 'semester' ? (f[k] as string) : teksAtauNull(f[k]);
    }
    if (Object.keys(rw).length > 0) {
      await updateRiwayatBelajar(baris.id, rw);
    }

    if (baris.santri) {
      const profil: Record<string, string | null> = {};
      for (const k of SANTRI_EDIT_KEYS) {
        if (f[k] !== undefined) profil[k] = teksAtauNull(f[k]);
      }
      if (Object.keys(profil).length > 0) {
        await updateSantri(baris.santri.id, profil);
      }
    }

    const anggotaId = baris.lembaga_anggota?.id;
    if (anggotaId) {
      const ada: {
        nis_lokal?: string | null; nis_kemenag?: string | null;
        tahaj_masuk?: string | null; tingkat_masuk?: string | null; no_urut?: string | null;
        nama_sekolah_asal?: string | null; npsn_sekolah_asal?: string | null;
        nss_sekolah_asal?: string | null; alamat_sekolah_asal?: string | null;
        is_active_lembaga?: 'Ya' | 'Tidak';
        tgl_masuk?: string | null; tgl_selesai?: string | null;
      } = {};
      if (f.nis_lokal !== undefined) ada.nis_lokal = teksAtauNull(f.nis_lokal);
      if (f.nis_kemenag !== undefined) ada.nis_kemenag = teksAtauNull(f.nis_kemenag);
      if (f.anggota_aktif !== undefined) ada.is_active_lembaga = f.anggota_aktif === 'ya' ? 'Ya' : 'Tidak';
      if (f.tahaj_masuk !== undefined) ada.tahaj_masuk = teksAtauNull(f.tahaj_masuk);
      if (f.tingkat_masuk !== undefined) ada.tingkat_masuk = teksAtauNull(f.tingkat_masuk);
      if (f.no_urut !== undefined) ada.no_urut = teksAtauNull(f.no_urut);
      if (f.nama_sekolah_asal !== undefined) ada.nama_sekolah_asal = teksAtauNull(f.nama_sekolah_asal);
      if (f.npsn_sekolah_asal !== undefined) ada.npsn_sekolah_asal = teksAtauNull(f.npsn_sekolah_asal);
      if (f.nss_sekolah_asal !== undefined) ada.nss_sekolah_asal = teksAtauNull(f.nss_sekolah_asal);
      if (f.alamat_sekolah_asal !== undefined) ada.alamat_sekolah_asal = teksAtauNull(f.alamat_sekolah_asal);
      if (f.anggota_tgl_masuk !== undefined) ada.tgl_masuk = teksAtauNull(f.anggota_tgl_masuk);
      if (f.tgl_selesai !== undefined) ada.tgl_selesai = teksAtauNull(f.tgl_selesai);
      if (Object.keys(ada).length > 0) {
        await updateLembagaSantri(anggotaId, ada);
      }
    }
  };
}
