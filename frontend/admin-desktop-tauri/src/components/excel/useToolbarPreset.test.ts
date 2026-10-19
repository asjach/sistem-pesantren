import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useToolbarPresetState } from './useToolbarPreset';

/** tiruan server stateful: simpan benar-benar mengubah yang dibaca muat. */
const server = vi.hoisted(() => {
  const state = {
    align: { nama: 'left' } as Record<string, string>,
    visibilitas: {} as Record<string, boolean>,
  };
  const muat = vi.fn(async () => ({
    pesan: 'ok',
    data: {
      table_key: 'uji',
      visibilitas: { ...state.visibilitas },
      lebar: {},
      urutan: [],
      align: { ...state.align },
    },
  }));

  const simpan = vi.fn(
    async (_t: string, v?: Record<string, boolean>, _u?: unknown, a?: Record<string, string>) => {

      if (v !== undefined) state.visibilitas = { ...v };
      if (a !== undefined) state.align = { ...a };
      return { pesan: 'ok', data: null };
    },
  );
  return { state, muat, simpan };
});

vi.mock('@/api/toolbarPreset', () => ({
  muatToolbarPreset: server.muat,
  simpanToolbarPreset: server.simpan,
}));

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => toastError(...args), success: vi.fn() },
}));

beforeEach(() => {
  server.state.align = { nama: 'left' };
  server.state.visibilitas = {};
  vi.clearAllMocks();
});

describe('useToolbarPresetState.simpanAlign — klik-kanan tulis DB global', () => {
  it('memuat alignDb dari server saat mount', async () => {
    const { result } = renderHook(() => useToolbarPresetState('uji'));

    await waitFor(() => expect(result.current.alignDb).toEqual({ nama: 'left' }));
  });

  it('optimistis + kirim peta gabungan penuh lalu konvergen', async () => {
    const { result } = renderHook(() => useToolbarPresetState('uji'));
    await waitFor(() => expect(server.muat).toHaveBeenCalled());

    act(() => {
      result.current.simpanAlign('kode', 'right');
    });

    expect(result.current.alignDb).toEqual({ nama: 'left', kode: 'right' });

    await waitFor(() => expect(server.simpan).toHaveBeenCalledWith(
      'uji', undefined, undefined, { nama: 'left', kode: 'right' },
    ));

    await waitFor(() => expect(server.muat.mock.calls.length).toBeGreaterThan(1));
    expect(result.current.alignDb).toEqual({ nama: 'left', kode: 'right' });
    expect(server.state.align).toEqual({ nama: 'left', kode: 'right' });
  });

  it('gagal simpan → rollback + toast galat', async () => {
    server.simpan.mockRejectedValueOnce(new Error('koneksi putus'));
    const { result } = renderHook(() => useToolbarPresetState('uji'));
    await waitFor(() => expect(server.muat).toHaveBeenCalled());

    act(() => {
      result.current.simpanAlign('kode', 'right');
    });
    expect(result.current.alignDb).toEqual({ nama: 'left', kode: 'right' });

    await waitFor(() => expect(toastError).toHaveBeenCalled());

    expect(result.current.alignDb).toEqual({ nama: 'left' });
  });

  it('klik cepat beruntun: tulis terakhir yang menang', async () => {
    const { result } = renderHook(() => useToolbarPresetState('uji'));
    await waitFor(() => expect(server.muat).toHaveBeenCalled());

    act(() => {
      result.current.simpanAlign('kode', 'left');
      result.current.simpanAlign('kode', 'right');
    });

    await waitFor(() => expect(server.simpan).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.alignDb).toEqual({ nama: 'left', kode: 'right' }));
    expect(server.state.align).toEqual({ nama: 'left', kode: 'right' });
  });
});

describe('useToolbarPresetState — visibilitas filter toolbar', () => {
  it('memuat visibilitas dari server (absen = tampil)', async () => {
    server.state.visibilitas = { urutan: false, kolom: true };
    const { result } = renderHook(() => useToolbarPresetState('uji'));

    await waitFor(() => expect(server.muat).toHaveBeenCalled());
    expect(result.current.visibilitas).toEqual({ urutan: false, kolom: true });
  });

  it('peta rusak (kunci/k nilai tak sah) dibersihkan saat dibaca', async () => {
    server.state.visibilitas = {
      urutan: false,
      'Kunci-Salah': false,
      kolom: 'ya' as unknown as boolean,
      cari: false,
    };
    const { result } = renderHook(() => useToolbarPresetState('uji'));

    await waitFor(() => expect(server.muat).toHaveBeenCalled());
    expect(result.current.visibilitas).toEqual({ urutan: false, cari: false });
  });

  it('gagal muat → peta kosong (semua filter tampil = bawaan)', async () => {
    server.muat.mockRejectedValueOnce(new Error('koneksi putus'));
    const { result } = renderHook(() => useToolbarPresetState('uji'));

    await waitFor(() => expect(result.current.alignDb).toEqual({}));
    expect(result.current.visibilitas).toEqual({});
  });
});
