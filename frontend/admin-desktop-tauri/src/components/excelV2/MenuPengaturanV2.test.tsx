import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MenuPengaturanV2 from './MenuPengaturanV2';
import type { InfoKomponenTabel } from '@/components/excel/komponenTabel';
import { tenggangMenu } from '@/components/excel/kelolaTabelDariMenu';

const { api } = vi.hoisted(() => ({
  api: {
    muat: vi.fn(),
    simpan: vi.fn(),
    prefGet: vi.fn(),
    prefSet: vi.fn(),
    buka: vi.fn(),
    kelola: vi.fn(),
  },
}));

vi.mock('@/theme', () => ({ useTheme: () => ({ iconSet: 'lucide' }) }));

vi.mock('@/api/client', () => ({
  prefGet: api.prefGet,
  prefSet: api.prefSet,
  errorMessage: (e: unknown) => String(e),
}));
vi.mock('@/api/toolbarPreset', () => ({
  muatToolbarPreset: api.muat,
  simpanToolbarPreset: api.simpan,
}));
vi.mock('@/components/pengaturan/SheetPengaturanTampilan', () => ({
  bukaPengaturanTampilan: api.buka,
}));
vi.mock('@/components/kelolaTabel/jenis', () => ({
  EVENT_TAMPILAN_PERANGKAT_BERUBAH: 'simpes:tampilan-perangkat-berubah',
  kabariToolbar: vi.fn(),
  kabariTampilanPerangkat: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const INFO: InfoKomponenTabel = {
  adaBilahJudul: true,
  infoTengah: false,
  filter: true,
  cari: false,
  keaktifan: false,
  urut: true,
  kolom: true,
  tombolAksi: true,
  relFilter: false,
  pager: true,
  tombolTambah: false,
  tombolEdit: false,
  kolomCentang: true,
  kolomAksi: true,
};

function tampilkan(extra: Record<string, unknown> = {}) {
  return render(
    <MenuPengaturanV2 tableKey="daftar_kelas" info={INFO} {...extra} />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.muat.mockResolvedValue({ data: { visibilitas: {} } });
  api.simpan.mockResolvedValue({ data: {} });
  api.prefGet.mockResolvedValue(null);
  api.prefSet.mockResolvedValue(undefined);
});

describe('MenuPengaturanV2', () => {
  it('menampilkan sakelar komponen yang tersedia dan menyembunyikan yang tidak ada', async () => {
    const user = userEvent.setup();
    tampilkan();

    await user.click(screen.getByRole('button', { name: 'Menu lainnya' }));

    expect(await screen.findByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Judul tabel' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Filter tabel' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Kolom centang' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitemcheckbox', { name: /Rel filter/ })).toBeNull();
    expect(screen.queryByRole('menuitemcheckbox', { name: /Tombol tambah baris/ })).toBeNull();
    // Dua sakelar perangkat sengaja belum dipindah: V2 belum menerapkannya.
    expect(screen.queryByRole('menuitemcheckbox', { name: 'Tabel mengisi lebar' })).toBeNull();
    expect(screen.queryByRole('menuitemcheckbox', { name: 'Baris ikut isi' })).toBeNull();
  });

  it('memuat status tercentang dari peta server saat menu dibuka', async () => {
    api.muat.mockResolvedValue({ data: { visibilitas: { judul_tabel: false } } });
    const user = userEvent.setup();
    tampilkan();

    await user.click(screen.getByRole('button', { name: 'Menu lainnya' }));
    const item = await screen.findByRole('menuitemcheckbox', { name: 'Judul tabel' });

    await waitFor(() => expect(item).toHaveAttribute('aria-checked', 'false'));
  });

  it('menyimpan visibilitas dengan merge peta server dan menu tetap terbuka', async () => {
    const user = userEvent.setup();
    tampilkan();

    await user.click(screen.getByRole('button', { name: 'Menu lainnya' }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Filter tabel' }));

    await waitFor(() => {
      expect(api.simpan).toHaveBeenCalledWith('daftar_kelas', { filter: false });
    });
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('membuka pengaturan tampilan global dari item menu', async () => {
    const user = userEvent.setup();
    tampilkan();

    await user.click(screen.getByRole('button', { name: 'Menu lainnya' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Pengaturan tampilan tabel…' }));

    expect(api.buka).toHaveBeenCalledTimes(1);
  });

  it('menampilkan pintasan Kelola Tabel hanya untuk super_admin pada tabel terdaftar', async () => {
    const user = userEvent.setup();
    const tandai = vi.spyOn(tenggangMenu, 'tandai');
    try {
      tampilkan({ tabelTerdaftar: true, bolehKelola: true, onKelolaTabel: api.kelola });

      await user.click(screen.getByRole('button', { name: 'Menu lainnya' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Kelola Tabel…' }));

      expect(api.kelola).toHaveBeenCalledTimes(1);
      expect(tandai).toHaveBeenCalledTimes(1);
    } finally {
      tandai.mockRestore();
    }
  });

  it('menyembunyikan pintasan Kelola Tabel tanpa izin', async () => {
    const user = userEvent.setup();
    tampilkan({ tabelTerdaftar: true, bolehKelola: false, onKelolaTabel: api.kelola });

    await user.click(screen.getByRole('button', { name: 'Menu lainnya' }));

    expect(await screen.findByRole('menu')).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Kelola Tabel…' })).toBeNull();
  });
});
