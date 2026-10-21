import { fireEvent, waitFor } from '@testing-library/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { CariGlobalProvider } from '@/hooks/useCariGlobal';
import { PencarianGlobalProvider } from './PencarianGlobalProvider';
import { TopBarSearch, TopBarSearchProvider, useTopBarSearchCtx } from './TopBarSearch';
import { renderDenganTema } from '@/test/utils';

function Harness({ popup }: { popup?: ReactNode }) {
  const ctx = useTopBarSearchCtx();
  const slot = useRef<HTMLDivElement>(null);
  const [nilai, setNilai] = useState('');

  useEffect(() => {
    if (slot.current) ctx?.setEl(slot.current);
  }, [ctx]);

  return (
    <>
      <div ref={slot} />
      <TopBarSearch value={nilai} onChange={setNilai} placeholder="Cari uji" popup={popup} />
    </>
  );
}

function pasang() {
  return renderDenganTema(
    <CariGlobalProvider>
      <TopBarSearchProvider>
        <Harness />
      </TopBarSearchProvider>
    </CariGlobalProvider>,
  );
}

function pasangGlobal(popup?: ReactNode) {
  return renderDenganTema(
    <MemoryRouter>
      <CariGlobalProvider>
        <PencarianGlobalProvider>
          <TopBarSearchProvider>
            <Harness popup={popup} />
          </TopBarSearchProvider>
        </PencarianGlobalProvider>
      </CariGlobalProvider>
    </MemoryRouter>,
  );
}

describe('TopBarSearch - pintasan', () => {
  it('memfokuskan pencarian lewat /', async () => {
    pasang();
    const cari = await waitFor(
      () => document.getElementById('input_cari_topbar') as HTMLInputElement,
    );

    fireEvent.keyDown(document.body, { key: '/' });

    expect(document.activeElement).toBe(cari);
  });

  it('mengabaikan / saat pengguna sedang mengetik', async () => {
    pasang();
    const cari = await waitFor(
      () => document.getElementById('input_cari_topbar') as HTMLInputElement,
    );
    const lain = document.createElement('input');
    document.body.appendChild(lain);
    lain.focus();

    fireEvent.keyDown(lain, { key: '/' });

    expect(document.activeElement).toBe(lain);
    expect(document.activeElement).not.toBe(cari);
    lain.remove();
  });

  it('Ctrl/Cmd+K tidak lagi memfokuskan pencarian', async () => {
    pasang();
    const cari = await waitFor(
      () => document.getElementById('input_cari_topbar') as HTMLInputElement,
    );

    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });

    expect(document.activeElement).not.toBe(cari);
  });

  it('menampilkan popup pencarian global di halaman biasa', async () => {
    pasangGlobal();
    const input = await waitFor(
      () => document.getElementById('input_cari_topbar') as HTMLInputElement,
    );

    fireEvent.change(input, { target: { value: 'a' } });

    expect(document.getElementById('popup_cari_global')).not.toBeNull();
  });

  it('popup khusus menonaktifkan popup pencarian global', async () => {
    pasangGlobal(<div id="popup_khusus" />);
    const input = await waitFor(
      () => document.getElementById('input_cari_topbar') as HTMLInputElement,
    );

    fireEvent.change(input, { target: { value: 'a' } });

    expect(document.getElementById('popup_cari_global')).toBeNull();
    expect(document.getElementById('popup_khusus')).not.toBeNull();
  });
});
