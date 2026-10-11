import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import LabeledCombobox, { hitungLebarKombo } from './LabeledCombobox';
import { KonteksLebarFilter, daftarFilter } from '@/components/excel/lebarFilter';
import { jepitLebar, normalkanUkuran, simpanUkuranKombo, ukuranKombo } from '@/components/ukuranKombo';
import {
  ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList, ComboboxRoot, ComboboxTrigger,
} from '@/components/ui/combobox';
import { renderDenganTema } from '@/test/utils';

const OPSI = ['Opsi A', 'Opsi B'];

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
    expect(kotak.className).toMatch(/focus-within:ring-1/);
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
    // Ruang = clientWidth(200) − padding(10+10) = 180; dikurangi label 80 → 100.
    expect(hitungLebarKombo(180, 80, 180)).toBe(100);
    // Ruang cukup → lebar yang diminta dipakai utuh.
    expect(hitungLebarKombo(1000, 80, 180)).toBe(180);
    // Sisa sangat kecil → dijaga batas bawah agar isi & panah tak terpotong.
    expect(hitungLebarKombo(60, 80, 180)).toBe(40);
  });

  it('di dalam toolbar: mendaftarkan lebar ke Kelola Tabel & memakai bawaan 200px', () => {
    const tableKey = `uji_lc_${Date.now()}`;
    renderDenganTema(
      <KonteksLebarFilter.Provider value={{ tableKey, lebar: {} }}>
        <LabeledCombobox label="Kelompok" htmlFor="kombo_uji">
          {kombo('kombo_uji')}
        </LabeledCombobox>
      </KonteksLebarFilter.Provider>,
    );
    expect(daftarFilter(tableKey).map((f) => f.label)).toContain('Kelompok');
    // LebarKelola Tabel applies ke KOTAK (label + combobox), bukan ke zona.
    const kotak = document.getElementById('kombo_uji')?.closest('span')?.parentElement as HTMLElement;
    expect(kotak.style.width).toBe('200px');
  });

  it('lebar override dari Kelola Tabel dipakai pada zona combobox', () => {
    const tableKey = `uji_lc_ovr_${Date.now()}`;
    renderDenganTema(
      <KonteksLebarFilter.Provider value={{ tableKey, lebar: { kombo_uji: 240 } }}>
        <LabeledCombobox label="Kelompok" htmlFor="kombo_uji">
          {kombo('kombo_uji')}
        </LabeledCombobox>
      </KonteksLebarFilter.Provider>,
    );
    const kotak = document.getElementById('kombo_uji')?.closest('span')?.parentElement as HTMLElement;
    expect(kotak.style.width).toBe('240px');
  });

  it('kelolaLebar={false}: tak terdaftar & lebar bebas', () => {
    const tableKey = `uji_lc_off_${Date.now()}`;
    renderDenganTema(
      <KonteksLebarFilter.Provider value={{ tableKey, lebar: {} }}>
        <LabeledCombobox label="Kelompok" htmlFor="kombo_uji" kelolaLebar={false}>
          {kombo('kombo_uji')}
        </LabeledCombobox>
      </KonteksLebarFilter.Provider>,
    );
    expect(daftarFilter(tableKey)).toHaveLength(0);
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

    // Lebar dipatok (w = min = max) → tak mengikuti lebar kotak combobox (700px).
    expect(pop.className).toMatch(/w-\[372px\]/);
    expect(pop.className).toMatch(/min-w-\[372px\]/);
    expect(pop.className).toMatch(/max-w-\[372px\]/);
    // Border bawaan `--border` cuma 8% foreground (nyaris tak terlihat) → diganti.
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

    // Baris kompak: label polos sama lebar (48px) + stepper tetap 84px.
    const baris = [`set_tinggi_kombo_${kunci}`, `set_lebar_kombo_${kunci}`, `set_lebar_label_kombo_${kunci}`, `set_lebar_kontrol_kombo_${kunci}`];
    const inputs = [inpTinggi, inpLebar, inpLabel, inpKontrol];
    baris.forEach((id, i) => {
      const lab = document.querySelector(`label[for="${id}"]`) as HTMLElement;
      expect(lab.style.width).toBe('48px');
      expect(lab.parentElement?.contains(inputs[i])).toBe(true);
      expect((document.getElementById(id)?.parentElement as HTMLElement).style.width).toBe('84px');
    });
  });

  it('popover ukuran punya tombol × dan hanya itu yang menutupnya', async () => {
    const kunci = `uji_ukuran_tutup_${Date.now()}`;
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    const tombolTutup = await screen.findByLabelText('Tutup pengaturan ukuran');
    const pop = document.querySelector('[data-slot="popover-content"]') as HTMLElement;
    expect(pop.contains(tombolTutup)).toBe(true);
    // Merah (destruktif), mengikuti konvensi tombol ikon tutup/hapus project.
    expect(tombolTutup.className).toMatch(/text-destructive/);

    await userEvent.click(tombolTutup);
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

    /* Jangkar beku: elemen fixed tak terlihat. Karena Radix memakai elemen ini
       (lewat `virtualRef`) alih-alih kotak combobox, popover tak ikut bergeser
       saat lebar kotak mengubah tata letak (mis. toolbar rata kanan). */
    const jangkar = container.querySelector('span[aria-hidden="true"][style*="fixed"]') as HTMLElement;
    expect(jangkar).not.toBeNull();
    expect(jangkar.style.position).toBe('fixed');
    expect(jangkar.style.visibility).toBe('hidden');
    // Kotak combobox tetap anak pertama (struktur DOM tak berubah).
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
    // jsdom tak menghitung layout → ukuran terukur 0 → titik awal = bawaan 26.
    // Satu klik "+" = +2px (langkah tinggi).
    await userEvent.click(await screen.findByLabelText('Tinggi kotak combobox (px) tambah'));

    expect(ukuranKombo(kunci).tinggi).toBe(28);
    // Komponen lain tak ikut terpengaruh.
    expect(ukuranKombo(kunciLain)).toEqual({});
  });

  it('ukuran tersimpan dipakai kotak combobox (menang atas prop)', async () => {
    const kunci = `uji_ukuran_pakai_${Date.now()}`;
    simpanUkuranKombo(kunci, { tinggi: 34, lebar: 320 });
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
    simpanUkuranKombo(kunci, { tinggi: 40, lebar: 300, lebarLabel: 60, lebarKontrol: 150, expandLabel: true, labelTransparan: true });
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    await userEvent.click(await screen.findByRole('button', { name: /kembalikan ke bawaan/i }));

    expect(ukuranKombo(kunci)).toEqual({});
  });

  it('reset per-baris hanya menghapus kunci baris itu', async () => {
    const kunci = `uji_ukuran_reset_baris_${Date.now()}`;
    simpanUkuranKombo(kunci, { tinggi: 40, lebar: 300, lebarLabel: 60, lebarKontrol: 150 });
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    await userEvent.click(await screen.findByLabelText('Kembalikan lebar label ke bawaan'));

    expect(ukuranKombo(kunci)).toEqual({ tinggi: 40, lebar: 300, lebarKontrol: 150 });
  });

  it('stepper label/kontrol saling menyesuaikan (total tetap)', async () => {
    const kunci = `uji_ukuran_label_kontrol_${Date.now()}`;
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    // Titik awal: total 200, label 80, kontrol 120.
    // Label +4 → kontrol menyusut 4 (total tetap 200).
    await userEvent.click(await screen.findByLabelText('Lebar label combobox (px) tambah'));
    expect(ukuranKombo(kunci)).toEqual({ lebarLabel: 84, lebarKontrol: 116 });
    // Kontrol −10 → label membesar 10.
    await userEvent.click(await screen.findByLabelText('Lebar kontrol combobox (px) kurang'));
    expect(ukuranKombo(kunci)).toEqual({ lebarLabel: 94, lebarKontrol: 106 });

    // Kontrol terkunci → kotak rangkul isi (tanpa lebar total), label & zona
    // kontrol memakai lebar tersimpan.
    const kotak = container.firstElementChild as HTMLElement;
    expect(kotak.style.width).toBe('');
    expect((kotak.firstElementChild as HTMLElement).style.width).toBe('94px');
    expect((kotak.children[1] as HTMLElement).style.width).toBe('106px');
  });

  it('ubah total menggeser sisi yang mengembang (bawaan: kontrol)', async () => {
    const kunci = `uji_ukuran_total_${Date.now()}`;
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    // Bawaan: kontrol mengembang (pil kontrol tertekan).
    expect(screen.getByRole('button', { name: 'Kontrol mengembang' })).toHaveAttribute('aria-pressed', 'true');
    // Total +10 → kontrol 120→130, label tetap 80.
    await userEvent.click(await screen.findByLabelText('Lebar kotak combobox (px) tambah'));
    expect(ukuranKombo(kunci)).toEqual({ lebar: 210, lebarKontrol: 130 });
  });

  it('flag expanding: tepat satu tercentang & total mengikuti flag', async () => {
    const kunci = `uji_ukuran_expand_${Date.now()}`;
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    const pilLabel = screen.getByRole('button', { name: 'Label mengembang' });
    const pilKontrol = screen.getByRole('button', { name: 'Kontrol mengembang' });
    // Pilih label → kontrol lepas; flag tersimpan.
    await userEvent.click(pilLabel);
    expect(pilLabel).toHaveAttribute('aria-pressed', 'true');
    expect(pilKontrol).toHaveAttribute('aria-pressed', 'false');
    expect(ukuranKombo(kunci).expandLabel).toBe(true);
    // Total +10 kini menggeser label (80→90), kontrol tetap.
    await userEvent.click(await screen.findByLabelText('Lebar kotak combobox (px) tambah'));
    expect(ukuranKombo(kunci)).toMatchObject({ lebar: 210, lebarLabel: 90 });
    // Pilih kontrol → label lepas.
    await userEvent.click(pilKontrol);
    expect(pilLabel).toHaveAttribute('aria-pressed', 'false');
    expect(pilKontrol).toHaveAttribute('aria-pressed', 'true');
    expect(ukuranKombo(kunci).expandLabel).toBeUndefined();
  });

  it('tautan dijepit: sisi lawan mentok → sisi yang diubah tertahan', async () => {
    const kunci = `uji_ukuran_jepit_${Date.now()}`;
    simpanUkuranKombo(kunci, { lebar: 80, lebarLabel: 40, lebarKontrol: 40 });
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    // Total sudah minimal (40+40): label tak bisa membesar (kontrol mentok).
    await userEvent.click(await screen.findByLabelText('Lebar label combobox (px) tambah'));
    expect(ukuranKombo(kunci)).toEqual({ lebar: 80, lebarLabel: 40, lebarKontrol: 40 });
  });

  it('label transparan bawaan: tanpa bg + titik dua, pil bisa mengembalikan', async () => {
    const kunci = `uji_ukuran_transparan_${Date.now()}`;
    const { container } = renderDenganTema(
      <LabeledCombobox label="Kelompok" htmlFor={kunci}>
        {kombo(kunci)}
      </LabeledCombobox>,
    );
    const teksLabel = () => (container.querySelector(`label[for="${kunci}"]`) as HTMLElement);

    // Bawaan: transparan (pil tertekan).
    expect(teksLabel().textContent).toBe('Kelompok:');
    expect(teksLabel().className).toMatch(/bg-transparent/);

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    const pil = screen.getByRole('button', { name: 'Label transparan' });
    expect(pil).toHaveAttribute('aria-pressed', 'true');

    // Pilih → ber-bg eksplisit (false tersimpan, bukan dihapus).
    await userEvent.click(pil);
    expect(ukuranKombo(kunci).labelTransparan).toBe(false);
    expect(teksLabel().textContent).toBe('Kelompok');

    // Pilih lagi → kembali transparan.
    await userEvent.click(pil);
    expect(ukuranKombo(kunci).labelTransparan).toBe(true);
    expect(teksLabel().textContent).toBe('Kelompok:');
  });

  it('normalkanUkuran menjepit nilai & membuang kunci asing', () => {
    expect(normalkanUkuran({ tinggi: 5, lebar: 99999, lain: 1 })).toEqual({ tinggi: 20, lebar: 1200 });
    expect(normalkanUkuran({ lebarLabel: 9, lebarKontrol: 9999 })).toEqual({ lebarLabel: 40, lebarKontrol: 1200 });
    expect(normalkanUkuran({ labelTransparan: false })).toEqual({ labelTransparan: false });
    expect(normalkanUkuran(null)).toEqual({});
    expect(normalkanUkuran({ tinggi: 'abc' })).toEqual({});
  });

  it('jepitLebar: nilai di luar rentang dijepit ke batas stepper', () => {
    expect(jepitLebar(2000)).toBe(1200);
    expect(jepitLebar(50)).toBe(80);
    expect(jepitLebar(320)).toBe(320);
  });
});