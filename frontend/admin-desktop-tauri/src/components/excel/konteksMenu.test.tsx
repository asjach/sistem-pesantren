import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MutableRefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ContextMenu } from '@/components/ui/context-menu';
import type { PresetKolomApi } from '@/components/PresetKolom';
import { renderDenganTema } from '@/test/utils';
import MenuKonteksGrid, { type MenuKonteksGridProps } from './konteksMenu';

function apiPalsu(terapan: PresetKolomApi['terapan'] = { kolom: null, label: null, presetId: null }) {
  return {
    presets: [],
    terapan,
    toggleKolom: vi.fn(async () => {}),
    toggleKolomAktif: vi.fn(async () => {}),
  };
}

function renderMenu(api: ReturnType<typeof apiPalsu>, bolehKelola = true) {
  const ref = { current: api } as MutableRefObject<PresetKolomApi | null>;
  const props: MenuKonteksGridProps = {
    tableKey: 'uji',
    header: { colKey: 'nama' },
    headerLabel: 'Nama',
    headerIdx: 0,
    row: null,
    rowAksi: [],
    freezeAktif: 0,
    ubahFreeze: () => {},
    onAutoFit: () => {},
    onAutoFitAll: () => {},
    align: {},
    onUbahAlign: () => {},
    presetApiRef: ref,
    daftarKolom: [
      { key: 'nama', label: 'Nama', tampil: true },
      { key: 'kode', label: 'Kode', tampil: true },
      { key: 'catatan', label: 'Catatan', tampil: false },
    ],
    bolehKelola,
    salinBaris: () => {},
    salinSel: () => {},
    salinKolom: () => {},
    onKonfirmasi: () => {},
    bolehGeser: false,
    jumlahKolom: 3,
    onGeserKiri: () => {},
    onGeserKanan: () => {},
    onResetUrutan: () => {},
    barisIkutIsi: true,
    onUbahBarisIkutIsi: () => {},
    onResetTinggiBaris: () => {},
    barisManualAda: false,
    barisManualBarisIni: false,
  };
  return renderDenganTema(
    <ContextMenu open>
      <MenuKonteksGrid {...props} />
    </ContextMenu>,
  );
}

describe('MenuKonteksGrid — seksi TAMPILKAN KOLOM', () => {
  it('menampilkan seluruh kolom beserta status tampilnya', () => {
    renderMenu(apiPalsu());

    expect(screen.getByText('TAMPILKAN KOLOM')).toBeInTheDocument();
    const menu = screen.getByRole('menu');
    for (const [label, tampil] of [['Nama', true], ['Kode', true], ['Catatan', false]] as const) {
      const item = within(menu).getByRole('menuitemcheckbox', { name: label });
      expect(item).toHaveAttribute('aria-checked', tampil ? 'true' : 'false');
    }
  });

  it('mencentang ulang "Kode" memanggil toggleKolomAktif dengan (kode, false)', async () => {
    const api = apiPalsu();
    renderMenu(api);

    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Kode' }));

    expect(api.toggleKolomAktif).toHaveBeenCalledTimes(1);
    expect(api.toggleKolomAktif).toHaveBeenCalledWith('kode', false);
  });

  it('mencentang "Catatan" yang tersembunyi memanggil toggleKolomAktif dengan (catatan, true)', async () => {
    const api = apiPalsu();
    renderMenu(api);

    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Catatan' }));

    expect(api.toggleKolomAktif).toHaveBeenCalledWith('catatan', true);
  });

  it('tanpa izin kelola, seksi disembunyikan', () => {
    renderMenu(apiPalsu(), false);

    expect(screen.queryByText('TAMPILKAN KOLOM')).toBeNull();
    expect(screen.queryByText('TAMPILKAN DI PRESET')).toBeNull();
  });
});
