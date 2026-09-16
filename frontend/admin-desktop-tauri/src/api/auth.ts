import { api, clearSession, setSession } from './client';

export interface Role {
  id: number;
  name: string;
}

export interface LembagaRingkas {
  id: number;
  nama: string;
  kode: string | null;
}

export interface Me {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  username: string | null;
  roles: Role[];
  lembagas?: LembagaRingkas[];
  /** Izin matriks dari backend (`modul.aksi`); sumber dochaya visibilitas & tombol aksi. */
  permissions?: string[];
}

/** Cek satu izin matriks. */
export function bisa(user: Pick<Me, 'permissions'> | null | undefined, izin: string): boolean {
  return !!user?.permissions?.includes(izin);
}

/** Peran yang boleh memakai aplikasi desktop admin. */
export const DESKTOP_ROLES = ['super_admin', 'admin'];

export function isDesktopRoleAllowed(user: Pick<Me, 'roles'> | null | undefined): boolean {
  return !!user?.roles?.some((r) => DESKTOP_ROLES.includes(r.name));
}

export async function login(identifier: string, password: string): Promise<Me> {
  const res = await api<{ user: Me; permissions: string[]; token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password, device: 'admin-desktop-tauri' }),
  });
  // Pagar kedua (backend juga menolak 403): jangan simpan sesi non-admin.
  if (!isDesktopRoleAllowed(res.user)) {
    throw new Error('Aplikasi desktop hanya untuk peran super_admin/admin.');
  }
  const user: Me = { ...res.user, permissions: res.permissions };
  await setSession(res.token, user);
  return user;
}

export function me(): Promise<Me> {
  return api<Me>('/auth/me');
}

export async function logout(): Promise<void> {
  try {
    await api('/auth/logout', { method: 'POST' });
  } finally {
    await clearSession();
  }
}

export async function logoutAll(): Promise<void> {
  try {
    await api('/auth/logout-all', { method: 'POST' });
  } finally {
    await clearSession();
  }
}
