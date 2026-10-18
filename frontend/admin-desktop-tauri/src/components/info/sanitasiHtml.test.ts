import { describe, expect, it } from 'vitest';

import { htmlAdaIsi, sanitasiHtml } from './sanitasiHtml';

/**
 * Sanitizer klien = lapisan kedua setelah `App\Support\HtmlInfo` di backend.
 * Yang diuji adalah vektor yang, kalau lolos, berarti skrip berjalan di sesi
 * SETIAP pengguna yang membuka tabel — bukan kerapian markup.
 */
describe('sanitasiHtml — vektor berbahaya', () => {
  it('membuang script beserta isinya', () => {
    const hasil = sanitasiHtml('<p>halo</p><script>alert(1)</script>');

    expect(hasil).toBe('<p>halo</p>');
  });

  it('membuang atribut peristiwa dan style/class', () => {
    const hasil = sanitasiHtml(
      '<img src="https://x.test/a.png" onerror="alert(1)" class="x" style="position:fixed">',
    );

    expect(hasil).not.toContain('onerror');
    expect(hasil).not.toContain('class=');
    expect(hasil).not.toContain('style=');
    expect(hasil).toContain('src="https://x.test/a.png"');
  });

  it('menolak href javascript/data/vbscript termasuk varian huruf besar & spasi', () => {
    for (const html of [
      '<a href="javascript:alert(1)">x</a>',
      '<a href="JaVaScRiPt:alert(1)">x</a>',
      '<a href="  javascript:alert(1)">x</a>',
      '<a href="data:text/html,<script>alert(1)</script>">x</a>',
      '<a href="vbscript:msgbox(1)">x</a>',
    ]) {
      expect(sanitasiHtml(html)).not.toContain('href');
    }
  });

  it('menolak svg dan data URI yang bukan base64', () => {
    expect(sanitasiHtml('<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=">'))
      .not.toContain('src');
    expect(sanitasiHtml('<img src="data:image/png,<svg onload=alert(1)>">'))
      .not.toContain('src');
  });

  it('membuang iframe/form/svg beserta seluruh isinya', () => {
    for (const html of [
      '<iframe src="https://evil.test"></iframe>',
      '<form action="/hapus"><input name="a"></form>',
      '<svg onload="alert(1)"></svg>',
    ]) {
      expect(sanitasiHtml(html)).toBe('');
    }
  });
});

describe('sanitasiHtml — yang diizinkan', () => {
  it('mempertahankan format dasar dan daftar', () => {
    const hasil = sanitasiHtml(
      '<h2>Judul</h2><p><strong>Tebal</strong> <em>miring</em></p><ul><li>satu</li></ul>',
    );

    expect(hasil).toContain('<h2>Judul</h2>');
    expect(hasil).toContain('<strong>Tebal</strong>');
    expect(hasil).toContain('<em>miring</em>');
    expect(hasil).toContain('<li>satu</li>');
  });

  it('mempertahankan gambar base64 yang sah', () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
    const hasil = sanitasiHtml(`<img src="${png}" alt="Denah" width="800" height="600">`);

    expect(hasil).toContain(`src="${png}"`);
    expect(hasil).toContain('alt="Denah"');
    expect(hasil).toContain('width="800"');
  });

  it('selalu memasang rel penutup pada tautan', () => {
    const hasil = sanitasiHtml('<a href="https://x.test" target="_blank">x</a>');

    expect(hasil).toContain('rel="noopener noreferrer nofollow"');
    expect(hasil).toContain('target="_blank"');
  });
});

describe('htmlAdaIsi', () => {
  it('false untuk null/kosong/tanpa isi terlihat', () => {
    expect(htmlAdaIsi(null)).toBe(false);
    expect(htmlAdaIsi(undefined)).toBe(false);
    expect(htmlAdaIsi('   ')).toBe(false);
    expect(htmlAdaIsi('<p></p>')).toBe(false);
  });

  it('true untuk teks dan untuk gambar', () => {
    expect(htmlAdaIsi('<p>x</p>')).toBe(true);
    expect(htmlAdaIsi('<img src="data:image/png;base64,AAAA">')).toBe(true);
  });
});
