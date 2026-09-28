import { describe, expect, it } from 'vitest';

import { bulatMm, bacaAngka, jepit, mmKePx, pxKeMm, teksMm, PX_PER_MM } from './satuan';

describe('satuan kanvas template', () => {
  it('menggunakan 1 mm = 96/25,4 px sesuai definisi CSS', () => {
    expect(PX_PER_MM).toBeCloseTo(3.7795, 4);
    expect(mmKePx(25.4)).toBeCloseTo(96, 6);
    expect(mmKePx(210)).toBeCloseTo(793.7, 1);
  });

  it('memakai zoom sebagai pengali', () => {
    expect(mmKePx(100, 2)).toBeCloseTo(mmKePx(100) * 2, 9);
    expect(mmKePx(10, 0.5)).toBeCloseTo(mmKePx(10) / 2, 9);
  });

  it('mengembalikan milimeter dari piksel tanpa membalik pembulatan', () => {
    for (const mm of [0, 1, 12.5, 210, 297]) {
      expect(pxKeMm(mmKePx(mm), 1)).toBeCloseTo(mm, 6);
      expect(pxKeMm(mmKePx(mm, 1.75), 1.75)).toBeCloseTo(mm, 6);
    }
  });

  it('tidak membagi dengan nol saat zoom nol', () => {
    expect(pxKeMm(100, 0)).toBe(0);
  });

  it('membulatkan milimeter agar galat pecahan tidak menumpuk', () => {
    expect(bulatMm(12.3456)).toBe(12.35);
    expect(bulatMm(12.3456, 1)).toBe(12.3);
    expect(bulatMm(12.4, 0)).toBe(12);
  });

  it('menjepit nilai ke rentang', () => {
    expect(jepit(5, 10, 20)).toBe(10);
    expect(jepit(25, 10, 20)).toBe(20);
    expect(jepit(15, 10, 20)).toBe(15);
  });

  it('menulis ukuran dengan koma desimal ala Indonesia', () => {
    expect(teksMm(12.5)).toBe('12,5 mm');
    expect(teksMm(210)).toBe('210,0 mm');
  });

  it('membaca angka dari input yang memakai koma', () => {
    expect(bacaAngka('12,5')).toBe(12.5);
    expect(bacaAngka(' 20 ')).toBe(20);
    expect(bacaAngka('abc', 7)).toBe(7);
    expect(bacaAngka('')).toBe(0);
  });
});
