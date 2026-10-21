import { describe, expect, it } from 'vitest';
import {
  DESAIN_BAWAAN_KARTU, idElemenKartu, nilaiElemenKartu, pilihDesainKartu,
  pindahkanElemenKartu, ubahUkuranElemenKartu,
} from './desainKartuPeserta';

describe('desain kartu peserta', () => {
  it('menyediakan tiga desain bawaan dengan elemen foto', () => {
    expect(DESAIN_BAWAAN_KARTU).toHaveLength(3);
    expect(DESAIN_BAWAAN_KARTU.every((desain) => desain.elemen.some((item) => item.tipe === 'foto'))).toBe(true);
  });

  it('membatasi posisi elemen agar tetap di dalam bidang desain', () => {
    const elemen = DESAIN_BAWAAN_KARTU[0].elemen[0];
    expect(pindahkanElemenKartu(elemen, 99, -20)).toMatchObject({ x: 35, y: 0 });
  });

  it('memilih desain tersimpan atau kembali ke template bawaan', () => {
    const tersimpan = {
      id: 9, jenjang: 'MI', nama: 'Desain Saya', elemen: DESAIN_BAWAAN_KARTU[1].elemen,
      warna_latar: '#ffffff', gaya_latar: 'modern' as const, latar_ada: false, latar_url: null,
    };
    expect(pilihDesainKartu([tersimpan], { desain_id: 9, template_bawaan: 'klasik' })).toMatchObject({
      id: 9, nama: 'Desain Saya', sumber: 'pengguna',
    });
    expect(pilihDesainKartu([], { desain_id: null, template_bawaan: 'bersih' })).toMatchObject({
      id: 'bawaan:bersih', nama: 'Bersih Minimal',
    });
  });

  it('membatasi ukuran elemen agar tidak keluar bidang desain', () => {
    const elemen = DESAIN_BAWAAN_KARTU[0].elemen[0];
    expect(ubahUkuranElemenKartu(elemen, 1, 200)).toMatchObject({ lebar: 5, tinggi: 92 });
  });

  it('memberi id unik saat elemen sejenis ditambahkan berulang', () => {
    expect(idElemenKartu('data_nama', [])).toBe('data_nama');
    expect(idElemenKartu('data_nama', [{ ...DESAIN_BAWAAN_KARTU[0].elemen[0], id: 'data_nama' }]))
      .toBe('data_nama_2');
  });

  it('mengubah data peserta menjadi teks kartu', () => {
    const elemen = DESAIN_BAWAAN_KARTU[0].elemen.find((item) => item.field === 'nomor_peserta');
    expect(nilaiElemenKartu(elemen!, {
      peserta: {
        santri_id: 1, nama: 'Ahmad', jk: 'L', foto_url: null, nis_lokal: '101',
        kelas_id: 1, kelas: '1A', tingkat: '1', no_absen: 1,
        nomor_peserta: '26.27.ASAS.01.0001', sumber_nomor: 'otomatis',
      },
      peristiwa: {
        id: 1, jenjang: 'MI', tahun_ajaran: '2026/2027', kode: 'ASAS', nama: 'ASAS',
        cakupan: 'semua', kurikulum: 'keduanya', rentang_nilai: '0-100', jenis_rapor: 'akhir', urutan: 1, is_active: true,
      },
      semester: '1', lembaga: 'Madrasah Ibtidaiyah',
    })).toBe('26.27.ASAS.01.0001');
  });
});
