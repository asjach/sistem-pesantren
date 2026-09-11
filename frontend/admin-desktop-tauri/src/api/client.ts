// Kontrak backend live (003/004):
// POST /api/auth/login {identifier, password, device?} -> {user, token}
// GET /api/auth/me -> user+roles+lembagas
// POST /api/auth/logout, POST /api/auth/logout-all
// GET /api/dashboard/ringkasan
// Tenant: pivot user_lembaga satu-satunya; 403 lintas lembaga; throttle login 6/mnt.
//
// Penyimpanan: di desktop Tauri pakai plugin-store (file app-data),
// di web pakai localStorage. Base URL bisa diganti runtime via Pengaturan.

import { LazyStore } from '@tauri-apps/plugin-store';

export const DEFAULT_API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  'http://127.0.0.1:8000/api';

const TOKEN_KEY = 'simpes_token';
const USER_KEY = 'simpes_user';
const BASE_URL_KEY = 'simpes_base_url';

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

let store: LazyStore | null = null;
function getStore(): LazyStore {
  if (!store) store = new LazyStore('simpes.dat');
  return store;
}

async function kvGet(key: string): Promise<string | null> {
  if (isTauri()) {
    const v = await getStore().get<string>(key);
    return v ?? null;
  }
  return localStorage.getItem(key);
}

async function kvSet(key: string, value: string): Promise<void> {
  if (isTauri()) {
    await getStore().set(key, value);
    await getStore().save();
    return;
  }
  localStorage.setItem(key, value);
}

async function kvDel(key: string): Promise<void> {
  if (isTauri()) {
    await getStore().delete(key);
    await getStore().save();
    return;
  }
  localStorage.removeItem(key);
}

export function getToken(): Promise<string | null> {
  return kvGet(TOKEN_KEY);
}

/** Preferensi generik per-perangkat (tema, mode, sidebar, base URL). */
export const prefGet = kvGet;
export const prefSet = kvSet;
export const prefDel = kvDel;

export async function setSession(token: string, user: unknown): Promise<void> {
  await kvSet(TOKEN_KEY, token);
  await kvSet(USER_KEY, JSON.stringify(user));
}

export async function clearSession(): Promise<void> {
  await kvDel(TOKEN_KEY);
  await kvDel(USER_KEY);
}

export async function getBaseUrl(): Promise<string> {
  const custom = await kvGet(BASE_URL_KEY);
  return (custom || DEFAULT_API_BASE_URL).replace(/\/$/, '');
}

export async function setBaseUrl(url: string): Promise<void> {
  const clean = url.trim().replace(/\/$/, '');
  if (!/^https?:\/\/.+/.test(clean)) throw new Error('URL harus http(s)://…');
  await kvSet(BASE_URL_KEY, clean);
}

export async function resetBaseUrl(): Promise<void> {
  await kvDel(BASE_URL_KEY);
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`API ${status}`);
    this.status = status;
    this.body = body;
  }
}

function messageOf(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const m = (body as { message?: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }
  return fallback;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const [token, base] = await Promise.all([getToken(), getBaseUrl()]);
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, { message: `Tidak dapat menghubungi server (${base}). Periksa alamat di Pengaturan.` });
  }
  const text = await res.text();
  const body: unknown = text ? safeJson(text) : null;
  if (!res.ok) {
    if (res.status === 401) await clearSession();
    throw new ApiError(res.status, body);
  }
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return messageOf(e.body, 'Tidak dapat menghubungi server.');
    if (e.status === 401) return messageOf(e.body, 'Kredensial tidak valid / sesi habis.');
    if (e.status === 403) return messageOf(e.body, 'Akses ditolak (di luar lembaga/peran Anda).');
    if (e.status === 422) return messageOf(e.body, 'Validasi gagal. Periksa isian.');
    if (e.status === 429) return 'Terlalu banyak percobaan. Tunggu sebentar (throttle).';
    return messageOf(e.body, `Gagal (${e.status}).`);
  }
  return e instanceof Error ? e.message : 'Gagal terhubung ke server.';
}
