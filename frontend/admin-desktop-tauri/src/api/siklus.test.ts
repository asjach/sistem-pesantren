import { beforeEach, describe, expect, it, vi } from 'vitest';

import { batalSalinMassal, listMiMd, listRiwayatBelajar, naikKelasOtomatis, salinGenapMassal } from './siklus';

const mocks = vi.hoisted(() => ({ api: vi.fn(), downloadFile: vi.fn() }));
vi.mock('./client', () => mocks);

beforeEach(() => {
  mocks.api.mockReset();
  mocks.api.mockResolvedValue({});
});

const url = (call = 0) => mocks.api.mock.calls[call][0] as string;
const body = (call = 0) => JSON.parse(mocks.api.mock.calls[call][1]?.body ?? '{}') as Record<string, unknown>;

describe('siklus', () => {
  it('listMiMd tanpa filter tidak menambah query', () => {
    void listMiMd();

    expect(url()).toBe('/admin/mi-md');
  });

  it('listMiMd menulis array filter sebagai kunci[]', () => {
    void listMiMd({ jenjang: ['MI', 'MD'], kelas_id: [1, 2] });

    expect(url()).toBe('/admin/mi-md?jenjang%5B%5D=MI&jenjang%5B%5D=MD&kelas_id%5B%5D=1&kelas_id%5B%5D=2');
  });

  it('listRiwayatBelajar menormalkan boolean aktif dan mempertahankan paginasi', () => {
    void listRiwayatBelajar({ is_active_riwayat: true, keaktifan: 'aktif', page: 2, per_page: 20 });

    const q = new URLSearchParams(url().split('?')[1]);
    expect(q.get('is_active_riwayat')).toBe('1');
    expect(q.get('keaktifan')).toBe('aktif');
    expect(q.get('page')).toBe('2');
    expect(q.get('per_page')).toBe('20');
  });

  it('listRiwayatBelajar membedakan false dan semua', () => {
    void listRiwayatBelajar({ is_active_riwayat: false });
    void listRiwayatBelajar({ is_active_riwayat: 'semua' });

    expect(new URLSearchParams(url(0).split('?')[1]).get('is_active_riwayat')).toBe('0');
    expect(new URLSearchParams(url(1).split('?')[1]).get('is_active_riwayat')).toBe('semua');
  });

  it('aksi massal mengirim payload apa adanya', () => {
    void salinGenapMassal({ jenjang: 'MI', tanggal_masuk: '2026-07-01' });
    void batalSalinMassal({ jenjang: 'MI', tahun_ajaran: '2026/2027' });
    void naikKelasOtomatis({ jenjang: 'MI', siswa: [{ santri_id: 1, status: 'naik', tgl_masuk: '2026-07-01' }] });

    expect(body(0)).toEqual({ jenjang: 'MI', tanggal_masuk: '2026-07-01' });
    expect(body(1)).toEqual({ jenjang: 'MI', tahun_ajaran: '2026/2027' });
    expect(body(2)).toEqual({ jenjang: 'MI', siswa: [{ santri_id: 1, status: 'naik', tgl_masuk: '2026-07-01' }] });
  });
});
