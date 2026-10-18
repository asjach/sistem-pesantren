import { describe, expect, it } from 'vitest';

import {
  AMBANG_PNG_LANGSUNG,
  GalatGambar,
  SISI_GAMBAR_MAKS,
  UKURAN_BERKAS_MAKS,
  gambarKeDataUrl,
  panjangDataUrl,
  sisiHasil,
  validasiBerkas,
} from './gambar';

/** Berkas gambar uji dengan tipe & ukuran tertentu (isi tak dibaca di sini). */
function berkas(nama: string, tipe: string, ukuran: number): File {
  return new File([new Uint8Array(ukuran)], nama, { type: tipe });
}

describe('validasiBerkas', () => {
  it('menerima gambar yang didukung', () => {
    expect(() => validasiBerkas(berkas('denah.png', 'image/png', 1024))).not.toThrow();
  });

  it('menolak berkas bukan gambar', () => {
    expect(() => validasiBerkas(berkas('data.pdf', 'application/pdf', 1024)))
      .toThrow(GalatGambar);
  });

  it('menolak berkas melebihi batas ukuran', () => {
    expect(() => validasiBerkas(berkas('besar.png', 'image/png', UKURAN_BERKAS_MAKS + 1)))
      .toThrow(/melebihi batas/i);
  });

  it('menolak lebih awal: gambarKeDataUrl tak pernah membaca berkas non-gambar', async () => {
    await expect(gambarKeDataUrl(berkas('data.txt', 'text/plain', 16)))
      .rejects.toBeInstanceOf(GalatGambar);
  });
});

describe('sisiHasil', () => {
  it('membiarkan gambar di bawah batas apa adanya', () => {
    expect(sisiHasil(800, 600)).toEqual({ w: 800, h: 600 });
  });

  it('memperkecil sisi terpanjang sambil menjaga rasio', () => {
    const r = sisiHasil(SISI_GAMBAR_MAKS * 2, SISI_GAMBAR_MAKS);

    expect(r).toEqual({ w: SISI_GAMBAR_MAKS, h: Math.round(SISI_GAMBAR_MAKS / 2) });
  });

  it('memperkecil berdasarkan tinggi bila gambar tegak', () => {
    const r = sisiHasil(100, SISI_GAMBAR_MAKS * 4);

    expect(r.h).toBe(SISI_GAMBAR_MAKS);
    expect(r.w).toBe(25);
  });

  it('dimensi tak sah menghasilkan 0 (pemanggil memakai berkas asli)', () => {
    expect(sisiHasil(0, 100)).toEqual({ w: 0, h: 0 });
  });
});

describe('ambang & panjang', () => {
  it('PNG kecil tak perlu dikompres ulang', () => {
    expect(AMBANG_PNG_LANGSUNG).toBeGreaterThan(0);
  });

  it('panjang data URL = panjang base64 + prefiks', () => {
    expect(panjangDataUrl('AAAA')).toBe(4 + 23);
  });
});
