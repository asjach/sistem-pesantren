import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KUNCI_PERPAGE_GLOBAL, usePager } from '@/hooks/usePager';
import { PER_PAGE_DEFAULT } from '@/prefs';

/** Standar server yang bisa disemai per tes (mock stateful, bukan doMock:
 *  modul sudah di-cache saat tes berjalan, jadi doMock terlambat). */
const standarServer = vi.hoisted(() => ({ peta: {} as Record<string, number>, gagal: false }));
vi.mock('@/api/pengaturanGlobal', () => ({
  muatPengaturanGlobal: async () => {
    if (standarServer.gagal) throw new Error('jaringan mati');
    return { pesan: 'ok', data: { peta: { ...standarServer.peta } } };
  },
}));

describe('usePager', () => {
  beforeEach(() => {
    localStorage.removeItem(KUNCI_PERPAGE_GLOBAL);
    localStorage.removeItem('simpes_perpage_tabel_test');
    localStorage.removeItem('simpes_perpage_tabel_lain');
    localStorage.removeItem('simpes_page_tabel_test');
  });
  it('nilai awal: halaman 1, per-page bawaan, belum ready', () => {
    const { result } = renderHook(() => usePager('tabel_test'));

    expect(result.current.page).toBe(1);
    expect(result.current.perPage).toBe(PER_PAGE_DEFAULT);
    expect(result.current.ready).toBe(false);
  });

  it('menandai ready dan memuat simpanan dari pref', async () => {
    localStorage.setItem('simpes_page_tabel_test', '3');
    localStorage.setItem(KUNCI_PERPAGE_GLOBAL, '100');

    const { result } = renderHook(() => usePager('tabel_test'));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.page).toBe(3);
    expect(result.current.perPage).toBe(100);
  });

  it('migrasi sekali-jalan: warisan per-tabel diangkat jadi global', async () => {
    localStorage.setItem('simpes_perpage_tabel_test', '100');

    const { result } = renderHook(() => usePager('tabel_test'));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.perPage).toBe(100);
    expect(localStorage.getItem(KUNCI_PERPAGE_GLOBAL)).toBe('100');
  });

  it.each(['0', '10000'])('memuat pilihan All tersimpan %s sebagai semua data', async (nilai) => {
    localStorage.setItem(KUNCI_PERPAGE_GLOBAL, nilai);
    const { result } = renderHook(() => usePager('tabel_test'));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.perPage).toBe(0);
    act(() => result.current.setPerPage(0));
    await waitFor(() => expect(localStorage.getItem(KUNCI_PERPAGE_GLOBAL)).toBe('0'));
  });

  it('setPage menyimpan pref dan melarangkan nilai di bawah 1', async () => {
    const { result } = renderHook(() => usePager('tabel_test'));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.setPage(7));
    expect(result.current.page).toBe(7);
    await waitFor(() => expect(localStorage.getItem('simpes_page_tabel_test')).toBe('7'));

    act(() => result.current.setPage(-5));
    expect(result.current.page).toBe(1);
  });

  it('setPerPage menyimpan pref global dan mengembalikan halaman ke 1', async () => {
    const { result } = renderHook(() => usePager('tabel_test'));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.setPage(4));
    act(() => result.current.setPerPage(100));

    expect(result.current.perPage).toBe(100);
    expect(result.current.page).toBe(1);
    await waitFor(() => expect(localStorage.getItem(KUNCI_PERPAGE_GLOBAL)).toBe('100'));
  });

  it('setPerPage di satu tabel disiarkan ke tabel lain yang mounted', async () => {
    const satu = renderHook(() => usePager('tabel_test'));
    const lain = renderHook(() => usePager('tabel_lain'));
    await waitFor(() => expect(satu.result.current.ready).toBe(true));
    await waitFor(() => expect(lain.result.current.ready).toBe(true));

    act(() => satu.result.current.setPerPage(100));

    expect(satu.result.current.perPage).toBe(100);
    await waitFor(() => expect(lain.result.current.perPage).toBe(100));
    expect(lain.result.current.page).toBe(1);
  });

  it('goFirst kembali ke halaman 1', async () => {
    const { result } = renderHook(() => usePager('tabel_test'));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.setPage(9));
    expect(result.current.page).toBe(9);

    act(() => result.current.goFirst());
    expect(result.current.page).toBe(1);
  });

  it('sync mengembalikan halaman valid bila halaman sekarang melewati lastPage', async () => {
    const { result } = renderHook(() => usePager('tabel_test'));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.setPage(10));

    // Halaman 10 tak valid (lastPage 3) → dipindah ke 3 dan dikembalikan.
    let koreksi: number | null = null;
    act(() => {
      koreksi = result.current.sync(10, 3);
    });
    expect(koreksi).toBe(3);
    expect(result.current.page).toBe(3);
    await waitFor(() => expect(localStorage.getItem('simpes_page_tabel_test')).toBe('3'));

    // Halaman sudah pas → null (tanpa perubahan).
    act(() => {
      koreksi = result.current.sync(3, 3);
    });
    expect(koreksi).toBeNull();
  });
});

/* Standar server ikut dibaca BERTINGKAT: perangkat menang bila sudah diubah,
   standar mengisi saat belum. Berlaku agar penetapan super_admin tidak
   mengubah perilaku pengguna yang sudah menyetel sendiri. */
describe('usePager — baris per halaman mengikuti standar server', () => {
  beforeEach(() => {
    localStorage.clear();
    standarServer.peta = {};
    standarServer.gagal = false;
  });

  it('memakai standar server saat perangkat belum diubah', async () => {
    standarServer.peta = { baris_per_halaman: 100 };
    const { result } = renderHook(() => usePager('tabel_standar'));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.perPage).toBe(100);
  });

  it('nilai perangkat MENANG atas standar server', async () => {
    localStorage.setItem(KUNCI_PERPAGE_GLOBAL, '10');
    standarServer.peta = { baris_per_halaman: 100 };
    const { result } = renderHook(() => usePager('tabel_menang'));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.perPage).toBe(10);
  });

  it('jatuh ke bawaan saat standar gagal dimuat', async () => {
    standarServer.gagal = true;
    const { result } = renderHook(() => usePager('tabel_gagal'));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.perPage).toBe(PER_PAGE_DEFAULT);
  });
});
