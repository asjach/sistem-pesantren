import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DialogStandarTampilan from './DialogStandarTampilan';
import { renderDenganTema } from '@/test/utils';

const server = vi.hoisted(() => ({
  peta: {} as Record<string, number>,
  simpan: vi.fn(async (k: string, n: number | null) => {
    if (n === null) delete server.peta[k]; else server.peta[k] = n;
    return { pesan: 'ok', data: { kunci: k, nilai: n } };
  }),
  hapus: vi.fn(async (k: string) => { delete server.peta[k]; return { pesan: 'ok' }; }),
}));

vi.mock('@/api/pengaturanGlobal', () => ({
  muatPengaturanGlobal: async () => ({ pesan: 'ok', data: { peta: { ...server.peta } } }),
  simpanPengaturanGlobal: server.simpan,
  hapusPengaturanGlobal: server.hapus,
}));

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) },
}));

function render() {
  return renderDenganTema(<DialogStandarTampilan open onOpenChange={() => {}} />);
}

describe('DialogStandarTampilan', () => {
  beforeEach(() => {
    server.peta = {};
    server.simpan.mockClear();
    server.hapus.mockClear();
    toastError.mockClear();
  });

  it('menampilkan ketiga kontrol standar', async () => {
    render();
    expect(await screen.findByLabelText('Standar tinggi baris sel (px)')).toBeInTheDocument();
    expect(screen.getByLabelText('Standar tinggi baris header (px)')).toBeInTheDocument();
    expect(screen.getByLabelText('Standar baris per halaman (baris)')).toBeInTheDocument();
  });

  it('menandai belum ada standar untuk SETIAP kunci saat peta kosong', async () => {
    render();

    expect(await screen.findAllByText('belum ada')).toHaveLength(3);
  });

  it('menyimpan standar saat nilai diubah', async () => {
    render();
    const kontrol = await screen.findByLabelText('Standar tinggi baris sel (px)');
    await userEvent.clear(kontrol);
    await userEvent.type(kontrol, '32');
    await userEvent.tab();

    await waitFor(() => expect(server.simpan).toHaveBeenCalledWith('tinggi_baris', 32));
  });

  it('menampilkan tombol hapus hanya untuk kunci yang punya standar', async () => {
    server.peta = { tinggi_baris: 30 };
    render();

    expect(await screen.findByLabelText('Hapus standar tinggi baris sel')).toBeInTheDocument();
    expect(screen.queryByLabelText('Hapus standar tinggi baris header')).not.toBeInTheDocument();
  });

  it('menghapus standar satu kunci', async () => {
    server.peta = { tinggi_baris: 30 };
    render();
    await userEvent.click(await screen.findByLabelText('Hapus standar tinggi baris sel'));
    await waitFor(() => expect(server.simpan).toHaveBeenCalledWith('tinggi_baris', null));
  });

  it('tombol hapus semua nonaktif saat tak ada standar', async () => {
    render();
    expect(await screen.findByRole('button', { name: 'Hapus semua standar' })).toBeDisabled();
  });

  it('menghapus semua standar sekaligus', async () => {
    server.peta = { tinggi_baris: 30, tinggi_header: 40 };
    render();
    await userEvent.click(await screen.findByRole('button', { name: 'Hapus semua standar' }));

    await waitFor(() => expect(server.hapus).toHaveBeenCalledWith('tinggi_baris'));
    expect(server.hapus).toHaveBeenCalledWith('tinggi_header');
  });
});
