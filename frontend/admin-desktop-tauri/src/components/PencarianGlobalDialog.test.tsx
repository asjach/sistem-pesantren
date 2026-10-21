import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/pencarianGlobal', () => ({
  muatSetelanPencarian: vi.fn(),
  simpanSetelanPencarian: vi.fn(),
}));

import {
  muatSetelanPencarian,
  simpanSetelanPencarian,
} from '@/api/pencarianGlobal';
import PencarianGlobalDialog from './PencarianGlobalDialog';
import { renderDenganTema } from '@/test/utils';

const muat = vi.mocked(muatSetelanPencarian);
const simpan = vi.mocked(simpanSetelanPencarian);
const data = [
  { page_key: 'daftar_kelas', label: 'Daftar Kelas', aktif: true },
  { page_key: 'santri', label: 'Buku Induk Santri', aktif: true },
  { page_key: 'pegawai', label: 'Buku Induk Guru', aktif: true },
  { page_key: 'keuangan', label: 'Tagihan', aktif: true },
];

describe('PencarianGlobalDialog', () => {
  beforeEach(() => {
    muat.mockReset().mockResolvedValue({ data });
    simpan.mockReset().mockResolvedValue({ pesan: 'ok', data });
  });

  it('memuat checkbox halaman dan menyimpan perubahan', async () => {
    const onOpenChange = vi.fn();
    renderDenganTema(
      <PencarianGlobalDialog open onOpenChange={onOpenChange} />,
    );

    await waitFor(() => expect(screen.getByText('Buku Induk Santri')).toBeInTheDocument());
    fireEvent.click(document.getElementById('cek_pencarian_santri')!);
    fireEvent.click(document.getElementById('btn_simpan_pencarian_global')!);

    await waitFor(() => expect(simpan).toHaveBeenCalledWith({
      daftar_kelas: true,
      santri: false,
      pegawai: true,
      keuangan: true,
    }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
