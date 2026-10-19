import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DialogKelolaHalaman from './DialogKelolaHalaman';
import { renderDenganTema } from '@/test/utils';
import type { HalamanDef } from '@/lib/halaman';

const server = vi.hoisted(() => {
  const state: { urutan: string[]; sembunyi: string[] } = { urutan: [], sembunyi: [] };
  const muat = vi.fn(async () => ({ pesan: 'ok', data: { peta: {} as Record<string, unknown> } }));
  const simpan = vi.fn(async (_k: string, urutan: string[], sembunyi: string[]) => {
    state.urutan = urutan; state.sembunyi = sembunyi;
    return { pesan: 'ok', data: { page_key: _k, urutan, sembunyi } };
  });
  const hapus = vi.fn(async () => ({ pesan: 'ok' }));
  return { state, muat, simpan, hapus };
});

vi.mock('@/api/pengaturanHalaman', () => ({
  muatPengaturanHalaman: server.muat,
  simpanPengaturanHalaman: server.simpan,
  hapusPengaturanHalaman: server.hapus,
}));

vi.mock('@/lembagaAktif', async (asli) => ({
  ...(await asli()),
  useLembagaAktif: () => ({ efektifSuper: true }),
}));

const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() },
}));

const DEF: HalamanDef = {
  to: '/data-induk',
  label: 'Data Induk',
  tab: 'master',
  icon: (() => null) as never,
  tabHalaman: [
    { to: '/users', label: 'Pengguna', permission: 'pengguna.lihat' },
    { to: '/lembaga', label: 'Lembaga', permission: 'lembaga.lihat' },
    { to: '/kelas', label: 'Kelas', permission: 'kelas.lihat' },
  ],
};

function render(open = true) {
  return renderDenganTema(
    <DialogKelolaHalaman open={open} onOpenChange={() => {}} def={DEF} />,
  );
}

describe('DialogKelolaHalaman', () => {
  beforeEach(() => {
    server.muat.mockClear();
    server.simpan.mockClear();
    server.hapus.mockClear();
    server.state.urutan = [];
    server.state.sembunyi = [];
  });

  it('menampilkan tab halaman sesuai urutan kode', async () => {
    render();
    const items = await screen.findAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining('Pengguna'),
      expect.stringContaining('Lembaga'),
      expect.stringContaining('Kelas'),
    ]);
  });

  it('memuat setelan tersimpan satu kali saat dibuka', async () => {
    render();
    await waitFor(() => expect(server.muat).toHaveBeenCalledWith(['data_induk']));
  });

  it('tombol naik memindahkan tab dan menandai kotor', async () => {
    render();
    await screen.findAllByRole('listitem');
    const simpan = screen.getByRole('button', { name: 'Simpan' });
    expect(simpan).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Naikkan Lembaga' }));
    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent).toContain('Lembaga');
    expect(items[1].textContent).toContain('Pengguna');
    expect(simpan).toBeEnabled();
  });

  it('tombol naik pada item pertama dinonaktifkan', async () => {
    render();
    await screen.findAllByRole('listitem');
    expect(screen.getByRole('button', { name: 'Naikkan Pengguna' })).toBeDisabled();
  });

  it('menyembunyikan lalu menampilkan lagi mengembalikan posisi asli', async () => {
    render();
    await screen.findAllByRole('listitem');
    await userEvent.click(screen.getByRole('button', { name: 'Naikkan Kelas' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sembunyikan Kelas' }));
    expect(screen.getByRole('button', { name: 'Tampilkan Kelas' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tampilkan Kelas' }));

    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining('Pengguna'),
      expect.stringContaining('Kelas'),
      expect.stringContaining('Lembaga'),
    ]);
  });

  it('menyimpan mengirim URL LENGKAP termasuk yang disembunyikan', async () => {
    render();
    await screen.findAllByRole('listitem');
    await userEvent.click(screen.getByRole('button', { name: 'Sembunyikan Lembaga' }));
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));

    await waitFor(() => expect(server.simpan).toHaveBeenCalledWith(
      'data_induk',
      ['/users', '/lembaga', '/kelas'],
      ['/lembaga'],
    ));
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('mengembalikan bawaan memanggil hapus lalu memuat ulang', async () => {
    render();
    await screen.findAllByRole('listitem');
    await userEvent.click(screen.getByRole('button', { name: /Kembalikan bawaan/ }));
    await waitFor(() => expect(server.hapus).toHaveBeenCalledWith('data_induk'));
    await waitFor(() => expect(server.muat).toHaveBeenCalledTimes(2));
  });

  it('menyebut tab baru dari kode walau belum pernah diatur', async () => {
    server.muat.mockResolvedValueOnce({
      pesan: 'ok',
      data: { peta: { data_induk: { page_key: 'data_induk', urutan: ['/kelas'], sembunyi: [] } } },
    });
    render();
    const items = await screen.findAllByRole('listitem');

    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining('Kelas'),
      expect.stringContaining('Pengguna'),
      expect.stringContaining('Lembaga'),
    ]);
  });
});
