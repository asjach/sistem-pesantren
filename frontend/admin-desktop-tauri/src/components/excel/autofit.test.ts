import { describe, expect, it } from 'vitest';

import { gabungLebarMaks } from './autofit';

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
    // Bolak-balik halaman pendek ↔ panjang: tetap 180, tanpa denyut.
    expect(gabungLebarMaks(tumbuh, { nama: 120 })).toBe(tumbuh);
    expect(gabungLebarMaks(tumbuh, { nama: 180 })).toBe(tumbuh);
  });

  it('kolom baru ikut serta; kunci lama yang hilang dipertahankan', () => {
    const prev = { nama: 120 };
    const hasil = gabungLebarMaks(prev, { nama: 100, baru: 90 });
    expect(hasil).toEqual({ nama: 120, baru: 90 });
    // Sampel kosong (filter tak cocok) tak meruntuhkan lebar.
    expect(gabungLebarMaks(hasil, {})).toBe(hasil);
  });
});
