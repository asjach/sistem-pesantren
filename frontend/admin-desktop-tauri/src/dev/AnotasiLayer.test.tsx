import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@/theme';
import AnotasiLayer from './AnotasiLayer';
import type { Anotasi } from './anotasi';

const api = vi.hoisted(() => ({
  muat: vi.fn<() => Promise<Anotasi[]>>(async () => []),
  simpan: vi.fn<(anotasi: Anotasi) => Promise<Anotasi>>(async (anotasi) => anotasi),
  hapus: vi.fn<(id: string) => Promise<void>>(async () => {}),
}));

vi.mock('@/dev/anotasi', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/dev/anotasi')>();
  return {
    ...asli,
    muatAnotasi: api.muat,
    simpanAnotasi: api.simpan,
    hapusAnotasi: api.hapus,
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const CATATAN: Anotasi = {
  id: 'a1',
  dibuat: '2026-10-21T00:00:00.000Z',
  rute: '/penilaian/leger',
  selector: '#tombol_simpan',
  tag: 'button',
  teks: 'Simpan',
  komponen: ['PenilaianLegerPage', 'ExcelTable'],
  sumber: 'src/pages/PenilaianLegerPage.tsx:42',
  instruksi: 'Perbesar tombol simpan',
};

beforeEach(() => {
  api.muat.mockResolvedValue([]);
  api.simpan.mockImplementation(async (anotasi) => anotasi);
  api.hapus.mockResolvedValue(undefined);
  window.history.replaceState({}, '', '/');
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.restoreAllMocks();
});

function tampilkan() {
  return render(
    <ThemeProvider>
      <AnotasiLayer />
    </ThemeProvider>,
  );
}

describe('AnotasiLayer', () => {
  it('menyimpan anotasi elemen yang diklik', async () => {
    const user = userEvent.setup();
    const target = document.createElement('button');
    target.textContent = 'Tombol target';
    document.body.appendChild(target);

    target.getBoundingClientRect = () => ({
      left: 20, top: 30, right: 120, bottom: 60,
      width: 100, height: 30, x: 20, y: 30, toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(target);

    tampilkan();
    await user.click(screen.getByRole('button', { name: 'Tandai elemen untuk agent' }));

    expect(screen.getByText(/Klik elemen untuk diberi instruksi/)).toBeInTheDocument();

    await user.click(target);
    const input = await screen.findByRole('textbox', { name: 'Instruksi untuk agent' });
    await user.type(input, 'Samakan font NIS');
    await user.click(screen.getByRole('button', { name: 'Simpan' }));

    expect(api.simpan).toHaveBeenCalledWith(expect.objectContaining({
      rute: '/',
      tag: 'button',
      teks: 'Tombol target',
      selector: 'body > button',
      instruksi: 'Samakan font NIS',
    }));
    expect(screen.queryByRole('textbox', { name: 'Instruksi untuk agent' })).not.toBeInTheDocument();
  });

  it('menampilkan daftar anotasi dan menghapus entri', async () => {
    const user = userEvent.setup();
    api.muat.mockResolvedValue([CATATAN]);

    tampilkan();
    await user.click(screen.getByRole('button', { name: /Buka daftar anotasi/ }));

    expect(await screen.findByText('Perbesar tombol simpan')).toBeInTheDocument();
    expect(screen.getByText('src/pages/PenilaianLegerPage.tsx:42')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Hapus anotasi/ }));

    expect(api.hapus).toHaveBeenCalledWith('a1');
    await waitFor(() => {
      expect(screen.queryByText('Perbesar tombol simpan')).not.toBeInTheDocument();
    });
  });
});
