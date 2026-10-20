import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ExcelField } from './types';
import { useAntreanSimpan } from './useAntreanSimpan';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

type Baris = { id: number };

function pasang(autoDrain: boolean) {
  const baris: Baris[] = [{ id: 1 }];
  const onCommit = vi.fn<(id: number, fields: Record<string, string | null>) => Promise<void>>(
    async () => {},
  );
  const onSaved = vi.fn(async () => {});
  const dropDraft = vi.fn();

  const { result } = renderHook(() => useAntreanSimpan<Baris>({
    rowsRef: { current: baris },
    fieldsRef: { current: [] as ExcelField[] },
    onCommitRef: { current: onCommit },
    onSavedRef: { current: onSaved },
    dropDraftRef: { current: dropDraft },
    autoDrain,
  }));

  return { result, onCommit, onSaved, dropDraft };
}

describe('useAntreanSimpan', () => {
  it('menahan perubahan sampai flush saat autoDrain false', async () => {
    const { result, onCommit, onSaved } = pasang(false);

    result.current.enqueueSave('1', { m1: '80' });
    result.current.enqueueSave('1', { m2: '90' });

    expect(onCommit).not.toHaveBeenCalled();

    await result.current.flush();

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(1, { m1: '80', m2: '90' });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('langsung menyimpan saat autoDrain bawaan', async () => {
    const { result, onCommit } = pasang(true);

    result.current.enqueueSave('1', { m1: '80' });

    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(1, { m1: '80' }));
  });
});
