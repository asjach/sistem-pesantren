import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProfilSantriPage from './ProfilSantriPage';
import { renderDenganTema } from '@/test/utils';
import type { ProfilSantri } from '@/api/siklus';

const profil = {
  santri: {
    id: 7,
    nama_lengkap: 'Ahmad Fauzi',
    nama_singkat: null,
    nik: '3201011505950001',
    nisn: null,
    tmp_lahir: null,
    tgl_lahir: null,
    jk: 'L',
    tipe_santri: null,
    is_active_pst: 'Ya',
  },
  keanggotaan: [],
  riwayat: [],
  mutasi: [],
  alumni: [],
} as unknown as ProfilSantri;

const profilSantri = vi.fn(async (_id: number) => profil);
vi.mock('@/api/siklus', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/siklus')>();
  return { ...asli, profilSantri: (id: number) => profilSantri(id) };
});

function renderHalaman(path = '/santri/7/profil') {
  return renderDenganTema(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/santri/:id/profil" element={<ProfilSantriPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProfilSantriPage', () => {
  beforeEach(() => {
    profilSantri.mockClear();
  });

  it('memuat Santri sesuai id pada rute dan menampilkan profilnya', async () => {
    renderHalaman();

    expect(await screen.findByRole('heading', { level: 1, name: 'Ahmad Fauzi' })).toBeInTheDocument();
    expect(profilSantri).toHaveBeenCalledWith(7);
    // Isi yang sama dengan dialog: bagian-bagiannya ada semua.
    for (const judul of ['Identitas', 'Alamat', 'Keluarga', 'Keanggotaan & riwayat']) {
      expect(screen.getByRole('heading', { name: judul })).toBeInTheDocument();
    }
  });

  it('berdiri sendiri: mengisi tinggi viewport, bukan tinggi tetap dialog', async () => {
    renderHalaman();
    await screen.findByRole('heading', { level: 1, name: 'Ahmad Fauzi' });

    // Rute ini di luar kerangka aplikasi, jadi halaman yang mengisi sendiri
    // seluruh tinggi viewport (h-screen), bukan flex-1 di dalam <main> Layout.
    const akar = screen.getByRole('heading', { level: 1, name: 'Ahmad Fauzi' })
      .closest('div.h-screen') as HTMLElement;
    expect(akar).not.toBeNull();

    // Area isi mengisi sisa tinggi, bukan tinggi tetap milik dialog.
    const isi = document.querySelector('[data-part="isi_profil"]') as HTMLElement;
    expect(isi.className).toContain('flex-1');
    expect(isi.className).not.toContain('h-[60vh]');
  });

  it('menyediakan tombol Kembali', async () => {
    renderHalaman();
    await screen.findByRole('heading', { level: 1, name: 'Ahmad Fauzi' });

    const kembali = screen.getByRole('button', { name: /Kembali/ });
    expect(within(kembali).getByText('Kembali')).toBeInTheDocument();
  });

  it('menampilkan pesan memuat saat id rute tidak valid', async () => {
    renderHalaman('/santri/abc/profil');

    expect(await screen.findByText('Memuat data…')).toBeInTheDocument();
    expect(profilSantri).not.toHaveBeenCalled();
  });
});
