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
    subpoin: [],
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

    fireEvent.click(document.getElementById('kartu_papan_butir_2')!);

    const rincian = document.getElementById('rincian_butir_2');
    expect(rincian?.textContent).toContain('Poin B.');
    expect(rincian?.textContent).not.toContain('Poin A.');
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

  it('subpoin terlihat langsung di bawah poin', () => {
    pasang([poin({ subpoin: ['Periksa saldo.', 'Unduh laporan.'] })]);

    const baris = document.getElementById('kartu_papan_butir_1');
    expect(baris?.textContent).toContain('Periksa saldo.');
    expect(baris?.textContent).toContain('Unduh laporan.');
  });

  it('sub-modul kosong tetap punya kartu untuk ubah nama dan tambah poin', async () => {
    const onSimpan = vi.fn(async () => {});
    const onTambahPoin = vi.fn(async () => {});
    renderDenganTema(
      <PapanKolom
        kartu={[]}
        subKosong={[{ kode: 'D.2', nama: 'Rencana baru', status: 'akan', butir: [] }]}
        tampilkanModul={false}
        onPindah={vi.fn()}
        bolehUbah
        aksiSub={() => ({ onSimpan, onHapus: vi.fn(async () => {}) })}
        onTambahPoin={onTambahPoin}
        idAwalan="uji_kosong"
      />,
    );

    fireEvent.click(document.getElementById('btn_ubah_sub_sub_d_2_akan')!);
    fireEvent.change(document.getElementById('input_nama_sub_d_2_akan')!, {
      target: { value: 'Rencana terinci' },
    });
    fireEvent.click(document.getElementById('btn_simpan_sub_d_2_akan')!);
    await vi.waitFor(() => expect(onSimpan).toHaveBeenCalledWith('D.2', 'Rencana terinci'));

    fireEvent.click(document.getElementById('btn_tambah_poin_sub_d_2_akan')!);
    fireEvent.change(document.getElementById('input_poin_baru_sub_d_2_akan')!, {
      target: { value: 'Mulai pekerjaan.' },
    });
    fireEvent.click(document.getElementById('btn_simpan_poin_sub_d_2_akan')!);
    await vi.waitFor(() => expect(onTambahPoin).toHaveBeenCalledWith('D.2', 'akan', 'Mulai pekerjaan.'));
  });
});
