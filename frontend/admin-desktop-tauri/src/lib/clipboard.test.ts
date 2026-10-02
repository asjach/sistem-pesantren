import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  pasangPenyalinPolosDesktop,
  teksKeHtmlPolos,
  tulisPolosSinkron,
} from './clipboard';

describe('teksKeHtmlPolos', () => {
  it('tanpa style/warna, escape tag, baris baru jadi <br/>', () => {
    const html = teksKeHtmlPolos('Halo <b>Dunia</b>\nbaris 2 & "kutip"');
    expect(html).not.toMatch(/style|color|white|#fff/i);
    expect(html).toContain('&lt;b&gt;Dunia&lt;/b&gt;');
    expect(html).toContain('<br/>');
    expect(html).toContain('&amp;');
  });
});

describe('tulisPolosSinkron', () => {
  it('menulis text/plain asli + text/html tanpa warna', () => {
    const simpan = new Map<string, string>();
    const e = {
      clipboardData: {
        setData: (tipe: string, nilai: string) => {
          simpan.set(tipe, nilai);
        },
      },
    } as unknown as ClipboardEvent;
    tulisPolosSinkron(e, 'Teks putih mode gelap');
    expect(simpan.get('text/plain')).toBe('Teks putih mode gelap');
    expect(simpan.get('text/html')).not.toMatch(/style|color|white|#fff/i);
  });
});

describe('pasangPenyalinPolosDesktop', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    window.getSelection()?.removeAllRanges();
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    vi.unstubAllGlobals();
  });

  it('mencegat copy: preventDefault + hanya teks polos tanpa style', () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    // copyText async (plugin tauri) tak perlu jalan di jsdom.
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => {}) } });

    const div = document.createElement('div');
    div.textContent = 'Contoh teks aplikasi';
    document.body.appendChild(div);
    const rentang = document.createRange();
    rentang.selectNodeContents(div);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(rentang);

    const simpan = new Map<string, string>();
    const e = new Event('copy', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(e, 'clipboardData', {
      value: {
        setData: (tipe: string, nilai: string) => {
          simpan.set(tipe, nilai);
        },
      },
    });

    const lepas = pasangPenyalinPolosDesktop();
    try {
      document.dispatchEvent(e);
    } finally {
      lepas();
    }

    expect(e.defaultPrevented).toBe(true);
    expect(simpan.get('text/plain')).toBe('Contoh teks aplikasi');
    expect(simpan.get('text/html')).not.toMatch(/style|color|white|#fff/i);
  });

  it('melewatkan area tabel .simpes-dsg (milik ExcelTable)', () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    const bungkus = document.createElement('div');
    bungkus.className = 'simpes-dsg';
    bungkus.textContent = 'Sel tabel';
    document.body.appendChild(bungkus);
    const rentang = document.createRange();
    rentang.selectNodeContents(bungkus);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(rentang);

    const e = new Event('copy', { bubbles: true, cancelable: true }) as ClipboardEvent;
    const lepas = pasangPenyalinPolosDesktop();
    try {
      document.dispatchEvent(e);
    } finally {
      lepas();
    }
    expect(e.defaultPrevented).toBe(false);
  });
});
