import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import LabeledTextInput, { hitungLebarInput } from './LabeledTextInput';
import { KonteksLebarFilter, daftarFilter } from '@/components/excel/lebarFilter';
import { renderDenganTema } from '@/test/utils';

describe('LabeledTextInput', () => {
  it('label terhubung ke input via for ↔ id', () => {
    renderDenganTema(<LabeledTextInput label="Nama" htmlFor="inp_uji" />);
    expect(screen.getByText('Nama').getAttribute('for')).toBe('inp_uji');
    expect(document.getElementById('inp_uji')).not.toBeNull();
  });

  it('lebar dikunci: label & input sesuai ukuran, kotak rangkul isi', () => {
    const { container } = renderDenganTema(
      <LabeledTextInput label="Nama" htmlFor="inp_uji" lebarLabel={80} lebarInput={180} tinggi={34} />,
    );
    const kotak = container.firstElementChild as HTMLElement;
    expect(kotak.style.height).toBe('34px');
    expect(kotak.className).toMatch(/inline-flex/);
    expect(kotak.className).toMatch(/w-max/);
    expect(screen.getByText('Nama').getAttribute('style')).toContain('width: 80px');
    const zona = document.getElementById('inp_uji')?.closest('span') as HTMLElement;
    expect(zona.style.width).toBe('180px');
    expect(zona.style.flex).toBe('0 0 auto');
  });

  it('bawaan: kotak selebar induk & input penuh tanpa border sendiri', () => {
    const { container } = renderDenganTema(<LabeledTextInput label="Nama" htmlFor="inp_uji" />);
    const kotak = container.firstElementChild as HTMLElement;
    expect(kotak.className).toMatch(/w-full/);
    expect(kotak.className).toMatch(/focus-within:ring-1/);
    const kelas = document.getElementById('inp_uji')?.className ?? '';
    expect(kelas).toMatch(/h-full/);
    expect(kelas).toMatch(/w-full/);
    expect(kelas).toMatch(/border-0/);
    expect(kelas).toMatch(/focus-visible:ring-0/);
  });

  it('properti input diteruskan (type, placeholder, nilai awal)', () => {
    renderDenganTema(
      <LabeledTextInput label="NIS" htmlFor="inp_uji" type="number" placeholder="mis. 1234" defaultValue="24001" />,
    );
    const input = document.getElementById('inp_uji') as HTMLInputElement;
    expect(input.type).toBe('number');
    expect(input.placeholder).toBe('mis. 1234');
    expect(input.value).toBe('24001');
  });

  it('di dalam toolbar: mendaftarkan lebar ke Kelola Tabel & memakai bawaan', () => {
    const tableKey = `uji_lti_${Date.now()}`;
    renderDenganTema(
      <KonteksLebarFilter.Provider value={{ tableKey, lebar: {} }}>
        <LabeledTextInput label="Nama" htmlFor="inp_uji" />
      </KonteksLebarFilter.Provider>,
    );
    expect(daftarFilter(tableKey).map((f) => f.label)).toContain('Nama');
    const kotak = document.getElementById('inp_uji')?.closest('span')?.parentElement as HTMLElement;
    expect(kotak.style.width).toBe('200px');
  });

  it('lebar override Kelola Tabel dipakai pada kotak', () => {
    const tableKey = `uji_lti_ovr_${Date.now()}`;
    renderDenganTema(
      <KonteksLebarFilter.Provider value={{ tableKey, lebar: { inp_uji: 260 } }}>
        <LabeledTextInput label="Nama" htmlFor="inp_uji" />
      </KonteksLebarFilter.Provider>,
    );
    const kotak = document.getElementById('inp_uji')?.closest('span')?.parentElement as HTMLElement;
    expect(kotak.style.width).toBe('260px');
  });

  it('ruang induk tak cukup: input menyusut (200 − 10 − 10 − 80 = 100)', () => {
    expect(hitungLebarInput(180, 80, 180)).toBe(100);
    expect(hitungLebarInput(1000, 80, 180)).toBe(180);
    expect(hitungLebarInput(60, 80, 180)).toBe(40);
  });
});