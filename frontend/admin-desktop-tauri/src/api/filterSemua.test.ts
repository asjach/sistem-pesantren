import { beforeEach, describe, expect, it, vi } from 'vitest';

// Unit test lapisan API: mock `api` agar URL terbentuk tanpa fetch nyata.
const { api } = vi.hoisted(() => ({
  api: vi.fn((..._args: unknown[]) => Promise.resolve({ data: [], current_page: 1, last_page: 1, per_page: 1, total: 0 })),
}));
vi.mock('./client', async (importOriginal) => {
  const asli = await importOriginal<typeof import('./client')>();
  return { ...asli, api: (...args: unknown[]) => api(...args) };
});

import { listKeanggotaan, listSantri } from './santri';
import { listKeaktifanPegawai, listPegawai } from './pegawai';

/** URL panggilan `api` terakhir. */
function urlTerakhir(): string {
  const panggilan = api.mock.calls.at(-1);
  expect(panggilan).toBeDefined();
  return String(panggilan?.[0]);
}

beforeEach(() => {
  api.mockClear();
});

describe('filter "Semua" terkirim eksplisit ke backend', () => {
  it('listSantri mengirim is_active_pst=semua (bukan menghilang)', async () => {
    await listSantri({ is_active_pst: 'semua' });
    expect(urlTerakhir()).toContain('is_active_pst=semua');
  });

  it('listSantri tetap mendukung boolean (1/0) dan tanpa param', async () => {
    await listSantri({ is_active_pst: true });
    expect(urlTerakhir()).toContain('is_active_pst=1');
    await listSantri({ is_active_pst: false });
    expect(urlTerakhir()).toContain('is_active_pst=0');
    await listSantri({});
    expect(urlTerakhir()).not.toContain('is_active_pst');
  });

  it('listKeanggotaan mengirim is_active_lembaga=semua', async () => {
    await listKeanggotaan({ is_active_lembaga: 'semua' });
    expect(urlTerakhir()).toContain('/admin/lembaga-santri?');
    expect(urlTerakhir()).toContain('is_active_lembaga=semua');
  });

  it('listPegawai mengirim status_aktif=semua', async () => {
    await listPegawai({ status_aktif: 'semua' });
    expect(urlTerakhir()).toContain('/admin/pegawai?');
    expect(urlTerakhir()).toContain('status_aktif=semua');
  });

  it('listKeaktifanPegawai mengirim status_keaktifan=semua', async () => {
    await listKeaktifanPegawai({ status_keaktifan: 'semua' });
    expect(urlTerakhir()).toContain('/admin/pegawai-keaktifan?');
    expect(urlTerakhir()).toContain('status_keaktifan=semua');
  });
});
