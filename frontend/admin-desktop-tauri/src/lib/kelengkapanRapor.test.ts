import { describe, expect, it } from 'vitest';
import {
  alasanCetakTerkunci,
  hitungKelengkapanKelas,
  type BarisKelengkapanSantri,
  type MapelKelengkapan,
} from './kelengkapanRapor';

const santri = (santri_id: number, mapel: number): BarisKelengkapanSantri => ({ santri_id, mapel });
const mapel = (n: number): MapelKelengkapan[] => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

describe('hitungKelengkapanKelas', () => {
  it('lengkap bila semua santri punya nilai untuk semua mapel', () => {
    const k = hitungKelengkapanKelas([santri(1, 5), santri(2, 5)], mapel(5));
    expect(k.lengkap).toBe(true);
    expect(k.belum).toBe(0);
    expect(k.mapelWajib).toBe(5);
  });

  it('menandai santri yang kurang dan mengurutkan yang paling kurang dulu', () => {
    const k = hitungKelengkapanKelas([santri(7, 4), santri(3, 1), santri(9, 5)], mapel(5));
    expect(k.lengkap).toBe(false);
    expect(k.belum).toBe(2);
    expect(k.santriKurang).toEqual([
      { santri_id: 3, kurang: 4 },
      { santri_id: 7, kurang: 1 },
    ]);
  });

  it('nilai berlebih tidak dihitung negatif', () => {
    const k = hitungKelengkapanKelas([santri(1, 7)], mapel(5));
    expect(k.lengkap).toBe(true);
    expect(k.santriKurang).toEqual([]);
  });

  it('kelas tanpa mapel tidak dianggap lengkap', () => {
    const k = hitungKelengkapanKelas([santri(1, 0)], mapel(0));
    expect(k.lengkap).toBe(false);
    expect(k.mapelWajib).toBe(0);
  });

  it('kelas tanpa santri tidak dianggap lengkap', () => {
    const k = hitungKelengkapanKelas([], mapel(3));
    expect(k.lengkap).toBe(false);
    expect(k.belum).toBe(0);
  });
});

describe('alasanCetakTerkunci', () => {
  it('kosong saat lengkap', () => {
    expect(alasanCetakTerkunci(hitungKelengkapanKelas([santri(1, 2)], mapel(2)))).toBe('');
  });

  it('menyebut jumlah santri yang belum lengkap', () => {
    const alasan = alasanCetakTerkunci(hitungKelengkapanKelas([santri(1, 1), santri(2, 2)], mapel(2)));
    expect(alasan).toContain('1 santri belum lengkap');
  });

  it('menyebut mapel belum diisi saat kelas tanpa mapel', () => {
    expect(alasanCetakTerkunci(hitungKelengkapanKelas([santri(1, 0)], mapel(0)))).toContain('belum punya mapel');
  });

  it('menyebut kelas kosong bila tidak ada santri', () => {
    expect(alasanCetakTerkunci(hitungKelengkapanKelas([], mapel(3)))).toContain('Belum ada santri');
  });
});
