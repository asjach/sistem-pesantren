import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LabeledTextInput from './LabeledTextInput';
import { resetSetelanKomponen, setelanKomponen } from '@/components/komponenCustom';
import { isiSalinan, kosongkanSalinan } from '@/components/salinSetelan';
import { renderDenganTema } from '@/test/utils';
import type { SetelanKomponen } from '@/api/komponenCustom';

/* Sonner di-mock: pesan toast (termasuk tombol "Batalkan") jadi bisa diperiksa,
   tanpa perlu memasang `<Toaster/>` di pohon tes. */
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/** Sesi tiruan: `null` = belum termuat / tanpa konteks auth. `roles` wajib ada
 *  karena provider lain (mis. `LembagaAktifProvider`) membacanya. */
type PenggunaUji = { permissions: string[]; roles: { name: string }[] };
const { pengguna } = vi.hoisted(() => ({
  pengguna: { current: null as PenggunaUji | null },
}));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ user: pengguna.current }) }));

/** Pengguna uji dengan daftar izin tertentu. */
const sesi = (permissions: string[]): PenggunaUji => ({ permissions, roles: [{ name: 'admin' }] });

/* Setelan "dari server": peta yang dikembalikan pemuatan diisi per tes lewat
   `petaServer.current`, jadi setelan tersimpan tiba dengan jalur yang sama
   seperti aplikasi (bukan ditulis langsung ke cache klien yang bisa tertimpa
   saat pemuatan selesai). */
const { petaServer } = vi.hoisted(() => ({
  petaServer: { current: {} as Record<string, SetelanKomponen> },
}));
vi.mock('@/api/komponenCustom', () => ({
  muatKomponenCustom: vi.fn(async () => ({ pesan: '', data: { peta: petaServer.current } })),
  simpanKomponenCustom: vi.fn(async () => ({ pesan: '', data: {} })),
  hapusKomponenCustom: vi.fn(async () => ({ pesan: '' })),
}));

beforeEach(() => {
  pengguna.current = null;
  petaServer.current = {};
  resetSetelanKomponen();
  kosongkanSalinan();
  vi.mocked(toast.success).mockClear();
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

describe('popover pengaturan komponen — grid ukuran & bagian "Lainnya"', () => {
  /** Baris label+combobox: label lalu pembungkus combobox. */
  const barisDari = (teks: string) => {
    const label = screen.getByText(teks) as HTMLLabelElement;
    return { label, pembungkus: label.nextElementSibling as HTMLElement };
  };
  /** Buka bagian "Lainnya" — bawaan TERTUTUP, jadi semua baris di sana baru
   *  ada setelah tombol kepala panel ditekan. */
  const bukaLainnya = () => userEvent.click(screen.getByRole('button', { name: 'Tampilkan pengaturan lainnya' }));
  /** Panel popover pengaturan (ber-portal ke `body`). */
  const panel = () => document.querySelector('[data-slot="popover-content"]') as HTMLElement;

  it('ukuran tersusun GRID 2 kolom: Tinggi/Total di atas, Label/Kontrol di bawah', async () => {
    pengguna.current = sesi(['komponen_custom.ubah']);
    const { container } = renderDenganTema(<LabeledTextInput label="Nama" htmlFor="inp_uji" />);
    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    await screen.findByLabelText('Tinggi kotak input (px)');

    // Stepper → pembungkus `min-w-0 flex-1` → baris (label + stepper + reset).
    const sel = [...document.querySelectorAll('[data-part="spinbox"]')].map(
      (s) => ((s as HTMLElement).parentElement as HTMLElement).parentElement as HTMLElement,
    );
    const induk = sel[0].parentElement as HTMLElement;
    // `grid-cols-2`: 2 sel per baris, dipisah bukan dengan flex-row.
    expect(induk.className).toMatch(/grid/);
    expect(induk.className).toMatch(/grid-cols-2/);
    expect(sel).toHaveLength(4);
    // Urutan baca kiri→kanan, atas→bawah: Tinggi, Total, Label, Kontrol.
    expect(sel.map((s) => s.querySelector('label')?.textContent)).toEqual(
      ['Tinggi', 'Total', 'Label', 'Kontrol'],
    );
  });

  it('bawaan: bagian "Lainnya" tertutup', async () => {
    pengguna.current = sesi(['komponen_custom.ubah']);
    const { container } = renderDenganTema(<LabeledTextInput label="Nama" htmlFor="inp_uji" />);
    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    await screen.findByLabelText('Tinggi kotak input (px)');

    // Ringkas: 370px = border 2×1 + padding 2×12 + 2 sel grid 168px + celah 8px.
    expect(panel().className).toMatch(/w-\[370px\]/);
    expect(document.getElementById('panel_lainnya_kombo_inp_uji')).toBeNull();
    expect(screen.queryByText('Tipe')).toBeNull();
  });

  it('tombol kepala panel membuka bagian "Lainnya" TANPA melebarkan panel, lalu menutupnya lagi', async () => {
    pengguna.current = sesi(['komponen_custom.ubah']);
    const { container } = renderDenganTema(<LabeledTextInput label="Nama" htmlFor="inp_uji" />);
    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    await screen.findByLabelText('Tinggi kotak input (px)');
    // Lebar panel tak boleh berubah-ubah: patokannya sama sebelum & sesudah.
    expect(panel().className).toMatch(/w-\[370px\]/);

    await bukaLainnya();

    expect(panel().className).toMatch(/w-\[370px\]/);
    const bagianLainnya = document.getElementById('panel_lainnya_kombo_inp_uji') as HTMLElement;
    // Lembar penuh (bukan kolom bermeter) → tak ada lebar terpatok di sini.
    expect(bagianLainnya.className).not.toMatch(/w-\[/);
    expect(screen.getByText('Tipe')).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Sembunyikan pengaturan lainnya' }));

    expect(document.getElementById('panel_lainnya_kombo_inp_uji')).toBeNull();
    expect(panel().className).toMatch(/w-\[370px\]/);
  });

  it('semua baris pilihan berlabel sama lebar (84px) supaya combobox rata kiri', async () => {
    pengguna.current = sesi(['komponen_custom.ubah']);
    const { container } = renderDenganTema(<LabeledTextInput label="Nama" htmlFor="inp_uji" />);
    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    await screen.findByLabelText('Tinggi kotak input (px)');
    await bukaLainnya();

    const { label, pembungkus } = barisDari('Tipe');
    // Berlabel terkunci (bukan selebar teksnya) → baris pengaturan rata kiri.
    expect(label.tagName).toBe('LABEL');
    expect(label.style.width).toBe('84px');
    expect(barisDari('Mengembang').label.style.width).toBe('84px');
    // Pembungkus combobox tetap mengambil seluruh sisa baris.
    expect(pembungkus.className).toMatch(/flex-1/);
    expect(pembungkus.className).toMatch(/min-w-0/);
  });
});

describe('popover pengaturan komponen — salin & tempel setelan', () => {
  /** Panel popover pengaturan (ber-portal ke `body`). */
  const panel = () => document.querySelector('[data-slot="popover-content"]') as HTMLElement;
  /** Klik kanan pada kotak ber-`htmlFor` id — buka popover pengaturannya. */
  const buka = (id: string) => fireEvent.contextMenu(
    document.getElementById(id)?.closest('span')?.parentElement as HTMLElement,
  );
  /** Tutup panel yang sedang terbuka (klik kiri di luar). */
  const tutup = async () => { await userEvent.click(document.body); };
  /** Ikon Salin di kepala panel; nama aksesibelnya sama untuk semua kotak. */
  const tombolSalin = () => screen.getByRole('button', { name: 'Salin setelan kotak ini' });

  it('ikon Salin nonaktif selama kotak belum punya setelan tersimpan', async () => {
    pengguna.current = sesi(['komponen_custom.ubah']);
    renderDenganTema(<LabeledTextInput label="Nama" htmlFor="inp_a" />);

    buka('inp_a');
    await screen.findByLabelText('Tinggi kotak input (px)');

    expect(tombolSalin()).toBeDisabled();
    // Papan salin kosong → ikon Tempel belum dirender sama sekali.
    expect(screen.queryByRole('button', { name: /^Tempel setelan/ })).toBeNull();
  });

  it('salin di kotak A lalu tempel di kotak B: setelan A jadi setelan B', async () => {
    pengguna.current = sesi(['komponen_custom.ubah']);
    // Setelan kotak A sudah tersimpan di server (kunci `tableKey|komponen`).
    petaServer.current = {
      '|inp_a': { tinggi: 40, lebar: 300, lebarLabel: 60, lebarKontrol: 150, labelTransparan: false },
    };
    renderDenganTema(
      <div>
        <LabeledTextInput label="Nama" htmlFor="inp_a" />
        <LabeledTextInput label="Julian" htmlFor="inp_b" />
      </div>,
    );

    buka('inp_a');
    await screen.findByLabelText('Tinggi kotak input (px)');
    await userEvent.click(tombolSalin());

    // Papan salin menyimpan setelan kotak A + nama asalnya (dipakai tooltip).
    expect(isiSalinan()).toEqual({
      setelan: { tinggi: 40, lebar: 300, lebarLabel: 60, lebarKontrol: 150, labelTransparan: false },
      label: 'Nama',
      nama: 'input',
    });
    expect(vi.mocked(toast.success).mock.calls.at(-1)?.[0]).toMatch(/Setelan Nama disalin/);

    await tutup();
    buka('inp_b');
    await screen.findByLabelText('Tinggi kotak input (px)');
    await userEvent.click(screen.getByRole('button', { name: 'Tempel setelan dari Nama' }));

    expect(setelanKomponen('', 'inp_b')).toEqual({
      tinggi: 40, lebar: 300, lebarLabel: 60, lebarKontrol: 150, labelTransparan: false,
    });
    expect(vi.mocked(toast.success).mock.calls.at(-1)?.[0])
      .toMatch(/Setelan dari "Nama" diterapkan ke Julian\./);
    // Salinan TETAP ada: satu kali salin boleh ditempel ke banyak kotak.
    expect(isiSalinan()).not.toBeNull();
  });

  it('tempel melewati kunci yang tak didukung kotak tujuan & bisa dibatalkan', async () => {
    pengguna.current = sesi(['komponen_custom.ubah']);
    petaServer.current = {
      '|inp_src': { tinggi: 44, labelTransparan: false, tipeKontrol: 'tanggal', tipe: { format: 'dd-mm-yyyy' } },
    };
    renderDenganTema(
      <div>
        <LabeledTextInput label="Sumber" htmlFor="inp_src" tipeKontrol="teks" />
        {/* `pilihanTipe={[]}` = kotak tujuan tanpa baris "Tipe" (mis. combobox),
            jadi tipe sumber memang tak bisa diterima di sini. */}
        <LabeledTextInput label="Tujuan" htmlFor="inp_dst" pilihanTipe={[]} />
      </div>,
    );

    buka('inp_src');
    await screen.findByLabelText('Tinggi kotak input (px)');
    await userEvent.click(tombolSalin());
    await tutup();

    buka('inp_dst');
    await screen.findByLabelText('Tinggi kotak input (px)');
    await userEvent.click(screen.getByRole('button', { name: 'Tempel setelan dari Sumber' }));

    // Ukuran & gaya label ikut; tipe + pengaturan tipe dilewati, bukan dipaksa.
    expect(setelanKomponen('', 'inp_dst')).toEqual({ tinggi: 44, labelTransparan: false });
    const [pesan, opsi] = vi.mocked(toast.success).mock.calls.at(-1) as [string, {
      action: { label: string; onClick: () => void };
    }];
    expect(pesan).toMatch(/Dilewati \(tak didukung kotak ini\): tipeKontrol, tipe\./);

    // Tombol "Batalkan" mengembalikan setelan kotak tujuan seperti semula.
    expect(opsi.action.label).toBe('Batalkan');
    opsi.action.onClick();
    expect(setelanKomponen('', 'inp_dst')).toEqual({});
  });
});
