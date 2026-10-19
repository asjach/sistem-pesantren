import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ContextMenu } from '@/components/ui/context-menu';
import { renderDenganTema } from '@/test/utils';
import MenuKonteksGrid, { type MenuKonteksGridProps } from './konteksMenu';
import { tenggangMenu } from './kelolaTabelDariMenu';

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
    geserHeader: false,
    onUbahGeserHeader: () => {},
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

    await waitFor(() => expect(onKelolaTabel).toHaveBeenCalledTimes(1));
  });

  it('tidak memanggil penanganan lebih dari sekali', async () => {
    const user = userEvent.setup();
    const onKelolaTabel = vi.fn();
    renderMenu(true, { onKelolaTabel });

    await user.click(screen.getByText('Kelola Tabel'));
    await waitFor(() => expect(onKelolaTabel).toHaveBeenCalledTimes(1));

    await act(async () => { await new Promise((r) => setTimeout(r, 320)); });
    expect(onKelolaTabel).toHaveBeenCalledTimes(1);
  });

  it('menandai jendela tenggang supaya panel non-modal tidak langsung tertutup', async () => {
    const user = userEvent.setup();
    const onKelolaTabel = vi.fn();
    renderMenu(true, { onKelolaTabel });

    await user.click(screen.getByText('Kelola Tabel'));

    await waitFor(() => expect(onKelolaTabel).toHaveBeenCalledTimes(1));
    expect(tenggangMenu.lagiTenggang()).toBe(true);
  });

  it('menyembunyikan item bila penanganan tidak diberikan', () => {
    renderMenu();

    expect(screen.queryByText('Kelola Tabel')).toBeNull();
  });
});

describe('MenuKonteksGrid — sakelar geser judul kolom', () => {
  it('menampilkan sakelar dalam keadaan mati secara bawaan', () => {
    renderMenu();

    expect(screen.getByText('Geser judul untuk menyusun kolom')).toBeTruthy();
  });

  it('menyalakan sakelar lewat penanganannya', async () => {
    const user = userEvent.setup();
    const onUbahGeserHeader = vi.fn();
    renderMenu(true, { geserHeader: false, onUbahGeserHeader });

    await user.click(screen.getByText('Geser judul untuk menyusun kolom'));

    expect(onUbahGeserHeader).toHaveBeenCalledWith(true);
  });

  it('mematikan sakelar bila sebelumnya menyala', async () => {
    const user = userEvent.setup();
    const onUbahGeserHeader = vi.fn();
    renderMenu(true, { geserHeader: true, onUbahGeserHeader });

    await user.click(screen.getByText('Geser judul untuk menyusun kolom'));

    expect(onUbahGeserHeader).toHaveBeenCalledWith(false);
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

    expect(screen.getByRole('button', { name: 'Sesuaikan lebar kolom ini' })).toBeInTheDocument();
  });
});

describe('MenuKonteksGrid — aksi blok seleksi', () => {
  const ROW = { rowId: '1', rowLabel: 'Baris 1', colKey: 'nama' };

  it('menampilkan jumlah sel dan memanggil penanganannya', async () => {
    const user = userEvent.setup();
    const onIsiBlok = vi.fn();
    renderMenu(true, {
      header: null,
      row: ROW,
      blokJumlah: 4,
      blokLabel: 'Isi mapel & guru…',
      onIsiBlok,
    });

    expect(screen.getByText('BLOK 4 SEL')).toBeInTheDocument();
    await user.click(screen.getByText('Isi mapel & guru…'));

    expect(onIsiBlok).toHaveBeenCalledTimes(1);
  });

  it('tanpa penanganan blok, item tidak ditampilkan', () => {
    renderMenu(true, { header: null, row: ROW });

    expect(screen.queryByText('Isi mapel & guru…')).toBeNull();
  });
});
