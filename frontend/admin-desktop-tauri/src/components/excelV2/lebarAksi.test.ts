import { describe, expect, it } from 'vitest';

import { lebarKolomAksi } from './lebarAksi';

describe('lebarKolomAksi', () => {
  it('tanpa ikon hanya menyisakan padding', () => {
    expect(lebarKolomAksi(0)).toBe(8);
  });

  it('satu ikon = lebar tombol + padding', () => {
    expect(lebarKolomAksi(1)).toBe(32);
  });

  it('dua ikon menambah satu gap', () => {
    expect(lebarKolomAksi(2)).toBe(58);
  });

  it('tiga ikon umum (view, edit, delete)', () => {
    expect(lebarKolomAksi(3)).toBe(84);
  });

  it('nilai tidak masuk akal diperlakukan sebagai tanpa ikon', () => {
    expect(lebarKolomAksi(-2)).toBe(8);
    expect(lebarKolomAksi(Number.NaN)).toBe(8);
  });
});
