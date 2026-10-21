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
    nama: 'Nilai & Kegiatan Evaluatif',
    status: 'todo',
    deskripsi: 'Poin contoh.',
    keterangan: null,
    subpoin: [],
    subKode: 'D.1',
    subNama: 'Nilai & Kegiatan Evaluatif',
    modulKode: 'D',
    modulNama: 'Penilaian',
    statusSub: 'todo',
    ...ubah,
  };
}

function pasang(kartu: KartuPapan[], poinDisorot: number | null = null) {
  return renderDenganTema(
    <PapanKolom
      kartu={kartu}
      tampilkanModul={false}
      onPindah={vi.fn()}
      bolehUbah
      idAwalan="uji"
      poinDisorot={poinDisorot}
      // Tes ini soal penggabungan kartu, bukan lipatan awal: buka semua kolom.
      lipatAwal={[]}
    />,
  );
}

function bukaKartu(id: string) {
  fireEvent.click(document.getElementById(`btn_lipat_${id}`)!);
}

describe('PapanKolom - kartu digabung per sub-modul', () => {
  it('kartu sub-modul tertutup secara bawaan lalu bisa dibuka dan ditutup', () => {
    pasang([poin({ id: 1 })]);

    expect(document.getElementById('btn_lipat_sub_d_1_todo')?.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById('kartu_papan_butir_1')).toBeNull();

    bukaKartu('sub_d_1_todo');
    expect(document.getElementById('btn_lipat_sub_d_1_todo')?.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById('kartu_papan_butir_1')).not.toBeNull();

    bukaKartu('sub_d_1_todo');
    expect(document.getElementById('kartu_papan_butir_1')).toBeNull();
  });

  it('area header selain tombol juga membuka kartu', () => {
    pasang([poin({ id: 1 })]);

    expect(document.getElementById('kartu_papan_butir_1')).toBeNull();

    fireEvent.click(document.getElementById('btn_lipat_area_sub_d_1_todo')!);

    expect(document.getElementById('kartu_papan_butir_1')).not.toBeNull();
  });

  it('membuka kartu dan menyorot poin dari hasil pencarian', async () => {
    pasang([poin({ id: 1 })], 1);

    const baris = document.getElementById('kartu_papan_butir_1');

    expect(baris).not.toBeNull();
    expect(baris?.className).toContain('ring-1');
    await vi.waitFor(() => expect(document.activeElement).toBe(baris));
  });

  it('membuka kolom Done yang terlipat saat poin disorot', () => {
    renderDenganTema(
      <PapanKolom
        kartu={[poin({ id: 2, status: 'done' })]}
        tampilkanModul={false}
        onPindah={vi.fn()}
        bolehUbah
        idAwalan="uji_done"
        poinDisorot={2}
      />,
    );

    expect(document.getElementById('kartu_papan_butir_2')).not.toBeNull();
  });

  it('tiga poin satu sub-modul jadi SATU kartu berisi tiga poin', () => {
    pasang([
      poin({ id: 1, deskripsi: 'Poin A.' }),
      poin({ id: 2, deskripsi: 'Poin B.' }),
      poin({ id: 3, deskripsi: 'Poin C.' }),
    ]);
    bukaKartu('sub_d_1_todo');

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
      poin({ id: 1, status: 'todo' }),
      poin({ id: 2, status: 'done' }),
    ]);
    bukaKartu('sub_d_1_todo');
    bukaKartu('sub_d_1_done');

    // Satu sub-modul, dua kolom: kartunya dua, tapi tiap kolom hanya satu.
    const kartu = document.querySelectorAll('[id^="kartu_papan_sub_"]');
    expect(kartu).toHaveLength(2);
    expect(document.getElementById('kartu_papan_butir_1')).not.toBeNull();
    expect(document.getElementById('kartu_papan_butir_2')).not.toBeNull();
  });

  it('poin tetap draggable saat boleh ubah, dan tidak saat tidak boleh', () => {
    const { unmount } = pasang([poin({ id: 1 })]);
    bukaKartu('sub_d_1_todo');
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
    bukaKartu('sub_d_1_todo');
    expect(document.getElementById('kartu_papan_butir_1')?.getAttribute('draggable')).toBe('false');
  });

  it('subpoin terlihat langsung di bawah poin', () => {
    pasang([poin({ subpoin: [
      { teks: 'Periksa saldo.', selesai: false },
      { teks: 'Unduh laporan.', selesai: true },
    ] })]);
    bukaKartu('sub_d_1_todo');

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
        subKosong={[{ kode: 'D.2', nama: 'Rencana baru', status: 'backlog', butir: [] }]}
        tampilkanModul={false}
        onPindah={vi.fn()}
        bolehUbah
        aksiSub={() => ({ onSimpan, onHapus: vi.fn(async () => {}) })}
        onTambahPoin={onTambahPoin}
        idAwalan="uji_kosong"
      />,
    );

    fireEvent.click(document.getElementById('btn_ubah_sub_sub_d_2_backlog')!);
    fireEvent.change(document.getElementById('input_nama_sub_d_2_backlog')!, {
      target: { value: 'Rencana terinci' },
    });
    fireEvent.click(document.getElementById('btn_simpan_sub_d_2_backlog')!);
    await vi.waitFor(() => expect(onSimpan).toHaveBeenCalledWith('D.2', 'Rencana terinci'));

    await vi.waitFor(() => {
      expect(document.getElementById('btn_tambah_poin_sub_d_2_backlog')).not.toBeNull();
    });
    fireEvent.click(document.getElementById('btn_tambah_poin_sub_d_2_backlog')!);
    fireEvent.change(document.getElementById('input_poin_baru_sub_d_2_backlog')!, {
      target: { value: 'Mulai pekerjaan.' },
    });
    fireEvent.change(document.getElementById('input_keterangan_poin_baru_sub_d_2_backlog')!, {
      target: { value: 'Catatan tambahan.' },
    });
    fireEvent.click(document.getElementById('btn_simpan_poin_sub_d_2_backlog')!);
    await vi.waitFor(() => expect(onTambahPoin).toHaveBeenCalledWith('D.2', 'backlog', 'Mulai pekerjaan.', 'Catatan tambahan.'));
  });
});
