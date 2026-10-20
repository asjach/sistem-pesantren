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

describe('PapanKolom - rincian poin', () => {
  it('belum menampilkan rincian sebelum judul diklik', () => {
    pasang();
    expect(document.getElementById('rincian_butir_128')).toBeNull();
  });

  it('klik judul membuka rincian di dalam kartu', () => {
    pasang();
    fireEvent.click(document.getElementById('btn_buka_papan_butir_128')!);

    const rincian = document.getElementById('rincian_butir_128');
    expect(rincian).not.toBeNull();
    // Rincian konteks: modul, sub-modul, dan status turunan.
    expect(rincian?.textContent).toContain('Keuangan');
    expect(rincian?.textContent).toContain('Ekspor rekap per kas.');
    expect(rincian?.textContent).toContain('turunan dari poin');
    expect(document.getElementById('pop_butir_papan')).toBeNull();
    expect(document.getElementById('dialog_butir_papan')).toBeNull();
  });

  it('mengetuk baris poin membuka rincian (jalur sentuh)', () => {
    pasang();
    fireEvent.click(document.getElementById('kartu_papan_butir_128')!);

    expect(document.getElementById('rincian_butir_128')).not.toBeNull();
  });

  it('rincian hanya terbuka untuk satu kartu', () => {
    pasang([kartu(), kartu({ id: 129, deskripsi: 'Rekap per kas.' })]);
    fireEvent.click(document.getElementById('btn_buka_papan_butir_128')!);
    fireEvent.click(document.getElementById('btn_buka_papan_butir_129')!);

    const rincian = document.getElementById('rincian_butir_129');
    expect(rincian?.textContent).toContain('Rekap per kas.');
    expect(document.getElementById('rincian_butir_128')).toBeNull();
  });
});
