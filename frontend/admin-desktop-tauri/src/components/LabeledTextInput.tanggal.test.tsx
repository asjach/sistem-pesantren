import { useState } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LabeledTextInput from './LabeledTextInput';
import { renderDenganTema } from '@/test/utils';
import { resetSetelanKomponen } from '@/components/komponenCustom';
import { hariIniIso, tanggalKeTampilan } from '@/lib/tanggal';

/* Setelan komponen custom disimpan di server; API-nya dimock agar tak ada
   permintaan jaringan saat render. */
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
      <LabeledTextInput
        nama="input" tipeKontrol="tanggal"
        label="Tanggal" htmlFor="inp_tgl"
        value={nilai} onChange={(e) => setNilai(e.target.value)}
      />
      <button type="button" onClick={() => setNilai('2020-02-03')}>set-luar</button>
      <span data-uji="nilai">{nilai}</span>
    </div>
  );
}

/** Teks yang TAMPIL di kotak (dd/mm/yyyy) — bukan nilai yang dikirim. */
const kotak = () => document.getElementById('inp_tgl') as HTMLInputElement;
/** Nilai sebenarnya yang diterima pemanggil (ISO). */
const nilai = () => document.querySelector('[data-uji="nilai"]')?.textContent;
const bukaKalender = () => userEvent.click(screen.getByRole('button', { name: 'Pilih tanggal' }));

describe('LabeledTextInput tipe tanggal — kotak', () => {
  it('memakai teks ber-mask + papan angka, dengan tombol kalender di ujung kanan', () => {
    renderDenganTema(<Contoh />);
    const el = kotak();
    // `text`, BUKAN `date`: tampilan & pemilihnya milik kita, bukan webview.
    expect(el.type).toBe('text');
    expect(el.inputMode).toBe('numeric');
    expect(el.placeholder).toBe('dd/mm/yyyy');
    expect(el.className).toMatch(/pr-7/);
    expect(document.getElementById('btn_kalender_inp_tgl')).not.toBeNull();
    // Tombol kalkulator rupiah bukan milik tipe ini.
    expect(document.getElementById('btn_preset_inp_tgl')).toBeNull();
  });

  it('nilai awal ISO ditampilkan dd/mm/yyyy tanpa mengubah nilainya', () => {
    renderDenganTema(<Contoh awal="2026-07-14" />);
    expect(kotak().value).toBe('14/07/2026');
    expect(nilai()).toBe('2026-07-14');
  });
});

describe('LabeledTextInput tipe tanggal — tampilan vs nilai', () => {
  it('mengetik digit menambah "/" sendiri; nilai pemanggil tetap ISO', async () => {
    renderDenganTema(<Contoh />);

    await userEvent.type(kotak(), '12102026');

    expect(kotak().value).toBe('12/10/2026'); // yang dilihat pengguna
    expect(nilai()).toBe('2026-10-12');       // yang dipakai aplikasi & dikirim ke DB
  });

  it('ketikan yang belum lengkap tetap terlihat, tapi nilainya masih kosong', async () => {
    renderDenganTema(<Contoh />);

    await userEvent.type(kotak(), '121');

    expect(kotak().value).toBe('12/1');
    expect(nilai()).toBe('');
  });

  it('tempelan ISO (dari Excel/DB) dibaca sebagai ISO, bukan 20/26/1012', () => {
    renderDenganTema(<Contoh />);

    fireEvent.change(kotak(), { target: { value: '2026-10-12' } });

    expect(kotak().value).toBe('12/10/2026');
    expect(nilai()).toBe('2026-10-12');
  });

  it('tanggal yang tak ada di kalender ditandai (aria-invalid) dan tak jadi nilai', async () => {
    renderDenganTema(<Contoh />);

    fireEvent.change(kotak(), { target: { value: '31/02/2026' } });
    expect(nilai()).toBe('');
    expect(kotak().value).toBe('31/02/2026'); // tetap terlihat supaya bisa diperbaiki
    expect(kotak().getAttribute('aria-invalid')).toBe('true');
    expect(kotak().title).toBe('Tanggal tidak ada di kalender');

    // Diperbaiki → tanda hilang & nilainya masuk.
    fireEvent.change(kotak(), { target: { value: '28/02/2026' } });
    await waitFor(() => expect(kotak().getAttribute('aria-invalid')).toBeNull());
    expect(nilai()).toBe('2026-02-28');
  });

  it('sisa ketikan dibuang saat nilai diubah dari LUAR', async () => {
    renderDenganTema(<Contoh />);
    await userEvent.type(kotak(), '121');
    expect(kotak().value).toBe('12/1');

    await userEvent.click(screen.getByRole('button', { name: 'set-luar' }));

    await waitFor(() => expect(kotak().value).toBe('03/02/2020'));
    expect(nilai()).toBe('2020-02-03');
  });
});

describe('LabeledTextInput tipe tanggal — pengaturan format', () => {
  /** Klik kanan pada KOTAK (bukan induknya) = buka popover pengaturan. */
  const bukaPengaturan = () => {
    fireEvent.contextMenu(document.getElementById('inp_tgl')?.closest('span')?.parentElement as HTMLElement);
  };
  /** Combobox pola format di dalam popover (id: `<htmlFor>_tipe_format`). */
  const kotakFormat = () => document.getElementById('inp_tgl_tipe_format') as HTMLInputElement;
  /** Buka daftar format lalu pilih satu pola. */
  const pilihFormat = async (nama: string) => {
    await userEvent.click(kotakFormat());
    await userEvent.click(await screen.findByRole('option', { name: nama }));
  };

  it('baris "Format" tampil dengan combobox pola tanggal (bawaan dd/mm/yyyy)', async () => {
    renderDenganTema(<Contoh awal="2026-10-12" />);

    bukaPengaturan();

    expect(await screen.findByText('Format')).not.toBeNull();
    expect(kotakFormat().value).toBe('dd/mm/yyyy');
    // Tanpa pilihan lain, kotaknya tetap seperti semula.
    expect(kotak().value).toBe('12/10/2026');
    expect(kotak().placeholder).toBe('dd/mm/yyyy');
  });

  it('pola lain mengubah tampilan & placeholder kotak, nilai tetap ISO', async () => {
    renderDenganTema(<Contoh awal="2026-10-12" />);
    bukaPengaturan();
    await screen.findByText('Format');

    await pilihFormat('dd-mm-yyyy');

    await waitFor(() => expect(kotak().value).toBe('12-10-2026'));
    expect(kotak().placeholder).toBe('dd-mm-yyyy');
    expect(nilai()).toBe('2026-10-12');
    expect(kotakFormat().value).toBe('dd-mm-yyyy');
  });

  it('mask ketikan ikut pola baru: bulan diketik sebagai nama singkat', async () => {
    renderDenganTema(<Contoh />);
    bukaPengaturan();
    await screen.findByText('Format');
    await pilihFormat('dd Mmm yyyy');

    await userEvent.type(kotak(), '12okt2026');

    await waitFor(() => expect(nilai()).toBe('2026-10-12'));
    expect(kotak().value).toBe('12 Okt 2026');
  });
});

describe('LabeledTextInput tipe tanggal — tombol kalender', () => {
  it('memilih dari kalender menulis ISO ke pemanggil & menampilkannya di kotak', async () => {
    renderDenganTema(<Contoh />);

    await bukaKalender();
    await userEvent.click(await screen.findByRole('button', { name: 'Hari ini' }));

    await waitFor(() => expect(nilai()).toBe(hariIniIso()));
    expect(kotak().value).toBe(tanggalKeTampilan(hariIniIso()));
  });

  it('"Kosongkan" mengosongkan kotak & nilai', async () => {
    renderDenganTema(<Contoh awal="2026-07-14" />);

    await bukaKalender();
    await userEvent.click(await screen.findByRole('button', { name: 'Kosongkan tanggal' }));

    await waitFor(() => expect(nilai()).toBe(''));
    expect(kotak().value).toBe('');
  });

  it('pilihan kalender menimpa sisa ketikan yang belum lengkap', async () => {
    renderDenganTema(<Contoh />);
    await userEvent.type(kotak(), '12/1');

    await bukaKalender();
    await userEvent.click(await screen.findByRole('button', { name: 'Hari ini' }));

    await waitFor(() => expect(kotak().value).toBe(tanggalKeTampilan(hariIniIso())));
    expect(nilai()).toBe(hariIniIso());
  });
});
