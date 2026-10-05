import { describe, expect, it } from 'vitest';

import {
  hitungBarisTeks,
  hitungTinggiBaris,
  MAX_BARIS_H,
  MIN_BARIS_H,
  PAD_X_SEL,
  PAD_Y_SEL,
} from './tinggiBaris';

describe('hitungBarisTeks', () => {
  it('selalu minimal satu baris untuk teks kosong atau lebar nol', () => {
    expect(hitungBarisTeks(0, 100)).toBe(1);
    expect(hitungBarisTeks(100, 0)).toBe(1);
  });

  it('tetap satu baris bila teks muat (toleransi tepi)', () => {
    expect(hitungBarisTeks(99, 100)).toBe(1);
    expect(hitungBarisTeks(100, 100)).toBe(1);
  });

  it('membulatkan ke atas saat teks melebihi lebar tersedia', () => {
    expect(hitungBarisTeks(150, 100)).toBe(2);
    expect(hitungBarisTeks(210, 100)).toBe(3);
    expect(hitungBarisTeks(250, 100)).toBe(3);
  });
});

describe('hitungTinggiBaris', () => {
  const dasar = { fontPx: 11, minH: 24 };

  it('memakai tinggi minimum bila teks pendek', () => {
    const tinggi = hitungTinggiBaris({ ...dasar, lebarTeks: [40], lebarKolom: [200] });
    expect(tinggi).toBe(dasar.minH);
  });

  it('membesar mengikuti jumlah baris hasil pembungkusan', () => {
    const satuBaris = hitungTinggiBaris({ ...dasar, lebarTeks: [50], lebarKolom: [200] });
    const duaBaris = hitungTinggiBaris({ ...dasar, lebarTeks: [300], lebarKolom: [200 + PAD_X_SEL] });
    const tinggiTeks = Math.round(dasar.fontPx * 1.35);
    expect(duaBaris).toBe(2 * tinggiTeks + PAD_Y_SEL);
    expect(duaBaris).toBeGreaterThan(satuBaris);
  });

  it('mengambil baris tertinggi di antara semua kolom', () => {
    const tinggi = hitungTinggiBaris({
      ...dasar,
      lebarTeks: [10, 10, 900],
      lebarKolom: [200, 200, 200 + PAD_X_SEL],
    });
    const tinggiTeks = Math.round(dasar.fontPx * 1.35);
    expect(tinggi).toBe(5 * tinggiTeks + PAD_Y_SEL);
  });

  it('dibatasi plafon agar teks panjang tidak memakan tabel', () => {
    const tinggi = hitungTinggiBaris({ ...dasar, lebarTeks: [100000], lebarKolom: [200] });
    expect(tinggi).toBe(MAX_BARIS_H);
  });

  it('menghormati tinggi minimum yang lebih besar dari kebutuhan isi', () => {
    const tinggi = hitungTinggiBaris({ ...dasar, minH: 60, lebarTeks: [10], lebarKolom: [400] });
    expect(tinggi).toBe(60);
  });

  it('tidak pernah lebih kecil dari lantai maupun kebutuhan isi satu baris', () => {
    const tinggi = hitungTinggiBaris({ ...dasar, minH: MIN_BARIS_H, lebarTeks: [1], lebarKolom: [1000] });
    const tinggiTeks = Math.round(dasar.fontPx * 1.35);
    expect(tinggi).toBeGreaterThanOrEqual(MIN_BARIS_H);
    expect(tinggi).toBe(tinggiTeks + PAD_Y_SEL);
  });

  it('kolom tanpa teks tidak ikut menambah tinggi', () => {
    const tinggi = hitungTinggiBaris({ ...dasar, lebarTeks: [], lebarKolom: [] });
    expect(tinggi).toBe(dasar.minH);
  });
});
