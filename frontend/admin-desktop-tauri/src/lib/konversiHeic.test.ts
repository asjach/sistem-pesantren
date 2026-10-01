import { describe, expect, it } from 'vitest';

import { butuhKonversiHeic, magicHeic, namaJpg } from './konversiHeic';

function ftyp(brand: string): Uint8Array {
  const b = new Uint8Array(12);
  b.set([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70], 0); // 'ftyp'
  for (let i = 0; i < 4; i += 1) b[8 + i] = brand.charCodeAt(i);
  return b;
}

describe('deteksi HEIC', () => {
  it('ekstensi heic/heif (apa pun kapitalnya)', () => {
    expect(butuhKonversiHeic('foto.HEIC', new Uint8Array(12))).toBe(true);
    expect(butuhKonversiHeic('foto.heif', new Uint8Array(12))).toBe(true);
  });

  it('magic ftyp-heic walau bernama .jpg', () => {
    expect(butuhKonversiHeic('foto_031141.jpg', ftyp('heic'))).toBe(true);
    expect(butuhKonversiHeic('x.jpg', ftyp('mif1'))).toBe(true);
  });

  it('bukan HEIC: jpeg, pdf, pendek, ftyp lain', () => {
    expect(magicHeic(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(false);
    expect(butuhKonversiHeic('a.jpg', new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(false);
    expect(butuhKonversiHeic('a.pdf', new TextEncoder().encode('%PDF-1.4....'))).toBe(false);
    expect(butuhKonversiHeic('a.jpg', new Uint8Array(5))).toBe(false);
    expect(butuhKonversiHeic('a.jpg', ftyp('isom'))).toBe(false);
  });

  it('namaJpg mengganti ekstensi', () => {
    expect(namaJpg('25.26.01.0062-X_Kartu Keluarga_030646.heic')).toBe('25.26.01.0062-X_Kartu Keluarga_030646.jpg');
    expect(namaJpg('tanpa-ekstensi')).toBe('tanpa-ekstensi.jpg');
  });
});
