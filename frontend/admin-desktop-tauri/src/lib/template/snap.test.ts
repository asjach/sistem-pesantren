import { describe, expect, it } from 'vitest';

import { KISI_MM, TOLERANSI, dalamHalaman, garisMagnet, snapKisi, tempel, tepiKotak, kotakBertumpuk } from './snap';
import type { UkuranHalaman } from './tipe';

const A4: UkuranHalaman = { lebar_mm: 210, tinggi_mm: 297 };

describe('snap dan magnet kanvas template', () => {
  it('menghitung semua sisi dan titik tengah kotak', () => {
    const t = tepiKotak({ x: 10, y: 20, w: 100, h: 40 });
    expect(t).toMatchObject({ kiri: 10, kanan: 110, atas: 20, bawah: 60, tengahX: 60, tengahY: 40 });
  });

  it('menyediakan garis tepi dan tengah halaman', () => {
    const m = garisMagnet([A4], 1, []);
    expect(m.x).toContain(0);
    expect(m.x).toContain(105);
    expect(m.x).toContain(210);
    expect(m.y).toContain(148.5);
    expect(m.y).toContain(297);
  });

  it('memakai ukuran halaman yang diminta, bukan halaman pertama', () => {
    const m = garisMagnet([A4, { lebar_mm: 210, tinggi_mm: 330 }], 2, []);
    expect(m.y).toContain(330);
  });

  it('menempel ke tepi halaman bila dalam toleransi', () => {
    const magnet = garisMagnet([A4], 1, []);
    const hasil = tempel({ x: 0.8, y: 0.4, w: 50, h: 10 }, magnet);

    expect(hasil.kotak.x).toBe(0);
    expect(hasil.kotak.y).toBe(0);
    expect(hasil.garis.x).toContain(0);
    expect(hasil.garis.y).toContain(0);
  });

  it('tidak menempel ke tepi halaman yang jauh di luar toleransi', () => {
    const magnet = garisMagnet([A4], 1, []);
    const hasil = tempel({ x: 20.5, y: 20.3, w: 50, h: 10 }, magnet);

    expect(hasil.kotak.x).toBe(20.5);
    expect(hasil.kotak.y).toBe(20.3);
  });

  it('tidak bergerak bila jauh dari magnet', () => {
    const magnet = garisMagnet([A4], 1, []);
    const hasil = tempel({ x: 83, y: 137, w: 50, h: 10 }, magnet);

    expect(hasil.kotak.x).toBe(83);
    expect(hasil.kotak.y).toBe(137);
    expect(hasil.garis.x).toEqual([]);
    expect(hasil.garis.y).toEqual([]);
  });

  it('menempel ke tepi kotak lain yang miring sedikit', () => {
    const magnet = garisMagnet([A4], 1, [{ x: 30, y: 0, w: 60, h: 10 }]);
    // Tepi bawah kotak lain di y = 10; tepi atas kotak ini di y = 10.6.
    const hasil = tempel({ x: 30, y: 10.6, w: 60, h: 10 }, magnet);
    expect(hasil.kotak.y).toBe(10);
    expect(hasil.garis.y).toContain(10);
  });

  it('memilih magnet terdekat ketika beberapa garis magnet dalam jangkauan', () => {
    // Kotak lebar 100: tepi kiri 56, tengah 106, kanan 156. Tengah halaman 105
    // berjarak 1 mm, sedangkan tepi kiri 56 mm dan kanan 51 mm.
    const magnet = garisMagnet([A4], 1, []);
    const hasil = tempel({ x: 56, y: 50, w: 100, h: 10 }, magnet);
    expect(hasil.kotak.x).toBe(55);
  });

  it('menghormati toleransi yang diberikan', () => {
    const magnet = garisMagnet([A4], 1, []);
    const rapat = tempel({ x: 0.5, y: 0.5, w: 10, h: 5 }, magnet, 0.2);
    expect(rapat.kotak.x).toBe(0.5);

    const longgar = tempel({ x: 0.5, y: 0.5, w: 10, h: 5 }, magnet, 1);
    expect(longgar.kotak.x).toBe(0);
    expect(TOLERANSI).toBeGreaterThan(1);
  });

  it('membulatkan ke kisi hanya bila kisi aktif', () => {
    expect(snapKisi(12.3, true)).toBe(10);
    expect(snapKisi(12.3, false)).toBe(12.3);
    expect(KISI_MM).toBe(5);
  });

  it('menjaga kotak tetap di dalam halaman dan tetap positif', () => {
    const hasil = dalamHalaman({ x: -5, y: 400, w: 0, h: -3 }, A4);
    expect(hasil).toEqual({ x: 0, y: 297, w: 1, h: 1 });
  });

  it('membiarkan ukuran halaman yang belum diketahui', () => {
    const hasil = dalamHalaman({ x: -5, y: -5, w: 50, h: 20 }, { lebar_mm: 9999, tinggi_mm: 9999 });
    expect(hasil).toEqual({ x: 0, y: 0, w: 50, h: 20 });
  });

  it('mendeteksi kotak yang bertumpuk', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(kotakBertumpuk(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(kotakBertumpuk(a, { x: 20, y: 20, w: 5, h: 5 })).toBe(false);
    expect(kotakBertumpuk(a, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
  });
});
