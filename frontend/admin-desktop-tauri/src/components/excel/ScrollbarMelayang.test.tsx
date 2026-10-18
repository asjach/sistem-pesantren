import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import ScrollbarMelayang from './ScrollbarMelayang';

/** Kirim event mouse/pointer sungguhan lalu laporkan apakah default action
 *  dibatalkan (jsdom tak punya PointerEvent, jadi MouseEvent dipakai — React
 *  tetap memetakannya ke handler `onPointerDown`). */
function kirim(el: Element, tipe: string): boolean {
  const ev = new MouseEvent(tipe, { bubbles: true, cancelable: true, button: 0 });
  el.dispatchEvent(ev);
  return ev.defaultPrevented;
}

/**
 * Regresi bug: menyeret bilah gulir melayang dulu MEMULAI seleksi teks — di
 * WebKit (mesin Tauri) teks tabel ikut tersorot biru karena mousedown pada
 * jempol tidak dibatalkan. Komponen wajib membatalkan pointerdown & mousedown
 * pada jempol maupun rel.
 *
 * jsdom tak punya layout: scroller dipalsukan (scrollHeight/clientHeight) dan
 * hanya ditempel di objek ref — komponen cuma membacanya lewat `wadahRef`,
 * tidak perlu berada di dalam dokumen.
 */
function pasang() {
  const sc = document.createElement('div');
  sc.className = 'dsg-container';
  Object.defineProperty(sc, 'scrollHeight', { value: 1000, configurable: true });
  Object.defineProperty(sc, 'clientHeight', { value: 500, configurable: true });
  const wadah = document.createElement('div');
  wadah.appendChild(sc);

  render(<ScrollbarMelayang orientasi="vertikal" wadahRef={{ current: wadah }} />);
  const rel = screen.getByRole('scrollbar');
  const jempol = rel.querySelector('[role="presentation"]');
  return { rel, jempol };
}

describe('ScrollbarMelayang — seret tidak menyeleksi teks', () => {
  beforeEach(() => {
    // jsdom tak mengimplementasikan pointer capture.
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  });

  it('membatalkan pointerdown & mousedown pada jempol', () => {
    const { jempol } = pasang();
    expect(jempol).not.toBeNull();
    expect(kirim(jempol as Element, 'pointerdown')).toBe(true);
    expect(kirim(jempol as Element, 'mousedown')).toBe(true);
  });

  it('membatalkan pointerdown pada rel (klik lompat satu layar)', () => {
    const { rel } = pasang();
    expect(kirim(rel, 'pointerdown')).toBe(true);
  });
});
