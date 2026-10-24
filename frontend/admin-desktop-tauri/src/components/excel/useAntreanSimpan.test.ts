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
  pertahankanGagal = false,
  baris: Baris[] = [{ id: 1 }],
) {
  const onCommit = vi.fn<(id: number, fields: Record<string, string | null>) => Promise<void>>(
    async () => {},
  );
  const onSaved = vi.fn(async () => {});
  const dropDraft = vi.fn();
  const onCommitRef = { current: onCommit };

  const { result } = renderHook(() => useAntreanSimpan<Baris>({
    rowsRef: { current: baris },
    fieldsRef: { current: fields },
    onCommitRef,
    onSavedRef: { current: onSaved },
    dropDraftRef: { current: dropDraft },
    onInvalidRef: { current: onInvalid },
    autoDrain,
    pertahankanGagal,
  }));

  return { result, onCommit, onCommitRef, onSaved, dropDraft, onInvalid };
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

  it('membekukan callback commit saat edit diantrekan', async () => {
    const { result, onCommit, onCommitRef } = pasang(false);
    const konteksLain = vi.fn(async () => {});

    result.current.enqueueSave('1', { m1: '80' });
    onCommitRef.current = konteksLain;

    await result.current.flush();

    expect(onCommit).toHaveBeenCalledWith(1, { m1: '80' });
    expect(konteksLain).not.toHaveBeenCalled();
  });

  it('mempertahankan draft gagal dan hanya mengulang baris yang gagal', async () => {
    const baris: Baris[] = [{ id: 1 }, { id: 2 }];
    const { result, onCommit, dropDraft } = pasang(false, [], undefined, true, baris);
    let gagalSekali = true;
    onCommit.mockImplementation(async (id) => {
      if (id === 2 && gagalSekali) {
        gagalSekali = false;
        throw new Error('jaringan');
      }
    });

    result.current.enqueueSave('1', { m1: '80' });
    result.current.enqueueSave('2', { m1: '90' });

    const pertama = await result.current.flush();
    expect(pertama).toMatchObject({ sukses: false, tersimpan: 1, gagal: 1 });
    expect(dropDraft).toHaveBeenCalledWith('1', ['m1']);
    expect(dropDraft).not.toHaveBeenCalledWith('2', ['m1']);

    const kedua = await result.current.flush();
    expect(kedua).toMatchObject({ sukses: true, tersimpan: 1, gagal: 0 });
    expect(onCommit).toHaveBeenCalledTimes(3);
    expect(dropDraft).toHaveBeenCalledWith('2', ['m1']);
  });

  it('membuang antrean yang belum disimpan', async () => {
    const { result, onCommit } = pasang(false);

    result.current.enqueueSave('1', { m1: '80' });
    result.current.batalkanAntrean();
    await result.current.flush();

    expect(onCommit).not.toHaveBeenCalled();
  });
});
