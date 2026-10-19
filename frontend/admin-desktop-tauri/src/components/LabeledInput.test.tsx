import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LabeledInput, { hitungLebarInput } from './LabeledInput';
import { KonteksLebarFilter } from '@/components/excel/lebarFilter';
import { renderDenganTema } from '@/test/utils';
import { resetSetelanKomponen, setelanKomponen, simpanSetelanKomponen } from '@/components/komponenCustom';

vi.mock('@/api/komponenCustom', () => ({
  muatKomponenCustom: vi.fn(async () => ({ pesan: '', data: { peta: {} } })),
  simpanKomponenCustom: vi.fn(async () => ({ pesan: '', data: {} })),
  hapusKomponenCustom: vi.fn(async () => ({ pesan: '' })),
}));

beforeEach(() => {
  resetSetelanKomponen();
});

/** Buka popover pengaturan (klik kanan): bagian "Lainnya" (baris "Tipe" &
 *  pengaturan tipe) bawaan TERBUKA, jadi langsung bisa dipakai. */
async function bukaPengaturanLengkap(kotak: HTMLElement) {
  fireEvent.contextMenu(kotak);
  await screen.findByRole('button', { name: 'Sembunyikan pengaturan lainnya' });
}

describe('LabeledInput', () => {
  it('label terhubung ke input via for ↔ id', () => {
    renderDenganTema(<LabeledInput label="Nama" htmlFor="inp_uji" />);
    expect(screen.getByText('Nama:').getAttribute('for')).toBe('inp_uji');
    expect(document.getElementById('inp_uji')).not.toBeNull();
  });

  it('lebar dikunci: label & input sesuai ukuran, kotak rangkul isi', () => {
    const { container } = renderDenganTema(
      <LabeledInput label="Nama" htmlFor="inp_uji" lebarLabel={80} lebarInput={180} tinggi={34} />,
    );
    const kotak = container.firstElementChild as HTMLElement;
    expect(kotak.style.height).toBe('34px');
    expect(kotak.className).toMatch(/inline-flex/);
    expect(kotak.className).toMatch(/w-max/);
    expect(screen.getByText('Nama:').getAttribute('style')).toContain('width: 80px');
    const zona = document.getElementById('inp_uji')?.closest('span') as HTMLElement;
    expect(zona.style.width).toBe('180px');
    expect(zona.style.flex).toBe('0 0 auto');
  });

  it('bawaan: kotak selebar induk & input penuh tanpa border sendiri', () => {
    const { container } = renderDenganTema(<LabeledInput label="Nama" htmlFor="inp_uji" />);
    const kotak = container.firstElementChild as HTMLElement;
    expect(kotak.className).toMatch(/w-full/);
    expect(kotak.className).toMatch(/focus-within:border-ring/);
    const kelas = document.getElementById('inp_uji')?.className ?? '';
    expect(kelas).toMatch(/h-full/);
    expect(kelas).toMatch(/w-full/);
    expect(kelas).toMatch(/border-0/);
    expect(kelas).toMatch(/focus-visible:ring-0/);
  });

  it('properti input diteruskan (type, placeholder, nilai awal)', () => {
    renderDenganTema(
      <LabeledInput label="NIS" htmlFor="inp_uji" type="number" placeholder="mis. 1234" defaultValue="24001" />,
    );
    const input = document.getElementById('inp_uji') as HTMLInputElement;
    expect(input.type).toBe('number');
    expect(input.placeholder).toBe('mis. 1234');
    expect(input.value).toBe('24001');
  });

  it('aksiKanan ditumpuk di ujung kanan & input diberi ruang kanan', () => {
    renderDenganTema(
      <LabeledInput
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
    renderDenganTema(<LabeledInput label="Nama" htmlFor="inp_uji" />);
    expect((document.getElementById('inp_uji') as HTMLInputElement).className).not.toMatch(/pr-7/);
  });

  it('di dalam toolbar: kotak memakai lebar bawaan (160px)', () => {
    const tableKey = `uji_lti_${Date.now()}`;
    renderDenganTema(
      <KonteksLebarFilter.Provider value={{ tableKey }}>
        <LabeledInput label="Nama" htmlFor="inp_uji" />
      </KonteksLebarFilter.Provider>,
    );
    const kotak = document.getElementById('inp_uji')?.closest('span')?.parentElement as HTMLElement;
    expect(kotak.style.width).toBe('160px');
  });

  it('lebar tersimpan pada setelan komponen dipakai pada kotak', () => {
    const tableKey = `uji_lti_ovr_${Date.now()}`;

    simpanSetelanKomponen(tableKey, 'inp_uji', { lebar: 260 });
    renderDenganTema(
      <KonteksLebarFilter.Provider value={{ tableKey }}>
        <LabeledInput label="Nama" htmlFor="inp_uji" />
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

  it('tanpaLabel: label tak dirender, kontrol mengisi penuh, nama tetap terbaca', () => {
    const { container, unmount } = renderDenganTema(
      <LabeledInput label="Nama" htmlFor="inp_tanpa_label" />,
    );

    expect(container.querySelector('label[for="inp_tanpa_label"]')).not.toBeNull();
    unmount();

    const kedua = renderDenganTema(
      <LabeledInput label="Nama" htmlFor="inp_tanpa_label2" tanpaLabel />,
    );

    const lbl = kedua.container.querySelector('label[for="inp_tanpa_label2"]') as HTMLElement;
    expect(lbl.className).toMatch(/sr-only/);
    expect(lbl.textContent).toBe('Nama');

    expect(kedua.container.firstElementChild?.className).toMatch(/w-full/);
  });

  it('tanpaLabel dari popover: pilih "Sembunyi" → tersimpan & label hilang', async () => {
    const kunci = `uji_tanpa_label_${Date.now()}`;
    const { container } = renderDenganTema(
      <LabeledInput label="Nama" htmlFor={kunci} />,
    );

    await bukaPengaturanLengkap(container.firstElementChild as HTMLElement);
    const baris = await screen.findByRole('combobox', { name: 'Label:' });
    expect(baris).toHaveValue('Tampil');
    await userEvent.click(baris);
    await userEvent.click(await screen.findByRole('option', { name: 'Sembunyi' }));
    expect(setelanKomponen('', kunci).tanpaLabel).toBe(true);
    const lbl = container.querySelector(`label[for="${kunci}"]`) as HTMLElement;
    expect(lbl.className).toMatch(/sr-only/);
  });

  it('labelTransparan bawaan transparan; false eksplisit ber-bg', () => {
    const { container, unmount } = renderDenganTema(
      <LabeledInput label="Nama" htmlFor="inp_transparan" />,
    );

    expect((container.querySelector('label[for="inp_transparan"]') as HTMLElement).textContent).toBe('Nama:');
    expect((container.firstElementChild as HTMLElement).className).toMatch(/dark:bg-input\/30/);
    unmount();

    const kedua = renderDenganTema(
      <LabeledInput label="Nama" htmlFor="inp_biasa" labelTransparan={false} />,
    );
    expect((kedua.container.querySelector('label[for="inp_biasa"]') as HTMLElement).textContent).toBe('Nama');
    expect((kedua.container.firstElementChild as HTMLElement).className).not.toMatch(/dark:bg-input\/30/);
  });

  it('labelTransparan tersimpan: kotak 1 lapis + teks rapat ke titik dua', () => {
    const { container } = renderDenganTema(
      <LabeledInput label="Nama" htmlFor="inp_transparan2" labelTransparan />,
    );

    const zona = document.getElementById('inp_transparan2')?.closest('span') as HTMLElement;
    expect(zona.className).toMatch(/dark:bg-transparent/);

    const labelEl = container.querySelector('label[for="inp_transparan2"]') as HTMLElement;
    expect(labelEl.className).toMatch(/(^|\s)pr-1(\s|$)/);
    expect(zona.className).toMatch(/pl-1/);
  });

  it('klik kanan membuka popover ukuran (judul input): total menaut & pilihan warna label', async () => {
    const kunci = `uji_input_pop_${Date.now()}`;
    const { container } = renderDenganTema(
      <LabeledInput label="Nama" htmlFor={kunci} />,
    );

    await bukaPengaturanLengkap(container.firstElementChild as HTMLElement);
    expect(await screen.findByLabelText('Tinggi kotak input (px)')).not.toBeNull();

    await userEvent.click(await screen.findByLabelText('Lebar kotak input (px) tambah'));
    expect(setelanKomponen('', kunci)).toEqual({ lebar: 170, lebarKontrol: 90 });

    const warna = screen.getByRole('combobox', { name: 'Warna Label:' });
    expect(warna).toHaveValue('Transparan');
    await userEvent.click(warna);
    await userEvent.click(await screen.findByRole('option', { name: 'Tidak Transparan' }));
    expect(setelanKomponen('', kunci).labelTransparan).toBe(false);
    expect((container.querySelector(`label[for="${kunci}"]`) as HTMLElement).textContent).toBe('Nama');
  });

  it('tipe bawaan dari pemanggil: type="date" → baris Tipe = Tanggal (kotak ber-mask + kalender)', async () => {
    const kunci = `uji_tipe_bawaan_${Date.now()}`;
    const { container } = renderDenganTema(
      <LabeledInput label="Jatuh Tempo" htmlFor={kunci} type="date" />,
    );

    expect((document.getElementById(kunci) as HTMLInputElement).type).toBe('text');
    expect(document.getElementById(`btn_kalender_${kunci}`)).not.toBeNull();

    await bukaPengaturanLengkap(container.firstElementChild as HTMLElement);
    const tipe = await screen.findByRole('combobox', { name: 'Tipe' });
    expect(tipe).toHaveValue('Tanggal');
  });

  it('popover: pilih tipe Nominal (Uang) → number + kalkulator, reset baris mengembalikan', async () => {
    const kunci = `uji_tipe_nominal_${Date.now()}`;
    const { container } = renderDenganTema(
      <LabeledInput label="Jumlah" htmlFor={kunci} defaultValue="1000" />,
    );
    const input = () => document.getElementById(kunci) as HTMLInputElement;
    expect(input().type).toBe('text');
    expect(screen.queryByLabelText('Pilih nominal cepat')).toBeNull();

    await bukaPengaturanLengkap(container.firstElementChild as HTMLElement);
    const tipe = await screen.findByRole('combobox', { name: 'Tipe' });
    await userEvent.click(tipe);
    await userEvent.click(await screen.findByRole('option', { name: 'Nominal (Uang)' }));

    expect(setelanKomponen('', kunci)).toEqual({ tipeKontrol: 'nominal' });
    expect(input().type).toBe('text');
    expect(input().inputMode).toBe('numeric');
    expect(screen.getByLabelText('Pilih nominal cepat')).not.toBeNull();

    expect(input().value).toBe('1.000');

    await userEvent.click(screen.getByLabelText('Kembalikan tipe input ke bawaan'));
    expect(setelanKomponen('', kunci)).toEqual({});
    expect(input().type).toBe('text');
    expect(screen.queryByLabelText('Pilih nominal cepat')).toBeNull();
  });

  it('pilihanTipe kosong: baris Tipe tak muncul (kontrol non-input)', async () => {
    renderDenganTema(<LabeledInput label="Nama" htmlFor="inp_tanpa_tipe" pilihanTipe={[]} />);

    await bukaPengaturanLengkap(document.querySelector('#inp_tanpa_tipe')?.closest('span')?.parentElement as HTMLElement);
    expect(screen.queryByRole('combobox', { name: 'Tipe' })).toBeNull();
  });

  it('bawaanTipe mengimpa aksiKanan tipe aktif untuk kotak ini saja', () => {
    renderDenganTema(
      <LabeledInput
        label="Nominal"
        htmlFor="inp_preset"
        tipeKontrol="nominal"
        value="0"
        onChange={() => {}}
        bawaanTipe={{ aksiKanan: () => <button type="button">Cepat</button> }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Cepat' })).not.toBeNull();
    expect(screen.queryByLabelText('Pilih nominal cepat')).toBeNull();
  });
});
