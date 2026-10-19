import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hapusToolbarPreset, muatToolbarPreset, simpanToolbarPreset } from './toolbarPreset';

const { api } = vi.hoisted(() => ({
  api: vi.fn(async (_url: string, _init?: { method?: string; body?: string }) => ({})),
}));
vi.mock('./client', () => ({ api }));

beforeEach(() => {
  api.mockClear();
});

const body = () => JSON.parse((api.mock.calls[0][1] as { body?: string })?.body ?? '{}') as Record<string, unknown>;

describe('toolbarPreset', () => {
  it('memuat preset dengan table_key ter-encode', () => {
    void muatToolbarPreset('daftar santri');

    expect(api).toHaveBeenCalledWith('/admin/toolbar-preset?table_key=daftar%20santri');
  });

  it('simpan hanya mengirim field yang diberikan', () => {
    void simpanToolbarPreset('tabel');

    expect(body()).toEqual({ table_key: 'tabel' });
  });

  it('string kosong tetap dikirim untuk menghapus override judul dan info', () => {
    void simpanToolbarPreset('tabel', undefined, undefined, undefined, undefined, '', '');

    expect(body()).toEqual({ table_key: 'tabel', judul: '', info_html: '' });
  });

  it('visibilitas, urutan, align, dan label ikut dikirim bila ada', () => {
    void simpanToolbarPreset('tabel', { cari: true }, ['nama'], { nama: 'left' }, { nama: 'Nama' }, 'Judul', '<p>Info</p>');

    expect(body()).toEqual({
      table_key: 'tabel',
      visibilitas: { cari: true },
      urutan: ['nama'],
      align: { nama: 'left' },
      label: { nama: 'Nama' },
      judul: 'Judul',
      info_html: '<p>Info</p>',
    });
  });

  it('hapus mengirim table_key pada query', () => {
    void hapusToolbarPreset('tabel');

    expect(api).toHaveBeenCalledWith('/admin/toolbar-preset?table_key=tabel', { method: 'DELETE' });
  });
});
