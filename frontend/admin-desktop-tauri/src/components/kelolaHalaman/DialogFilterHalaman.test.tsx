import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import DialogFilterHalaman from './DialogFilterHalaman';
import { renderDenganTema } from '@/test/utils';
import type { KunciFilterGlobal } from '@/components/VisibilitasFilter';
import type { ModeSemuaFilterGlobal, TampilFilterGlobal } from '@/lib/filterHalaman';

/** Bawaan lengkap: filter absen = bawaan kode, jadi di sini diisi true/single. */
const BAWAAN: TampilFilterGlobal = {
  lembaga: true, tahun_ajaran: true, semester: true, tingkat: true, kelas: true,
};
const MODE: ModeSemuaFilterGlobal = {
  lembaga: 'single', tahun_ajaran: 'single', semester: 'single', tingkat: 'single', kelas: 'single',
};

/** Server stateful tiruan: menulis & membaca pengaturan_tabel per kunci. */
const server = vi.hoisted(() => {
  const state = { ada: false } as { ada: boolean };
  const muat = vi.fn(async () => ({ pesan: 'ok', data: {} }));
  const simpan = vi.fn(async () => {
    state.ada = true;
    return { pesan: 'ok', data: null };
  });
  const hapus = vi.fn(async () => ({ pesan: 'ok', data: null }));
  return { state, muat, simpan, hapus };
});

vi.mock('@/api/pengaturanTabel', () => ({
  muatPengaturanTabel: server.muat,
  simpanPengaturanTabel: server.simpan,
  hapusPengaturanTabel: server.hapus,
}));

vi.mock('@/lembagaAktif', async (asli) => ({
  ...(await asli()),
  useLembagaAktif: () => ({ efektifSuper: true }),
}));

const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: vi.fn() },
}));

function renderDialog(opts: {
  daftarTabel?: string[];
  filterRelevan?: KunciFilterGlobal[];
} = {}) {
  const relevan = opts.filterRelevan ?? ['lembaga'];
  return renderDenganTema(
    <DialogFilterHalaman
      open
      onOpenChange={() => {}}
      pageKey="users"
      judul="Pengguna"
      filterRelevan={relevan}
      bawaan={BAWAAN}
      modeBawaan={MODE}
      daftarTabel={opts.daftarTabel ?? []}
    />,
  );
}

describe('DialogFilterHalaman — Kelola Halaman', () => {
  it('memakai judul "Kelola halaman" dan menyebut cakupannya server', async () => {
    renderDialog();
    expect(await screen.findByText('Kelola halaman: Pengguna')).toBeInTheDocument();
    expect(screen.getByText(/Berlaku untuk semua pengguna/)).toBeInTheDocument();
  });

  it('memakai page_key sebagai kunci muat saat halaman tanpa tabel', async () => {
    renderDialog({ daftarTabel: [] });
    // Halaman tanpa tabel → langsung page_key.
    await waitFor(() => expect(server.muat).toHaveBeenCalledWith(['users']));
  });

  it('menampilkan cakupan jumlah tabel saat halaman punya lebih dari satu tabel', async () => {
    renderDialog({ daftarTabel: ['Jenis Tagihan', 'Tarif', 'Tagihan'] });
    const info = await screen.findByText(/dipakai bersama/);
    expect(info).toBeInTheDocument();
    expect(screen.getByText('3 tabel')).toBeInTheDocument();
    expect(screen.getByText(/Jenis Tagihan · Tarif · Tagihan/)).toBeInTheDocument();
  });

  it('TIDAK menampilkan keterangan cakupan untuk halaman satu tabel', async () => {
    renderDialog({ daftarTabel: ['Pengguna'] });
    await screen.findByText('Kelola halaman: Pengguna');
    expect(screen.queryByText(/dipakai bersama/)).toBeNull();
  });

  it('tetap memakai page_key walau halaman punya banyak tabel', async () => {
    // Kuncinya page_key (bukan table_key): inilah yang membuat setelan ini
    // milik HALAMAN dan berlaku untuk seluruh tabelnya.
    renderDialog({ daftarTabel: ['A', 'B'] });
    await waitFor(() => expect(server.muat).toHaveBeenCalledWith(['users']));
  });

  it('menyimpan perubahan ke kunci halaman', async () => {
    renderDialog();
    const toggle = await screen.findByLabelText('Tampilkan filter Lembaga');
    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    await waitFor(() => expect(server.simpan).toHaveBeenCalled());
    // Kunci pertama yang dikirim adalah page_key halaman — bukan table_key.
    expect(server.simpan.mock.calls[0]?.at(0)).toBe('users');
  });
});
