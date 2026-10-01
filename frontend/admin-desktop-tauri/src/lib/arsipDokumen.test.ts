import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cariArsip, hapusArsip, jalurArsip } from './arsipDokumen';

/** File pura-pura di disk: himpunan path yang "ada". */
let ada = new Set<string>();
const dihapus: string[] = [];

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: async (p: string) => ada.has(p),
  remove: async (p: string) => { dihapus.push(p); ada.delete(p); },
  mkdir: async () => {},
  writeFile: async () => {},
}));
vi.mock('@tauri-apps/api/path', () => ({
  join: async (...bagian: string[]) => bagian.join('/'),
  dirname: async (p: string) => p.split('/').slice(0, -1).join('/'),
  basename: async (p: string) => p.split('/').pop() ?? p,
}));

describe('arsip per tipe', () => {
  beforeEach(() => {
    ada = new Set<string>();
    dihapus.length = 0;
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
});
