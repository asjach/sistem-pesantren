import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LabeledTextInput from './LabeledTextInput';
import { renderDenganTema } from '@/test/utils';

/** Sesi tiruan: `null` = belum termuat / tanpa konteks auth. `roles` wajib ada
 *  karena provider lain (mis. `LembagaAktifProvider`) membacanya. */
type PenggunaUji = { permissions: string[]; roles: { name: string }[] };
const { pengguna } = vi.hoisted(() => ({
  pengguna: { current: null as PenggunaUji | null },
}));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ user: pengguna.current }) }));

/** Pengguna uji dengan daftar izin tertentu. */
const sesi = (permissions: string[]): PenggunaUji => ({ permissions, roles: [{ name: 'admin' }] });

vi.mock('@/api/komponenCustom', () => ({
  muatKomponenCustom: vi.fn(async () => ({ pesan: '', data: { peta: {} } })),
  simpanKomponenCustom: vi.fn(async () => ({ pesan: '', data: {} })),
  hapusKomponenCustom: vi.fn(async () => ({ pesan: '' })),
}));

beforeEach(() => {
  pengguna.current = null;
});

/** Klik kanan kotak (id kontrol `inp_uji`) — pemicu popover pengaturan. */
const klikKanan = () => fireEvent.contextMenu(
  document.querySelector('#inp_uji')?.closest('span')?.parentElement as HTMLElement,
);

describe('popover pengaturan komponen — gerbang izin', () => {
  it('user tanpa izin tulis: popover TIDAK dibuka (bukan error 403)', () => {
    pengguna.current = sesi(['santri.lihat', 'santri.ubah']);
    renderDenganTema(<LabeledTextInput label="Nama" htmlFor="inp_uji" />);

    klikKanan();

    expect(screen.queryByLabelText('Tinggi kotak input (px)')).toBeNull();
  });

  it('user dengan komponen_custom.ubah: popover terbuka', async () => {
    pengguna.current = sesi(['komponen_custom.ubah']);
    renderDenganTema(<LabeledTextInput label="Nama" htmlFor="inp_uji" />);

    klikKanan();

    expect(await screen.findByLabelText('Tinggi kotak input (px)')).not.toBeNull();
  });

  it('user dengan komponen_custom.tambah saja: popover tetap terbuka', async () => {
    pengguna.current = sesi(['komponen_custom.tambah']);
    renderDenganTema(<LabeledTextInput label="Nama" htmlFor="inp_uji" />);

    klikKanan();

    expect(await screen.findByLabelText('Tinggi kotak input (px)')).not.toBeNull();
  });

  it('sesi belum termuat (user null): tidak diblokir', async () => {
    pengguna.current = null;
    renderDenganTema(<LabeledTextInput label="Nama" htmlFor="inp_uji" />);

    klikKanan();

    expect(await screen.findByLabelText('Tinggi kotak input (px)')).not.toBeNull();
  });

  it('tanpa htmlFor: popover tetap tak dibuka (kotak tanpa identitas)', () => {
    pengguna.current = sesi(['komponen_custom.ubah']);
    const { container } = renderDenganTema(<LabeledTextInput label="Nama" />);

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);

    expect(screen.queryByLabelText('Tinggi kotak input (px)')).toBeNull();
  });
});
