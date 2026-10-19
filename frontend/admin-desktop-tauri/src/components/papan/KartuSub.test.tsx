import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PapanKolom } from './PapanKolom';
import type { KartuPapan } from '@/lib/papan';
import { renderDenganTema } from '@/test/utils';

/** Poin contoh milik satu sub-modul. */
function poin(ubah: Partial<KartuPapan> = {}): KartuPapan {
  return {
    id: 1,
    kode: 'D.1',
    nama: 'Nilai & Peristiwa',
    status: 'akan',
    deskripsi: 'Poin contoh.',
    subKode: 'D.1',
    subNama: 'Nilai & Peristiwa',
    modulKode: 'D',
    modulNama: 'Penilaian',
    statusSub: 'akan',
    ...ubah,
  };
}

function pasang(kartu: KartuPapan[]) {
  return renderDenganTema(
    <PapanKolom
      kartu={kartu}
      tampilkanModul={false}
      onPindah={vi.fn()}
      bolehUbah
      idAwalan="uji"
    />,
  );
}

describe('PapanKolom - kartu digabung per sub-modul', () => {
  it('tiga poin satu sub-modul jadi SATU kartu berisi tiga poin', () => {
    pasang([
      poin({ id: 1, deskripsi: 'Poin A.' }),
      poin({ id: 2, deskripsi: 'Poin B.' }),
      poin({ id: 3, deskripsi: 'Poin C.' }),
    ]);

    // Judul sub-modul muncul sekali, bukan tiga kali.
    const kartu = document.querySelectorAll('[id^="kartu_papan_sub_"]');
    expect(kartu).toHaveLength(1);
    // Ketiga poinnya tetap ada di dalam kartu itu.
    expect(document.getElementById('kartu_papan_butir_1')).not.toBeNull();
    expect(document.getElementById('kartu_papan_butir_2')).not.toBeNull();
    expect(document.getElementById('kartu_papan_butir_3')).not.toBeNull();
  });

  it('poin beda status muncul sebagai kartu terpisah per kolom', () => {
    pasang([
      poin({ id: 1, status: 'akan' }),
      poin({ id: 2, status: 'sudah' }),
    ]);

    // Satu sub-modul, dua kolom: kartunya dua, tapi tiap kolom hanya satu.
    const kartu = document.querySelectorAll('[id^="kartu_papan_sub_"]');
    expect(kartu).toHaveLength(2);
    expect(document.getElementById('kartu_papan_butir_1')).not.toBeNull();
    expect(document.getElementById('kartu_papan_butir_2')).not.toBeNull();
  });

  it('tiap poin tetap bisa dibuka rinciannya sendiri', () => {
    pasang([poin({ id: 1, deskripsi: 'Poin A.' }), poin({ id: 2, deskripsi: 'Poin B.' })]);

    fireEvent.click(document.getElementById('btn_buka_papan_butir_2')!);

    const pop = document.getElementById('pop_butir_papan');
    expect(pop?.textContent).toContain('Poin B.');
    expect(pop?.textContent).not.toContain('Poin A.');
  });

  it('poin tetap draggable saat boleh ubah, dan tidak saat tidak boleh', () => {
    const { unmount } = pasang([poin({ id: 1 })]);
    expect(document.getElementById('kartu_papan_butir_1')?.getAttribute('draggable')).toBe('true');
    unmount();

    renderDenganTema(
      <PapanKolom
        kartu={[poin({ id: 1 })]}
        tampilkanModul={false}
        onPindah={vi.fn()}
        bolehUbah={false}
        idAwalan="uji2"
      />,
    );
    expect(document.getElementById('kartu_papan_butir_1')?.getAttribute('draggable')).toBe('false');
  });
});
