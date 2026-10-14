import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MutableRefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ContextMenu } from '@/components/ui/context-menu';
import type { PresetKolomApi } from '@/components/PresetKolom';
import { renderDenganTema } from '@/test/utils';
import MenuKonteksGrid, { type MenuKonteksGridProps } from './konteksMenu';

function apiPalsu(terapan: PresetKolomApi['terapan'] = { kolom: null, presetId: null }) {
  return {
    presets: [],
    terapan,
    toggleKolom: vi.fn(async () => {}),
    toggleKolomAktif: vi.fn(async () => {}),
  };
}

function renderMenu(
  api: ReturnType<typeof apiPalsu>,
  bolehKelola = true,
  ekstra: Partial<MenuKonteksGridProps> = {},
) {
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
    onSalinSemua: () => {},
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
    ...ekstra,
  };
  return renderDenganTema(
    <ContextMenu open>
      <MenuKonteksGrid {...props} />
    </ContextMenu>,
  );
}

describe('MenuKonteksGrid — sudut kiri-atas (salin semua)', () => {
  it('menawarkan Salin semua dan memanggil penanganannya', async () => {
    const user = userEvent.setup();
    const onSalinSemua = vi.fn();
    renderMenu(apiPalsu(), true, { sudut: true, onSalinSemua });

    await user.click(screen.getByText('Salin semua (TSV)'));

    expect(onSalinSemua).toHaveBeenCalledTimes(1);
  });

  it('tidak menawarkan Salin semua di luar sudut', () => {
    renderMenu(apiPalsu());

    expect(screen.queryByText('Salin semua (TSV)')).toBeNull();
  });
});

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

describe('MenuKonteksGrid — Kelola Tabel dari header kolom', () => {
  it('menawarkan Kelola Tabel dan memanggil penanganannya', async () => {
    const user = userEvent.setup();
    const onKelolaTabel = vi.fn();
    renderMenu(apiPalsu(), true, { onKelolaTabel });

    await user.click(screen.getByText('Kelola Tabel'));

    expect(onKelolaTabel).toHaveBeenCalledTimes(1);
  });

  it('menyembunyikan item bila penanganan tidak diberikan', () => {
    renderMenu(apiPalsu());

    expect(screen.queryByText('Kelola Tabel')).toBeNull();
  });
});

describe('MenuKonteksGrid — perataan kolom digerbang izin kelola', () => {
  const TOMBOL_RATA = ['Rata kiri', 'Rata tengah', 'Rata kanan'];

  it('dengan izin kelola: tombol perataan tampil', () => {
    renderMenu(apiPalsu(), true);

    for (const nama of TOMBOL_RATA) {
      expect(screen.getByRole('button', { name: nama })).toBeInTheDocument();
    }
  });

  /** Perataan ditulis ke SERVER dan hanya super_admin efektif yang boleh
   *  (`ToolbarPresetController::simpan`) — tanpa gerbang di sini, pengguna lain
   *  menabrak 403 "Setelan tabel hanya dapat diubah super_admin." */
  it('tanpa izin kelola: tombol perataan disembunyikan, tombol lokal tetap ada', () => {
    renderMenu(apiPalsu(), false);

    for (const nama of TOMBOL_RATA) {
      expect(screen.queryByRole('button', { name: nama })).toBeNull();
    }
    // Lebar kolom & beku bersifat lokal (tak menulis ke server) → tetap tampil.
    expect(screen.getByRole('button', { name: 'Sesuaikan lebar kolom ini' })).toBeInTheDocument();
  });
});
