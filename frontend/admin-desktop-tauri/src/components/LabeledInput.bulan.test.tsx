import { useState } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LabeledInput from './LabeledInput';
import { renderDenganTema } from '@/test/utils';
import { resetSetelanKomponen } from '@/components/komponenCustom';
import { bulanIni, bulanKeTampilan, NAMA_BULAN, pecahBulan } from '@/lib/tanggal';

vi.mock('@/api/komponenCustom', () => ({
  muatKomponenCustom: vi.fn(async () => ({ pesan: '', data: { peta: {} } })),
  simpanKomponenCustom: vi.fn(async () => ({ pesan: '', data: {} })),
  hapusKomponenCustom: vi.fn(async () => ({ pesan: '' })),
}));

beforeEach(() => {
  resetSetelanKomponen();
});

/** Harness terkontrol (`value` + `onChange`) seperti pemakaian nyata, plus
 *  tombol untuk meniru pemanggil yang mengubah nilai dari LUAR. */
function Contoh({ awal = '' }: { awal?: string }) {
  const [nilai, setNilai] = useState(awal);
  return (
    <div>
      <LabeledInput
        nama="input" tipeKontrol="bulan"
        label="Bulan" htmlFor="inp_bln"
        value={nilai} onChange={(e) => setNilai(e.target.value)}
      />
      <button type="button" onClick={() => setNilai('2020-02')}>set-luar</button>
      <span data-uji="nilai">{nilai}</span>
    </div>
  );
}

/** Teks yang TAMPIL di kotak (mm/yyyy) — bukan nilai yang dikirim. */
const kotak = () => document.getElementById('inp_bln') as HTMLInputElement;
/** Nilai sebenarnya yang diterima pemanggil (YYYY-MM). */
const nilai = () => document.querySelector('[data-uji="nilai"]')?.textContent;
const bukaPemilih = () => userEvent.click(screen.getByRole('button', { name: 'Pilih bulan' }));

const ini = pecahBulan(bulanIni()) as { tahun: number; bulan: number };

describe('LabeledInput tipe bulan — kotak', () => {
  it('memakai teks ber-mask mm/yyyy + pemilih bulan, bukan `month` native', () => {
    renderDenganTema(<Contoh />);

    const el = kotak();

    expect(el.type).toBe('text');
    expect(el.inputMode).toBe('numeric');
    expect(el.placeholder).toBe('mm/yyyy');
    expect(el.className).toMatch(/pr-7/);
    expect(document.getElementById('btn_bulan_inp_bln')).not.toBeNull();

    expect(document.getElementById('btn_kalender_inp_bln')).toBeNull();
  });

  it('nilai awal YYYY-MM ditampilkan mm/yyyy tanpa mengubah nilainya', () => {
    renderDenganTema(<Contoh awal="2026-07" />);

    expect(kotak().value).toBe('07/2026');
    expect(nilai()).toBe('2026-07');
  });
});

describe('LabeledInput tipe bulan — tampilan vs nilai', () => {
  it('mengetik digit menambah "/" sendiri; nilai pemanggil tetap YYYY-MM', async () => {
    renderDenganTema(<Contoh />);

    await userEvent.type(kotak(), '102026');

    expect(kotak().value).toBe('10/2026');
    expect(nilai()).toBe('2026-10');
  });

  it('tempelan ISO (dari Excel/DB) dibaca sebagai bulannya', async () => {
    renderDenganTema(<Contoh />);

    fireEvent.change(kotak(), { target: { value: '2026-10' } });
    expect(kotak().value).toBe('10/2026');
    expect(nilai()).toBe('2026-10');

    fireEvent.change(kotak(), { target: { value: '2026-03-15' } });
    expect(kotak().value).toBe('03/2026');
    expect(nilai()).toBe('2026-03');
  });

  it('bulan di luar 01–12 ditandai (aria-invalid) dan tak jadi nilai', async () => {
    renderDenganTema(<Contoh />);

    fireEvent.change(kotak(), { target: { value: '13/2026' } });
    expect(nilai()).toBe('');
    expect(kotak().value).toBe('13/2026');
    expect(kotak().getAttribute('aria-invalid')).toBe('true');
    expect(kotak().title).toBe('Bulan tidak dikenal (mis. 10/2026 atau "okt 2026")');

    fireEvent.change(kotak(), { target: { value: '12/2026' } });
    await waitFor(() => expect(kotak().getAttribute('aria-invalid')).toBeNull());
    expect(nilai()).toBe('2026-12');
  });

  it('sisa ketikan dibuang saat nilai diubah dari LUAR', async () => {
    renderDenganTema(<Contoh />);
    await userEvent.type(kotak(), '102');
    expect(kotak().value).toBe('10/2');

    await userEvent.click(screen.getByRole('button', { name: 'set-luar' }));

    await waitFor(() => expect(kotak().value).toBe('02/2020'));
    expect(nilai()).toBe('2020-02');
  });
});

describe('LabeledInput tipe bulan — ketikan cepat nama bulan', () => {
  it('mengetik "okt2026" tetap terlihat saat diketik; dibakukan saat kotak ditinggalkan', async () => {
    renderDenganTema(<Contoh />);

    await userEvent.type(kotak(), 'okt2026');

    expect(kotak().value).toBe('Okt 2026');
    expect(nilai()).toBe('2026-10');

    fireEvent.blur(kotak());

    await waitFor(() => expect(kotak().value).toBe('10/2026'));
    expect(nilai()).toBe('2026-10');
  });

  it('tahun dua digit: "okt26" → Oktober 2026', async () => {
    renderDenganTema(<Contoh />);

    await userEvent.type(kotak(), 'okt26');

    expect(kotak().value).toBe('Okt 26');
    expect(nilai()).toBe('2026-10');
  });

  it('nama bulan panjang & spasi ikut terbaca; "/" dari ketikan digit tak mengganggu', async () => {
    renderDenganTema(<Contoh />);

    await userEvent.type(kotak(), 'september 2025');
    expect(kotak().value).toBe('September 2025');
    expect(nilai()).toBe('2025-09');

    await userEvent.clear(kotak());
    await userEvent.type(kotak(), '032025');
    expect(kotak().value).toBe('03/2025');
    expect(nilai()).toBe('2025-03');
  });

  it('nama bulan tak dikenal ditandai (aria-invalid) dan tak jadi nilai', async () => {
    renderDenganTema(<Contoh />);

    await userEvent.type(kotak(), 'xyz26');

    expect(kotak().value).toBe('Xyz 26');
    expect(nilai()).toBe('');
    expect(kotak().getAttribute('aria-invalid')).toBe('true');

    fireEvent.blur(kotak());
    expect(kotak().value).toBe('Xyz 26');
  });
});

describe('LabeledInput tipe bulan — pemilih bulan', () => {
  it('memilih dari pemilih menulis YYYY-MM ke pemanggil & menampilkannya di kotak', async () => {
    renderDenganTema(<Contoh />);

    await bukaPemilih();
    await userEvent.click(await screen.findByRole('button', { name: `Januari ${ini.tahun}` }));

    await waitFor(() => expect(nilai()).toBe(`${ini.tahun}-01`));
    expect(kotak().value).toBe('01/' + ini.tahun);
  });

  it('"Bulan ini" mengisi bulan berjalan; "Kosongkan" mengosongkan kotak & nilai', async () => {
    renderDenganTema(<Contoh awal="2026-07" />);

    await bukaPemilih();
    await userEvent.click(await screen.findByRole('button', { name: 'Bulan ini' }));
    await waitFor(() => expect(nilai()).toBe(bulanIni()));
    expect(kotak().value).toBe(bulanKeTampilan(bulanIni()));

    await bukaPemilih();
    await userEvent.click(await screen.findByRole('button', { name: 'Kosongkan bulan' }));
    await waitFor(() => expect(nilai()).toBe(''));
    expect(kotak().value).toBe('');
  });

  it('pilihan pemilih menimpa sisa ketikan yang belum lengkap', async () => {
    renderDenganTema(<Contoh />);
    await userEvent.type(kotak(), '10/2');

    await bukaPemilih();
    await userEvent.click(await screen.findByRole('button', { name: `${NAMA_BULAN[ini.bulan - 1]} ${ini.tahun}` }));

    await waitFor(() => expect(kotak().value).toBe(bulanKeTampilan(bulanIni())));
    expect(nilai()).toBe(bulanIni());
  });
});
