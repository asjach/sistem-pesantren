import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { usePager } from '@/hooks/usePager';
import { PER_PAGE_DEFAULT } from '@/prefs';

describe('usePager', () => {
  it('nilai awal: halaman 1, per-page bawaan, belum ready', () => {
    const { result } = renderHook(() => usePager('tabel_test'));

    expect(result.current.page).toBe(1);
    expect(result.current.perPage).toBe(PER_PAGE_DEFAULT);
    expect(result.current.ready).toBe(false);
  });

  it('menandai ready dan memuat simpanan dari pref', async () => {
    localStorage.setItem('simpes_page_tabel_test', '3');
    localStorage.setItem('simpes_perpage_tabel_test', '100');

    const { result } = renderHook(() => usePager('tabel_test'));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.page).toBe(3);
    expect(result.current.perPage).toBe(100);
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

  it('setPerPage menyimpan pref dan mengembalikan halaman ke 1', async () => {
    const { result } = renderHook(() => usePager('tabel_test'));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.setPage(4));
    act(() => result.current.setPerPage(100));

    expect(result.current.perPage).toBe(100);
    expect(result.current.page).toBe(1);
    await waitFor(() => expect(localStorage.getItem('simpes_perpage_tabel_test')).toBe('100'));
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
