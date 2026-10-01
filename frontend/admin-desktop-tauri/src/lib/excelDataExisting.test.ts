import { afterEach, describe, expect, it, vi } from 'vitest';

import { unduhExcelDataExisting } from './excelDataExisting';

const saveMock = vi.fn(async (_opsi: unknown): Promise<string | null> => '/tmp/unduhan/data.xlsx');
const writeMock = vi.fn(async (_tujuan: string, _data: Uint8Array): Promise<void> => {});
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: (o: unknown) => saveMock(o) }));
vi.mock('@tauri-apps/plugin-fs', () => ({ writeFile: (p: string, d: Uint8Array) => writeMock(p, d) }));

describe('unduhExcelDataExisting', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  it('di desktop Tauri menyimpan via dialog native dengan nama yang diminta', async () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    saveMock.mockClear();
    writeMock.mockClear();

    await unduhExcelDataExisting(
      { kolom: ['nis_lokal', 'jenjang'], wajib: ['nis_lokal'], baris: [['26001', 'MI']] },
      'data-dokumen-santri-existing.xlsx',
      'Data Dokumen',
    );

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledWith({ defaultPath: 'data-dokumen-santri-existing.xlsx' });
    expect(writeMock).toHaveBeenCalledTimes(1);
    const [tujuan, data] = writeMock.mock.calls[0] as [string, Uint8Array];
    expect(tujuan).toBe('/tmp/unduhan/data.xlsx');
    // Berkas .xlsx = arsip ZIP (tanda tangan PK).
    expect(data[0]).toBe(0x50);
    expect(data[1]).toBe(0x4b);
  });

  it('batal di dialog simpan = diam tanpa menulis berkas', async () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    saveMock.mockClear();
    writeMock.mockClear();
    saveMock.mockResolvedValueOnce(null);

    await unduhExcelDataExisting(
      { kolom: ['jenjang'], wajib: [], baris: [] },
      'data.xlsx',
    );

    expect(writeMock).not.toHaveBeenCalled();
  });
});
