import { afterEach, describe, expect, it, vi } from 'vitest';
import { PengelolaPreviewStyle } from './previewStyle';
import type { PropertiStyle } from './anotasiData';

afterEach(() => vi.restoreAllMocks());

function elemen(style?: string) {
  const hasil = document.createElement('div');
  if (style !== undefined) hasil.setAttribute('style', style);
  document.body.appendChild(hasil);
  return hasil;
}

describe('PengelolaPreviewStyle', () => {
  it('menerapkan beberapa properti dan menyimpan computed style sebelum serta sesudah', () => {
    const target = elemen('color: red; padding-left: 4px;');
    const preview = new PengelolaPreviewStyle();
    preview.terapkan(target, 'color', 'blue');
    preview.terapkan(target, 'padding-left', '12px');
    expect(target.style.getPropertyPriority('color')).toBe('important');
    expect(preview.snapshot(target)).toMatchObject({
      sebelum: { color: 'rgb(255, 0, 0)', 'padding-left': '4px' },
      sesudah: { color: 'rgb(0, 0, 255)', 'padding-left': '12px' },
      perubahan: { color: 'blue', 'padding-left': '12px' },
    });
  });

  it('Reset mengembalikan atribut asli termasuk shorthand dan priority', () => {
    const asli = 'padding: 2px 4px !important; color: red !important;';
    const target = elemen(asli);
    const preview = new PengelolaPreviewStyle();
    preview.terapkan(target, 'padding-left', '12px');
    preview.terapkan(target, 'color', 'blue');
    preview.terapkan(target, 'color', 'green');
    preview.reset(target);
    expect(target.getAttribute('style')).toBe(asli);
    expect(preview.snapshot(target)).toBeUndefined();
    preview.reset(target);
    expect(target.getAttribute('style')).toBe(asli);
  });

  it.each([undefined, ''])('memulihkan kondisi atribut style semula: %j', (asli) => {
    const target = elemen(asli);
    const preview = new PengelolaPreviewStyle();
    preview.terapkan(target, 'color', 'blue');
    preview.reset(target);
    expect(target.getAttribute('style')).toBe(asli ?? null);
  });

  it.each([
    ['color', 'bukan_warna'], ['padding-left', '-3px'], ['color', ''],
    ['display', 'none'], ['color', 'x'.repeat(257)],
  ])('menolak properti/nilai tidak valid tanpa mutasi: %s %s', (properti, nilai) => {
    const target = elemen('color: red;');
    const asli = target.getAttribute('style');
    const preview = new PengelolaPreviewStyle();
    expect(() => preview.terapkan(target, properti as PropertiStyle, nilai)).toThrow();
    expect(target.getAttribute('style')).toBe(asli);
    expect(preview.snapshot(target)).toBeUndefined();
  });

  it('nilai gagal berikutnya tidak merusak preview yang sedang aktif', () => {
    const target = elemen('color: red;');
    const preview = new PengelolaPreviewStyle();
    preview.terapkan(target, 'color', 'blue');
    expect(() => preview.terapkan(target, 'color', 'bukan_warna')).toThrow();
    expect(target.style.color).toBe('blue');
    expect(preview.snapshot(target)?.perubahan).toEqual({ color: 'blue' });
  });

  it('mempertahankan perubahan runtime lain bahkan setelah preview diterapkan lagi', () => {
    const target = elemen('color: red;');
    const preview = new PengelolaPreviewStyle();
    preview.terapkan(target, 'color', 'blue');
    target.style.marginTop = '19px';
    preview.terapkan(target, 'color', 'green');
    preview.reset(target);
    expect(target.style.color).toBe('red');
    expect(target.style.marginTop).toBe('19px');
  });

  it('tidak menimpa properti preview yang sudah diganti runtime lain', () => {
    const target = elemen('color: red;');
    const preview = new PengelolaPreviewStyle();
    preview.terapkan(target, 'color', 'blue');
    target.style.setProperty('color', 'green', 'important');
    preview.reset(target);
    expect(target.style.color).toBe('green');
  });

  it('mengelola kedua elemen secara mandiri dan memulihkan elemen yang sudah terlepas', () => {
    const asal = elemen('color: red;');
    const tujuan = elemen('color: green;');
    const preview = new PengelolaPreviewStyle();
    preview.terapkan(asal, 'color', 'blue');
    preview.terapkan(tujuan, 'color', 'yellow');
    preview.reset(asal);
    expect(asal.style.color).toBe('red');
    expect(tujuan.style.color).toBe('yellow');
    tujuan.remove();
    preview.resetSemua();
    expect(tujuan.style.color).toBe('green');
  });

  it('menolak elemen terlepas dan kegagalan membaca style awal', () => {
    const target = elemen();
    target.remove();
    const preview = new PengelolaPreviewStyle();
    expect(() => preview.terapkan(target, 'color', 'blue')).toThrow('tidak tersedia');
    document.body.appendChild(target);
    vi.spyOn(window, 'getComputedStyle').mockImplementation(() => { throw new Error('gagal'); });
    expect(() => preview.terapkan(target, 'color', 'blue')).toThrow('tidak dapat dibaca');
    expect(target.getAttribute('style')).toBeNull();
  });
});
