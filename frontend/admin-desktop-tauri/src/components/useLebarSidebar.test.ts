import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { useLebarSidebar } from '@/components/useLebarSidebar';
import {
  SIDEBAR_LEBAR_DEFAULT,
  SIDEBAR_LEBAR_MAX,
  SIDEBAR_SNAP_HIDE,
} from '@/prefs';

/** Lepas mouse sebagai React MouseEvent pada gagang (clientX = posisi pointer). */
function seret(mulaiSeret: (e: React.MouseEvent<HTMLElement>) => void, clientX: number, button = 0) {
  act(() => {
    mulaiSeret({ button, clientX, preventDefault: () => {} } as unknown as React.MouseEvent<HTMLElement>);
  });
}
function geser(clientX: number) {
  act(() => { window.dispatchEvent(new MouseEvent('mousemove', { clientX })); });
}
function lepas() {
  act(() => { window.dispatchEvent(new MouseEvent('mouseup')); });
}

/** Harness stateful — lebarnya benar-benar berubah setelah setLebar, seperti di app. */
function setup(awal = SIDEBAR_LEBAR_DEFAULT) {
  const simpan: number[] = [];
  const lipat: boolean[] = [];
  const view = renderHook(() => {
    const [lebar, ubahLebar] = useState(awal);
    const [collapsed, ubahCollapsed] = useState(false);
    return {
      ...useLebarSidebar({
        lebar,
        setLebar: (px) => { simpan.push(px); ubahLebar(px); },
        setCollapsed: (v) => { lipat.push(v); ubahCollapsed(v); },
      }),
      lebar,
      collapsed,
    };
  });
  return { ...view, simpan, lipat };
}

describe('useLebarSidebar', () => {
  it('seret ke kanan menambah lebar dan menyimpannya saat dilepas', () => {
    const { result, simpan, lipat } = setup(240);

    seret(result.current.mulaiSeret, 240);
    geser(360);
    expect(result.current.lebarTampil(false)).toBe(360);

    lepas();
    expect(simpan).toEqual([360]);
    expect(lipat).toEqual([false]);
    expect(result.current.seret).toBe(false);
    expect(result.current.lebar).toBe(360);
  });

  it('seret ke kiri-mentok menyembunyikan navigasi dan menyimpan lebar lama', () => {
    const { result, simpan, lipat } = setup(240);

    seret(result.current.mulaiSeret, 240);
    geser(SIDEBAR_SNAP_HIDE - 10);
    expect(result.current.seretSembunyi).toBe(true);
    expect(result.current.lebarTampil(false)).toBe(0);

    lepas();
    expect(lipat).toEqual([true]);
    // Lebar tak diubah: dibuka lagi kembali ke lebar sebelumnya.
    expect(simpan).toEqual([]);
    expect(result.current.collapsed).toBe(true);
  });

  it('seret ke kanan dari keadaan sembunyi membuka kembali', () => {
    const { result, simpan, lipat } = setup(240);
    seret(result.current.mulaiSeret, 240);
    geser(20);
    lepas();
    expect(lipat).toEqual([true]);

    // Terbuka lagi lewat tombol; seretan berikutnya menyimpan lebar baru.
    act(() => { result.current.resetLebar(); });
    act(() => { simpan.length = 0; });
    seret(result.current.mulaiSeret, 240);
    geser(300);
    lepas();
    expect(simpan).toEqual([300]);
    expect(lipat).toEqual([true, false, false]);
  });

  it('lebar dijepit ke batas atas', () => {
    const { result } = setup(SIDEBAR_LEBAR_MAX);
    seret(result.current.mulaiSeret, SIDEBAR_LEBAR_MAX);
    geser(1400);
    expect(result.current.lebarTampil(false)).toBe(SIDEBAR_LEBAR_MAX);
  });

  it('seret diabaikan untuk tombol bukan utama', () => {
    const { result } = setup(240);
    seret(result.current.mulaiSeret, 240, 2);
    expect(result.current.seret).toBe(false);
  });

  it('keyboard: panah kanan/kiri menggeser, melewati MIN menyembunyikan', () => {
    const { result, simpan, lipat } = setup(240);
    const tekan = (key: string, shiftKey = false) => act(() => {
      result.current.onKeyDown({ key, shiftKey, preventDefault: () => {} } as unknown as React.KeyboardEvent<HTMLElement>);
    });

    tekan('ArrowRight');
    expect(result.current.lebar).toBe(256);
    tekan('ArrowLeft', true);
    expect(result.current.lebar).toBe(208);
    // 208 − 48 = 160 < MIN (180) → navigasi disembunyikan, lebar tak diubah.
    tekan('ArrowLeft', true);
    expect(lipat).toEqual([false, false, true]);
    expect(simpan).toEqual([256, 208]);
  });

  it('resetLebar mengembalikan lebar bawaan dan membuka navigasi', () => {
    const { result, simpan, lipat } = setup(300);
    act(() => { result.current.resetLebar(); });
    expect(simpan).toEqual([SIDEBAR_LEBAR_DEFAULT]);
    expect(lipat).toEqual([false]);
  });

  it('collapsed tanpa seretan → lebar tampil 0', () => {
    const { result } = setup(240);
    expect(result.current.lebarTampil(true)).toBe(0);
    expect(result.current.lebarTampil(false)).toBe(240);
  });
});