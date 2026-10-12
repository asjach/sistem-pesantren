import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import KomponenPage from './KomponenPage';
import { renderDenganTema } from '@/test/utils';

/** Halaman workshop komponen butuh pengguna super_admin. */
const { pengguna } = vi.hoisted(() => ({
  pengguna: { current: { permissions: [], roles: [{ name: 'super_admin' }] } as unknown as {
    permissions: string[];
    roles: { name: string }[];
  } | null },
}));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ user: pengguna.current }) }));

/* Komponen di dalam halaman memanggil API (daftar preset kolom & urutan). */
vi.mock('@/api/preset', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/preset')>();
  return {
    ...asli,
    listPresetTabel: vi.fn(async () => ({ pesan: 'ok', data: { presets: [], aktif_preset_id: null, aktif_kolom: null, aktif_label: null, default_preset_id: null } })),
    listPresetTampil: vi.fn(async () => ({ pesan: 'ok', data: { opsi: [], tersedia: [] } })),
  };
});
vi.mock('@/api/urutPreset', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/urutPreset')>();
  return {
    ...asli,
    muatUrutPreset: vi.fn(async () => ({ pesan: 'ok', data: { table_key: 'keanggotaan', opsi: [], tersedia: [] } })),
  };
});
vi.mock('@/api/komponenCustom', () => ({
  muatKomponenCustom: vi.fn(async () => ({ pesan: '', data: { peta: {} } })),
  simpanKomponenCustom: vi.fn(async () => ({ pesan: '', data: {} })),
  hapusKomponenCustom: vi.fn(async () => ({ pesan: '' })),
}));

/** Elemen penanda kehadiran satu komponen di daftar (tombol info ber-id `<id>`). */
const komponen = (id: string) => document.getElementById(id);

beforeEach(() => {
  pengguna.current = { permissions: [], roles: [{ name: 'super_admin' }] } as unknown as { permissions: string[]; roles: { name: string }[] };
});

describe('KomponenPage — kerangka tab', () => {
  it('memakai kerangka tab bersama halaman bertab lain', () => {
    renderDenganTema(<KomponenPage />);

    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Combobox',
      'LabeledTextInput',
      'Stepper',
    ]);
    // Id elemen snake_case (NFR-05).
    expect(screen.getByRole('tab', { name: 'Combobox' })).toHaveAttribute('id', 'tab_komponen_combobox');
    // Panel tab berbingkai — penanda kerangka bersama (`KELAS_PANEL_TAB`).
    expect(screen.getByRole('tabpanel').className).toContain('simpes-panel-tab');
  });
});

describe('KomponenPage — pengelompokan komponen', () => {
  it('satu tab per komponen utama; tab awal Combobox', () => {
    renderDenganTema(<KomponenPage />);

    expect(screen.getByRole('tab', { name: 'Combobox' })).toHaveAttribute('data-state', 'active');
    expect(komponen('info_labeled_combobox')).not.toBeNull();
    // Tab lain belum di-mount saat tidak aktif.
    expect(komponen('info_labeled_text_input')).toBeNull();
    expect(komponen('info_labeled_stepper')).toBeNull();
  });

  it('varian tampil di tab yang sama dengan komponen utamanya', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);

    // Combobox: LabeledCombobox + varian PresetUrut & PresetKolom.
    expect(komponen('info_preset_urut')).not.toBeNull();
    expect(komponen('info_preset_kolom')).not.toBeNull();
    expect(screen.getAllByText('varian dari LabeledCombobox')).toHaveLength(2);

    // Teks: LabeledTextInput + varian LabeledNominalInput.
    await klik.click(screen.getByRole('tab', { name: 'LabeledTextInput' }));
    expect(komponen('info_labeled_text_input')).not.toBeNull();
    expect(komponen('info_labeled_nominal_input')).not.toBeNull();
    expect(komponen('info_preset_urut')).toBeNull();
    expect(screen.getAllByText('varian dari LabeledTextInput')).toHaveLength(1);

    // Stepper: tanpa varian.
    await klik.click(screen.getByRole('tab', { name: 'Stepper' }));
    expect(komponen('info_labeled_stepper')).not.toBeNull();
    expect(screen.getByText('Belum ada varian dari LabeledStepper.')).toBeInTheDocument();
  });
});
