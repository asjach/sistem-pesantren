import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  return {
    ...asli,
    measureActionsWidth: () => 137,
    measureTextWidth: (teks: string) => teks.length * 7,
  };
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
import { autoBarisKey, tinggiDasarKey } from '@/components/excel/useTinggiBaris';
import { dsgStub, kolomTerakhir } from '@/components/excel/_dsgStubDom';
import type { ExcelField } from '@/components/excel/types';
import { DeleteAction, EditAction, ViewAction } from '@/components/RowActions';
import { Button } from '@/components/ui/button';

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
  widthCache.delete('daftar_kelas');
});

afterAll(() => {
  if (asliClientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', asliClientHeight);
  if (asliClientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', asliClientWidth);
});

describe('GridV2 - penyuntingan sel (Mode Ubah)', () => {
  it.each([
    [false, true, false],
    [true, false, false],
    [true, true, true],
  ])('toggle langsung tetap digerbang izin: canEdit=%s, flag=%s', async (canEdit, toggleTanpaEdit, enabled) => {
    const simpan = vi.fn(async () => {});
    tampilkan({
      fields: [{ key: 'aktif', label: 'Aktif', kind: 'toggle', toggleTanpaEdit }],
      canEdit, onCommit: simpan,
    });
    const tombol = (await screen.findAllByRole('switch', { name: 'Aktif' }))[0];
    expect(tombol).toHaveProperty('disabled', !enabled);
    if (enabled) {
      await userEvent.click(tombol);
      await waitFor(() => expect(simpan).toHaveBeenCalledWith(1, { aktif: 'ya' }));
    } else {
      await userEvent.click(tombol);
      expect(simpan).not.toHaveBeenCalled();
    }
    expect(screen.queryByText('Mode Ubah aktif')).toBeNull();
  });

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

  it('dropdown select record lama menyimpan pilihan lewat antrean', async () => {
    const simpan = vi.fn<(id: string | number, f: Record<string, string | null>) => Promise<void>>(async () => {});
    const fields: ExcelField[] = [
      FIELDS[0],
      {
        key: 'jenjang', label: 'Jenjang', kind: 'select',
        choices: [{ value: 'MI', label: 'MI' }, { value: 'MTs', label: 'MTs' }],
      },
    ];
    tampilkan({
      fields,
      rows: [{ id: 1, nama: 'Ahmad', jenjang: 'MI', checked: false }],
      canEdit: true,
      onCommit: simpan,
    });
    await waitFor(() => expect(kolomTerakhir().find((k) => k.id === 'nama')?.disabled).toBe(false));

    const grid = document.querySelector('[data-slot="excel-table-grid"]') as HTMLElement;
    fireEvent.doubleClick(grid);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Mode Ubah aktif'));

    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox', { name: 'Jenjang' }));
    await user.click(await screen.findByRole('option', { name: 'MTs' }));

    await waitFor(() => expect(simpan).toHaveBeenCalledTimes(1));
    expect(simpan.mock.calls[0][1]).toEqual({ jenjang: 'MTs' });
  });

  it('bolehSelect=false mengunci sel dan tetap menampilkan nilai', async () => {
    const fields: ExcelField[] = [
      FIELDS[0],
      {
        key: 'jenjang', label: 'Jenjang', kind: 'select',
        choices: [{ value: 'MI', label: 'MI' }],
        bolehSelect: () => false,
      },
    ];
    tampilkan({
      fields,
      rows: [{ id: 1, nama: 'Ahmad', jenjang: 'MI', checked: false }],
      canEdit: true,
      onCommit: async () => {},
    });
    await waitFor(() => expect(kolomTerakhir().length).toBeGreaterThan(0));
    const grid = document.querySelector('[data-slot="excel-table-grid"]') as HTMLElement;
    fireEvent.doubleClick(grid);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Mode Ubah aktif'));

    expect(screen.queryByRole('combobox', { name: 'Jenjang' })).toBeNull();
    expect(document.querySelector('.dsg-row:not(.dsg-row-header) [data-col-key="jenjang"]')?.textContent).toContain('MI');
  });

  it('tempel/hapus dari DSG menyimpan perubahan lewat antrean', async () => {
    const simpan = vi.fn<(id: string | number, f: Record<string, string | null>) => Promise<void>>(async () => {});
    tampilkan({ canEdit: true, onCommit: simpan });
    await waitFor(() => expect(kolomTerakhir().find((k) => k.id === 'nama')?.disabled).toBe(false));

    const grid = document.querySelector('[data-slot="excel-table-grid"]') as HTMLElement;
    fireEvent.doubleClick(grid);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Mode Ubah aktif'));

    act(() => {
      dsgStub.ubah?.([
        { id: 1, nama: 'Ahmad Baru', nis: null, checked: false },
        { id: 2, nama: 'Bilal', nis: '002', checked: false },
      ]);
    });

    await waitFor(() => expect(simpan).toHaveBeenCalledTimes(1));
    expect(simpan.mock.calls[0][1]).toEqual({ nama: 'Ahmad Baru', nis: null });
  });

  it('kolom menyediakan jalur tempel/hapus DSG sehingga perubahan sampai ke antrean', async () => {
    // Regresi: DSG hanya mengubah nilai lewat `pasteValue`/`deleteValue` milik
    // kolom. Tanpa keduanya, tempel TSV dan tombol Delete tidak mengubah data
    // sehingga onChange tak pernah melihat baris yang berbeda — tes lama yang
    // memanggil onChange langsung tetap hijau padahal fitur mati.
    const simpan = vi.fn<(id: string | number, f: Record<string, string | null>) => Promise<void>>(async () => {});
    tampilkan({ canEdit: true, onCommit: simpan });
    await waitFor(() => expect(kolomTerakhir().find((k) => k.id === 'nama')?.disabled).toBe(false));

    const grid = document.querySelector('[data-slot="excel-table-grid"]') as HTMLElement;
    fireEvent.doubleClick(grid);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Mode Ubah aktif'));

    const kolomNama = kolomTerakhir().find((k) => k.id === 'nama');
    const sesudahTempel = kolomNama?.pasteValue?.({ rowData: ROWS[0], value: 'Ahmad Baru' });
    expect(sesudahTempel).toMatchObject({ nama: 'Ahmad Baru' });
    act(() => {
      dsgStub.ubah?.([sesudahTempel as (typeof ROWS)[number], ROWS[1]]);
    });
    await waitFor(() => expect(simpan).toHaveBeenCalledTimes(1));
    expect(simpan.mock.calls[0][1]).toEqual({ nama: 'Ahmad Baru' });

    const sesudahHapus = kolomNama?.deleteValue?.({ rowData: ROWS[0] });
    expect(sesudahHapus).toMatchObject({ nama: null });
    act(() => {
      dsgStub.ubah?.([sesudahHapus as (typeof ROWS)[number], ROWS[1]]);
    });
    await waitFor(() => expect(simpan).toHaveBeenCalledTimes(2));
    expect(simpan.mock.calls[1][1]).toEqual({ nama: null });
  });

  it('kolom terkunci tidak meneruskan tempel/hapus ke DSG', async () => {
    tampilkan();
    await waitFor(() => expect(kolomTerakhir().length).toBeGreaterThan(0));

    const kolomNama = kolomTerakhir().find((k) => k.id === 'nama');
    expect(kolomNama?.pasteValue?.({ rowData: ROWS[0], value: 'Baru' })).toBe(ROWS[0]);
    expect(kolomNama?.deleteValue?.({ rowData: ROWS[0] })).toBe(ROWS[0]);
  });

  it('nilai tempel yang gagal validasi tidak disimpan', async () => {
    const simpan = vi.fn<(id: string | number, f: Record<string, string | null>) => Promise<void>>(async () => {});
    const fields: ExcelField[] = [
      FIELDS[0],
      { ...FIELDS[1], validate: (v) => (v === 'salah' ? 'NIS tidak sah' : null) },
    ];
    tampilkan({ fields, canEdit: true, onCommit: simpan });
    await waitFor(() => expect(kolomTerakhir().find((k) => k.id === 'nama')?.disabled).toBe(false));

    const grid = document.querySelector('[data-slot="excel-table-grid"]') as HTMLElement;
    fireEvent.doubleClick(grid);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Mode Ubah aktif'));

    act(() => {
      dsgStub.ubah?.([
        { id: 1, nama: 'Ahmad', nis: 'salah', checked: false },
        { id: 2, nama: 'Bilal', nis: '002', checked: false },
      ]);
    });

    expect(simpan).not.toHaveBeenCalled();
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

describe('GridV2 - tinggi row dan header', () => {
  it('memakai tinggi dasar yang tersimpan khusus untuk tabel ini', async () => {
    localStorage.setItem(tinggiDasarKey('daftar_kelas'), '38');
    tampilkan();

    await waitFor(() => expect(dsgStub.tinggiBaris).toBe(38));
  });

  it('membungkus teks dan membesarkan row saat Baris ikut isi aktif', async () => {
    localStorage.setItem(autoBarisKey('daftar_kelas'), '1');
    widthCache.set('daftar_kelas', { widths: { nama: 60, nis: 60 }, autoWidths: {} });
    tampilkan({
      rows: [{
        id: 1,
        nama: 'Nama santri yang sangat panjang dan perlu membungkus ke beberapa baris',
        nis: '001',
        checked: false,
      }],
    });

    await waitFor(() => expect(typeof dsgStub.tinggiBaris).toBe('number'));
    await waitFor(() => expect(dsgStub.tinggiBaris as number).toBeGreaterThan(24));
  });

  it('maxRows membatasi tinggi grid dan tetap memakai row seragam', async () => {
    tampilkan({
      maxRows: 2,
      rows: [...ROWS, { id: 3, nama: 'Candra', nis: '003', checked: false }],
    });

    await waitFor(() => expect(dsgStub.tinggi).toBe(75));
    expect(dsgStub.tinggiBaris).toBe(24);
    expect(document.querySelector('[data-max-rows="2"]')).toHaveStyle({ height: '75px' });
  });

  it('maxRows menjaga empty state tetap terbaca', async () => {
    tampilkan({ tableKey: 'daftar_kelas_kosong', maxRows: 3, rows: [] });

    await waitFor(() => expect(dsgStub.tinggi).toBe(280));
    expect(document.querySelector('[data-max-rows="3"]')).toHaveStyle({ height: '280px' });
  });

  it('maxRows mengikuti jumlah data dan mempertahankan tinggi saat refetch', async () => {
    const props = {
      tableKey: 'daftar_kelas_stabil',
      fields: FIELDS,
      dipilih: new Set<string | number>(),
      onTogglePilih: () => {},
      onTogglePilihSemua: () => {},
      maxRows: 4,
    };
    const { rerender } = render(<GridV2 {...props} rows={[ROWS[0]]} />);
    await waitFor(() => expect(dsgStub.tinggi).toBe(51));

    rerender(<GridV2 {...props} rows={[...ROWS, { id: 3, nama: 'Candra', nis: '003', checked: false }]} />);
    await waitFor(() => expect(dsgStub.tinggi).toBe(99));

    rerender(<GridV2 {...props} rows={[...ROWS, { id: 3, nama: 'Candra', nis: '003', checked: false }]} loading />);
    expect(document.querySelector('[data-max-rows="4"]')).toHaveStyle({ height: '99px' });
  });

  it('judul header membungkus dan headerAutoH mengikuti hasil ukur', async () => {
    const asli = Range.prototype.getClientRects;
    Range.prototype.getClientRects = function getClientRects() {
      return { length: 3, item: () => null, [Symbol.iterator]: function* () {} } as unknown as DOMRectList;
    };
    try {
      tampilkan({
        fields: [
          { key: 'nama', label: 'Nama lengkap santri yang sangat panjang', kind: 'text', width: 70 },
          FIELDS[1],
        ],
      });

      await waitFor(() => expect(dsgStub.tinggiHeader ?? 0).toBeGreaterThan(26));
    } finally {
      Range.prototype.getClientRects = asli;
    }
  });

  it('tinggi header manual menang atas hasil otomatis', async () => {
    prefs.headerH = 48;
    tampilkan();

    await waitFor(() => expect(dsgStub.tinggiHeader).toBe(48));
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

  it('klik kanan baris menampilkan aksi record dan konfirmasi hapus', async () => {
    const lihat = vi.fn();
    const hapus = vi.fn();
    tampilkan({
      renderActions: (id: string | number) => (
        <>
          <ViewAction id={`lihat_${id}`} onClick={() => lihat(id)} />
          <DeleteAction
            id={`hapus_${id}`}
            title="Hapus data?"
            description="Data yang dihapus tidak bisa dikembalikan."
            onConfirm={() => hapus(id)}
          />
        </>
      ),
    });
    await waitFor(() => expect(kolomTerakhir().length).toBeGreaterThan(0));

    const sel = document.querySelector('.dsg-row:not(.dsg-row-header) [data-col-key="nama"]') as HTMLElement;
    const menu = await bukaMenu(sel);
    expect(menu).toHaveTextContent('AKSI');

    await userEvent.click(screen.getByRole('menuitem', { name: 'Lihat' }));
    expect(lihat).toHaveBeenCalledWith(1);

    await bukaMenu(sel);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Hapus' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Hapus data?');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hapus' }));
    expect(hapus).toHaveBeenCalledWith(1);
  });

  it('aksi yang dibungkus span tetap diratakan menjadi item menu', async () => {
    // Halaman lazim membungkus aksi dalam `<span className="flex">`; tanpa
    // perataan, seluruh pembungkus tampil sebagai satu item generik "Aksi".
    const lihat = vi.fn();
    const ubah = vi.fn();
    tampilkan({
      renderActions: (id: string | number) => (
        <span className="flex items-center gap-0.5">
          {/* Kontrol ber-input tetap dirender di sel, tapi bukan item menu. */}
          <input aria-label="Cicilan" />
          {/* Tombol peraga tanpa handler (seperti contoh hidup) tetap tampil. */}
          <Button title="Cetak" aria-label="Cetak" />
          <ViewAction id={`lihat_${id}`} onClick={() => lihat(id)} />
          <EditAction id={`ubah_${id}`} onClick={() => ubah(id)} />
        </span>
      ),
    });
    await waitFor(() => expect(kolomTerakhir().length).toBeGreaterThan(0));

    const sel = document.querySelector('.dsg-row:not(.dsg-row-header) [data-col-key="nama"]') as HTMLElement;
    const menu = await bukaMenu(sel);
    expect(within(menu).queryByRole('menuitem', { name: 'Aksi' })).toBeNull();
    expect(within(menu).queryByRole('menuitem', { name: /Cicilan/ })).toBeNull();
    expect(within(menu).getByRole('menuitem', { name: 'Cetak' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Ubah' })).toBeInTheDocument();

    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Lihat' }));
    expect(lihat).toHaveBeenCalledWith(1);
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

describe('GridV2 - kolom beku', () => {
  const bukaMenu = async (target: Element) => {
    fireEvent.contextMenu(target);
    return screen.findByRole('menu');
  };

  it('tanpa setelan, hanya kolom centang yang menempel', async () => {
    tampilkan();
    await waitFor(() => expect(kolomTerakhir().length).toBeGreaterThan(0));

    // Indeks 0 DSG = gutter, jadi 1 = kolom centang saja.
    expect(dsgStub.stickyLeft).toBe(1);
    expect(kolomTerakhir().find((k) => k.id === 'nama')?.headerClassName).toBeUndefined();
  });

  it('membaca jumlah beku tersimpan dan menandai tepi kanan area beku', async () => {
    localStorage.setItem('simpes_grid_daftar_kelas_freeze', '1');
    tampilkan();
    await waitFor(() => expect(kolomTerakhir().length).toBeGreaterThan(0));

    // Kolom centang + satu kolom data.
    expect(dsgStub.stickyLeft).toBe(2);
    const nama = kolomTerakhir().find((k) => k.id === 'nama');
    const nis = kolomTerakhir().find((k) => k.id === 'nis');
    expect(nama?.headerClassName).toContain('simpes-dsg-v2-beku-tepi');
    const kelasSel = nama?.cellClassName;
    expect(typeof kelasSel).toBe('function');
    if (typeof kelasSel === 'function') {
      expect(kelasSel({ rowData: ROWS[0] })).toContain('simpes-dsg-v2-beku-tepi');
    }
    expect(nis?.headerClassName).toBeUndefined();
  });

  it('menu klik kanan membekukan sampai kolom yang diklik dan bisa dilepas', async () => {
    tampilkan();
    await waitFor(() => expect(kolomTerakhir().length).toBeGreaterThan(0));

    const judulNis = document.querySelector('.dsg-row-header [data-col-key="nis"]') as HTMLElement;
    await bukaMenu(judulNis);
    await userEvent.click(screen.getByRole('button', { name: 'Bekukan kolom sampai di sini' }));

    await waitFor(() => expect(localStorage.getItem('simpes_grid_daftar_kelas_freeze')).toBe('2'));
    // Kolom centang + dua kolom data.
    await waitFor(() => expect(dsgStub.stickyLeft).toBe(3));

    await bukaMenu(judulNis);
    await userEvent.click(screen.getByRole('button', { name: 'Lepas semua kolom beku' }));

    await waitFor(() => expect(localStorage.getItem('simpes_grid_daftar_kelas_freeze')).toBe('0'));
    await waitFor(() => expect(dsgStub.stickyLeft).toBe(1));
  });

  it('tombol bekukan nonaktif bila kolom itu sudah di dalam area beku', async () => {
    localStorage.setItem('simpes_grid_daftar_kelas_freeze', '1');
    tampilkan();
    await waitFor(() => expect(kolomTerakhir().length).toBeGreaterThan(0));

    const judulNama = document.querySelector('.dsg-row-header [data-col-key="nama"]') as HTMLElement;
    await bukaMenu(judulNama);
    expect(screen.getByRole('button', { name: 'Bekukan kolom sampai di sini' })).toBeDisabled();
  });
  it('jumlah beku dibatasi jumlah kolom yang tampil', async () => {
    localStorage.setItem('simpes_grid_daftar_kelas_freeze', '99');
    tampilkan();
    await waitFor(() => expect(kolomTerakhir().length).toBeGreaterThan(0));

    // Kolom centang + semua kolom data; tak ada indeks di luar daftar kolom.
    expect(dsgStub.stickyLeft).toBe(1 + FIELDS.length);
    // Tepi area beku jatuh di kolom data terakhir.
    expect(kolomTerakhir().find((k) => k.id === 'nis')?.headerClassName)
      .toContain('simpes-dsg-v2-beku-tepi');
  });
});

describe('GridV2 - geser judul kolom', () => {
  const nyalakanMode = async (extra: Record<string, unknown> = {}) => {
    tampilkan({ canEdit: true, onCommit: async () => {}, ...extra });
    await waitFor(() => expect(kolomTerakhir().find((k) => k.id === 'nama')?.disabled).toBe(false));
    fireEvent.doubleClick(document.querySelector('[data-slot="excel-table-grid"]') as HTMLElement);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Mode Ubah aktif'));
  };

  it('sakelar geser judul tampil untuk super admin dan tersimpan per perangkat', async () => {
    await nyalakanMode({ bolehGeser: true, onPindahKolom: vi.fn() });

    const cb = screen.getByLabelText('Geser judul kolom');
    expect(cb).not.toBeChecked();

    fireEvent.click(cb);
    await waitFor(() => expect(localStorage.getItem('simpes_grid_daftar_kelas_geser_header')).toBe('1'));
    expect(cb).toBeChecked();
  });

  it('sakelar geser judul tidak tampil tanpa izin super admin', async () => {
    await nyalakanMode({ onPindahKolom: vi.fn() });

    expect(screen.queryByLabelText('Geser judul kolom')).toBeNull();
  });

  it('sakelar geser judul tidak tampil saat isi-lebar aktif', async () => {
    localStorage.setItem('simpes_grid_daftar_kelas_isi_lebar', '1');
    await nyalakanMode({ bolehGeser: true, onPindahKolom: vi.fn() });

    expect(screen.queryByLabelText('Geser judul kolom')).toBeNull();
  });
});
