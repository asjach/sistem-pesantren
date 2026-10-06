import { fireEvent, render, screen } from '@testing-library/react';
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
    status: 'belum', jatuh_tempo: '2025-08-10', terlambat: false, tahun_ajaran: '2025/2026', ...partial,
  };
}

function baris(selJul: CrosstabSel, selAgu: CrosstabSel): CrosstabBaris {
  return {
    santri_id: 7, nama: 'Santri Uji', jenjang: 'MI',
    sel: { '1-2025-07': selJul, '1-2025-08': selAgu },
    total_tagihan: 100000, total_terbayar: 0, tunggakan: 0,
  };
}

function renderCrosstab(b: CrosstabBaris, onPilih = () => {}) {
  return renderDenganTema(
    <TagihanCrosstab
      data={{ kolom: KOLOM, baris: [b], total: 1, per_page: 25, current_page: 1, last_page: 1 }}
      loading={false}
      terpilihId={null}
      onPilih={onPilih}
      emptyText="Kosong"
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
describe('sel tagihan: klik kiri = klik kanan', () => {
  it('klik kiri melaporkan sel + jangkar elemen sel', async () => {
    const onPilih = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), onPilih);
    const tombol = screen.getAllByRole('button', { name: '50.000' })[1];
    await userEvent.click(tombol);
    expect(onPilih).toHaveBeenCalledTimes(1);
    expect(onPilih.mock.calls[0][0].id).toBe(2);
    expect(onPilih.mock.calls[0][1]).toMatchObject({ nama: 'Santri Uji', label: 'Infaq Bulanan · Agu 2025' });
    // Argumen ketiga = elemen sel, dipakai halaman sebagai jangkar popover.
    expect(onPilih.mock.calls[0][2]).toBe(tombol);
  });

  it('klik kanan melapor dengan cara yang sama', () => {
    const onPilih = vi.fn();
    renderCrosstab(baris(sel({}), sel({ id: 2 })), onPilih);
    const tombol = screen.getAllByRole('button', { name: '50.000' })[0];
    fireEvent.contextMenu(tombol);
    expect(onPilih).toHaveBeenCalledTimes(1);
    expect(onPilih.mock.calls[0][0].id).toBe(1);
    expect(onPilih.mock.calls[0][2]).toBe(tombol);
  });

  it('klik kanan tidak memunculkan menu browser (preventDefault)', () => {
    renderCrosstab(baris(sel({}), sel({ id: 2 })));
    const tombol = screen.getAllByRole('button', { name: '50.000' })[0];
    const peristiwa = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    fireEvent(tombol, peristiwa);
    expect(peristiwa.defaultPrevented).toBe(true);
  });

  it('sel terpilih diberi cincin (terpilihId)', () => {
    render(
      <TagihanCrosstab
        data={{ kolom: KOLOM, baris: [baris(sel({}), sel({ id: 2 }))], total: 1, per_page: 25, current_page: 1, last_page: 1 }}
        loading={false}
        terpilihId={2}
        onPilih={() => {}}
        emptyText="Kosong"
      />,
    );
    const aktif = screen.getAllByRole('button', { name: '50.000' })[1];
    expect(aktif.className).toContain('ring-2');
  });
});
