import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getMatriks, simpanIzin } from './izin';

const { api } = vi.hoisted(() => ({ api: vi.fn(async () => ({})) }));
vi.mock('./client', () => ({ api }));

beforeEach(() => {
  api.mockClear();
});

describe('izin', () => {
  it('getMatriks membaca matriks izin', () => {
    void getMatriks();

    expect(api).toHaveBeenCalledWith('/admin/izin');
  });

  it('simpanIzin mengirim role dan daftar izin', () => {
    void simpanIzin('guru', ['santri.lihat', 'nilai.ubah']);

    expect(api).toHaveBeenCalledWith('/admin/izin', {
      method: 'PUT',
      body: JSON.stringify({ role: 'guru', permissions: ['santri.lihat', 'nilai.ubah'] }),
    });
  });
});
