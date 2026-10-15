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
    id: 'MI|2025/2026|1|11', jenjang: 'MI', tahun_ajaran: '2025/2026',
    jenis_id: 1, jenis: 'Infaq Bulanan', paket_id: 11, paket: 'Khusus MI',
    jumlah_tagihan: 2, jumlah_penerima: 2, total_potongan: 50000,
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

/** Rekap dampak dispensasi per paket × jenis tagihan: angka dari baris tagihan
 *  (bukan dari definisi paket), jadi potongan tiap paket adalah porsinya. */
describe('RekapDispensasiTab', () => {
  it('menampilkan angka per paket + ringkasan lintas baris', async () => {
    renderRekap([
      baris({ id: 'MI|2025/2026|1|11', jenjang: 'MI', jenis: 'Infaq Bulanan', paket: 'Khusus MI', jumlah_tagihan: 2, jumlah_penerima: 2, total_potongan: 50000 }),
      baris({ id: 'MD|2025/2026|2|12', jenjang: 'MD', tahun_ajaran: '2026/2027', jenis_id: 2, jenis: 'Biaya Masuk', paket_id: 12, paket: 'Semua Lembaga', jumlah_tagihan: 1, jumlah_penerima: 1, total_potongan: 10000 }),
    ]);

    expect(screen.getByText('Rekap Dampak per Paket')).toBeInTheDocument();
    // Ringkasan = jumlah baris yang tampil (bukan kolom dari server).
    expect(await screen.findByText('3 tagihan · Rp 60.000')).toBeInTheDocument();
    // Nama paket & jenis tagihan tampil apa adanya; rupiah dipisah ribuan.
    expect(await screen.findByText('Khusus MI')).toBeInTheDocument();
    expect(await screen.findByText('Biaya Masuk')).toBeInTheDocument();
    expect((await screen.findAllByText('Rp 50.000')).length).toBeGreaterThan(0);
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
