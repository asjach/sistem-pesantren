import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  NavigasiVisibilitasProvider,
  useNavigasiVisibilitas,
} from './NavigasiVisibilitasProvider';
import { semuaKunciNavigasi } from '@/lib/halaman';

function Harness() {
  const { tersembunyi, jungkit, atur, reset } = useNavigasiVisibilitas();

  return (
    <div>
      <span data-testid="tersembunyi">{[...tersembunyi].join(',')}</span>
      <button type="button" id="uji_jungkit" onClick={() => jungkit('grup:penilaian')}>jungkit</button>
      <button type="button" id="uji_atur" onClick={() => atur(['grup:penilaian', 'halaman:/penilaian/leger'], false)}>atur</button>
      <button type="button" id="uji_reset" onClick={reset}>reset</button>
    </div>
  );
}

describe('NavigasiVisibilitasProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('menyimpan pilihan ke perangkat dan bisa menampilkan semua', () => {
    render(
      <NavigasiVisibilitasProvider>
        <Harness />
      </NavigasiVisibilitasProvider>,
    );

    fireEvent.click(document.getElementById('uji_jungkit')!);
    expect(screen.getByTestId('tersembunyi').textContent).toBe('grup:penilaian');
    expect(JSON.parse(localStorage.getItem('simpes_navigasi_tersembunyi')!)).toEqual(['grup:penilaian']);

    fireEvent.click(document.getElementById('uji_reset')!);
    expect(screen.getByTestId('tersembunyi').textContent).toBe('');
    expect(JSON.parse(localStorage.getItem('simpes_navigasi_tersembunyi')!)).toEqual([]);
  });

  it('menyembunyikan beberapa kunci sekaligus', () => {
    render(
      <NavigasiVisibilitasProvider>
        <Harness />
      </NavigasiVisibilitasProvider>,
    );

    fireEvent.click(document.getElementById('uji_atur')!);

    expect(screen.getByTestId('tersembunyi').textContent).toBe('grup:penilaian,halaman:/penilaian/leger');
  });

  it('hanya memuat kunci navigasi yang dikenal', () => {
    localStorage.setItem('simpes_navigasi_tersembunyi', JSON.stringify(['grup:penilaian', 'ngawur']));
    render(
      <NavigasiVisibilitasProvider>
        <Harness />
      </NavigasiVisibilitasProvider>,
    );

    expect(screen.getByTestId('tersembunyi').textContent).toBe('grup:penilaian');
  });

  it('kunci navigasi mencakup grup, sub-grup, halaman, dan tab', () => {
    const kunci = semuaKunciNavigasi();

    expect(kunci.has('grup:penilaian')).toBe(true);
    expect(kunci.has('sub:dokumen:santri')).toBe(true);
    expect(kunci.has('halaman:/penilaian/leger')).toBe(true);
    expect(kunci.has('tab:/lembaga')).toBe(true);
  });
});
