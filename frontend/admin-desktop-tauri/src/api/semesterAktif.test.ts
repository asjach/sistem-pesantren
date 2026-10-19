import { beforeEach, describe, expect, it, vi } from 'vitest';

import { daftarSemester, tetapkanSemester } from './semesterAktif';

const { api } = vi.hoisted(() => ({
  api: vi.fn(async (_url: string, _init?: { method?: string; body?: string }) => ({})),
}));
vi.mock('./client', () => ({ api }));

beforeEach(() => {
  api.mockClear();
});

describe('semester aktif', () => {
  it('daftarSemester tanpa filter tidak menambah tanda tanya', () => {
    void daftarSemester();

    expect(api).toHaveBeenCalledWith('/admin/semester-aktif');
  });

  it('daftarSemester mengirim urutan bila ada', () => {
    void daftarSemester({ sort: ['nama'], arah: 'turun' });

    expect(api.mock.calls[0][0]).toBe('/admin/semester-aktif?sort=nama&arah=turun');
  });

  it('tetapkanSemester mengirim jenjang dan semester', () => {
    void tetapkanSemester('MI', '2');

    expect(api).toHaveBeenCalledWith('/admin/semester-aktif', {
      method: 'PUT',
      body: JSON.stringify({ jenjang: 'MI', semester: '2' }),
    });
  });
});
