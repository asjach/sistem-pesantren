import { describe, expect, it } from 'vitest';
import {
  kemajuanButir,
  kemajuanModul,
  kemajuanPoin,
  kartuModul,
  kelompokkanKolom,
  kolomSebelah,
  modulDariKode,
  modulAdaTinjauan,
  modulPertama,
  persenKemajuan,
  ratakanKartu,
  ringkasanModul,
  ringkasanPoin,
  type KartuPapan,
} from './papan';
import type { ButirPapan, ModulPapan } from '@/api/papan';

const modul: ModulPapan[] = [
  {
    kode: 'E',
    nama: 'Keuangan',
    sub: [
      {
        kode: 'E.3',
        nama: 'Rekap & Tutup Buku Kas',
        status: 'todo',
        butir: [
          { id: 1, status: 'todo', deskripsi: 'Rekap per kas.' },
          { id: 2, status: 'todo', deskripsi: 'Mutasi harian.' },
          { id: 3, status: 'backlog', deskripsi: 'Tarif asrama.' },
        ],
      },
      {
        kode: 'E.4',
        nama: 'Tunggakan',
        status: 'done',
        butir: [{ id: 4, status: 'done', deskripsi: 'Crosstab tunggakan.' }],
      },
    ],
  },
  {
    kode: 'F',
    nama: 'Portal & Klien',
    sub: [
      { kode: 'F.3', nama: 'Aplikasi Mobile', status: 'todo', butir: [] },
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

    // E.3 berstatus 'todo' (turunan), tapi poin #3 sendiri 'backlog'.
    expect(kartu[2].status).toBe('backlog');
    expect(kartu[2].statusSub).toBe('todo');
  });

  it('sub-modul tanpa poin tidak menghasilkan kartu sama sekali', () => {
    const kartu = ratakanKartu(modul);

    expect(kartu.some((k) => k.subKode === 'F.3')).toBe(false);
  });
});

describe('kelompokkanKolom', () => {
  it('selalu menghasilkan lima tahap workflow berurutan', () => {
    const kolom = kelompokkanKolom(ratakanKartu(modul));

    expect(kolom.map((k) => k.id)).toEqual(['backlog', 'todo', 'in_progress', 'for_review', 'done']);
    expect(kolom.map((k) => k.judul)).toEqual([
      'Belum dijadwalkan (Backlog)',
      'Siap dikerjakan (To Do)',
      'Sedang dikerjakan (In Progress)',
      'Menunggu peninjauan (For Review)',
      'Selesai (Done)',
    ]);
  });

  it('menggabungkan poin satu sub-modul jadi SATU kartu per kolom', () => {
    const kolom = kelompokkanKolom(ratakanKartu(modul));

    // Sebelumnya tiap poin jadi kartu sendiri, sehingga sub-modul berpoin
    // banyak tampil sebagai banyak kartu berjudul sama.
    expect(kolom[0].kartu[0].poin.map((p) => p.id)).toEqual([3]);
    expect(kolom[1].kartu.map((k) => k.subKode)).toEqual(['E.3']);
    expect(kolom[1].kartu[0].poin.map((p) => p.id)).toEqual([1, 2]);
    expect(kolom[4].kartu[0].poin.map((p) => p.id)).toEqual([4]);
    expect(kolom[2].kartu).toEqual([]);
    expect(kolom[3].kartu).toEqual([]);
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
            status: 'todo',
            butir: [
              { id: 1, status: 'todo', deskripsi: 'A.' },
              { id: 2, status: 'todo', deskripsi: 'B.' },
              { id: 3, status: 'todo', deskripsi: 'C.' },
            ],
          },
        ],
      },
    ];
    const kolom = kelompokkanKolom(ratakanKartu(banyak));

    expect(kolom[1].kartu).toHaveLength(1);
    expect(kolom[1].kartu[0].poin).toHaveLength(3);
  });

  it('menjaga kolom kosong tetap tampil', () => {
    const kosong: KartuPapan[] = [];
    const kolom = kelompokkanKolom(kosong);

    expect(kolom).toHaveLength(5);
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
            status: 'in_progress',
            butir: [
              { id: 1, status: 'done', deskripsi: 'A.' },
              { id: 2, status: 'in_progress', deskripsi: 'B.' },
            ],
          },
        ],
      },
    ];
    const kolom = kelompokkanKolom(ratakanKartu(denganCampuran));

    // Satu sub-modul tetap muncul di DUA kolom (memang diinginkan), tapi
    // di tiap kolom hanya sekali, dan isinya hanya poin berstatus itu.
    expect(kolom[2].kartu).toHaveLength(1);
    expect(kolom[4].kartu).toHaveLength(1);
    expect(kolom[2].kartu[0].poin.map((p) => p.id)).toEqual([2]);
    expect(kolom[4].kartu[0].poin.map((p) => p.id)).toEqual([1]);
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
    expect(ringkasanModul(modul[0])).toEqual({ backlog: 1, todo: 2, in_progress: 0, for_review: 0, done: 1 });
    expect(ringkasanModul(modul[1])).toEqual({ backlog: 0, todo: 0, in_progress: 0, for_review: 0, done: 0 });
  });

  it('modul kosong menghasilkan semua nol', () => {
    expect(ringkasanModul({ kode: 'Z', nama: 'Kosong', sub: [] })).toEqual({
      backlog: 0,
      todo: 0,
      in_progress: 0,
      for_review: 0,
      done: 0,
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
        status: 'in_progress',
        butir: [
          {
            id: 10,
            status: 'in_progress',
            deskripsi: 'Poin A.',
            subpoin: [
              { teks: 'A1.', selesai: true },
              { teks: 'A2.', selesai: false },
            ],
          },
          {
            id: 11,
            status: 'done',
            deskripsi: 'Poin B.',
            subpoin: [{ teks: 'B1.', selesai: true }],
          },
          { id: 12, status: 'done', deskripsi: 'Poin C.' },
        ],
      }],
    };

    expect(kemajuanModul(denganSubpoin)).toEqual({ selesai: 3, total: 4 });
  });

  it('modul tanpa poin menghasilkan 0/0, bukan dianggap selesai', () => {
    expect(kemajuanModul({ kode: 'Z', nama: 'Kosong', sub: [] })).toEqual({ selesai: 0, total: 0 });
  });
});


describe('kemajuanButir', () => {
  const butir: ButirPapan[] = [
    { id: 1, status: 'in_progress', deskripsi: 'A.' },
    {
      id: 2,
      status: 'in_progress',
      deskripsi: 'B.',
      subpoin: [
        { teks: 'B1.', selesai: true },
        { teks: 'B2.', selesai: false },
      ],
    },
    { id: 3, status: 'done', deskripsi: 'C.' },
  ];

  it('menghitung subpoin sebagai unit dan poin tanpa subpoin satu unit', () => {
    expect(kemajuanButir(butir)).toEqual({ selesai: 2, total: 4 });
  });

  it('daftar kosong menghasilkan 0/0', () => {
    expect(kemajuanButir([])).toEqual({ selesai: 0, total: 0 });
  });

  it('poin Done dengan subpoin dihitung dari subpoinnya, bukan statusnya', () => {
    const campur: ButirPapan[] = [
      {
        id: 9,
        status: 'done',
        deskripsi: 'Sudah.',
        subpoin: [
          { teks: 'x', selesai: true },
          { teks: 'y', selesai: false },
        ],
      },
    ];

    expect(kemajuanButir(campur)).toEqual({ selesai: 1, total: 2 });
  });
});

describe('kemajuanPoin', () => {
  it('sama hasilnya dengan kemajuanButir untuk daftar poin papan', () => {
    const poin: KartuPapan[] = ratakanKartu(modul);
    expect(kemajuanPoin(poin)).toEqual(kemajuanButir(modul[0].sub.flatMap((s) => s.butir)));
  });
});

describe('persenKemajuan', () => {
  it('membulatkan ke persen bulat', () => {
    expect(persenKemajuan({ selesai: 1, total: 3 })).toBe(33);
    expect(persenKemajuan({ selesai: 3, total: 4 })).toBe(75);
    expect(persenKemajuan({ selesai: 4, total: 4 })).toBe(100);
  });

  it('tanpa isi bernilai 0, bukan 100', () => {
    expect(persenKemajuan({ selesai: 0, total: 0 })).toBe(0);
  });
});

describe('ringkasanPoin', () => {
  it('menghitung poin per status dari daftar poin', () => {
    const ringkasan = ringkasanPoin(kartuModul(modul[0]));
    expect(ringkasan).toEqual({ backlog: 1, todo: 2, in_progress: 0, for_review: 0, done: 1 });
  });

  it('daftar kosong menghasilkan semua nol', () => {
    expect(ringkasanPoin([])).toEqual({ backlog: 0, todo: 0, in_progress: 0, for_review: 0, done: 0 });
  });
});

describe('kolomSebelah', () => {
  it('menggeser ke kanan sesuai urutan tampil', () => {
    expect(kolomSebelah('backlog', 1)).toBe('todo');
    expect(kolomSebelah('todo', 1)).toBe('in_progress');
    expect(kolomSebelah('in_progress', 1)).toBe('for_review');
    expect(kolomSebelah('for_review', 1)).toBe('done');
  });

  it('menggeser ke kiri sesuai urutan tampil', () => {
    expect(kolomSebelah('done', -1)).toBe('for_review');
    expect(kolomSebelah('for_review', -1)).toBe('in_progress');
    expect(kolomSebelah('in_progress', -1)).toBe('todo');
    expect(kolomSebelah('todo', -1)).toBe('backlog');
  });

  it('mengembalikan null di ujung, bukan membalik ke kolom lain', () => {
    expect(kolomSebelah('backlog', -1)).toBeNull();
    expect(kolomSebelah('done', 1)).toBeNull();
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

describe('modulAdaTinjauan', () => {
  const denganStatus = (...status: ButirPapan['status'][]): ModulPapan => ({
    kode: 'T',
    nama: 'Uji',
    sub: [{
      kode: 'T.1',
      nama: 'Sub uji',
      status: 'todo',
      butir: status.map((s, i) => ({ id: i + 1, status: s, deskripsi: `Poin ${i + 1}.` })),
    }],
  });

  it('true bila ada satu poin for_review', () => {
    expect(modulAdaTinjauan(denganStatus('done', 'for_review'))).toBe(true);
  });

  it('true bila seluruh poin for_review', () => {
    expect(modulAdaTinjauan(denganStatus('for_review', 'for_review'))).toBe(true);
  });

  it('false bila tidak ada poin for_review', () => {
    expect(modulAdaTinjauan(denganStatus('todo', 'in_progress', 'done'))).toBe(false);
  });

  it('false untuk modul tanpa poin', () => {
    expect(modulAdaTinjauan({ kode: 'K', nama: 'Kosong', sub: [] })).toBe(false);
  });
});
