import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import Pager from '@/components/Pager';
import { renderDenganTema } from '@/test/utils';

function pasang(overrides: Partial<Parameters<typeof Pager>[0]> = {}) {
  const props: Parameters<typeof Pager>[0] = {
    page: 2,
    lastPage: 5,
    total: 250,
    perPage: 50,
    onPage: vi.fn(),
    onPerPage: vi.fn(),
    ...overrides,
  };
  renderDenganTema(<Pager {...props} />);
  return props;
}

describe('Pager', () => {
  it('menampilkan posisi halaman dan jumlah data', () => {
    pasang();
    expect(screen.getByText('Hal 2 / 5')).toBeInTheDocument();
    expect(screen.getByText('250 data')).toBeInTheDocument();
  });

  it('tombol sebelumnya terkunci di halaman 1 dan berikutnya di halaman terakhir', () => {
    const { unmount } = renderDenganTema(
      <Pager page={1} lastPage={5} total={250} perPage={50} onPage={() => {}} onPerPage={() => {}} />,
    );
    expect(screen.getByLabelText('Halaman sebelumnya')).toBeDisabled();
    expect(screen.getByLabelText('Halaman berikutnya')).toBeEnabled();
    unmount();

    renderDenganTema(
      <Pager page={5} lastPage={5} total={250} perPage={50} onPage={() => {}} onPerPage={() => {}} />,
    );
    expect(screen.getByLabelText('Halaman berikutnya')).toBeDisabled();
  });

  it('klik tombol memanggil onPage dengan halaman tetangga', async () => {
    const user = userEvent.setup();
    const props = pasang();

    await user.click(screen.getByLabelText('Halaman berikutnya'));
    expect(props.onPage).toHaveBeenCalledWith(3);

    await user.click(screen.getByLabelText('Halaman sebelumnya'));
    expect(props.onPage).toHaveBeenCalledWith(1);
  });

  it('tombol All tersedia untuk memuat seluruh data', async () => {
    const user = userEvent.setup();
    const props = pasang();

    const all = screen.getByTitle('Semua data per halaman');
    await user.click(all);
    expect(props.onPerPage).toHaveBeenCalledWith(0);
  });
});
