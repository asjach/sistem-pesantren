import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { copyText } from '@/lib/clipboard';
import { useSalinTabel } from './useSalinTabel';
import type { ExcelField, GridRow, GridSelection } from './types';

vi.mock('@/lib/clipboard', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/lib/clipboard')>();
  return { ...asli, copyText: vi.fn(async () => true) };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

interface Baris {
  id: number;
  nama: string | null;
  kode: string | null;
}

const fields = [
  { key: 'nama', label: 'Nama' },
  { key: 'kode', label: 'Kode' },
] as ExcelField[];

const baris: Baris[] = [
  { id: 1, nama: 'Ahmad', kode: 'P001' },
  { id: 2, nama: 'Budi', kode: 'P002' },
];

const grid: GridRow[] = baris.map((r) => ({ id: r.id, checked: false, nama: r.nama, kode: r.kode }));

function pasang(range: GridSelection | null, checked: (string | number)[] = []) {
  return renderHook(() => useSalinTabel<Baris>({
    hideCheckbox: false,
    hideActions: true,
    visibleFieldsRef: { current: fields },
    fieldsRef: { current: fields },
    rowsRef: { current: baris },
    gridValueRef: { current: grid },
    gridByIdRef: { current: new Map(grid.map((g) => [String(g.id), g])) },
    checkedIdsRef: { current: new Set<Baris['id']>(checked as Baris['id'][]) },
    rangeRef: { current: range },
    attrByKey: new Map(),
    labelKolom: (key, bawaan) => bawaan,
  }));
}

const salin = () => vi.mocked(copyText);

describe('salinFisik (intersepsi Ctrl+C desktop)', () => {
  beforeEach(() => {
    salin().mockClear();
    salin().mockResolvedValue(true);
  });

  it('baris tercentang menang di atas blok', async () => {
    const { result } = pasang({ min: { row: 1, col: 1 }, max: { row: 1, col: 2 } }, [2]);
    await expect(result.current.salinFisik()).resolves.toBe(true);
    expect(salin()).toHaveBeenCalledWith('Nama\tKode\nBudi\tP002');
  });

  it('blok multi-sel sebagai TSV subset', async () => {
    // Kolom 1..2 = nama..kode (kolom 0 = centang, dilewati).
    const { result } = pasang({ min: { row: 0, col: 1 }, max: { row: 1, col: 2 } });
    await expect(result.current.salinFisik()).resolves.toBe(true);
    expect(salin()).toHaveBeenCalledWith('Nama\tKode\nAhmad\tP001\nBudi\tP002');
  });

  it('sel tunggal tanpa header', async () => {
    const { result } = pasang({ min: { row: 0, col: 1 }, max: { row: 0, col: 1 } });
    await expect(result.current.salinFisik()).resolves.toBe(true);
    expect(salin()).toHaveBeenCalledWith('Ahmad');
  });

  it('tanpa seleksi: false dan tidak menulis', async () => {
    const { result } = pasang(null);
    await expect(result.current.salinFisik()).resolves.toBe(false);
    expect(salin()).not.toHaveBeenCalled();
  });

  it('blok hanya kolom centang: false dan tidak menulis', async () => {
    const { result } = pasang({ min: { row: 0, col: 0 }, max: { row: 1, col: 0 } });
    await expect(result.current.salinFisik()).resolves.toBe(false);
    expect(salin()).not.toHaveBeenCalled();
  });

  it('onCopy lama tetap: baris tercentang sebagai TSV', async () => {
    const { result } = pasang(null, [1, 2]);
    await result.current.onCopy();
    expect(salin()).toHaveBeenCalledWith('Nama\tKode\nAhmad\tP001\nBudi\tP002');
  });
});

describe('teksSalinan (pratinjau sinkron Ctrl+C desktop)', () => {
  it('baris tercentang sebagai TSV', () => {
    const { result } = pasang({ min: { row: 1, col: 1 }, max: { row: 1, col: 2 } }, [2]);
    expect(result.current.teksSalinan()).toBe('Nama\tKode\nBudi\tP002');
  });

  it('sel tunggal tanpa header', () => {
    const { result } = pasang({ min: { row: 0, col: 1 }, max: { row: 0, col: 1 } });
    expect(result.current.teksSalinan()).toBe('Ahmad');
  });

  it('tanpa seleksi: null', () => {
    const { result } = pasang(null);
    expect(result.current.teksSalinan()).toBeNull();
  });
});
