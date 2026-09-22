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

/** Lembaga yang sedang "diperankan" (mode bertindak sebagai lembaga) — dikirim
 *  sebagai header X-Lembaga-Aktif. `null` = mode penuh. */
let lembagaAktifId: string | null = null;

export function setLembagaAktifHeader(id: string | null): void {
  lembagaAktifId = id;
}

function headerLembaga(): Record<string, string> {
  return lembagaAktifId != null ? { 'X-Lembaga-Aktif': String(lembagaAktifId) } : {};
}

/**
 * Jalankan request tanpa header peran act-as (mode penuh sementara).
 * Dipakai mengambil opsi peran super_admin: daftar lembaga ter-scope saat
 * bertindak, sehingga tanpa ini tombol banner menyusut ke peran aktif saja.
 */
export async function tanpaHeaderPeran<T>(kerja: () => Promise<T>): Promise<T> {
  const simpan = lembagaAktifId;
  lembagaAktifId = null;
  try {
    return await kerja();
  } finally {
    lembagaAktifId = simpan;
  }
}

/** Event global saat sesi kedaluwarsa (401) — didengar AuthProvider. */
export const AUTH_EXPIRED_EVENT = 'simpes:unauthorized';

function emitUnauthorized() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function isLoopback(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1' || hostname === '[::1]';
}

let store: LazyStore | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function getStore(): LazyStore | null {
  try {
    if (!store) store = new LazyStore('simpes.dat');
    return store;
  } catch {
    return null;
  }
}

/** Tulis file store di-debounce agar tidak save() tiap set. */
function scheduleStoreSave(s: LazyStore) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    s.save().catch(() => {});
  }, 300);
}

async function kvGet(key: string): Promise<string | null> {
  if (isTauri()) {
    const s = getStore();
    if (!s) return null;
    try {
      const v = await s.get<string>(key);
      return v ?? null;
    } catch {
      return null;
    }
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

async function kvSet(key: string, value: string): Promise<void> {
  if (isTauri()) {
    const s = getStore();
    if (!s) return;
    try {
      await s.set(key, value);
      scheduleStoreSave(s);
    } catch {
      /* gagal simpan (disk/izin): abaikan agar UI tidak macet */
    }
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    /* kuota/private mode: abaikan */
  }
}

async function kvDel(key: string): Promise<void> {
  if (isTauri()) {
    const s = getStore();
    if (!s) return;
    try {
      await s.delete(key);
      scheduleStoreSave(s);
    } catch {
      /* abaikan */
    }
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch {
    /* abaikan */
  }
}

/** Panggil command Rust; `undefined` berarti Tauri tidak tersedia / command gagal. */
async function tauriInvoke<T>(cmd: string, args: Record<string, unknown>): Promise<T | undefined> {
  if (!isTauri()) return undefined;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return (await invoke<T>(cmd, args)) as T;
  } catch {
    return undefined;
  }
}

/** Token disimpan di OS keychain (desktop); fallback store/localStorage. */
async function tokenGet(): Promise<string | null> {
  if (isTauri()) {
    const v = await tauriInvoke<string | null>('secure_get', { key: TOKEN_KEY });
    if (v !== undefined) return v ?? null;
    // Fallback ke penyimpanan lama + migrasi ke keychain.
    const old = await kvGet(TOKEN_KEY);
    if (old) {
      const migrated = await tauriInvoke<null>('secure_set', { key: TOKEN_KEY, value: old });
      if (migrated !== undefined) await kvDel(TOKEN_KEY);
    }
    return old;
  }
  return kvGet(TOKEN_KEY);
}

async function tokenSet(token: string): Promise<void> {
  if (isTauri()) {
    const ok = await tauriInvoke<null>('secure_set', { key: TOKEN_KEY, value: token });
    if (ok !== undefined) return;
  }
  await kvSet(TOKEN_KEY, token);
}

async function tokenDel(): Promise<void> {
  if (isTauri()) {
    const ok = await tauriInvoke<null>('secure_delete', { key: TOKEN_KEY });
    if (ok !== undefined) return;
  }
  await kvDel(TOKEN_KEY);
}

export function getToken(): Promise<string | null> {
  return tokenGet();
}

/** Preferensi generik per-perangkat (tema, mode, sidebar, base URL). */
export const prefGet = kvGet;
export const prefSet = kvSet;
export const prefDel = kvDel;

export async function setSession(token: string, user: unknown): Promise<void> {
  await tokenSet(token);
  await kvSet(USER_KEY, JSON.stringify(user));
}

export async function clearSession(): Promise<void> {
  await Promise.all([tokenDel(), kvDel(USER_KEY)]);
}

export async function getBaseUrl(): Promise<string> {
  const custom = await kvGet(BASE_URL_KEY);
  const val = (custom || DEFAULT_API_BASE_URL).replace(/\/$/, '');
  // Tolak simpanan http non-loopback (token akan terkirim plaintext).
  try {
    const u = new URL(val);
    if (u.protocol === 'http:' && !isLoopback(u.hostname)) return DEFAULT_API_BASE_URL;
  } catch {
    return DEFAULT_API_BASE_URL;
  }
  return val;
}

export async function setBaseUrl(url: string): Promise<void> {
  const clean = url.trim().replace(/\/$/, '');
  if (!/^https?:\/\/.+/.test(clean)) throw new Error('URL harus http(s)://…');
  let u: URL;
  try {
    u = new URL(clean);
  } catch {
    throw new Error('URL tidak valid.');
  }
  if (u.protocol === 'http:' && !isLoopback(u.hostname)) {
    throw new Error('http:// hanya diizinkan untuk localhost/127.0.0.1. Gunakan https:// untuk host lain.');
  }
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
        ...headerLembaga(),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, { message: `Tidak dapat menghubungi server (${base}). Periksa alamat di Pengaturan.` });
  }
  return parseResponse<T>(res);
}

/** POST multipart (upload file): tanpa header Content-Type agar boundary otomatis. */
export async function apiUpload<T>(path: string, body: FormData): Promise<T> {
  const [token, base] = await Promise.all([getToken(), getBaseUrl()]);
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: 'POST',
      body,
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headerLembaga(),
      },
    });
  } catch {
    throw new ApiError(0, { message: `Tidak dapat menghubungi server (${base}). Periksa alamat di Pengaturan.` });
  }
  return parseResponse<T>(res);
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const body: unknown = text ? safeJson(text) : null;
  if (!res.ok) {
    if (res.status === 401) {
      await clearSession();
      emitUnauthorized();
    }
    throw new ApiError(res.status, body);
  }
  return body as T;
}

/** Unduh file ber-token (template/impor): fetch blob → anchor download. */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const [token, base] = await Promise.all([getToken(), getBaseUrl()]);
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      headers: {
        Accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headerLembaga(),
      },
    });
  } catch {
    throw new ApiError(0, { message: `Tidak dapat menghubungi server (${base}). Periksa alamat di Pengaturan.` });
  }
  if (!res.ok) {
    if (res.status === 401) {
      await clearSession();
      emitUnauthorized();
    }
    throw new ApiError(res.status, await res.text().catch(() => null));
  }
  const blob = await res.blob();
  const disposisi = res.headers.get('Content-Disposition') ?? '';
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposisi);
  const nama = match ? decodeURIComponent(match[1].replace(/"/g, '')) : fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
