import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DataIndukTabs, { ArahDataInduk } from './DataIndukTabs';

/** Status sesi & pref perangkat yang dibaca komponen (dimock di bawah). */
const status = vi.hoisted(() => ({
  user: null as { permissions: string[] } | null,
  pref: null as string | null,
}));

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ user: status.user }),
}));

vi.mock('@/api/client', () => ({
  prefGet: async (kunci: string) => (kunci === 'simpes_data_induk_tab' ? status.pref : null),
  prefSet: async (kunci: string, nilai: string) => {
    if (kunci === 'simpes_data_induk_tab') status.pref = nilai;
  },
}));

const SEMUA_IZIN = [
  'pengguna.lihat',
  'lembaga.lihat',
  'tahun_ajaran.lihat',
  'kelas.lihat',
  'santri.lihat',
  'referensi.lihat',
];

/** Rute tiruan: kerangka tab + halaman tiap tab (penanda teks). */
function Halaman({ path }: { path: string }) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<DataIndukTabs />}>
          <Route path="/users" element={<p>ISI PENGGUNA</p>} />
          <Route path="/lembaga" element={<p>ISI LEMBAGA</p>} />
          <Route path="/tahun-ajaran" element={<p>ISI TAHUN AJARAN</p>} />
          <Route path="/kelas" element={<p>ISI KELAS</p>} />
          <Route path="/santri" element={<p>ISI BUKU INDUK</p>} />
          <Route path="/referensi" element={<p>ISI REFERENSI</p>} />
        </Route>
        <Route path="/data-induk" element={<ArahDataInduk />} />
        <Route path="/" element={<p>BERANDA</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  status.user = { permissions: [...SEMUA_IZIN] };
  status.pref = null;
});

describe('DataIndukTabs', () => {
  it('menampilkan enam tab dan isi tab aktif', () => {
    render(<Halaman path="/kelas" />);

    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Pengguna',
      'Lembaga',
      'Tahun Ajaran',
      'Kelas',
      'Buku Induk',
      'Referensi',
    ]);
    expect(screen.getByRole('tab', { name: 'Kelas' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByText('ISI KELAS')).toBeInTheDocument();
    // Id elemen snake_case (NFR-05).
    expect(screen.getByRole('tab', { name: 'Tahun Ajaran' })).toHaveAttribute(
      'id',
      'tab_data_induk_tahun_ajaran',
    );
  });

  it('hanya menampilkan tab yang diizinkan', () => {
    status.user = { permissions: ['referensi.lihat'] };
    render(<Halaman path="/referensi" />);

    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Referensi']);
    expect(screen.getByText('ISI REFERENSI')).toBeInTheDocument();
  });

  it('klik tab mengubah rute dan mengingat tab terakhir', async () => {
    const pengguna = userEvent.setup();
    render(<Halaman path="/users" />);

    await pengguna.click(screen.getByRole('tab', { name: 'Referensi' }));

    expect(await screen.findByText('ISI REFERENSI')).toBeInTheDocument();
    expect(status.pref).toBe('/referensi');
  });
});

describe('ArahDataInduk (/data-induk)', () => {
  it('kembali ke tab terakhir yang masih diizinkan', async () => {
    status.pref = '/kelas';
    render(<Halaman path="/data-induk" />);

    expect(await screen.findByText('ISI KELAS')).toBeInTheDocument();
  });

  it('tab terakhir yang tak diizinkan → tab pertama yang diizinkan', async () => {
    status.pref = '/users';
    status.user = { permissions: ['referensi.lihat'] };
    render(<Halaman path="/data-induk" />);

    expect(await screen.findByText('ISI REFERENSI')).toBeInTheDocument();
  });

  it('tanpa satu pun izin Data Induk → beranda', async () => {
    status.user = { permissions: [] };
    render(<Halaman path="/data-induk" />);

    expect(await screen.findByText('BERANDA')).toBeInTheDocument();
  });
});
