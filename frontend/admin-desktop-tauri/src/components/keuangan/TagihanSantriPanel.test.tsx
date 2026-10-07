import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TagihanSantriPanel from './TagihanSantriPanel';
import type { TagihanRow } from '@/api/keuangan';
import { renderDenganTema } from '@/test/utils';

/** Pengguna bisa ditukar per tes lewat ref agar jalur "tanpa izin" ikut teruji. */
const { pengguna } = vi.hoisted(() => ({
  pengguna: { current: { permissions: ['keuangan.lihat'], roles: [{ name: 'super_admin' }] } as unknown as {
    permissions: string[];
    roles: { name: string }[];
  } | null },
}));
vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ user: pengguna.current }),
}));

const daftar = vi.fn();
vi.mock('@/api/keuangan', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/keuangan')>();
  return { ...asli, daftarTagihan: (p: unknown) => daftar(p) };
});

/** Satu halaman hasil paginasi seperti balasan API. */
function halaman(data: TagihanRow[], lastPage = 1) {
  return { data, current_page: 1, last_page: lastPage, per_page: 100, total: data.length };
}

/** Semua baris data tabel tagihan. */
function baris(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-part="baris_tagihan"]')) as HTMLElement[];
}

/** Teks satu sel berdasarkan indeks kolomnya. */
function sel(tr: HTMLElement, kolom: number): string {
  return ((tr.children[kolom] as HTMLElement | undefined)?.textContent ?? '').trim();
}

/** Baris data yang kolom jenisnya memuat nama tertentu. */
function barisJenis(nama: string): HTMLElement {
  const ketemu = baris().find((tr) => sel(tr, 0).includes(nama));
  if (!ketemu) throw new Error('baris tidak ditemukan: ' + nama);
  return ketemu;
}

const MENUNGGAK: TagihanRow = {
  id: 1, santri_id: 7, jenjang: 'MTs', tahun_ajaran: '2025/2026', jenis_id: 3,
  periode: '2025-08', nominal: 150000, terbayar: 50000, status: 'sebagian',
  jatuh_tempo: '2000-08-10', jenis: { nama: 'SPP' },
};
const LUNAS: TagihanRow = {
  id: 2, santri_id: 7, jenjang: 'MTs', tahun_ajaran: '2025/2026', jenis_id: 4,
  periode: '2025-07', nominal: 50000, terbayar: 50000, status: 'lunas',
  jatuh_tempo: '2000-07-10', jenis: { nama: 'Syariah' },
};
const BELUM_AKTIF: TagihanRow = {
  id: 3, santri_id: 7, jenjang: 'MTs', tahun_ajaran: '2025/2026', jenis_id: 5,
  periode: '2025-12', nominal: 75000, terbayar: 0, status: 'belum',
  jatuh_tempo: '2999-12-10', jenis: { nama: 'Uang Pangkal' },
};

const SANTRI = { id: 7, nama_lengkap: 'Ahmad Fauzi' };

beforeEach(() => {
  pengguna.current = { permissions: ['keuangan.lihat'], roles: [{ name: 'super_admin' }] };
  daftar.mockReset();
});

describe('TagihanSantriPanel', () => {
  it('tidak dirender dan tidak memanggil API bila tanpa izin keuangan.lihat', () => {
    pengguna.current = { permissions: [], roles: [{ name: 'super_admin' }] };

    const { container } = renderDenganTema(<TagihanSantriPanel santri={SANTRI} />);

    expect(container).toBeEmptyDOMElement();
    expect(daftar).not.toHaveBeenCalled();
  });

  it('memakai satu tabel datar dengan kolom jenis, periode, tagihan, dibayar, sisa, status', async () => {
    daftar.mockResolvedValue(halaman([MENUNGGAK, LUNAS, BELUM_AKTIF]));

    renderDenganTema(<TagihanSantriPanel santri={SANTRI} />);
    await screen.findByText('SPP');

    expect(document.querySelectorAll('table')).toHaveLength(1);

    const kepala = Array.from(document.querySelectorAll('thead th')).map((th) => (th.textContent ?? '').trim());
    expect(kepala).toEqual(['Jenis', 'Periode', 'Tagihan', 'Dibayar', 'Sisa', 'Status']);
    // Tidak ada lagi kolom/informasi jatuh tempo.
    expect(screen.queryByText('Jatuh tempo')).toBeNull();
    expect(screen.queryByText('Terlambat')).toBeNull();
  });

  it('mengisi kolom tagihan, dibayar, dan sisa per baris', async () => {
    daftar.mockResolvedValue(halaman([MENUNGGAK]));

    renderDenganTema(<TagihanSantriPanel santri={SANTRI} />);
    await screen.findByText('SPP');

    const tr = barisJenis('SPP');
    expect(sel(tr, 1)).toBe('2025-08');
    expect(sel(tr, 2)).toBe('150.000');
    expect(sel(tr, 3)).toBe('50.000');
    expect(sel(tr, 4)).toBe('100.000');
    // Tanpa awalan "Rp" di seluruh baris tabel.
    expect(baris().every((b) => !(b.textContent ?? '').includes('Rp'))).toBe(true);
  });

  it('menuliskan status menunggak, lunas, dan belum aktif pada kolom status', async () => {
    daftar.mockResolvedValue(halaman([MENUNGGAK, LUNAS, BELUM_AKTIF]));

    renderDenganTema(<TagihanSantriPanel santri={SANTRI} />);
    await screen.findByText('SPP');

    expect(sel(barisJenis('SPP'), 5)).toBe('Menunggak');
    expect(sel(barisJenis('Syariah'), 5)).toBe('Lunas');
    expect(sel(barisJenis('Uang Pangkal'), 5)).toBe('Belum aktif');
    expect(daftar).toHaveBeenCalledWith({ santri_id: 7, page: '1', per_page: '100' });
  });

  it('mengurutkan baris menunggak, lunas, lalu belum aktif', async () => {
    // Data dari API sengaja terbalik: yang diuji urutan tampilan.
    daftar.mockResolvedValue(halaman([BELUM_AKTIF, LUNAS, MENUNGGAK]));

    renderDenganTema(<TagihanSantriPanel santri={SANTRI} />);
    await screen.findByText('SPP');

    expect(baris().map((tr) => tr.getAttribute('data-kelompok')))
      .toEqual(['menunggak', 'lunas', 'belum_aktif']);
  });

  it('menghitung ringkasan dari seluruh tagihan', async () => {
    daftar.mockResolvedValue(halaman([MENUNGGAK, LUNAS, BELUM_AKTIF]));

    renderDenganTema(<TagihanSantriPanel santri={SANTRI} />);
    await screen.findByText('SPP');

    const ringkas = document.querySelector('[data-part="ringkasan_tagihan"]') as HTMLElement;
    expect(ringkas).toHaveTextContent('Jumlah tagihan');
    expect(ringkas).toHaveTextContent('3');
    expect(ringkas).toHaveTextContent('Rp 275.000');
    expect(ringkas).toHaveTextContent('Rp 100.000');
    expect(ringkas).toHaveTextContent('Rp 175.000');
  });

  it('menghitung tagihan belum lunas tanpa jatuh tempo sebagai menunggak', async () => {
    const tanpaTempo: TagihanRow = {
      ...BELUM_AKTIF, id: 4, jenis: { nama: 'Daftar Ulang' }, jatuh_tempo: null,
    };
    daftar.mockResolvedValue(halaman([tanpaTempo, BELUM_AKTIF]));

    renderDenganTema(<TagihanSantriPanel santri={SANTRI} />);
    await screen.findByText('Daftar Ulang');

    expect(sel(barisJenis('Daftar Ulang'), 5)).toBe('Menunggak');
    expect(sel(barisJenis('Uang Pangkal'), 5)).toBe('Belum aktif');
  });

  it('menggabungkan tagihan dari seluruh halaman paginasi', async () => {
    daftar.mockImplementation(async (p: { page?: string }) =>
      p.page === '1' ? halaman([MENUNGGAK], 2) : halaman([LUNAS], 2));

    renderDenganTema(<TagihanSantriPanel santri={SANTRI} />);
    await screen.findByText('Syariah');

    expect(sel(barisJenis('SPP'), 5)).toBe('Menunggak');
    expect(sel(barisJenis('Syariah'), 5)).toBe('Lunas');
    expect(daftar).toHaveBeenCalledTimes(2);
  });

  it('menampilkan pesan kosong bila santri belum punya tagihan', async () => {
    daftar.mockResolvedValue(halaman([]));

    renderDenganTema(<TagihanSantriPanel santri={SANTRI} />);

    expect(await screen.findByText('Belum ada tagihan untuk santri ini.')).toBeInTheDocument();
    expect(document.querySelector('[data-part="ringkasan_tagihan"]')).toBeNull();
    expect(document.querySelectorAll('table')).toHaveLength(0);
  });

  it('menampilkan pesan gagal dan bisa dimuat ulang', async () => {
    const user = userEvent.setup();
    daftar.mockRejectedValueOnce(new Error('jaringan putus')).mockResolvedValueOnce(halaman([LUNAS]));

    renderDenganTema(<TagihanSantriPanel santri={SANTRI} />);

    expect(await screen.findByText('Gagal memuat tagihan santri ini.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Muat ulang' }));

    expect(await screen.findByText('Syariah')).toBeInTheDocument();
  });
});
