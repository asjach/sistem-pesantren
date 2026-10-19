import { beforeEach, describe, expect, it, vi } from 'vitest';

const { api } = vi.hoisted(() => ({ api: vi.fn(async () => ({})) }));
vi.mock('./client', () => ({ api }));

let mod: typeof import('./urutPreset');

beforeEach(async () => {
  vi.resetModules();
  api.mockReset();
  api.mockResolvedValue({});
  mod = await import('./urutPreset');
});

describe('urutPreset', () => {
  it('arahKolomDariOpsi hanya memakai kode yang dikenal dan arah yang sah', () => {
    expect(mod.arahKolomDariOpsi({ kode: ['nama', 'nis'], arah_kolom: { nama: 'naik', nis: 'turun', lain: 'naik' } }))
      .toEqual({ nama: 'naik', nis: 'turun' });
    expect(mod.arahKolomDariOpsi({ kode: ['nama'], arah_kolom: {} })).toBeUndefined();
    expect(mod.arahKolomDariOpsi({ kode: ['nama'], arah_kolom: { lain: 'naik' } })).toBeUndefined();
  });

  it('muatUrutPreset memakai satu request untuk tabel yang sama', async () => {
    await mod.muatUrutPreset('daftar_santri');
    await mod.muatUrutPreset('daftar_santri');

    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith('/admin/urut-preset?table_key=daftar_santri');
  });

  it('segar memaksa request ulang dan kegagalan membuang memo', async () => {
    await mod.muatUrutPreset('tabel');
    await mod.muatUrutPreset('tabel', true);
    expect(api).toHaveBeenCalledTimes(2);

    api.mockRejectedValueOnce(new Error('gagal'));
    await expect(mod.muatUrutPreset('gagal')).rejects.toThrow('gagal');
    await mod.muatUrutPreset('gagal');
    expect(api).toHaveBeenCalledTimes(4);
  });

  it('simpan dan hapus mengosongkan memo', async () => {
    await mod.muatUrutPreset('tabel');
    await mod.simpanUrutPreset('tabel', []);
    await mod.muatUrutPreset('tabel');
    expect(api).toHaveBeenCalledTimes(3);

    await mod.hapusUrutPreset('tabel');
    await mod.muatUrutPreset('tabel');
    expect(api).toHaveBeenCalledTimes(5);
  });

  it('simpan dan hapus mengirim kontrak yang benar', async () => {
    await mod.simpanUrutPreset('tabel', [{ kode: ['nama'], label: 'Nama', arah: 'naik' }]);
    await mod.hapusUrutPreset('tabel');

    expect(api).toHaveBeenNthCalledWith(1, '/admin/urut-preset', {
      method: 'PUT',
      body: JSON.stringify({ table_key: 'tabel', opsi: [{ kode: ['nama'], label: 'Nama', arah: 'naik' }] }),
    });
    expect(api).toHaveBeenNthCalledWith(2, '/admin/urut-preset?table_key=tabel', { method: 'DELETE' });
  });
});
