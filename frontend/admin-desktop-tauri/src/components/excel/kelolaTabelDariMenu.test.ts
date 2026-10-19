import { describe, expect, it, vi } from 'vitest';

import {
  TENGGANG_BUKA_DARI_MENU_MS,
  buatTenggangMenu,
  bukaDariMenu,
  tenggangMenu,
} from './kelolaTabelDariMenu';

/**
 * Uji penjaga "baru dibuka dari menu klik kanan".
 *
 * Catatan penting: perilaku dismiss Radix (pointerdown + setTimeout(0)) TIDAK
 * bisa ditiru jsdom, jadi uji ini hanya menjaga KONTRAK penandanya.
 * Pembuktian perilaku sebenarnya dilakukan lewat browser nyata (Playwright)
 * — lihat catatan di modul ini.
 */
describe('tenggang menu Kelola Tabel', () => {
  it('belum bertenggang sebelum ditandai', () => {
    const t = buatTenggangMenu();
    expect(t.lagiTenggang()).toBe(false);
  });

  it('bertenggang tepat setelah ditandai', () => {
    const t = buatTenggangMenu();
    t.tandai();
    expect(t.lagiTenggang()).toBe(true);
  });

  it('berhenti bertenggang setelah jendela lewat', () => {
    const t = buatTenggangMenu();
    t.tandai(50);
    const asli = Date.now;
    try {
      Date.now = () => asli() + 1000;
      expect(t.lagiTenggang()).toBe(false);
    } finally {
      Date.now = asli;
    }
  });

  it('jendela tenggang menutupi fokus sisa gestur menu, tapi tetap singkat', () => {

    expect(TENGGANG_BUKA_DARI_MENU_MS).toBeGreaterThanOrEqual(700);
    expect(TENGGANG_BUKA_DARI_MENU_MS).toBeLessThanOrEqual(1500);
  });

  it('bukaDariMenu menandai tenggang LEBIH DULU, baru membuka panel', () => {
    const urutan: string[] = [];
    const tandaiAsli = tenggangMenu.tandai;
    try {
      tenggangMenu.tandai = () => { urutan.push('tandai'); };
      bukaDariMenu(() => { urutan.push('buka'); });
    } finally {
      tenggangMenu.tandai = tandaiAsli;
    }

    expect(urutan).toEqual(['tandai', 'buka']);
  });

  it('bukaDariMenu meneruskan pemanggilan pembuka', () => {
    const buka = vi.fn();
    bukaDariMenu(buka);
    expect(buka).toHaveBeenCalledTimes(1);
  });
});
