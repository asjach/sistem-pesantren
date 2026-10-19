import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CariGlobalProvider, useCariGlobal } from './useCariGlobal';

const mocks = vi.hoisted(() => ({
  prefGet: vi.fn(async (): Promise<unknown> => undefined),
  prefSet: vi.fn(async () => {}),
}));

vi.mock('@/api/client', () => mocks);

beforeEach(() => {
  mocks.prefGet.mockReset();
  mocks.prefGet.mockResolvedValue(undefined);
  mocks.prefSet.mockReset();
  mocks.prefSet.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCariGlobal', () => {
  it('tanpa provider memberi nilai kosong dan ubah yang aman', () => {
    const { result } = renderHook(() => useCariGlobal());

    expect(result.current.nilai).toBe('');
    expect(() => result.current.ubah('budi')).not.toThrow();
  });

  it('provider memulihkan nilai tersimpan', async () => {
    mocks.prefGet.mockResolvedValue('lama');

    const { result } = renderHook(() => useCariGlobal(), { wrapper: CariGlobalProvider });

    await waitFor(() => expect(result.current.nilai).toBe('lama'));
  });

  it('perubahan ditulis setelah jeda 500 ms dan hanya nilai terakhir', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCariGlobal(), { wrapper: CariGlobalProvider });

    act(() => result.current.ubah('bu'));
    act(() => result.current.ubah('budi'));

    await act(async () => { await vi.advanceTimersByTimeAsync(499); });
    expect(mocks.prefSet).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(mocks.prefSet).toHaveBeenCalledWith('simpes_cari_global', 'budi');
  });

  it('unmount membatalkan penulisan yang masih tertunda', async () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useCariGlobal(), { wrapper: CariGlobalProvider });

    act(() => result.current.ubah('budi'));
    unmount();
    await vi.advanceTimersByTimeAsync(600);

    expect(mocks.prefSet).not.toHaveBeenCalled();
  });
});
