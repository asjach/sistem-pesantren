import { renderHook, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExcelField } from './types';
import { useAntreanSimpan } from './useAntreanSimpan';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

type Baris = { id: number };

function pasang(
  autoDrain: boolean,
  fields: ExcelField[] = [],
  onInvalid?: (info: { id: string | number; key: string; pesan: string }) => void,
) {
  const baris: Baris[] = [{ id: 1 }];
  const onCommit = vi.fn<(id: number, fields: Record<string, string | null>) => Promise<void>>(
    async () => {},
  );
  const onSaved = vi.fn(async () => {});
  const dropDraft = vi.fn();

  const { result } = renderHook(() => useAntreanSimpan<Baris>({
    rowsRef: { current: baris },
    fieldsRef: { current: fields },
    onCommitRef: { current: onCommit },
    onSavedRef: { current: onSaved },
    dropDraftRef: { current: dropDraft },
    onInvalidRef: { current: onInvalid },
    autoDrain,
  }));

  return { result, onCommit, onSaved, dropDraft, onInvalid };
}

describe('useAntreanSimpan', () => {
  beforeEach(() => { vi.clearAllMocks(); });

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

  it('menolak nilai tidak valid saat enqueue tanpa menunggu flush', async () => {
    const fields: ExcelField[] = [{
      key: 'm1', label: 'M1', kind: 'text',
      validate: (nilai) => nilai === '101' ? 'Nilai harus 0–100.' : null,
    }];
    const { result, onCommit, dropDraft } = pasang(false, fields);

    result.current.enqueueSave('1', { m1: '101' });

    expect(onCommit).not.toHaveBeenCalled();
    expect(dropDraft).toHaveBeenCalledWith('1', ['m1']);
    expect(toast.error).toHaveBeenCalledWith('Nilai harus 0–100.');

    await result.current.flush();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('melewati sel tidak valid dan tetap menyimpan sel valid', async () => {
    const fields: ExcelField[] = [
      { key: 'm1', label: 'M1', kind: 'text' },
      {
        key: 'm2', label: 'M2', kind: 'text',
        validate: (nilai) => nilai === '101' ? 'Nilai harus 0–100.' : null,
      },
    ];
    const onInvalid = vi.fn();
    const { result, onCommit, dropDraft } = pasang(true, fields, onInvalid);

    result.current.enqueueSave('1', { m1: '80', m2: '101' });

    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(1, { m1: '80' }));
    expect(onInvalid).toHaveBeenCalledWith({ id: 1, key: 'm2', pesan: 'Nilai harus 0–100.' });
    expect(dropDraft).toHaveBeenCalledWith('1', ['m2']);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('langsung menyimpan saat autoDrain bawaan', async () => {
    const { result, onCommit } = pasang(true);

    result.current.enqueueSave('1', { m1: '80' });

    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(1, { m1: '80' }));
  });
});
