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
import {
  NavigasiVisibilitasProvider,
  useNavigasiVisibilitas,
} from './NavigasiVisibilitasProvider';
import { semuaKunciNavigasi } from '@/lib/halaman';

const muat = vi.mocked(muatNavigasiTersembunyi);
const simpan = vi.mocked(simpanNavigasiTersembunyi);

function Harness() {
  const { tersembunyi, globalTersembunyi, mode, memuat, jungkit, atur, reset } = useNavigasiVisibilitas();

  return (
    <div>
      <span data-testid="tersembunyi">{[...tersembunyi].join(',')}</span>
      <span data-testid="global">{[...globalTersembunyi].join(',')}</span>
      <span data-testid="mode">{mode}</span>
      <span data-testid="memuat">{memuat ? '1' : '0'}</span>
      <button type="button" id="uji_jungkit" onClick={() => jungkit('grup:penilaian')}>jungkit</button>
      <button type="button" id="uji_atur" onClick={() => atur(['grup:penilaian', 'halaman:/penilaian/leger'], false)}>atur</button>
      <button type="button" id="uji_reset" onClick={reset}>reset</button>
    </div>
  );
}

function pasang() {
  return render(
    <NavigasiVisibilitasProvider>
      <Harness />
    </NavigasiVisibilitasProvider>,
  );
}

const kosong = {
  mode: 'global' as const,
  global_tersembunyi: [] as string[],
  pribadi_tersembunyi: [] as string[],
  tersembunyi: [] as string[],
};

describe('NavigasiVisibilitasProvider', () => {
  beforeEach(() => {
    muat.mockReset().mockResolvedValue(kosong);
    simpan.mockReset().mockImplementation(async (tersembunyi: string[]) => ({
      pesan: 'ok',
      mode: 'global' as const,
      global_tersembunyi: tersembunyi,
      pribadi_tersembunyi: [],
      tersembunyi,
    }));
  });

  it('memuat setelan dari server', async () => {
    muat.mockResolvedValue({
      mode: 'global',
      global_tersembunyi: ['grup:penilaian'],
      pribadi_tersembunyi: [],
      tersembunyi: ['grup:penilaian'],
    });
    pasang();

    await waitFor(() => expect(screen.getByTestId('memuat').textContent).toBe('0'));
    expect(screen.getByTestId('tersembunyi').textContent).toBe('grup:penilaian');
    expect(screen.getByTestId('mode').textContent).toBe('global');
  });

  it('menyimpan toggle global ke server', async () => {
    pasang();
    await waitFor(() => expect(screen.getByTestId('memuat').textContent).toBe('0'));

    fireEvent.click(document.getElementById('uji_jungkit')!);

    await waitFor(() => expect(simpan).toHaveBeenCalledWith(['grup:penilaian']));
    expect(screen.getByTestId('tersembunyi').textContent).toBe('grup:penilaian');
  });

  it('menyembunyikan beberapa kunci sekaligus dan mereset global', async () => {
    pasang();
    await waitFor(() => expect(screen.getByTestId('memuat').textContent).toBe('0'));

    fireEvent.click(document.getElementById('uji_atur')!);
    await waitFor(() => expect(simpan).toHaveBeenCalledWith([
      'grup:penilaian',
      'halaman:/penilaian/leger',
    ]));

    fireEvent.click(document.getElementById('uji_reset')!);
    await waitFor(() => expect(simpan).toHaveBeenLastCalledWith([]));
    expect(screen.getByTestId('tersembunyi').textContent).toBe('');
  });

  it('hanya memuat kunci navigasi yang dikenal', async () => {
    muat.mockResolvedValue({
      mode: 'global',
      global_tersembunyi: ['grup:penilaian', 'ngawur'],
      pribadi_tersembunyi: [],
      tersembunyi: ['grup:penilaian', 'ngawur'],
    });
    pasang();

    await waitFor(() => expect(screen.getByTestId('memuat').textContent).toBe('0'));
    expect(screen.getByTestId('tersembunyi').textContent).toBe('grup:penilaian');
  });

  it('admin memakai setelan pribadi dan tidak bisa mengubah entri global', async () => {
    muat.mockResolvedValue({
      mode: 'pribadi',
      global_tersembunyi: ['grup:penilaian'],
      pribadi_tersembunyi: [],
      tersembunyi: ['grup:penilaian'],
    });
    simpan.mockImplementation(async (tersembunyi: string[]) => ({
      pesan: 'ok',
      mode: 'pribadi' as const,
      global_tersembunyi: ['grup:penilaian'],
      pribadi_tersembunyi: tersembunyi,
      tersembunyi: ['grup:penilaian', ...tersembunyi],
    }));
    pasang();

    await waitFor(() => expect(screen.getByTestId('memuat').textContent).toBe('0'));
    expect(screen.getByTestId('mode').textContent).toBe('pribadi');
    expect(screen.getByTestId('global').textContent).toBe('grup:penilaian');

    fireEvent.click(document.getElementById('uji_atur')!);

    await waitFor(() => expect(simpan).toHaveBeenCalledWith(['halaman:/penilaian/leger']));
  });

  it('kunci navigasi mencakup grup, sub-grup, halaman, dan tab', () => {
    const kunci = semuaKunciNavigasi();

    expect(kunci.has('grup:penilaian')).toBe(true);
    expect(kunci.has('sub:dokumen:santri')).toBe(true);
    expect(kunci.has('halaman:/penilaian/leger')).toBe(true);
    expect(kunci.has('tab:/lembaga')).toBe(true);
  });
});
