import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AplikasiPapan } from '@/api/papan';
import PopupCariPapan from './PopupCariPapan';
import { renderDenganTema } from '@/test/utils';

const aplikasi: AplikasiPapan[] = [{
  kode: 'desktop-admin',
  nama: 'Desktop Admin',
  workflow_aktif: true,
  workflow_efektif: true,
  modul: [{
    kode: 'DA6',
    nama: 'Penilaian',
    sub: [{
      kode: 'DA6.1',
      nama: 'Nilai & Kegiatan Evaluatif',
      status: 'todo',
      butir: [{ id: 90, status: 'todo', deskripsi: 'Login guru ke leger.' }],
    }],
  }],
}];

function pasang(kueri = 'login') {
  const onPilih = vi.fn();
  const onTutup = vi.fn();
  renderDenganTema(
    <PopupCariPapan
      aplikasi={aplikasi}
      kueri={kueri}
      onPilih={onPilih}
      onTutup={onTutup}
    />,
  );

  return { onPilih, onTutup };
}

describe('PopupCariPapan', () => {
  it('menampilkan hasil lintas aplikasi dan memilih poin', () => {
    const { onPilih } = pasang();

    expect(document.getElementById('popup_cari_papan')).not.toBeNull();
    expect(screen.getByText('Desktop Admin')).toBeInTheDocument();
    expect(screen.getByText('DA6')).toBeInTheDocument();
    expect(screen.getByText('Login guru ke leger.')).toBeInTheDocument();

    fireEvent.click(document.getElementById('hasil_cari_90')!);

    expect(onPilih).toHaveBeenCalledTimes(1);
    expect(onPilih.mock.calls[0][0].poin.id).toBe(90);
  });

  it('menutup saat klik di luar', () => {
    const { onTutup } = pasang();

    fireEvent.pointerDown(document.body);

    expect(onTutup).toHaveBeenCalledTimes(1);
  });

  it('menutup dengan Escape', () => {
    const { onTutup } = pasang();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onTutup).toHaveBeenCalledTimes(1);
  });

  it('menampilkan empty state saat tidak ada hasil', () => {
    pasang('tidak-ada-yang-cocok');

    expect(screen.getByText(/Tidak ada hasil/)).toBeInTheDocument();
  });
});
