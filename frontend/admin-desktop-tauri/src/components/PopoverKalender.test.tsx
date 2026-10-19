import { useState } from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import PopoverKalender from './PopoverKalender';
import { renderDenganTema } from '@/test/utils';
import {
  hariIniIso, jumlahHari, NAMA_BULAN, NAMA_BULAN_SINGKAT, NAMA_HARI_SINGKAT, pecahIso, rakitIso,
} from '@/lib/tanggal';

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
/** Blok tahun dibuka dengan tahun aktif di TENGAH baris PALING BAWAH: tiga baris
 *  di atasnya memuat 15 tahun sebelumnya, lalu baris terakhir berisi 2 tahun
 *  sebelumnya + tahun aktif + 2 tahun berikutnya (total 20 tahun = 4 baris × 5). */
const TAHUN_PER_BARIS = 5;
const BARIS_TAHUN = 4;
const TAHUN_PER_BLOK = TAHUN_PER_BARIS * BARIS_TAHUN;
const indeksTahunAktif = (BARIS_TAHUN - 1) * TAHUN_PER_BARIS + (TAHUN_PER_BARIS - 1) / 2;
const awalBlokAwal = ini.tahun - indeksTahunAktif;
const nilaiTerpilih = () => document.querySelector('[data-uji="nilai"]')?.textContent;
const panel = () =>
  document.querySelector('[data-panel="kalender"]') as HTMLElement | null;
const buka = () => userEvent.click(screen.getByRole('button', { name: 'Pilih tanggal' }));
/** Tombol hari di grid (nama aksesibel "12 Oktober 2026"). */
const hari = (teks: string) => screen.getByRole('button', { name: teks });
const gridTahun = () =>
  screen.getByRole('group', { name: `Tahun ${awalBlokAwal}–${awalBlokAwal + TAHUN_PER_BLOK - 1}` });
/** Grid tahun untuk blok yang MULAI di `mulai` (20 tahun). */
const lihatRentang = (mulai: number) =>
  screen.getByRole('group', { name: `Tahun ${mulai}–${mulai + TAHUN_PER_BLOK - 1}` });
/** Grid TAHUN aktif apa pun rentangnya (labelnya ikut bergeser saat digulir,
 *  jadi tidak bisa dipakai sebagai pencari setelah rentangnya berubah). */
const gridTahunAktif = () => document.querySelector<HTMLElement>('[role="group"][aria-label^="Tahun "]');
const gridBulan = (tahun: number) => screen.getByRole('group', { name: `Bulan ${tahun}` });
const gridTanggal = (bulan: number, tahun: number) =>
  screen.getByRole('group', { name: `Tanggal ${NAMA_BULAN[bulan - 1]} ${tahun}` });

describe('PopoverKalender — satu panel (tahun + bulan + tanggal)', () => {
  it('tombol ber-id tetap + label aksesibel; panel tertutup sebelum diklik', () => {
    renderDenganTema(<Harness />);
    const tombol = document.getElementById('btn_kalender_inp_uji');
    expect(tombol).not.toBeNull();
    expect(tombol?.getAttribute('aria-label')).toBe('Pilih tanggal');
    expect(panel()).toBeNull();
  });

  it('membuka SATU panel di bawah kotak: tahun, bulan, dan tanggal sekaligus', async () => {
    renderDenganTema(<Harness />);
    await buka();

    await waitFor(() => expect(panel()).not.toBeNull());
    const p = panel() as HTMLElement;
    expect(p.getAttribute('data-side')).toBe('bottom');
    expect(p.className).toMatch(/pop-kalender/);
    expect(p.className).toMatch(/w-60/);
    expect(p.className).toMatch(/border-foreground\/30/);
  });

  it('semua sel grid seragam 24px (h-6): tahun, bulan, dan tanggal', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());

    const semuaSel = [
      ...within(gridTahun()).getAllByRole('button'),
      ...within(gridBulan(ini.tahun)).getAllByRole('button'),
      ...within(gridTanggal(ini.bulan, ini.tahun)).getAllByRole('button'),
    ];
    expect(semuaSel.length).toBeGreaterThan(40);
    for (const sel of semuaSel) expect(sel.className).toMatch(/h-6/);
  });
});

describe('PopoverKalender — bagian tahun & bulan', () => {
  it('tahun: 4 baris × 5, tahun aktif di TENGAH baris PALING BAWAH', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());

    const grid = gridTahun();
    expect(grid.className).toMatch(/grid-cols-5/);
    const tombolTahun = within(grid).getAllByRole('button');
    expect(tombolTahun).toHaveLength(TAHUN_PER_BLOK);
    expect(TAHUN_PER_BLOK).toBe(20);
    expect(tombolTahun.map((t) => t.textContent)).toEqual(
      Array.from({ length: TAHUN_PER_BLOK }, (_, i) => String(awalBlokAwal + i)),
    );

    expect(tombolTahun[indeksTahunAktif].textContent).toBe(String(ini.tahun));
    expect(tombolTahun[indeksTahunAktif].title).toBe(`${ini.tahun} (tahun ini)`);
    expect(tombolTahun[indeksTahunAktif - 1].textContent).toBe(String(ini.tahun - 1));
    expect(tombolTahun[indeksTahunAktif + 1].textContent).toBe(String(ini.tahun + 1));
    expect(tombolTahun[TAHUN_PER_BLOK - TAHUN_PER_BARIS].textContent).toBe(String(ini.tahun - 2));
    expect(tombolTahun[TAHUN_PER_BLOK - 1].textContent).toBe(String(ini.tahun + 2));

    expect(tombolTahun[0].textContent).toBe(String(ini.tahun - 17));

    expect(screen.getByText(`${awalBlokAwal}–${awalBlokAwal + TAHUN_PER_BLOK - 1}`)).toBeInTheDocument();
  });

  it('bulan: 2 baris × 6, semua bulan dengan nama singkat Jan…Des', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());

    const grid = gridBulan(ini.tahun);
    expect(grid.className).toMatch(/grid-cols-6/);
    const tombolBulan = within(grid).getAllByRole('button');
    expect(tombolBulan.map((b) => b.textContent)).toEqual([...NAMA_BULAN_SINGKAT]);

    expect(within(grid).getByRole('button', { name: `Oktober ${ini.tahun}` })).toBeInTheDocument();
  });

  it('ada pembatas tahun–bulan dan bulan–tanggal', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());

    const pembatas = within(panel() as HTMLElement).getAllByRole('separator');
    expect(pembatas).toHaveLength(2);
    for (const p of pembatas) expect(p.className).toMatch(/border-foreground\/30/);

    expect(gridTahun().compareDocumentPosition(pembatas[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pembatas[0].compareDocumentPosition(gridBulan(ini.tahun)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pembatas[1].compareDocumentPosition(gridTanggal(ini.bulan, ini.tahun)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('border sel tahun & bulan lebih samar (15% terang, 8% gelap)', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());

    const selSamar = [
      ...within(gridTahun()).getAllByRole('button'),
      ...within(gridBulan(ini.tahun)).getAllByRole('button'),
    ];
    expect(selSamar).toHaveLength(TAHUN_PER_BLOK + 12);
    for (const sel of selSamar) {
      expect(sel.className).toMatch(/border-foreground\/15/);

      expect(sel.className).toMatch(/dark:border-foreground\/8/);
      expect(sel.className).not.toMatch(/border-foreground\/30/);
    }

    expect(screen.getByRole('button', { name: 'Hari ini' }).className).not.toMatch(/border-foreground\/15/);
    expect(hari(`${ini.hari} ${NAMA_BULAN[ini.bulan - 1]} ${ini.tahun}`).className).not.toMatch(/border-foreground\/15/);
  });

  it('memilih tahun/bulan hanya memindahkan grid tanggal — nilai belum berubah', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());

    await userEvent.click(within(gridTahun()).getByRole('button', { name: String(awalBlokAwal + 6) }));

    expect(gridTanggal(ini.bulan, awalBlokAwal + 6)).toBeInTheDocument();
    expect(panel()).not.toBeNull();
    expect(nilaiTerpilih()).toBe('');

    await userEvent.click(screen.getByRole('button', { name: `Maret ${awalBlokAwal + 6}` }));
    expect(gridTanggal(3, awalBlokAwal + 6)).toBeInTheDocument();
    expect(nilaiTerpilih()).toBe('');
  });

  it('tahun & bulan yang sedang tampil ditandai terpilih', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());

    expect(within(gridTahun()).getByRole('button', { name: String(ini.tahun) }).getAttribute('data-terpilih')).toBe('ya');
    expect(screen.getByRole('button', { name: `${NAMA_BULAN[ini.bulan - 1]} ${ini.tahun}` }).getAttribute('data-terpilih')).toBe('ya');
  });

  it('gulir mouse menggeser daftar tahun SATU BARIS (5 tahun), bukan seblok 20 tahun', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());

    fireEvent.wheel(gridTahunAktif() as HTMLElement, { deltaY: 100 });
    expect(lihatRentang(awalBlokAwal + TAHUN_PER_BARIS)).toBeInTheDocument();

    fireEvent.wheel(gridTahunAktif() as HTMLElement, { deltaY: 100 });
    fireEvent.wheel(gridTahunAktif() as HTMLElement, { deltaY: 100 });
    expect(lihatRentang(awalBlokAwal + 3 * TAHUN_PER_BARIS)).toBeInTheDocument();

    fireEvent.wheel(gridTahunAktif() as HTMLElement, { deltaY: -100 });
    expect(lihatRentang(awalBlokAwal + 2 * TAHUN_PER_BARIS)).toBeInTheDocument();
  });

  it('gulir di atas daftar tahun tidak ikut menggeser halaman', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());

    const ev = fireEvent.wheel(gridTahunAktif() as HTMLElement, { deltaY: 100, cancelable: true });

    expect(ev).toBe(false);
    expect(lihatRentang(awalBlokAwal + TAHUN_PER_BARIS)).toBeInTheDocument();
  });

  it('tanpa mouse: PageUp/PageDown satu baris, Home kembali ke tahun aktif', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());
    const grid = gridTahunAktif() as HTMLElement;

    fireEvent.keyDown(grid, { key: 'PageDown' });
    expect(lihatRentang(awalBlokAwal + TAHUN_PER_BARIS)).toBeInTheDocument();
    fireEvent.keyDown(grid, { key: 'PageUp' });
    expect(lihatRentang(awalBlokAwal)).toBeInTheDocument();

    fireEvent.keyDown(grid, { key: 'PageDown' });
    fireEvent.keyDown(grid, { key: 'PageDown' });
    fireEvent.keyDown(grid, { key: 'PageDown' });
    expect(lihatRentang(awalBlokAwal + 3 * TAHUN_PER_BARIS)).toBeInTheDocument();
    fireEvent.keyDown(grid, { key: 'Home' });
    expect(lihatRentang(awalBlokAwal)).toBeInTheDocument();
  });

  it('tahun di luar blok tetap terjangkau (mis. tanggal lahir lama)', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());

    const langkah = Math.ceil((awalBlokAwal - 1998) / TAHUN_PER_BARIS);
    for (let i = 0; i < langkah; i += 1) {
      fireEvent.wheel(gridTahunAktif() as HTMLElement, { deltaY: -100 });
    }
    await userEvent.click(screen.getByRole('button', { name: '1998' }));

    await userEvent.click(screen.getByRole('button', { name: 'Mei 1998' }));
    await userEvent.click(hari('20 Mei 1998'));

    expect(nilaiTerpilih()).toBe('1998-05-20');
  });

  it('gulir mouse berhenti di batas 1900 & 2100 (tak keluar rentang)', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());
    const grid = gridTahunAktif() as HTMLElement;

    for (let i = 0; i < 100; i += 1) fireEvent.wheel(grid, { deltaY: -100 });
    expect(lihatRentang(1900)).toBeInTheDocument();
    const tahunBawah = within(grid).getAllByRole('button').map((b) => Number(b.textContent));
    expect(Math.min(...tahunBawah)).toBe(1900);

    fireEvent.wheel(grid, { deltaY: -100 });
    expect(lihatRentang(1900)).toBeInTheDocument();

    for (let i = 0; i < 100; i += 1) fireEvent.wheel(grid, { deltaY: 100 });
    expect(lihatRentang(2081)).toBeInTheDocument();
    const tahunAtas = within(grid).getAllByRole('button').map((b) => Number(b.textContent));
    expect(Math.max(...tahunAtas)).toBe(2100);
    fireEvent.wheel(grid, { deltaY: 100 });
    expect(lihatRentang(2081)).toBeInTheDocument();
  });

  it('nilai di batas bawah 1900 dari luar tetap dalam rentang blok', async () => {

    renderDenganTema(<Harness awal="1900-05-20" />);
    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());
    expect(screen.getByRole('group', { name: 'Tahun 1900–1919' })).toBeInTheDocument();
    expect((within(gridTahunAktif() as HTMLElement).getByRole('button', { name: '1900' }).getAttribute('data-terpilih'))).toBe('ya');
  });

  it('nilai di batas atas 2100 dari luar tetap dalam rentang blok', async () => {

    renderDenganTema(<Harness awal="2100-05-20" />);
    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());
    expect(screen.getByRole('group', { name: 'Tahun 2081–2100' })).toBeInTheDocument();
    expect((within(gridTahunAktif() as HTMLElement).getByRole('button', { name: '2100' }).getAttribute('data-terpilih'))).toBe('ya');
  });
});

describe('PopoverKalender — bagian tanggal', () => {
  it('grid hari bulan ini: 7 kolom, header minggu dulu, hari ini ditandai', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());

    const p = panel() as HTMLElement;
    for (const nama of NAMA_HARI_SINGKAT) expect(within(p).getByText(nama)).toBeInTheDocument();
    const grid = gridTanggal(ini.bulan, ini.tahun);
    expect(grid.className).toMatch(/grid-cols-7/);
    expect(within(grid).getAllByRole('button')).toHaveLength(jumlahHari(ini.tahun, ini.bulan));
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

  it('nilai awal: blok tahun & bulan mengikuti, harinya ditandai', async () => {
    renderDenganTema(<Harness awal="1998-05-20" />);
    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());

    expect(screen.getByRole('group', { name: 'Tahun 1981–2000' })).toBeInTheDocument();
    expect(within(gridBulan(1998)).getByRole('button', { name: 'Mei 1998' }).getAttribute('data-terpilih')).toBe('ya');
    expect(hari('20 Mei 1998').getAttribute('data-terpilih')).toBe('ya');
  });

  it('nilai yang diubah dari LUAR dipakai saat panel dibuka lagi', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(panel()).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'set-luar' }));

    await buka();
    await waitFor(() => expect(screen.getByRole('group', { name: 'Tahun 2006–2025' })).toBeInTheDocument());
    expect(gridTanggal(5, 2023)).toBeInTheDocument();
    expect(hari('20 Mei 2023').getAttribute('data-terpilih')).toBe('ya');
  });

  it('tanggal yang dipilih dari tahun lain tetap memakai tahun pilihannya', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel()).not.toBeNull());

    fireEvent.wheel(gridTahun(), { deltaY: -100 });
    const tahunLain = awalBlokAwal - TAHUN_PER_BARIS;
    await userEvent.click(within(screen.getByRole('group', { name: `Tahun ${tahunLain}–${tahunLain + TAHUN_PER_BLOK - 1}` }))
      .getByRole('button', { name: String(tahunLain) }));
    await userEvent.click(hari(`1 ${NAMA_BULAN[ini.bulan - 1]} ${tahunLain}`));

    expect(nilaiTerpilih()).toBe(rakitIso(tahunLain, ini.bulan, 1));
  });
});
