import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/pencarianGlobal', () => ({
  cariGlobal: vi.fn(),
}));

import { cariGlobal } from '@/api/pencarianGlobal';
import PopupCariGlobal from './PopupCariGlobal';
import { renderDenganTema } from '@/test/utils';

const cari = vi.mocked(cariGlobal);

function hasil(judul = 'Ahmad Fauzi') {
  return {
    hasil: [{
      halaman: 'santri',
      label: 'Buku Induk Santri',
      hasil: [{
        id: 1,
        judul,
        keterangan: 'NIS 001',
        kueri: '001',
        target: '/santri/1/profil',
      }],
    }],
  };
}

function pasang(kueri = 'Ahmad') {
  const onPilih = vi.fn();
  const onTutup = vi.fn();
  renderDenganTema(
    <PopupCariGlobal kueri={kueri} onPilih={onPilih} onTutup={onTutup} />,
  );

  return { onPilih, onTutup };
}

describe('PopupCariGlobal', () => {
  beforeEach(() => {
    cari.mockReset();
    cari.mockResolvedValue(hasil());
  });

  it('menampilkan hasil dan memilih target', async () => {
    const { onPilih } = pasang();

    await waitFor(() => expect(screen.getByText('Ahmad Fauzi')).toBeInTheDocument());
    fireEvent.click(document.getElementById('cari_global_santri_1')!);

    expect(onPilih).toHaveBeenCalledWith('/santri/1/profil', '001');
  });

  it('menutup saat klik di luar dan Escape', () => {
    const { onTutup } = pasang();

    fireEvent.pointerDown(document.body);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onTutup).toHaveBeenCalledTimes(2);
  });

  it('meminta minimal dua karakter', () => {
    pasang('a');

    expect(screen.getByText('Ketik minimal 2 karakter.')).toBeInTheDocument();
    expect(cari).not.toHaveBeenCalled();
  });

  it('menampilkan empty state saat tidak ada hasil', async () => {
    cari.mockResolvedValue({ hasil: [] });
    pasang();

    await waitFor(() => expect(screen.getByText(/Tidak ada hasil/)).toBeInTheDocument());
  });
});
