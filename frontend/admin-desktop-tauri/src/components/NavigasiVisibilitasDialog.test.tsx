import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import NavigasiVisibilitasDialog from './NavigasiVisibilitasDialog';
import { NavigasiVisibilitasProvider } from './NavigasiVisibilitasProvider';
import { renderDenganTema } from '@/test/utils';

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
    localStorage.clear();
  });

  it('menyembunyikan grup beserta turunannya dan bisa menampilkan semua', () => {
    pasang();

    fireEvent.click(document.getElementById('cek_nav_grup_penilaian')!);

    const tersimpan = JSON.parse(localStorage.getItem('simpes_navigasi_tersembunyi')!);
    expect(tersimpan).toContain('grup:penilaian');
    expect(tersimpan).toContain('halaman:/penilaian/leger');

    fireEvent.click(document.getElementById('btn_tampilkan_semua_navigasi')!);

    expect(JSON.parse(localStorage.getItem('simpes_navigasi_tersembunyi')!)).toEqual([]);
  });

  it('memuat pohon grup, sub-grup, halaman, dan tab', () => {
    pasang();

    expect(screen.getAllByText('Data Induk').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dokumen').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Santri').length).toBeGreaterThan(0);
    expect(screen.getByText('Leger Nilai')).toBeInTheDocument();
  });
});
