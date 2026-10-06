import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
    santri_id: 7, nama: 'Santri Uji', jenjang: 'MI', paket: 'MI',
    sel: { '1-2025-07': selJul, '1-2025-08': selAgu },
    total_tagihan: 100000, total_terbayar: 0, tunggakan: 0,
  };
}

function renderCrosstab(b: CrosstabBaris, onPilih = () => {}) {
  return render(
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

  it('belum jatuh tempo netral, bukan merah', () => {
    renderCrosstab(baris(sel({ terlambat: true }), sel({ id: 2 })));
    const netral = screen.getAllByRole('button', { name: '50.000' })[1];
    expect(netral.className).not.toContain('text-destructive');
    expect(netral.className).toContain('text-muted-foreground');
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

describe('tooltip sel crosstab', () => {
  it('menyebut TUNGGAKAN dan tanggal jatuh tempo', () => {
    renderCrosstab(baris(sel({ terlambat: true }), sel({ id: 2 })));
    const tooltip = screen.getAllByRole('button', { name: '50.000' })[0].getAttribute('title') ?? '';
    expect(tooltip).toContain('TERLAMBAT');
    expect(tooltip).toContain('jatuh tempo 10 Agu 2025');
  });

  it('menyebut "belum jatuh tempo" bila belum lewat', () => {
    renderCrosstab(baris(sel({ terlambat: true }), sel({ id: 2 })));
    const tooltip = screen.getAllByRole('button', { name: '50.000' })[1].getAttribute('title') ?? '';
    expect(tooltip).toContain('belum jatuh tempo');
    expect(tooltip).not.toContain('TERLAMBAT');
  });

  it('menyebut "tanpa jatuh tempo" untuk tagihan non-bulanan', () => {
    renderCrosstab(baris(sel({ jatuh_tempo: null }), sel({ id: 2, jatuh_tempo: null })));
    const tooltip = screen.getAllByRole('button', { name: '50.000' })[0].getAttribute('title') ?? '';
    expect(tooltip).toContain('tanpa jatuh tempo');
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