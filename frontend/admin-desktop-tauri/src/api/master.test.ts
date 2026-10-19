import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PER_PAGE_DEFAULT } from '@/prefs';
import { deleteReferensi, listLembaga, referensiList } from './master';

const mocks = vi.hoisted(() => ({ api: vi.fn(), downloadFile: vi.fn() }));
vi.mock('./client', () => mocks);

beforeEach(() => {
  mocks.api.mockReset();
  mocks.api.mockResolvedValue({ data: [], current_page: 1, last_page: 1, per_page: PER_PAGE_DEFAULT, total: 0 });
});

describe('master', () => {
  it('listLembaga memakai paginasi bawaan dan menambah id dari jenjang', async () => {
    mocks.api.mockResolvedValueOnce({
      data: [{ jenjang: 'MI', nama: 'Madrasah Ibtidaiyah' }],
      current_page: 1,
      last_page: 1,
      per_page: PER_PAGE_DEFAULT,
      total: 1,
    });

    const hasil = await listLembaga();

    expect(mocks.api.mock.calls[0][0]).toBe(`/admin/lembaga?page=1&per_page=${PER_PAGE_DEFAULT}`);
    expect(hasil.data[0].id).toBe('MI');
  });

  it('listLembaga meneruskan signal dan opsi tanpaPeran', () => {
    const signal = new AbortController().signal;
    void listLembaga({ tanpaPeran: true, signal });

    expect(mocks.api.mock.calls[0][1]).toEqual({ signal, tanpaPeran: true });
  });

  it('referensiList menulis jenjang array dan opsi nonaktif', () => {
    void referensiList('agama', ['MI', 'MD'], true);

    expect(mocks.api.mock.calls[0][0]).toBe('/admin/referensi/agama?jenjang%5B%5D=MI&jenjang%5B%5D=MD&termasuk_nonaktif=1');
  });

  it('deleteReferensi mengirim jenjang dan permanen hanya bila diminta', () => {
    void deleteReferensi('agama', 3);
    void deleteReferensi('agama', 3, 'MI', true);

    expect(mocks.api.mock.calls[0][0]).toBe('/admin/referensi/agama/3');
    expect(mocks.api.mock.calls[1][0]).toBe('/admin/referensi/agama/3?jenjang=MI&permanen=1');
  });
});
