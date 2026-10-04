import { describe, expect, it } from 'vitest';
import {
  HALAMAN,
  HALAMAN_AKADEMIK,
  HALAMAN_DATA_INDUK,
  HALAMAN_PENEMPATAN,
  HALAMAN_PENEMPATAN_PEGAWAI,
  HALAMAN_SANTRI_AKTIF,
  NAV_GRUP,
  halamanDariPath,
  halamanGrupLangsung,
  halamanSubgrup,
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
      '/pengaturan/semester',
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

  it('rute tiap tab Santri Aktif dikenali sebagai halaman Santri Aktif', () => {
    expect(ruteTab(HALAMAN_SANTRI_AKTIF)).toEqual([
      '/daftar-kelas',
      '/rekap-santri',
      '/pengajuan-biodata',
    ]);
    for (const rute of ruteTab(HALAMAN_SANTRI_AKTIF)) {
      expect(halamanDariPath(rute)?.to).toBe('/santri-aktif');
    }
  });

  it('rute tiap tab Penempatan Pegawai dikenali sebagai halaman Penempatan (Pegawai)', () => {
    expect(ruteTab(HALAMAN_PENEMPATAN_PEGAWAI)).toEqual([
      '/pegawai',
      '/pegawai-penempatan',
      '/pegawai-akun',
    ]);
    for (const rute of ruteTab(HALAMAN_PENEMPATAN_PEGAWAI)) {
      expect(halamanDariPath(rute)?.to).toBe('/penempatan-pegawai');
    }
  });

  it('rute tiap tab Akademik dikenali sebagai halaman Akademik', () => {
    expect(ruteTab(HALAMAN_AKADEMIK)).toEqual([
      '/pindah-kelas',
      '/mutasi-keluar',
      '/kenaikan',
      '/kelulusan',
    ]);
    for (const rute of ruteTab(HALAMAN_AKADEMIK)) {
      expect(halamanDariPath(rute)?.to).toBe('/akademik');
    }
  });

  it('rute halaman gabungan dan turunannya dikenali', () => {
    expect(halamanDariPath('/data-induk')?.to).toBe('/data-induk');
    expect(halamanDariPath('/data-induk/apa-saja')?.to).toBe('/data-induk');
    expect(halamanDariPath('/penempatan')?.to).toBe('/penempatan');
    expect(halamanDariPath('/penempatan/apa-saja')?.to).toBe('/penempatan');
    expect(halamanDariPath('/akademik')?.to).toBe('/akademik');
    expect(halamanDariPath('/akademik/apa-saja')?.to).toBe('/akademik');
    expect(halamanDariPath('/santri-aktif')?.to).toBe('/santri-aktif');
    expect(halamanDariPath('/santri-aktif/apa-saja')?.to).toBe('/santri-aktif');
    expect(halamanDariPath('/penempatan-pegawai')?.to).toBe('/penempatan-pegawai');
    expect(halamanDariPath('/penempatan-pegawai/apa-saja')?.to).toBe('/penempatan-pegawai');
  });

  it('rute lama di luar halaman gabungan tidak berubah', () => {
    expect(halamanDariPath('/')?.label).toBe('Dashboard');
    expect(halamanDariPath('/pegawai-keaktifan')?.label).toBe('PTK Aktif');
    expect(halamanDariPath('/keuangan')?.label).toBe('Keuangan');
    expect(halamanDariPath('/dokumen-santri/lihat')?.label).toBe('Dokumen Santri');
    // Profil santri (jendela terpisah) tetap memakai judul Buku Induk/Data Induk.
    expect(halamanDariPath('/santri/12/profil')?.to).toBe('/data-induk');
  });

  it('grup Data Induk satu entri; grup Santri: Santri Aktif + Penempatan + Akademik langsung', () => {
    expect(halamanGrupLangsung('master').map((h) => h.to)).toEqual(['/data-induk']);
    expect(halamanGrupLangsung('santri').map((h) => h.to)).toEqual([
      '/santri-aktif',
      '/penempatan',
      '/akademik',
    ]);
    // Tidak ada lagi subgrup "lain-lain" di Santri (Rekap & Pengajuan pindah
    // jadi tab Santri Aktif).
    expect(halamanSubgrup('santri', 'lain-lain')).toEqual([]);
    // Pegawai: PTK Aktif lalu Penempatan (3 tab), tanpa subgrup.
    expect(halamanGrupLangsung('pegawai').map((h) => h.to)).toEqual([
      '/pegawai-keaktifan',
      '/penempatan-pegawai',
    ]);
  });

  it('PSB kini grup tersendiri di atas Santri (dua halaman, tanpa subgrup)', () => {
    expect(NAV_GRUP.map((g) => g.id)).toEqual([
      'beranda',
      'master',
      'psb',
      'santri',
      'pegawai',
      'dokumen',
      'keuangan',
      'pengaturan',
    ]);
    expect(halamanGrupLangsung('psb').map((h) => h.to)).toEqual(['/psb', '/kegiatan-psb']);
    expect(halamanDariPath('/psb')?.tab).toBe('psb');
    expect(halamanDariPath('/psb/pendaftar')?.tab).toBe('psb');
    expect(halamanDariPath('/kegiatan-psb')?.tab).toBe('psb');
    // Tidak ada lagi halaman ber-subgrup psb di dalam Santri.
    expect(halamanSubgrup('santri', 'psb')).toEqual([]);
  });

  it('izin halaman gabungan = gabungan izin semua tab', () => {
    expect(izinHalaman(HALAMAN_DATA_INDUK)).toEqual([
      'pengguna.lihat',
      'lembaga.lihat',
      'tahun_ajaran.lihat',
      'semester.aktivasi',
      'kelas.lihat',
      'santri.lihat',
      'referensi.lihat',
    ]);
    expect(izinHalaman(HALAMAN_PENEMPATAN)).toEqual([
      'santri.lihat',
      'rekap_santri.lihat',
      'riwayat_belajar.lihat',
    ]);
    expect(izinHalaman(HALAMAN_AKADEMIK)).toEqual([
      'pindah_kelas.lihat',
      'mutasi_keluar.lihat',
      'kenaikan.lihat',
      'kelulusan.lihat',
    ]);
    expect(izinHalaman(HALAMAN_SANTRI_AKTIF)).toEqual([
      'daftar_kelas.lihat',
      'rekap_santri.lihat',
      'pengajuan_biodata.lihat',
    ]);
    expect(izinHalaman(HALAMAN_PENEMPATAN_PEGAWAI)).toEqual([
      'pegawai.lihat',
      'pegawai.lihat',
      'pegawai.lihat',
    ]);
  });

  it('izin halaman biasa = izin tunggalnya', () => {
    const keuangan = HALAMAN.find((h) => h.to === '/keuangan');
    expect(keuangan && izinHalaman(keuangan)).toEqual(['keuangan.lihat']);
  });
});
