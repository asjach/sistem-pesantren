import { describe, expect, it } from 'vitest';
import { konfigurasiFilterHalaman } from './filterHalaman';

describe('konfigurasiFilterHalaman', () => {
  it('pembayaran (kasir) memakai filter lembaga & tahun ajaran', () => {
    const k = konfigurasiFilterHalaman('pembayaran');
    expect(k.filter).toEqual(['lembaga', 'tahun_ajaran']);
    expect(k.tampil).toMatchObject({ lembaga: true, tahun_ajaran: true, semester: false });
  });

  it('halaman tanpa konfigurasi tampil tanpa filter', () => {
    const k = konfigurasiFilterHalaman('halaman_tidak_dikenal');
    expect(k.filter).toEqual([]);
    expect(k.tampil.lembaga).toBe(false);
  });
});
