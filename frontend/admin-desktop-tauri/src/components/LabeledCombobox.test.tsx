import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import LabeledCombobox, { hitungLebarKombo } from './LabeledCombobox';
import { KonteksLebarFilter } from '@/components/excel/lebarFilter';
import { jepitLebar, normalkanUkuran } from '@/components/ukuranKombo';

vi.mock('@/api/komponenCustom', () => ({
  muatKomponenCustom: vi.fn(async () => ({ pesan: '', data: { peta: {} } })),
  simpanKomponenCustom: vi.fn(async () => ({ pesan: '', data: {} })),
  hapusKomponenCustom: vi.fn(async () => ({ pesan: '' })),
}));

/** Setelan komponen di luar tabel (tableKey kosong), Persis seperti komponen
 *  form/dialog. */
const simpan = (kunci: string, setelan: Parameters<typeof simpanSetelanKomponen>[2]) =>
  simpanSetelanKomponen('', kunci, setelan);
/** Setelan komponen di dalam toolbar tabel (tableKey = tabel uji). */
const setelan = (kunci: string, tableKey = '') => setelanKomponen(tableKey, kunci);
import {
  setelanKomponen,
  simpanSetelanKomponen,
} from '@/components/komponenCustom';
import {
  ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList, ComboboxRoot, ComboboxTrigger,
} from '@/components/ui/combobox';
import { renderDenganTema } from '@/test/utils';

const OPSI = ['Opsi A', 'Opsi B'];

const DALAM_PANEL = { hidden: true } as const;

function kombo(id: string) {
  return (
    <ComboboxRoot items={OPSI}>
      <ComboboxInput id={id} aria-label="Demo" placeholder="Cari…" />
      <ComboboxTrigger aria-label="Buka daftar" />
      <ComboboxContent>
        <ComboboxList>
          {(o) => <ComboboxItem key={o} value={o}>{o}</ComboboxItem>}
        </ComboboxList>
      </ComboboxContent>
    </ComboboxRoot>
  );
}

describe('LabeledCombobox', () => {
  it('label terhubung ke input via for ↔ id', () => {
    renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor="kombo_uji">
        {kombo('kombo_uji')}
      </LabeledCombobox>,
    );
    expect(screen.getByText('Kelompok:').getAttribute('for')).toBe('kombo_uji');
    expect(document.getElementById('kombo_uji')).not.toBeNull();
  });

  it('lebar dikunci: label & kombo sesuai ukuran, kotak rangkul isi', () => {
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor="kombo_uji" lebarLabel={80} lebarKombo={180} tinggi={34}>
        {kombo('kombo_uji')}
      </LabeledCombobox>,
    );
    const kotak = container.firstElementChild as HTMLElement;
    expect(kotak.style.height).toBe('34px');
    expect(kotak.className).toMatch(/border-foreground\/30/);
    expect(kotak.className).toMatch(/inline-flex/);
    expect(kotak.className).toMatch(/w-max/);
    expect(screen.getByText('Kelompok:').getAttribute('style')).toContain('width: 80px');
    const zona = document.getElementById('kombo_uji')?.closest('span') as HTMLElement;
    expect(zona.style.width).toBe('180px');
    expect(zona.style.flex).toBe('0 0 auto');
  });

  it('bawaan: kotak selebar induk, zona kombo mengisi sisa', () => {
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor="kombo_uji">
        {kombo('kombo_uji')}
      </LabeledCombobox>,
    );
    const kotak = container.firstElementChild as HTMLElement;
    expect(kotak.className).toMatch(/w-full/);
    expect(kotak.className).toMatch(/focus-within:border-ring/);
    expect(screen.getByText('Kelompok:').className).toMatch(/w-max/);
  });

  it('input melebar penuh, tanpa border sendiri & tanpa cincin fokus', () => {
    renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor="kombo_uji">
        {kombo('kombo_uji')}
      </LabeledCombobox>,
    );
    const input = document.getElementById('kombo_uji') as HTMLInputElement;
    expect(input.tagName).toBe('INPUT');
    const kelas = input.className;
    expect(kelas).toMatch(/h-full/);
    expect(kelas).toMatch(/w-full/);
    expect(kelas).toMatch(/min-w-0/);
    expect(kelas).toMatch(/border-0/);
    expect(kelas).toMatch(/focus-visible:ring-0/);
    expect(kelas).toMatch(/rounded-none/);
  });

  it('popup memakai border yang sama dengan kotak pembungkus', async () => {
    renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor="kombo_uji">
        {kombo('kombo_uji')}
      </LabeledCombobox>,
    );
    await userEvent.click(document.getElementById('kombo_uji') as HTMLInputElement);
    const popup = await waitFor(() => {
      const el = document.querySelector('[data-slot="combobox-content"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(popup.className).toMatch(/border-foreground\/30/);
  });

  it('ruang induk tak cukup: kombo menyusut (200 − 10 − 10 − 80 = 100)', () => {

    expect(hitungLebarKombo(180, 80, 180)).toBe(100);

    expect(hitungLebarKombo(1000, 80, 180)).toBe(180);

    expect(hitungLebarKombo(60, 80, 180)).toBe(40);
  });

  it('di dalam toolbar: kotak memakai lebar bawaan (160px)', () => {
    const tableKey = `uji_lc_${Date.now()}`;
    renderDenganTema(
      <KonteksLebarFilter.Provider value={{ tableKey }}>
        <LabeledCombobox label="Kelompok" htmlFor="kombo_uji">
          {kombo('kombo_uji')}
        </LabeledCombobox>
      </KonteksLebarFilter.Provider>,
    );

    const kotak = document.getElementById('kombo_uji')?.closest('span')?.parentElement as HTMLElement;
    expect(kotak.style.width).toBe('160px');
  });

  it('lebar tersimpan pada setelan komponen dipakai pada kotak', () => {
    const tableKey = `uji_lc_ovr_${Date.now()}`;

    simpanSetelanKomponen(tableKey, 'kombo_uji', { lebar: 240 });
    renderDenganTema(
      <KonteksLebarFilter.Provider value={{ tableKey }}>
        <LabeledCombobox label="Kelompok" htmlFor="kombo_uji">
          {kombo('kombo_uji')}
        </LabeledCombobox>
      </KonteksLebarFilter.Provider>,
    );
    const kotak = document.getElementById('kombo_uji')?.closest('span')?.parentElement as HTMLElement;
    expect(kotak.style.width).toBe('240px');
  });

  it('kelolaLebar={false}: lebar bebas (tanpa bawaan filter)', () => {
    const tableKey = `uji_lc_off_${Date.now()}`;
    renderDenganTema(
      <KonteksLebarFilter.Provider value={{ tableKey }}>
        <LabeledCombobox label="Kelompok" htmlFor="kombo_uji" kelolaLebar={false}>
          {kombo('kombo_uji')}
        </LabeledCombobox>
      </KonteksLebarFilter.Provider>,
    );
    const kotak = document.getElementById('kombo_uji')?.closest('span')?.parentElement as HTMLElement;
    expect(kotak.style.width).toBe('');
  });

  it('bisaCari: input read-only (bawaan) & bisa diketik bila diaktifkan', () => {
    const { unmount } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor="kombo_uji">
        {kombo('kombo_uji')}
      </LabeledCombobox>,
    );
    const input = document.getElementById('kombo_uji') as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    unmount();

    renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor="kombo_uji" bisaCari>
        {kombo('kombo_uji')}
      </LabeledCombobox>,
    );
    expect((document.getElementById('kombo_uji') as HTMLInputElement).readOnly).toBe(false);
  });

  it('klik kanan pada kotak membuka popover ukuran KOTAK combobox', async () => {
    const kunci = `uji_ukuran_buka_${Date.now()}`;
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);

    expect(await screen.findByLabelText('Tinggi kotak combobox (px)')).not.toBeNull();
    expect(screen.getByLabelText('Lebar kotak combobox (px)')).not.toBeNull();
  });

  it('popover ukuran: lebar dipatok (tak ikut combobox) & punya border jelas', async () => {
    const kunci = `uji_ukuran_pop_${Date.now()}`;
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci} lebarKotak={700}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    await screen.findByLabelText('Tinggi kotak combobox (px)');
    const pop = document.querySelector('[data-slot="popover-content"]') as HTMLElement;

    expect(pop.className).toMatch(/w-\[370px\]/);
    expect(pop.className).toMatch(/min-w-\[370px\]/);
    expect(pop.className).toMatch(/max-w-\[370px\]/);

    expect(pop.className).toMatch(/border-foreground\/30/);
  });

  it('popover ukuran: 4 baris stepper & label sama lebar', async () => {
    const kunci = `uji_ukuran_seragam_${Date.now()}`;
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    const inpTinggi = await screen.findByLabelText('Tinggi kotak combobox (px)');
    const inpLebar = screen.getByLabelText('Lebar kotak combobox (px)');
    const inpLabel = screen.getByLabelText('Lebar label combobox (px)');
    const inpKontrol = screen.getByLabelText('Lebar kontrol combobox (px)');

    const baris = [`set_tinggi_kombo_${kunci}`, `set_lebar_kombo_${kunci}`, `set_lebar_label_kombo_${kunci}`, `set_lebar_kontrol_kombo_${kunci}`];
    const inputs = [inpTinggi, inpLebar, inpLabel, inpKontrol];
    baris.forEach((id, i) => {
      const lab = document.querySelector(`label[for="${id}"]`) as HTMLElement;
      expect(lab.style.width).toBe('48px');
      expect(lab.parentElement?.contains(inputs[i])).toBe(true);
      expect((document.getElementById(id)?.parentElement as HTMLElement).style.width).toBe('84px');
    });
  });

  it('klik kanan membuka daftar opsi, jadi perubahan panel langsung terlihat', async () => {
    const kunci = `uji_ukuran_daftar_${Date.now()}`;
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    await screen.findByLabelText('Tinggi kotak combobox (px)');

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Opsi A' })).toBeTruthy();
    });
    expect(document.querySelector('[data-slot="popover-content"]')).not.toBeNull();
  });

  it('klik kanan di LABEL: daftar tetap terbuka & panel tak ikut hilang', async () => {
    const kunci = `uji_ukuran_label_${Date.now()}`;
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );
    const kotak = container.firstElementChild as HTMLElement;
    const labelEl = kotak.firstElementChild as HTMLElement;

    fireEvent.contextMenu(labelEl);
    await screen.findByLabelText('Tinggi kotak combobox (px)');
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Opsi A' })).toBeTruthy();
    });
    expect(document.querySelector('[data-slot="popover-content"]')).not.toBeNull();
  });

  it('popover tanpa tombol tutup; klik kiri di luar menutup, klik daftar opsi tidak', async () => {
    const kunci = `uji_ukuran_tutup_${Date.now()}`;
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );
    const kotak = container.firstElementChild as HTMLElement;

    fireEvent.contextMenu(kotak);
    await screen.findByLabelText('Tinggi kotak combobox (px)');

    expect(screen.queryByLabelText('Tutup pengaturan ukuran')).toBeNull();

    const sisi = screen.getByRole('combobox', { ...DALAM_PANEL, name: 'Mengembang' });
    await userEvent.click(sisi);
    const opsi = await screen.findByRole('option', { name: 'Label' });
    await userEvent.click(opsi);
    expect(setelan(kunci).expandLabel).toBe(true);
    expect(document.querySelector('[data-slot="popover-content"]')).not.toBeNull();

    await userEvent.click(document.body);
    await waitFor(() => {
      expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
    });
  });

  it('popover ditambatkan ke jangkar BEKU (position: fixed), bukan ke kotaknya', async () => {
    const kunci = `uji_ukuran_beku_${Date.now()}`;
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    await screen.findByLabelText('Tinggi kotak combobox (px)');

    const jangkar = container.querySelector('span[aria-hidden="true"][style*="fixed"]') as HTMLElement;
    expect(jangkar).not.toBeNull();
    expect(jangkar.style.position).toBe('fixed');
    expect(jangkar.style.visibility).toBe('hidden');

    expect(container.firstElementChild?.tagName).toBe('SPAN');
    expect(container.firstElementChild).not.toBe(jangkar);
  });

  it('stepper menyimpan ukuran kotak PER KOMPONEN (kunci = htmlFor)', async () => {
    const kunci = `uji_ukuran_stepper_${Date.now()}`;
    const kunciLain = `${kunci}_lain`;
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);

    await userEvent.click(await screen.findByLabelText('Tinggi kotak combobox (px) tambah'));

    expect(setelan(kunci).tinggi).toBe(28);

    expect(setelan(kunciLain)).toEqual({});
  });

  it('ukuran tersimpan dipakai kotak combobox (menang atas prop)', async () => {
    const kunci = `uji_ukuran_pakai_${Date.now()}`;
    simpan(kunci, { tinggi: 34, lebar: 320 });
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );

    const kotak = container.firstElementChild as HTMLElement;
    expect(kotak.style.height).toBe('34px');
    expect(kotak.style.width).toBe('320px');
  });

  it('tanpa ukuran tersimpan, kotak tetap memakai prop pemanggil', () => {
    const kunci = `uji_ukuran_prop_${Date.now()}`;
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci} tinggi={34} lebarKotak={260}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );

    const kotak = container.firstElementChild as HTMLElement;
    expect(kotak.style.height).toBe('34px');
    expect(kotak.style.width).toBe('260px');
  });

  it('tombol "Kembalikan ke bawaan" menghapus ukuran tersimpan', async () => {
    const kunci = `uji_ukuran_reset_${Date.now()}`;
    simpan(kunci, { tinggi: 40, lebar: 300, lebarLabel: 60, lebarKontrol: 150, expandLabel: true, labelTransparan: true });
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    await userEvent.click(await screen.findByRole('button', { ...DALAM_PANEL, name: /kembalikan ke bawaan/i }));

    expect(setelan(kunci)).toEqual({});
  });

  it('reset per-baris hanya menghapus kunci baris itu', async () => {
    const kunci = `uji_ukuran_reset_baris_${Date.now()}`;
    simpan(kunci, { tinggi: 40, lebar: 300, lebarLabel: 60, lebarKontrol: 150 });
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    await userEvent.click(await screen.findByLabelText('Kembalikan lebar label ke bawaan'));

    expect(setelan(kunci)).toEqual({ tinggi: 40, lebar: 300, lebarKontrol: 150 });
  });

  it('stepper label/kontrol saling menyesuaikan (total tetap)', async () => {
    const kunci = `uji_ukuran_label_kontrol_${Date.now()}`;
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);

    await userEvent.click(await screen.findByLabelText('Lebar label combobox (px) tambah'));
    expect(setelan(kunci)).toEqual({ lebarLabel: 84, lebarKontrol: 76 });

    await userEvent.click(await screen.findByLabelText('Lebar kontrol combobox (px) kurang'));
    expect(setelan(kunci)).toEqual({ lebarLabel: 94, lebarKontrol: 66 });

    const kotak = container.firstElementChild as HTMLElement;
    expect(kotak.style.width).toBe('');
    expect((kotak.firstElementChild as HTMLElement).style.width).toBe('94px');
    expect((kotak.children[1] as HTMLElement).style.width).toBe('66px');
  });

  it('ubah total menggeser sisi yang mengembang (bawaan: kontrol)', async () => {
    const kunci = `uji_ukuran_total_${Date.now()}`;
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);

    expect(screen.getByRole('combobox', { ...DALAM_PANEL, name: 'Mengembang' })).toHaveValue('Kontrol');

    await userEvent.click(await screen.findByLabelText('Lebar kotak combobox (px) tambah'));
    expect(setelan(kunci)).toEqual({ lebar: 170, lebarKontrol: 90 });
  });

  it('stepper Total memakai lebar kotak (bukan jumlah label+kontrol)', async () => {
    const kunci = `uji_total_terukur_${Date.now()}`;
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );

    const kotak = container.firstElementChild as HTMLElement;
    const labelEl = kotak.children[0] as HTMLElement;
    const kontrolEl = kotak.children[1] as HTMLElement;
    const rect = (width: number) => ({
      width, height: 26, left: 0, top: 0, right: width, bottom: 26, x: 0, y: 0, toJSON: () => ({}),
    }) as DOMRect;
    const asli = Element.prototype.getBoundingClientRect;
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this === kotak) return rect(160);
      if (this === labelEl) return rect(90);
      if (this === kontrolEl) return rect(58);
      return asli.call(this);
    });

    fireEvent.contextMenu(kotak);
    await userEvent.click(await screen.findByLabelText('Lebar kotak combobox (px) tambah'));
    spy.mockRestore();
    expect(setelan(kunci)).toEqual({ lebar: 170, lebarKontrol: 68 });

    await userEvent.click(screen.getByLabelText('Lebar kotak combobox (px) kurang'));
    expect(setelan(kunci)).toEqual({ lebar: 160, lebarKontrol: 58 });
  });

  it('flag expanding: pilihan sisi menentukan sisi yang mengembang', async () => {
    const kunci = `uji_ukuran_expand_${Date.now()}`;
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    const cb = screen.getByRole('combobox', { ...DALAM_PANEL, name: 'Mengembang' });

    await userEvent.click(cb);
    await userEvent.click(await screen.findByRole('option', { name: 'Label' }));
    expect(cb).toHaveValue('Label');
    expect(setelan(kunci).expandLabel).toBe(true);
    await userEvent.click(await screen.findByLabelText('Lebar kotak combobox (px) tambah'));
    expect(setelan(kunci)).toMatchObject({ lebar: 170, lebarLabel: 90 });

    await userEvent.click(cb);
    await userEvent.click(await screen.findByRole('option', { name: 'Kontrol' }));
    expect(cb).toHaveValue('Kontrol');
    expect(setelan(kunci).expandLabel).toBeUndefined();
  });

  it('tautan dijepit: sisi lawan mentok → sisi yang diubah tertahan', async () => {
    const kunci = `uji_ukuran_jepit_${Date.now()}`;
    simpan(kunci, { lebar: 80, lebarLabel: 40, lebarKontrol: 40 });
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);

    await userEvent.click(await screen.findByLabelText('Lebar label combobox (px) tambah'));
    expect(setelan(kunci)).toEqual({ lebar: 80, lebarLabel: 40, lebarKontrol: 40 });
  });

  it('label transparan bawaan: tanpa bg + titik dua, pilihan bisa mengembalikan', async () => {
    const kunci = `uji_ukuran_transparan_${Date.now()}`;
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );
    const teksLabel = () => (container.querySelector(`label[for="${kunci}"]`) as HTMLElement);

    expect(teksLabel().textContent).toBe('Kelompok:');
    expect(teksLabel().className).toMatch(/bg-transparent/);

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    const warna = screen.getByRole('combobox', { ...DALAM_PANEL, name: 'Warna Label:' });
    expect(warna).toHaveValue('Transparan');

    await userEvent.click(warna);
    await userEvent.click(await screen.findByRole('option', { name: 'Tidak Transparan' }));
    expect(setelan(kunci).labelTransparan).toBe(false);
    expect(teksLabel().textContent).toBe('Kelompok');

    await userEvent.click(warna);
    await userEvent.click(await screen.findByRole('option', { name: 'Transparan' }));
    expect(setelan(kunci).labelTransparan).toBe(true);
    expect(teksLabel().textContent).toBe('Kelompok:');
  });

  it('normalkanUkuran menjepit nilai & membuang kunci asing', () => {
    expect(normalkanUkuran({ tinggi: 5, lebar: 99999, lain: 1 })).toEqual({ tinggi: 20, lebar: 1200 });
    expect(normalkanUkuran({ lebarLabel: 9, lebarKontrol: 9999 })).toEqual({ lebarLabel: 40, lebarKontrol: 1200 });
    expect(normalkanUkuran({ labelTransparan: false })).toEqual({ labelTransparan: false });
    expect(normalkanUkuran({ nilaiDefault: '  Nama  ' })).toEqual({ nilaiDefault: 'Nama' });
    expect(normalkanUkuran({ nilaiDefault: '   ' })).toEqual({});
    expect(normalkanUkuran({ nilaiDefault: 7 })).toEqual({});
    expect(normalkanUkuran(null)).toEqual({});
    expect(normalkanUkuran({ tinggi: 'abc' })).toEqual({});
  });

  it('nilai awal dari pengaturan kotak: dipakai sebagai nilai tampil & tetap bisa diubah', async () => {
    const kunci = `uji_nilai_awal_${Date.now()}`;

    simpan(kunci, { nilaiDefault: 'Opsi B' });
    const padaUbah = vi.fn();
    renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        <ComboboxRoot items={OPSI} value="Opsi A" onValueChange={padaUbah}>
          <ComboboxInput id={kunci} aria-label="Demo" />
          <ComboboxTrigger aria-label="Buka daftar" />
          <ComboboxContent>
            <ComboboxList>
              {(o) => <ComboboxItem key={o} value={o}>{o}</ComboboxItem>}
            </ComboboxList>
          </ComboboxContent>
        </ComboboxRoot>
      </LabeledCombobox>,
    );
    const input = document.getElementById(kunci) as HTMLInputElement;

    expect(input.value).toBe('Opsi B');

    await waitFor(() => expect(padaUbah).toHaveBeenCalledWith('Opsi B'));

    await userEvent.click(input);
    await userEvent.click(await screen.findByRole('option', { name: 'Opsi A' }));
    expect(padaUbah).toHaveBeenCalledWith('Opsi A');
    expect(input.value).toBe('Opsi A');
  });

  it('jepitLebar: nilai di luar rentang dijepit ke batas stepper', () => {
    expect(jepitLebar(2000)).toBe(1200);
    expect(jepitLebar(50)).toBe(80);
    expect(jepitLebar(320)).toBe(320);
  });
});
