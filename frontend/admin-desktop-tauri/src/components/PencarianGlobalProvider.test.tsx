import { fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { CariGlobalProvider, useCariGlobal } from '@/hooks/useCariGlobal';
import { PencarianGlobalProvider, usePencarianGlobal } from './PencarianGlobalProvider';
import { renderDenganTema } from '@/test/utils';

function Probe() {
  const { nilai } = useCariGlobal();
  const pencarian = usePencarianGlobal();
  if (!pencarian) return null;

  return (
    <>
      <span data-testid="kata_kunci">{nilai}</span>
      <button type="button" onClick={() => pencarian.pilih('/pegawai?cari=123', '123')}>
        pilih hasil
      </button>
    </>
  );
}

function pasang() {
  return renderDenganTema(
    <MemoryRouter>
      <CariGlobalProvider>
        <PencarianGlobalProvider>
          <Probe />
        </PencarianGlobalProvider>
      </CariGlobalProvider>
    </MemoryRouter>,
  );
}

describe('PencarianGlobalProvider', () => {
  it('membawa kata kunci hasil ke halaman tujuan', async () => {
    pasang();
    const kata = screen.getByTestId('kata_kunci');

    await waitFor(() => expect(kata.textContent).toBe(''));
    fireEvent.click(screen.getByRole('button', { name: 'pilih hasil' }));

    // Kata kunci TIDAK dikosongkan: halaman tujuan memakainya untuk menyaring
    // tabel. Mengosongkan = saringan dari `?cari=` ikut terhapus.
    expect(kata.textContent).toBe('123');
  });
});
