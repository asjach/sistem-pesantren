import { useState } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import PopoverKalender from './PopoverKalender';
import { renderDenganTema } from '@/test/utils';
import {
  hariIniIso, jumlahHari, NAMA_BULAN, NAMA_BULAN_SINGKAT, NAMA_HARI_SINGKAT, pecahIso, rakitIso,
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
/** Blok tahun dibuka dengan tahun aktif di TENGAH baris KEDUA: baris pertama
 *  memuat 5 tahun sebelumnya, lalu 2 tahun sebelumnya + tahun aktif + 2 tahun
 *  berikutnya (total 10 tahun = 2 baris × 5). */
const TAHUN_PER_BARIS = 5;
const indeksTahunAktif = TAHUN_PER_BARIS + (TAHUN_PER_BARIS - 1) / 2;
const awalBlokAwal = ini.tahun - indeksTahunAktif;
const nilaiTerpilih = () => document.querySelector('[data-uji="nilai"]')?.textContent;
const panel = (nama: 'kalender_atas' | 'kalender_bawah') =>
  document.querySelector(`[data-panel="${nama}"]`) as HTMLElement | null;
const buka = () => userEvent.click(screen.getByRole('button', { name: 'Pilih tanggal' }));
/** Tombol hari di grid (nama aksesibel "12 Oktober 2026"). */
const hari = (teks: string) => screen.getByRole('button', { name: teks });
const gridTahun = () => screen.getByRole('group', { name: `Tahun ${awalBlokAwal}–${awalBlokAwal + 9}` });
const gridBulan = (tahun: number) => screen.getByRole('group', { name: `Bulan ${tahun}` });
const gridTanggal = (bulan: number, tahun: number) =>
  screen.getByRole('group', { name: `Tanggal ${NAMA_BULAN[bulan - 1]} ${tahun}` });

describe('PopoverKalender — dua panel (seperti panel nominal)', () => {
  it('tombol ber-id tetap + label aksesibel; kedua panel tertutup sebelum diklik', () => {
    renderDenganTema(<Harness />);
    const tombol = document.getElementById('btn_kalender_inp_uji');
    expect(tombol).not.toBeNull();
    expect(tombol?.getAttribute('aria-label')).toBe('Pilih tanggal');
    expect(panel('kalender_atas')).toBeNull();
    expect(panel('kalender_bawah')).toBeNull();
  });

  it('membuka DUA panel: tahun+bulan di atas kotak, tanggal di bawahnya', async () => {
    renderDenganTema(<Harness />);
    await buka();

    await waitFor(() => expect(panel('kalender_atas')).not.toBeNull());
    const atas = panel('kalender_atas') as HTMLElement;
    const bawah = panel('kalender_bawah') as HTMLElement;
    expect(atas.getAttribute('data-side')).toBe('top');
    expect(bawah.getAttribute('data-side')).toBe('bottom');
    for (const p of [atas, bawah]) {
      expect(p.className).toMatch(/pop-kalender/);
      expect(p.className).toMatch(/w-60/);
      expect(p.className).toMatch(/border-foreground\/30/);
    }
  });

  it('semua sel grid seragam 24px (h-6): tahun, bulan, dan tanggal', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('kalender_atas')).not.toBeNull());

    const semuaSel = [
      ...within(gridTahun()).getAllByRole('button'),
      ...within(gridBulan(ini.tahun)).getAllByRole('button'),
      ...within(gridTanggal(ini.bulan, ini.tahun)).getAllByRole('button'),
    ];
    expect(semuaSel.length).toBeGreaterThan(40); // 10 tahun + 12 bulan + hari
    for (const sel of semuaSel) expect(sel.className).toMatch(/h-6/);
  });
});

describe('PopoverKalender — panel atas: tahun & bulan', () => {
  it('tahun: 2 baris × 5, tahun aktif di TENGAH baris KEDUA', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('kalender_atas')).not.toBeNull());

    const grid = gridTahun();
    expect(grid.className).toMatch(/grid-cols-5/);
    const tombolTahun = within(grid).getAllByRole('button');
    expect(tombolTahun).toHaveLength(10);
    expect(tombolTahun.map((t) => t.textContent)).toEqual(
      Array.from({ length: 10 }, (_, i) => String(awalBlokAwal + i)),
    );
    // Tengah baris KEDUA (indeks 5..9) = tahun aktif sistem, ditandai tahun ini.
    expect(tombolTahun[indeksTahunAktif].textContent).toBe(String(ini.tahun));
    expect(tombolTahun[indeksTahunAktif].title).toBe(`${ini.tahun} (tahun ini)`);
    // Dua tahun sebelumnya di kiri, dua berikutnya di kanan.
    expect(tombolTahun[indeksTahunAktif - 1].textContent).toBe(String(ini.tahun - 1));
    expect(tombolTahun[indeksTahunAktif + 1].textContent).toBe(String(ini.tahun + 1));
    // Baris pertama = 5 tahun sebelum blok baris kedua.
    expect(tombolTahun[0].textContent).toBe(String(ini.tahun - 7));
    // Rentang yang tampil ditulis di header panel.
    expect(screen.getByText(`${awalBlokAwal}–${awalBlokAwal + 9}`)).toBeInTheDocument();
  });

  it('bulan: 2 baris × 6, semua bulan dengan nama singkat Jan…Des', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('kalender_atas')).not.toBeNull());

    const grid = gridBulan(ini.tahun);
    expect(grid.className).toMatch(/grid-cols-6/);
    const tombolBulan = within(grid).getAllByRole('button');
    expect(tombolBulan.map((b) => b.textContent)).toEqual([...NAMA_BULAN_SINGKAT]);
    // Nama penuh tetap terbaca pembaca layar.
    expect(within(grid).getByRole('button', { name: `Oktober ${ini.tahun}` })).toBeInTheDocument();
  });

  it('ada pembatas antara grid tahun dan grid bulan', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('kalender_atas')).not.toBeNull());

    const pembatas = within(panel('kalender_atas') as HTMLElement).getByRole('separator');
    expect(pembatas.className).toMatch(/border-foreground\/30/);
    // Letaknya di ANTARA keduanya: setelah grid tahun, sebelum grid bulan.
    expect(gridTahun().compareDocumentPosition(pembatas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pembatas.compareDocumentPosition(gridBulan(ini.tahun)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('border sel tahun & bulan lebih samar (foreground 15%), bukan 30%', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('kalender_atas')).not.toBeNull());

    const selSamar = [
      ...within(gridTahun()).getAllByRole('button'),
      ...within(gridBulan(ini.tahun)).getAllByRole('button'),
    ];
    expect(selSamar).toHaveLength(22); // 10 tahun + 12 bulan
    for (const sel of selSamar) {
      expect(sel.className).toMatch(/border-foreground\/15/);
      // Varian gelap ikut samar (tombol `outline` memasang `dark:border-input`).
      expect(sel.className).toMatch(/dark:border-foreground\/15/);
      expect(sel.className).not.toMatch(/border-foreground\/30/);
    }
    // Tombol lain tak ikut berubah: footer & grid tanggal.
    expect(screen.getByRole('button', { name: 'Hari ini' }).className).not.toMatch(/border-foreground\/15/);
    expect(hari(`${ini.hari} ${NAMA_BULAN[ini.bulan - 1]} ${ini.tahun}`).className).not.toMatch(/border-foreground\/15/);
  });

  it('memilih tahun/bulan hanya memindahkan grid tanggal — nilai belum berubah', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('kalender_atas')).not.toBeNull());

    await userEvent.click(within(gridTahun()).getByRole('button', { name: String(awalBlokAwal + 6) }));
    // Grid tanggal pindah tahun, panel tetap terbuka, nilainya tetap kosong.
    expect(gridTanggal(ini.bulan, awalBlokAwal + 6)).toBeInTheDocument();
    expect(panel('kalender_bawah')).not.toBeNull();
    expect(nilaiTerpilih()).toBe('');

    await userEvent.click(screen.getByRole('button', { name: `Maret ${awalBlokAwal + 6}` }));
    expect(gridTanggal(3, awalBlokAwal + 6)).toBeInTheDocument();
    expect(nilaiTerpilih()).toBe('');
  });

  it('tahun & bulan yang sedang tampil ditandai terpilih', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('kalender_atas')).not.toBeNull());

    expect(within(gridTahun()).getByRole('button', { name: String(ini.tahun) }).getAttribute('data-terpilih')).toBe('ya');
    expect(screen.getByRole('button', { name: `${NAMA_BULAN[ini.bulan - 1]} ${ini.tahun}` }).getAttribute('data-terpilih')).toBe('ya');
  });

  it('menggeser blok tahun 10 tahun sekali', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('kalender_atas')).not.toBeNull());

    await userEvent.click(screen.getByRole('button', { name: '10 tahun sebelumnya' }));
    const mundur = awalBlokAwal - 10;
    expect(screen.getByRole('group', { name: `Tahun ${mundur}–${mundur + 9}` })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '10 tahun berikutnya' }));
    await userEvent.click(screen.getByRole('button', { name: '10 tahun berikutnya' }));
    const maju = awalBlokAwal + 10;
    expect(screen.getByRole('group', { name: `Tahun ${maju}–${maju + 9}` })).toBeInTheDocument();
  });

  it('tahun di luar blok tetap terjangkau (mis. tanggal lahir lama)', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('kalender_atas')).not.toBeNull());

    // 1998 ada 3 blok di belakang blok awal → geser mundur lalu pilih.
    await userEvent.click(screen.getByRole('button', { name: '10 tahun sebelumnya' }));
    await userEvent.click(screen.getByRole('button', { name: '10 tahun sebelumnya' }));
    await userEvent.click(screen.getByRole('button', { name: '10 tahun sebelumnya' }));
    await userEvent.click(screen.getByRole('button', { name: '1998' }));

    await userEvent.click(screen.getByRole('button', { name: 'Mei 1998' }));
    await userEvent.click(hari('20 Mei 1998'));

    expect(nilaiTerpilih()).toBe('1998-05-20');
  });
});

describe('PopoverKalender — panel bawah: tanggal', () => {
  it('grid hari bulan ini: 7 kolom, header minggu dulu, hari ini ditandai', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('kalender_bawah')).not.toBeNull());

    const p = panel('kalender_bawah') as HTMLElement;
    for (const nama of NAMA_HARI_SINGKAT) expect(within(p).getByText(nama)).toBeInTheDocument();
    const grid = gridTanggal(ini.bulan, ini.tahun);
    expect(grid.className).toMatch(/grid-cols-7/);
    expect(within(grid).getAllByRole('button')).toHaveLength(jumlahHari(ini.tahun, ini.bulan));
    expect(hari(`${ini.hari} ${NAMA_BULAN[ini.bulan - 1]} ${ini.tahun}`).getAttribute('aria-current')).toBe('date');
  });

  it('memilih hari menulis ISO ke pemanggil lalu menutup kedua panel', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('kalender_bawah')).not.toBeNull());

    await userEvent.click(hari(`${ini.hari} ${NAMA_BULAN[ini.bulan - 1]} ${ini.tahun}`));

    expect(nilaiTerpilih()).toBe(hariIni);
    await waitFor(() => expect(panel('kalender_atas')).toBeNull());
    expect(panel('kalender_bawah')).toBeNull();
  });

  it('"Hari ini" menulis ISO hari ini; "Kosongkan" mengosongkan nilai', async () => {
    renderDenganTema(<Harness awal="2026-01-05" />);
    await buka();
    await waitFor(() => expect(panel('kalender_bawah')).not.toBeNull());

    await userEvent.click(screen.getByRole('button', { name: 'Hari ini' }));
    expect(nilaiTerpilih()).toBe(hariIni);

    await buka();
    await waitFor(() => expect(panel('kalender_bawah')).not.toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'Kosongkan tanggal' }));
    expect(nilaiTerpilih()).toBe('');
  });

  it('nilai awal: blok tahun & bulan mengikuti, harinya ditandai', async () => {
    renderDenganTema(<Harness awal="1998-05-20" />);
    await buka();
    await waitFor(() => expect(panel('kalender_atas')).not.toBeNull());

    // 1998 jadi acuan blok: 5 tahun sebelumnya di baris pertama, 1998 di
    // tengah baris kedua.
    expect(screen.getByRole('group', { name: 'Tahun 1991–2000' })).toBeInTheDocument();
    expect(within(gridBulan(1998)).getByRole('button', { name: 'Mei 1998' }).getAttribute('data-terpilih')).toBe('ya');
    expect(hari('20 Mei 1998').getAttribute('data-terpilih')).toBe('ya');
  });

  it('nilai yang diubah dari LUAR dipakai saat panel dibuka lagi', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('kalender_atas')).not.toBeNull());

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(panel('kalender_atas')).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'set-luar' }));

    await buka();
    await waitFor(() => expect(screen.getByRole('group', { name: 'Tahun 2016–2025' })).toBeInTheDocument());
    expect(gridTanggal(5, 2023)).toBeInTheDocument();
    expect(hari('20 Mei 2023').getAttribute('data-terpilih')).toBe('ya');
  });

  it('tanggal yang dipilih dari blok lain tetap memakai tahun pilihannya', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('kalender_atas')).not.toBeNull());

    await userEvent.click(screen.getByRole('button', { name: '10 tahun sebelumnya' }));
    const tahunLain = awalBlokAwal - 10;
    await userEvent.click(within(screen.getByRole('group', { name: `Tahun ${tahunLain}–${tahunLain + 9}` }))
      .getByRole('button', { name: String(tahunLain) }));
    await userEvent.click(hari(`1 ${NAMA_BULAN[ini.bulan - 1]} ${tahunLain}`));

    expect(nilaiTerpilih()).toBe(rakitIso(tahunLain, ini.bulan, 1));
  });
});
