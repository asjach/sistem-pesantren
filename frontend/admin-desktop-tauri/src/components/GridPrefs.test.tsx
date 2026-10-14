import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GridPrefsProvider, useGridPrefs } from './GridPrefs';

const server = vi.hoisted(() => ({ peta: {} as Record<string, number>, gagal: false }));
vi.mock('@/api/pengaturanGlobal', () => ({
  muatPengaturanGlobal: async () => {
    if (server.gagal) throw new Error('jaringan mati');
    return { pesan: 'ok', data: { peta: { ...server.peta } } };
  },
}));

const perangkat = vi.hoisted(() => ({ peta: {} as Record<string, string> }));
vi.mock('@/api/client', () => ({
  prefGet: async (k: string) => perangkat.peta[k] ?? null,
  prefSet: async (k: string, v: string) => { perangkat.peta[k] = v; },
}));

vi.mock('@/theme', () => ({
  useTheme: () => ({ parts: { gaya: {} }, setGayaBagian: vi.fn() }),
}));

/** Menampilkan hasil resolusi supaya bisa diperiksa dari tes. */
function Peraga() {
  const { rowH, headerH, sumberRowH, sumberHeaderH } = useGridPrefs();
  return (
    <div>
      <span data-testid="rowH">{String(rowH)}</span>
      <span data-testid="headerH">{String(headerH)}</span>
      <span data-testid="sumberRowH">{sumberRowH}</span>
      <span data-testid="sumberHeaderH">{sumberHeaderH}</span>
    </div>
  );
}

function tampilkan() {
  return render(<GridPrefsProvider><Peraga /></GridPrefsProvider>);
}

const K_ROWH = 'simpes_grid_rowh';
const K_HEADERH = 'simpes_grid_headerh';

describe('GridPrefs — resolusi bertingkat', () => {
  beforeEach(() => {
    server.peta = {};
    server.gagal = false;
    for (const k of Object.keys(perangkat.peta)) delete perangkat.peta[k];
  });

  it('tanpa standar dan tanpa nilai perangkat -> null (ikuti density DSG)', async () => {
    tampilkan();
    await waitFor(() => expect(screen.getByTestId('sumberRowH')).toHaveTextContent('bawaan'));
    expect(screen.getByTestId('rowH')).toHaveTextContent('null');
  });

  it('standar server dipakai saat perangkat belum diubah', async () => {
    server.peta = { tinggi_baris: 30, tinggi_header: 34 };
    tampilkan();

    await waitFor(() => expect(screen.getByTestId('rowH')).toHaveTextContent('30'));
    expect(screen.getByTestId('headerH')).toHaveTextContent('34');
    expect(screen.getByTestId('sumberRowH')).toHaveTextContent('server');
  });

  it('nilai perangkat MENANG atas standar server', async () => {
    server.peta = { tinggi_baris: 30 };
    perangkat.peta[K_ROWH] = '22';
    tampilkan();

    await waitFor(() => expect(screen.getByTestId('sumberRowH')).toHaveTextContent('perangkat'));
    expect(screen.getByTestId('rowH')).toHaveTextContent('22');
  });

  it('kegagalan memuat standar tidak mengosongkan grid', async () => {
    server.gagal = true;
    perangkat.peta[K_HEADERH] = '28';
    tampilkan();

    await waitFor(() => expect(screen.getByTestId('headerH')).toHaveTextContent('28'));
    expect(screen.getByTestId('sumberHeaderH')).toHaveTextContent('perangkat');
  });

  it('hanya kunci yang punya standar yang terpengaruh', async () => {
    server.peta = { tinggi_baris: 30 };
    tampilkan();

    await waitFor(() => expect(screen.getByTestId('rowH')).toHaveTextContent('30'));
    expect(screen.getByTestId('headerH')).toHaveTextContent('null');
  });
});
