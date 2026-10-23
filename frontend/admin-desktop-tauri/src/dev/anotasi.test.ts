import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bacaKonteksReact, buatSelector, parentElemen, rapikanSumber, simpanAnotasi, teksElemen, tujuanValid } from './anotasi';

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => vi.unstubAllGlobals());

describe('kirim anotasi', () => {
  const catatan = { id: 'a1', dibuat: '2026-10-23T00:00:00Z', rute: '/', selector: '#asal', tag: 'div', teks: '', komponen: [], sumber: null, instruksi: 'Ubah' };
  it('memakai JSON untuk anotasi tanpa screenshot', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => catatan });
    vi.stubGlobal('fetch', fetch);
    await expect(simpanAnotasi(catatan)).resolves.toEqual(catatan);
    expect(fetch).toHaveBeenCalledWith('/__anotasi', expect.objectContaining({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(catatan) }));
  });
  it('memakai multipart JSON dan PNG tanpa menetapkan boundary sendiri', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => catatan });
    vi.stubGlobal('fetch', fetch);
    const blob = new Blob(['png'], { type: 'image/png' });
    await simpanAnotasi(catatan, blob);
    const init = fetch.mock.calls[0][1] as RequestInit;
    expect(init.headers).toBeUndefined();
    const form = init.body as FormData;
    expect(form.get('anotasi')).toBe(JSON.stringify(catatan));
    const file = form.get('gambar') as File;
    expect(file.type).toBe('image/png');
    expect(file.name).toBe('a1.png');
  });
});

describe('rapikanSumber', () => {
  it('memendekkan jalur absolut menjadi src/...:baris', () => {
    expect(rapikanSumber('/Users/a/project/src/pages/Foo.tsx', 42)).toBe('src/pages/Foo.tsx:42');
  });

  it('membiarkan jalur relatif dan menormalkan pemisah Windows', () => {
    expect(rapikanSumber('src\\lib\\x.ts', 7)).toBe('src/lib/x.ts:7');
    expect(rapikanSumber('berkas-luar.ts')).toBe('berkas-luar.ts');
  });
});

describe('pemilihan parent dan tujuan', () => {
  it('menyediakan urutan breadcrumb hingga body, tanpa html', () => {
    document.body.innerHTML = '<header><div><button>Tombol</button></div></header>';
    expect(parentElemen(document.querySelector('button')!).map((el) => el.tagName.toLowerCase()))
      .toEqual(['button', 'div', 'header', 'body']);
  });

  it('tidak memasukkan kontrol editor anotasi sebagai kandidat', () => {
    document.body.innerHTML = '<div data-anotasi-abaikan><button>Kontrol</button></div>';
    expect(parentElemen(document.querySelector('button')!)).toEqual([]);
  });

  it('membatasi breadcrumb di dialog agar editor tidak keluar dari focus trap', () => {
    document.body.innerHTML = '<div data-slot="dialog-content"><section><button>Asal</button></section></div>';
    expect(parentElemen(document.querySelector('button')!).map((el) => el.tagName.toLowerCase()))
      .toEqual(['button', 'section', 'div']);
  });

  it('menolak diri sendiri dan descendant; menerima parent atau sibling', () => {
    document.body.innerHTML = '<div><button><span>Ikon</span></button><aside></aside></div>';
    const asal = document.querySelector('button')!;
    expect(tujuanValid(asal, asal)).toBe(false);
    expect(tujuanValid(asal, document.querySelector('span')!)).toBe(false);
    expect(tujuanValid(asal, document.querySelector('div')!)).toBe(true);
    expect(tujuanValid(asal, document.querySelector('aside')!)).toBe(true);
  });
});

describe('buatSelector', () => {
  it('memakai id unik', () => {
    document.body.innerHTML = '<button id="tombol_utama">Simpan</button>';
    expect(buatSelector(document.getElementById('tombol_utama')!)).toBe('#tombol_utama');
  });

  it('memakai data-testid unik', () => {
    document.body.innerHTML = '<div data-testid="baris_poin"></div>';
    expect(buatSelector(document.querySelector('[data-testid="baris_poin"]')!))
      .toBe('[data-testid="baris_poin"]');
  });

  it('membangun jalur body dengan nth-of-type untuk saudara sejenis', () => {
    document.body.innerHTML = '<div><button>A</button><span>x</span><button>B</button></div>';
    const tombol = document.querySelectorAll('button')[1];
    expect(buatSelector(tombol)).toBe('body > div > button:nth-of-type(2)');
  });

  it('mengembalikan body untuk elemen body', () => {
    expect(buatSelector(document.body)).toBe('body');
  });
});

describe('bacaKonteksReact', () => {
  it('membaca komponen induk-ke-anak dan sumber terdekat dari fiber', () => {
    const induk = {
      type: function HalamanContoh() {},
      return: null,
      _debugSource: { fileName: '/Users/a/project/src/pages/HalamanContoh.tsx', lineNumber: 10 },
    };
    const anak = {
      type: function TombolContoh() {},
      return: induk,
      _debugSource: { fileName: '/Users/a/project/src/components/TombolContoh.tsx', lineNumber: 24 },
    };

    const el = document.createElement('button');
    Object.defineProperty(el, '__reactFiber$uji', { value: anak });

    expect(bacaKonteksReact(el)).toEqual({
      komponen: ['HalamanContoh', 'TombolContoh'],
      sumber: 'src/components/TombolContoh.tsx:24',
    });
  });

  it('memakai _debugOwner sebagai sumber bila fiber tidak punya sumber', () => {
    const pemilik = {
      type: function KomponenPemilik() {},
      return: null,
      _debugSource: { fileName: '/Users/a/project/src/pages/Pemilik.tsx', lineNumber: 5 },
    };
    const el = document.createElement('div');
    Object.defineProperty(el, '__reactFiber$uji', {
      value: { type: 'div', return: null, _debugOwner: pemilik },
    });

    expect(bacaKonteksReact(el)).toEqual({
      komponen: [],
      sumber: 'src/pages/Pemilik.tsx:5',
    });
  });

  it('mengembalikan kosong tanpa fiber React', () => {
    expect(bacaKonteksReact(document.createElement('div'))).toEqual({ komponen: [], sumber: null });
  });
});

describe('teksElemen', () => {
  it('merapatkan spasi teks elemen', () => {
    document.body.innerHTML = '<div>  Simpan \n sekarang </div>';
    expect(teksElemen(document.querySelector('div')!)).toBe('Simpan sekarang');
  });

  it('memakai nilai input lebih dulu', () => {
    const input = document.createElement('input');
    input.value = 'Nomor peserta';
    expect(teksElemen(input)).toBe('Nomor peserta');
  });
});
