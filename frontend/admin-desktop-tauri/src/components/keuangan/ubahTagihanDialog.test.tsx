import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderDenganTema } from '@/test/utils';
import type { CrosstabKolom, CrosstabSel } from '@/api/keuangan';
import type { TahunAjaran } from '@/api/master';
import UbahTagihanDialog, { type TargetUbahTagihan } from './UbahTagihanDialog';

type PanggilUbah = (id: number, data: { nominal: number; tahun_ajaran: string; jatuh_tempo: string | null }) => Promise<unknown>;
const ubahTagihan = vi.hoisted(() => vi.fn<PanggilUbah>(() => Promise.resolve({})));

vi.mock('@/api/keuangan', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/keuangan')>();
  return { ...asli, ubahTagihan: (id: number, data: Parameters<PanggilUbah>[1]) => ubahTagihan(id, data) };
});

const KOLOM_BULANAN: CrosstabKolom = { key: '1-2025-07', jenis_id: 1, jenis_nama: 'Infaq Bulanan', tipe: 'bulanan', periode: '2025-07' };
const KOLOM_NON_BULANAN: CrosstabKolom = { key: 'jenis-2', jenis_id: 2, jenis_nama: 'HIPA', tipe: 'non_bulanan', periode: '2025/2026' };

const TA: TahunAjaran[] = [
  { nama: '2025/2026', is_aktif: true, tanggal_mulai: null, tanggal_selesai: null },
  { nama: '2026/2027', is_aktif: false, tanggal_mulai: null, tanggal_selesai: null },
];

function sel(partial: Partial<CrosstabSel> = {}): CrosstabSel {
  return {
    id: 42, nominal: 75000, terbayar: 0, sisa: 75000, status: 'belum',
    terlambat: false, jatuh_tempo: '2025-08-10', tahun_ajaran: '2025/2026', ...partial,
  };
}

function target(kolom: CrosstabKolom, partial: Partial<CrosstabSel> = {}): TargetUbahTagihan {
  return { sel: sel(partial), kolom, nama: 'Santri Uji', label: `${kolom.jenis_nama} · ${kolom.periode ?? 'sekali'}` };
}

function renderDialog(t: TargetUbahTagihan) {
  const onSelesai = vi.fn();
  renderDenganTema(
    <UbahTagihanDialog open onOpenChange={() => {}} target={t} daftarTA={TA} onSelesai={onSelesai} />,
  );
  return { onSelesai };
}

beforeEach(() => { ubahTagihan.mockClear(); });

describe('UbahTagihanDialog', () => {
  it('menampilkan nominal, tahun ajaran, dan jatuh tempo saat ini', () => {
    renderDialog(target(KOLOM_BULANAN));
    expect(screen.getByLabelText('Nominal')).toHaveValue(75000);
    expect(screen.getByLabelText('Tahun Ajaran')).toHaveValue('2025/2026');
    // Bulanan: jatuh tempo ditampilkan sebagai otomatis, bukan input.
    expect(screen.getByText('10-08-2025')).toBeInTheDocument();
    expect(screen.queryByLabelText('Jatuh Tempo')).toBeNull();
  });

  it('non-bulanan punya input jatuh tempo yang bisa diisi', () => {
    renderDialog(target(KOLOM_NON_BULANAN, { jatuh_tempo: '2025-09-01' }));
    expect(screen.getByLabelText('Jatuh Tempo')).toHaveValue('2025-09-01');
  });

  it('simpan mengirim nominal, TA, dan jatuh tempo', async () => {
    renderDialog(target(KOLOM_NON_BULANAN, { jatuh_tempo: null }));
    await userEvent.clear(screen.getByLabelText('Nominal'));
    await userEvent.type(screen.getByLabelText('Nominal'), '90000');
    await userEvent.selectOptions(screen.getByLabelText('Tahun Ajaran'), '2026/2027');
    await userEvent.type(screen.getByLabelText('Jatuh Tempo'), '2026-08-15');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));

    await waitFor(() => expect(ubahTagihan).toHaveBeenCalledTimes(1));
    expect(ubahTagihan).toHaveBeenCalledWith(42, {
      nominal: 90000, tahun_ajaran: '2026/2027', jatuh_tempo: '2026-08-15',
    });
  });

  it('bulanan mengirim jatuh tempo null (menurut aturan tanggal 10)', async () => {
    renderDialog(target(KOLOM_BULANAN));
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    await waitFor(() => expect(ubahTagihan).toHaveBeenCalledTimes(1));
    expect(ubahTagihan.mock.calls[0][1].jatuh_tempo).toBeNull();
  });

  it('nominal di bawah nilai terbayar ditolak (tombol nonaktif)', () => {
    renderDialog(target(KOLOM_BULANAN, { nominal: 100000, terbayar: 90000, sisa: 10000, status: 'sebagian' }));
    const tombol = screen.getByRole('button', { name: 'Simpan' });
    expect(tombol).toBeEnabled();

    const input = screen.getByLabelText('Nominal');
    expect(input).toHaveAttribute('min', '90000');
    return userEvent.clear(input).then(() => userEvent.type(input, '50000')).then(() => {
      expect(screen.getByRole('button', { name: 'Simpan' })).toBeDisabled();
      expect(screen.getByText(/tidak boleh lebih kecil/i)).toBeInTheDocument();
    });
  });

  it('nominal kosong membuat tombol Simpan nonaktif', async () => {
    renderDialog(target(KOLOM_BULANAN));
    await userEvent.clear(screen.getByLabelText('Nominal'));
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeDisabled();
  });
});