import { beforeEach, describe, expect, it, vi } from 'vitest';

import { catatTransaksi, daftarDispensasi, generateTagihan, kuotaPakai, pratinjauTagihan } from './keuangan';

const mocks = vi.hoisted(() => ({ api: vi.fn(), downloadFile: vi.fn() }));
vi.mock('./client', () => mocks);

beforeEach(() => {
  mocks.api.mockReset();
  mocks.api.mockResolvedValue({});
});

const url = () => mocks.api.mock.calls[0][0] as string;
const body = () => JSON.parse(mocks.api.mock.calls[0][1]?.body ?? '{}') as Record<string, unknown>;

describe('keuangan', () => {
  it('generate dan pratinjau memakai kontrak POST yang sama', () => {
    const data = {
      tahun_ajaran: '2026/2027',
      jenis_id: 2,
      nominal: 100000,
      santri: [{ santri_id: 1 }, { santri_id: 2, nominal: 50000 }],
    };
    void generateTagihan(data);
    void pratinjauTagihan(data);

    expect(url()).toBe('/admin/keuangan/tagihan/generate');
    expect(body()).toEqual(data);
    expect(mocks.api.mock.calls[1][0]).toBe('/admin/keuangan/tagihan/pratinjau');
    expect(JSON.parse(mocks.api.mock.calls[1][1].body)).toEqual(data);
  });

  it('daftarDispensasi membuang jenis_id kosong dan mengirim is_active=false', () => {
    void daftarDispensasi({ jenis_id: '', is_active: false });

    expect(new URLSearchParams(url().split('?')[1]).toString()).toBe('is_active=0');
  });

  it('kuotaPakai menulis seluruh santri_ids[]', () => {
    void kuotaPakai([4, 5]);

    expect(url()).toBe('/admin/keuangan/dispensasi/kuota-pakai?santri_ids%5B%5D=4&santri_ids%5B%5D=5');
  });

  it('catatTransaksi mengirim seluruh baris kwitansi', () => {
    void catatTransaksi({ items: [{ tagihan_id: 1, jumlah: 1000 }], metode: 'tunai' });

    expect(url()).toBe('/admin/keuangan/transaksi');
    expect(body()).toEqual({ items: [{ tagihan_id: 1, jumlah: 1000 }], metode: 'tunai' });
  });
});
