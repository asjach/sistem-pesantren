import { afterEach, describe, expect, it, vi } from 'vitest';
import { bacaKonteks } from './anotasi';
import { bacaStyleElemen, teksStyleElemen } from './styleAnotasi';

afterEach(() => vi.restoreAllMocks());

describe('snapshot style anotasi', () => {
  it('membaca properti yang didukung dan mempertahankan nilai browser serta alpha', () => {
    const elemen = document.createElement('div');
    document.body.appendChild(elemen);
    const nilai: Record<string, string> = {
      'padding-left': ' 12px ', color: 'rgb(10, 20, 30)', 'background-color': 'rgba(0, 0, 0, 0)',
      'font-family': 'Aptos, sans-serif', 'grid-template-columns': '120px 240px', tidak_didukung: 'x',
    };
    const computed = vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: (properti: string) => nilai[properti] ?? '',
    } as CSSStyleDeclaration);
    expect(bacaStyleElemen(elemen)).toEqual({
      'padding-left': '12px', color: 'rgb(10, 20, 30)', 'background-color': 'rgba(0, 0, 0, 0)',
      'font-family': 'Aptos, sans-serif', 'grid-template-columns': '120px 240px',
    });
    expect(computed).toHaveBeenCalledWith(elemen);
  });

  it('tidak menebak nilai saat elemen terlepas atau API gagal', () => {
    const elemen = document.createElement('div');
    expect(bacaStyleElemen(elemen)).toBeUndefined();
    document.body.appendChild(elemen);
    vi.spyOn(window, 'getComputedStyle').mockImplementation(() => { throw new Error('Tidak tersedia'); });
    expect(bacaStyleElemen(elemen)).toBeUndefined();
  });

  it('menyertakan snapshot hanya bila diminta dan membacanya ulang saat diambil', () => {
    const elemen = document.createElement('button');
    document.body.appendChild(elemen);
    let warna = 'red';
    vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({ getPropertyValue: (properti: string) => properti === 'color' ? warna : '' }) as CSSStyleDeclaration);
    expect(bacaKonteks(elemen)).not.toHaveProperty('style');
    expect(bacaKonteks(elemen, true).style).toEqual({ color: 'red' });
    warna = 'blue';
    expect(bacaKonteks(elemen, true).style).toEqual({ color: 'blue' });
  });

  it('menyusun teks salinan dalam urutan tetap dan melewati nilai yang tidak tersedia', () => {
    expect(teksStyleElemen({ display: 'flex', 'padding-left': '8px', color: 'red', 'font-size': '' }))
      .toBe('padding-left: 8px;\ncolor: red;\ndisplay: flex;');
    expect(teksStyleElemen({})).toBe('');
  });
});
