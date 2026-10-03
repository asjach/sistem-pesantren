import { describe, expect, it } from 'vitest';
import {
  HALAMAN,
  HALAMAN_DATA_INDUK,
  halamanDariPath,
  halamanGrupLangsung,
  izinHalaman,
} from './halaman';

describe('halamanDariPath & halaman bertab (Data Induk)', () => {
  it('rute tiap tab dikenali sebagai halaman Data Induk', () => {
    const tab = HALAMAN_DATA_INDUK.tabHalaman ?? [];
    expect(tab.map((t) => t.to)).toEqual([
      '/users',
      '/lembaga',
      '/tahun-ajaran',
      '/kelas',
      '/santri',
      '/referensi',
    ]);
    for (const t of tab) {
      expect(halamanDariPath(t.to)?.to).toBe('/data-induk');
    }
  });

  it('rute /data-induk dan turunannya dikenali', () => {
    expect(halamanDariPath('/data-induk')?.to).toBe('/data-induk');
    expect(halamanDariPath('/data-induk/apa-saja')?.to).toBe('/data-induk');
  });

  it('rute lama di luar Data Induk tidak berubah', () => {
    expect(halamanDariPath('/')?.label).toBe('Dashboard');
    expect(halamanDariPath('/pegawai')?.label).toBe('Pegawai');
    expect(halamanDariPath('/keuangan')?.label).toBe('Keuangan');
    expect(halamanDariPath('/dokumen-santri/lihat')?.label).toBe('Dokumen Santri');
    // Profil santri (jendela terpisah) tetap memakai judul Buku Induk/Data Induk.
    expect(halamanDariPath('/santri/12/profil')?.to).toBe('/data-induk');
  });

  it('grup Data Induk kini satu entri menu (tab menggantikan submenu)', () => {
    expect(halamanGrupLangsung('master').map((h) => h.to)).toEqual(['/data-induk']);
  });

  it('izin halaman gabungan = gabungan izin semua tab', () => {
    expect(izinHalaman(HALAMAN_DATA_INDUK)).toEqual([
      'pengguna.lihat',
      'lembaga.lihat',
      'tahun_ajaran.lihat',
      'kelas.lihat',
      'santri.lihat',
      'referensi.lihat',
    ]);
  });

  it('izin halaman biasa = izin tunggalnya', () => {
    const keuangan = HALAMAN.find((h) => h.to === '/keuangan');
    expect(keuangan && izinHalaman(keuangan)).toEqual(['keuangan.lihat']);
  });
});
