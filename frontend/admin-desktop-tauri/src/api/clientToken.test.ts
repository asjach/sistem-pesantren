import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const uji = vi.hoisted(() => ({ data: new Map<string, string>(), invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => uji.invoke(...args) }));
vi.mock('@tauri-apps/plugin-store', () => ({ LazyStore: class {
  async get(k: string) { return uji.data.get(k); }
  async set(k: string, v: string) { uji.data.set(k, v); }
  async delete(k: string) { uji.data.delete(k); }
  async save() {}
} }));

beforeEach(() => {
  vi.resetModules(); uji.data.clear(); uji.invoke.mockReset();
  Object.assign(window, { __TAURI_INTERNALS__: {} });
});
afterEach(() => { delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__; });

describe('token keychain dan migrasi desktop', () => {
  it('keychain kosong memigrasikan token plaintext lama lalu membersihkannya', async () => {
    uji.data.set('simpes_token', 'token-lama');
    uji.invoke.mockResolvedValue(null);
    const c = await import('./client');
    expect(await c.getToken()).toBe('token-lama');
    expect(uji.invoke).toHaveBeenCalledWith('secure_set', { key: 'simpes_token', value: 'token-lama' });
    expect(uji.data.has('simpes_token')).toBe(false);
  });

  it('keychain gagal memakai memori dan tidak menghidupkan kembali token OS lama saat restart', async () => {
    uji.invoke.mockRejectedValue(new Error('Keychain terkunci'));
    const c = await import('./client');
    const warning = vi.fn();
    window.addEventListener(c.TOKEN_STORAGE_WARNING_EVENT, warning);
    try {
      await c.setSession('token-baru', {});
      expect(await c.getToken()).toBe('token-baru');
      expect(uji.data.has('simpes_token')).toBe(false);
      expect(warning).toHaveBeenCalledTimes(1);
      vi.resetModules();
      uji.invoke.mockResolvedValue('token-OS-lama');
      const restart = await import('./client');
      expect(await restart.getToken()).toBeNull();
    } finally { window.removeEventListener(c.TOKEN_STORAGE_WARNING_EVENT, warning); }
  });

  it('logout membersihkan plaintext meskipun penghapusan keychain berhasil', async () => {
    uji.data.set('simpes_token', 'token-tertinggal');
    uji.invoke.mockResolvedValue(null);
    const c = await import('./client');
    await c.clearSession();
    expect(uji.data.has('simpes_token')).toBe(false);
    expect(await c.getToken()).toBeNull();
  });
});
