import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ambilByteDokumen,
  izinDokumen,
  listDokumen,
  simpanDokumen,
  sinkronUnggahDokumen,
  statusBerkasDokumen,
  tandaiSinkronDokumen,
} from './dokumen';

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  apiUpload: vi.fn(),
  downloadFile: vi.fn(),
  ambilBerkas: vi.fn(),
}));
vi.mock('./client', () => mocks);

beforeEach(() => {
  mocks.api.mockReset();
  mocks.api.mockResolvedValue({});
  mocks.apiUpload.mockReset();
  mocks.apiUpload.mockResolvedValue({});
  mocks.ambilBerkas.mockReset();
  mocks.ambilBerkas.mockResolvedValue(new ArrayBuffer(3));
});

describe('dokumen', () => {
  it('izinDokumen memetakan izin per tipe pemilik', () => {
    expect(izinDokumen('santri')).toEqual({
      lihat: 'dokumen_santri.lihat',
      tambah: 'dokumen_santri.tambah',
      ubah: 'dokumen_santri.ubah',
      hapus: 'dokumen_santri.hapus',
    });
    expect(izinDokumen('pegawai').lihat).toBe('dokumen_pegawai.lihat');
  });

  it('listDokumen memakai per_page 50 dan tetap mengirim id 0', () => {
    void listDokumen('santri', { jenjang: ['MI'], santri_id: 0 });

    const q = new URLSearchParams(mocks.api.mock.calls[0][0].split('?')[1]);
    expect(q.get('jenjang[]')).toBe('MI');
    expect(q.get('santri_id')).toBe('0');
    expect(q.get('per_page')).toBe('50');
  });

  it('simpanDokumen tanpa file memakai JSON', () => {
    void simpanDokumen('lembaga', { jenis_dokumen: 'izin', catatan: 'x' });

    expect(mocks.api.mock.calls[0][0]).toBe('/admin/dokumen/lembaga');
    expect(mocks.api.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(mocks.api.mock.calls[0][1].body)).toEqual({ jenis_dokumen: 'izin', catatan: 'x' });
  });

  it('simpanDokumen dengan file memakai FormData dan membuang nilai kosong', () => {
    const file = new File(['x'], 'izin.pdf', { type: 'application/pdf' });
    void simpanDokumen('lembaga', { jenis_dokumen: 'izin', catatan: null, kosong: undefined }, file);

    const fd = mocks.apiUpload.mock.calls[0][1] as FormData;
    expect(mocks.apiUpload.mock.calls[0][0]).toBe('/admin/dokumen/lembaga');
    expect(fd.get('jenis_dokumen')).toBe('izin');
    expect(fd.has('catatan')).toBe(false);
    expect(fd.has('kosong')).toBe(false);
    expect(fd.get('file')).toBe(file);
  });

  it('statusBerkasDokumen mengirim nama[] berulang', () => {
    void statusBerkasDokumen('santri', ['a.pdf', 'b.pdf']);

    expect(mocks.api.mock.calls[0][0]).toBe('/admin/dokumen/santri/status-berkas?nama%5B%5D=a.pdf&nama%5B%5D=b.pdf');
  });

  it('sinkron unggah dan tandai memakai kontrak masing-masing', () => {
    const file = new File(['x'], 'a.pdf');
    void sinkronUnggahDokumen('pegawai', 2, file, 'abc', 1234);
    void tandaiSinkronDokumen('pegawai', 2, 'abc');

    const fd = mocks.apiUpload.mock.calls[0][1] as FormData;
    expect(fd.get('file')).toBe(file);
    expect(fd.get('hash')).toBe('abc');
    expect(fd.get('mtime')).toBe('1234');
    expect(mocks.api.mock.calls[0][0]).toBe('/admin/dokumen/pegawai/2/tandai-sinkron');
    expect(mocks.api.mock.calls[0][1]).toEqual({ method: 'PATCH', body: JSON.stringify({ hash: 'abc' }) });
  });

  it('ambilByteDokumen mengembalikan byte', async () => {
    const hasil = await ambilByteDokumen('lembaga', 5);

    expect(mocks.ambilBerkas).toHaveBeenCalledWith('/admin/dokumen/lembaga/5/unduh');
    expect(hasil).toHaveLength(3);
  });
});
