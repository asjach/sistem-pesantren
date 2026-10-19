import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listPengajuan, setujuiPengajuan, tolakPengajuan } from './pengajuan';

const { api } = vi.hoisted(() => ({
  api: vi.fn(async (_url: string, _init?: { method?: string; body?: string; signal?: AbortSignal }) => ({})),
}));
vi.mock('./client', () => ({ api }));

beforeEach(() => {
  api.mockClear();
});

const url = () => api.mock.calls[0][0] as string;

describe('pengajuan biodata', () => {
  it('listPengajuan mengirim filter dan tidak mengirim per_page bila kosong', () => {
    void listPengajuan({ status: 'diajukan', q: 'budi', page: 2 });

    const q = new URLSearchParams(url().split('?')[1]);
    expect(q.get('status')).toBe('diajukan');
    expect(q.get('q')).toBe('budi');
    expect(q.get('page')).toBe('2');
    expect(q.has('per_page')).toBe(false);
  });

  it('listPengajuan meneruskan signal pembatalan', () => {
    const signal = new AbortController().signal;
    void listPengajuan({ signal });

    expect(api).toHaveBeenCalledWith(expect.stringContaining('/admin/pengajuan-biodata?'), { signal });
  });

  it('setujui dan tolak memakai endpoint aksi masing-masing', () => {
    void setujuiPengajuan(4);
    void tolakPengajuan(4, 'data tidak lengkap');

    expect(api).toHaveBeenNthCalledWith(1, '/admin/pengajuan-biodata/4/setujui', { method: 'POST' });
    expect(api).toHaveBeenNthCalledWith(2, '/admin/pengajuan-biodata/4/tolak', {
      method: 'POST',
      body: JSON.stringify({ catatan: 'data tidak lengkap' }),
    });
  });
});
