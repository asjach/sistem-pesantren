import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { PembayaranRow } from '@/api/keuangan';
import type { TahunAjaran } from '@/api/master';
import { renderDenganTema } from '@/test/utils';
import PopoverAksiTagihan, { type DataBayar, type DataUbah, type TagihanAktif } from './PopoverAksiTagihan';

function tagihan(partial: Partial<TagihanAktif> = {}): TagihanAktif {
  return {
    id: 7, nama: 'Santri Uji', label: 'Infaq Bulanan · Jul 2025',
    ayah_nama: 'Bpk. Abdul', ibu_nama: 'Siti Aminah',
    nominal: 75000, terbayar: 20000, sisa: 55000, status: 'sebagian',
    terlambat: true, jatuhTempo: '2025-08-10', tahunAjaran: '2025/2026',
    tipe: 'bulanan', ...partial,
  };
}

/** Popover butuh jangkar elemen nyata (getBoundingClientRect). */
function jangkar(): HTMLElement {
  const el = document.createElement('button');
  el.getBoundingClientRect = () => new DOMRect(10, 10, 60, 20);
  document.body.appendChild(el);
  return el;
}

const DAFTAR_TA: TahunAjaran[] = [
  { nama: '2025/2026', is_aktif: true } as TahunAjaran,
  { nama: '2024/2025', is_aktif: false } as TahunAjaran,
];

function pembayaran(partial: Partial<PembayaranRow> = {}): PembayaranRow {
  return {
    id: 1, tagihan_id: 7, jumlah: 20000, metode: 'tunai', kas: 'tunai_tu',
    no_kwitansi: 'KW-001', status: 'aktif', catatan: null,
    created_at: '2025-08-01T09:12:00', ...partial,
  };
}

function renderPopover(
  t: TagihanAktif,
  aksi: Partial<{
    onTutup: () => void;
    onBayar: (d: DataBayar) => Promise<void>;
    onUbah: (d: DataUbah) => Promise<void>;
    onHapus: () => Promise<void>;
    onHapusPembayaran: (id: number) => Promise<void>;
    onMuatRiwayat: () => void;
  }> = {},
  riwayat: Partial<{ rows: PembayaranRow[]; busy: boolean; error: string }> = {},
) {
  const p = {
    onTutup: vi.fn(),
    onBayar: vi.fn(() => Promise.resolve()),
    onUbah: vi.fn(() => Promise.resolve()),
    onHapus: vi.fn(() => Promise.resolve()),
    onHapusPembayaran: vi.fn(() => Promise.resolve()),
    onMuatRiwayat: vi.fn(),
    ...aksi,
  };
  const view = renderDenganTema(
    <PopoverAksiTagihan
      tagihan={t}
      anchor={jangkar()}
      daftarTA={DAFTAR_TA}
      riwayat={riwayat.rows ?? []}
      riwayatBusy={riwayat.busy ?? false}
      riwayatError={riwayat.error ?? ''}
      {...p}
    />,
  );
  return { ...p, view };
}

describe('ringkasan tagihan', () => {
  it('memuat nama, ayah, ibu, tagihan, dibayar, dan sisa', () => {
    renderPopover(tagihan());
    expect(screen.getByText('Santri Uji')).toBeInTheDocument();
    expect(screen.getByText('Ayah')).toBeInTheDocument();
    expect(screen.getByText('Bpk. Abdul')).toBeInTheDocument();
    expect(screen.getByText('Ibu')).toBeInTheDocument();
    expect(screen.getByText('Siti Aminah')).toBeInTheDocument();
    expect(screen.getByText('Infaq Bulanan · Jul 2025')).toBeInTheDocument();
    expect(screen.getByText('Rp 75.000')).toBeInTheDocument();
    expect(screen.getByText('Rp 20.000')).toBeInTheDocument();
    expect(screen.getByText('Rp 55.000')).toBeInTheDocument();
    expect(screen.getByText('Jatuh tempo 10 Agu 2025')).toBeInTheDocument();
  });

  it('ayah kosong ditandai garis putus, ibu tetap tampil', () => {
    renderPopover(tagihan({ ayah_nama: null, ibu_nama: 'Siti Aminah' }));
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Siti Aminah')).toBeInTheDocument();
  });

  it('ayah dan ibu kosong keduanya ditandai garis putus', () => {
    renderPopover(tagihan({ ayah_nama: null, ibu_nama: null }));
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('badge status mengikuti kondisi tagihan', () => {
    const { unmount } = renderDenganTema(
      <PopoverAksiTagihan tagihan={tagihan({ terlambat: true })} anchor={jangkar()} daftarTA={DAFTAR_TA}
        riwayat={[]} riwayatBusy={false} riwayatError=""
        onTutup={() => {}} onBayar={async () => {}} onUbah={async () => {}} onHapus={async () => {}} onHapusPembayaran={async () => {}} onMuatRiwayat={() => {}} />,
    );
    expect(screen.getByText('Tunggakan')).toBeInTheDocument();
    unmount();

    renderDenganTema(
      <PopoverAksiTagihan tagihan={tagihan({ terlambat: false, status: 'lunas', sisa: 0 })} anchor={jangkar()} daftarTA={DAFTAR_TA}
        riwayat={[]} riwayatBusy={false} riwayatError=""
        onTutup={() => {}} onBayar={async () => {}} onUbah={async () => {}} onHapus={async () => {}} onHapusPembayaran={async () => {}} onMuatRiwayat={() => {}} />,
    );
    expect(screen.getByText('Lunas')).toBeInTheDocument();
  });

  it('tanpa batas jatuh tempo menampilkan keterangan itu', () => {
    renderPopover(tagihan({ jatuhTempo: null }));
    expect(screen.getByText('Tanpa batas jatuh tempo')).toBeInTheDocument();
  });
});

describe('tab aksi', () => {
  it('memuat empat tab dengan ikon dan label', () => {
    renderPopover(tagihan());
    for (const label of ['Bayar', 'Ubah', 'Hapus', 'Detail']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
  });

  it('tab awal adalah Bayar', () => {
    renderPopover(tagihan());
    expect(screen.getByRole('tab', { name: 'Bayar' })).toHaveAttribute('data-state', 'active');
  });

  it('berpindah tab menampilkan panel yang sesuai', async () => {
    renderPopover(tagihan());
    await userEvent.click(screen.getByRole('tab', { name: 'Ubah' }));
    expect(screen.getByLabelText('Nominal')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Hapus' }));
    expect(screen.getByText(/tidak bisa dibatalkan/)).toBeInTheDocument();
  });
});

describe('panel bayar', () => {
  it('jumlah defaultnya sisa tagihan dan bisa diubah', async () => {
    const { onBayar } = renderPopover(tagihan());
    const input = screen.getByLabelText('Jumlah pembayaran');
    expect(input).toHaveValue(55000);

    await userEvent.clear(input);
    await userEvent.type(input, '25000');
    await userEvent.click(document.getElementById('btn_bayar_simpan') as HTMLElement);
    await waitFor(() => expect(onBayar).toHaveBeenCalledTimes(1));
    expect(onBayar).toHaveBeenCalledWith({ jumlah: 25000, metode: 'tunai', kas: 'tunai_tu' });
  });

  it('tombol Penuh mengisi sisa tagihan', async () => {
    renderPopover(tagihan());
    await userEvent.click(screen.getByRole('button', { name: 'Penuh' }));
    expect(screen.getByLabelText('Jumlah pembayaran')).toHaveValue(55000);
  });

  it('nominal melebihi sisa ditolak beserta pesan', async () => {
    const { onBayar } = renderPopover(tagihan());
    const input = screen.getByLabelText('Jumlah pembayaran');
    await userEvent.clear(input);
    await userEvent.type(input, '999999');
    expect(screen.getByText(/Isi Rp 1 sampai Rp 55.000/)).toBeInTheDocument();
    expect(document.getElementById('btn_bayar_simpan')).toBeDisabled();
    expect(onBayar).not.toHaveBeenCalled();
  });

  it('label Metode dan Posisi Kas ada', () => {
    renderPopover(tagihan());
    expect(screen.getByText('Metode')).toBeInTheDocument();
    expect(screen.getByText('Posisi Kas')).toBeInTheDocument();
    expect(screen.getByLabelText('Metode pembayaran')).toBeInTheDocument();
    expect(screen.getByLabelText('Kas tujuan')).toBeInTheDocument();
  });

  it('tagihan lunas menyembunyikan form bayar', () => {
    renderPopover(tagihan({ status: 'lunas', sisa: 0, terbayar: 75000 }));
    expect(screen.queryByLabelText('Jumlah pembayaran')).toBeNull();
    expect(screen.getByText(/sudah lunas/)).toBeInTheDocument();
  });
});

describe('panel ubah', () => {
  it('mengisi form dari nilai tagihan dan mengirim nilai baru', async () => {
    const { onUbah } = renderPopover(tagihan());
    await userEvent.click(screen.getByRole('tab', { name: 'Ubah' }));

    const nominal = screen.getByLabelText('Nominal');
    expect(nominal).toHaveValue(75000);

    await userEvent.clear(nominal);
    await userEvent.type(nominal, '80000');
    await userEvent.click(document.getElementById('btn_ubah_simpan') as HTMLElement);
    await waitFor(() => expect(onUbah).toHaveBeenCalledTimes(1));
    // Bulanan mengabaikan jatuh tempo manual (aturannya tanggal 10).
    expect(onUbah).toHaveBeenCalledWith({ nominal: 80000, tahun_ajaran: '2025/2026', jatuh_tempo: null });
  });

  it('nominal di bawah nilai terbayar ditolak', async () => {
    const { onUbah } = renderPopover(tagihan());
    await userEvent.click(screen.getByRole('tab', { name: 'Ubah' }));
    const nominal = screen.getByLabelText('Nominal');
    await userEvent.clear(nominal);
    await userEvent.type(nominal, '10000');
    expect(screen.getByText(/Minimal Rp 20.000/)).toBeInTheDocument();
    expect(document.getElementById('btn_ubah_simpan')).toBeDisabled();
    expect(onUbah).not.toHaveBeenCalled();
  });

  it('jatuh tempo otomatis untuk jenis bulanan', async () => {
    renderPopover(tagihan({ tipe: 'bulanan' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Ubah' }));
    expect(screen.getByText(/otomatis: tanggal 10 bulan berjalan/)).toBeInTheDocument();
  });

  it('jatuh tempo bisa diisi untuk jenis non-bulanan', async () => {
    const { onUbah } = renderPopover(tagihan({ tipe: 'non_bulanan', jatuhTempo: null }));
    await userEvent.click(screen.getByRole('tab', { name: 'Ubah' }));
    const tempo = screen.getByLabelText('Jatuh Tempo');
    await userEvent.type(tempo, '2025-09-15');
    await userEvent.click(document.getElementById('btn_ubah_simpan') as HTMLElement);
    await waitFor(() => expect(onUbah).toHaveBeenCalledTimes(1));
    expect(onUbah).toHaveBeenCalledWith({ nominal: 75000, tahun_ajaran: '2025/2026', jatuh_tempo: '2025-09-15' });
  });
});

describe('panel hapus', () => {
  it('menyatakan tindakan tak bisa dibatalkan dan meneruskan saat dikonfirmasi', async () => {
    const { onHapus } = renderPopover(tagihan());
    await userEvent.click(screen.getByRole('tab', { name: 'Hapus' }));
    expect(screen.getByText(/tidak bisa dibatalkan/)).toBeInTheDocument();

    await userEvent.click(document.getElementById('btn_hapus_konfirmasi') as HTMLElement);
    await waitFor(() => expect(onHapus).toHaveBeenCalledTimes(1));
  });

  it('Batal mengembalikan ke tab Bayar tanpa menghapus', async () => {
    const { onHapus } = renderPopover(tagihan());
    await userEvent.click(screen.getByRole('tab', { name: 'Hapus' }));
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(screen.getByRole('tab', { name: 'Bayar' })).toHaveAttribute('data-state', 'active');
    expect(onHapus).not.toHaveBeenCalled();
  });
});

describe('panel detail pembayaran', () => {
  it('meminta riwayat saat tab dibuka', async () => {
    const { onMuatRiwayat } = renderPopover(tagihan());
    expect(onMuatRiwayat).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('tab', { name: 'Detail' }));
    expect(onMuatRiwayat).toHaveBeenCalled();
  });

  it('menampilkan daftar pembayaran', async () => {
    renderPopover(tagihan(), {}, {
      rows: [pembayaran(), pembayaran({ id: 2, jumlah: 35000, metode: 'transfer', kas: 'bank_lembaga', no_kwitansi: null, created_at: '2025-08-05T14:30:00' })],
    });
    await userEvent.click(screen.getByRole('tab', { name: 'Detail' }));
    // Cakupan assertion ke daftar riwayat saja: nominal yang sama bisa muncul
    // juga di ringkasan ("Dibayar").
    const daftar = within(screen.getByRole('list'));
    expect(daftar.getByText('Rp 20.000')).toBeInTheDocument();
    expect(daftar.getByText('Rp 35.000')).toBeInTheDocument();
    expect(daftar.getByText(/Tunai · Kas TU · KW-001/)).toBeInTheDocument();
    expect(daftar.getByText(/Transfer · Bank Lembaga/)).toBeInTheDocument();
    expect(daftar.getByText('01 Agu 2025 09:12')).toBeInTheDocument();
  });

  it('menampilkan keadaan proses', async () => {
    const { view } = renderPopover(tagihan(), {}, { busy: true });
    await userEvent.click(screen.getByRole('tab', { name: 'Detail' }));
    expect(screen.getByText('Memuat riwayat…')).toBeInTheDocument();
    view.unmount();
  });

  it('menampilkan keadaan kosong', async () => {
    const { view } = renderPopover(tagihan(), {}, { busy: false });
    await userEvent.click(screen.getByRole('tab', { name: 'Detail' }));
    expect(screen.getByText(/Belum ada pembayaran/)).toBeInTheDocument();
    view.unmount();
  });

  it('menampilkan pesan galat', async () => {
    renderPopover(tagihan(), {}, { error: 'Gagal memuat riwayat.' });
    await userEvent.click(screen.getByRole('tab', { name: 'Detail' }));
    expect(screen.getByText('Gagal memuat riwayat.')).toBeInTheDocument();
  });
});

describe('tanpa tagihan / jangkar', () => {
  it('tidak merender apa pun', () => {
    const { container } = renderDenganTema(
      <PopoverAksiTagihan tagihan={null} anchor={null} daftarTA={DAFTAR_TA}
        riwayat={[]} riwayatBusy={false} riwayatError=""
        onTutup={() => {}} onBayar={async () => {}} onUbah={async () => {}} onHapus={async () => {}} onHapusPembayaran={async () => {}} onMuatRiwayat={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
