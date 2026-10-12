import { useState } from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LabeledTextInput from './LabeledTextInput';
import { PRESET_NOMINAL } from './tipeInput';
import { renderDenganTema } from '@/test/utils';
import { resetSetelanKomponen } from '@/components/komponenCustom';

/* Setelan komponen custom disimpan di server; API-nya dimock agar tes bisa
   menyemai setelan lewat store klien tanpa jaringan. */
vi.mock('@/api/komponenCustom', () => ({
  muatKomponenCustom: vi.fn(async () => ({ pesan: '', data: { peta: {} } })),
  simpanKomponenCustom: vi.fn(async () => ({ pesan: '', data: {} })),
  hapusKomponenCustom: vi.fn(async () => ({ pesan: '' })),
}));

beforeEach(() => {
  resetSetelanKomponen();
});

/** Harness terkontrol: meniru pemakaian nyata (`value` + `onChange`).
 *
 *  Nominal bukan komponen tersendiri lagi: cukup `LabeledTextInput` dengan
 *  `tipeKontrol="nominal"` (registry `tipeInput.tsx`). */
function Contoh({ awal = '' }: { awal?: string }) {
  const [nilai, setNilai] = useState(awal);
  return (
    <LabeledTextInput
      nama="nominal" tipeKontrol="nominal"
      label="Nominal" htmlFor="inp_nom"
      value={nilai} onChange={(e) => setNilai(e.target.value)}
    />
  );
}

const nilaiInput = () => (document.getElementById('inp_nom') as HTMLInputElement).value;
const bukaPopover = () => userEvent.click(screen.getByRole('button', { name: 'Pilih nominal cepat' }));
/** Klik tombol di popover (nama aksesibel persis, mis. "1.000" atau "000"). */
const klik = async (nama: string) => userEvent.click(await screen.findByRole('button', { name: nama }));
/** Panel terpisah (portal ke body) — ditandai `data-panel` oleh komponen. */
const panel = (nama: string) => document.querySelector(`[data-panel="${nama}"]`) as HTMLElement | null;

describe('LabeledTextInput tipe nominal', () => {
  it('memaksa tipe number & menyediakan tombol popover', () => {
    renderDenganTema(<Contoh />);
    const input = document.getElementById('inp_nom') as HTMLInputElement;
    expect(input.type).toBe('number');
    expect(input.className).toMatch(/pr-7/);
    expect(document.getElementById('btn_preset_inp_nom')).not.toBeNull();
  });

  it('dua panel terbuka bersamaan: nominal di atas input, angka di bawahnya', async () => {
    renderDenganTema(<Contoh />);
    await bukaPopover();
    await waitFor(() => expect(panel('nominal')).not.toBeNull());
    expect(panel('angka')).not.toBeNull();
    // Sisi masing-masing panel dijaga tetap oleh `avoidCollisions={false}`.
    expect(panel('nominal')?.getAttribute('data-side')).toBe('top');
    expect(panel('angka')?.getAttribute('data-side')).toBe('bottom');
    for (const nama of ['nominal', 'angka']) {
      const p = panel(nama);
      expect(p?.className).toMatch(/pop-nominal/);
      expect(p?.className).toMatch(/w-60/);
      expect(p?.className).toMatch(/border-foreground\/30/);
    }
    expect(screen.getByRole('group', { name: 'Nominal cepat' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset ke 0' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Tombol angka' })).toBeTruthy();
    // Rapat: tak ada jarak antar tombol (grid tanpa kelas `gap-*`).
    expect(screen.getByRole('group', { name: 'Nominal cepat' }).className).not.toMatch(/\bgap-/);
    expect(screen.getByRole('group', { name: 'Tombol angka' }).className).not.toMatch(/\bgap-/);
  });

  it('menekan tombol di panel angka tidak menutup panel nominal', async () => {
    renderDenganTema(<Contoh awal="50" />);
    await bukaPopover();
    await klik('0');
    await waitFor(() => expect(nilaiInput()).toBe('500'));
    expect(panel('nominal')).not.toBeNull();
    expect(panel('angka')).not.toBeNull();
  });

  it('menekan nominal di panel atas tidak menutup panel angka', async () => {
    renderDenganTema(<Contoh awal="50" />);
    await bukaPopover();
    await klik('1.000');
    await waitFor(() => expect(nilaiInput()).toBe('1050'));
    expect(panel('angka')).not.toBeNull();
  });

  it('tombol reset berada di panel nominal (atas)', async () => {
    renderDenganTema(<Contoh />);
    await bukaPopover();
    await waitFor(() => expect(panel('nominal')).not.toBeNull());
    expect(panel('nominal')?.contains(screen.getByRole('button', { name: 'Reset ke 0' }))).toBe(true);
  });

  it('tombol reset menampilkan ikon + teks "Reset" selebar baris', async () => {
    renderDenganTema(<Contoh />);
    await bukaPopover();
    const reset = screen.getByRole('button', { name: 'Reset ke 0' });
    // Lebar dari `self-stretch`, bukan `w-full`: pada elemen berlebar eksplisit
    // margin kiri negatif cuma menggeser kotak, jadi tepi kanannya kurang 1px.
    expect(reset.className).toMatch(/self-stretch/);
    expect(reset.className).not.toMatch(/(^|\s)w-(full|\[)/);
    expect(reset.className).toMatch(/border-foreground\/30/);
    expect(reset.textContent?.trim()).toBe('Reset');
    expect(reset.querySelector('svg')).not.toBeNull();
  });

  it('nominal 25.000 & 250.000 tersedia', async () => {
    renderDenganTema(<Contoh />);
    await bukaPopover();
    expect(await screen.findByRole('button', { name: '25.000' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '250.000' })).toBeTruthy();
  });

  it('nominal selalu ditambahkan ke nilai yang ada', async () => {
    renderDenganTema(<Contoh awal="50000" />);
    await bukaPopover();
    await klik('1.000');
    await waitFor(() => expect(nilaiInput()).toBe('51000'));
    await klik('250.000');
    await waitFor(() => expect(nilaiInput()).toBe('301000'));
  });

  it('nominal ditambahkan di atas nilai kosong (= nominal itu sendiri)', async () => {
    renderDenganTema(<Contoh />);
    await bukaPopover();
    await klik('5.000');
    await waitFor(() => expect(nilaiInput()).toBe('5000'));
  });

  it('tombol reset mengembalikan nilai ke 0', async () => {
    renderDenganTema(<Contoh awal="50000" />);
    await bukaPopover();
    await klik('Reset ke 0');
    await waitFor(() => expect(nilaiInput()).toBe('0'));
  });

  it('tombol angka menempel seperti mengetik: 1,0,0,0 → 1000', async () => {
    renderDenganTema(<Contoh />);
    await bukaPopover();
    await klik('1');
    await klik('0');
    await klik('0');
    await klik('0');
    await waitFor(() => expect(nilaiInput()).toBe('1000'));
  });

  it('tombol 000 menempel tiga nol di belakang nilai', async () => {
    renderDenganTema(<Contoh awal="50" />);
    await bukaPopover();
    await klik('000');
    await waitFor(() => expect(nilaiInput()).toBe('50000'));
  });

  it('nol di depan dibuang saat menempel angka', async () => {
    renderDenganTema(<Contoh />);
    await bukaPopover();
    await klik('00');
    await waitFor(() => expect(nilaiInput()).toBe('0'));
    await klik('5');
    await waitFor(() => expect(nilaiInput()).toBe('5'));
  });

  it('mengetik manual juga lewat onChange (satu jalur nilai)', async () => {
    renderDenganTema(<Contoh />);
    await userEvent.type(document.getElementById('inp_nom') as HTMLInputElement, '75000');
    expect(nilaiInput()).toBe('75000');
  });

  it('klik tombol memanggil onChange & popover tetap terbuka', async () => {
    const onChange = vi.fn();
    renderDenganTema(<LabeledTextInput nama="nominal" tipeKontrol="nominal" label="Nominal" htmlFor="inp_nom" value="" onChange={onChange} />);
    await bukaPopover();
    await klik('100.000');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ target: expect.objectContaining({ value: '100000' }) }));
    expect(screen.getByRole('group', { name: 'Nominal cepat' })).not.toBeNull();
  });

  it('border popover sama dengan kotak pembungkus (foreground/30)', async () => {
    renderDenganTema(<Contoh />);
    await bukaPopover();
    await waitFor(() => expect(panel('nominal')).not.toBeNull());
    expect(panel('nominal')?.className).toMatch(/border-foreground\/30/);
    expect(panel('angka')?.className).toMatch(/border-foreground\/30/);
  });

  it('tiap tombol popover punya border 1px berwarna sama', async () => {
    renderDenganTema(<Contoh />);
    await bukaPopover();
    await screen.findByRole('group', { name: 'Nominal cepat' });
    // Kedua panel jadi jangkar override `--input` di index.css — supaya border
    // tombol ikut foreground/30 di mode gelap (varian outline menang di urutan sumber).
    expect(panel('nominal')?.className).toMatch(/pop-nominal/);
    expect(panel('angka')?.className).toMatch(/pop-nominal/);
    const tombol = [
      ...within(screen.getByRole('group', { name: 'Nominal cepat' })).getAllByRole('button'),
      screen.getByRole('button', { name: 'Reset ke 0' }),
      ...within(screen.getByRole('group', { name: 'Tombol angka' })).getAllByRole('button'),
    ];
    expect(tombol).toHaveLength(9 + 1 + 12);
    for (const t of tombol) {
      expect(t.className).toMatch(/border-foreground\/30/);
      expect(t.className).toMatch(/(^|\s)border(\s|$)/);
      // Rapat → border berdempetan digeser 1px agar bertindihan (tetap 1px,
      // bukan menebal jadi 2px).
      expect(t.className).toMatch(/-ml-px/);
      expect(t.className).toMatch(/-mt-px/);
    }
  });

  it('preset bawaan berisi nominal rupiah umum', () => {
    expect(PRESET_NOMINAL).toEqual([1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000]);
  });

  it('tanpa value/onChange: nilai dikelola internal & isinya tetap bisa diketik', async () => {
    renderDenganTema(
      <LabeledTextInput nama="nominal" tipeKontrol="nominal" label="Nominal" htmlFor="inp_lepas" defaultValue="50000" />,
    );
    const input = document.getElementById('inp_lepas') as HTMLInputElement;
    expect(input.value).toBe('50000');
    // Kotak terkendali state internal — BUKAN read-only.
    expect(input.readOnly).toBe(false);

    await userEvent.clear(input);
    await userEvent.type(input, '75000');
    expect(input.value).toBe('75000');

    // Tombol nominal cepat menulis ke nilai yang sama (satu jalur nilai).
    await bukaPopover();
    await klik('5.000');
    await waitFor(() => expect(input.value).toBe('80000'));
  });

  it('klik kanan membuka popover ukuran (judul nominal) di samping panel kalkulator', async () => {
    const { container } = renderDenganTema(<Contoh />);

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    expect(await screen.findByLabelText('Tinggi kotak nominal (px)')).not.toBeNull();
    // Panel kalkulator tetap bisa dibuka (popover independen).
    await bukaPopover();
    await waitFor(() => expect(panel('nominal')).not.toBeNull());
    expect(panel('angka')).not.toBeNull();
  });
});

describe('LabeledTextInput tipe nominal — pengaturan tipe', () => {
  /** Isi baris "Preset cepat" di popover pengaturan lalu commit (blur). */
  const isiPreset = async (teks: string) => {
    const isian = document.getElementById('inp_nom_tipe_preset') as HTMLInputElement;
    expect(isian).not.toBeNull();
    fireEvent.change(isian, { target: { value: teks } });
    fireEvent.blur(isian);
  };

  it('baris "Preset cepat" muncul di popover pengaturan tipe nominal', async () => {
    const { container } = renderDenganTema(<Contoh />);
    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    expect(await screen.findByText('Preset cepat')).not.toBeNull();
    expect(document.getElementById('inp_nom_tipe_preset')).not.toBeNull();
  });

  it('preset yang disetel pengguna mengubah tombol nominal cepat', async () => {
    const { container } = renderDenganTema(<Contoh />);
    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    await screen.findByText('Preset cepat');
    await isiPreset('1500, 2500');

    await bukaPopover();
    expect(await screen.findByRole('button', { name: '1.500' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '2.500' })).toBeTruthy();
    // Preset bawaan sudah tidak dipakai.
    expect(screen.queryByRole('button', { name: '5.000' })).toBeNull();
  });

  it('preset dikosongkan → kembali ke preset bawaan', async () => {
    const { container } = renderDenganTema(<Contoh />);
    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    await screen.findByText('Preset cepat');
    await isiPreset('1500');
    await isiPreset('');

    await bukaPopover();
    expect(await screen.findByRole('button', { name: '5.000' })).toBeTruthy();
  });

  it('tipeTerkunci: baris "Tipe input:" disembunyikan, baris preset tetap ada', async () => {
    const { container } = renderDenganTema(
      <LabeledTextInput nama="nominal" tipeKontrol="nominal" tipeTerkunci label="Bayar" htmlFor="inp_bayar" value="" onChange={() => {}} />,
    );
    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    await screen.findByText('Preset cepat');
    expect(screen.queryByText('Tipe input:')).toBeNull();
  });
});
