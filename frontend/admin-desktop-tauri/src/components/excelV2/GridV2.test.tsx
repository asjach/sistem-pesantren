import { render, screen, waitFor } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/** DSG asli merender lebar berbasis pengukuran DOM; di jsdom semua 0 sehingga
 *  grid tak stabil. Stub memakai komponen kolom yang disuntik GridV2, jadi
 *  judul (termasuk gagang lebar) dan sel tetap ikut teruji. */
vi.mock('react-datasheet-grid', async () => {
  const { DynamicDataSheetGridStub } = await import('@/components/excel/_dsgStubDom');
  return { DynamicDataSheetGrid: DynamicDataSheetGridStub };
});

const prefs = vi.hoisted(() => ({
  rowH: null as number | null,
  headerH: null as number | null,
  fontPx: 11 as number | null,
  fontFamily: 'x',
}));
vi.mock('@/components/GridPrefs', async (asli) => ({
  ...(await asli<typeof import('@/components/GridPrefs')>()),
  useGridPrefs: () => prefs,
}));

import GridV2 from './GridV2';
import { widthCache, widthsKey } from '@/components/excel/helpers';
import { kolomTerakhir } from '@/components/excel/_dsgStubDom';
import type { ExcelField } from '@/components/excel/types';

const FIELDS: ExcelField[] = [
  { key: 'nama', label: 'Nama', kind: 'text' },
  { key: 'nis', label: 'NIS', kind: 'text' },
];
const ROWS = [
  { id: 1, nama: 'Ahmad', nis: '001', checked: false },
  { id: 2, nama: 'Bilal', nis: '002', checked: false },
];

function tampilkan(extra: Record<string, unknown> = {}) {
  return render(
    <GridV2
      tableKey="daftar_kelas"
      fields={FIELDS}
      rows={ROWS}
      dipilih={new Set()}
      onTogglePilih={() => {}}
      onTogglePilihSemua={() => {}}
      {...extra}
    />,
  );
}

/** jsdom tidak punya canvas; AutoFit memakai konteks 2D untuk mengukur teks.
 *  Di-null-kan supaya pengukuran jatuh ke jalur cadangan, sama seperti tes
 *  halaman lain di repo ini. */
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;

/** jsdom tak punya layout: semua elemen setinggi 0 sehingga GridV2 menganggap
 *  wadahnya belum terukur dan tidak merender grid. Tiru tinggi lebar nyata
 *  (pola yang sama dipakai ExcelTable.test.tsx untuk clientHeight). */
const asliClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
const asliClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
  configurable: true,
  get() { return this.dataset?.slot === 'excel-table-grid' ? 320 : 24; },
});
Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
  configurable: true,
  get() { return this.dataset?.slot === 'excel-table-grid' ? 640 : 120; },
});

beforeEach(() => {
  localStorage.clear();
  prefs.rowH = null;
  prefs.headerH = null;
  prefs.fontPx = 11;
  prefs.fontFamily = 'x';
});

afterAll(() => {
  if (asliClientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', asliClientHeight);
  if (asliClientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', asliClientWidth);
});

describe('GridV2 - lebar kolom', () => {
  it('menampilkan gagang pengubah lebar di judul setiap kolom data', () => {
    tampilkan();

    expect(document.querySelector('[data-gagang-lebar="nama"]')).not.toBeNull();
    expect(document.querySelector('[data-gagang-lebar="nis"]')).not.toBeNull();
  });

  it('gagang punya label aksesibilitas yang menyebut kolomnya', () => {
    tampilkan();

    expect(screen.getByRole('separator', { name: 'Ubah lebar kolom Nama' })).toBeInTheDocument();
  });

  it('kolom aksi tidak diberi gagang karena lebarnya mengikuti jumlah ikon', () => {
    tampilkan({ renderActions: () => null });

    expect(document.querySelector('[data-gagang-lebar="__aksi"]')).toBeNull();
  });

  it('lebar tersimpan pengguna dipakai sebagai basis kolom saat muat', () => {
    // Cache sesi = jalur "kunjungan ulang halaman": lebar langsung final di
    // render pertama sehingga grid tidak bergeser.
    widthCache.set('daftar_kelas', { widths: { nama: 321 }, autoWidths: {} });
    tampilkan();

    // Kolom yang punya lebar tersimpan memakai nilai itu apa adanya.
    const kolom = kolomTerakhir();
    expect(kolom.find((k) => k.id === 'nama')?.basis).toBe(321);

    // Kolom tanpa lebar tersimpan diisi hasil AutoFit (bukan lebar bawaan
    // field), jadi nilainya boleh berbeda dari f.width — yang penting ada.
    const nis = kolom.find((k) => k.id === 'nis')?.basis;
    expect(typeof nis).toBe('number');
    expect(nis).toBeGreaterThan(0);
  });

describe('GridV2 - isi lebar wadah', () => {
  it('membagi lebar wadah secara proporsional saat isi-lebar aktif', async () => {
    // Wadah 640px (lihat stub clientWidth). Kolom tetap = gutter + centang +
    // Aksi + overhang; sisa dibagi proporsional ke kolom data.
    localStorage.setItem('simpes_grid_daftar_kelas_isi_lebar', '1');
    widthCache.set('daftar_kelas', { widths: { nama: 100, nis: 100 }, autoWidths: {} });
    tampilkan({ isiLebarPenuh: true });
    await waitFor(() => {
      const kolom = kolomTerakhir();
      const nama = kolom.find((k) => k.id === 'nama')?.basis ?? 0;
      // Kedua kolom berbasis sama -> lebar hasil skala harus sama.
      expect(nama).toBe(kolom.find((k) => k.id === 'nis')?.basis);
    });
  });

  it('mematikan isi-lebar memakai lebar basis apa adanya', async () => {
    localStorage.setItem('simpes_grid_daftar_kelas_isi_lebar', '0');
    widthCache.set('daftar_kelas', { widths: { nama: 321 }, autoWidths: {} });
    tampilkan({ isiLebarPenuh: true });
    await waitFor(() => {
      expect(kolomTerakhir().find((k) => k.id === 'nama')?.basis).toBe(321);
    });
  });
});

  it('tidak menyusut saat total kolom melebihi wadah (tabel dibiarkan menggulir)', async () => {
    // Opsi A: isi-lebar hanya MEMBESARKAN. Di halaman nyata tabel bisa memuat
    // puluhan kolom; totalnya melebihi wadah. Saat itu sakelar tidak boleh
    // menyusutkan kolom (dulu semua kolom runtuh ke MIN_COL_W = 50 px).
    localStorage.setItem('simpes_grid_daftar_kelas_isi_lebar', '1');
    widthCache.set('daftar_kelas', { widths: { nama: 900, nis: 900 }, autoWidths: {} });
    tampilkan({ isiLebarPenuh: true });
    await waitFor(() => {
      const kolom = kolomTerakhir();
      expect(kolom.find((k) => k.id === 'nama')?.basis).toBe(900);
      expect(kolom.find((k) => k.id === 'nis')?.basis).toBe(900);
    });
  });
  it('kunci penyimpanan lebar memakai tableKey', () => {
    expect(widthsKey('daftar_kelas')).toBe('simpes_grid_daftar_kelas_w_v2');
  });
});
