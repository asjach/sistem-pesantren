import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DraftGuardProvider, useDraftGuard, useMintaJalan } from './draftGuard';

function Kontrol({ onJalan }: { onJalan: () => void }) {
  const mintaJalan = useMintaJalan();
  return <button type="button" onClick={() => mintaJalan('pindah halaman', onJalan)}>Jalan</button>;
}

describe('draftGuard', () => {
  it('tanpa halaman berpenjaga, perubahan langsung dijalankan', () => {
    const onJalan = vi.fn();
    render(<Kontrol onJalan={onJalan} />);

    fireEvent.click(screen.getByRole('button', { name: 'Jalan' }));

    expect(onJalan).toHaveBeenCalledTimes(1);
  });

  it('halaman berpenjaga menerima tujuan dan menahan perubahan sampai diputuskan', () => {
    const onJalan = vi.fn();
    const dicatat: string[] = [];
    let jalankanTertunda: (() => void) | null = null;

    function Halaman() {
      const guard = useDraftGuard();
      useEffect(() => guard?.daftarkan((tujuan, jalankan) => {
        dicatat.push(tujuan);
        jalankanTertunda = jalankan;
      }), [guard]);
      return null;
    }

    render(
      <DraftGuardProvider>
        <Halaman />
        <Kontrol onJalan={onJalan} />
      </DraftGuardProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Jalan' }));

    expect(dicatat).toEqual(['pindah halaman']);
    expect(onJalan).not.toHaveBeenCalled();

    act(() => jalankanTertunda?.());

    expect(onJalan).toHaveBeenCalledTimes(1);
  });

  it('penjaga dilepas saat halaman unmount sehingga perubahan kembali langsung', () => {
    const onJalan = vi.fn();

    function Halaman() {
      const guard = useDraftGuard();
      useEffect(() => guard?.daftarkan(() => {}), [guard]);
      return null;
    }

    function Uji() {
      const [tampil, setTampil] = useState(true);
      return (
        <DraftGuardProvider>
          {tampil && <Halaman />}
          <button type="button" onClick={() => setTampil(false)}>Lepas</button>
          <Kontrol onJalan={onJalan} />
        </DraftGuardProvider>
      );
    }

    render(<Uji />);
    fireEvent.click(screen.getByRole('button', { name: 'Lepas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Jalan' }));

    expect(onJalan).toHaveBeenCalledTimes(1);
  });
});
