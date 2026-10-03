import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HalamanTabs, { ArahHalamanTabs } from './HalamanTabs';
import { HALAMAN_DATA_INDUK, HALAMAN_PENEMPATAN } from '@/lib/halaman';

/** Status sesi & pref perangkat yang dibaca komponen (dimock di bawah). */
const status = vi.hoisted(() => ({
  user: null as { permissions: string[] } | null,
  pref: {} as Record<string, string>,
}));

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ user: status.user }),
}));

vi.mock('@/api/client', () => ({
  prefGet: async (kunci: string) => status.pref[kunci] ?? null,
  prefSet: async (kunci: string, nilai: string) => {
    status.pref[kunci] = nilai;
  },
}));

const IZIN_DATA_INDUK = [
  'pengguna.lihat',
  'lembaga.lihat',
  'tahun_ajaran.lihat',
  'kelas.lihat',
  'santri.lihat',
  'referensi.lihat',
];
const IZIN_PENEMPATAN = ['santri.lihat', 'rekap_santri.lihat', 'riwayat_belajar.lihat'];

/** Rute tiruan: dua halaman gabungan + penanda teks tiap tab. */
function Halaman({ path }: { path: string }) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/data-induk" element={<ArahHalamanTabs def={HALAMAN_DATA_INDUK} />} />
        <Route element={<HalamanTabs def={HALAMAN_DATA_INDUK} />}>
          <Route path="/users" element={<p>ISI PENGGUNA</p>} />
          <Route path="/lembaga" element={<p>ISI LEMBAGA</p>} />
          <Route path="/tahun-ajaran" element={<p>ISI TAHUN AJARAN</p>} />
          <Route path="/kelas" element={<p>ISI KELAS</p>} />
          <Route path="/santri" element={<p>ISI BUKU INDUK</p>} />
          <Route path="/referensi" element={<p>ISI REFERENSI</p>} />
        </Route>
        <Route path="/penempatan" element={<ArahHalamanTabs def={HALAMAN_PENEMPATAN} />} />
        <Route element={<HalamanTabs def={HALAMAN_PENEMPATAN} />}>
          <Route path="/keanggotaan" element={<p>ISI SANTRI PER LEMBAGA</p>} />
          <Route path="/mi-md" element={<p>ISI MI-MD</p>} />
          <Route path="/riwayat-belajar" element={<p>ISI RIWAYAT BELAJAR</p>} />
        </Route>
        <Route path="/" element={<p>BERANDA</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  status.user = { permissions: [...IZIN_DATA_INDUK, ...IZIN_PENEMPATAN] };
  for (const kunci of Object.keys(status.pref)) delete status.pref[kunci];
});

describe('HalamanTabs — Data Induk', () => {
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
    expect(status.pref.simpes_data_induk_tab).toBe('/referensi');
  });
});

describe('HalamanTabs — Penempatan', () => {
  it('menampilkan tiga tab dan isi tab aktif', () => {
    render(<Halaman path="/riwayat-belajar" />);

    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Santri Per Lembaga',
      'MI-MD',
      'Riwayat Belajar',
    ]);
    expect(screen.getByRole('tab', { name: 'Riwayat Belajar' })).toHaveAttribute(
      'data-state',
      'active',
    );
    expect(screen.getByText('ISI RIWAYAT BELAJAR')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'MI-MD' })).toHaveAttribute('id', 'tab_penempatan_mi_md');
  });

  it('hanya menampilkan tab yang diizinkan', () => {
    status.user = { permissions: ['rekap_santri.lihat'] };
    render(<Halaman path="/mi-md" />);

    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['MI-MD']);
    expect(screen.getByText('ISI MI-MD')).toBeInTheDocument();
  });

  it('klik tab mengubah rute dan mengingat tab terakhir', async () => {
    const pengguna = userEvent.setup();
    render(<Halaman path="/keanggotaan" />);

    await pengguna.click(screen.getByRole('tab', { name: 'MI-MD' }));

    expect(await screen.findByText('ISI MI-MD')).toBeInTheDocument();
    expect(status.pref.simpes_penempatan_tab).toBe('/mi-md');
  });
});

describe('ArahHalamanTabs (rute halaman gabungan)', () => {
  it('Data Induk: kembali ke tab terakhir yang masih diizinkan', async () => {
    status.pref.simpes_data_induk_tab = '/kelas';
    render(<Halaman path="/data-induk" />);

    expect(await screen.findByText('ISI KELAS')).toBeInTheDocument();
  });

  it('Penempatan: kembali ke tab terakhir yang masih diizinkan', async () => {
    status.pref.simpes_penempatan_tab = '/mi-md';
    render(<Halaman path="/penempatan" />);

    expect(await screen.findByText('ISI MI-MD')).toBeInTheDocument();
  });

  it('tab terakhir yang tak diizinkan → tab pertama yang diizinkan', async () => {
    status.pref.simpes_penempatan_tab = '/mi-md';
    status.user = { permissions: ['riwayat_belajar.lihat'] };
    render(<Halaman path="/penempatan" />);

    expect(await screen.findByText('ISI RIWAYAT BELAJAR')).toBeInTheDocument();
  });

  it('tanpa satu pun izin halaman → beranda', async () => {
    status.user = { permissions: [] };
    render(<Halaman path="/data-induk" />);

    expect(await screen.findByText('BERANDA')).toBeInTheDocument();
  });
});
