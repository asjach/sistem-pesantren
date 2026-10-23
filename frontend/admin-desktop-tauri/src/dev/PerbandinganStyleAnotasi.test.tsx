import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PerbandinganStyleAnotasi from './PerbandinganStyleAnotasi';

afterEach(() => vi.restoreAllMocks());

function siapkan(styleAsal = 'color: red;', styleReferensi = 'color: blue;') {
  const asal = document.createElement('div');
  const referensi = document.createElement('div');
  // Pisahkan warna border dari currentColor agar fixture hanya mengubah warna teks.
  asal.setAttribute('style', `border-color: black; ${styleAsal}`);
  referensi.setAttribute('style', `border-color: black; ${styleReferensi}`);
  document.body.append(asal, referensi);
  const tampilan = render(<PerbandinganStyleAnotasi asal={asal} referensi={referensi} disabled={false} previewAktif={false} />);
  return { asal, referensi, tampilan };
}

describe('PerbandinganStyleAnotasi', () => {
  it('menampilkan perbedaan secara default dan dapat menampilkan properti sama', async () => {
    const user = userEvent.setup();
    siapkan('color: red; padding-top: 4px;', 'color: blue; padding-top: 4px;');
    const panel = within(screen.getByRole('region', { name: 'Perbandingan tampilan' }));
    expect(panel.getByRole('status')).toHaveTextContent('1 properti berbeda');
    expect(panel.getByText('rgb(255, 0, 0)')).toBeInTheDocument();
    expect(panel.getByText('rgb(0, 0, 255)')).toBeInTheDocument();
    expect(panel.queryByText('padding-top', { exact: false })).not.toBeInTheDocument();
    await user.click(panel.getByRole('button', { name: 'Tampilkan semua' }));
    expect(panel.getByText('padding-top', { exact: false })).toBeInTheDocument();
    expect(panel.getByRole('button', { name: 'Hanya perbedaan' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(panel.getByRole('button', { name: 'Hanya perbedaan' }));
    expect(panel.queryByText('padding-top', { exact: false })).not.toBeInTheDocument();
  });
  it('menampilkan keadaan tanpa perbedaan dan membaca ulang style terbaru', async () => {
    const user = userEvent.setup();
    const { referensi } = siapkan('color: red;', 'color: red;');
    expect(screen.getByRole('status')).toHaveTextContent('Tidak ada perbedaan');
    referensi.style.color = 'blue';
    await user.click(screen.getByRole('button', { name: 'Muat ulang perbandingan' }));
    expect(screen.getByRole('status')).toHaveTextContent('1 properti berbeda');
  });
  it('gagal membaca style tidak dianggap sebagai dua style yang sama', async () => {
    const user = userEvent.setup();
    siapkan();
    const asli = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
      if (el.tagName === 'DIV' && el.getAttribute('style')) throw new Error('gagal');
      return asli(el, pseudo);
    });
    await user.click(screen.getByRole('button', { name: 'Muat ulang perbandingan' }));
    expect(screen.getByRole('status')).toHaveTextContent('tidak tersedia');
    expect(screen.getByRole('button', { name: 'Tampilkan semua' })).toBeDisabled();
  });
  it('menandai preview dan mengunci kontrol saat sibuk tanpa mengubah style', () => {
    const { asal, referensi, tampilan } = siapkan();
    const awal = [asal.getAttribute('style'), referensi.getAttribute('style')];
    tampilan.rerender(<PerbandinganStyleAnotasi asal={asal} referensi={referensi} disabled previewAktif />);
    expect(screen.getByText(/Preview aktif/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tampilkan semua' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Muat ulang perbandingan' })).toBeDisabled();
    expect([asal.getAttribute('style'), referensi.getAttribute('style')]).toEqual(awal);
  });
});
