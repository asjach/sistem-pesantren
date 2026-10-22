import { describe, expect, it } from 'vitest';

import type { GridRow } from '@/components/excel/types';
import { susunPerubahanSeret } from './seretV2';

const KUNCI = ['check', 'nama', 'nis', 'kode'];
const EDITABLE = new Set(['nama', 'nis']);

const BARIS: GridRow[] = [
  { id: 1, checked: false, nama: 'Ahmad', nis: '001', kode: 'K1' },
  { id: 2, checked: false, nama: 'Bilal', nis: '002', kode: 'K2' },
  { id: 3, checked: false, nama: 'Cahya', nis: '003', kode: 'K3' },
];

describe('susunPerubahanSeret', () => {
  it('menyalin satu sel ke sel tujuan tanpa mengubah sumber', () => {
    const hasil = susunPerubahanSeret(
      BARIS,
      { r0: 0, r1: 0, kolom: [1] },
      { r0: 1, r1: 1, kolom: [2] },
      KUNCI,
      EDITABLE,
      'salin',
    );

    expect(hasil).toEqual([{ id: '2', fields: { nis: 'Ahmad' } }]);
  });

  it('memindahkan isi blok dan mengosongkan sel sumber', () => {
    const hasil = susunPerubahanSeret(
      BARIS,
      { r0: 0, r1: 0, kolom: [1] },
      { r0: 2, r1: 2, kolom: [2] },
      KUNCI,
      EDITABLE,
      'pindah',
    );

    expect(hasil).toEqual([
      { id: '1', fields: { nama: null } },
      { id: '3', fields: { nis: 'Ahmad' } },
    ]);
  });

  it('melewati kolom static meski nilainya berbeda', () => {
    const hasil = susunPerubahanSeret(
      BARIS,
      { r0: 0, r1: 0, kolom: [3] },
      { r0: 1, r1: 1, kolom: [3] },
      KUNCI,
      EDITABLE,
      'salin',
    );

    expect(hasil).toEqual([]);
  });

  it('tidak menghasilkan perubahan bila nilai tujuan sama', () => {
    const hasil = susunPerubahanSeret(
      BARIS,
      { r0: 0, r1: 0, kolom: [1] },
      { r0: 0, r1: 0, kolom: [1] },
      KUNCI,
      EDITABLE,
      'salin',
    );

    expect(hasil).toEqual([]);
  });

  it('menyalin blok dua baris satu kolom sekaligus', () => {
    const hasil = susunPerubahanSeret(
      BARIS,
      { r0: 0, r1: 1, kolom: [1] },
      { r0: 1, r1: 2, kolom: [2] },
      KUNCI,
      EDITABLE,
      'salin',
    );

    expect(hasil).toEqual([
      { id: '2', fields: { nis: 'Ahmad' } },
      { id: '3', fields: { nis: 'Bilal' } },
    ]);
  });
});
