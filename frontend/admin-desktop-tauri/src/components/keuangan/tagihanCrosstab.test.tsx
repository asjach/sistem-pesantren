import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderDenganTema } from '@/test/utils';
import type { CrosstabBaris, CrosstabKolom, CrosstabSel } from '@/api/keuangan';
import TagihanCrosstab from './TagihanCrosstab';

const KOLOM: CrosstabKolom[] = [
  { key: '1-2025-07', jenis_id: 1, jenis_nama: 'Infaq Bulanan', tipe: 'bulanan', periode: '2025-07' },
  { key: '1-2025-08', jenis_id: 1, jenis_nama: 'Infaq Bulanan', tipe: 'bulanan', periode: '2025-08' },
];

function sel(partial: Partial<CrosstabSel>): CrosstabSel {
  return {
    id: 1, nominal: 50000, terbayar: 0, sisa: 50000,
    status: 'belum', jatuh_tempo: '2025-08-10', terlambat: false, ...partial,
  };
}

function baris(selJul: CrosstabSel, selAgu: CrosstabSel): CrosstabBaris {
  return {
    santri_id: 7, nama: 'Santri Uji', jenjang: 'MI',
    sel: { '1-2025-07': selJul, '1-2025-08': selAgu },
    total_tagihan: 100000, total_terbayar: 0, tunggakan: 0,
  };
}

function renderCrosstab(b: CrosstabBaris, onPilih = () => {}, aksi: Partial<{
  onBayar: (sel: CrosstabSel, meta: { nama: string; label: string }) => void;
  onRiwayat: (sel: CrosstabSel, meta: { nama: string; label: string }) => void;
  onHapus: (sel: CrosstabSel, meta: { nama: string; label: string }) => void;
}> = {}) {
  return renderDenganTema(
    <TagihanCrosstab
      data={{ kolom: KOLOM, baris: [b], total: 1, per_page: 25, current_page: 1, last_page: 1 }}
      loading={false}
      terpilihId={null}
      onPilih={onPilih}
      emptyText="Kosong"
      {...aksi}
    />,
  );
}

describe('warna sel crosstab menurut jatuh tempo', () => {
  it('terlambat merah + tebal', () => {
    renderCrosstab(baris(sel({ terlambat: true }), sel({ id: 2 })));
    const merah = screen.getAllByRole('button', { name: '50.000' })[0];
    expect(merah.className).toContain('text-destructive');
    expect(merah.className).toContain('font-semibold');
  });

  it('belum jatuh tempo dibuat samar, bukan merah', () => {
    renderCrosstab(baris(sel({ terlambat: true }), sel({ id: 2 })));
    const netral = screen.getAllByRole('button', { name: '50.000' })[1];
    expect(netral.className).not.toContain('text-destructive');
    // Samar: teks pudar, bukan warna penuh seperti sel tunggakan.
    expect(netral.className).toContain('text-muted-foreground/50');
    expect(netral.className).toContain('bg-muted/20');
  });

  it('lunas hijau walau jatuh tempo sudah lewat', () => {
    renderCrosstab(baris(
      sel({ status: 'lunas', sisa: 0, terbayar: 50000 }),
      sel({ id: 2, status: 'lunas', sisa: 0, terbayar: 50000 }),
    ));
    for (const tombol of screen.getAllByRole('button')) {
      expect(tombol.className).toContain('text-emerald-700');
      expect(tombol.className).not.toContain('text-destructive');
    }
  });
});

describe('tooltip hover sel crosstab', () => {
  async function hoverSel(i: number) {
    const tombol = screen.getAllByRole('button', { name: '50.000' })[i];
    await userEvent.hover(tombol);
    return screen.getByRole('tooltip');
  }

  it('menampilkan nama, tarif, nominal, terbayar, sisa, dan periode bulanan', async () => {
    renderCrosstab(baris(sel({ terlambat: true }), sel({ id: 2 })));
    const tip = await hoverSel(0);
    expect(tip).toHaveTextContent('Santri Uji');
    expect(tip).toHaveTextContent('Nama Tarif');
    expect(tip).toHaveTextContent('Infaq Bulanan');
    expect(tip).toHaveTextContent('Periode');
    expect(tip).toHaveTextContent('Jul 2025');
    expect(tip).toHaveTextContent('Rp 50.000');
  });

  it('menandai TUNGGAKAN + tanggal jatuh tempo', async () => {
    renderCrosstab(baris(sel({ terlambat: true }), sel({ id: 2 })));
    const tip = await hoverSel(0);
    expect(tip).toHaveTextContent('Tunggakan');
    expect(tip).toHaveTextContent('jatuh tempo 10 Agu 2025');
  });

  it('menandai belum jatuh tempo bila belum lewat', async () => {
    renderCrosstab(baris(sel({ terlambat: true }), sel({ id: 2 })));
    const tip = await hoverSel(1);
    expect(tip).toHaveTextContent('Belum jatuh tempo');
    expect(tip).not.toHaveTextContent('Tunggakan');
  });

  it('tanpa batas = Tunggakan, tanpa baris Periode', async () => {
    renderCrosstab(baris(
      sel({ jatuh_tempo: null, terlambat: true }),
      sel({ id: 2, jatuh_tempo: null, terlambat: true }),
    ));
    const tip = await hoverSel(0);
    expect(tip).toHaveTextContent('Tunggakan');
    expect(tip).toHaveTextContent('tanpa batas jatuh tempo');
  });
});

describe('klik sel tetap meneruskan data', () => {
  it('memanggil onPilih dengan nama & label', () => {
    const onPilih = vi.fn();
    renderCrosstab(baris(sel({ terlambat: true }), sel({ id: 2 })), onPilih);
    screen.getAllByRole('button', { name: '50.000' })[0].click();
    expect(onPilih).toHaveBeenCalledTimes(1);
    expect(onPilih.mock.calls[0][1]).toMatchObject({ nama: 'Santri Uji' });
  });
});
describe('context menu sel tagihan', () => {
  async function bukaMenu(i = 0) {
    fireEvent.contextMenu(screen.getAllByRole('button', { name: '50.000' })[i]);
    return screen.findByRole('menu');
  }

  it('klik kanan juga menandai sel sebagai terpilih (isi bar aksi)', async () => {
    const onPilih = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), onPilih, {
      onBayar: () => {}, onRiwayat: () => {}, onHapus: () => {},
    });
    await bukaMenu(1);
    expect(onPilih).toHaveBeenCalledTimes(1);
    expect(onPilih.mock.calls[0][0].id).toBe(2);
  });

  it('isi menu: bayar, riwayat, hapus', async () => {
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, {
      onBayar: () => {}, onRiwayat: () => {}, onHapus: () => {},
    });
    await bukaMenu();
    const menu = await screen.findByRole('menu');
    expect(menu).toHaveTextContent('Bayar');
    expect(menu).toHaveTextContent('Lihat riwayat pembayaran');
    expect(menu).toHaveTextContent('Hapus tagihan');
  });

  it('pilih "Bayar" meneruskan sel & metadata', async () => {
    const onBayar = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, { onBayar });
    await bukaMenu();
    await userEvent.click(await screen.findByText('Bayar'));
    expect(onBayar).toHaveBeenCalledTimes(1);
    expect(onBayar.mock.calls[0][0].id).toBe(1);
    expect(onBayar.mock.calls[0][1]).toMatchObject({ nama: 'Santri Uji', label: 'Infaq Bulanan · Jul 2025' });
  });

  it('pilih "Lihat riwayat pembayaran" meneruskan sel', async () => {
    const onRiwayat = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, { onRiwayat });
    await bukaMenu();
    await userEvent.click(await screen.findByText('Lihat riwayat pembayaran'));
    expect(onRiwayat.mock.calls[0][0].id).toBe(1);
  });

  it('pilih "Hapus tagihan" meneruskan id tagihan', async () => {
    const onHapus = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, { onHapus });
    await bukaMenu();
    await userEvent.click(await screen.findByText('Hapus tagihan'));
    expect(onHapus.mock.calls[0][0].id).toBe(1);
  });

  it('item "Bayar" nonaktif pada sel lunas (Radix pakai aria-disabled)', async () => {
    const onBayar = vi.fn();
    renderCrosstab(baris(
      sel({ status: 'lunas', sisa: 0, terbayar: 50000 }),
      sel({ id: 2 }),
    ), () => {}, { onBayar });
    await bukaMenu();
    const item = await screen.findByRole('menuitem', { name: 'Bayar' });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(item);
    expect(onBayar).not.toHaveBeenCalled();
  });

  it('tanpa handler = tidak ada menu sama sekali', async () => {
    renderCrosstab(baris(sel({}), sel({ id: 2 })));
    fireEvent.contextMenu(screen.getAllByRole('button', { name: '50.000' })[0]);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('hanya sebagian handler = menu berisi item itu saja', async () => {
    renderCrosstab(baris(sel({}), sel({ id: 2 })), () => {}, { onRiwayat: () => {} });
    await bukaMenu();
    const menu = await screen.findByRole('menu');
    expect(menu).toHaveTextContent('Lihat riwayat pembayaran');
    expect(menu).not.toHaveTextContent('Hapus tagihan');
  });
});
