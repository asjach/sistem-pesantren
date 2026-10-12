import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hapusKomponenCustom, simpanKomponenCustom } from './komponenCustom';

/** `api` dimock: yang diuji adalah bentuk permintaan (URL & body). */
const { api } = vi.hoisted(() => ({
  api: vi.fn(async (_url: string, _init?: { method?: string; body?: string }) => ({ pesan: '', data: {} })),
}));
vi.mock('./client', () => ({ api }));

beforeEach(() => {
  api.mockClear();
});

/** Body JSON permintaan pertama. */
const body = () => JSON.parse(api.mock.calls[0][1]?.body ?? '{}') as Record<string, unknown>;
/** URL permintaan pertama. */
const url = () => api.mock.calls[0][0];

describe('komponen-custom — komponen DI LUAR tabel (tableKey kosong)', () => {
  it('PUT tidak mengirim table_key sama sekali', () => {
    simpanKomponenCustom('demo_input_bebas', { tipeKontrol: 'nominal' }, '');

    const b = body();
    expect(b).not.toHaveProperty('table_key');
    expect(b).toMatchObject({ komponen: 'demo_input_bebas', setelan: { tipeKontrol: 'nominal' } });
  });

  it('DELETE tidak menyertakan table_key di query', () => {
    hapusKomponenCustom('demo_input_bebas', '');

    expect(url()).toBe('/admin/komponen-custom?komponen=demo_input_bebas');
  });
});

describe('komponen-custom — komponen DI DALAM tabel', () => {
  it('PUT mengirim table_key tabelnya', () => {
    simpanKomponenCustom('select_status_daftar_kelas', { nilaiDefault: 'Aktif' }, 'daftar_kelas');

    expect(body()).toMatchObject({ table_key: 'daftar_kelas', komponen: 'select_status_daftar_kelas' });
  });

  it('DELETE menyertakan table_key di query', () => {
    hapusKomponenCustom('select_status_daftar_kelas', 'daftar_kelas');

    expect(url()).toBe('/admin/komponen-custom?table_key=daftar_kelas&komponen=select_status_daftar_kelas');
  });
});
