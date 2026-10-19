import { describe, expect, it } from 'vitest';

import { buatAntrePerBagian, selesaikanSimpan } from './antreSimpan';

describe('antre simpan per bagian', () => {
  it('dua bagian BERBEDA yang tumpang tindih sama-sama dibersihkan', () => {

    const a = buatAntrePerBagian();
    let sedang: readonly string[] = [];

    const nJudul = a.mulai('visibilitas');
    sedang = [...sedang, 'visibilitas'];
    const nKolom = a.mulai('kolom');
    sedang = [...sedang, 'kolom'];

    expect(nJudul).toBe(1);
    expect(nKolom).toBe(1);

    sedang = selesaikanSimpan(sedang, 'visibilitas', a.terakhir('visibilitas', nJudul));
    expect(sedang).toEqual(['kolom']);

    sedang = selesaikanSimpan(sedang, 'kolom', a.terakhir('kolom', nKolom));
    expect(sedang).toEqual([]);
  });

  it('hasil permintaan LAMA tak mematikan indikator permintaan BARU (bagian sama)', () => {

    const a = buatAntrePerBagian();
    const lama = a.mulai('kolom');
    const baru = a.mulai('kolom');

    expect(lama).toBe(1);
    expect(baru).toBe(2);

    let sedang: readonly string[] = ['kolom'];

    sedang = selesaikanSimpan(sedang, 'kolom', a.terakhir('kolom', lama));
    expect(sedang).toEqual(['kolom']);

    sedang = selesaikanSimpan(sedang, 'kolom', a.terakhir('kolom', baru));
    expect(sedang).toEqual([]);
  });

  it('mengembalikan daftar yang SAMA bila tak ada perubahan (hindari render sia-sia)', () => {
    const a = buatAntrePerBagian();
    const n = a.mulai('umum');
    const sedang: readonly string[] = ['umum'];

    expect(selesaikanSimpan(sedang, 'umum', false)).toBe(sedang);

    expect(selesaikanSimpan(['kolom'], 'umum', a.terakhir('umum', n))).toEqual(['kolom']);
  });

  it('bagian yang tak pernah mulai tidak dianggap terakhir', () => {
    const a = buatAntrePerBagian();
    expect(a.terakhir('belum-pernah', 1)).toBe(false);
    expect(selesaikanSimpan(['x'], 'x', a.terakhir('x', 1))).toEqual(['x']);
  });
});
