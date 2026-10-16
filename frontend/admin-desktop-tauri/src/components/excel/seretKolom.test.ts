import { describe, expect, it } from 'vitest';

import { dxPerKolom, indeksSisip, lepasSah, pindahKolom, tandaSisip } from './seretKolom';

const A = ['a', 'b', 'c', 'd'];

describe('pindahKolom', () => {
  it('memindahkan ke depan', () => {
    expect(pindahKolom(A, 2, 0)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('memindahkan ke belakang', () => {
    expect(pindahKolom(A, 0, 3)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('memindahkan ke paling akhir', () => {
    expect(pindahKolom(A, 0, 4)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('geser ke posisi sendiri = tak berubah', () => {
    expect(pindahKolom(A, 1, 1)).toEqual(A);
    expect(pindahKolom(A, 1, 2)).toEqual(A);
  });

  it('tidak mengubah array masukan', () => {
    const asli = [...A];
    pindahKolom(A, 0, 3);
    expect(A).toEqual(asli);
  });

  it('indeks di luar rentang dijepit, bukan melempar', () => {
    // `dari` -5 → 0; `ke` 2 = sisip sebelum indeks 2 daftar asal = 'a'
    // berpindah melewati 'b'.
    expect(pindahKolom(A, -5, 2)).toEqual(['b', 'a', 'c', 'd']);
    expect(pindahKolom(A, 99, 0)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('`ke` adalah indeks sisip pada daftar ASAL (ke=1 untuk item ke-0 = no-op)', () => {
    // Penting untuk kalibrasi UI: kursor di separuh kiri kolom ke-1
    // menghasilkan ke=1, dan itu memang belum memindahkan apa pun.
    expect(pindahKolom(A, 0, 1)).toEqual(['a', 'b', 'c', 'd']);
    expect(pindahKolom(A, 0, 2)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('daftar kosong atau satu item tetap aman', () => {
    expect(pindahKolom([], 0, 0)).toEqual([]);
    expect(pindahKolom(['x'], 0, 1)).toEqual(['x']);
  });

  it('tidak kehilangan atau menggandakan item', () => {
    const hasil = pindahKolom(A, 1, 4);
    expect([...hasil].sort()).toEqual([...A].sort());
  });
});

describe('seretKolom — kalibrasi jalur lepas (indeks sisip -> urutan baru)', () => {
  const K = ['nama', 'urutan', 'sumber', 'tampil'];

  it('seret kolom pertama melewati titik tengah kolom ketiga', () => {
    // Inilah yang terjadi di browser: kursor di tengah 'sumber' (indeks 2)
    // menghasilkan sisip=3 pada daftar asal.
    expect(pindahKolom(K, 0, 3)).toEqual(['urutan', 'sumber', 'nama', 'tampil']);
  });

  it('seret kolom pertama tepat sebelum kolom kedua = tak berubah', () => {
    expect(pindahKolom(K, 0, 1)).toEqual(K);
  });

  it('seret kolom terakhir ke awal', () => {
    expect(pindahKolom(K, 3, 0)).toEqual(['tampil', 'nama', 'urutan', 'sumber']);
  });
});


describe('lepasSah — gerbang pelepasan seret', () => {
  // Geometri nyata dari browser: header y=104..130, kolom x=395..906.
  const HEADER = { top: 104, bottom: 130, height: 26 };
  const BATAS = [395, 509, 725, 849];
  const LEBAR = [57, 108, 62, 57];

  it('menerima pelepasan di tengah deretan kolom', () => {
    expect(lepasSah(HEADER, BATAS, LEBAR, 700, 117)).toBe(true);
  });

  it('menerima pelepasan tepat di dalam tepi kiri & kanan', () => {
    expect(lepasSah(HEADER, BATAS, LEBAR, 396, 117)).toBe(true);
    expect(lepasSah(HEADER, BATAS, LEBAR, 905, 117)).toBe(true);
  });

  it('menerima sedikit di luar tepi (toleransi 16px)', () => {
    expect(lepasSah(HEADER, BATAS, LEBAR, 380, 117)).toBe(true);
    expect(lepasSah(HEADER, BATAS, LEBAR, 921, 117)).toBe(true);
  });

  it('MENOLAK pelepasan jauh di kiri deretan kolom (x=50)', () => {
    // Inilah bug yang terbukti di browser: kolom terakhir meloncat ke depan.
    expect(lepasSah(HEADER, BATAS, LEBAR, 50, 117)).toBe(false);
  });

  it('MENOLAK pelepasan di bilah toolbar atas (y=20)', () => {
    expect(lepasSah(HEADER, BATAS, LEBAR, 700, 20)).toBe(false);
  });

  it('MENOLAK pelepasan jauh di bawah area header', () => {
    expect(lepasSah(HEADER, BATAS, LEBAR, 700, 800)).toBe(false);
  });

  it('menolak bila sabuk header tak terukur', () => {
    expect(lepasSah(null, BATAS, LEBAR, 700, 117)).toBe(false);
    expect(lepasSah({ top: 0, bottom: 0, height: 0 }, BATAS, LEBAR, 700, 117)).toBe(false);
  });

  it('menolak bila kolom belum terukur', () => {
    expect(lepasSah(HEADER, [], [], 700, 117)).toBe(false);
  });

  it('rentang mendatar memakai kolom TERUKUR, bukan lebar .dsg-row-header', () => {
    // `.dsg-row-header` di halaman itu hanya x=251..665 dan tak mencakup
    // kolom lengket kanan; memakainya akan meloloskan x=50 sebagai sah.
    expect(lepasSah(HEADER, BATAS, LEBAR, 50, 117)).toBe(false);
    expect(lepasSah(HEADER, BATAS, LEBAR, 660, 117)).toBe(true);
  });
});

describe('dxPerKolom — geseran visual pratinjau hidup', () => {
  /** Tiga kolom lebar sama, mulai di x=100 (kiri & lebar sejajar urutan a,b,c). */
  const KIRI = { a: 100, b: 200, c: 300 };
  const LEBAR = { a: 100, b: 100, c: 100 };
  const URUT = ['a', 'b', 'c'];

  it('urutan sama → tak ada yang digeser', () => {
    expect(dxPerKolom(KIRI, LEBAR, URUT)).toEqual({});
  });

  it('tukar posisi: yang mundur -100, yang maju +100', () => {
    expect(dxPerKolom(KIRI, LEBAR, ['b', 'a', 'c'])).toEqual({ a: 100, b: -100 });
  });

  it('pindah ke ujung kanan: yang di antaranya bergeser satu slot', () => {
    expect(dxPerKolom(KIRI, LEBAR, ['b', 'c', 'a'])).toEqual({ a: 200, b: -100, c: -100 });
  });

  it('lebar tak seragam → susunannya KOMPAK, tidak sekadar bertukar tempat', () => {
    // a(144) b(50) c(72) mulai di 0/144/194. Memindahkan a ke belakang harus
    // merapatkan b,c di depan (0 & 50), bukan menaruh b di posisi lama a.
    const kiri = { a: 0, b: 144, c: 194 };
    const lebar = { a: 144, b: 50, c: 72 };
    expect(dxPerKolom(kiri, lebar, ['b', 'c', 'a'])).toEqual({ a: 122, b: -144, c: -144 });
    // Kolom paling kanan pada susunan baru berakhir tepat di ujung kolom lain:
    // 0 + 50 + 72 = 122 untuk a, dan c berakhir di 122 juga — rapat, tanpa tumpang tindih.
  });

  it('titik awal diambil dari kolom TERUKUR paling kiri (grid bisa digulir)', () => {
    const kiri = { a: 500, b: 640, c: 760 };
    const lebar = { a: 140, b: 120, c: 90 };
    // c (90) ke paling kiri, lalu a (140), lalu b (120) — semuanya rapat dari 500.
    expect(dxPerKolom(kiri, lebar, ['c', 'a', 'b'])).toEqual({ a: 90, b: 90, c: -260 });
  });

  it('key yang tak terukur (kiri/lebar hilang) dilewati', () => {
    const kiri = { a: 100, c: 300 };
    const lebar = { a: 100, c: 100 };
    expect(dxPerKolom(kiri, lebar, ['c', 'a', 'b'])).toEqual({ a: 100, c: -200 });
  });

  it('tanpa kolom terukur → tak ada geseran', () => {
    expect(dxPerKolom({}, {}, URUT)).toEqual({});
  });
});

describe('indeksSisip', () => {
  // Tiga kolom lebar 100 mulai di x=0.
  const batas = [0, 100, 200];
  const lebar = [100, 100, 100];

  it('separuh kiri kolom → sisip SEBELUM kolom itu', () => {
    expect(indeksSisip(batas, lebar, 10)).toBe(0);
    expect(indeksSisip(batas, lebar, 140)).toBe(1);
  });

  it('separuh kanan kolom → sisip SESUDAH kolom itu', () => {
    expect(indeksSisip(batas, lebar, 60)).toBe(1);
    expect(indeksSisip(batas, lebar, 190)).toBe(2);
  });

  it('tepat di titik tengah dihitung sebagai sesudah', () => {
    // x == tengah kolom 0 (50) tidak < 50, jadi lanjut ke kolom berikutnya.
    expect(indeksSisip(batas, lebar, 50)).toBe(1);
  });

  it('di luar kiri/kanan dijepit ke ujung', () => {
    expect(indeksSisip(batas, lebar, -999)).toBe(0);
    expect(indeksSisip(batas, lebar, 9999)).toBe(3);
  });

  it('tanpa kolom → 0', () => {
    expect(indeksSisip([], [], 100)).toBe(0);
  });
});

describe('tandaSisip', () => {
  it('sisip di tengah → garis di kiri kolom itu', () => {
    expect(tandaSisip(3, 1)).toEqual({ indeks: 1, sisi: 'kiri' });
  });

  it('sisip di ujung kanan → garis di kanan kolom terakhir', () => {
    expect(tandaSisip(3, 3)).toEqual({ indeks: 2, sisi: 'kanan' });
  });

  it('sisip di awal → garis di kiri kolom pertama', () => {
    expect(tandaSisip(3, 0)).toEqual({ indeks: 0, sisi: 'kiri' });
  });

  it('tanpa kolom → null', () => {
    expect(tandaSisip(0, 0)).toBeNull();
  });

  it('indeks di luar rentang dijepit', () => {
    expect(tandaSisip(3, 99)).toEqual({ indeks: 2, sisi: 'kanan' });
    expect(tandaSisip(3, -5)).toEqual({ indeks: 0, sisi: 'kiri' });
  });
});
