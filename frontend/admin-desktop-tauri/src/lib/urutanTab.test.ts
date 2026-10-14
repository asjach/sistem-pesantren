import { describe, expect, it } from 'vitest';

import { susunTab } from './urutanTab';
import type { TabHalamanDef } from './halaman';

const tab = (to: string, label = to): TabHalamanDef => ({ to, label, permission: 'x.lihat' });

const KODE = [tab('/a'), tab('/b'), tab('/c'), tab('/d')];

describe('susunTab', () => {
  it('tanpa setelan tersimpan memakai urutan kode apa adanya', () => {
    const { tampil, sembunyi } = susunTab(KODE, [], []);
    expect(tampil.map((t) => t.to)).toEqual(['/a', '/b', '/c', '/d']);
    expect(sembunyi).toEqual([]);
  });

  it('menerapkan urutan tersimpan', () => {
    const { tampil } = susunTab(KODE, ['/c', '/a', '/d', '/b'], []);
    expect(tampil.map((t) => t.to)).toEqual(['/c', '/a', '/d', '/b']);
  });

  it('TIDAK menghilangkan tab baru dari kode — diletakkan setelah yang diatur', () => {
    const { tampil } = susunTab(KODE, ['/c', '/a'], []);
    expect(tampil.map((t) => t.to)).toEqual(['/c', '/a', '/b', '/d']);
  });

  it('membuang rute tersimpan yang sudah tak ada di kode', () => {
    const { tampil } = susunTab(KODE, ['/lama', '/b', '/a', '/c', '/d'], []);
    expect(tampil.map((t) => t.to)).toEqual(['/b', '/a', '/c', '/d']);
  });

  it('memindahkan tab tersembunyi keluar dari tampil', () => {
    const { tampil, sembunyi } = susunTab(KODE, ['/a', '/b', '/c', '/d'], ['/b']);
    expect(tampil.map((t) => t.to)).toEqual(['/a', '/c', '/d']);
    expect(sembunyi.map((t) => t.to)).toEqual(['/b']);
  });

  it('menyembunyikan tidak menghapus posisi: tampil lagi mengembalikan tempatnya', () => {
    const urutan = ['/d', '/c', '/b', '/a'];
    const saatSembunyi = susunTab(KODE, urutan, ['/c']);
    expect(saatSembunyi.tampil.map((t) => t.to)).toEqual(['/d', '/b', '/a']);

    const saatTampil = susunTab(KODE, urutan, []);
    expect(saatTampil.tampil.map((t) => t.to)).toEqual(['/d', '/c', '/b', '/a']);
  });

  it('mengabaikan sembunyi untuk rute yang tak ada di kode', () => {
    const { tampil, sembunyi } = susunTab(KODE, [], ['/hantu']);
    expect(tampil.map((t) => t.to)).toEqual(['/a', '/b', '/c', '/d']);
    expect(sembunyi).toEqual([]);
  });

  it('aman saat daftar tab kode kosong', () => {
    const { tampil, sembunyi } = susunTab([], ['/a'], ['/b']);
    expect(tampil).toEqual([]);
    expect(sembunyi).toEqual([]);
  });
});
