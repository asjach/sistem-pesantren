import { describe, expect, it } from 'vitest';
import {
  HALAMAN,
  HALAMAN_DATA_INDUK,
  HALAMAN_PENEMPATAN,
  halamanDariPath,
  halamanGrupLangsung,
  izinHalaman,
  type HalamanDef,
} from './halaman';

const ruteTab = (def: HalamanDef) => (def.tabHalaman ?? []).map((t) => t.to);

describe('halamanDariPath & halaman bertab', () => {
  it('rute tiap tab Data Induk dikenali sebagai halaman Data Induk', () => {
    expect(ruteTab(HALAMAN_DATA_INDUK)).toEqual([
      '/users',
      '/lembaga',
      '/tahun-ajaran',
      '/kelas',
      '/santri',
      '/referensi',
    ]);
    for (const rute of ruteTab(HALAMAN_DATA_INDUK)) {
      expect(halamanDariPath(rute)?.to).toBe('/data-induk');
    }
  });

  it('rute tiap tab Penempatan dikenali sebagai halaman Penempatan', () => {
    expect(ruteTab(HALAMAN_PENEMPATAN)).toEqual(['/keanggotaan', '/mi-md', '/riwayat-belajar']);
    for (const rute of ruteTab(HALAMAN_PENEMPATAN)) {
      expect(halamanDariPath(rute)?.to).toBe('/penempatan');
    }
  });

  it('rute halaman gabungan dan turunannya dikenali', () => {
    expect(halamanDariPath('/data-induk')?.to).toBe('/data-induk');
    expect(halamanDariPath('/data-induk/apa-saja')?.to).toBe('/data-induk');
    expect(halamanDariPath('/penempatan')?.to).toBe('/penempatan');
    expect(halamanDariPath('/penempatan/apa-saja')?.to).toBe('/penempatan');
  });

  it('rute lama di luar halaman gabungan tidak berubah', () => {
    expect(halamanDariPath('/')?.label).toBe('Dashboard');
    expect(halamanDariPath('/pegawai')?.label).toBe('Pegawai');
    expect(halamanDariPath('/keuangan')?.label).toBe('Keuangan');
    expect(halamanDariPath('/dokumen-santri/lihat')?.label).toBe('Dokumen Santri');
    // Profil santri (jendela terpisah) tetap memakai judul Buku Induk/Data Induk.
    expect(halamanDariPath('/santri/12/profil')?.to).toBe('/data-induk');
  });

  it('grup Data Induk satu entri; grup Santri: Daftar Kelas + Penempatan langsung', () => {
    expect(halamanGrupLangsung('master').map((h) => h.to)).toEqual(['/data-induk']);
    expect(halamanGrupLangsung('santri').map((h) => h.to)).toEqual(['/daftar-kelas', '/penempatan']);
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
    expect(izinHalaman(HALAMAN_PENEMPATAN)).toEqual([
      'santri.lihat',
      'rekap_santri.lihat',
      'riwayat_belajar.lihat',
    ]);
  });

  it('izin halaman biasa = izin tunggalnya', () => {
    const keuangan = HALAMAN.find((h) => h.to === '/keuangan');
    expect(keuangan && izinHalaman(keuangan)).toEqual(['keuangan.lihat']);
  });
});
