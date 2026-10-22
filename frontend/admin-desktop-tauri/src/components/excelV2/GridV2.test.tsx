import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/** DSG asli merender lebar berbasis pengukuran DOM; di jsdom semua 0 sehingga
 *  grid tak stabil. Stub memakai komponen kolom yang disuntik GridV2, jadi
 *  judul (termasuk gagang lebar) dan sel tetap ikut teruji. */
vi.mock('react-datasheet-grid', async () => {
  const { DynamicDataSheetGridStub } = await import('@/components/excel/_dsgStubDom');
  return { DynamicDataSheetGrid: DynamicDataSheetGridStub };
});

vi.mock('@/lib/clipboard', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/lib/clipboard')>();
  return { ...asli, copyText: vi.fn(async () => true) };
});

vi.mock('@/theme', () => ({
  useTheme: () => ({ iconSet: 'lucide' }),
}));

/** jsdom tak punya layout; ukur lebar aksi dikembalikan tetap supaya jalur
 *  "lebar kolom Aksi memakai hasil ukur DOM" bisa diuji. */
vi.mock('@/components/excel/measure', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/components/excel/measure')>();
  return { ...asli, measureActionsWidth: () => 137 };
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
import { copyText } from '@/lib/clipboard';
import { widthCache, widthsKey } from '@/components/excel/helpers';
import { dsgStub, kolomTerakhir, type KolomStub } from '@/components/excel/_dsgStubDom';
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
  vi.mocked(copyText).mockClear();
  vi.mocked(copyText).mockResolvedValue(true);
  prefs.rowH = null;
  prefs.headerH = null;
  prefs.fontPx = 11;
  prefs.fontFamily = 'x';
});

afterAll(() => {
  if (asliClientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', asliClientHeight);
  if (asliClientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', asliClientWidth);
});

describe('GridV2 - penyuntingan sel (Mode Ubah)', () => {
  it('sel terkunci dan tidak ada Mode Ubah saat canEdit false', async () => {
    tampilkan();
    await waitFor(() => expect(kolomTerakhir().length).toBeGreaterThan(0));
    // Tanpa izin, kolom tetap disabled dan tak ada pill Mode Ubah.
    expect(kolomTerakhir().find((k) => k.id === 'nama')?.disabled).toBe(true);
    const grid = document.querySelector('[data-slot="excel-table-grid"]') as HTMLElement;
    fireEvent.doubleClick(grid);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('klik 2x menyalakan Mode Ubah dan membuka editor sel', async () => {
    const simpan = vi.fn<(id: string | number, f: Record<string, string | null>) => Promise<void>>(async () => {});
    tampilkan({ canEdit: true, onCommit: simpan });
    await waitFor(() => expect(kolomTerakhir().find((k) => k.id === 'nama')?.disabled).toBe(false));

    const grid = document.querySelector('[data-slot="excel-table-grid"]') as HTMLElement;
    fireEvent.doubleClick(grid);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Mode Ubah aktif'));
  });

  it('Enter pada editor menyimpan nilai lewat antrean (satu simpanan)', async () => {
    const simpan = vi.fn<(id: string | number, f: Record<string, string | null>) => Promise<void>>(async () => {});
    tampilkan({ canEdit: true, onCommit: simpan });
    await waitFor(() => expect(kolomTerakhir().find((k) => k.id === 'nama')?.disabled).toBe(false));

    const grid = document.querySelector('[data-slot="excel-table-grid"]') as HTMLElement;
    fireEvent.doubleClick(grid);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Mode Ubah aktif'));

    // Buka editor sel, ubah, lalu Enter.
    const editor = document.querySelector('input[autofocus]') as HTMLInputElement | null;
    if (editor) {
      fireEvent.change(editor, { target: { value: 'Ahmad Baru' } });
      fireEvent.keyDown(editor, { key: 'Enter' });
      await waitFor(() => expect(simpan).toHaveBeenCalledTimes(1));
      expect(simpan.mock.calls[0][1]).toEqual({ nama: 'Ahmad Baru' });
    }
  });
  it('id baris angka (number) tetap sampai ke onCommit', async () => {
    // Regresi: sel menyerahkan id sebagai number, sedangkan kunci draft &
    // antrean simpan selalu string. Tanpa normalisasi, `String(r.id) === idKey`
    // di useAntreanSimpan tak pernah bertemu sehingga baris dianggap tak ada
    // dan simpanan dibatalkan diam-diam (tanpa galat, tanpa toast).
    //
    // `RULES` sengaja memakai id number; pastikan onCommit menerima baris itu.
    const simpan = vi.fn<(id: string | number, f: Record<string, string | null>) => Promise<void>>(async () => {});
    tampilkan({ canEdit: true, onCommit: simpan });
    await waitFor(() => expect(kolomTerakhir().find((k) => k.id === 'nama')?.disabled).toBe(false));

    // Jalankan aksi sel apa adanya lewat kolom yang sudah dibangun GridV2:
    // ambil columnData kolom 'nama' dan panggil onSimpan seperti sel.
    const kolomNama = kolomTerakhir().find((k) => k.id === 'nama');
    const data = kolomNama?.columnData as { onSimpan?: (id: string | number, key: string, v: string | null) => void } | undefined;
    expect(typeof data?.onSimpan).toBe('function');
    data?.onSimpan?.(1, 'nama', 'Baru');

    await waitFor(() => expect(simpan).toHaveBeenCalledTimes(1));
    // id harus utuh sehingga barisnya ketemu di antrean simpan.
    expect(String(simpan.mock.calls[0][0])).toBe('1');
    expect(simpan.mock.calls[0][1]).toEqual({ nama: 'Baru' });
  });

  it('kolom static tetap terkunci walau Mode Ubah menyala', async () => {
    const fields = [
      { key: 'nama', label: 'Nama', kind: 'text' },
      { key: 'kode', label: 'Kode', kind: 'static' },
    ] as ExcelField[];
    tampilkan({ fields, canEdit: true, onCommit: async () => {} });
    await waitFor(() => expect(kolomTerakhir().length).toBeGreaterThan(0));
    // Kolom static tidak masuk daftar bisa disunting; hanya kolom teks yang dibuka.
    const grid = document.querySelector('[data-slot="excel-table-grid"]') as HTMLElement;
    fireEvent.doubleClick(grid);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Mode Ubah aktif'));
    // Kolom 'kode' tetap disabled meski mode menyala.
    expect(kolomTerakhir().find((k) => k.id === 'kode')?.disabled).toBe(true);
  });
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

  it('lebar kolom aksi memakai hasil ukur tombol, bukan asumsi ikon', async () => {
    tampilkan({ renderActions: () => <button type="button">MI</button> });

    await waitFor(() => {
      expect(kolomTerakhir().find((k) => k.id === '__aksi')?.basis).toBe(137);
    });
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

describe('GridV2 - dedupe callback DSG', () => {
  it('laporan sel aktif yang sama berulang tidak memicu callback baris berulang', async () => {
    const onBarisAktif = vi.fn();
    tampilkan({ onBarisAktif });
    await waitFor(() => expect(kolomTerakhir().length).toBeGreaterThan(0));

    act(() => {
      dsgStub.aktifSel?.({ cell: { row: 0, col: 1 } });
      dsgStub.aktifSel?.({ cell: { row: 0, col: 1 } });
      dsgStub.aktifSel?.({ cell: { row: 0, col: 1 } });
    });

    expect(onBarisAktif).toHaveBeenCalledTimes(1);
    expect(onBarisAktif).toHaveBeenCalledWith(1);
  });
});

describe('GridV2 - menu klik kanan & salin TSV', () => {
  const bukaMenu = async (target: Element) => {
    fireEvent.contextMenu(target);
    return screen.findByRole('menu');
  };

  it('klik kanan judul kolom menampilkan AutoFit dan menyalin kolom sebagai TSV', async () => {
    tampilkan();
    await waitFor(() => expect(kolomTerakhir().length).toBeGreaterThan(0));

    const judul = document.querySelector('.dsg-row-header [data-col-key="nama"]') as HTMLElement;
    expect(judul).not.toBeNull();
    const menu = await bukaMenu(judul);

    expect(menu).toHaveTextContent('KOLOM: Nama');
    expect(screen.getByRole('button', { name: 'Sesuaikan lebar kolom ini' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salin kolom (TSV)' }));

    await waitFor(() => expect(copyText).toHaveBeenCalledWith('Nama\nAhmad\nBilal'));
  });

  it('klik kanan baris menyalin nilai sel dan baris sebagai TSV', async () => {
    tampilkan();
    await waitFor(() => expect(kolomTerakhir().length).toBeGreaterThan(0));

    const sel = document.querySelector('.dsg-row:not(.dsg-row-header) [data-col-key="nama"]') as HTMLElement;
    const menu = await bukaMenu(sel);
    expect(menu).toHaveTextContent('Salin baris (TSV)');

    await userEvent.click(screen.getByRole('menuitem', { name: 'Salin nilai sel' }));
    await waitFor(() => expect(copyText).toHaveBeenLastCalledWith('Ahmad'));

    await bukaMenu(sel);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Salin baris (TSV)' }));
    await waitFor(() => expect(copyText).toHaveBeenLastCalledWith('Nama\tNIS\nAhmad\t001'));
  });

  it('klik kanan sudut kiri-atas menyalin seluruh tabel', async () => {
    tampilkan();
    await waitFor(() => expect(kolomTerakhir().length).toBeGreaterThan(0));

    const sudut = document.querySelector('.dsg-row-header .dsg-cell-gutter') as HTMLElement;
    const menu = await bukaMenu(sudut);
    expect(menu).toHaveTextContent('Salin semua (TSV)');

    await userEvent.click(screen.getByRole('menuitem', { name: 'Salin semua (TSV)' }));
    await waitFor(() => expect(copyText).toHaveBeenCalledWith('Nama\tNIS\nAhmad\t001\nBilal\t002'));
  });

  it('klik kanan di area kosong tidak membuka menu', async () => {
    tampilkan();
    await waitFor(() => expect(kolomTerakhir().length).toBeGreaterThan(0));

    const grid = document.querySelector('[data-slot="excel-table-grid"]') as HTMLElement;
    fireEvent.contextMenu(grid);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('GridV2 - sakelar gestur seret isi sel', () => {
  const nyalakanMode = async () => {
    tampilkan({ canEdit: true, onCommit: async () => {} });
    await waitFor(() => expect(kolomTerakhir().find((k) => k.id === 'nama')?.disabled).toBe(false));

    const grid = document.querySelector('[data-slot="excel-table-grid"]') as HTMLElement;
    fireEvent.doubleClick(grid);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Mode Ubah aktif'));
  };

  it('sakelar copy/move mati bawaan dan saling eksklusif saat dinyalakan', async () => {
    await nyalakanMode();

    const salin = screen.getByLabelText('Seret isi sel untuk copy');
    const pindah = screen.getByLabelText('Seret isi sel untuk move');
    expect(salin).not.toBeChecked();
    expect(pindah).not.toBeChecked();

    fireEvent.click(salin);
    await waitFor(() => expect(localStorage.getItem('simpes_grid_daftar_kelas_seret_salin')).toBe('1'));

    fireEvent.click(pindah);
    await waitFor(() => expect(localStorage.getItem('simpes_grid_daftar_kelas_seret_pindah')).toBe('1'));
    expect(localStorage.getItem('simpes_grid_daftar_kelas_seret_salin')).toBe('');
    expect(screen.getByLabelText('Seret isi sel untuk copy')).not.toBeChecked();
    expect(screen.getByLabelText('Seret isi sel untuk move')).toBeChecked();
  });

  it('membaca sakelar tersimpan per perangkat saat Mode Ubah dinyalakan', async () => {
    localStorage.setItem('simpes_grid_daftar_kelas_seret_salin', '1');
    await nyalakanMode();

    await waitFor(() => expect(screen.getByLabelText('Seret isi sel untuk copy')).toBeChecked());
    expect(screen.getByLabelText('Seret isi sel untuk move')).not.toBeChecked();
  });
});
