import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import DialogKelolaTabel from './DialogKelolaTabel';
import { renderDenganTema } from '@/test/utils';
import type { ModeSemuaFilterGlobal, TampilFilterGlobal } from '@/lib/filterHalaman';
import type { KunciFilterGlobal } from '@/components/VisibilitasFilter';

vi.mock('@/api/preset', () => ({
  listPresetTabel: vi.fn(async () => ({
    pesan: 'ok',
    data: {
      presets: [
        {
          id: 7,
          jenjang: null,
          table_key: 'uji',
          nama: 'Preset Uji',
          kolom: ['nama', 'kode'],
          label: null,
          is_default: false,
          lembaga: null,
        },
      ],
      aktif_preset_id: 7,
      default_preset_id: null,
      aktif_kolom: null,
      aktif_label: null,
    },
  })),
  setPresetAktif: vi.fn(async () => ({ pesan: 'ok', data: null })),
  simpanPresetTabel: vi.fn(async () => ({ pesan: 'ok', data: { id: 9 } })),
  hapusPresetTabel: vi.fn(async () => ({ pesan: 'ok', data: null })),
}));

vi.mock('@/api/toolbarPreset', () => ({
  muatToolbarPreset: vi.fn(async () => ({
    pesan: 'ok',
    data: { table_key: 'uji', visibilitas: {}, lebar: {}, urutan: [], align: {} },
  })),
  simpanToolbarPreset: vi.fn(async () => ({ pesan: 'ok', data: null })),
}));

vi.mock('@/lembagaAktif', async (asli) => ({
  ...(await asli()),
  useLembagaAktif: () => ({ efektifSuper: true }),
}));

const fields = [
  { key: 'nama', label: 'Nama Lengkap', kind: 'static' as const },
  { key: 'kode', label: 'Kode', kind: 'static' as const },
];

function renderDialog(filterRelevan: KunciFilterGlobal[] = []) {
  const tampil = (Object.fromEntries(
    filterRelevan.map((k) => [k, true]),
  ) ?? {}) as TampilFilterGlobal;
  const mode = (Object.fromEntries(
    filterRelevan.map((k) => [k, 'multiple']),
  ) ?? {}) as ModeSemuaFilterGlobal;

  return renderDenganTema(
    <DialogKelolaTabel
      open
      onOpenChange={() => {}}
      tableKey="uji"
      judul="Santri"
      fields={fields}
      filterRelevan={filterRelevan}
      filterBawaan={tampil}
      filterModeBawaan={mode}
    />,
  );
}

/** Panel tab "Nama & Perataan" (input edit nama kolom pertama). */
function panelNamaPerataan() {
  return screen.getByLabelText('Nama & Perataan');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DialogKelolaTabel — navigasi tab', () => {
  it('menampilkan tab untuk tiap bagian, dan tab Filter hanya bila ada filter', async () => {
    renderDialog();
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent?.replace(/\s+/g, ' ').trim());
    expect(tabs).toEqual(['Kolom', 'Nama & Perataan', 'Urutan', 'Toolbar']);

    await waitFor(() => expect(screen.getByLabelText('Kolom')).toBeInTheDocument());
  });

  it('menampilkan tab Filter bila halaman punya filter relevan', async () => {
    renderDialog(['lembaga']);
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent?.trim());
    expect(tabs).toContain('Filter');
  });

  it('hanya menampilkan isi tab yang aktif', async () => {
    renderDialog();
    await waitFor(() => expect(screen.getByLabelText('Kolom')).toBeInTheDocument());
    const kolom = screen.getByLabelText('Kolom');
    expect(within(kolom).getByText(/Nama Lengkap/)).toBeInTheDocument();
    // Panel tab lain tetap ter-render (forceMount, supaya state tidak hilang)
    // tapi ditandai tidak aktif; sembunyannya_guard CSS `data-[state=inactive]:hidden`.
    const panel = screen.getByLabelText('Urutan').closest('[data-slot="tabs-content"]');
    expect(panel).toHaveAttribute('data-state', 'inactive');
    expect(panel?.className).toContain('data-[state=inactive]:hidden');
    expect(screen.getByLabelText('Kolom').closest('[data-slot="tabs-content"]'))
      .toHaveAttribute('data-state', 'active');
  });

  it('berpindah tab saat tab lain diklik', async () => {
    renderDialog();
    await waitFor(() => expect(screen.getByLabelText('Kolom')).toBeInTheDocument());
    // Radix TabsTrigger aktif pada mousedown, bukan click — pakai userEvent.
    await userEvent.click(screen.getByRole('tab', { name: /Nama & Perataan/ }));
    await waitFor(() => expect(panelNamaPerataan()).toBeVisible());
    expect(screen.getByLabelText('Kolom').closest('[data-slot="tabs-content"]'))
      .toHaveAttribute('data-state', 'inactive');
  });

  it('state tiap tab bertahan saat pindah tab (perubahan tidak hilang)', async () => {
    renderDialog();
    await waitFor(() => expect(panelNamaPerataan()).toBeInTheDocument());
    const input = within(panelNamaPerataan()).getAllByRole('textbox')[0];
    fireEvent.change(input, { target: { value: 'Nama Baru' } });

    await userEvent.click(screen.getByRole('tab', { name: /Urutan/ }));
    await waitFor(() => expect(screen.getByLabelText('Urutan')).toBeVisible());
    await userEvent.click(screen.getByRole('tab', { name: /Nama & Perataan/ }));
    await waitFor(() => expect(panelNamaPerataan()).toBeVisible());

    expect(within(panelNamaPerataan()).getAllByRole('textbox')[0]).toHaveValue('Nama Baru');
  });
});

describe('DialogKelolaTabel — Simpan terpadu', () => {
  it('menjelaskan kenapa tombol Simpan nonaktif saat belum ada perubahan', async () => {
    renderDialog();
    await waitFor(() => expect(screen.getByLabelText('Kolom')).toBeInTheDocument());
    expect(screen.getByText('Tidak ada perubahan yang perlu disimpan.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeDisabled();
  });

  it('menyebutkan jumlah bagian yang belum tersimpan saat ada perubahan', async () => {
    renderDialog();
    await waitFor(() => expect(panelNamaPerataan()).toBeInTheDocument());
    const input = within(panelNamaPerataan()).getAllByRole('textbox')[0];
    fireEvent.change(input, { target: { value: 'Nama Baru' } });

    await waitFor(() => expect(screen.getByText(/bagian belum tersimpan/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeEnabled();
  });

  it('menandai tab yang belum tersimpan, termasuk tab tempat mengetik', async () => {
    renderDialog();
    await waitFor(() => expect(panelNamaPerataan()).toBeInTheDocument());
    const input = within(panelNamaPerataan()).getAllByRole('textbox')[0];
    fireEvent.change(input, { target: { value: 'Nama Baru' } });

    // Nama kolom disimpan section Kolom (preset), tapi user mengetiknya di tab
    // Nama & Perataan — kedua tab menyala supaya tidak bingung mana yang berubah.
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Nama & Perataan \(belum tersimpan\)/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /^Kolom \(belum tersimpan\)/ })).toBeInTheDocument();
    });
  });
});