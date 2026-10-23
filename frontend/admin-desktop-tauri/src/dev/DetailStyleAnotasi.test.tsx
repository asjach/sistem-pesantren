import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DetailStyleAnotasi from './DetailStyleAnotasi';

const salin = vi.hoisted(() => vi.fn<() => Promise<boolean>>());
vi.mock('@/lib/clipboard', () => ({ copyText: salin }));
afterEach(() => vi.restoreAllMocks());

function buatElemen(warna: string) {
  const elemen = document.createElement('div');
  elemen.style.color = warna;
  document.body.appendChild(elemen);
  return elemen;
}

describe('DetailStyleAnotasi', () => {
  it('membuka dan menutup detail tanpa mengubah elemen yang diperiksa', async () => {
    const user = userEvent.setup();
    const elemen = buatElemen('red');
    const semula = elemen.getAttribute('style');
    render(<DetailStyleAnotasi elemen={elemen} label="asal" />);
    const buka = screen.getByRole('button', { name: 'Detail tampilan asal' });
    expect(buka).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: 'Style asal' })).not.toBeInTheDocument();
    await user.click(buka);
    const detail = within(screen.getByRole('region', { name: 'Style asal' }));
    expect(within(detail.getByRole('region', { name: 'Warna' })).getByText('rgb(255, 0, 0)')).toBeInTheDocument();
    expect(detail.getByText('padding-left')).toBeInTheDocument();
    expect(detail.getByText('font-family')).toBeInTheDocument();
    await user.click(buka);
    expect(screen.queryByRole('region', { name: 'Style asal' })).not.toBeInTheDocument();
    expect(elemen.getAttribute('style')).toBe(semula);
  });

  it('mengikuti elemen baru dan membaca ulang detail saat diminta', async () => {
    const user = userEvent.setup();
    const asal = buatElemen('red');
    const tujuan = buatElemen('blue');
    const { rerender } = render(<DetailStyleAnotasi elemen={asal} label="asal" />);
    await user.click(screen.getByRole('button', { name: 'Detail tampilan asal' }));
    rerender(<DetailStyleAnotasi elemen={tujuan} label="asal" />);
    expect(within(screen.getByRole('region', { name: 'Warna' })).getByText('rgb(0, 0, 255)')).toBeInTheDocument();
    expect(screen.queryByText('rgb(255, 0, 0)')).not.toBeInTheDocument();
    tujuan.style.color = 'green';
    await user.click(screen.getByRole('button', { name: 'Muat ulang detail' }));
    expect(within(screen.getByRole('region', { name: 'Warna' })).getByText('rgb(0, 128, 0)')).toBeInTheDocument();
  });

  it('menyalin nilai yang ditampilkan dan mengumumkan keberhasilan', async () => {
    const user = userEvent.setup();
    salin.mockResolvedValueOnce(true);
    render(<DetailStyleAnotasi elemen={buatElemen('red')} label="asal" />);
    await user.click(screen.getByRole('button', { name: 'Detail tampilan asal' }));
    await user.click(screen.getByRole('button', { name: 'Salin detail' }));
    expect(salin).toHaveBeenCalledWith(expect.stringContaining('color: rgb(255, 0, 0);'));
    expect(screen.getByRole('status')).toHaveTextContent('Detail tampilan tersalin.');
  });

  it.each(['gagal', 'exception'])('menampilkan fallback salin manual saat clipboard %s', async (mode) => {
    const user = userEvent.setup();
    if (mode === 'gagal') salin.mockResolvedValueOnce(false);
    else salin.mockRejectedValueOnce(new Error('Clipboard gagal'));
    render(<DetailStyleAnotasi elemen={buatElemen('red')} label="tujuan" />);
    await user.click(screen.getByRole('button', { name: 'Detail tampilan tujuan' }));
    await user.click(screen.getByRole('button', { name: 'Salin detail' }));
    expect(screen.getByRole('status')).toHaveTextContent('salin secara manual');
    expect(screen.getByRole('region', { name: 'Style tujuan' })).toBeInTheDocument();
  });

  it('membatasi permintaan salin selama clipboard sibuk', async () => {
    const user = userEvent.setup();
    let selesai!: (hasil: boolean) => void;
    salin.mockImplementationOnce(() => new Promise((resolve) => { selesai = resolve; }));
    render(<DetailStyleAnotasi elemen={buatElemen('red')} label="asal" />);
    await user.click(screen.getByRole('button', { name: 'Detail tampilan asal' }));
    await user.click(screen.getByRole('button', { name: 'Salin detail' }));
    expect(screen.getByRole('button', { name: 'Menyalin…' })).toBeDisabled();
    await act(async () => selesai(true));
    expect(screen.getByRole('button', { name: 'Salin detail' })).toBeEnabled();
  });

  it('memberi keterangan saat elemen tidak tersedia', async () => {
    const user = userEvent.setup();
    render(<DetailStyleAnotasi elemen={document.createElement('div')} label="asal" />);
    await user.click(screen.getByRole('button', { name: 'Detail tampilan asal' }));
    expect(screen.getByRole('status')).toHaveTextContent('Detail tampilan tidak tersedia');
    expect(screen.getByRole('button', { name: 'Salin detail' })).toBeDisabled();
  });
});
