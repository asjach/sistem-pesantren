import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import KomponenPage from './KomponenPage';
import { definisiTipe, KUNCI_TIPE_INPUT } from '@/components/tipeInput';
import { renderDenganTema } from '@/test/utils';

/** Halaman workshop komponen butuh pengguna super_admin. */
const { pengguna } = vi.hoisted(() => ({
  pengguna: { current: { permissions: [], roles: [{ name: 'super_admin' }] } as unknown as {
    permissions: string[];
    roles: { name: string }[];
  } | null },
}));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ user: pengguna.current }) }));

vi.mock('@/api/preset', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/preset')>();
  return {
    ...asli,
    listPresetTabel: vi.fn(async () => ({ pesan: 'ok', data: { presets: [], aktif_preset_id: null, aktif_kolom: null, default_preset_id: null } })),
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

vi.mock('@/api/toolbarPreset', () => ({
  muatToolbarPreset: vi.fn(async () => ({
    pesan: 'ok',
    data: { table_key: 'komponen_excel_demo', visibilitas: {}, lebar: {}, urutan: [], align: {} },
  })),
  simpanToolbarPreset: vi.fn(async () => ({ pesan: 'ok', data: null })),
}));

vi.mock('react-datasheet-grid', async (importOriginal) => {
  const asli = await importOriginal<typeof import('react-datasheet-grid')>();
  const stub = await import('@/components/excel/_dsgStubDom');
  return { ...asli, DynamicDataSheetGrid: stub.DynamicDataSheetGridStub };
});

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
      'LabeledInput',
      'Stepper',
    ]);

    expect(screen.getByRole('tab', { name: 'Combobox' })).toHaveAttribute('id', 'tab_komponen_combobox');

    expect(screen.getByRole('tabpanel').className).toContain('simpes-panel-tab');
  });
});

describe('KomponenPage — pengelompokan komponen', () => {
  it('satu tab per komponen utama; tab awal Combobox', () => {
    renderDenganTema(<KomponenPage />);

    expect(screen.getByRole('tab', { name: 'Combobox' })).toHaveAttribute('data-state', 'active');

    expect(komponen('info_labeled_combobox')).not.toBeNull();
    expect(komponen('info_labeled_text_input')).toBeNull();
    expect(komponen('info_labeled_stepper')).toBeNull();
  });

  it('varian tampil di tab yang sama dengan komponen utamanya', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'Combobox' }));

    expect(komponen('info_preset_urut')).not.toBeNull();
    expect(komponen('info_preset_kolom')).not.toBeNull();
    expect(screen.getAllByText('varian dari LabeledCombobox')).toHaveLength(2);

    await klik.click(screen.getByRole('tab', { name: 'LabeledInput' }));
    expect(komponen('info_labeled_text_input')).not.toBeNull();
    expect(komponen('info_tipe_nominal')).not.toBeNull();
    expect(komponen('info_preset_urut')).toBeNull();
    expect(screen.getAllByText(/^tipe `\w+` — varian dari LabeledInput$/))
      .toHaveLength(KUNCI_TIPE_INPUT.length);

    await klik.click(screen.getByRole('tab', { name: 'Stepper' }));
    expect(komponen('info_labeled_stepper')).not.toBeNull();
    expect(screen.getByText('Belum ada varian dari LabeledStepper.')).toBeInTheDocument();
  });

  it('tab LabeledInput memuat contoh SELURUH tipe registry', async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'LabeledInput' }));

    for (const kunci of KUNCI_TIPE_INPUT) {

      expect(komponen(`info_tipe_${kunci}`)).not.toBeNull();

      const input = document.getElementById(`demo_tipe_${kunci}`);
      expect(input).not.toBeNull();
      expect(input?.getAttribute('type')).toBe(definisiTipe(kunci)?.type ?? 'text');
    }

    expect(document.getElementById('btn_preset_demo_tipe_nominal')).not.toBeNull();
    expect(document.getElementById('btn_kalender_demo_tipe_tanggal')).not.toBeNull();
    expect(document.getElementById('btn_preset_demo_tipe_teks')).toBeNull();
    expect(document.getElementById('btn_kalender_demo_tipe_teks')).toBeNull();

    expect((document.getElementById('demo_tipe_tanggal') as HTMLInputElement).value).toBe('14/07/2026');
  });
});

describe('KomponenPage — lebar kolom daftar', () => {
  /** Wadah daftar tab aktif: satu-satunya yang memasang variabel lebar kolom. */
  const wadah = () => document.querySelector<HTMLElement>('[style*="--lebar-kolom-nama"]');
  /** Lebar kolom nama yang sedang dipakai (dibaca dari variabel CSS-nya). */
  const lebarTampil = () => wadah()?.style.getPropertyValue('--lebar-kolom-nama');
  const gagang = () => screen.getByRole('separator', { name: 'Lebar kolom nama komponen' });
  /** Tab Combobox kini tab pertama; tiap tes di blok ini tetap membukanya
   *  secara eksplisit agar tidak bergantung pada urutan tab. */
  const bukaCombobox = async () => {
    const klik = userEvent.setup();
    renderDenganTema(<KomponenPage />);
    await klik.click(screen.getByRole('tab', { name: 'Combobox' }));
  };

  it('header & setiap baris memakai template kolom yang sama', async () => {
    await bukaCombobox();

    const gridKolom = [...(screen.getByRole('tabpanel').querySelectorAll<HTMLElement>('div'))]
      .filter((d) => d.className.includes('var(--lebar-kolom-nama)'));

    expect(gridKolom).toHaveLength(4);
    for (const g of gridKolom) {
      expect(g.className).toContain('sm:grid-cols-[var(--lebar-kolom-nama)_1fr]');
      expect(g.className).toContain('gap-3');
    }
  });

  it('gagang duduk di batas kolom: selebar celah & ikut padding header', async () => {
    await bukaCombobox();
    const header = wadah()?.firstElementChild as HTMLElement;
    const g = gagang();

    expect(header.contains(g)).toBe(true);
    expect(header.className).toContain('relative');
    expect(g.className).toContain('inset-y-0');

    expect(g.className).toContain('w-3');

    expect(g.style.left).toContain('0.5rem');
    expect(header.className).toContain('p-2');
  });

  it('gagang digeser mouse mengubah lebar kolom (dan kursor jadi col-resize)', async () => {
    await bukaCombobox();
    const g = gagang();
    expect(lebarTampil()).toBe('240px');
    expect(g).toHaveAttribute('aria-valuenow', '240');
    expect(g).toHaveAttribute('aria-valuemin', '120');
    expect(g).toHaveAttribute('aria-valuemax', '480');

    fireEvent.mouseDown(g, { button: 0, clientX: 300 });
    expect(document.body.style.cursor).toBe('col-resize');
    fireEvent.mouseMove(window, { clientX: 360 });
    expect(lebarTampil()).toBe('300px');

    fireEvent.mouseUp(window);
    expect(document.body.style.cursor).toBe('');
    expect(gagang()).toHaveAttribute('aria-valuenow', '300');
  });

  it('lebar dijepit ke rentang yang masuk akal saat diseret jauh', async () => {
    await bukaCombobox();

    fireEvent.mouseDown(gagang(), { button: 0, clientX: 300 });
    fireEvent.mouseMove(window, { clientX: 0 });
    expect(lebarTampil()).toBe('120px');
    fireEvent.mouseMove(window, { clientX: 5000 });
    expect(lebarTampil()).toBe('480px');
    fireEvent.mouseUp(window);
  });

  it('panah menggeser 16px (Shift 48px), Home mengembalikan bawaan', async () => {
    await bukaCombobox();
    const g = gagang();

    fireEvent.keyDown(g, { key: 'ArrowRight' });
    expect(lebarTampil()).toBe('256px');
    fireEvent.keyDown(g, { key: 'ArrowRight', shiftKey: true });
    expect(lebarTampil()).toBe('304px');
    fireEvent.keyDown(g, { key: 'ArrowLeft' });
    expect(lebarTampil()).toBe('288px');
    fireEvent.keyDown(g, { key: 'Home' });
    expect(lebarTampil()).toBe('240px');
  });

  it('klik dua kali mengembalikan lebar bawaan', async () => {
    await bukaCombobox();

    fireEvent.mouseDown(gagang(), { button: 0, clientX: 300 });
    fireEvent.mouseMove(window, { clientX: 400 });
    fireEvent.mouseUp(window);
    expect(lebarTampil()).toBe('340px');

    fireEvent.doubleClick(gagang());
    expect(lebarTampil()).toBe('240px');
  });

  it('lebar yang disetel berlaku juga di tab lain', async () => {
    const klik = userEvent.setup();
    await bukaCombobox();

    fireEvent.mouseDown(gagang(), { button: 0, clientX: 300 });
    fireEvent.mouseMove(window, { clientX: 350 });
    fireEvent.mouseUp(window);
    expect(lebarTampil()).toBe('290px');

    await klik.click(screen.getByRole('tab', { name: 'Stepper' }));
    expect(lebarTampil()).toBe('290px');
  });
});
