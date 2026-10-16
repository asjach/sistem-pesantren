import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from './ErrorBoundary';

/** Anak yang selalu melempar saat render. */
function Meledak({ pesan = 'kolom tak ada' }: { pesan?: string }): never {
  throw new Error(pesan);
}


describe('ErrorBoundary', () => {
  let galatConsole: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    /* React & batas galat sengaja mencetak galatnya; di tes itu jadi derau. */
    galatConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    galatConsole.mockRestore();
  });

  it('menampilkan isi anak apa adanya saat tak ada galat', () => {
    render(
      <ErrorBoundary>
        <p>isi aman</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('isi aman')).toBeInTheDocument();
    expect(document.getElementById('tampilan_galat')).toBeNull();
  });

  it('menampilkan panel galat berisi pesan, judul, dan dua tombol', () => {
    render(
      <ErrorBoundary judul="Gagal menampilkan daftar" keterangan="Coba lagi.">
        <Meledak pesan="kolom tak ada" />
      </ErrorBoundary>,
    );

    const panel = document.getElementById('tampilan_galat');
    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute('role', 'alert');
    expect(screen.getByText('Gagal menampilkan daftar')).toBeInTheDocument();
    expect(screen.getByText('Coba lagi.')).toBeInTheDocument();
    expect(document.getElementById('pesan_galat')).toHaveTextContent('kolom tak ada');
    expect(document.getElementById('btn_coba_lagi')).toBeInTheDocument();
    expect(document.getElementById('btn_muat_ulang')).toBeInTheDocument();
  });

  it('tanpa judul/keterangan memakai teks bawaan', () => {
    render(
      <ErrorBoundary>
        <Meledak />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Terjadi kesalahan saat menampilkan bagian ini')).toBeInTheDocument();
  });

  it('mencatat jejak galat ke console untuk penelusuran', () => {
    render(
      <ErrorBoundary>
        <Meledak pesan="dsg meledak" />
      </ErrorBoundary>,
    );
    const dipanggil = galatConsole.mock.calls.some((k) => String(k[0]).includes('[SIMPES] galat render'));
    expect(dipanggil).toBe(true);
  });

  it('"Coba lagi" melepas galat lalu merender ulang anaknya', async () => {
    const pengguna = userEvent.setup();
    /* Penanda dinyalakan TES (bukan oleh render) supaya React yang mencoba
       render ulang sendiri setelah galat tetap mendapat galat yang sama. */
    const pulih = { v: false };
    function Kadang(): ReactElement {
      if (!pulih.v) throw new Error('belum boleh');
      return <p>isi pulih</p>;
    }
    render(
      <ErrorBoundary>
        <Kadang />
      </ErrorBoundary>,
    );
    expect(document.getElementById('tampilan_galat')).not.toBeNull();

    pulih.v = true;
    await pengguna.click(document.getElementById('btn_coba_lagi') as HTMLElement);

    expect(document.getElementById('tampilan_galat')).toBeNull();
    expect(screen.getByText('isi pulih')).toBeInTheDocument();
  });

  it('"Muat ulang" memakai penimpa aksi (tak menyentuh window.location)', async () => {
    const pengguna = userEvent.setup();
    const muatUlang = vi.fn();
    render(
      <ErrorBoundary onMuatUlang={muatUlang}>
        <Meledak />
      </ErrorBoundary>,
    );

    await pengguna.click(document.getElementById('btn_muat_ulang') as HTMLElement);

    expect(muatUlang).toHaveBeenCalledTimes(1);
  });

  it('anak yang gagal berhenti dirender begitu panel galat tampil', () => {
    let jumlahRender = 0;
    function Hitung(): never {
      jumlahRender += 1;
      throw new Error('hitung');
    }
    const { rerender } = render(
      <ErrorBoundary>
        <Hitung />
      </ErrorBoundary>,
    );
    expect(document.getElementById('tampilan_galat')).not.toBeNull();
    /* React boleh mencoba render beberapa kali sebelum menyerah ke batas —
       yang penting: setelah panel tampil, anak tak dirender lagi walau batas
       ini di-render ulang dengan prop baru. */
    const setelahTampil = jumlahRender;
    rerender(
      <ErrorBoundary judul="Masih gagal">
        <Hitung />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Masih gagal')).toBeInTheDocument();
    expect(jumlahRender).toBe(setelahTampil);
  });
});
