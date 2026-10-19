import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PER_PAGE_DEFAULT } from '@/prefs';
import { attachLembaga, detachLembaga, listUsers } from './users';

const { api } = vi.hoisted(() => ({
  api: vi.fn(async (_url: string, _init?: { method?: string; body?: string; signal?: AbortSignal }) => ({})),
}));
vi.mock('./client', () => ({ api }));

beforeEach(() => {
  api.mockClear();
});

const url = () => api.mock.calls[0][0] as string;
const body = (call = 0) => JSON.parse((api.mock.calls[call][1] as { body?: string })?.body ?? '{}') as Record<string, unknown>;

describe('users', () => {
  it('listUsers memakai halaman dan per_page bawaan', () => {
    void listUsers();

    expect(url()).toBe(`/admin/users?page=1&per_page=${PER_PAGE_DEFAULT}`);
  });

  it('listUsers mengirim filter, urutan, dan paginasi eksplisit', () => {
    void listUsers({ search: 'budi', role: 'guru', sort: ['name', 'email'], arah: 'turun', page: 3, per_page: 25 });

    const q = new URLSearchParams(url().split('?')[1]);
    expect(q.get('search')).toBe('budi');
    expect(q.get('role')).toBe('guru');
    expect(q.get('sort')).toBe('name,email');
    expect(q.get('arah')).toBe('turun');
    expect(q.get('page')).toBe('3');
    expect(q.get('per_page')).toBe('25');
  });

  it('attachLembaga hanya mengirim role bila diberikan', () => {
    void attachLembaga(7, 'MI');
    void attachLembaga(7, 'MI', 'admin');

    expect(body(0)).toEqual({ jenjang: 'MI' });
    expect(body(1)).toEqual({ jenjang: 'MI', role: 'admin' });
  });

  it('detachLembaga membedakan role undefined (semua) dan null (warisan)', () => {
    void detachLembaga(7, 'MI');
    void detachLembaga(7, 'MI', null);

    expect(body(0)).toEqual({ jenjang: 'MI' });
    expect(body(1)).toEqual({ jenjang: 'MI', role: null });
  });
});
