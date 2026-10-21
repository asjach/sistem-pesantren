import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/navigasi', () => ({
  muatNavigasiTersembunyi: vi.fn(),
  simpanNavigasiTersembunyi: vi.fn(),
}));

import {
  muatNavigasiTersembunyi,
  simpanNavigasiTersembunyi,
} from '@/api/navigasi';
import NavigasiVisibilitasDialog from './NavigasiVisibilitasDialog';
import { NavigasiVisibilitasProvider } from './NavigasiVisibilitasProvider';
import { renderDenganTema } from '@/test/utils';

const muat = vi.mocked(muatNavigasiTersembunyi);
const simpan = vi.mocked(simpanNavigasiTersembunyi);

function pasang() {
  const onOpenChange = vi.fn();
  renderDenganTema(
    <NavigasiVisibilitasProvider>
      <NavigasiVisibilitasDialog open onOpenChange={onOpenChange} />
    </NavigasiVisibilitasProvider>,
  );

  return { onOpenChange };
}

describe('NavigasiVisibilitasDialog', () => {
  beforeEach(() => {
    muat.mockReset().mockResolvedValue({
      mode: 'global',
      global_tersembunyi: [],
      pribadi_tersembunyi: [],
      tersembunyi: [],
    });
    simpan.mockReset().mockImplementation(async (tersembunyi: string[]) => ({
      pesan: 'ok',
      mode: 'global' as const,
      global_tersembunyi: tersembunyi,
      pribadi_tersembunyi: [],
      tersembunyi,
    }));
  });

  it('menyembunyikan grup beserta turunannya dan bisa menampilkan semua', async () => {
    pasang();
    await waitFor(() => expect(document.getElementById('cek_nav_grup_penilaian')).not.toBeNull());

    fireEvent.click(document.getElementById('cek_nav_grup_penilaian')!);

    await waitFor(() => {
      const tersimpan = simpan.mock.calls.at(-1)?.[0] ?? [];
      expect(tersimpan).toContain('grup:penilaian');
      expect(tersimpan).toContain('halaman:/penilaian/leger');
    });

    fireEvent.click(document.getElementById('btn_tampilkan_semua_navigasi')!);

    await waitFor(() => expect(simpan).toHaveBeenLastCalledWith([]));
  });

  it('memuat pohon grup, sub-grup, halaman, dan tab', async () => {
    pasang();
    await waitFor(() => expect(document.getElementById('pohon_navigasi_sidebar')).not.toBeNull());

    expect(screen.getAllByText('Data Induk').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dokumen').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Santri').length).toBeGreaterThan(0);
    expect(screen.getByText('Leger Nilai')).toBeInTheDocument();
  });

  it('admin hanya bisa mengubah entri yang diaktifkan super_admin', async () => {
    muat.mockResolvedValue({
      mode: 'pribadi',
      global_tersembunyi: ['tab:/lembaga'],
      pribadi_tersembunyi: [],
      tersembunyi: ['tab:/lembaga'],
    });
    simpan.mockImplementation(async (tersembunyi: string[]) => ({
      pesan: 'ok',
      mode: 'pribadi' as const,
      global_tersembunyi: ['tab:/lembaga'],
      pribadi_tersembunyi: tersembunyi,
      tersembunyi: ['tab:/lembaga', ...tersembunyi],
    }));
    pasang();
    await waitFor(() => expect(document.getElementById('cek_nav_tab_lembaga')).not.toBeNull());

    expect((document.getElementById('cek_nav_tab_lembaga') as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(document.getElementById('cek_nav_halaman_penilaian_leger')!);

    await waitFor(() => expect(simpan).toHaveBeenCalledWith(['halaman:/penilaian/leger']));
  });
});
