import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bacaArsip, cariArsip, cariLokal, gantiNamaArsip, hapusArsip, jalurArsip, normalisasiMtime, targetTulisLokal, tulisBalikArsip, tulisGantiArsip, tulisTepatArsip } from './arsipDokumen';

/** File pura-pura di disk: himpunan path yang "ada". */
let ada = new Set<string>();
/** Isi + mtime (detik) per path. */
const isi = new Map<string, Uint8Array>();
const ubah = new Map<string, number>();
const dihapus: string[] = [];
const ditulis: [string, Uint8Array][] = [];

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: async (p: string) => ada.has(p),
  remove: async (p: string) => { dihapus.push(p); ada.delete(p); isi.delete(p); },
  mkdir: async () => {},
  writeFile: async (p: string, d: Uint8Array) => { ditulis.push([p, d]); ada.add(p); isi.set(p, d); },
  readFile: async (p: string) => isi.get(p) ?? new Uint8Array(),
  stat: async (p: string) => ({ mtime: ubah.has(p) ? new Date((ubah.get(p) as number) * 1000) : null }),
  rename: async (a: string, b: string) => {
    if (!ada.has(a)) throw new Error('sumber hilang');
    ada.delete(a); ada.add(b);
    if (isi.has(a)) { isi.set(b, isi.get(a) as Uint8Array); isi.delete(a); }
  },
  copyFile: async (a: string, b: string) => { ada.add(b); if (isi.has(a)) isi.set(b, isi.get(a) as Uint8Array); },
  size: async (p: string) => (isi.get(p) ?? new Uint8Array()).length,
}));
vi.mock('@tauri-apps/api/path', () => ({
  join: async (...bagian: string[]) => bagian.join('/'),
  dirname: async (p: string) => p.split('/').slice(0, -1).join('/'),
  basename: async (p: string) => p.split('/').pop() ?? p,
  documentDir: async () => '/doc',
}));
vi.mock('@tauri-apps/plugin-store', () => ({
  LazyStore: class {
    async get() { return null; }
    async set() {}
    async save() {}
  },
}));

describe('arsip per tipe', () => {
  beforeEach(() => {
    ada = new Set<string>();
    isi.clear();
    ubah.clear();
    dihapus.length = 0;
    ditulis.length = 0;
    // Pref folder absolut agar akarArsip tak memanggil documentDir native.
    localStorage.setItem('simpes_folder_arsip', '/arsip');
    localStorage.setItem('simpes_folder_arsip_test', '/arsip-test');
  });

  it('jalurArsip di folder tipe (<akar>/santri/nama)', async () => {
    await expect(jalurArsip('berkas.jpg', '/arsip', 'santri', 'lokal')).resolves.toBe('/arsip/santri/berkas.jpg');
    await expect(jalurArsip('berkas.jpg', '/arsip', 'pegawai', 'test')).resolves.toBe('/arsip/pegawai/berkas.jpg');
  });

  it('cariArsip mengutamakan folder tipe', async () => {
    ada = new Set(['/arsip/santri/berkas.jpg', '/arsip/lokal/santri/berkas.jpg', '/arsip/berkas.jpg', '/arsip/kartu_keluarga/berkas.jpg']);
    await expect(cariArsip('berkas.jpg', 'Kartu Keluarga', '/arsip', 'santri', 'lokal')).resolves.toBe('/arsip/santri/berkas.jpg');
  });

  it('cariArsip menemukan tata peralihan (segmen lokasi)', async () => {
    ada = new Set(['/arsip/lokal/santri/berkas.jpg']);
    await expect(cariArsip('berkas.jpg', 'Kartu Keluarga', '/arsip', 'santri', 'lokal')).resolves.toBe('/arsip/lokal/santri/berkas.jpg');
    ada = new Set(['/arsip/test/santri/berkas.jpg']);
    await expect(cariArsip('berkas.jpg', 'Kartu Keluarga', '/arsip', 'santri', 'test')).resolves.toBe('/arsip/test/santri/berkas.jpg');
  });

  it('cariArsip jatuh ke tata lama (datar, lalu per-jenis)', async () => {
    ada = new Set(['/arsip/berkas.jpg', '/arsip/kartu_keluarga/berkas.jpg']);
    await expect(cariArsip('berkas.jpg', 'Kartu Keluarga', '/arsip', 'santri', 'lokal')).resolves.toBe('/arsip/berkas.jpg');
    ada = new Set(['/arsip/kartu_keluarga/berkas.jpg']);
    await expect(cariArsip('berkas.jpg', 'Kartu Keluarga', '/arsip', 'santri', 'lokal')).resolves.toBe('/arsip/kartu_keluarga/berkas.jpg');
  });

  it('cariArsip null bila tak ada di semua tata', async () => {
    await expect(cariArsip('hilang.jpg', 'Kartu Keluarga', '/arsip', 'lembaga', 'lokal')).resolves.toBeNull();
  });

  it('hapusArsip membersihkan semua tata', async () => {
    ada = new Set(['/arsip/santri/berkas.jpg', '/arsip/lokal/santri/berkas.jpg', '/arsip/test/santri/berkas.jpg', '/arsip/berkas.jpg', '/arsip/kartu_keluarga/berkas.jpg']);
    await hapusArsip('berkas.jpg', 'Kartu Keluarga', '/arsip', 'santri', 'lokal');
    expect(dihapus).toEqual(['/arsip/santri/berkas.jpg', '/arsip/lokal/santri/berkas.jpg', '/arsip/test/santri/berkas.jpg', '/arsip/berkas.jpg', '/arsip/kartu_keluarga/berkas.jpg']);
    expect(ada.size).toBe(0);
  });

  it('tulisBalikArsip menimpa di folder asal tanpa menghapus', async () => {
    ada = new Set(['/arsip/kartu_keluarga/berkas.jpg']);
    const bytes = new Uint8Array([1, 2, 3]);
    await tulisBalikArsip('berkas.jpg', 'berkas.jpg', 'Kartu Keluarga', bytes, 'santri', 'lokal');
    expect(ditulis).toEqual([['/arsip/kartu_keluarga/berkas.jpg', bytes]]);
    expect(dihapus).toEqual([]);
  });

  it('tulisBalikArsip membersihkan nama lama bila format berubah', async () => {
    ada = new Set(['/arsip/santri/berkas.jpg']);
    await tulisBalikArsip('berkas.jpg', 'berkas.png', 'Kartu Keluarga', new Uint8Array([9]), 'santri', 'lokal');
    expect(ditulis.map(([p]) => p)).toEqual(['/arsip/santri/berkas.png']);
    expect(dihapus).toEqual(['/arsip/santri/berkas.jpg']);
  });

  it('tulisGantiArsip menulis nama template unik + membersihkan lama', async () => {
    ada = new Set(['/arsip/kartu_keluarga/lama.jpg']);
    const nama = await tulisGantiArsip({
      namaLama: 'lama.jpg', jenis: 'Kartu Keluarga', pemilik: 'Ahmad', catatan: '',
      ext: 'jpg', data: new Uint8Array([7]), lokasi: 'lokal', tipe: 'santri',
    });
    expect(nama).toMatch(/^ahmad_kartu_keluarga_\d{8}_\d{6}\.jpg$/);
    expect(ditulis.map(([p]) => p)).toEqual([`/arsip/santri/${nama}`]);
    expect(dihapus).toEqual(['/arsip/kartu_keluarga/lama.jpg']);
  });

  it('tulisGantiArsip menolak ekstensi dan ukuran liar', async () => {
    await expect(tulisGantiArsip({
      namaLama: null, jenis: 'Kartu Keluarga', pemilik: 'Ahmad', catatan: '',
      ext: 'exe', data: new Uint8Array([1]), lokasi: 'lokal', tipe: 'santri',
    })).rejects.toThrow('JPG');
    await expect(tulisGantiArsip({
      namaLama: null, jenis: 'Kartu Keluarga', pemilik: 'Ahmad', catatan: '',
      ext: 'jpg', data: new Uint8Array(11 * 1024 * 1024), lokasi: 'lokal', tipe: 'santri',
    })).rejects.toThrow('10 MB');
  });
});

describe('helper cermin', () => {
  beforeEach(() => {
    ada = new Set<string>();
    isi.clear();
    ubah.clear();
    localStorage.setItem('simpes_folder_arsip', '/arsip');
    localStorage.setItem('simpes_folder_arsip_test', '/arsip-test');
  });

  it('normalisasiMtime: Date/detik/mili/tak-valid', () => {
    expect(normalisasiMtime(new Date(2000 * 1000))).toBe(2000);
    expect(normalisasiMtime(2000)).toBe(2000);
    expect(normalisasiMtime(1_700_000_000_000)).toBe(1_700_000_000);
    expect(normalisasiMtime(null)).toBe(0);
    expect(normalisasiMtime(Number.NaN, 7)).toBe(7);
  });

  it('bacaArsip: byte + mtime detik; null bila hilang', async () => {
    ada = new Set(['/arsip/santri/a.pdf']);
    isi.set('/arsip/santri/a.pdf', new Uint8Array([4, 5]));
    ubah.set('/arsip/santri/a.pdf', 1234);
    const ketemu = await bacaArsip('a.pdf', 'KK', '/arsip', 'santri', 'lokal');
    expect(ketemu?.bytes).toEqual(new Uint8Array([4, 5]));
    expect(ketemu?.mtime).toBe(1234);
    await expect(bacaArsip('hilang.pdf', 'KK', '/arsip', 'santri', 'lokal')).resolves.toBeNull();
  });

  it('tulisTepatArsip: nama tepat + bersih duplikat lama', async () => {
    ada = new Set(['/arsip/berkas.jpg']);
    const tujuan = await tulisTepatArsip(new Uint8Array([1]), 'berkas.jpg', '/arsip', 'santri', 'lokal');
    expect(tujuan).toBe('/arsip/santri/berkas.jpg');
    expect(ditulis.map(([p]) => p)).toEqual(['/arsip/santri/berkas.jpg']);
    expect(dihapus).toEqual(['/arsip/berkas.jpg']);
  });

  it('gantiNamaArsip: pindah ke kanonis; hilang → galat', async () => {
    ada = new Set(['/arsip/kartu_keluarga/lama.jpg']);
    isi.set('/arsip/kartu_keluarga/lama.jpg', new Uint8Array([9]));
    const tujuan = await gantiNamaArsip('lama.jpg', 'baru.jpg', 'Kartu Keluarga', '/arsip', 'santri', 'lokal');
    expect(tujuan).toBe('/arsip/santri/baru.jpg');
    expect(isi.get('/arsip/santri/baru.jpg')).toEqual(new Uint8Array([9]));
    await expect(gantiNamaArsip('tak-ada.jpg', 'x.jpg', 'KK', '/arsip', 'santri', 'lokal')).rejects.toThrow();
  });

  it('cariLokal cermin menemukan di tata uji; lokal tidak', async () => {
    ada = new Set(['/arsip-test/test/santri/x.pdf']);
    isi.set('/arsip-test/test/santri/x.pdf', new Uint8Array([2]));
    const cermin = await cariLokal('x.pdf', 'KK', 'santri', 'cermin');
    expect(cermin?.lokasi).toBe('test');
    expect(cermin?.bytes).toEqual(new Uint8Array([2]));
    await expect(cariLokal('x.pdf', 'KK', 'santri', 'lokal')).resolves.toBeNull();
  });

  it('targetTulisLokal: lokasi ditemukan, atau bawaan dokumen/lokal', async () => {
    ada = new Set(['/arsip-test/test/santri/x.pdf']);
    await expect(targetTulisLokal('x.pdf', 'KK', 'santri', 'cermin')).resolves.toEqual({ akar: '/arsip-test', lokasi: 'test' });
    await expect(targetTulisLokal('baru.pdf', 'KK', 'santri', 'cermin')).resolves.toEqual({ akar: '/arsip', lokasi: 'lokal' });
  });
});
