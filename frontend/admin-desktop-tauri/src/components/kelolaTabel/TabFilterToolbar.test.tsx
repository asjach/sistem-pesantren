import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import TabFilterToolbar from './TabFilterToolbar';
import { renderDenganTema } from '@/test/utils';
import type { VisibilitasToolbar } from '@/api/toolbarPreset';
import { buangKunciVisibilitas, gabungVisibilitas } from '@/components/excel/filterTabel';

const server = vi.hoisted(() => {
  const state = { visibilitas: {} as VisibilitasToolbar };
  const muat = vi.fn(async () => ({
    pesan: 'ok',
    data: { table_key: 'uji', visibilitas: { ...state.visibilitas }, lebar: {}, urutan: [], align: {} },
  }));
  const simpan = vi.fn(async (_t: string, v?: VisibilitasToolbar) => {
    if (v !== undefined) state.visibilitas = { ...v };
    return { pesan: 'ok', data: null };
  });
  return { state, muat, simpan };
});

vi.mock('@/api/toolbarPreset', () => ({
  muatToolbarPreset: server.muat,
  simpanToolbarPreset: server.simpan,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
  server.state.visibilitas = {};
  vi.clearAllMocks();
});

describe('gabungVisibilitas / buangKunciVisibilitas — merge, bukan timpa', () => {
  it('yang dimatikan ditulis, yang dinyalakan dihapus, kunci asing utuh', () => {
    // Kunci 'legacy' milik fitur lain harus ikut tertulis ulang, bukan hilang:
    // `simpanToolbarPreset` menimpa SATU PETA utuh.
    expect(gabungVisibilitas({ legacy: false, kolom: false }, { kolom: true, urutan: false }))
      .toEqual({ legacy: false, urutan: false });
  });

  it('buangKunci hanya menghapus kunci milik tabel ini', () => {
    expect(buangKunciVisibilitas({ urutan: false, legacy: false }, ['urutan', 'kolom']))
      .toEqual({ legacy: false });
  });
});

function renderSection(filterTersedia: ('cari' | 'urutan' | 'kolom' | 'keaktifan')[] = ['urutan', 'kolom']) {
  return renderDenganTema(
    <TabFilterToolbar tableKey="uji" filterTersedia={filterTersedia} />,
  );
}

describe('TabFilterToolbar — section Filter Tabel di Kelola Tabel', () => {
  it('hanya menyajikan filter yang tersedia di tabel', async () => {
    renderSection(['urutan']);
    await waitFor(() => expect(screen.getByLabelText('Tampilkan filter Urutan')).toBeInTheDocument());
    expect(screen.queryByLabelText('Tampilkan filter Kolom')).toBeNull();
  });

  it('bawaan: semua nyala saat server belum punya penanda', async () => {
    renderSection(['urutan', 'kolom']);
    await waitFor(() => expect(screen.getByLabelText('Tampilkan filter Urutan')).toBeChecked());
    expect(screen.getByLabelText('Tampilkan filter Kolom')).toBeChecked();
  });

  it('nilai tersimpan terbaca: urutan disembunyikan → mati', async () => {
    server.state.visibilitas = { urutan: false };
    renderSection(['urutan', 'kolom']);
    await waitFor(() => expect(screen.getByLabelText('Tampilkan filter Urutan')).not.toBeChecked());
    expect(screen.getByText('Mati')).toBeInTheDocument();
    expect(screen.getByLabelText('Tampilkan filter Kolom')).toBeChecked();
  });

  it('gagal muat → semua nyala (ikut bawaan kode), bukan kosong', async () => {
    server.muat.mockRejectedValueOnce(new Error('koneksi putus'));
    renderSection(['urutan', 'kolom']);
    await waitFor(() => expect(screen.getByLabelText('Tampilkan filter Urutan')).toBeChecked());
    expect(screen.getByLabelText('Tampilkan filter Kolom')).toBeChecked();
  });

  it('mencentang/mencabut centang hanya mengubah state lokal (belum menulis)', async () => {
    renderSection(['urutan', 'kolom']);
    await waitFor(() => expect(screen.getByLabelText('Tampilkan filter Kolom')).toBeChecked());

    await userEvent.click(screen.getByLabelText('Tampilkan filter Kolom'));

    expect(screen.getByLabelText('Tampilkan filter Kolom')).not.toBeChecked();
    // Penulisan hanya terjadi lewat tombol Simpan milik dialog cangkang.
    expect(server.simpan).not.toHaveBeenCalled();
  });
});
