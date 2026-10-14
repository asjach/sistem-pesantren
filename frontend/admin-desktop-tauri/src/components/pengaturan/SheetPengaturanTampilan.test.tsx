import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@/theme';
import { GridPrefsProvider } from '@/components/GridPrefs';
import SheetPengaturanTampilan, { bukaPengaturanTampilan } from './SheetPengaturanTampilan';

function Panel({ open }: { open: boolean }) {
  return (
    <ThemeProvider>
      <GridPrefsProvider>
        <SheetPengaturanTampilan open={open} onOpenChange={() => {}} />
      </GridPrefsProvider>
    </ThemeProvider>
  );
}

describe('SheetPengaturanTampilan', () => {
  it('memuat kontrol saat dibuka', async () => {
    render(
      <ThemeProvider>
        <GridPrefsProvider>
          <SheetPengaturanTampilan open onOpenChange={() => {}} />
        </GridPrefsProvider>
      </ThemeProvider>,
    );
    // Judul panel menegaskan cakupannya global.
    expect(await screen.findByText('Pengaturan tampilan tabel')).toBeInTheDocument();
    expect(screen.getByText(/Berlaku untuk/)).toBeInTheDocument();

    // Kontrol inti hadir.
    expect(screen.getByLabelText('Tinggi baris sel (px)')).toBeInTheDocument();
    expect(screen.getByLabelText('Tinggi baris header (px)')).toBeInTheDocument();
    expect(screen.getByLabelText('Jenis huruf header tabel')).toBeInTheDocument();
    expect(screen.getByLabelText('Ukuran huruf header tabel (px)')).toBeInTheDocument();
    expect(screen.getByLabelText('Jenis huruf sel tabel')).toBeInTheDocument();
    expect(screen.getByLabelText('Ukuran huruf sel tabel (px)')).toBeInTheDocument();
    expect(screen.getByLabelText('Warna huruf header tabel')).toBeInTheDocument();
    expect(screen.getByLabelText('Warna latar header tabel')).toBeInTheDocument();
    expect(screen.getByLabelText('Warna huruf sel tabel')).toBeInTheDocument();
    expect(screen.getByLabelText('Warna latar sel tabel')).toBeInTheDocument();
  });

  it('terbuka lewat event global tanpa prop open', async () => {
    render(<Panel open={false} />);
    expect(screen.queryByText('Pengaturan tampilan tabel')).not.toBeInTheDocument();
    // Event inilah yang dipakai tombol gerigi di kaki tabel.
    bukaPengaturanTampilan();
    expect(await screen.findByText('Pengaturan tampilan tabel')).toBeInTheDocument();
  });

  it('mengubah tinggi baris sel tersimpan sebagai pref global', async () => {
    const klik = userEvent.setup();
    render(<Panel open />);
    const input = await screen.findByLabelText('Tinggi baris sel (px)');
    await klik.clear(input);
    await klik.type(input, '28');
    // SpinBox menyimpan saat blur (bukan tiap ketikan).
    await klik.tab();
    // Nilai ditulis ke pref perangkat dengan kunci GLOBAL (bukan per tabel).
    await waitFor(() => {
      expect(localStorage.getItem('simpes_grid_rowh')).toBe('28');
    });
  });
});
