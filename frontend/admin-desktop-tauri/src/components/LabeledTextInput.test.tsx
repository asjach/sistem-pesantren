import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import LabeledTextInput, { hitungLebarInput } from './LabeledTextInput';
import { KonteksLebarFilter, daftarFilter } from '@/components/excel/lebarFilter';
import { ukuranKombo } from '@/components/ukuranKombo';
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

  it('aksiKanan ditumpuk di ujung kanan & input diberi ruang kanan', () => {
    renderDenganTema(
      <LabeledTextInput
        label="Nominal" htmlFor="inp_uji"
        aksiKanan={<button type="button">Cepat</button>}
      />,
    );
    const input = document.getElementById('inp_uji') as HTMLInputElement;
    expect(input.className).toMatch(/pr-7/);
    const aksi = screen.getByRole('button', { name: 'Cepat' });
    expect(aksi.parentElement?.className).toMatch(/absolute/);
  });

  it('tanpa aksiKanan: input tanpa ruang kanan tambahan', () => {
    renderDenganTema(<LabeledTextInput label="Nama" htmlFor="inp_uji" />);
    expect((document.getElementById('inp_uji') as HTMLInputElement).className).not.toMatch(/pr-7/);
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

  it('labelTransparan: kotak memakai bg kontrol agar keduanya sama', () => {
    const { container, unmount } = renderDenganTema(
      <LabeledTextInput label="Nama" htmlFor="inp_transparan" labelTransparan />,
    );
    expect((container.firstElementChild as HTMLElement).className).toMatch(/dark:bg-input\/30/);
    // Zona kontrol: bg gelap input dinetralkan (1 lapis, sama dengan label).
    const zona = document.getElementById('inp_transparan')?.closest('span') as HTMLElement;
    expect(zona.className).toMatch(/dark:bg-transparent/);
    // Teks kontrol rapat ke ":" (±2 spasi): kanan label + kiri input dipangkas.
    const labelEl = container.querySelector('label[for="inp_transparan"]') as HTMLElement;
    expect(labelEl.className).toMatch(/(^|\s)pr-1(\s|$)/);
    expect(zona.className).toMatch(/pl-1/);
    unmount();

    const kedua = renderDenganTema(<LabeledTextInput label="Nama" htmlFor="inp_biasa" />);
    expect((kedua.container.firstElementChild as HTMLElement).className).not.toMatch(/dark:bg-input\/30/);
  });

  it('klik kanan membuka popover ukuran (judul input): total menaut & pil transparan', async () => {
    const kunci = `uji_input_pop_${Date.now()}`;
    const { container } = renderDenganTema(
      <LabeledTextInput label="Nama" htmlFor={kunci} />,
    );

    fireEvent.contextMenu(container.firstElementChild as HTMLElement);
    expect(await screen.findByLabelText('Tinggi kotak input (px)')).not.toBeNull();
    // Total +10 (bawaan kontrol mengembang): kontrol 120→130, label tetap.
    await userEvent.click(await screen.findByLabelText('Lebar kotak input (px) tambah'));
    expect(ukuranKombo(kunci)).toEqual({ lebar: 210, lebarKontrol: 130 });
    // Pil transparan: label bertitik dua.
    await userEvent.click(screen.getByRole('button', { name: 'Label transparan' }));
    expect(ukuranKombo(kunci).labelTransparan).toBe(true);
    expect((container.querySelector(`label[for="${kunci}"]`) as HTMLElement).textContent).toBe('Nama:');
  });
});