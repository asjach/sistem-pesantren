import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import BantuanKeyboard from './BantuanKeyboard';
import { renderDenganTema } from '@/test/utils';

function pasang(open = false) {
  const onOpenChange = vi.fn();
  const hasil = renderDenganTema(
    <BantuanKeyboard open={open} onOpenChange={onOpenChange} />,
  );

  return { ...hasil, onOpenChange };
}

describe('BantuanKeyboard', () => {
  it('membuka lewat pintasan ?', () => {
    const { onOpenChange } = pasang();

    fireEvent.keyDown(window, { key: '?' });

    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('mengabaikan ? saat pengguna sedang mengetik', () => {
    const { onOpenChange } = pasang();
    const input = document.createElement('input');
    document.body.appendChild(input);

    fireEvent.keyDown(input, { key: '?' });

    expect(onOpenChange).not.toHaveBeenCalled();
    input.remove();
  });

  it('mengabaikan ? saat ada modifier', () => {
    const { onOpenChange } = pasang();

    fireEvent.keyDown(window, { key: '?', ctrlKey: true });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('menampilkan daftar pintasan utama', async () => {
    pasang(true);

    await waitFor(() => expect(document.querySelector('[data-slot="dialog-title"]')).not.toBeNull());
    expect(document.querySelector('[data-slot="dialog-title"]')?.textContent).toBe('Bantuan keyboard');
    expect(screen.getByText('Palet perintah')).toBeInTheDocument();
    expect(screen.getByText('Cari di halaman')).toBeInTheDocument();
    expect(screen.getByText('Ctrl/⌘ K')).toBeInTheDocument();
    expect(screen.getByText('/')).toBeInTheDocument();
  });

  it('menutup dengan Escape', async () => {
    const { onOpenChange } = pasang(true);

    await waitFor(() => expect(document.querySelector('[data-slot="dialog-content"]')).not.toBeNull());
    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
