import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

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

async function pasang(kartu: KartuPapan[], poinDisorot: number | null = null) {
  const hasil = renderDenganTema(
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
  await act(async () => {});

  return hasil;
}

function bukaKartu(id: string) {
  fireEvent.click(document.getElementById(`btn_lipat_area_${id}`)!);
}

describe('PapanKolom - kartu digabung per sub-modul', () => {
  it('hamburger membuka aksi tanpa membuka kartu, Escape menutup dan mengembalikan fokus', async () => {
    const user = userEvent.setup();
    renderDenganTema(<PapanKolom kartu={[poin()]} tampilkanModul={false} onPindah={vi.fn()} bolehUbah
      aksiSub={() => ({ onSimpan: vi.fn(async () => {}), onHapus: vi.fn(async () => {}) })}
      onTambahPoin={vi.fn(async () => {})} />);
    await act(async () => {});
    const menu = screen.getByRole('button', { name: 'Aksi kartu D.1 Nilai & Kegiatan Evaluatif' });
    expect(screen.queryByRole('button', { name: 'Tambah poin di D.1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ubah sub-modul D.1' })).not.toBeInTheDocument();
    menu.focus();
    await user.keyboard('{Enter}');
    const panel = screen.getByRole('dialog', { name: 'Aksi kartu D.1 Nilai & Kegiatan Evaluatif' });
    expect(within(panel).getByRole('button', { name: 'Tambah poin di D.1' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Ubah sub-modul D.1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buka kartu D.1 Nilai & Kegiatan Evaluatif' })).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(menu).toHaveFocus();
  });

  it('aksi tambah dan ubah membuka input terkait, memindahkan fokus, serta tidak langsung menyimpan', async () => {
    const user = userEvent.setup();
    const onSimpan = vi.fn(async () => {});
    const onTambahPoin = vi.fn(async () => {});
    renderDenganTema(<PapanKolom kartu={[poin()]} tampilkanModul={false} onPindah={vi.fn()} bolehUbah
      aksiSub={() => ({ onSimpan, onHapus: vi.fn(async () => {}) })} onTambahPoin={onTambahPoin} />);
    await act(async () => {});
    await user.click(screen.getByRole('button', { name: 'Aksi kartu D.1 Nilai & Kegiatan Evaluatif' }));
    await user.click(screen.getByRole('button', { name: 'Tambah poin di D.1' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Poin baru D.1' })).toHaveFocus());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Aksi kartu D.1 Nilai & Kegiatan Evaluatif' }));
    await user.click(screen.getByRole('button', { name: 'Ubah sub-modul D.1' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Nama sub-modul D.1' })).toHaveFocus());
    expect(screen.queryByRole('textbox', { name: 'Poin baru D.1' })).not.toBeInTheDocument();
    expect(onSimpan).not.toHaveBeenCalled();
    expect(onTambahPoin).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Batal ubah sub-modul D.1' }));
    expect(screen.getByRole('button', { name: 'Aksi kartu D.1 Nilai & Kegiatan Evaluatif' })).toBeInTheDocument();
  });

  it('tanpa izin ubah menu aksi tidak tersedia dan judul tetap dapat membuka kartu', async () => {
    const user = userEvent.setup();
    renderDenganTema(<PapanKolom kartu={[poin()]} tampilkanModul={false} onPindah={vi.fn()} bolehUbah={false}
      aksiSub={() => ({ onSimpan: vi.fn(async () => {}), onHapus: vi.fn(async () => {}) })}
      onTambahPoin={vi.fn(async () => {})} />);
    await act(async () => {});
    expect(screen.queryByRole('button', { name: /Aksi kartu/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Buka kartu D.1 Nilai & Kegiatan Evaluatif' }));
    expect(screen.getByRole('button', { name: 'Tutup kartu D.1 Nilai & Kegiatan Evaluatif' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('kartu sub-modul tertutup secara bawaan lalu bisa dibuka dan ditutup', async () => {
    await pasang([poin({ id: 1 })]);

    expect(document.getElementById('btn_lipat_area_sub_d_1_todo')?.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById('kartu_papan_butir_1')).toBeNull();

    bukaKartu('sub_d_1_todo');
    expect(document.getElementById('btn_lipat_area_sub_d_1_todo')?.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById('kartu_papan_butir_1')).not.toBeNull();

    bukaKartu('sub_d_1_todo');
    expect(document.getElementById('kartu_papan_butir_1')).toBeNull();
  });

  it('area header selain tombol juga membuka kartu', async () => {
    await pasang([poin({ id: 1 })]);

    expect(document.getElementById('kartu_papan_butir_1')).toBeNull();

    fireEvent.click(document.getElementById('btn_lipat_area_sub_d_1_todo')!);

    expect(document.getElementById('kartu_papan_butir_1')).not.toBeNull();
  });

  it('membuka kartu dan menyorot poin dari hasil pencarian', async () => {
    await pasang([poin({ id: 1 })], 1);

    const baris = document.getElementById('kartu_papan_butir_1');

    expect(baris).not.toBeNull();
    await vi.waitFor(() => expect(document.activeElement).toBe(baris));
  });

  it('membuka kolom Done yang terlipat saat poin disorot', async () => {
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

    await act(async () => {});
    expect(document.getElementById('kartu_papan_butir_2')).not.toBeNull();
  });

  it('tiga poin satu sub-modul jadi SATU kartu berisi tiga poin', async () => {
    await pasang([
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

  it('poin beda status muncul sebagai kartu terpisah per kolom', async () => {
    await pasang([
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

  it('poin tetap draggable saat boleh ubah, dan tidak saat tidak boleh', async () => {
    const { unmount } = await pasang([poin({ id: 1 })]);
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
    await act(async () => {});
    bukaKartu('sub_d_1_todo');
    expect(document.getElementById('kartu_papan_butir_1')?.getAttribute('draggable')).toBe('false');
  });

  it('subpoin terlihat langsung di bawah poin', async () => {
    await pasang([poin({ subpoin: [
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

    await act(async () => {});
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Aksi kartu D.2 Rencana baru' }));
    await user.click(screen.getByRole('button', { name: 'Ubah sub-modul D.2' }));
    await user.clear(screen.getByRole('textbox', { name: 'Nama sub-modul D.2' }));
    await user.type(screen.getByRole('textbox', { name: 'Nama sub-modul D.2' }), 'Rencana terinci');
    await user.click(screen.getByRole('button', { name: 'Simpan sub-modul D.2' }));
    await vi.waitFor(() => expect(onSimpan).toHaveBeenCalledWith('D.2', 'Rencana terinci'));

    await user.click(await screen.findByRole('button', { name: 'Aksi kartu D.2 Rencana baru' }));
    await user.click(screen.getByRole('button', { name: 'Tambah poin di D.2' }));
    await user.type(screen.getByRole('textbox', { name: 'Poin baru D.2' }), 'Mulai pekerjaan.');
    await user.type(screen.getByRole('textbox', { name: 'Requirement poin baru D.2' }), 'Catatan tambahan.');
    await user.click(screen.getByRole('button', { name: 'Simpan poin' }));
    await vi.waitFor(() => expect(onTambahPoin).toHaveBeenCalledWith('D.2', 'backlog', 'Mulai pekerjaan.', 'Catatan tambahan.'));
  });
});
