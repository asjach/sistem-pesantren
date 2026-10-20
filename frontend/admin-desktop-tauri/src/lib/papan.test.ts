import { describe, expect, it } from 'vitest';
import {
  kartuModul,
  kemajuanModul,
  kelompokkanKolom,
  kolomSebelah,
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
      { kode: 'F.3', nama: 'Aplikasi Mobile', status: 'akan', butir: [] },
    ],
  },
];

describe('ratakanKartu', () => {
  it('menghasilkan satu kartu per POIN, bukan per sub-modul', () => {
    const kartu = ratakanKartu(modul);

    // E.3 punya 3 poin, E.4 punya 1, F.3 punya 0 -> total 4 kartu.
    expect(kartu).toHaveLength(4);
    expect(kartu.map((k) => k.id)).toEqual([1, 2, 3, 4]);
  });

  it('membawa konteks modul dan sub-modul ke tiap kartu', () => {
    const kartu = ratakanKartu(modul);

    expect(kartu[0].modulKode).toBe('E');
    expect(kartu[0].modulNama).toBe('Keuangan');
    expect(kartu[0].subKode).toBe('E.3');
    expect(kartu[0].subNama).toBe('Rekap & Tutup Buku Kas');
    expect(kartu[0].deskripsi).toBe('Rekap per kas.');
  });

  it('status kartu mengikuti status poinnya, bukan status sub-modul', () => {
    const kartu = ratakanKartu(modul);

    // E.3 berstatus 'akan' (turunan), tapi poin #3 sendiri 'ditunda'.
    expect(kartu[2].status).toBe('ditunda');
    expect(kartu[2].statusSub).toBe('akan');
  });

  it('sub-modul tanpa poin tidak menghasilkan kartu sama sekali', () => {
    const kartu = ratakanKartu(modul);

    expect(kartu.some((k) => k.subKode === 'F.3')).toBe(false);
  });
});

describe('kelompokkanKolom', () => {
  it('selalu menghasilkan empat kolom berurutan', () => {
    const kolom = kelompokkanKolom(ratakanKartu(modul));

    expect(kolom.map((k) => k.id)).toEqual(['akan', 'sedang', 'sudah', 'ditunda']);
    expect(kolom.map((k) => k.judul)).toEqual(['Akan', 'Sedang', 'Sudah', 'Ditunda']);
  });

  it('menggabungkan poin satu sub-modul jadi SATU kartu per kolom', () => {
    const kolom = kelompokkanKolom(ratakanKartu(modul));

    // Sebelumnya tiap poin jadi kartu sendiri, sehingga sub-modul berpoin
    // banyak tampil sebagai banyak kartu berjudul sama.
    expect(kolom[0].kartu.map((k) => k.subKode)).toEqual(['E.3']);
    expect(kolom[0].kartu[0].poin.map((p) => p.id)).toEqual([1, 2]);
    expect(kolom[2].kartu[0].poin.map((p) => p.id)).toEqual([4]);
    expect(kolom[3].kartu[0].poin.map((p) => p.id)).toEqual([3]);
    expect(kolom[1].kartu).toEqual([]);
  });

  it('judul sub-modul TIDAK berulang dalam satu kolom', () => {
    const banyak: ModulPapan[] = [
      {
        kode: 'D',
        nama: 'Penilaian',
        sub: [
          {
            kode: 'D.1',
            nama: 'Nilai',
            status: 'akan',
            butir: [
              { id: 1, status: 'akan', deskripsi: 'A.' },
              { id: 2, status: 'akan', deskripsi: 'B.' },
              { id: 3, status: 'akan', deskripsi: 'C.' },
            ],
          },
        ],
      },
    ];
    const kolom = kelompokkanKolom(ratakanKartu(banyak));

    expect(kolom[0].kartu).toHaveLength(1);
    expect(kolom[0].kartu[0].poin).toHaveLength(3);
  });

  it('menjaga kolom kosong tetap tampil', () => {
    const kosong: KartuPapan[] = [];
    const kolom = kelompokkanKolom(kosong);

    expect(kolom).toHaveLength(4);
    expect(kolom.every((k) => k.kartu.length === 0)).toBe(true);
  });

  it('setiap poin muncul tepat sekali di seluruh papan', () => {
    const kolom = kelompokkanKolom(ratakanKartu(modul));
    const semua = kolom.flatMap((k) => k.kartu.flatMap((c) => c.poin.map((p) => p.id)));

    expect(semua.sort()).toEqual([1, 2, 3, 4]);
  });

  it('poin dari satu sub-modul boleh tersebar di beberapa kolom', () => {
    const denganCampuran: ModulPapan[] = [
      {
        kode: 'E',
        nama: 'Keuangan',
        sub: [
          {
            kode: 'E.3',
            nama: 'Rekap',
            status: 'sedang',
            butir: [
              { id: 1, status: 'sudah', deskripsi: 'A.' },
              { id: 2, status: 'sedang', deskripsi: 'B.' },
            ],
          },
        ],
      },
    ];
    const kolom = kelompokkanKolom(ratakanKartu(denganCampuran));

    // Satu sub-modul tetap muncul di DUA kolom (memang diinginkan), tapi
    // di tiap kolom hanya sekali, dan isinya hanya poin berstatus itu.
    expect(kolom[1].kartu).toHaveLength(1);
    expect(kolom[2].kartu).toHaveLength(1);
    expect(kolom[1].kartu[0].poin.map((p) => p.id)).toEqual([2]);
    expect(kolom[2].kartu[0].poin.map((p) => p.id)).toEqual([1]);
  });
});

describe('kartuModul', () => {
  it('hanya mengambil kartu milik modul itu', () => {
    const kartu = kartuModul(modul[0]);

    expect(kartu.map((k) => k.id)).toEqual([1, 2, 3, 4]);
    expect(kartu.every((k) => k.modulKode === 'E')).toBe(true);
  });

  it('modul tanpa sub-modul menghasilkan daftar kosong', () => {
    expect(kartuModul({ kode: 'Z', nama: 'Kosong', sub: [] })).toEqual([]);
  });
});

describe('ringkasanModul', () => {
  it('menghitung POIN per status', () => {
    expect(ringkasanModul(modul[0])).toEqual({ sudah: 1, sedang: 0, akan: 2, ditunda: 1 });
    expect(ringkasanModul(modul[1])).toEqual({ sudah: 0, sedang: 0, akan: 0, ditunda: 0 });
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

describe('kemajuanModul', () => {
  it('menghitung poin selesai dari total poin', () => {
    expect(kemajuanModul(modul[0])).toEqual({ selesai: 1, total: 4 });
  });

  it('menghitung subpoin sebagai unit, poin tanpa subpoin tetap satu unit', () => {
    const denganSubpoin: ModulPapan = {
      kode: 'S',
      nama: 'Subpoin',
      sub: [{
        kode: 'S.1',
        nama: 'Satu',
        status: 'sedang',
        butir: [
          {
            id: 10,
            status: 'sedang',
            deskripsi: 'Poin A.',
            subpoin: [
              { teks: 'A1.', selesai: true },
              { teks: 'A2.', selesai: false },
            ],
          },
          {
            id: 11,
            status: 'sudah',
            deskripsi: 'Poin B.',
            subpoin: [{ teks: 'B1.', selesai: true }],
          },
          { id: 12, status: 'sudah', deskripsi: 'Poin C.' },
        ],
      }],
    };

    expect(kemajuanModul(denganSubpoin)).toEqual({ selesai: 3, total: 4 });
  });

  it('modul tanpa poin menghasilkan 0/0, bukan dianggap selesai', () => {
    expect(kemajuanModul({ kode: 'Z', nama: 'Kosong', sub: [] })).toEqual({ selesai: 0, total: 0 });
  });
});


describe('kolomSebelah', () => {
  it('menggeser ke kanan sesuai urutan tampil', () => {
    expect(kolomSebelah('akan', 1)).toBe('sedang');
    expect(kolomSebelah('sedang', 1)).toBe('sudah');
    expect(kolomSebelah('sudah', 1)).toBe('ditunda');
  });

  it('menggeser ke kiri sesuai urutan tampil', () => {
    expect(kolomSebelah('ditunda', -1)).toBe('sudah');
    expect(kolomSebelah('sudah', -1)).toBe('sedang');
    expect(kolomSebelah('sedang', -1)).toBe('akan');
  });

  it('mengembalikan null di ujung, bukan membalik ke kolom lain', () => {
    expect(kolomSebelah('akan', -1)).toBeNull();
    expect(kolomSebelah('ditunda', 1)).toBeNull();
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
  it('melewati modul yang belum punya POIN', () => {
    const denganKosong = [{ kode: 'A', nama: 'Kosong', sub: [] }, ...modul];

    expect(modulPertama(denganKosong)?.kode).toBe('E');
  });

  it('melewati modul yang sub-modulnya tidak punya poin', () => {
    const hanyaKosong = [{ kode: 'A', nama: 'Ada sub tanpa poin', sub: modul[1].sub }];

    expect(modulPertama(hanyaKosong)?.kode).toBe('A');
  });

  it('memakai modul pertama bila semuanya kosong', () => {
    expect(modulPertama([{ kode: 'A', nama: 'Kosong', sub: [] }])?.kode).toBe('A');
  });

  it('mengembalikan null bila tidak ada modul', () => {
    expect(modulPertama([])).toBeNull();
  });
});
