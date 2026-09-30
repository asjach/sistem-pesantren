import { describe, expect, it } from 'vitest';
import { bingkaiPutar, dimsKeluaran, EDISI_KOSONG, edisiAktif, jepitMiring, jepitUkuran, kotakPutar, MAKS_MIRING, MAKS_UKURAN, naturalKeRectPutar, rectKeNaturalPutar } from './olahGambar';

// Matematika putar murni (tanpa canvas): sudut siku harus pas piksel,
// sudut miring mengikuti bounding box.
describe('kotakPutar', () => {
  it('sudut 0° mempertahankan dimensi', () => {
    expect(kotakPutar(0, 800, 600)).toEqual({ w: 800, h: 600 });
  });

  it('sudut 90°/270° menukar dimensi', () => {
    const a = kotakPutar(90, 800, 600);
    expect(Math.round(a.w)).toBe(600);
    expect(Math.round(a.h)).toBe(800);
    const b = kotakPutar(270, 800, 600);
    expect(Math.round(b.w)).toBe(600);
    expect(Math.round(b.h)).toBe(800);
  });

  it('sudut 180° mempertahankan dimensi', () => {
    const a = kotakPutar(180, 800, 600);
    expect(Math.round(a.w)).toBe(800);
    expect(Math.round(a.h)).toBe(600);
  });

  it('sudut 45° bujur sangkar melebar √2 kali', () => {
    const a = kotakPutar(45, 100, 100);
    expect(a.w).toBeCloseTo(100 * Math.SQRT2, 9);
    expect(a.h).toBeCloseTo(100 * Math.SQRT2, 9);
  });

  it('miring kecil hanya menambah sedikit', () => {
    const a = kotakPutar(2, 1000, 1400);
    expect(a.w).toBeGreaterThan(1000);
    expect(a.w).toBeLessThan(1060);
    expect(a.h).toBeGreaterThan(1400);
    expect(a.h).toBeLessThan(1440);
  });
});

describe('jepitMiring', () => {
  it('menjepit ke ±MAKS_MIRING dan menolak NaN', () => {
    expect(jepitMiring(200)).toBe(MAKS_MIRING);
    expect(jepitMiring(-200)).toBe(-MAKS_MIRING);
    expect(jepitMiring(2.5)).toBe(2.5);
    expect(jepitMiring(Number.NaN)).toBe(0);
  });
});

describe('petak putar 90° (pergi-pulang)', () => {
  it('pergi-pulang 0/90/180/270 tepat', () => {
    const natural = { w: 100, h: 200 };
    const crop = { x: 10, y: 20, w: 30, h: 40 };
    for (const rot of [0, 90, 180, 270] as const) {
      const tampil = rot === 0 || rot === 180
        ? { w: 100, h: 200 }
        : { w: 200, h: 100 };
      const rect = naturalKeRectPutar(crop, tampil.w, tampil.h, natural.w, natural.h, rot);
      const balik = rectKeNaturalPutar(rect, tampil.w, tampil.h, natural.w, natural.h, rot);
      expect(balik).toEqual(crop);
    }
  });

  it('nilai baku putar 90° searah jarum jam', () => {
    // Natural 100×200, crop kiri-atas 10,20 30×40 → tampil 200×100 di kanan-atas.
    const rect = naturalKeRectPutar({ x: 10, y: 20, w: 30, h: 40 }, 200, 100, 100, 200, 90);
    expect(rect).toEqual({ x: 140, y: 10, w: 40, h: 30 });
  });
});

describe('jepitUkuran', () => {
  it('menjepit ke 1..MAKS_UKURAN dan membulatkan', () => {
    expect(jepitUkuran(0)).toBe(1);
    expect(jepitUkuran(-5)).toBe(1);
    expect(jepitUkuran(800.6)).toBe(801);
    expect(jepitUkuran(99999)).toBe(MAKS_UKURAN);
    expect(jepitUkuran(Number.NaN)).toBe(1);
  });
});

describe('edisiAktif', () => {
  it('kosong nonaktif; tiap edisi mengaktifkan', () => {
    expect(edisiAktif(EDISI_KOSONG)).toBe(false);
    expect(edisiAktif({ ...EDISI_KOSONG, ukuran: { w: 800, h: 600 } })).toBe(true);
    expect(edisiAktif({ ...EDISI_KOSONG, miring: 2 })).toBe(true);
  });
});

describe('dimsKeluaran', () => {
  it('tanpa ukuran: ikut putaran (asli) atau hemat', () => {
    expect(dimsKeluaran({ ...EDISI_KOSONG, rotasi: 90 }, 'asli', 800, 600)).toEqual({ w: 600, h: 800 });
    const hemat = dimsKeluaran(EDISI_KOSONG, 'hemat', 4000, 3000);
    expect(Math.max(hemat.w, hemat.h)).toBeLessThanOrEqual(1600);
  });

  it('ukuran eksplisit menang atas hemat dan diputar', () => {
    const o = dimsKeluaran({ ...EDISI_KOSONG, ukuran: { w: 800, h: 600 } }, 'hemat', 4000, 3000);
    expect(o).toEqual({ w: 800, h: 600 });
    const p = dimsKeluaran({ ...EDISI_KOSONG, rotasi: 90, ukuran: { w: 800, h: 600 } }, 'asli', 4000, 3000);
    expect(p).toEqual({ w: 600, h: 800 });
  });
});

describe('bingkaiPutar', () => {
  it('siku tanpa miring: pas-piksel', () => {
    expect(bingkaiPutar(0, 0, 800, 600)).toEqual({ w: 800, h: 600 });
    expect(bingkaiPutar(90, 0, 800, 600)).toEqual({ w: 600, h: 800 });
  });

  it('miring: bingkai membesar mengikuti sudut, konten utuh', () => {
    const b = bingkaiPutar(0, 2, 800, 600);
    expect(b.w).toBeGreaterThan(800);
    expect(b.w).toBeLessThan(860);
    expect(b.h).toBeGreaterThan(600);
    expect(b.h).toBeLessThan(640);
  });

  it('miring di atas putar 90°: total gabungan', () => {
    const a = bingkaiPutar(90, 2, 800, 600);
    const b = kotakPutar(92, 800, 600);
    expect(a.w).toBeCloseTo(b.w, 9);
    expect(a.h).toBeCloseTo(b.h, 9);
  });
});
