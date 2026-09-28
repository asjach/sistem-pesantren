import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { useAksiProfilSantri } from './useAksiProfilSantri';
import { renderDenganTema } from '@/test/utils';

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
} as unknown as Awaited<ReturnType<typeof import('@/api/siklus').profilSantri>>;

vi.mock('@/api/siklus', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/siklus')>();
  return { ...asli, profilSantri: vi.fn(async () => profil) };
});

/** Meniru pemakaian di halaman: daftar tombol aksi + satu dialog. */
function HalamanSantri() {
  const { aksiProfil, dialogProfil } = useAksiProfilSantri();
  return (
    <div>
      <ul>
        <li>{aksiProfil(7)}</li>
        <li>{aksiProfil(9, 'arsip')}</li>
        <li>{aksiProfil(null)}</li>
      </ul>
      {dialogProfil}
    </div>
  );
}

describe('useAksiProfilSantri', () => {
  it('tombol "Lihat detail Santri" membuka dialog profil untuk Santri itu', async () => {
    const user = userEvent.setup();
    const { container } = renderDenganTema(<HalamanSantri />);

    await user.click(container.querySelector('#btn_profil_santri_7') as HTMLElement);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Ahmad Fauzi' })).toBeInTheDocument();
  });

  it('baris tanpa Santri tidak menghasilkan tombol', () => {
    renderDenganTema(<HalamanSantri />);

    // Dua tombol saja: satu tanpa prefix, satu berprefix `arsip`.
    expect(screen.getAllByRole('button', { name: 'Lihat detail Santri' })).toHaveLength(2);
  });

  it('prefix membedakan id tombol untuk halaman bertabel banyak', () => {
    const { container } = renderDenganTema(<HalamanSantri />);

    expect(container.querySelector('#btn_profil_santri_7')).not.toBeNull();
    expect(container.querySelector('#btn_profil_santri_arsip_9')).not.toBeNull();
  });
});
