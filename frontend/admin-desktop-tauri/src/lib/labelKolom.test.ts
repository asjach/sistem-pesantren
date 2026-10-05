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
    expect(labelKolom('nik')).toBe('NIK');
    expect(labelKolom('nipp')).toBe('NIPP');
    expect(labelKolom('jenis_ptk')).toBe('Jenis PTK');
    expect(labelKolom('no_bpjs')).toBe('No BPJS');
    expect(labelKolom('rt_rw')).toBe('RT RW');
    expect(labelKolom('no_hp')).toBe('No HP');
    expect(labelKolom('jk')).toBe('JK');
  });

  it('kolom boolean is_ hanya tampilkan nama state', () => {
    expect(labelKolom('is_aktif')).toBe('Aktif');
    expect(labelKolom('is_seleksi')).toBe('Seleksi');
    expect(labelKolom('is_active_lembaga')).toBe('Active Lembaga');
  });

  it('bentuk tabel.kolom tidak lagi dipangkas (tulis prosa langsung)', () => {
    expect(labelKolom('santri.nama_lengkap')).toBe('santri.nama_lengkap');
    expect(labelKolom('kelas.nama_kelas')).toBe('kelas.nama_kelas');
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