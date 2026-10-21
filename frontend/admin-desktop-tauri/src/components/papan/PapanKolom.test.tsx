import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PapanKolom } from './PapanKolom';
import type { KartuPapan } from '@/lib/papan';
import { renderDenganTema } from '@/test/utils';

/** Kartu contoh: satu poin milik sub-modul E.3. */
function kartu(ubah: Partial<KartuPapan> = {}): KartuPapan {
  return {
    id: 128,
    kode: 'E.3',
    nama: 'Rekap & Tutup Buku Kas',
    status: 'todo',
    deskripsi: 'Ekspor rekap per kas.',
    keterangan: null,
    subpoin: [],
    subKode: 'E.3',
    subNama: 'Rekap & Tutup Buku Kas',
    modulKode: 'E',
    modulNama: 'Keuangan',
    statusSub: 'todo',
    ...ubah,
  };
}

function pasang(daftar: KartuPapan[] = [kartu()]) {
  return renderDenganTema(
    <PapanKolom kartu={daftar} tampilkanModul={false} onPindah={vi.fn()} idAwalan="uji" />,
  );
}

describe('PapanKolom - kolom awal', () => {
  it('kolom Backlog dan Done mulai terlipat, lalu bisa dibuka', () => {
    renderDenganTema(
      <PapanKolom
        kartu={[
          kartu({ id: 1, status: 'todo' }),
          kartu({ id: 2, status: 'done' }),
          kartu({ id: 3, status: 'backlog' }),
        ]}
        tampilkanModul={false}
        onPindah={vi.fn()}
        idAwalan="uji"
        lipatAwal={['done', 'backlog']}
      />,
    );

    // Strip kolom tampil, tetapi isi kartunya belum dirender.
    expect(document.getElementById('btn_buka_uji_done')).not.toBeNull();
    expect(document.getElementById('btn_buka_uji_backlog')).not.toBeNull();
    expect(document.getElementById('kartu_papan_butir_2')).toBeNull();
    expect(document.getElementById('kartu_papan_butir_3')).toBeNull();
    // Kolom aktif tetap terbuka.
    expect(document.getElementById('btn_lipat_uji_todo')).not.toBeNull();

    fireEvent.click(document.getElementById('btn_buka_uji_done')!);
    fireEvent.click(document.getElementById('btn_lipat_sub_e_3_done')!);
    expect(document.getElementById('kartu_papan_butir_2')).not.toBeNull();
  });
});

describe('PapanKolom - lipatan awal dari isi', () => {
  it('kolom tanpa sub-modul terlipat, kolom berisi terbuka, Done selalu terlipat', () => {
    renderDenganTema(
      <PapanKolom
        kartu={[
          kartu({ id: 1, status: 'todo' }),
          kartu({ id: 2, status: 'in_progress' }),
          kartu({ id: 3, status: 'done' }),
        ]}
        tampilkanModul={false}
        onPindah={vi.fn()}
        idAwalan="uji"
      />,
    );

    // Berisi -> terbuka.
    expect(document.getElementById('btn_lipat_uji_todo')).not.toBeNull();
    expect(document.getElementById('btn_lipat_uji_in_progress')).not.toBeNull();

    // Kosong -> terlipat.
    expect(document.getElementById('btn_buka_uji_backlog')).not.toBeNull();
    expect(document.getElementById('btn_buka_uji_for_review')).not.toBeNull();

    // Done punya sub-modul, tetapi tetap terlipat secara default.
    expect(document.getElementById('btn_buka_uji_done')).not.toBeNull();
    expect(document.getElementById('kartu_papan_butir_3')).toBeNull();
  });

  it('sub-modul tanpa poin tetap membuka kolom Backlog', () => {
    renderDenganTema(
      <PapanKolom
        kartu={[]}
        tampilkanModul={false}
        onPindah={vi.fn()}
        idAwalan="uji"
        subKosong={[{ kode: 'A.1', nama: 'Belum berisi', status: 'backlog', butir: [] }]}
      />,
    );

    expect(document.getElementById('btn_lipat_uji_backlog')).not.toBeNull();
    expect(document.getElementById('btn_buka_uji_done')).not.toBeNull();
  });
});

describe('PapanKolom - tambah sub-modul', () => {
  it('tombol muncul di kolom Backlog dan To Do saat boleh ubah', () => {
    const onTambahSub = vi.fn();
    renderDenganTema(
      <PapanKolom
        kartu={[kartu()]}
        tampilkanModul={false}
        onPindah={vi.fn()}
        bolehUbah
        onTambahSub={onTambahSub}
        idAwalan="uji"
      />,
    );

    // Backlog kosong mulai terlipat; buka dulu sebelum memakai tombol tambah.
    fireEvent.click(document.getElementById('btn_buka_uji_backlog')!);
    fireEvent.click(document.getElementById('btn_tambah_sub_uji_backlog')!);
    expect(onTambahSub).toHaveBeenCalledTimes(1);
    expect(document.getElementById('btn_tambah_sub_uji_todo')).not.toBeNull();
    expect(document.getElementById('btn_tambah_sub_uji_in_progress')).toBeNull();
    expect(document.getElementById('btn_tambah_sub_uji_done')).toBeNull();
  });

  it('tanpa izin ubah tombol tambah sub-modul tidak muncul', () => {
    renderDenganTema(
      <PapanKolom
        kartu={[kartu()]}
        tampilkanModul={false}
        onPindah={vi.fn()}
        onTambahSub={vi.fn()}
        idAwalan="uji"
      />,
    );

    expect(document.getElementById('btn_tambah_sub_uji_backlog')).toBeNull();
    expect(document.getElementById('btn_tambah_sub_uji_todo')).toBeNull();
  });
});
