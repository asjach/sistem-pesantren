import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { RekapDispensasi } from '@/api/keuangan';
import { renderDenganTema } from '@/test/utils';
import { resetSetelanKomponen } from '@/components/komponenCustom';
import { RekapDispensasiTab } from './tabKeuangan';

vi.mock('@/api/toolbarPreset', () => ({
  muatToolbarPreset: vi.fn(async () => ({
    pesan: 'ok',
    data: { table_key: 'uji', visibilitas: {}, lebar: {}, urutan: [] },
  })),
  simpanToolbarPreset: vi.fn(async () => ({ pesan: 'ok', data: null })),
}));

vi.mock('@/api/preset', () => ({
  listPresetTabel: vi.fn(async () => ({ pesan: 'ok', data: [] })),
  createPresetTabel: vi.fn(),
  updatePresetTabel: vi.fn(),
  deletePresetTabel: vi.fn(),
  setPresetAktif: vi.fn(),
  setPresetBawaan: vi.fn(),
}));

vi.mock('@/api/urutPreset', () => ({
  muatUrutPreset: vi.fn(async () => ({ pesan: 'ok', data: { table_key: 'uji', opsi: [], tersedia: [] } })),
  simpanUrutPreset: vi.fn(),
  hapusUrutPreset: vi.fn(),
  arahKolomDariOpsi: vi.fn(() => undefined),
}));

vi.mock('@/api/komponenCustom', () => ({
  muatKomponenCustom: vi.fn(async () => ({ pesan: '', data: { peta: {} } })),
  simpanKomponenCustom: vi.fn(async () => ({ pesan: '', data: {} })),
  hapusKomponenCustom: vi.fn(async () => ({ pesan: '' })),
}));

// ---- Stub jsdom untuk react-datasheet-grid (grid tak bisa hidup di jsdom) ----

vi.mock('react-datasheet-grid', async (importOriginal) => {
  const asli = await importOriginal<typeof import('react-datasheet-grid')>();
  const stub = await import('@/components/excel/_dsgStubDom');
  return { ...asli, DynamicDataSheetGrid: stub.DynamicDataSheetGridStub };
});

function baris(partial: Partial<RekapDispensasi> = {}): RekapDispensasi {
  return {
    id: 'MI', jenjang: 'MI',
    jumlah_tagihan: 2, jumlah_penerima: 2, total_potongan: 50000, jumlah_paket: 2,
    ...partial,
  };
}

const OPSI_PAKET = [
  { nilai: null, label: 'Semua paket' },
  { nilai: 11, label: 'Khusus MI' },
];

function renderRekap(
  rows: RekapDispensasi[] = [baris()],
  props: Partial<{
    paket: number | null;
    onPaket: (nilai: number | null) => void;
    loading: boolean;
  }> = {},
) {
  resetSetelanKomponen();
  const onPaket = props.onPaket ?? vi.fn();
  const ringkas = rows.reduce(
    (a, r) => ({ tagihan: a.tagihan + r.jumlah_tagihan, potongan: a.potongan + r.total_potongan }),
    { tagihan: 0, potongan: 0 },
  );
  const view = renderDenganTema(
    <RekapDispensasiTab
      rows={rows}
      loading={props.loading ?? false}
      sort={{ urut: [], arah: 'naik', terapkan: () => {} }}
      paket={props.paket ?? null}
      opsiPaket={OPSI_PAKET}
      onPaket={onPaket}
      ringkas={ringkas}
    />,
  );
  return { onPaket, view };
}

/** Rekap dampak dispensasi per lembaga: angka dari baris tagihan (bukan dari
 *  definisi paket), jadi paket berlingkup lembaga lain kelihatan di sini. */
describe('RekapDispensasiTab', () => {
  it('menampilkan angka per lembaga + ringkasan lintas lembaga', async () => {
    renderRekap([
      baris({ id: 'MI', jenjang: 'MI', jumlah_tagihan: 2, jumlah_penerima: 2, total_potongan: 50000, jumlah_paket: 2 }),
      baris({ id: 'MD', jenjang: 'MD', jumlah_tagihan: 1, jumlah_penerima: 1, total_potongan: 10000, jumlah_paket: 1 }),
    ]);

    expect(screen.getByText('Rekap Dampak per Lembaga')).toBeInTheDocument();
    // Ringkasan = jumlah baris yang tampil (bukan kolom dari server).
    expect(await screen.findByText('3 tagihan · Rp 60.000')).toBeInTheDocument();
    // Angka rupiah dipisah ribuan, jumlah paket apa adanya.
    expect(await screen.findByText('Rp 50.000')).toBeInTheDocument();
  });

  it('pemilih paket memuat opsi halaman dan mengabarkan pilihan', async () => {
    const { onPaket } = renderRekap();
    await userEvent.click(screen.getByLabelText('Paket dispensasi rekap'));
    await userEvent.click(screen.getByRole('option', { name: 'Khusus MI' }));

    expect(onPaket).toHaveBeenCalledWith(11);
  });

  it('pesan kosong membedakan \"belum ada\" dengan \"paket ini belum dipakai\"', async () => {
    renderRekap([], { paket: 11 });
    expect(await screen.findByText('Paket ini belum dipakai satu tagihan pun pada lingkup filter ini.')).toBeInTheDocument();
  });
});
