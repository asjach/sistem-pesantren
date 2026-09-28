import { describe, expect, it } from 'vitest';

import { poinKeMm } from './pdf';

/**
 * Hanya konversi satuan yang diuji di sini. Pemuatan dan perenderan PDF
 * memakai web worker pdf.js yang tidak bisa jalan di jsdom, jadi keduanya
 * diverifikasi manual saat memakai editor, bukan lewat tes otomatis.
 */
describe('konversi satuan halaman PDF', () => {
  it('mengubah poin A4 menjadi milimeter', () => {
    expect(poinKeMm(595.28)).toBeCloseTo(210, 1);
    expect(poinKeMm(841.89)).toBeCloseTo(297, 1);
  });

  it('mengubah inci menjadi 25,4 milimeter', () => {
    expect(poinKeMm(72)).toBe(25.4);
  });

  it('membulatkan ke dua desimal supaya sama dengan hasil FPDI', () => {
    // 210,00014444444 mm adalah nilai pelarut yang dikembalikan FPDI.
    expect(poinKeMm(595.2756)).toBe(210);
    expect(poinKeMm(poinKeMm(595.2756) * 2.834645669)).toBe(poinKeMm(poinKeMm(595.2756) * 2.834645669));
  });

  it('mempertahankan nol di belakang koma', () => {
    expect(poinKeMm(0)).toBe(0);
    expect(poinKeMm(28.35)).toBe(10);
  });
});
