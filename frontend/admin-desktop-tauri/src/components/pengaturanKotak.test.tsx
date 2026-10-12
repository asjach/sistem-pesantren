import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('popover pengaturan komponen — kolom kedua ("Lainnya")', () => {
  /** Baris label+combobox: label lalu pembungkus combobox. */
  const barisDari = (teks: string) => {
    const label = screen.getByText(teks) as HTMLLabelElement;
    return { label, pembungkus: label.nextElementSibling as HTMLElement };
  };
  /** Buka kolom kedua — bawaan TERTUTUP, jadi semua baris di sana baru ada
   *  setelah tombol kepala panel ditekan. */
  const bukaLainnya = () => userEvent.click(screen.getByRole('button', { name: 'Tampilkan pengaturan lainnya' }));
  /** Panel popover pengaturan (ber-portal ke `body`). */
  const panel = () => document.querySelector('[data-slot="popover-content"]') as HTMLElement;

  it('bawaan: kolom kedua tertutup & panel selebar kolom ukuran saja', async () => {
    pengguna.current = sesi(['komponen_custom.ubah']);
    const { container } = renderDenganTema(<LabeledTextInput label="Nama" htmlFor="inp_uji" />);
    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    await screen.findByLabelText('Tinggi kotak input (px)');

    // Ringkas: 200px = border 2×1 + padding 2×12 + kolom ukuran 174px;
    // baris "Lainnya" belum dirender.
    expect(panel().className).toMatch(/w-\[200px\]/);
    expect(document.getElementById('panel_lainnya_kombo_inp_uji')).toBeNull();
    expect(screen.queryByText('Tipe')).toBeNull();
  });

  it('tombol kepala panel membuka kolom kedua (panel melebar) lalu menutupnya lagi', async () => {
    pengguna.current = sesi(['komponen_custom.ubah']);
    const { container } = renderDenganTema(<LabeledTextInput label="Nama" htmlFor="inp_uji" />);
    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    await screen.findByLabelText('Tinggi kotak input (px)');

    await bukaLainnya();

    // 487px = 200 + celah 2×8 + pemisah 1 + kolom "Lainnya" 270px.
    expect(panel().className).toMatch(/w-\[487px\]/);
    const kolomLainnya = document.getElementById('panel_lainnya_kombo_inp_uji') as HTMLElement;
    expect(kolomLainnya.className).toMatch(/w-\[270px\]/);
    expect(screen.getByText('Tipe')).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Sembunyikan pengaturan lainnya' }));

    expect(document.getElementById('panel_lainnya_kombo_inp_uji')).toBeNull();
    expect(panel().className).toMatch(/w-\[200px\]/);
  });

  it('semua baris pilihan berlabel sama lebar (84px) supaya combobox rata kiri', async () => {
    pengguna.current = sesi(['komponen_custom.ubah']);
    const { container } = renderDenganTema(<LabeledTextInput label="Nama" htmlFor="inp_uji" />);
    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    await screen.findByLabelText('Tinggi kotak input (px)');
    await bukaLainnya();

    const { label, pembungkus } = barisDari('Tipe');
    // Berlabel terkunci (bukan selebar teksnya) → satu kolom pengaturan rata kiri.
    expect(label.tagName).toBe('LABEL');
    expect(label.style.width).toBe('84px');
    expect(barisDari('Mengembang').label.style.width).toBe('84px');
    // Pembungkus combobox tetap mengambil seluruh sisa baris.
    expect(pembungkus.className).toMatch(/flex-1/);
    expect(pembungkus.className).toMatch(/min-w-0/);
  });
});
