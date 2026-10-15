import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ContextMenu } from '@/components/ui/context-menu';
import { renderDenganTema } from '@/test/utils';
import MenuKonteksGrid, { type MenuKonteksGridProps } from './konteksMenu';

function renderMenu(
  bolehKelola = true,
  ekstra: Partial<MenuKonteksGridProps> = {},
) {
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
    bolehKelola,
    salinBaris: () => {},
    salinSel: () => {},
    salinKolom: () => {},
    onSalinSemua: () => {},
    onKonfirmasi: () => {},
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
    renderMenu(true, { sudut: true, onSalinSemua });

    await user.click(screen.getByText('Salin semua (TSV)'));

    expect(onSalinSemua).toHaveBeenCalledTimes(1);
  });

  it('tidak menawarkan Salin semua di luar sudut', () => {
    renderMenu();

    expect(screen.queryByText('Salin semua (TSV)')).toBeNull();
  });
});

describe('MenuKonteksGrid — Kelola Tabel dari header kolom', () => {
  it('menawarkan Kelola Tabel dan memanggil penanganannya', async () => {
    const user = userEvent.setup();
    const onKelolaTabel = vi.fn();
    renderMenu(true, { onKelolaTabel });

    await user.click(screen.getByText('Kelola Tabel'));

    expect(onKelolaTabel).toHaveBeenCalledTimes(1);
  });

  it('menyembunyikan item bila penanganan tidak diberikan', () => {
    renderMenu();

    expect(screen.queryByText('Kelola Tabel')).toBeNull();
  });
});

describe('MenuKonteksGrid — perataan kolom digerbang izin kelola', () => {
  const TOMBOL_RATA = ['Rata kiri', 'Rata tengah', 'Rata kanan'];

  it('dengan izin kelola: tombol perataan tampil', () => {
    renderMenu(true);

    for (const nama of TOMBOL_RATA) {
      expect(screen.getByRole('button', { name: nama })).toBeInTheDocument();
    }
  });

  /** Perataan ditulis ke SERVER dan hanya super_admin efektif yang boleh
   *  (`ToolbarPresetController::simpan`) — tanpa gerbang di sini, pengguna lain
   *  menabrak 403 "Setelan tabel hanya dapat diubah super_admin." */
  it('tanpa izin kelola: tombol perataan disembunyikan, tombol lokal tetap ada', () => {
    renderMenu(false);

    for (const nama of TOMBOL_RATA) {
      expect(screen.queryByRole('button', { name: nama })).toBeNull();
    }
    // Lebar kolom & beku bersifat lokal (tak menulis ke server) → tetap tampil.
    expect(screen.getByRole('button', { name: 'Sesuaikan lebar kolom ini' })).toBeInTheDocument();
  });
});
