import { describe, expect, it } from 'vitest';
import {
  kartuModul,
  kelompokkanKolom,
  modulDariKode,
  modulPertama,
  ratakanKartu,
  ringkasanModul,
  type KartuPapan,
} from './papan';
import type { ModulPapan } from '@/api/papan';

const modul: ModulPapan[] = [
  {
    kode: 'E',
    nama: 'Keuangan',
    sub: [
      {
        kode: 'E.3',
        nama: 'Rekap & Tutup Buku Kas',
        status: 'akan',
        butir: [
          { id: 1, status: 'akan', deskripsi: 'Rekap per kas.' },
          { id: 2, status: 'akan', deskripsi: 'Mutasi harian.' },
          { id: 3, status: 'ditunda', deskripsi: 'Tarif asrama.' },
        ],
      },
      {
        kode: 'E.4',
        nama: 'Tunggakan',
        status: 'sudah',
        butir: [{ id: 4, status: 'sudah', deskripsi: 'Crosstab tunggakan.' }],
      },
    ],
  },
  {
    kode: 'F',
    nama: 'Portal & Klien',
    sub: [
      { kode: 'F.3', nama: 'Aplikasi Mobile', status: 'sedang', butir: [] },
    ],
  },
];

describe('ratakanKartu', () => {
  it('membawa konteks modul ke tiap kartu', () => {
    const kartu = ratakanKartu(modul);

    expect(kartu).toHaveLength(3);
    expect(kartu[0].modulKode).toBe('E');
    expect(kartu[0].modulNama).toBe('Keuangan');
    expect(kartu[2].modulNama).toBe('Portal & Klien');
  });

  it('menghitung jumlah butir per status', () => {
    const kartu = ratakanKartu(modul);

    expect(kartu[0].jumlahButir).toEqual({ sudah: 0, sedang: 0, akan: 2, ditunda: 1 });
    expect(kartu[1].jumlahButir).toEqual({ sudah: 1, sedang: 0, akan: 0, ditunda: 0 });
    expect(kartu[2].jumlahButir).toEqual({ sudah: 0, sedang: 0, akan: 0, ditunda: 0 });
  });
});

describe('kelompokkanKolom', () => {
  it('selalu menghasilkan empat kolom berurutan', () => {
    const kolom = kelompokkanKolom(ratakanKartu(modul));

    expect(kolom.map((k) => k.id)).toEqual(['akan', 'sedang', 'sudah', 'ditunda']);
    expect(kolom.map((k) => k.judul)).toEqual(['Akan', 'Sedang', 'Sudah', 'Ditunda']);
  });

  it('menempatkan kartu di kolom sesuai status sub-modul', () => {
    const kolom = kelompokkanKolom(ratakanKartu(modul));

    expect(kolom[0].kartu.map((k) => k.kode)).toEqual(['E.3']);
    expect(kolom[1].kartu.map((k) => k.kode)).toEqual(['F.3']);
    expect(kolom[2].kartu.map((k) => k.kode)).toEqual(['E.4']);
    expect(kolom[3].kartu).toEqual([]);
  });

  it('menjaga kolom kosong tetap tampil', () => {
    const kosong: KartuPapan[] = [];
    const kolom = kelompokkanKolom(kosong);

    expect(kolom).toHaveLength(4);
    expect(kolom.every((k) => k.kartu.length === 0)).toBe(true);
  });

  it('tidak menggandakan kartu antar kolom', () => {
    const kolom = kelompokkanKolom(ratakanKartu(modul));
    const semua = kolom.flatMap((k) => k.kartu.map((c) => c.kode));

    expect(semua.sort()).toEqual(['E.3', 'E.4', 'F.3']);
  });
});

describe('kartuModul', () => {
  it('hanya mengambil kartu milik modul itu', () => {
    const kartu = kartuModul(modul[0]);

    expect(kartu.map((k) => k.kode)).toEqual(['E.3', 'E.4']);
    expect(kartu.every((k) => k.modulKode === 'E')).toBe(true);
  });

  it('modul tanpa sub-modul menghasilkan daftar kosong', () => {
    expect(kartuModul({ kode: 'Z', nama: 'Kosong', sub: [] })).toEqual([]);
  });
});

describe('ringkasanModul', () => {
  it('menghitung sub-modul per status', () => {
    expect(ringkasanModul(modul[0])).toEqual({ sudah: 1, sedang: 0, akan: 1, ditunda: 0 });
    expect(ringkasanModul(modul[1])).toEqual({ sudah: 0, sedang: 1, akan: 0, ditunda: 0 });
  });

  it('modul kosong menghasilkan semua nol', () => {
    expect(ringkasanModul({ kode: 'Z', nama: 'Kosong', sub: [] })).toEqual({
      sudah: 0,
      sedang: 0,
      akan: 0,
      ditunda: 0,
    });
  });
});

describe('modulDariKode', () => {
  it('menemukan modul dari kode persis', () => {
    expect(modulDariKode(modul, 'E')?.nama).toBe('Keuangan');
  });

  it('tidak peka huruf besar-kecil', () => {
    expect(modulDariKode(modul, 'e')?.nama).toBe('Keuangan');
    expect(modulDariKode(modul, ' f ')?.nama).toBe('Portal & Klien');
  });

  it('mengembalikan null untuk kode kosong atau tak dikenal', () => {
    expect(modulDariKode(modul, undefined)).toBeNull();
    expect(modulDariKode(modul, '')).toBeNull();
    expect(modulDariKode(modul, 'ZZ')).toBeNull();
  });
});

describe('modulPertama', () => {
  it('melewati modul yang belum punya sub-modul', () => {
    const denganKosong = [{ kode: 'A', nama: 'Kosong', sub: [] }, ...modul];

    expect(modulPertama(denganKosong)?.kode).toBe('E');
  });

  it('memakai modul pertama bila semuanya kosong', () => {
    expect(modulPertama([{ kode: 'A', nama: 'Kosong', sub: [] }])?.kode).toBe('A');
  });

  it('mengembalikan null bila tidak ada modul', () => {
    expect(modulPertama([])).toBeNull();
  });
});
