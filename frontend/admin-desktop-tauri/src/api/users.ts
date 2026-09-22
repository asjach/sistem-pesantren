import { api } from './client';
import { PER_PAGE_DEFAULT } from '@/prefs';
import type { Role } from './auth';

export interface AdminUser {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  username: string | null;
  roles: Role[];
  lembagas?: { jenjang: string; nama: string }[];
}

export interface Paginate<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

// Pagination bawaan tabel: PER_PAGE_DEFAULT (lihat prefs.ts).
export function listUsers(params: { search?: string; role?: string; sort?: string[]; arah?: 'naik' | 'turun'; page?: number; per_page?: number; signal?: AbortSignal } = {}) {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.role) q.set('role', params.role);
  if (params.sort?.length) q.set('sort', params.sort.join(','));
  if (params.arah) q.set('arah', params.arah);
  q.set('page', String(params.page ?? 1));
  q.set('per_page', String(params.per_page ?? PER_PAGE_DEFAULT));
  return api<Paginate<AdminUser>>(`/admin/users?${q.toString()}`, { signal: params.signal });
}

export function createUser(input: {
  name: string;
  email?: string;
  phone?: string;
  username?: string;
  password: string;
  roles: string[];
  jenjangs?: string[];
}) {
  return api<AdminUser>('/admin/users', { method: 'POST', body: JSON.stringify(input) });
}

export function deleteUser(id: number) {
  return api<{ message: string }>(`/admin/users/${id}`, { method: 'DELETE' });
}

export function updateUser(id: number, input: {
  name?: string;
  email?: string | null;
  phone?: string | null;
  username?: string | null;
  password?: string;
  roles?: string[];
  jenjangs?: string[];
}) {
  return api<AdminUser>(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

export function attachLembaga(userId: number, jenjang: string) {
  return api(`/admin/users/${userId}/lembaga`, {
    method: 'POST',
    body: JSON.stringify({ jenjang }),
  });
}

export function detachLembaga(userId: number, jenjang: string) {
  return api(`/admin/users/${userId}/lembaga`, {
    method: 'DELETE',
    body: JSON.stringify({ jenjang }),
  });
}

export function assignRole(userId: number, role: string) {
  return api<{ message: string; user: AdminUser }>(`/admin/users/${userId}/roles`, {
    method: 'POST',
    body: JSON.stringify({ role }),
  });
}

export function removeRole(userId: number, role: string) {
  return api<{ message: string; user: AdminUser }>(`/admin/users/${userId}/roles`, {
    method: 'DELETE',
    body: JSON.stringify({ role }),
  });
}
