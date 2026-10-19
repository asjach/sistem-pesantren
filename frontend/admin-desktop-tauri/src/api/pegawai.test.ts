import { beforeEach, describe, expect, it, vi } from 'vitest';

import { aktifkanMassalKeaktifan, generateAkunPegawai, listPenempatanPegawai, uploadFotoPegawai } from './pegawai';

const mocks = vi.hoisted(() => ({ api: vi.fn(), apiUpload: vi.fn(), downloadFile: vi.fn() }));
vi.mock('./client', () => mocks);

beforeEach(() => {
  mocks.api.mockReset();
  mocks.api.mockResolvedValue({});
  mocks.apiUpload.mockReset();
  mocks.apiUpload.mockResolvedValue({});
});

describe('pegawai', () => {
  it('listPenempatanPegawai memakai per_page 50 dan menormalkan boolean aktif', () => {
    void listPenempatanPegawai({ is_active_lembaga: false, jenjang: ['MI', 'MD'] });

    const q = new URLSearchParams(mocks.api.mock.calls[0][0].split('?')[1]);
    expect(q.get('jenjang[]')).toBe('MI');
    expect(q.get('is_active_lembaga')).toBe('0');
    expect(q.get('per_page')).toBe('50');
  });

  it('generateAkunPegawai hanya menambah query yang diisi', () => {
    void generateAkunPegawai();
    void generateAkunPegawai({ q: 'budi', status_aktif: 'Ya' });

    expect(mocks.api.mock.calls[0][0]).toBe('/admin/pegawai/generate-akun');
    expect(mocks.api.mock.calls[1][0]).toBe('/admin/pegawai/generate-akun?q=budi&status_aktif=Ya');
  });

  it('aktifkanMassalKeaktifan mengirim lingkup dan daftar pegawai', () => {
    void aktifkanMassalKeaktifan({ jenjang: 'MI', tahun_ajaran: '2026/2027', pegawai_id: [1, 2] });

    expect(JSON.parse(mocks.api.mock.calls[0][1].body)).toEqual({
      jenjang: 'MI',
      tahun_ajaran: '2026/2027',
      pegawai_id: [1, 2],
    });
  });

  it('uploadFotoPegawai memakai FormData dengan kunci foto', () => {
    const file = new File(['x'], 'foto.png', { type: 'image/png' });
    void uploadFotoPegawai(7, file);

    const fd = mocks.apiUpload.mock.calls[0][1] as FormData;
    expect(mocks.apiUpload.mock.calls[0][0]).toBe('/admin/pegawai/7/foto');
    expect(fd.get('foto')).toBe(file);
  });
});
