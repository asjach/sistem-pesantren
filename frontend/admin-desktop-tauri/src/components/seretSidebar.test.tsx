import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SeretSidebarProvider, useAksiSeretSidebar, useStatusSeretSidebar } from '@/components/SeretSidebar';
import { renderDenganTema } from '@/test/utils';
import { useTheme } from '@/theme';
import { SIDEBAR_LEBAR_DEFAULT, SIDEBAR_SNAP_HIDE } from '@/prefs';

/** Kenop lipat di topBar: hanya butuh aksi seret (klik diurus pemanggil). */
function Kenop() {
  const { mulaiSeret } = useAksiSeretSidebar();
  return <button id="kenop" type="button" onMouseDown={mulaiSeret} />;
}

/** Peniru Sidebar: status seret + lebar tampil + lebar tersimpan di pref. */
function Panel() {
  const { seret, seretSembunyi, lebarTampil } = useStatusSeretSidebar();
  const { sidebarLebar } = useTheme();
  return (
    <div
      id="panel"
      data-seret={String(seret)}
      data-sembunyi={String(seretSembunyi)}
      data-tampil={String(lebarTampil(false))}
      data-lebar={String(sidebarLebar)}
    />
  );
}

function pasang() {
  return renderDenganTema(
    <SeretSidebarProvider>
      <Kenop />
      <Panel />
    </SeretSidebarProvider>,
  );
}

const panel = () => document.getElementById('panel')!;

function mousedownKenop(clientX: number) {
  act(() => {
    document.getElementById('kenop')!.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, button: 0, clientX }),
    );
  });
}
function geser(clientX: number) {
  act(() => { window.dispatchEvent(new MouseEvent('mousemove', { clientX })); });
}
function lepas() {
  act(() => { window.dispatchEvent(new MouseEvent('mouseup')); });
}

describe('SeretSidebarProvider', () => {
  it('seret dari kenop topBar terlihat oleh Sidebar — satu instans, bukan dua', () => {
    pasang();
    expect(panel().dataset.tampil).toBe(String(SIDEBAR_LEBAR_DEFAULT));

    mousedownKenop(SIDEBAR_LEBAR_DEFAULT);
    geser(SIDEBAR_LEBAR_DEFAULT + 60);

    expect(panel().dataset.seret).toBe('true');
    expect(panel().dataset.tampil).toBe(String(SIDEBAR_LEBAR_DEFAULT + 60));

    lepas();
    expect(panel().dataset.seret).toBe('false');

    expect(panel().dataset.lebar).toBe(String(SIDEBAR_LEBAR_DEFAULT + 60));
  });

  it('seret dari kenop melewati ambang mentok menyembunyikan navigasi', () => {
    pasang();

    mousedownKenop(SIDEBAR_LEBAR_DEFAULT);
    geser(SIDEBAR_SNAP_HIDE - 10);
    expect(panel().dataset.sembunyi).toBe('true');
    expect(panel().dataset.tampil).toBe('0');

    lepas();
    expect(panel().dataset.lebar).toBe(String(SIDEBAR_LEBAR_DEFAULT));
  });

  it('kursor seret dipasang selama seretan lalu dilepas kembali', () => {
    pasang();
    expect(document.body.style.cursor).toBe('');

    mousedownKenop(SIDEBAR_LEBAR_DEFAULT);
    expect(document.body.style.cursor).toBe('col-resize');

    lepas();
    expect(document.body.style.cursor).toBe('');
  });

  it('hook aksi melempar galat bila dipakai di luar provider', () => {
    expect(() => render(<Kenop />)).toThrow(/SeretSidebarProvider/);
  });
});
