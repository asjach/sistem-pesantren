import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { renderDenganTema } from '@/test/utils';
import { HapusModul } from './HapusModul';

it('menahan submit ganda dan penutupan selama delete belum selesai', async () => {
  let selesai!: () => void;
  const pending = new Promise<void>((resolve) => { selesai = resolve; });
  const hapus = vi.fn(() => pending);
  const tutup = vi.fn();
  const user = userEvent.setup();
  renderDenganTema(<HapusModul modul={{ kode: 'UJI', nama: 'Modul uji', sub: [] }} onTutup={tutup} onHapus={hapus} />);
  await user.dblClick(screen.getByRole('button', { name: 'Ya, hapus' }));
  expect(hapus).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Menghapus…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Batal' })).toBeDisabled();
  await user.keyboard('{Escape}');
  expect(tutup).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await act(async () => { selesai();await pending; });
});
