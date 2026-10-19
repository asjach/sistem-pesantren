import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bulkAcc, bulkVerifikasi, listAntrean } from './psb';

const mocks = vi.hoisted(() => ({ api: vi.fn(), downloadFile: vi.fn() }));
vi.mock('./client', () => mocks);

beforeEach(() => {
  mocks.api.mockReset();
  mocks.api.mockResolvedValue({});
});

const url = () => mocks.api.mock.calls[0][0] as string;
const body = () => JSON.parse(mocks.api.mock.calls[0][1]?.body ?? '{}') as Record<string, unknown>;

describe('psb', () => {
  it('listAntrean mengirim status, filter, dan paginasi tanpa per_page kosong', () => {
    void listAntrean({ status: 'baru', jenjang: ['MI'], search: 'budi', page: 2 });

    const q = new URLSearchParams(url().split('?')[1]);
    expect(q.get('status')).toBe('baru');
    expect(q.get('jenjang[]')).toBe('MI');
    expect(q.get('search')).toBe('budi');
    expect(q.get('page')).toBe('2');
    expect(q.has('per_page')).toBe(false);
  });

  it('bulkVerifikasi mengirim daftar id', () => {
    void bulkVerifikasi([1, 2, 3]);

    expect(mocks.api.mock.calls[0][0]).toBe('/psb/bulk/verifikasi');
    expect(body()).toEqual({ ids: [1, 2, 3] });
  });

  it('bulkAcc membuang NIS kosong dan tidak mengirim nis bila semuanya kosong', () => {
    void bulkAcc([1, 2], { 1: '  ', 2: '123' });
    void bulkAcc([1], { 1: '  ' });

    expect(body()).toEqual({ ids: [1, 2], nis: { 2: '123' } });
    expect(JSON.parse(mocks.api.mock.calls[1][1].body)).toEqual({ ids: [1] });
  });
});
