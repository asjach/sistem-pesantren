import { describe, expect, it } from 'vitest';
import { konfigurasiFilterHalaman } from './filterHalaman';

describe('konfigurasiFilterHalaman', () => {
  it('pembayaran (kasir) memakai filter lembaga & tahun ajaran', () => {
    const k = konfigurasiFilterHalaman('pembayaran');
    expect(k.filter).toEqual(['lembaga', 'tahun_ajaran']);
    expect(k.tampil).toMatchObject({ lembaga: true, tahun_ajaran: true, semester: false });
  });

  // Rail filter tab Tagihan (crosstab) hanya tampil bila `tingkat` & `kelas`
  // masuk daftar relevan — `tampil` saja tak cukup (lihat FilterRail).
  it('keuangan menyertakan filter tingkat & kelas untuk rail crosstab', () => {
    const k = konfigurasiFilterHalaman('keuangan');
    expect(k.filter).toContain('tingkat');
    expect(k.filter).toContain('kelas');
    expect(k.tampil).toMatchObject({ tingkat: true, kelas: true, semester: false });
  });

  it('halaman tanpa konfigurasi tampil tanpa filter', () => {
    const k = konfigurasiFilterHalaman('halaman_tidak_dikenal');
    expect(k.filter).toEqual([]);
    expect(k.tampil.lembaga).toBe(false);
  });
});
