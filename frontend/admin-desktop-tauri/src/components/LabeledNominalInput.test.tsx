import { useState } from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LabeledNominalInput, { PRESET_NOMINAL } from './LabeledNominalInput';
import { renderDenganTema } from '@/test/utils';
import { resetSetelanKomponen, setelanKomponen, simpanSetelanKomponen } from '@/components/komponenCustom';

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

/** Harness terkontrol: meniru pemakaian nyata (`value` + `onValueChange`). */
function Contoh({ preset, awal = '' }: { preset?: number[]; awal?: string }) {
  const [nilai, setNilai] = useState(awal);
  return (
    <LabeledNominalInput
      label="Nominal" htmlFor="inp_nom" preset={preset}
      value={nilai} onValueChange={setNilai}
    />
  );
}

const nilaiInput = () => (document.getElementById('inp_nom') as HTMLInputElement).value;
const bukaPopover = () => userEvent.click(screen.getByRole('button', { name: 'Pilih nominal cepat' }));
/** Klik tombol di popover (nama aksesibel persis, mis. "1.000" atau "000"). */
const klik = async (nama: string) => userEvent.click(await screen.findByRole('button', { name: nama }));
/** Panel terpisah (portal ke body) — ditandai `data-panel` oleh komponen. */
const panel = (nama: string) => document.querySelector(`[data-panel="${nama}"]`) as HTMLElement | null;

describe('LabeledNominalInput', () => {
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

  it('mengetik manual juga lewat onValueChange (satu jalur nilai)', async () => {
    renderDenganTema(<Contoh />);
    await userEvent.type(document.getElementById('inp_nom') as HTMLInputElement, '75000');
    expect(nilaiInput()).toBe('75000');
  });

  it('klik tombol memanggil onValueChange & popover tetap terbuka', async () => {
    const onValueChange = vi.fn();
    renderDenganTema(<LabeledNominalInput label="Nominal" htmlFor="inp_nom" value="" onValueChange={onValueChange} />);
    await bukaPopover();
    await klik('100.000');
    expect(onValueChange).toHaveBeenCalledWith('100000');
    expect(screen.getByRole('group', { name: 'Nominal cepat' })).not.toBeNull();
  });

  it('preset bagian pertama bisa diganti pemanggil', async () => {
    renderDenganTema(<Contoh preset={[1_500]} />);
    await bukaPopover();
    expect(await screen.findByRole('button', { name: '1.500' })).toBeTruthy();
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
