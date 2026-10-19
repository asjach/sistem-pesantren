import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createPresetTabel, deletePresetTabel, listPresetTabel, setPresetAktif, updatePresetTabel } from './preset';

const { api } = vi.hoisted(() => ({
  api: vi.fn(async (_url: string, _init?: { method?: string; body?: string }) => ({})),
}));
vi.mock('./client', () => ({ api }));

beforeEach(() => {
  api.mockClear();
});

const body = (call = 0) => JSON.parse((api.mock.calls[call][1] as { body?: string })?.body ?? '{}') as Record<string, unknown>;

describe('preset tabel', () => {
  it('listPresetTabel meng-encode table_key', () => {
    void listPresetTabel('daftar santri');

    expect(api).toHaveBeenCalledWith('/admin/preset-tabel?table_key=daftar%20santri');
  });

  it('create dan update mengirim payload masing-masing', () => {
    void createPresetTabel({ table_key: 't', nama: 'Ringkas', kolom: ['nama'] });
    void updatePresetTabel(4, { kolom: ['nis'] });

    expect(body(0)).toEqual({ table_key: 't', nama: 'Ringkas', kolom: ['nama'] });
    expect(api.mock.calls[1][0]).toBe('/admin/preset-tabel/4');
    expect(api.mock.calls[1][1]?.method).toBe('PUT');
    expect(body(1)).toEqual({ kolom: ['nis'] });
  });

  it('delete mengarah ke id preset', () => {
    void deletePresetTabel(9);

    expect(api).toHaveBeenCalledWith('/admin/preset-tabel/9', { method: 'DELETE' });
  });

  it('setPresetAktif dengan null menyimpan susunan kolom kustom', () => {
    void setPresetAktif('t', null, ['nama', 'nis']);

    expect(body()).toEqual({ table_key: 't', preset_id: null, kolom: ['nama', 'nis'] });
  });

  it('setPresetAktif dengan id tidak mengirim kolom', () => {
    void setPresetAktif('t', 3, ['nama']);

    expect(body()).toEqual({ table_key: 't', preset_id: 3 });
  });
});
