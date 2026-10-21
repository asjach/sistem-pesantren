import { describe, expect, it } from 'vitest';
import { batasAtasRentang, nilaiDalamRentang } from './nilaiRentang';

describe('rentang nilai', () => {
  it('memetakan batas atas tiap pilihan', () => {
    expect(batasAtasRentang('0-100')).toBe(100);
    expect(batasAtasRentang('0-10')).toBe(10);
    expect(batasAtasRentang('0-4')).toBe(4);
  });

  it('menolak nilai di luar rentang', () => {
    expect(nilaiDalamRentang(10, '0-10')).toBe(true);
    expect(nilaiDalamRentang(10.5, '0-10')).toBe(false);
    expect(nilaiDalamRentang(4, '0-4')).toBe(true);
    expect(nilaiDalamRentang(4.5, '0-4')).toBe(false);
    expect(nilaiDalamRentang(-0.5, '0-100')).toBe(false);
  });
});
