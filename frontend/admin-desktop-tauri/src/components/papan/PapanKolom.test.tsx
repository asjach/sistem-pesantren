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

describe('PapanKolom - rincian poin', () => {
  it('belum menampilkan rincian sebelum judul diklik', () => {
    pasang();
    expect(document.getElementById('pop_butir_papan')).toBeNull();
  });

  it('klik judul membuka popover rincian, bukan dialog penuh layar', () => {
    pasang();
    fireEvent.click(document.getElementById('btn_buka_papan_butir_128')!);

    const pop = document.getElementById('pop_butir_papan');
    expect(pop).not.toBeNull();
    // Rincian konteks: modul, sub-modul, dan status turunan.
    expect(pop?.textContent).toContain('Keuangan');
    expect(pop?.textContent).toContain('Ekspor rekap per kas.');
    expect(pop?.textContent).toContain('turunan dari poin');
    // Tidak ada lagi lapisan gelap penuh layar milik dialog lama.
    expect(document.getElementById('dialog_butir_papan')).toBeNull();
  });

  it('mengetuk baris poin membuka rincian (jalur sentuh)', () => {
    pasang();
    fireEvent.click(document.getElementById('kartu_papan_butir_128')!);

    expect(document.getElementById('pop_butir_papan')).not.toBeNull();
  });

  it('rincian hanya terbuka untuk satu kartu', () => {
    pasang([kartu(), kartu({ id: 129, deskripsi: 'Rekap per kas.' })]);
    fireEvent.click(document.getElementById('btn_buka_papan_butir_128')!);
    fireEvent.click(document.getElementById('btn_buka_papan_butir_129')!);

    const pop = document.getElementById('pop_butir_papan');
    expect(pop?.textContent).toContain('Rekap per kas.');
    // Popover lama tidak menumpuk: hanya satu panel di DOM.
    expect(document.querySelectorAll('#pop_butir_papan').length).toBe(1);
  });
});
