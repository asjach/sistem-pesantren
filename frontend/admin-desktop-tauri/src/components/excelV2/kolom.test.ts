import { describe, expect, it } from 'vitest';

import type { ExcelField } from '@/components/excel/types';
import { labelTampil, rataKolom, statusPilihSemua, susunKolom } from './kolom';

const fields: ExcelField[] = [
  { key: 'nama', label: 'Nama', kind: 'text' },
  { key: 'nis', label: 'NIS', kind: 'text' },
  { key: 'kelas', label: 'Kelas', kind: 'text' },
];

describe('susunKolom', () => {
  it('tanpa preset: semua kolom dengan urutan asli', () => {
    expect(susunKolom(fields, null)).toBe(fields);
    expect(susunKolom(fields, [])).toBe(fields);
  });

  it('mengikuti urutan preset dan menyembunyikan kolom lain', () => {
    expect(susunKolom(fields, ['kelas', 'nama']).map((f) => f.key)).toEqual(['kelas', 'nama']);
  });

  it('melewati key yang tak dikenal (kolom sudah dihapus dari kode)', () => {
    expect(susunKolom(fields, ['nis', 'sudah_tidak_ada']).map((f) => f.key)).toEqual(['nis']);
  });

  it('preset yang seluruhnya tak dikenal menghasilkan daftar kosong', () => {
    expect(susunKolom(fields, ['x', 'y'])).toEqual([]);
  });
});

describe('statusPilihSemua', () => {
  const ids = [1, 2, 3];

  it('tanpa baris atau tanpa pilihan: tidak', () => {
    expect(statusPilihSemua([], new Set())).toBe('tidak');
    expect(statusPilihSemua(ids, new Set())).toBe('tidak');
  });

  it('sebagian dipilih: sebagian', () => {
    expect(statusPilihSemua(ids, new Set([2]))).toBe('sebagian');
  });

  it('semua dipilih: semua', () => {
    expect(statusPilihSemua(ids, new Set([1, 2, 3]))).toBe('semua');
  });

  it('id terpilih di luar daftar tampil tidak dihitung', () => {
    expect(statusPilihSemua(ids, new Set([1, 2, 3, 99]))).toBe('semua');
    expect(statusPilihSemua(ids, new Set([99]))).toBe('tidak');
  });
});

describe('rataKolom', () => {
  it('tanpa setelan default tengah (mengikuti V1)', () => {
    expect(rataKolom(fields[0])).toBe('tengah');
    expect(rataKolom(fields[0], {})).toBe('tengah');
  });

  it('setelan per kolom menang', () => {
    expect(rataKolom(fields[0], { nama: 'left' })).toBe('kiri');
    expect(rataKolom(fields[0], { nama: 'center' })).toBe('tengah');
    expect(rataKolom(fields[0], { nama: 'right' })).toBe('kanan');
  });

  it('setelan kolom lain tidak bocor', () => {
    expect(rataKolom(fields[0], { nis: 'right' })).toBe('tengah');
  });

  it('kolom angka tanpa setelan tetap tengah', () => {
    const angka: ExcelField = { key: 'nominal', label: 'Nominal', kind: 'text', format: 'angka' };
    expect(rataKolom(angka)).toBe('tengah');
  });
});

describe('labelTampil', () => {
  it('label kustom menang atas label field', () => {
    expect(labelTampil('nama', 'Nama', { nama: 'Nama Santri' })).toBe('Nama Santri');
  });

  it('label kustom kosong jatuh ke label field', () => {
    expect(labelTampil('nama', 'Nama', { nama: '   ' })).toBe('Nama');
  });

  it('label mentah di-humanize', () => {
    expect(labelTampil('nama_lengkap', undefined, {})).toBe('Nama Lengkap');
  });

  it('akronim tetap kapital', () => {
    expect(labelTampil('nis', undefined, {})).toBe('NIS');
  });
});
