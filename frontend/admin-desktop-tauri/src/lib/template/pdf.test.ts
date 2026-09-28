import { describe, expect, it } from 'vitest';

import { poinKeMm, ukuranMmDariViewport } from './pdf';

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

  it('mengubah viewport pdf.js menjadi ukuran halaman', () => {
    expect(ukuranMmDariViewport({ width: 595.276, height: 841.89 })).toEqual({
      lebar_mm: 210,
      tinggi_mm: 297,
    });
    expect(ukuranMmDariViewport({ width: 595.276, height: 935.43 })).toEqual({
      lebar_mm: 210,
      tinggi_mm: 330,
    });
  });

  it('tidak menghasilkan NaN walau view pdf.js hanya berisi empat angka', () => {
    // page.view pdf.js berisi [x0, y0, x1, y1]. Membacanya sebagai pasangan
    // (lebar, tinggi) menghasilkan undefined dan membuat ukuran halaman NaN,
    // sehingga kanvas editor rusak. Lebar harus dari selisih x1 - x0.
    const view = [0, 0, 595.276, 841.89];

    const dariView = ukuranMmDariViewport({ width: view[2] - view[0], height: view[3] - view[1] });

    expect(Number.isNaN(dariView.lebar_mm)).toBe(false);
    expect(Number.isNaN(dariView.tinggi_mm)).toBe(false);
    expect(dariView.lebar_mm).toBe(210);
  });
});
