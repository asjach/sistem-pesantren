import { describe, expect, it, vi } from 'vitest';

import { Riwayat } from './Riwayat';

describe('Riwayat undo/redo', () => {
  it('mulailah pada nilai awal dan tidak bisa apa-apa', () => {
    const r = new Riwayat<number>(0);
    expect(r.nilai()).toBe(0);
    expect(r.bisaUndo()).toBe(false);
    expect(r.bisaRedo()).toBe(false);
    expect(r.undo()).toBe(0);
    expect(r.redo()).toBe(0);
  });

  it('menyimpan langkah dan dapat dibatalkan', () => {
    const r = new Riwayat<number>(0);
    r.catat('tambah', 10);

    expect(r.nilai()).toBe(10);
    expect(r.bisaUndo()).toBe(true);
    expect(r.undo()).toBe(0);
    expect(r.bisaRedo()).toBe(true);
    expect(r.redo()).toBe(10);
  });

  it('mengabaikan perubahan yang tidak mengubah nilai', () => {
    const r = new Riwayat<number>(5);
    r.catat('sama', 5);
    expect(r.jumlah()).toBe(0);
    expect(r.bisaUndo()).toBe(false);
  });

  it('menggabungkan perubahan berlabel sama menjadi satu langkah', () => {
    const r = new Riwayat<number>(0);
    r.catat('seret', 1, true);
    r.catat('seret', 2, true);
    r.catat('seret', 3, true);

    expect(r.jumlah()).toBe(1);
    expect(r.undo()).toBe(0);
  });

  it('tidak menggabungkan bila gestur sudah ditutup', () => {
    const r = new Riwayat<number>(0);
    r.catat('seret', 1, true);
    r.tutupGabung();
    r.catat('seret', 2, true);

    expect(r.jumlah()).toBe(2);
    expect(r.undo()).toBe(1);
    expect(r.undo()).toBe(0);
  });

  it('membuka langkah baru bila label berbeda', () => {
    const r = new Riwayat<number>(0);
    r.catat('seret', 1, true);
    r.catat('ubah gaya', 2, true);

    expect(r.jumlah()).toBe(2);
  });

  it('membatalkan langkah yang dibatalkan saat redo tersedia', () => {
    const r = new Riwayat<number>(0);
    r.catat('a', 1);
    r.catat('b', 2);
    r.undo();

    r.catat('c', 3);

    expect(r.nilai()).toBe(3);
    expect(r.bisaRedo()).toBe(false);
    expect(r.undo()).toBe(1);
    expect(r.undo()).toBe(0);
  });

  it('membatasi jumlah langkah agar tidak tumbuh tanpa batas', () => {
    const r = new Riwayat<number>(0);
    for (let i = 1; i <= 150; i += 1) {
      r.catat('langkah', i);
    }

    expect(r.jumlah()).toBe(100);
    expect(r.nilai()).toBe(150);
  });

  it('memerp Heartsingly riwayat lama yang dipangkas', () => {
    const r = new Riwayat<number>(0);
    for (let i = 1; i <= 150; i += 1) {
      r.catat('langkah', i);
    }

    // 100 langkah terakhir dimulai dari nilai 50.
    let nilai = r.nilai();
    for (let i = 0; i < 100; i += 1) {
      nilai = r.undo();
    }
    expect(nilai).toBe(50);
  });

  it('memberi tahu pemanggil saat nilai berubah', () => {
    const pengamat = vi.fn();
    const r = new Riwayat<number>(0);
    r.menggambar = pengamat;

    r.catat('seret', 1, true);
    expect(pengamat).toHaveBeenCalledWith(1, 'seret');

    pengamat.mockClear();
    r.undo();
    expect(pengamat).toHaveBeenCalledWith(0, 'seret');

    pengamat.mockClear();
    r.redo();
    expect(pengamat).toHaveBeenCalledWith(1, 'seret');
  });

  it('menghapus seluruh riwayat saat dimuat ulang dari server', () => {
    const r = new Riwayat<number>(0);
    r.catat('a', 5);
    r.undo();

    r.setAwal(42);
    expect(r.nilai()).toBe(42);
    expect(r.bisaUndo()).toBe(false);
    expect(r.jumlah()).toBe(0);
  });
});
