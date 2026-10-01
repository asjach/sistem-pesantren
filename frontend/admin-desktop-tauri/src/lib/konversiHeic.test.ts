import { describe, expect, it } from 'vitest';

import { butuhKonversiHeic, formatKonversi, magicHeic, magicWebp, namaJpg, siapkanFileUntukServer } from './konversiHeic';

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

describe('siapkanFileUntukServer', () => {
  it('non-HEIC dikembalikan apa adanya', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file = new File([bytes], 'foto.jpg', { type: 'image/jpeg' });
    // jsdom File tanpa arrayBuffer — tempel dari byte yang sama.
    (file as File & { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer = async () => bytes.buffer as ArrayBuffer;
    const hasil = await siapkanFileUntukServer(file);
    expect(hasil.dikonversi).toBe(false);
    expect(hasil.file).toBe(file);
  });
});

describe('deteksi WEBP', () => {
  const RIFF_WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  it('magic RIFF-WEBP walau bernama .jpg', () => {
    expect(magicWebp(RIFF_WEBP)).toBe(true);
    expect(formatKonversi('foto_031141.jpg', RIFF_WEBP)).toBe('webp');
  });
  it('ekstensi .webp', () => {
    expect(formatKonversi('a.webp', new Uint8Array(12))).toBe('webp');
  });
  it('bukan webp: pendek / RIFF lain', () => {
    expect(magicWebp(new Uint8Array(11))).toBe(false);
    expect(formatKonversi('a.jpg', new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x46]))).toBeNull();
  });
  it('dispatcher: heic vs webp vs langsung', () => {
    const heic = new Uint8Array([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
    expect(formatKonversi('a.heic', heic)).toBe('heic');
    expect(formatKonversi('a.jpg', new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBeNull();
  });
});
