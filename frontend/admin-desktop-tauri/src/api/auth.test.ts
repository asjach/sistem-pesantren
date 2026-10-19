import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bisa, DESKTOP_ROLES, isDesktopRoleAllowed, login, logout, type Me } from './auth';

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  setSession: vi.fn(async () => {}),
  clearSession: vi.fn(async () => {}),
}));

vi.mock('./client', () => mocks);

const admin: Me = {
  id: 1,
  name: 'Admin',
  email: null,
  phone: null,
  username: 'admin',
  roles: [{ id: 1, name: 'admin' }],
};

beforeEach(() => {
  mocks.api.mockReset();
  mocks.setSession.mockClear();
  mocks.clearSession.mockClear();
});

describe('auth', () => {
  it('login mengirim device desktop dan menyimpan sesi beserta izin', async () => {
    mocks.api.mockResolvedValue({ user: admin, permissions: ['santri.lihat'], token: 'tok' });

    const user = await login('admin', 'rahasia');

    expect(mocks.api).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'admin', password: 'rahasia', device: 'admin-desktop-tauri' }),
    });
    expect(user).toEqual({ ...admin, permissions: ['santri.lihat'] });
    expect(mocks.setSession).toHaveBeenCalledWith('tok', user);
  });

  it('login menolak peran non-desktop tanpa menyimpan sesi', async () => {
    mocks.api.mockResolvedValue({
      user: { ...admin, roles: [{ id: 2, name: 'guru' }] },
      permissions: [],
      token: 'tok',
    });

    await expect(login('guru', 'x')).rejects.toThrow('hanya untuk peran super_admin/admin');
    expect(mocks.setSession).not.toHaveBeenCalled();
  });

  it('logout tetap membersihkan sesi saat permintaan gagal', async () => {
    mocks.api.mockRejectedValue(new Error('jaringan'));

    await expect(logout()).rejects.toThrow('jaringan');
    expect(mocks.clearSession).toHaveBeenCalledOnce();
  });

  it('bisa membaca izin dan isDesktopRoleAllowed hanya mengizinkan peran desktop', () => {
    expect(bisa({ permissions: ['a.b'] }, 'a.b')).toBe(true);
    expect(bisa({ permissions: ['a.b'] }, 'a.c')).toBe(false);
    expect(bisa(null, 'a.b')).toBe(false);
    expect(DESKTOP_ROLES).toEqual(['super_admin', 'admin']);
    expect(isDesktopRoleAllowed(admin)).toBe(true);
    expect(isDesktopRoleAllowed({ roles: [{ id: 2, name: 'guru' }] })).toBe(false);
    expect(isDesktopRoleAllowed(null)).toBe(false);
  });
});
