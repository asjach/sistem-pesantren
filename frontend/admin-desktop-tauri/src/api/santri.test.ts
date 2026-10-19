import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ambilFotoProfilSantri, createLembagaSantri, listSantri, uploadDokumenSantri, uploadFotoSantri } from './santri';

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
  mocks.ambilBerkas.mockResolvedValue(new ArrayBuffer(2));
});

const url = () => mocks.api.mock.calls[0][0] as string;

describe('santri', () => {
  it('listSantri mengirim keaktifan eksplisit dan filter array', () => {
    void listSantri({ is_active_pst: 'semua', jenjang: ['MI', 'MD'], page: 2 });

    const q = new URLSearchParams(url().split('?')[1]);
    expect(q.get('is_active_pst')).toBe('semua');
    expect(q.get('jenjang[]')).toBe('MI');
    expect(q.get('page')).toBe('2');
    expect(q.has('per_page')).toBe(false);
  });

  it('listSantri menormalkan boolean keaktifan ke 1 dan 0', () => {
    void listSantri({ is_active_pst: true });
    void listSantri({ is_active_pst: false });

    expect(new URLSearchParams(url().split('?')[1]).get('is_active_pst')).toBe('1');
    expect(new URLSearchParams(mocks.api.mock.calls[1][0].split('?')[1]).get('is_active_pst')).toBe('0');
  });

  it('uploadFotoSantri dan uploadDokumenSantri memakai FormData', () => {
    const foto = new File(['f'], 'foto.png', { type: 'image/png' });
    const dok = new File(['d'], 'dok.pdf', { type: 'application/pdf' });

    void uploadFotoSantri(9, foto);
    void uploadDokumenSantri(9, { jenis_dokumen_santri: 'kk', file: dok, catatan: 'asli' });

    const fdFoto = mocks.apiUpload.mock.calls[0][1] as FormData;
    const fdDok = mocks.apiUpload.mock.calls[1][1] as FormData;
    expect(fdFoto.get('foto')).toBe(foto);
    expect(fdDok.get('jenis_dokumen_santri')).toBe('kk');
    expect(fdDok.get('file')).toBe(dok);
    expect(fdDok.get('catatan')).toBe('asli');
  });

  it('uploadDokumenSantri tidak mengirim catatan kosong', () => {
    void uploadDokumenSantri(9, { jenis_dokumen_santri: 'kk', file: new File(['d'], 'd.pdf') });

    const fd = mocks.apiUpload.mock.calls[0][1] as FormData;
    expect(fd.has('catatan')).toBe(false);
  });

  it('ambilFotoProfilSantri mengembalikan byte', async () => {
    const hasil = await ambilFotoProfilSantri(9);

    expect(mocks.ambilBerkas).toHaveBeenCalledWith('/admin/santri/9/foto');
    expect(hasil).toBeInstanceOf(Uint8Array);
    expect(hasil).toHaveLength(2);
  });

  it('createLembagaSantri mengirim identitas keanggotaan apa adanya', () => {
    void createLembagaSantri(9, { jenjang: 'MI', nis_lokal: '001', is_active_lembaga: 'Ya' });

    expect(mocks.api.mock.calls[0][0]).toBe('/admin/santri/9/lembaga');
    expect(JSON.parse(mocks.api.mock.calls[0][1].body)).toEqual({ jenjang: 'MI', nis_lokal: '001', is_active_lembaga: 'Ya' });
  });
});
