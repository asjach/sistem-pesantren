import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderDenganTema } from '@/test/utils';
import type { ExcelField } from './ExcelTable';

// ---- Mock API preset (unit test tidak boleh memanggil fetch nyata) ----

const { muatUrutPreset, listPresetTabel } = vi.hoisted(() => ({
  muatUrutPreset: vi.fn((..._a: unknown[]): Promise<unknown> => Promise.resolve({
    pesan: 'ok',
    data: { table_key: 'uji', opsi: [], tersedia: [] },
  })),
  listPresetTabel: vi.fn((..._a: unknown[]): Promise<unknown> => Promise.resolve({
    pesan: 'ok',
    data: { presets: [], aktif_preset_id: null, aktif_kolom: null, aktif_label: null, default_preset_id: null },
  })),
}));

vi.mock('@/api/urutPreset', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/urutPreset')>();
  return { ...asli, muatUrutPreset: (...a: unknown[]) => muatUrutPreset(...a) };
});

vi.mock('@/api/preset', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/preset')>();
  return { ...asli, listPresetTabel: (...a: unknown[]) => listPresetTabel(...a) };
});

import PresetUrut from './PresetUrut';
import PresetKolom from './PresetKolom';

const FIELDS = [{ key: 'a', label: 'A' }] as ExcelField[];

function presetUrut(opsi: Array<{ kode: string[]; label: string }>, urutAktif: string[] = []) {
  muatUrutPreset.mockResolvedValue({
    pesan: 'ok',
    data: { table_key: 'uji', opsi, tersedia: [] },
  });
  return renderDenganTema(
    <PresetUrut tableKey="uji" urutAktif={urutAktif} arahUrut="naik" onUrut={() => {}} />,
  );
}

function presetKolom(jumlah: number) {
  listPresetTabel.mockResolvedValue({
    pesan: 'ok',
    data: {
      presets: Array.from({ length: jumlah }, (_, i) => ({ id: i + 1, nama: `Preset ${i + 1}`, kolom: ['a'] })),
      aktif_preset_id: null,
      aktif_kolom: null,
      aktif_label: null,
      default_preset_id: null,
    },
  });
  return renderDenganTema(
    <PresetKolom tableKey="uji" fields={FIELDS} onApply={() => {}} />,
  );
}

describe('dropdown Urutkan — tampil hanya bila pilihan > 1', () => {
  it('tersembunyi saat tidak ada preset (hanya "—")', async () => {
    presetUrut([]);
    await waitFor(() => expect(screen.queryByText('Urutkan')).toBeNull());
  });

  it('tetap tampil saat ada 1 preset (2 item: "—" + preset)', async () => {
    presetUrut([{ kode: ['a'], label: 'Nama' }]);
    expect(await screen.findByText('Urutkan')).toBeInTheDocument();
  });

  it('tampil saat ada 2 preset', async () => {
    presetUrut([
      { kode: ['a'], label: 'Nama' },
      { kode: ['b'], label: 'Kelas' },
    ]);
    expect(await screen.findByText('Urutkan')).toBeInTheDocument();
  });

  it('tetap tampil saat urutan sedang aktif walau tanpa preset (arah bisa dibalik)', async () => {
    presetUrut([], ['a']);
    expect(await screen.findByText('Urutkan')).toBeInTheDocument();
  });
});

describe('dropdown Kolom — tampil hanya bila pilihan > 1', () => {
  it('tersembunyi saat tidak ada preset (hanya "Lengkap")', async () => {
    presetKolom(0);
    await waitFor(() => expect(screen.queryByText('Kolom')).toBeNull());
  });

  it('tetap tampil saat ada 1 preset (2 item: "Lengkap" + preset)', async () => {
    presetKolom(1);
    expect(await screen.findByText('Kolom')).toBeInTheDocument();
  });
});
