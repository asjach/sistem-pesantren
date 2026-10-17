import { describe, expect, it } from 'vitest';
import { kunciNamaMapel, kumpulanKunciNama } from './kurikulum';

describe('kunciNamaMapel', () => {
  it('membuang spasi tepi & mengecilkan huruf (sama dengan server)', () => {
    expect(kunciNamaMapel('  Aljabar ')).toBe('aljabar');
    expect(kunciNamaMapel('BAHASA ARAB')).toBe('bahasa arab');
  });

  it('null/kosong menjadi kunci kosong', () => {
    expect(kunciNamaMapel(null)).toBe('');
    expect(kunciNamaMapel(undefined)).toBe('');
    expect(kunciNamaMapel('   ')).toBe('');
  });
});

describe('kumpulanKunciNama', () => {
  it('mengumpulkan nama mapel ternormalisasi', () => {
    const set = kumpulanKunciNama([
      { nama_mapel: 'Aljabar' },
      { nama_mapel: ' Bahasa Arab ' },
    ]);
    expect(set.has('aljabar')).toBe(true);
    expect(set.has('bahasa arab')).toBe(true);
    expect(set.has('fikih')).toBe(false);
  });
});
