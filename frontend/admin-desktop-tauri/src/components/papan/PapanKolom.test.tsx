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
    status: 'akan',
    deskripsi: 'Ekspor rekap per kas.',
    subpoin: [],
    subKode: 'E.3',
    subNama: 'Rekap & Tutup Buku Kas',
    modulKode: 'E',
    modulNama: 'Keuangan',
    statusSub: 'akan',
    ...ubah,
  };
}

function pasang(daftar: KartuPapan[] = [kartu()]) {
  return renderDenganTema(
    <PapanKolom kartu={daftar} tampilkanModul={false} onPindah={vi.fn()} idAwalan="uji" />,
  );
}

describe('PapanKolom - kolom awal', () => {
  it('kolom sudah dan ditunda mulai terlipat, lalu bisa dibuka', () => {
    renderDenganTema(
      <PapanKolom
        kartu={[
          kartu({ id: 1, status: 'akan' }),
          kartu({ id: 2, status: 'sudah' }),
          kartu({ id: 3, status: 'ditunda' }),
        ]}
        tampilkanModul={false}
        onPindah={vi.fn()}
        idAwalan="uji"
        lipatAwal={['sudah', 'ditunda']}
      />,
    );

    // Strip kolom tampil, tetapi isi kartunya belum dirender.
    expect(document.getElementById('btn_buka_uji_sudah')).not.toBeNull();
    expect(document.getElementById('btn_buka_uji_ditunda')).not.toBeNull();
    expect(document.getElementById('kartu_papan_butir_2')).toBeNull();
    expect(document.getElementById('kartu_papan_butir_3')).toBeNull();
    // Kolom aktif tetap terbuka.
    expect(document.getElementById('btn_lipat_uji_akan')).not.toBeNull();

    fireEvent.click(document.getElementById('btn_buka_uji_sudah')!);
    expect(document.getElementById('kartu_papan_butir_2')).not.toBeNull();
  });
});

describe('PapanKolom - tambah sub-modul', () => {
  it('tombol muncul di kolom akan dan sedang saat boleh ubah', () => {
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

    fireEvent.click(document.getElementById('btn_tambah_sub_uji_akan')!);
    expect(onTambahSub).toHaveBeenCalledTimes(1);
    expect(document.getElementById('btn_tambah_sub_uji_sedang')).not.toBeNull();
    expect(document.getElementById('btn_tambah_sub_uji_sudah')).toBeNull();
    expect(document.getElementById('btn_tambah_sub_uji_ditunda')).toBeNull();
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

    expect(document.getElementById('btn_tambah_sub_uji_akan')).toBeNull();
    expect(document.getElementById('btn_tambah_sub_uji_sedang')).toBeNull();
  });
});
