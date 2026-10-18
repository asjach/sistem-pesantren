import { describe, expect, it } from 'vitest';
import { skalaLebarIsi } from './lebarIsi';

const kolom = (...lebar: number[]) =>
  lebar.map((w, i) => ({ key: `k${i + 1}`, lebar: w }));

describe('skalaLebarIsi — lebar tabel mengisi wadah', () => {
  it('membesarkan kolom dengan rasio wadah/tabel (contoh 800 vs 400)', () => {
    const hasil = skalaLebarIsi(kolom(50, 150, 200), 800, 0);
    expect(hasil?.rasio).toBe(2);
    expect(hasil?.lebar).toEqual({ k1: 100, k2: 300, k3: 400 });
  });

  it('menyusutkan kolom saat wadah lebih sempit (contoh 300 vs 400)', () => {
    // Rasio 3/4: 37,5 / 112,5 / 150 → 37 & 112 dibulatkan ke bawah, sisa 1 px
    // dibagikan ke kolom berfraksi terbesar (k3 = ,5 lebih dulu dari k1 = ,5
    // karena urutan stabil mempertahankan k1 di depan → k1 dapat 1 px).
    const hasil = skalaLebarIsi(kolom(50, 150, 200), 300, 0, 1);
    expect(hasil?.rasio).toBeCloseTo(0.75, 5);
    expect(hasil?.lebar).toEqual({ k1: 38, k2: 112, k3: 150 });
    expect(Object.values(hasil?.lebar ?? {}).reduce((a, b) => a + b, 0)).toBe(300);
  });

  it('mengurangi kolom tetap (gutter/centang/Aksi) dari ruang yang dibagi', () => {
    // 800 − (36 + 36 + 84) = 644 untuk kolom data 322 → rasio 2.
    const hasil = skalaLebarIsi(kolom(100, 222), 800, 36 + 36 + 84);
    expect(hasil?.rasio).toBe(2);
    expect(hasil?.lebar).toEqual({ k1: 200, k2: 444 });
  });

  it('jumlah lebar hasil selalu tepat selebar ruang (tanpa sisa pembulatan)', () => {
    const hasil = skalaLebarIsi(kolom(37, 91, 143, 57), 777, 72);
    const total = Object.values(hasil?.lebar ?? {}).reduce((a, b) => a + b, 0);
    expect(total).toBe(777 - 72);
  });

  it('tidak menyusutkan kolom di bawah lebar minimum', () => {
    const hasil = skalaLebarIsi(kolom(200, 200), 100, 0, 50);
    expect(hasil?.lebar).toEqual({ k1: 50, k2: 50 });
  });

  it('mengembalikan null bila penskalaan tak masuk akal', () => {
    expect(skalaLebarIsi([], 800, 0)).toBeNull();
    expect(skalaLebarIsi(kolom(100), 0, 0)).toBeNull();
    expect(skalaLebarIsi(kolom(100), 80, 80)).toBeNull();
    expect(skalaLebarIsi(kolom(0, 0), 800, 0)).toBeNull();
  });

  it('memakai lebar minimum bawaan (50 px) saat ruang nyaris habis', () => {
    const hasil = skalaLebarIsi(kolom(120), 10, 0);
    expect(hasil?.lebar.k1).toBe(50);
  });
});
