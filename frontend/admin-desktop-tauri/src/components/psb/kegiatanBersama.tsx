import type { ExcelField } from '@/components/ExcelTable';

function angkaInput(label: string) {
  return (v: string | null) => {
    const s = (v ?? '').trim();
    if (s === '') return null;
    return /^[0-9.]+$/.test(s) ? null : `${label} harus berupa angka.`;
  };
}

/** Format angka gaya Indonesia (pemisah ribuan titik). */
export function angka(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '';
  return new Intl.NumberFormat('id-ID').format(Number(v));
}

/** Hanya digit; string kosong → 0 (dipakai untuk field kuota). */
export function parseAngka(s: string | null | undefined): number {
  const d = (s ?? '').replace(/\D/g, '');
  return d === '' ? 0 : Number(d);
}

export const KEGIATAN_FIELDS: ExcelField[] = [
  {
    key: 'nama', label: 'nama', width: 220, kind: 'text', maxLength: 100,
    sumber: { tabel: 'psb_gelombang', kolom: 'nama' },
    validate: (v) => (!v || !v.trim() ? 'Nama gelombang wajib diisi.' : null),
  },
  { key: 'nomor', label: 'nomor', width: 80, kind: 'static', sumber: { tabel: 'psb_gelombang', kolom: 'nomor' } },
  { key: 'periode', label: 'Periode (tanggal lewat dialog Ubah)', width: 260, kind: 'static', sumber: null },
];

export const KUOTA_FIELDS: ExcelField[] = [
  { key: 'lembaga', label: 'lembaga.jenjang', width: 180, kind: 'static', sumber: { tabel: 'lembaga', kolom: 'jenjang' } },
  { key: 'tipe', label: 'tipe_santri', width: 110, kind: 'static', sumber: { tabel: 'psb_kuota_biaya', kolom: 'tipe_santri' } },
  { key: 'kuota', label: 'kuota', width: 130, kind: 'text', maxLength: 9, validate: angkaInput('Kuota'), sumber: { tabel: 'psb_kuota_biaya', kolom: 'kuota' } },
  {
    key: 'paket', label: 'paket_tersedia', width: 130, kind: 'select',
    sumber: { tabel: 'psb_kuota_biaya', kolom: 'paket_tersedia' },
    choices: [
      { value: 'ya', label: 'Ya' },
      { value: 'tidak', label: 'Tidak' },
    ],
  },
  {
    key: 'seleksi', label: 'membutuhkan_seleksi', width: 120, kind: 'select',
    sumber: { tabel: 'psb_kuota_biaya', kolom: 'membutuhkan_seleksi' },
    choices: [
      { value: 'default', label: 'Ikut lembaga' },
      { value: 'ya', label: 'Ya' },
      { value: 'tidak', label: 'Tidak' },
    ],
  },
  {
    key: 'pemberkasan', label: 'membutuhkan_pemberkasan', width: 120, kind: 'select',
    sumber: { tabel: 'psb_kuota_biaya', kolom: 'membutuhkan_pemberkasan' },
    choices: [
      { value: 'ya', label: 'Ya' },
      { value: 'tidak', label: 'Tidak' },
    ],
  },
];

/** Boolean tiga-estado → nilai select (default = ikut lembaga). */
export function nilaiSelect(v: boolean | null | undefined): string {
  if (v === null || v === undefined) return 'default';
  return v ? 'ya' : 'tidak';
}
