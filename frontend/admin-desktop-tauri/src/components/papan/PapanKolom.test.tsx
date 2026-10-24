import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

async function pasang(daftar: KartuPapan[] = [kartu()]) {
  const hasil = renderDenganTema(
    <PapanKolom kartu={daftar} tampilkanModul={false} onPindah={vi.fn()} idAwalan="uji" />,
  );
  await act(async () => {});
  return hasil;
}

describe('PapanKolom - visibilitas kolom', () => {
  it('Pending tampil paling awal, sedangkan kolom tersembunyi tidak meninggalkan strip lipatan', async () => {
    renderDenganTema(<PapanKolom kartu={[kartu({ status: 'pending' })]} tampilkanModul={false} onPindah={vi.fn()} kolomTerlihat={['pending', 'todo']} />);
    await act(async () => {});
    expect(screen.getAllByRole('region').map((el) => el.getAttribute('aria-label'))).toEqual(['Kolom Pending, 1 kartu', 'Kolom To Do, 0 kartu']);
    expect(screen.queryByRole('button', { name: 'Buka kolom Backlog' })).not.toBeInTheDocument();
  });

  it('semua kolom dapat disembunyikan lalu ditampilkan kembali tanpa kehilangan poin', async () => {
    const props = { kartu: [kartu()], tampilkanModul: false, onPindah: vi.fn() };
    const hasil = renderDenganTema(<PapanKolom {...props} kolomTerlihat={[]} />);
    await act(async () => {});
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    hasil.rerender(<PapanKolom {...props} kolomTerlihat={['todo']} />);
    expect(screen.getByRole('region', { name: 'Kolom To Do, 1 kartu' })).toBeInTheDocument();
  });

  it('keyboard memindahkan poin sesuai urutan kolom terlihat', async () => {
    const user = userEvent.setup();
    const onPindah = vi.fn(async () => true);
    renderDenganTema(<PapanKolom kartu={[kartu({ status: 'pending' })]} tampilkanModul={false} onPindah={onPindah} bolehUbah kolomTerlihat={['pending', 'in_progress']} />);
    await act(async () => {});
    await user.click(screen.getAllByRole('button', { name: /Buka kartu E.3/ })[0]);
    const poin = screen.getByRole('group', { name: /Ekspor rekap per kas/ });
    poin.focus();
    await user.keyboard('{ArrowRight}');
    expect(onPindah).toHaveBeenCalledWith(128, 'in_progress');
  });

  it('sub-modul kosong tetap berada di Backlog saat Pending menjadi kolom pertama', async () => {
    renderDenganTema(<PapanKolom kartu={[]} tampilkanModul={false} onPindah={vi.fn()} subKosong={[{ kode: 'A.1', nama: 'Sub kosong', status: 'backlog', butir: [] }]} />);
    await act(async () => {});
    expect(within(screen.getByRole('region', { name: 'Kolom Backlog, 1 kartu' })).getAllByRole('button', { name: /Buka kartu A.1/ })[0]).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Kolom Pending, 0 kartu' })).toBeInTheDocument();
  });
});

describe('PapanKolom - nomor poin', () => {
  it('menampilkan nomor poin #id pada kartu agar mudah dirujuk', async () => {
    await pasang([kartu({ id: 563 })]);

    // Sub-modul E.3 mulai terlipat; buka agar kartunya dirender.
    fireEvent.click(document.getElementById('btn_lipat_sub_e_3_todo')!);

    const nomor = document.querySelector('[data-slot="papan-poin-id"]');
    expect(nomor).not.toBeNull();
    expect(nomor).toHaveTextContent('#563');
  });
});

describe('PapanKolom - kolom awal', () => {
  it('kolom Backlog dan Done mulai terlipat, lalu bisa dibuka', async () => {
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
    await act(async () => {});

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
  it('kolom tanpa sub-modul terlipat, kolom berisi terbuka, Done selalu terlipat', async () => {
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
    await act(async () => {});

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

  it('sub-modul tanpa poin tetap membuka kolom Backlog', async () => {
    renderDenganTema(
      <PapanKolom
        kartu={[]}
        tampilkanModul={false}
        onPindah={vi.fn()}
        idAwalan="uji"
        subKosong={[{ kode: 'A.1', nama: 'Belum berisi', status: 'backlog', butir: [] }]}
      />,
    );
    await act(async () => {});

    expect(document.getElementById('btn_lipat_uji_backlog')).not.toBeNull();
    expect(document.getElementById('btn_buka_uji_done')).not.toBeNull();
  });
});

describe('PapanKolom - tambah sub-modul', () => {
  it('tombol muncul di kolom Backlog dan To Do saat boleh ubah', async () => {
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
    await act(async () => {});

    // Backlog kosong mulai terlipat; buka dulu sebelum memakai tombol tambah.
    fireEvent.click(document.getElementById('btn_buka_uji_backlog')!);
    fireEvent.click(document.getElementById('btn_tambah_sub_uji_backlog')!);
    expect(onTambahSub).toHaveBeenCalledTimes(1);
    expect(document.getElementById('btn_tambah_sub_uji_todo')).not.toBeNull();
    expect(document.getElementById('btn_tambah_sub_uji_in_progress')).toBeNull();
    expect(document.getElementById('btn_tambah_sub_uji_done')).toBeNull();
  });

  it('tanpa izin ubah tombol tambah sub-modul tidak muncul', async () => {
    renderDenganTema(
      <PapanKolom
        kartu={[kartu()]}
        tampilkanModul={false}
        onPindah={vi.fn()}
        onTambahSub={vi.fn()}
        idAwalan="uji"
      />,
    );
    await act(async () => {});

    expect(document.getElementById('btn_tambah_sub_uji_backlog')).toBeNull();
    expect(document.getElementById('btn_tambah_sub_uji_todo')).toBeNull();
  });
});

describe('PapanKolom - pengumuman perpindahan tersimpan', () => {
  async function pasangPindah(onPindah: () => Promise<boolean>, status: KartuPapan['status'] = 'todo') {
    const user = userEvent.setup();
    await act(async () => {
      renderDenganTema(
        <PapanKolom kartu={[kartu({ status })]} tampilkanModul={false} onPindah={onPindah} bolehUbah idAwalan="uji" lipatAwal={[]} />,
      );
    });
    await user.click(screen.getAllByRole('button', { name: /Buka kartu E.3/ })[0]);
    const poin = screen.getByRole('group', { name: /Ekspor rekap per kas/ });
    return { user, poin };
  }

  it('keyboard mengumumkan perpindahan setelah penyimpanan berhasil, bukan saat masih berjalan', async () => {
    let selesai!: (nilai: boolean) => void;
    const onPindah = vi.fn(() => new Promise<boolean>((resolve) => { selesai = resolve; }));
    const { user, poin } = await pasangPindah(onPindah);
    poin.focus();
    await user.keyboard('{ArrowRight}');
    expect(onPindah).toHaveBeenCalledWith(128, 'in_progress');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();

    await act(async () => selesai(true));
    expect(screen.getByRole('status')).toHaveTextContent('dipindahkan ke In Progress');
  });

  it('permintaan keyboard yang belum tersimpan atau ditolak tidak mengumumkan keberhasilan', async () => {
    const onPindah = vi.fn(async () => false);
    const { user, poin } = await pasangPindah(onPindah);
    poin.focus();
    await user.keyboard('{ArrowRight}');
    expect(onPindah).toHaveBeenCalledWith(128, 'in_progress');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('drag Reopen yang menunggu konfirmasi atau dibatalkan tidak mengumumkan perubahan status', async () => {
    const onPindah = vi.fn(async () => false);
    const { poin } = await pasangPindah(onPindah, 'done');
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(poin, { dataTransfer });
    fireEvent.drop(screen.getByRole('region', { name: 'Kolom In Progress, 0 kartu' }), { dataTransfer });
    await waitFor(() => expect(onPindah).toHaveBeenCalledWith(128, 'in_progress'));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
