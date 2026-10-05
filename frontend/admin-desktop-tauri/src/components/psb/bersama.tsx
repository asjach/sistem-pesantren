import type { ExcelChoice, ExcelField } from '@/components/ExcelTable';
import type { PsbCalon } from '@/api/psb';
import { tanggal } from '@/lib/tanggal';

/** Tahapan timeline PSB → kumpulan status_pendaftaran (nilai enum di DB).
 *  Tiap tahap kini halamannya sendiri di bawah submenu Antrean. */
export const TAHAP_PSB: { id: string; label: string; statuses: string[] }[] = [
  { id: 'pendaftar', label: 'Pendaftar', statuses: ['baru', 'waiting_list'] },
  { id: 'terdaftar', label: 'Terdaftar', statuses: ['terverifikasi'] },
  { id: 'daftar_ulang', label: 'Daftar Ulang', statuses: ['lolos', 'pemberkasan', 'ajukan_daftar_ulang'] },
  { id: 'diterima', label: 'Diterima', statuses: ['daftar_ulang'] },
  { id: 'mengundurkan_diri', label: 'Mengundurkan Diri', statuses: ['mengundurkan_diri'] },
  { id: 'ditolak', label: 'Ditolak', statuses: ['ditolak', 'tidak_lolos'] },
];

/** Definisi kolom grid PSB; pilihan gelombang mengikuti data (mode Input). */
export function psbFields(gelombangChoices: ExcelChoice[]): ExcelField[] {
  return [
    { key: 'no', label: 'no_pendaftaran', width: 190, kind: 'static',  },
    {
      key: 'nama', label: 'nama_lengkap', width: 200, kind: 'static',
      
      inputKind: 'text', maxLength: 255, required: true,
    },
    {
      key: 'nik', label: 'nik', width: 160, kind: 'static',
      
      inputKind: 'text', maxLength: 16, required: true,
      validate: (v) => (!v || /^\d{16}$/.test(v.trim()) ? null : 'NIK harus 16 digit angka.'),
    },
    {
      key: 'tipe', label: 'tipe_santri', width: 110, kind: 'static',
      inputKind: 'select', required: true,
      inputChoices: [
        { value: 'asrama', label: 'asrama' },
        { value: 'non_asrama', label: 'non_asrama' },
      ],
    },
    { key: 'lembaga', label: 'Jenjang', width: 180, kind: 'static',  },
    {
      key: 'gelombang', label: 'Nama Gelombang', width: 140, kind: 'static',
      inputKind: 'select', required: true, inputChoices: gelombangChoices,
    },
    { key: 'paket', label: 'Paket', width: 120, kind: 'static' },
    { key: 'status', label: 'status_pendaftaran', width: 150, kind: 'static' },
    { key: 'daftar', label: 'tanggal_daftar', width: 110, kind: 'static',  },
  ];
}

export type BulkAksi = 'verifikasi' | 'daftar_ulang' | 'acc' | 'undur' | 'batal' | 'hapus' | 'pulihkan';

/** Kolom template yang dikirim (kunci lain dari file diabaikan). */
export const KOLOM_IMPORT_PSB = [
  'nik', 'nama_lengkap', 'jk', 'tgl_lahir', 'tipe_santri', 'email_ortu', 'telp_ortu',
  'nama_ayah', 'nama_ibu', 'no_pendaftaran',
];

/** Fase yang boleh mengundurkan diri: terdaftar, daftar ulang, diterima. */
export const BISA_UNDUR = ['terverifikasi', 'lolos', 'pemberkasan', 'ajukan_daftar_ulang', 'daftar_ulang'];

/** Fase yang bisa dibatalkan (kembali ke fase sebelumnya); fase diterima dikecualikan. */
export const BISA_BATAL = ['terverifikasi', 'lolos', 'pemberkasan', 'ajukan_daftar_ulang', 'tidak_lolos', 'ditolak', 'mengundurkan_diri'];

/** Label tampilan kolom Status (nilai DB tetap snake_case). */
export const STATUS_LABEL: Record<string, string> = {
  baru: 'Baru',
  waiting_list: 'Waiting list',
  terverifikasi: 'Terverifikasi',
  lolos: 'Lolos',
  tidak_lolos: 'Tidak lolos',
  pemberkasan: 'Pemberkasan',
  ajukan_daftar_ulang: 'Ajukan daftar ulang',
  daftar_ulang: 'Daftar ulang',
  mengundurkan_diri: 'Mengundurkan diri',
  ditolak: 'Ditolak',
  terhapus: 'Terhapus',
};

export function psbGridValues(c: PsbCalon): Record<string, string | null> {
  const detail = c.lembaga_detail ?? [];
  const kodeLembaga = detail.length > 0
    ? detail.map((d) => d.lembaga?.jenjang ?? String(d.jenjang)).join(' + ')
    : (c.lembaga_tujuan?.jenjang ?? String(c.jenjang));
  return {
    no: c.no_pendaftaran,
    nama: c.nama_lengkap,
    nik: c.nik,
    tipe: c.tipe_santri,
    lembaga: kodeLembaga,
    gelombang: c.gelombang?.nama ?? String(c.gelombang_id),
    paket: detail.length > 1 ? 'MI-MD' : null,
    status: c.deleted_at ? 'Terhapus' : (STATUS_LABEL[c.status_pendaftaran] ?? c.status_pendaftaran),
    daftar: tanggal(c.tanggal_daftar),
  };
}
