import type { ExcelField } from '@/components/ExcelTable';
import type { Santri } from '@/api/santri';

/** Definisi kolom identitas santri (Buku Induk) + helper pemetaan nilainya.
 *  Dipakai bersama oleh halaman Buku Induk (`SantriPage`) dan halaman
 *  Santri Per Lembaga (`KeanggotaanPage`) agar label/lebar/validator seragam. */

export const digitValidator = (len: number, nama: string) => (v: string | null) =>
  (!v || v.trim() === '' || new RegExp(`^\\d{${len}}$`).test(v.trim()) ? null : `${nama} harus ${len} digit angka.`);

export const tglValidator = (v: string | null) =>
  (!v || v.trim() === '' || /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? null : 'Format tanggal: YYYY-MM-DD.');

export const angkaValidator = (v: string | null) => (!v || v.trim() === '' || /^\d+$/.test(v.trim()) ? null : 'Harus angka.');

export function teks(key: string, label: string, width = 140, maxLength = 255): ExcelField {
  return { key, label: key, width, kind: 'text', maxLength };
}

export function tgl(key: string, label: string, width = 110): ExcelField {
  return { key, label: key, width, kind: 'text', maxLength: 10, validate: tglValidator };
}

export function angka(key: string, label: string, width = 90): ExcelField {
  return { key, label: key, width, kind: 'text', maxLength: 4, validate: angkaValidator };
}

export function pihakFields(prefix: 'ayah' | 'ibu' | 'wali', judul: string): ExcelField[] {
  return [
    teks(`${prefix}_nama`, `${judul} — Nama`, 160),
    { key: `${prefix}_nik`, label: `${prefix}_nik`, width: 150, kind: 'text', maxLength: 16, validate: digitValidator(16, 'NIK') },
    teks(`${prefix}_tmp_lahir`, `${judul} — Tempat lahir`, 140),
    tgl(`${prefix}_tgl_lahir`, `${judul} — Tgl lahir`, 120),
    teks(`${prefix}_status`, `${judul} — Status`, 110),
    teks(`${prefix}_pekerjaan`, `${judul} — Pekerjaan`, 140),
    teks(`${prefix}_pendidikan`, `${judul} — Pendidikan`, 140),
    teks(`${prefix}_penghasilan`, `${judul} — Penghasilan`, 140),
    teks(`${prefix}_telp`, `${judul} — Telp`, 130, 20),
    teks(`${prefix}_alamat`, `${judul} — Alamat`, 200, 500),
    teks(`${prefix}_status_tempat_tinggal`, `${judul} — Tempat tinggal`, 150),
  ];
}

/** Kolom identitas santri: identitas murni + Status turunan. */
export const SANTRI_IDENTITAS_FIELDS: ExcelField[] = [
  { key: 'nama', label: 'nama_lengkap', width: 220, kind: 'text', maxLength: 255, sumber: { tabel: 'santri', kolom: 'nama_lengkap' }, validate: (v) => (v && v.trim() ? null : 'Nama wajib diisi.') },
  teks('nama_singkat', 'Nama singkat', 140),
  { key: 'nik', label: 'nik', width: 160, kind: 'text', maxLength: 16, validate: digitValidator(16, 'NIK') },
  { key: 'nisn', label: 'nisn', width: 120, kind: 'text', maxLength: 10, validate: digitValidator(10, 'NISN') },
  { key: 'jk', label: 'jk', width: 60, kind: 'select', choices: [{ value: 'L', label: 'L' }, { value: 'P', label: 'P' }] },
  teks('tmp_lahir', 'Tempat lahir', 140),
  tgl('tgl_lahir', 'Tgl lahir', 110),
  angka('anak_ke', 'Anak ke', 80),
  angka('j_saudara', 'Jml saudara', 100),
  { key: 'tipe_santri', label: 'tipe_santri', width: 120, kind: 'select', choices: [{ value: 'asrama', label: 'asrama' }, { value: 'non_asrama', label: 'non_asrama' }] },
  teks('no_hp_santri', 'HP santri', 130, 20),
  { key: 'email_santri', label: 'email_santri', width: 180, kind: 'text', maxLength: 255, validate: (v) => (!v || v.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? null : 'Format email tidak valid.') },
  teks('agama', 'Agama', 100),
  teks('cita_cita', 'Cita-cita', 130),
  teks('hobi', 'Hobi', 130),
  teks('kebutuhan_khusus', 'Kebutuhan khusus', 150),
  teks('kebutuhan_disabilitas', 'Disabilitas', 130),
  teks('nomor_kip', 'No. KIP', 130),
  { key: 'no_kk', label: 'no_kk', width: 150, kind: 'text', maxLength: 16, validate: digitValidator(16, 'No. KK') },
  teks('kepala_keluarga', 'Kepala keluarga', 150),
  teks('kewarganegaraan', 'Kewarganegaraan', 130),
  teks('bahasa_sehari', 'Bahasa sehari-hari', 150),
  teks('status_tempat_tinggal', 'Tempat tinggal', 150),
  teks('jarak_ke_pesantren', 'Jarak', 110),
  teks('waktu_tempuh', 'Waktu tempuh', 120),
  teks('transportasi', 'Transportasi', 130),
  tgl('tanggal_masuk', 'Tgl masuk', 110),
  teks('alamat', 'Alamat', 220, 500),
  teks('rt', 'RT', 60, 3),
  teks('rw', 'RW', 60, 3),
  teks('kode_pos', 'Kode pos', 90, 10),
  teks('provinsi', 'Provinsi', 150),
  teks('kab_kota', 'Kab/Kota', 150),
  teks('kecamatan', 'Kecamatan', 150),
  teks('desa_kelurahan', 'Desa/Kelurahan', 150),
  ...pihakFields('ayah', 'Ayah'),
  ...pihakFields('ibu', 'Ibu'),
  ...pihakFields('wali', 'Wali'),
  teks('yang_membiayai', 'Yang membiayai', 140),
  { key: 'status', label: 'is_active_pst', width: 100, kind: 'static', sumber: { tabel: 'santri', kolom: 'is_active_pst' } },
];

/** Prefiks kunci kolom NIS per lembaga (kolom dinamis cerminan `lembaga_santri`). */
export const NIS_PREFIX = 'nis_anggota_';

/** Kolom tanggal (dipotong ke YYYY-MM-DD saat menampilkan). */
export const TGL_KEYS = new Set(['tgl_lahir', 'ayah_tgl_lahir', 'ibu_tgl_lahir', 'wali_tgl_lahir', 'tanggal_masuk']);

/** Kolom turunan (tak boleh dikirim balik sebagai profil). */
export const TURUNAN_KEYS = new Set(['status']);

/** Nilai grid untuk seluruh kolom identitas santri. */
export function nilaiIdentitas(s: Santri): Record<string, string | null> {
  const sumber = s as unknown as Record<string, unknown>;
  const out: Record<string, string | null> = {};
  for (const f of SANTRI_IDENTITAS_FIELDS) {
    if (TURUNAN_KEYS.has(f.key)) continue;
    const keyDb = f.key === 'nama' ? 'nama_lengkap' : f.key;
    const raw = sumber[keyDb];
    if (raw == null || raw === '') {
      out[f.key] = null;
      continue;
    }
    const str = String(raw);
    out[f.key] = TGL_KEYS.has(f.key) ? str.slice(0, 10) : str;
  }
  out.status = s.is_active_pst === 'Ya' ? 'aktif' : 'nonaktif';
  return out;
}

/** Kunci kolom identitas santri (untuk memilah payload commit). */
export const KEYS_IDENTITAS = new Set(SANTRI_IDENTITAS_FIELDS.map((f) => f.key));

/** Ambil hanya kolom identitas dari payload commit (nama→nama_lengkap, turunan dibuang).
 *  Dipakai halaman yang menggabungkan identitas santri dengan kolom tabel lain
 *  (mis. Keanggotaan) agar kolom non-identitas tidak ikut terkirim ke PATCH santri. */
export function hanyaIdentitas(f: Record<string, string | null>): Record<string, string | null> {
  const identitas: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(f)) {
    if (KEYS_IDENTITAS.has(k)) identitas[k] = v;
  }
  return pisahProfil(identitas).profil;
}

/** Pisah payload commit: `profil` (kolom `santri`) + `nis` (NIS per lembaga). */
export function pisahProfil(f: Record<string, string | null>): {
  profil: Record<string, string | null>;
  nis: Array<[string, string | null]>;
} {
  const profil: Record<string, string | null> = {};
  const nis: Array<[string, string | null]> = [];
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined) continue;
    if (TURUNAN_KEYS.has(k)) continue;
    if (k.startsWith(NIS_PREFIX)) {
      const jenjang = k.slice(NIS_PREFIX.length);
      if (jenjang !== '') {
        nis.push([jenjang, v === null || String(v).trim() === '' ? null : String(v).trim()]);
      }
      continue;
    }
    if (k === 'nama') {
      profil.nama_lengkap = (v ?? '').trim();
      continue;
    }
    profil[k] = v === null || String(v).trim() === '' ? null : String(v).trim();
  }
  return { profil, nis };
}
