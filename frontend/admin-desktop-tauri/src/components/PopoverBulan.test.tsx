import { useState } from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import PopoverBulan from './PopoverBulan';
import { renderDenganTema } from '@/test/utils';
import { bulanIni, NAMA_BULAN, NAMA_BULAN_SINGKAT, pecahBulan, rakitBulan } from '@/lib/tanggal';

/* Setelan komponen (server) tak dibutuhkan pemilih bulan; API-nya dimock agar
   tak ada permintaan jaringan saat render. */
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
      <PopoverBulan htmlFor="inp_uji" nilai={nilai} setNilai={setNilai} />
      <button type="button" onClick={() => setNilai('1998-05')}>set-luar</button>
      <span data-uji="nilai">{nilai}</span>
    </div>
  );
}

const ini = pecahBulan(bulanIni()) as { tahun: number; bulan: number };
/** Blok tahun dibuka dengan tahun aktif di TENGAH baris PALING BAWAH: satu baris
 *  di atasnya memuat 5 tahun sebelumnya, lalu baris terakhir berisi 2 tahun
 *  sebelumnya + tahun aktif + 2 tahun berikutnya (total 10 tahun = 2 baris × 5). */
const TAHUN_PER_BARIS = 5;
const BARIS_TAHUN = 2;
const TAHUN_PER_BLOK = TAHUN_PER_BARIS * BARIS_TAHUN;
const indeksTahunAktif = (BARIS_TAHUN - 1) * TAHUN_PER_BARIS + (TAHUN_PER_BARIS - 1) / 2;
const awalBlokAwal = ini.tahun - indeksTahunAktif;
const nilaiTerpilih = () => document.querySelector('[data-uji="nilai"]')?.textContent;
const panel = (nama: 'bulan_atas' | 'bulan_bawah') =>
  document.querySelector(`[data-panel="${nama}"]`) as HTMLElement | null;
const buka = () => userEvent.click(screen.getByRole('button', { name: 'Pilih bulan' }));
const gridTahun = () => gridTahunAktif() as HTMLElement;
/** Grid TAHUN aktif apa pun rentangnya (labelnya ikut bergeser saat digulir). */
const gridTahunAktif = () =>
  document.querySelector<HTMLElement>('[role="group"][aria-label^="Tahun "]');
/** Grid tahun untuk blok yang MULAI di `mulai` (10 tahun). */
const lihatRentang = (mulai: number) =>
  screen.getByRole('group', { name: `Tahun ${mulai}–${mulai + TAHUN_PER_BLOK - 1}` });
const gridBulan = (tahun: number) => screen.getByRole('group', { name: `Bulan ${tahun}` });
/** Tombol bulan dengan nama aksesibel penuh (mis. "Oktober 2026"). */
const bulan = (teks: string) => screen.getByRole('button', { name: teks });

describe('PopoverBulan — dua panel (seperti panel kalender)', () => {
  it('tombol ber-id tetap + label aksesibel; kedua panel tertutup sebelum diklik', () => {
    renderDenganTema(<Harness />);

    const tombol = document.getElementById('btn_bulan_inp_uji');
    expect(tombol).not.toBeNull();
    expect(tombol?.getAttribute('aria-label')).toBe('Pilih bulan');
    expect(panel('bulan_atas')).toBeNull();
    expect(panel('bulan_bawah')).toBeNull();
  });

  it('membuka DUA panel: tahun di atas kotak, nama bulan di bawahnya', async () => {
    renderDenganTema(<Harness />);
    await buka();

    await waitFor(() => expect(panel('bulan_atas')).not.toBeNull());
    const atas = panel('bulan_atas') as HTMLElement;
    const bawah = panel('bulan_bawah') as HTMLElement;
    expect(atas.getAttribute('data-side')).toBe('top');
    expect(bawah.getAttribute('data-side')).toBe('bottom');
    for (const p of [atas, bawah]) {
      expect(p.className).toMatch(/pop-bulan/);
      expect(p.className).toMatch(/w-60/);
      expect(p.className).toMatch(/border-foreground\/30/);
    }
  });

  it('semua sel seragam 24px (h-6): tahun & bulan', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('bulan_atas')).not.toBeNull());

    const semuaSel = [
      ...within(gridTahun()).getAllByRole('button'),
      ...within(gridBulan(ini.tahun)).getAllByRole('button'),
    ];
    expect(semuaSel).toHaveLength(TAHUN_PER_BLOK + 12); // 10 tahun + 12 bulan
    for (const sel of semuaSel) expect(sel.className).toMatch(/h-6/);
  });
});

describe('PopoverBulan — panel atas: tahun', () => {
  it('2 baris × 5, tahun aktif di TENGAH baris PALING BAWAH', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('bulan_atas')).not.toBeNull());

    const grid = gridTahun();
    expect(grid.className).toMatch(/grid-cols-5/);
    const tombolTahun = within(grid).getAllByRole('button');
    expect(tombolTahun).toHaveLength(TAHUN_PER_BLOK);
    expect(TAHUN_PER_BLOK).toBe(10);
    expect(tombolTahun.map((t) => t.textContent)).toEqual(
      Array.from({ length: TAHUN_PER_BLOK }, (_, i) => String(awalBlokAwal + i)),
    );
    // Baris terakhir (indeks 5..9) = 2 tahun sebelumnya + tahun aktif + 2 berikutnya.
    expect(tombolTahun[indeksTahunAktif].textContent).toBe(String(ini.tahun));
    expect(tombolTahun[indeksTahunAktif].title).toBe(`${ini.tahun} (tahun ini)`);
    expect(tombolTahun[indeksTahunAktif - 1].textContent).toBe(String(ini.tahun - 1));
    expect(tombolTahun[indeksTahunAktif + 1].textContent).toBe(String(ini.tahun + 1));
    expect(tombolTahun[TAHUN_PER_BLOK - TAHUN_PER_BARIS].textContent).toBe(String(ini.tahun - 2));
    expect(tombolTahun[TAHUN_PER_BLOK - 1].textContent).toBe(String(ini.tahun + 2));
    // Baris di atasnya = 5 tahun sebelumnya.
    expect(tombolTahun[0].textContent).toBe(String(ini.tahun - 7));
    // Rentang yang tampil ditulis di header panel.
    expect(screen.getByText(`${awalBlokAwal}–${awalBlokAwal + TAHUN_PER_BLOK - 1}`)).toBeInTheDocument();
  });

  it('memilih tahun hanya memindahkan grid bulan — nilai belum berubah', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('bulan_atas')).not.toBeNull());

    await userEvent.click(within(gridTahun()).getByRole('button', { name: String(awalBlokAwal + 3) }));

    // Tahun yang diklik jadi acuan: ia duduk di tengah baris paling bawah, dan
    // grid bulan berpindah ke tahun itu — panel tetap terbuka, nilai tetap kosong.
    expect(screen.getByRole('group', { name: `Tahun ${awalBlokAwal + 3 - indeksTahunAktif}–${awalBlokAwal + 3 - indeksTahunAktif + TAHUN_PER_BLOK - 1}` })).toBeInTheDocument();
    expect(gridBulan(awalBlokAwal + 3)).toBeInTheDocument();
    expect(panel('bulan_bawah')).not.toBeNull();
    expect(nilaiTerpilih()).toBe('');
  });

  it('tahun & bulan yang sedang berlaku ditandai terpilih', async () => {
    renderDenganTema(<Harness awal="1998-05" />);
    await buka();
    await waitFor(() => expect(panel('bulan_atas')).not.toBeNull());

    expect(within(gridTahun()).getByRole('button', { name: '1998' }).getAttribute('data-terpilih')).toBe('ya');
    expect(bulan('Mei 1998').getAttribute('data-terpilih')).toBe('ya');
    // Tahun lain tak ikut ditandai.
    expect(within(gridTahun()).getByRole('button', { name: '1999' }).getAttribute('data-terpilih')).toBeNull();
  });

  it('gulir mouse menggeser daftar tahun SATU BARIS (5 tahun)', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('bulan_atas')).not.toBeNull());

    // Satu gulungan ke bawah = satu baris (5 tahun berikutnya) — sekaligus
    // berarti MEMILIH tahun itu, karena grid bulan mengikutinya.
    fireEvent.wheel(gridTahunAktif() as HTMLElement, { deltaY: 100 });
    expect(lihatRentang(awalBlokAwal + TAHUN_PER_BARIS)).toBeInTheDocument();
    expect(gridBulan(ini.tahun + TAHUN_PER_BARIS)).toBeInTheDocument();

    // Dua gulungan lagi = dua baris (total +15 tahun), BUKAN seblok 10 tahun.
    fireEvent.wheel(gridTahunAktif() as HTMLElement, { deltaY: 100 });
    fireEvent.wheel(gridTahunAktif() as HTMLElement, { deltaY: 100 });
    expect(lihatRentang(awalBlokAwal + 3 * TAHUN_PER_BARIS)).toBeInTheDocument();

    // Gulir ke atas kembali satu baris.
    fireEvent.wheel(gridTahunAktif() as HTMLElement, { deltaY: -100 });
    expect(lihatRentang(awalBlokAwal + 2 * TAHUN_PER_BARIS)).toBeInTheDocument();
  });

  it('gulir di atas daftar tahun tidak ikut menggeser halaman', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('bulan_atas')).not.toBeNull());

    // `cancelable: true` + listener non-pasif → preventDefault benar-benar
    // dipanggil (`fireEvent` mengembalikan false saat event dibatalkan).
    const ev = fireEvent.wheel(gridTahunAktif() as HTMLElement, { deltaY: 100, cancelable: true });

    expect(ev).toBe(false);
    expect(lihatRentang(awalBlokAwal + TAHUN_PER_BARIS)).toBeInTheDocument();
  });

  it('tanpa mouse: PageUp/PageDown satu baris, Home kembali ke tahun berlaku', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('bulan_atas')).not.toBeNull());
    const grid = gridTahunAktif() as HTMLElement;

    fireEvent.keyDown(grid, { key: 'PageDown' });
    expect(lihatRentang(awalBlokAwal + TAHUN_PER_BARIS)).toBeInTheDocument();
    fireEvent.keyDown(grid, { key: 'PageUp' });
    expect(lihatRentang(awalBlokAwal)).toBeInTheDocument();

    // Jauh ke bawah, lalu Home → kembali ke blok tahun berlaku.
    fireEvent.keyDown(grid, { key: 'PageDown' });
    fireEvent.keyDown(grid, { key: 'PageDown' });
    fireEvent.keyDown(grid, { key: 'PageDown' });
    expect(lihatRentang(awalBlokAwal + 3 * TAHUN_PER_BARIS)).toBeInTheDocument();
    fireEvent.keyDown(grid, { key: 'Home' });
    expect(lihatRentang(awalBlokAwal)).toBeInTheDocument();
  });

  it('tahun jauh tetap terjangkau (mis. periode lama)', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('bulan_atas')).not.toBeNull());

    // 1998 ada beberapa baris di belakang; geser ke atas sebanyak yang perlu
    // (satu gulungan = satu baris) lalu pilih.
    const langkah = Math.ceil((awalBlokAwal - 1998) / TAHUN_PER_BARIS);
    for (let i = 0; i < langkah; i += 1) {
      fireEvent.wheel(gridTahunAktif() as HTMLElement, { deltaY: -100 });
    }
    await userEvent.click(screen.getByRole('button', { name: '1998' }));
    await userEvent.click(bulan('Mei 1998'));

    expect(nilaiTerpilih()).toBe('1998-05');
  });

  it('gulir mouse berhenti di batas 1900 & 2100 (tak keluar rentang)', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('bulan_atas')).not.toBeNull());
    const grid = gridTahunAktif() as HTMLElement;

    // Gulir ke atas berkali-kali → berhenti di batas bawah 1900–1909.
    for (let i = 0; i < 100; i += 1) fireEvent.wheel(grid, { deltaY: -100 });
    expect(lihatRentang(1900)).toBeInTheDocument();
    const tahunBawah = within(grid).getAllByRole('button').map((b) => Number(b.textContent));
    expect(Math.min(...tahunBawah)).toBe(1900);
    // Gulir ke atas lagi tak mengubah apa-apa (tetap di 1900).
    fireEvent.wheel(grid, { deltaY: -100 });
    expect(lihatRentang(1900)).toBeInTheDocument();

    // Gulir ke bawah berkali-kali → berhenti di batas atas 2091–2100.
    for (let i = 0; i < 100; i += 1) fireEvent.wheel(grid, { deltaY: 100 });
    expect(lihatRentang(2091)).toBeInTheDocument();
    const tahunAtas = within(grid).getAllByRole('button').map((b) => Number(b.textContent));
    expect(Math.max(...tahunAtas)).toBe(2100);
    fireEvent.wheel(grid, { deltaY: 100 });
    expect(lihatRentang(2091)).toBeInTheDocument();
  });

  it('nilai di batas bawah 1900 dari luar tetap dalam rentang blok', async () => {
    // 1900 di luar blok alami (awalBlokUntuk = 1893) → dibatas ke 1900–1909.
    renderDenganTema(<Harness awal="1900-05" />);
    await buka();
    await waitFor(() => expect(panel('bulan_atas')).not.toBeNull());

    expect(screen.getByRole('group', { name: 'Tahun 1900–1909' })).toBeInTheDocument();
    expect(within(gridTahun()).getByRole('button', { name: '1900' }).getAttribute('data-terpilih')).toBe('ya');
  });

  it('nilai di batas atas 2100 dari luar tetap dalam rentang blok', async () => {
    // 2100 di luar blok alami (awalBlokUntuk = 2093) → dibatas ke 2091–2100.
    renderDenganTema(<Harness awal="2100-05" />);
    await buka();
    await waitFor(() => expect(panel('bulan_atas')).not.toBeNull());

    expect(screen.getByRole('group', { name: 'Tahun 2091–2100' })).toBeInTheDocument();
    expect(within(gridTahun()).getByRole('button', { name: '2100' }).getAttribute('data-terpilih')).toBe('ya');
  });
});

describe('PopoverBulan — panel bawah: nama bulan', () => {
  it('2 baris × 6, Jan…Des untuk tahun yang dipilih, tahunnya ditulis di panel', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('bulan_bawah')).not.toBeNull());

    const grid = gridBulan(ini.tahun);
    expect(grid.className).toMatch(/grid-cols-6/);
    const tombolBulan = within(grid).getAllByRole('button');
    expect(tombolBulan.map((b) => b.textContent)).toEqual([...NAMA_BULAN_SINGKAT]);
    // Nama penuh tetap terbaca pembaca layar.
    expect(bulan(`Oktober ${ini.tahun}`)).toBeInTheDocument();
    // Tahun acuan ditulis di panel ini juga (gridnya bisa jauh dari tahun ini).
    expect(within(panel('bulan_bawah') as HTMLElement).getByText(`Bulan ${ini.tahun}`)).toBeInTheDocument();
  });

  it('memilih bulan menulis YYYY-MM ke pemanggil lalu menutup kedua panel', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('bulan_bawah')).not.toBeNull());

    await userEvent.click(bulan(`Januari ${ini.tahun}`));

    expect(nilaiTerpilih()).toBe(rakitBulan(ini.tahun, 1));
    await waitFor(() => expect(panel('bulan_atas')).toBeNull());
    expect(panel('bulan_bawah')).toBeNull();
  });

  it('"Bulan ini" menulis bulan berjalan — pada TAHUNNYA sendiri', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('bulan_bawah')).not.toBeNull());

    // Telusuri dulu ke tahun lain, supaya terbukti footer tak memakai tahun itu.
    fireEvent.wheel(gridTahunAktif() as HTMLElement, { deltaY: -100 });
    await userEvent.click(screen.getByRole('button', { name: 'Bulan ini' }));

    expect(nilaiTerpilih()).toBe(bulanIni());
  });

  it('"Kosongkan" mengosongkan nilai bulan', async () => {
    renderDenganTema(<Harness awal="2026-01" />);
    await buka();
    await waitFor(() => expect(panel('bulan_bawah')).not.toBeNull());

    await userEvent.click(screen.getByRole('button', { name: 'Kosongkan bulan' }));

    expect(nilaiTerpilih()).toBe('');
  });

  it('nilai awal: blok tahun & bulan terpilih mengikutinya', async () => {
    renderDenganTema(<Harness awal="1998-05" />);
    await buka();
    await waitFor(() => expect(panel('bulan_atas')).not.toBeNull());

    // 1998 jadi acuan blok: 5 tahun sebelumnya di baris atas, 1998 di tengah
    // baris paling bawah.
    expect(screen.getByRole('group', { name: 'Tahun 1991–2000' })).toBeInTheDocument();
    expect(within(gridBulan(1998)).getByRole('button', { name: 'Mei 1998' }).getAttribute('data-terpilih')).toBe('ya');
  });

  it('nilai yang diubah dari LUAR dipakai saat panel dibuka lagi', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('bulan_atas')).not.toBeNull());

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(panel('bulan_atas')).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'set-luar' }));

    await buka();
    await waitFor(() => expect(screen.getByRole('group', { name: 'Tahun 1991–2000' })).toBeInTheDocument());
    expect(bulan('Mei 1998').getAttribute('data-terpilih')).toBe('ya');
  });

  it('bulan yang dipilih dari tahun lain tetap memakai tahun pilihannya', async () => {
    renderDenganTema(<Harness />);
    await buka();
    await waitFor(() => expect(panel('bulan_atas')).not.toBeNull());

    // Satu gulungan ke atas = satu baris (5 tahun sebelumnya), lalu pilih
    // tahun pertama baris tersebut.
    fireEvent.wheel(gridTahun(), { deltaY: -100 });
    const tahunLain = ini.tahun - TAHUN_PER_BARIS;
    await userEvent.click(within(screen.getByRole('group', { name: `Tahun ${tahunLain - indeksTahunAktif}–${tahunLain - indeksTahunAktif + TAHUN_PER_BLOK - 1}` }))
      .getByRole('button', { name: String(tahunLain) }));
    await userEvent.click(bulan(`Maret ${tahunLain}`));

    expect(nilaiTerpilih()).toBe(rakitBulan(tahunLain, 3));
  });
});
