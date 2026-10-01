import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cariArsip, hapusArsip, jalurArsip, tulisBalikArsip } from './arsipDokumen';

/** File pura-pura di disk: himpunan path yang "ada". */
let ada = new Set<string>();
const dihapus: string[] = [];
const ditulis: [string, Uint8Array][] = [];

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: async (p: string) => ada.has(p),
  remove: async (p: string) => { dihapus.push(p); ada.delete(p); },
  mkdir: async () => {},
  writeFile: async (p: string, d: Uint8Array) => { ditulis.push([p, d]); ada.add(p); },
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
    dihapus.length = 0;
    ditulis.length = 0;
    // Pref folder absolut agar akarArsip tak memanggil documentDir native.
    localStorage.setItem('simpes_folder_arsip', '/arsip');
    localStorage.setItem('simpes_folder_arsip_test', '/arsip-test');
  });

  it('jalurArsip di folder tipe (<akar>/santri/nama)', async () => {
    await expect(jalurArsip('berkas.jpg', '/arsip', 'santri')).resolves.toBe('/arsip/santri/berkas.jpg');
    await expect(jalurArsip('berkas.jpg', '/arsip', 'pegawai')).resolves.toBe('/arsip/pegawai/berkas.jpg');
  });

  it('cariArsip mengutamakan folder tipe', async () => {
    ada = new Set(['/arsip/santri/berkas.jpg', '/arsip/berkas.jpg', '/arsip/kartu_keluarga/berkas.jpg']);
    await expect(cariArsip('berkas.jpg', 'Kartu Keluarga', '/arsip', 'santri')).resolves.toBe('/arsip/santri/berkas.jpg');
  });

  it('cariArsip jatuh ke tata lama (datar, lalu per-jenis)', async () => {
    ada = new Set(['/arsip/berkas.jpg', '/arsip/kartu_keluarga/berkas.jpg']);
    await expect(cariArsip('berkas.jpg', 'Kartu Keluarga', '/arsip', 'santri')).resolves.toBe('/arsip/berkas.jpg');
    ada = new Set(['/arsip/kartu_keluarga/berkas.jpg']);
    await expect(cariArsip('berkas.jpg', 'Kartu Keluarga', '/arsip', 'santri')).resolves.toBe('/arsip/kartu_keluarga/berkas.jpg');
  });

  it('cariArsip null bila tak ada di semua tata', async () => {
    await expect(cariArsip('hilang.jpg', 'Kartu Keluarga', '/arsip', 'lembaga')).resolves.toBeNull();
  });

  it('hapusArsip membersihkan semua tata', async () => {
    ada = new Set(['/arsip/santri/berkas.jpg', '/arsip/berkas.jpg', '/arsip/kartu_keluarga/berkas.jpg']);
    await hapusArsip('berkas.jpg', 'Kartu Keluarga', '/arsip', 'santri');
    expect(dihapus).toEqual(['/arsip/santri/berkas.jpg', '/arsip/berkas.jpg', '/arsip/kartu_keluarga/berkas.jpg']);
    expect(ada.size).toBe(0);
  });

  it('tulisBalikArsip menimpa di folder asal tanpa menghapus', async () => {
    ada = new Set(['/arsip/kartu_keluarga/berkas.jpg']);
    const bytes = new Uint8Array([1, 2, 3]);
    await tulisBalikArsip('berkas.jpg', 'berkas.jpg', 'Kartu Keluarga', bytes, 'santri');
    expect(ditulis).toEqual([['/arsip/kartu_keluarga/berkas.jpg', bytes]]);
    expect(dihapus).toEqual([]);
  });

  it('tulisBalikArsip membersihkan nama lama bila format berubah', async () => {
    ada = new Set(['/arsip/santri/berkas.jpg']);
    await tulisBalikArsip('berkas.jpg', 'berkas.png', 'Kartu Keluarga', new Uint8Array([9]), 'santri');
    expect(ditulis.map(([p]) => p)).toEqual(['/arsip/santri/berkas.png']);
    expect(dihapus).toEqual(['/arsip/santri/berkas.jpg']);
  });
});
