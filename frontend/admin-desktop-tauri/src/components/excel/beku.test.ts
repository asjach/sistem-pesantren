import { describe, expect, it } from 'vitest';

import { targetGulirBeku } from './beku';

describe('targetGulirBeku', () => {
  const batas = 500;

  it('tidak menggeser bila kolom sudah rata dengan tepi area beku', () => {
    expect(targetGulirBeku([500, 601], batas, 0, 1000)).toBe(0);
  });

  it('menyelaraskan ke kolom berikutnya bila gulir berhenti lebih dekat ke kolom itu', () => {
    // Kolom di 440 (terpotong 60px) dan 541: jarak ke ratanya 60 vs 41.
    expect(targetGulirBeku([440, 541], batas, 60, 1000)).toBe(101);
  });

  it('kembali ke kolom sebelumnya bila jaraknya lebih dekat', () => {
    // Kolom di 470 (terpotong 30px) dan 571: jarak 30 vs 71.
    expect(targetGulirBeku([470, 571], batas, 30, 1000)).toBe(0);
  });

  it('melewati patok yang tak bisa dicapai dan memilih kolom yang masih bisa diratakan', () => {
    // Di gulir maksimum (129), kolom di 1167 butuh gulir 174 (mustahil);
    // kolom di 1094 butuh gulir 101 — itulah yang dipakai.
    expect(targetGulirBeku([1094, 1167], 1122, 129, 129)).toBe(101);
  });

  it('mengembalikan null bila semua patok berada di luar rentang gulir', () => {
    expect(targetGulirBeku([480], batas, 10, 1000)).toBeNull();
    expect(targetGulirBeku([2000], batas, 900, 1000)).toBeNull();
  });

  it('mengembalikan null bila tidak ada kolom terukur', () => {
    expect(targetGulirBeku([], batas, 0, 1000)).toBeNull();
  });
});
