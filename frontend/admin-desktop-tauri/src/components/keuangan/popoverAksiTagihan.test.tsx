import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderDenganTema } from '@/test/utils';
import PopoverAksiTagihan, { type TagihanAktif } from './PopoverAksiTagihan';

function tagihan(partial: Partial<TagihanAktif> = {}): TagihanAktif {
  return {
    id: 7, nama: 'Santri Uji', label: 'Infaq Bulanan · Jul 2025',
    nominal: 75000, sisa: 75000, status: 'belum', terlambat: true,
    jatuhTempo: '2025-08-10', tipe: 'bulanan', ...partial,
  };
}

/** Popover butuh jangkar elemen nyata (getBoundingClientRect). */
function jangkar(): HTMLElement {
  const el = document.createElement('button');
  el.getBoundingClientRect = () => new DOMRect(10, 10, 60, 20);
  document.body.appendChild(el);
  return el;
}

function renderPopover(t: TagihanAktif, aksi: Partial<{
  onTutup: () => void;
  onBayar: (d: { jumlah: number; metode: 'tunai' | 'transfer'; kas: 'tunai_tu' | 'bank_lembaga' | 'bank_pesantren' }) => Promise<void>;
  onUbah: () => void;
  onRiwayat: () => void;
  onHapus: () => void;
}> = {}) {
  const defaults = {
    onTutup: vi.fn(),
    onBayar: vi.fn(() => Promise.resolve()),
    onUbah: vi.fn(),
    onRiwayat: vi.fn(),
    onHapus: vi.fn(),
  };
  const p = { ...defaults, ...aksi };
  renderDenganTema(
    <PopoverAksiTagihan tagihan={t} anchor={jangkar()} {...p} />,
  );
  return p;
}

describe('PopoverAksiTagihan', () => {
  it('ringkasan memuat jenis, nama, sisa, dan tanggal jatuh tempo', () => {
    renderPopover(tagihan());
    expect(screen.getByText('Infaq Bulanan · Jul 2025')).toBeInTheDocument();
    expect(screen.getByText('Santri Uji')).toBeInTheDocument();
    expect(screen.getByText('Rp 75.000')).toBeInTheDocument();
    expect(screen.getByText('Jatuh tempo 10 Agu 2025')).toBeInTheDocument();
  });

  it('badge status mengikuti kondisi tagihan', () => {
    const { unmount } = renderDenganTema(<PopoverAksiTagihan tagihan={tagihan({ terlambat: true })} anchor={jangkar()} onTutup={() => {}} onBayar={async () => {}} onUbah={() => {}} onRiwayat={() => {}} onHapus={() => {}} />);
    expect(screen.getByText('Tunggakan')).toBeInTheDocument();
    unmount();

    renderDenganTema(<PopoverAksiTagihan tagihan={tagihan({ terlambat: false })} anchor={jangkar()} onTutup={() => {}} onBayar={async () => {}} onUbah={() => {}} onRiwayat={() => {}} onHapus={() => {}} />);
    expect(screen.getByText('Belum jatuh tempo')).toBeInTheDocument();
  });

  it('jumlah pembayaran terisi sisa tagihan secara default', () => {
    renderPopover(tagihan({ nominal: 100000, sisa: 40000, status: 'sebagian' }));
    expect(screen.getByLabelText('Jumlah pembayaran')).toHaveValue(40000);
  });

  it('tombol Penuh mengisi jumlah dengan sisa', async () => {
    renderPopover(tagihan({ nominal: 100000, sisa: 40000, status: 'sebagian' }));
    await userEvent.clear(screen.getByLabelText('Jumlah pembayaran'));
    await userEvent.click(screen.getByRole('button', { name: 'Penuh' }));
    expect(screen.getByLabelText('Jumlah pembayaran')).toHaveValue(40000);
  });

  it('jumlah melebihi sisa ditolak dengan pesan batas', async () => {
    renderPopover(tagihan({ nominal: 100000, sisa: 40000, status: 'sebagian' }));
    const input = screen.getByLabelText('Jumlah pembayaran');
    await userEvent.clear(input);
    await userEvent.type(input, '50000');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/Isi Rp 1 sampai Rp 40.000/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bayar' })).toBeDisabled();
  });

  it('jumlah 0 / kosong tidak bisa dibayar', async () => {
    renderPopover(tagihan());
    const input = screen.getByLabelText('Jumlah pembayaran');
    await userEvent.clear(input);
    expect(screen.getByRole('button', { name: 'Bayar' })).toBeDisabled();
    await userEvent.type(input, '0');
    expect(screen.getByRole('button', { name: 'Bayar' })).toBeDisabled();
  });

  it('bayar meneruskan jumlah, metode, dan kas', async () => {
    const { onBayar } = renderPopover(tagihan());
    await userEvent.click(screen.getByRole('button', { name: 'Bayar' }));
    expect(onBayar).toHaveBeenCalledTimes(1);
    expect(onBayar).toHaveBeenCalledWith({ jumlah: 75000, metode: 'tunai', kas: 'tunai_tu' });
  });

  it('metode & kas bisa diganti sebelum bayar', async () => {
    const { onBayar } = renderPopover(tagihan());
    await userEvent.selectOptions(screen.getByLabelText('Metode pembayaran'), 'transfer');
    await userEvent.selectOptions(screen.getByLabelText('Kas tujuan'), 'bank_lembaga');
    await userEvent.click(screen.getByRole('button', { name: 'Bayar' }));
    expect(onBayar).toHaveBeenCalledWith({ jumlah: 75000, metode: 'transfer', kas: 'bank_lembaga' });
  });

  it('sel lunas: form pembayaran disembunyikan, sisa tampil hijau', () => {
    renderPopover(tagihan({ nominal: 75000, sisa: 0, status: 'lunas', terlambat: false }));
    expect(screen.getByText('Lunas')).toBeInTheDocument();
    expect(screen.queryByLabelText('Jumlah pembayaran')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Bayar' })).toBeNull();
    // Aksi lain tetap tersedia.
    expect(screen.getByRole('button', { name: /Ubah tagihan/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lihat riwayat/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hapus tagihan/ })).toBeInTheDocument();
  });

  it('tanpa batas jatuh tempo menampilkan keterangan itu', () => {
    renderPopover(tagihan({ jatuhTempo: null }));
    expect(screen.getByText('Tanpa batas jatuh tempo')).toBeInTheDocument();
  });

  it('tiga aksi meneruskan ke handler yang benar', async () => {
    const { onUbah, onRiwayat, onHapus } = renderPopover(tagihan());
    await userEvent.click(screen.getByRole('button', { name: /Ubah tagihan/ }));
    await userEvent.click(screen.getByRole('button', { name: /Lihat riwayat/ }));
    await userEvent.click(screen.getByRole('button', { name: /Hapus tagihan/ }));
    expect(onUbah).toHaveBeenCalledTimes(1);
    expect(onRiwayat).toHaveBeenCalledTimes(1);
    expect(onHapus).toHaveBeenCalledTimes(1);
  });

  it('tanpa tagihan / jangkar = tidak ada yang dirender', () => {
    const { container } = renderDenganTema(
      <PopoverAksiTagihan tagihan={null} anchor={null} onTutup={() => {}} onBayar={async () => {}} onUbah={() => {}} onRiwayat={() => {}} onHapus={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});