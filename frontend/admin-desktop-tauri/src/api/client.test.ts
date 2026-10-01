import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, downloadFile, errorMessage } from './client';

const saveMock = vi.fn(async (_opsi: unknown): Promise<string | null> => '/tmp/unduhan/template.xlsx');
const writeMock = vi.fn(async (_tujuan: string, _data: Uint8Array): Promise<void> => {});
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: (o: unknown) => saveMock(o) }));
vi.mock('@tauri-apps/plugin-fs', () => ({ writeFile: (p: string, d: Uint8Array) => writeMock(p, d) }));

function galat(status: number, body: unknown): ApiError {
  return new ApiError(status, body);
}

describe('errorMessage', () => {
  it('mengutamakan pesan aplikasi karena sudah berbahasa Indonesia', () => {
    expect(
      errorMessage(galat(422, { pesan: 'Aset masih dipakai oleh 2 medan pada template. Hapus medannya lebih dulu.' })),
    ).toBe('Aset masih dipakai oleh 2 medan pada template. Hapus medannya lebih dulu.');
  });

  it('memakai message bawaan Laravel bila pesan tidak ada', () => {
    expect(errorMessage(galat(422, { message: 'The nama field is required.', errors: { nama: ['wajib'] } }))).toBe(
      'The nama field is required.',
    );
  });

  it('memakai pesan bawaan untuk status lain', () => {
    expect(errorMessage(galat(403, { pesan: 'Akses ditolak.' }))).toBe('Akses ditolak.');
  });

  it('memberi teks cadangan yang mengarahkan saat badan tidak punya pesan', () => {
    expect(errorMessage(galat(422, { errors: { nama: ['wajib'] } }))).toBe('Validasi gagal. Periksa isian.');
    expect(errorMessage(galat(0, {}))).toBe('Tidak dapat menghubungi server.');
    expect(errorMessage(galat(401, {}))).toContain('Kredensial');
    expect(errorMessage(galat(403, {}))).toContain('Akses ditolak');
  });

  it('mengabaikan pesan kosong agar tidak menampilkan ruang kosong', () => {
    expect(errorMessage(galat(422, { pesan: '', message: 'Cadangan' }))).toBe('Cadangan');
    expect(errorMessage(galat(422, { pesan: '   ' }))).toBe('Validasi gagal. Periksa isian.');
  });

  it('menangani galat yang bukan ApiError', () => {
    expect(errorMessage(new Error('jaringan putus'))).toBe('jaringan putus');
    // String (mis. galat IPC Tauri) ditampilkan apa adanya.
    expect(errorMessage('entah')).toBe('entah');
    expect(errorMessage('   ')).toBe('Gagal terhubung ke server.');
    expect(errorMessage(undefined)).toBe('Gagal terhubung ke server.');
  });
});

describe('downloadFile', () => {
  const asliFetch = globalThis.fetch;

  beforeEach(() => {
    saveMock.mockClear();
    writeMock.mockClear();
    const kepala = new Headers({ 'Content-Disposition': 'attachment; filename="template-import-dokumen-santri.xlsx"' });
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: kepala,
      blob: async () => ({ arrayBuffer: async () => new TextEncoder().encode('isi').buffer }),
    })) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = asliFetch;
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  it('di desktop Tauri memakai dialog simpan native, bukan anchor blob', async () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};

    await downloadFile('/admin/dokumen/santri/import-template', 'jatuh.xlsx');

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledWith({ defaultPath: 'template-import-dokumen-santri.xlsx' });
    expect(writeMock).toHaveBeenCalledTimes(1);
    const [tujuan, data] = writeMock.mock.calls[0] as [string, Uint8Array];
    expect(tujuan).toBe('/tmp/unduhan/template.xlsx');
    expect(data).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(data)).toBe('isi');
  });

  it('batal di dialog simpan = diam tanpa menulis berkas', async () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    saveMock.mockResolvedValueOnce(null);

    await downloadFile('/admin/dokumen/santri/import-template', 'jatuh.xlsx');

    expect(writeMock).not.toHaveBeenCalled();
  });
});
