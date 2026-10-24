import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderDenganTema } from '@/test/utils';
import { KonfirmasiDraftTabel } from './KonfirmasiDraftTabel';

function tampilkan(props: Partial<Parameters<typeof KonfirmasiDraftTabel>[0]> = {}) {
  const onSimpan = vi.fn();
  const onBuang = vi.fn();
  const onTetap = vi.fn();
  renderDenganTema(
    <KonfirmasiDraftTabel
      open
      tujuan="berpindah kegiatan evaluatif"
      sibuk={false}
      galat=""
      onSimpan={onSimpan}
      onBuang={onBuang}
      onTetap={onTetap}
      {...props}
    />,
  );

  return { onSimpan, onBuang, onTetap };
}

describe('KonfirmasiDraftTabel', () => {
  it('menampilkan tiga pilihan beserta tujuan perpindahan', () => {
    tampilkan();
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText('Simpan perubahan sebelum pindah?')).toBeInTheDocument();
    expect(within(dialog).getByText(/berpindah kegiatan evaluatif/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Simpan dan lanjut' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Buang perubahan' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Tetap di sini' })).toBeInTheDocument();
  });

  it('meneruskan pilihan simpan, buang, dan tetap', async () => {
    const user = userEvent.setup();
    const { onSimpan, onBuang, onTetap } = tampilkan();
    const dialog = screen.getByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Simpan dan lanjut' }));
    expect(onSimpan).toHaveBeenCalledTimes(1);

    await user.click(within(dialog).getByRole('button', { name: 'Buang perubahan' }));
    expect(onBuang).toHaveBeenCalledTimes(1);

    await user.click(within(dialog).getByRole('button', { name: 'Tetap di sini' }));
    expect(onTetap).toHaveBeenCalledTimes(1);
  });

  it('menonaktifkan pilihan saat proses simpan berjalan dan menampilkan galat', () => {
    tampilkan({ sibuk: true, galat: 'Sebagian nilai gagal disimpan.' });
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByRole('alert')).toHaveTextContent('Sebagian nilai gagal disimpan.');
    expect(within(dialog).getByRole('button', { name: 'Menyimpan…' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Buang perubahan' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Tetap di sini' })).toBeDisabled();
  });
});
