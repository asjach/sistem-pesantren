import { describe, expect, it } from 'vitest';
import { labelKolom } from './labelKolom';

describe('labelKolom', () => {
  it('humanize nama kolom mentah', () => {
    expect(labelKolom('nama_lengkap')).toBe('Nama Lengkap');
    expect(labelKolom('kapasitas')).toBe('Kapasitas');
    expect(labelKolom('tahun_ajaran')).toBe('Tahun Ajaran');
    expect(labelKolom('nama_lengkap_santri')).toBe('Nama Lengkap Santri');
  });

  it('jaga singkatan tetap kapital', () => {
    expect(labelKolom('nip')).toBe('NIP');
    expect(labelKolom('nis_lokal')).toBe('NIS Lokal');
    expect(labelKolom('no_peserta')).toBe('No Peserta');
    expect(labelKolom('k1')).toBe('K1');
  });

  it('pangkas nama tabel lalu humanize', () => {
    expect(labelKolom('santri.nama_lengkap')).toBe('Nama Lengkap');
    expect(labelKolom('kelas.nama_kelas')).toBe('Nama Kelas');
    expect(labelKolom('lembaga.nama')).toBe('Nama');
  });

  it('label prosa dipakai apa adanya', () => {
    expect(labelKolom('Jenis Dokumen')).toBe('Jenis Dokumen');
    expect(labelKolom('Rata usia')).toBe('Rata usia');
    expect(labelKolom('L')).toBe('L');
  });

  it('label kosong tetap kosong', () => {
    expect(labelKolom('')).toBe('');
    expect(labelKolom(null)).toBe('');
    expect(labelKolom(undefined)).toBe('');
  });
});