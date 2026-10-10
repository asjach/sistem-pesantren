import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import LabeledCombobox, { hitungLebarKombo } from './LabeledCombobox';
import { KonteksLebarFilter, daftarFilter } from '@/components/excel/lebarFilter';
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
    expect(screen.getByText('Kelompok').getAttribute('for')).toBe('kombo_uji');
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
    expect(screen.getByText('Kelompok').getAttribute('style')).toContain('width: 80px');
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
    expect(screen.getByText('Kelompok').className).toMatch(/w-max/);
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
});