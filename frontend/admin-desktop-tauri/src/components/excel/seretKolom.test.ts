import { describe, expect, it } from 'vitest';

import { indeksSisip, pindahKolom, tandaSisip } from './seretKolom';

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
