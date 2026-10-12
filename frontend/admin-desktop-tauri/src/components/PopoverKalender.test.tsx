import { useState } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import PopoverKalender from './PopoverKalender';
import { renderDenganTema } from '@/test/utils';
import {
  geserBulan, hariIniIso, jumlahHari, NAMA_BULAN, NAMA_BULAN_SINGKAT, NAMA_HARI_SINGKAT, pecahIso, rakitIso,
} from '@/lib/tanggal';

/* Setelan komponen (server) tak dibutuhkan kalender; API-nya dimock agar tak
   ada permintaan jaringan saat render. */
vi.mock('@/api/komponenCustom', () => ({
  muatKomponenCustom: vi.fn(async () => ({ pesan: '', data: { peta: {} } })),
  simpanKomponenCustom: vi.fn(async () => ({ pesan: '', data: {} })),
  hapusKomponenCustom: vi.fn(async () => ({ pesan: '' })),
}));

/** Harness terkontrol seperti pemakaian nyata (`nilai` + `setNilai`), plus
 *  tombol untuk meniru pemanggil yang mengubah nilai dari LUAR. */
function Harness({ awal = '' }: { awal?: string }) {
  const [nilai, setNilai] = useState(awal);
  return (
    <div>
      <PopoverKalender htmlFor="inp_uji" nilai={nilai} setNilai={setNilai} />
      <button type="button" onClick={() => setNilai('2023-05-20')}>set-luar</button>
      <span data-uji="nilai">{nilai}</span>
    </div>
  );
}

const hariIni = hariIniIso();
const ini = pecahIso(hariIni) as { tahun: number; bulan: number; hari: number };
const nilaiTerpilih = () => document.querySelector('[data-uji="nilai"]')?.textContent;
const panel = () => document.querySelector('[data-panel="kalender"]') as HTMLElement | null;
const buka = () => userEvent.click(screen.getByRole('button', { name: 'Pilih tanggal' }));
/** Tombol hari di grid (nama aksesibel "12 Oktober 2026"). */
const hari = (teks: string) => screen.getByRole('button', { name: teks });
const judulBulan = () => screen.getByRole('button', { name: 'Pilih bulan dan tahun' }).textContent;

describe('PopoverKalender — tombol & panel', () => {
  it('tombol ber-id tetap + label aksesibel; panel tertutup sebelum diklik', () => {
    renderDenganTema(<Harness />);
    const tombol = document.getElementById('btn_kalender_inp_uji');
    expect(tombol).not.toBeNull();
    expect(tombol?.getAttribute('aria-label')).toBe('Pilih tanggal');
    expect(panel()).toBeNull();
  });

  it('dibuka di grid hari bulan ini: panel menempel pada kotak, 7 kolom, hari ini ditandai', async () => {
    renderDenganTema(<Harness />);
    await buka();

    await waitFor(() => expect(panel()).not.toBeNull());
    const p = panel() as HTMLElement;
    expect(p.className).toMatch(/pop-kalender/);
    expect(p.className).toMatch(/w-60/);
    expect(p.className).toMatch(/border-foreground\/30/);
    expect(p.getAttribute('data-side')).toBe('bottom');

    // Header: nama bulan + tahun yang sedang dilihat.
    expect(judulBulan()).toBe(`${NAMA_BULAN[ini.bulan - 1]} ${ini.tahun}`);
    // Header kolom minggu dulu, 7 kolom.
    for (const nama of NAMA_HARI_SINGKAT) expect(within(p).getByText(nama)).toBeInTheDocument();
    // Seluruh hari bulan ini ada.
    expect(within(p).getAllByRole('button', { name: new RegExp(` ${NAMA_BULAN[ini.bulan - 1]} ${ini.tahun}$`) }))
      .toHaveLength(jumlahHari(ini.tahun, ini.bulan));
    // Hari ini ditandai supaya mudah ditemukan.
    expect(hari(`${ini.hari} ${NAMA_BULAN[ini.bulan - 1]} ${ini.tahun}`).getAttribute('aria-current')).toBe('date');
  });

  it('memilih hari menulis ISO ke pemanggil lalu menutup panel', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());

    await userEvent.click(hari(`${ini.hari} ${NAMA_BULAN[ini.bulan - 1]} ${ini.tahun}`));

    expect(nilaiTerpilih()).toBe(hariIni);
    await waitFor(() => expect(panel()).toBeNull());
  });

  it('navigasi bulan: maju satu bulan menampilkan bulan berikutnya', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());

    await userEvent.click(screen.getByRole('button', { name: 'Bulan berikutnya' }));

    const depan = geserBulan(ini.tahun, ini.bulan, 1);
    await waitFor(() => expect(judulBulan()).toBe(`${NAMA_BULAN[depan.bulan - 1]} ${depan.tahun}`));
    // Hari pertama bulan depan bisa langsung dipilih.
    await userEvent.click(hari(`1 ${NAMA_BULAN[depan.bulan - 1]} ${depan.tahun}`));
    expect(nilaiTerpilih()).toBe(rakitIso(depan.tahun, depan.bulan, 1));

    // Dan mundur dua bulan dari posisi baru.
    await buka();
    await userEvent.click(screen.getByRole('button', { name: 'Bulan sebelumnya' }));
    const belakang = geserBulan(depan.tahun, depan.bulan, -1);
    await waitFor(() => expect(judulBulan()).toBe(`${NAMA_BULAN[belakang.bulan - 1]} ${belakang.tahun}`));
  });

  it('pilih bulan & tahun lewat tampilan bulan', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());

    await userEvent.click(screen.getByRole('button', { name: 'Pilih bulan dan tahun' }));
    // Grid 12 bulan + navigasi tahun.
    expect(screen.getByRole('button', { name: `Januari ${ini.tahun}` })).toBeInTheDocument();
    expect(within(panel() as HTMLElement).getAllByText(NAMA_BULAN_SINGKAT[0]).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: `Januari ${ini.tahun}` }));

    // Kembali ke grid hari bulan Januari, dan tanggalnya bisa dipilih.
    await waitFor(() => expect(judulBulan()).toBe(`Januari ${ini.tahun}`));
    await userEvent.click(hari(`15 Januari ${ini.tahun}`));
    expect(nilaiTerpilih()).toBe(`${ini.tahun}-01-15`);
  });

  it('navigasi tahun di tampilan bulan', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'Pilih bulan dan tahun' }));

    await userEvent.click(screen.getByRole('button', { name: 'Tahun sebelumnya' }));
    expect(screen.getByRole('button', { name: `Januari ${ini.tahun - 1}` })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tahun berikutnya' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tahun berikutnya' }));
    expect(screen.getByRole('button', { name: `Januari ${ini.tahun + 1}` })).toBeInTheDocument();
  });

  it('"Hari ini" menulis ISO hari ini; "Kosongkan" mengosongkan nilai', async () => {
    renderDenganTema(<Harness awal="2026-01-05" />);
    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());

    await userEvent.click(screen.getByRole('button', { name: 'Hari ini' }));
    expect(nilaiTerpilih()).toBe(hariIni);

    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'Kosongkan tanggal' }));
    expect(nilaiTerpilih()).toBe('');
  });

  it('dibuka pada bulan nilai terpilih, dan hari terpilih ditandai', async () => {
    renderDenganTema(<Harness awal="2024-03-09" />);
    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());

    expect(judulBulan()).toBe('Maret 2024');
    expect(hari('9 Maret 2024').getAttribute('data-terpilih')).toBe('ya');
  });

  it('nilai yang diubah dari LUAR dipakai saat panel dibuka lagi', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(judulBulan()).toBe(`${NAMA_BULAN[ini.bulan - 1]} ${ini.tahun}`));

    // Klik di luar menutup panel (perilaku Radix) — sama seperti pemakaian nyata.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(panel()).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'set-luar' }));

    await buka();
    await waitFor(() => expect(judulBulan()).toBe('Mei 2023'));
    expect(hari('20 Mei 2023').getAttribute('data-terpilih')).toBe('ya');
  });
});
