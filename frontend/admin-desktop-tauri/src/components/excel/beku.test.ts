import { describe, expect, it } from 'vitest';

import { targetGulirBeku } from './beku';

describe('targetGulirBeku', () => {
  const batas = 500;

  it('tidak menggeser bila kolom sudah rata dengan tepi area beku', () => {
    expect(targetGulirBeku([500, 601], batas, 0, 1000)).toBe(0);
  });

  it('menyelaraskan ke kolom berikutnya bila gulir berhenti lebih dekat ke kolom itu', () => {

    expect(targetGulirBeku([440, 541], batas, 60, 1000)).toBe(101);
  });

  it('kembali ke kolom sebelumnya bila jaraknya lebih dekat', () => {

    expect(targetGulirBeku([470, 571], batas, 30, 1000)).toBe(0);
  });

  it('melewati patok yang tak bisa dicapai dan memilih kolom yang masih bisa diratakan', () => {

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
