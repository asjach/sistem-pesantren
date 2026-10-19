import { describe, expect, it } from 'vitest';

import { gabungLebarMaks, lebarDariBaris } from './autofit';

describe('gabungLebarMaks', () => {
  it('mengembalikan objek LAMA bila nilai sama (identitas stabil)', () => {
    const prev = { nama: 120, kode: 80 };
    const hasil = gabungLebarMaks(prev, { nama: 120, kode: 80 });
    expect(hasil).toBe(prev);
  });

  it('tidak pernah menyusut: halaman teks pendek tak mengecilkan kolom', () => {
    const prev = { nama: 200, kode: 80 };
    const hasil = gabungLebarMaks(prev, { nama: 110, kode: 80 });
    expect(hasil).toBe(prev);
    expect(hasil.nama).toBe(200);
  });

  it('membesar bila data segar lebih lebar (satu arah, lalu stabil)', () => {
    const prev = { nama: 120 };
    const tumbuh = gabungLebarMaks(prev, { nama: 180 });
    expect(tumbuh).not.toBe(prev);
    expect(tumbuh.nama).toBe(180);

    expect(gabungLebarMaks(tumbuh, { nama: 120 })).toBe(tumbuh);
    expect(gabungLebarMaks(tumbuh, { nama: 180 })).toBe(tumbuh);
  });

  it('kolom baru ikut serta; kunci lama yang hilang dipertahankan', () => {
    const prev = { nama: 120 };
    const hasil = gabungLebarMaks(prev, { nama: 100, baru: 90 });
    expect(hasil).toEqual({ nama: 120, baru: 90 });

    expect(gabungLebarMaks(hasil, {})).toBe(hasil);
  });
});

describe('lebarDariBaris', () => {
  /** Lebar linear terhadap panjang teks, supaya nilai yang diharapkan bisa
   *  ditulis tangan tanpa bergantung font asli. */
  const ukur = (teks: string, ukuranPx?: number): number => teks.length * (ukuranPx ?? 12);

  it('mengambil baris TERLEBAR, bukan menjumlahkan baris-barisnya', () => {

    const w = lebarDariBaris(
      [{ teks: 'Matematika', ukuran: 10 }, { teks: 'Siti Aminah', ukuran: 9 }],
      ukur,
    );
    expect(w).toBe(100);
  });

  it('bukan penjumlahan: dua baris 100px tetap 100px, bukan 200px', () => {
    expect(lebarDariBaris([{ teks: 'abcdefghij' }, { teks: 'klmnopqrst' }], ukur)).toBe(120);
  });

  it('ukuran huruf per baris diteruskan ke pengukur (huruf kecil = lebih sempit)', () => {
    const teks = [{ teks: 'Pendompaan', ukuran: 10 }, { teks: 'Pendompaan', ukuran: 9 }];

    expect(lebarDariBaris(teks, ukur)).toBe(100);
  });

  it('baris kosong diabaikan (tak diukur sebagai teks "")', () => {
    const calls: string[] = [];
    const catat = (t: string) => { calls.push(t); return t.length * 12; };
    lebarDariBaris([{ teks: '' }, { teks: 'Isi' }, { teks: '' }], catat);
    expect(calls).toEqual(['Isi']);
  });

  it('tanpa baris = 0 (bukan NaN/lebar.MIN yang mengacaukan pembanding)', () => {
    expect(lebarDariBaris([], ukur)).toBe(0);
  });
});
