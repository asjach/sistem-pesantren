import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

beforeEach(() => { vi.resetModules(); localStorage.clear(); });
afterEach(() => vi.unstubAllGlobals());

describe('isolasi respons antar sesi', () => {
  it('GET sesi baru tidak memakai request akun lama dan respons lama dibuang', async () => {
    const old = deferred<Response>();
    const fetcher = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce(new Response(JSON.stringify({ id: 2 })));
    vi.stubGlobal('fetch', fetcher);
    const c = await import('./client');
    await c.setSession('akun-a', { id: 1 });
    const a = c.api('/auth/me').catch((e: unknown) => e);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await c.setSession('akun-b', { id: 2 });
    const b = c.api('/auth/me');
    expect(await b).toEqual({ id: 2 });
    old.resolve(new Response(JSON.stringify({ id: 1 })));
    expect(await a).toMatchObject({ name: 'AbortError' });
    expect(await c.getToken()).toBe('akun-b');
  });

  it('401 akun lama tidak menghapus token atau menyiarkan logout akun baru', async () => {
    const old = deferred<Response>();
    const fetcher = vi.fn().mockReturnValue(old.promise);
    vi.stubGlobal('fetch', fetcher);
    const c = await import('./client');
    const expired = vi.fn();
    window.addEventListener(c.AUTH_EXPIRED_EVENT, expired);
    try {
      await c.setSession('akun-a', {});
      const request = c.api('/auth/me').catch((e: unknown) => e);
      await vi.waitFor(() => expect(fetcher).toHaveBeenCalled());
      await c.setSession('akun-b', {});
      old.resolve(new Response('{}', { status: 401 }));
      expect(await request).toMatchObject({ name: 'AbortError' });
      expect(await c.getToken()).toBe('akun-b');
      expect(expired).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(c.AUTH_EXPIRED_EVENT, expired);
    }
  });

  it('401 sesi saat ini tetap membersihkan token dan menyiarkan logout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    const c = await import('./client');
    const expired = vi.fn();
    window.addEventListener(c.AUTH_EXPIRED_EVENT, expired);
    try {
      await c.setSession('aktif', {});
      await expect(c.api('/auth/me')).rejects.toMatchObject({ status: 401 });
      expect(await c.getToken()).toBeNull();
      expect(expired).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(c.AUTH_EXPIRED_EVENT, expired);
    }
  });
});
