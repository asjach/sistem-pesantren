import { describe, expect, it } from 'vitest';

import {
  beririsan,
  blokDariSeleksi,
  geserBlok,
  jepitBlok,
  kolomData,
  samaBlok,
  terapkanSeret,
  ukuranBlok,
  type BlokIsi,
} from './seretIsiSel';

/** Kunci kolom grid: centang + 3 kolom data + Aksi (seperti ExcelTable). */
const K = ['check', 'nama', 'umur', 'kota', '__aksi'];

describe('kolomData', () => {
  it('melewati kolom centang & Aksi', () => {
    expect(kolomData(K, 0, 4)).toEqual([1, 2, 3]);
  });

  it('menerima rentang terbalik', () => {
    expect(kolomData(K, 3, 1)).toEqual([1, 2, 3]);
  });

  it('hanya kolom centang → kosong', () => {
    expect(kolomData(K, 0, 0)).toEqual([]);
    expect(kolomData(K, 4, 4)).toEqual([]);
  });

  it('indeks di luar daftar dijepit', () => {
    expect(kolomData(K, -3, 99)).toEqual([1, 2, 3]);
  });
});

describe('blokDariSeleksi', () => {
  it('tak ada seleksi → null', () => {
    expect(blokDariSeleksi(null, K, 5)).toBeNull();
  });

  it('tabel kosong → null', () => {
    expect(blokDariSeleksi({ min: { row: 0, col: 1 }, max: { row: 0, col: 1 } }, K, 0)).toBeNull();
  });

  it('menormalkan min/max jadi urut', () => {
    const b = blokDariSeleksi({ min: { row: 2, col: 3 }, max: { row: 0, col: 1 } }, K, 5);
    expect(b).toEqual({ r0: 0, r1: 2, kolom: [1, 2, 3] });
  });

  it('baris di luar tabel dijepit', () => {
    const b = blokDariSeleksi({ min: { row: 3, col: 1 }, max: { row: 99, col: 1 } }, K, 4);
    expect(b).toEqual({ r0: 3, r1: 3, kolom: [1] });
  });

  it('seleksi hanya kolom non-data → null', () => {
    expect(blokDariSeleksi({ min: { row: 0, col: 0 }, max: { row: 0, col: 0 } }, K, 5)).toBeNull();
  });
});

describe('geserBlok — jarak dihitung dari sel yang DIGENGAM, bukan pojok blok', () => {
  const sumber: BlokIsi = { r0: 1, r1: 2, kolom: [1, 2] };
  /** Kursor memegang sel kolom pertama blok (baris 1). */
  const pegang = { row: 1, kolom: 1 };

  it('kursor tetap di kolom yang sama → blok tak bergeser ke samping', () => {
    expect(geserBlok(sumber, pegang, { row: 1, kolom: 1 })).toEqual(sumber);
    expect(geserBlok(sumber, pegang, { row: 4, kolom: 1 })).toEqual({ r0: 4, r1: 5, kolom: [1, 2] });
  });

  it('SERET KE KOLOM LAIN: jangkar di luar blok tetap menggeser mendatar', () => {
    // Inilah kasus yang rusak: jangkar kolom 3 tak ada di dalam blok, tapi
    // blok HARUS ikut bergeser 2 kolom ke kanan.
    expect(geserBlok(sumber, pegang, { row: 1, kolom: 3 })).toEqual({ r0: 1, r1: 2, kolom: [3, 4] });
    expect(geserBlok(sumber, pegang, { row: 3, kolom: 4 })).toEqual({ r0: 3, r1: 4, kolom: [4, 5] });
  });

  it('menahan kolom kedua blok: mendarat di kolom kedua lain, bukan kolom pertama', () => {
    expect(geserBlok(sumber, { row: 1, kolom: 2 }, { row: 3, kolom: 2 }))
      .toEqual({ r0: 3, r1: 4, kolom: [1, 2] });
    expect(geserBlok(sumber, { row: 1, kolom: 2 }, { row: 3, kolom: 3 }))
      .toEqual({ r0: 3, r1: 4, kolom: [2, 3] });
  });

  it('menahan baris kedua blok: mendarat di baris kedua lain, bukan baris pertama', () => {
    expect(geserBlok(sumber, { row: 2, kolom: 1 }, { row: 5, kolom: 1 }))
      .toEqual({ r0: 4, r1: 5, kolom: [1, 2] });
  });
});

describe('jepitBlok', () => {
  it('memotong kolom centang/Aksi di tepi', () => {
    expect(jepitBlok({ r0: 0, r1: 0, kolom: [0, 1, 2] }, K, 3))
      .toEqual({ r0: 0, r1: 0, kolom: [1, 2] });
  });

  it('baris di luar tabel dijepit ke baris terakhir', () => {
    expect(jepitBlok({ r0: 5, r1: 9, kolom: [1] }, K, 3))
      .toEqual({ r0: 2, r1: 2, kolom: [1] });
  });

  it('tanpa kolom data atau tanpa baris → null', () => {
    expect(jepitBlok({ r0: 0, r1: 0, kolom: [0] }, K, 3)).toBeNull();
    expect(jepitBlok({ r0: 0, r1: 0, kolom: [1] }, K, 0)).toBeNull();
  });
});

describe('samaBlok & beririsan', () => {
  const a: BlokIsi = { r0: 0, r1: 1, kolom: [1, 2] };

  it('samaBlok mencocokkan isi sel, bukan identitas objek', () => {
    expect(samaBlok(a, { r0: 0, r1: 1, kolom: [1, 2] })).toBe(true);
    expect(samaBlok(a, { r0: 0, r1: 0, kolom: [1, 2] })).toBe(false);
    expect(samaBlok(a, { r0: 0, r1: 1, kolom: [1, 3] })).toBe(false);
  });

  it('beririsan: blok bersebelahan tak beririsan', () => {
    // Baris bersebelahan, kolom sama.
    expect(beririsan(a, { r0: 2, r1: 3, kolom: [1, 2] })).toBe(false);
    // Baris sama, kolom bersebelahan.
    expect(beririsan(a, { r0: 0, r1: 1, kolom: [3] })).toBe(false);
    // Baris tumpang tindih TAPI kolomnya tak: tetap tak beririsan.
    expect(beririsan(a, { r0: 1, r1: 4, kolom: [3] })).toBe(false);
    // Baris tumpang tindih + kolom tumpang tindih.
    expect(beririsan(a, { r0: 1, r1: 4, kolom: [2] })).toBe(true);
    expect(beririsan(a, { r0: 0, r1: 1, kolom: [1] })).toBe(true);
  });

  it('ukuranBlok = baris x kolom', () => {
    expect(ukuranBlok(a)).toBe(4);
  });
});

describe('terapkanSeret', () => {
  const grid = [
    { id: 1, nama: 'A', umur: '10', kota: 'S' },
    { id: 2, nama: 'B', umur: '20', kota: 'J' },
    { id: 3, nama: 'C', umur: '30', kota: 'K' },
  ];
  const sumber: BlokIsi = { r0: 0, r1: 0, kolom: [1] };

  it('salin: sel tujuan terisi, sel asal tetap utuh', () => {
    const hasil = terapkanSeret(grid, sumber, { r0: 2, r1: 2, kolom: [1] }, K, 'salin');
    expect(hasil[2].nama).toBe('A');
    expect(hasil[0].nama).toBe('A');
  });

  it('pindah: sel tujuan terisi, sel asal dikosongkan', () => {
    const hasil = terapkanSeret(grid, sumber, { r0: 2, r1: 2, kolom: [1] }, K, 'pindah');
    expect(hasil[2].nama).toBe('A');
    expect(hasil[0].nama).toBeNull();
  });

  it('tidak mengubah array asal', () => {
    terapkanSeret(grid, sumber, { r0: 1, r1: 1, kolom: [1] }, K, 'pindah');
    expect(grid[0].nama).toBe('A');
    expect(grid[1].nama).toBe('B');
  });

  it('menyalin blok 2x2 apa adanya (pola, bukan per-selis)', () => {
    const hasil = terapkanSeret(
      grid,
      { r0: 0, r1: 1, kolom: [1, 2] },
      { r0: 2, r1: 3, kolom: [1, 2] },
      K,
      'salin',
    );
    // Baris 3 tak ada → ditulis null, bukan melempar.
    expect(hasil[2].nama).toBe('A');
    expect(hasil[2].umur).toBe('10');
    expect(hasil[3]?.nama ?? null).toBeNull();
  });

  it('pindah dari blok lebih besar ke blok lebih kecil memakai kolom kiri atas', () => {
    const hasil = terapkanSeret(
      grid,
      { r0: 0, r1: 1, kolom: [1, 2] },
      { r0: 2, r1: 2, kolom: [1] },
      K,
      'pindah',
    );
    expect(hasil[2].nama).toBe('A');
    expect(hasil[0].nama).toBeNull();
    expect(hasil[0].umur).toBeNull();
    expect(hasil[1].nama).toBeNull();
  });

  it('mode pindah menyalin nilai SEBELUM mengosongkan (blok beririsan)', () => {
    // Tanpa perekaman awal, mengosongkan sumber akan menimpa target dengan null.
    const hasil = terapkanSeret(
      grid,
      { r0: 0, r1: 0, kolom: [1] },
      { r0: 0, r1: 0, kolom: [1] },
      K,
      'pindah',
    );
    expect(hasil[0].nama).toBe('A');
  });

  it('sel kosong sumber menjadi null di tujuan', () => {
    const kosong = [
      { id: 1, nama: 'A', umur: '10', kota: 'S' },
      { id: 2, nama: null, umur: null, kota: null },
    ];
    const hasil = terapkanSeret(kosong, { r0: 1, r1: 1, kolom: [1] }, { r0: 0, r1: 0, kolom: [1] }, K, 'salin');
    expect(hasil[0].nama).toBeNull();
  });

  it('kolom di luar daftar dilewati', () => {
    const hasil = terapkanSeret(grid, sumber, { r0: 1, r1: 1, kolom: [9] }, K, 'salin');
    expect(hasil[1].nama).toBe('B');
  });
});