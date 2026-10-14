import { describe, expect, it } from 'vitest';

import { appendQueryParam } from './query';

const q = () => new URLSearchParams();

describe('appendQueryParam — nilai tunggal', () => {
  it('string/angka diset apa adanya', () => {
    const p = q();
    appendQueryParam(p, 'q', 'cari');
    appendQueryParam(p, 'page', 2);
    expect(p.toString()).toBe('q=cari&page=2');
  });

  it('null/undefined/string kosong dilewati (tidak jadi param kosong)', () => {
    const p = q();
    appendQueryParam(p, 'a', null);
    appendQueryParam(p, 'b', undefined);
    appendQueryParam(p, 'c', '');
    expect(p.toString()).toBe('');
  });

  it('angka 0 TETAP dikirim (bukan dianggap kosong)', () => {
    const p = q();
    appendQueryParam(p, 'page', 0);
    expect(p.get('page')).toBe('0');
  });

  it('memakai `set`: kunci sama ditimpa, bukan menumpuk', () => {
    const p = q();
    appendQueryParam(p, 'q', 'lama');
    appendQueryParam(p, 'q', 'baru');
    expect(p.getAll('q')).toEqual(['baru']);
  });

  it('nilai di-encode dengan benar', () => {
    const p = q();
    appendQueryParam(p, 'q', 'a b&c=d');
    expect(p.get('q')).toBe('a b&c=d');
    expect(p.toString()).toBe('q=a+b%26c%3Dd');
  });
});

describe('appendQueryParam — nilai array', () => {
  it('tiap item jadi `kunci[]` terpisah (gaya PHP/Laravel)', () => {
    const p = q();
    appendQueryParam(p, 'status', ['baru', 'aktif']);
    expect(p.getAll('status[]')).toEqual(['baru', 'aktif']);
  });

  /* Tipe `ScalarOrArray<T>` melarang null/undefined DI DALAM array (hanya
     `T`). Pertahanan `item == null` tetap ada untuk pemanggil JS/tak bertipe,
     jadi dikunci lewat cast - bukan dengan melonggarkan tipe produksinya. */
  it('item null/kosong dibuang, sisanya tetap masuk', () => {
    const p = q();
    appendQueryParam(p, 'jenjang', ['MI', '', 'MD', null, undefined] as never);
    expect(p.getAll('jenjang[]')).toEqual(['MI', 'MD']);
  });

  it('array kosong: tidak ada param sama sekali', () => {
    const p = q();
    appendQueryParam(p, 'x', []);
    expect(p.toString()).toBe('');
  });

  it('array berisi angka 0 tetap dikirim', () => {
    const p = q();
    appendQueryParam(p, 'n', [0, 1]);
    expect(p.getAll('n[]')).toEqual(['0', '1']);
  });

  it('MENUMPUK, bukan menimpa: tiap pemanggilan menambah', () => {
    const p = q();
    appendQueryParam(p, 'x', ['a']);
    appendQueryParam(p, 'x', ['b']);
    expect(p.getAll('x[]')).toEqual(['a', 'b']);
  });
});
