import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ExcelTabelV2 from './ExcelTabelV2';
import type { ExcelField } from '@/components/excel/types';

const { presetState } = vi.hoisted(() => ({
  presetState: {
    judulDb: null as string | null,
    labelDb: {} as Record<string, string>,
    alignDb: {} as Record<string, 'left' | 'center' | 'right'>,
  },
}));

vi.mock('@/components/excel/useToolbarPreset', () => ({
  useToolbarPresetState: () => presetState,
}));

vi.mock('@/theme', () => ({
  useTheme: () => ({ iconSet: 'lucide' }),
}));

vi.mock('@/components/PresetUrut', () => ({
  default: ({ tableKey }: { tableKey: string }) => <span data-testid="preset-urut">{tableKey}</span>,
}));
vi.mock('@/components/PresetKolom', () => ({
  default: ({ onApply }: { onApply: (keys: string[] | null, presetId?: number | null) => void }) => (
    <>
      <span data-testid="preset-kolom" />
      <button type="button" onClick={() => onApply(['nama'], 7)}>terapkan-preset</button>
    </>
  ),
}));

/** Grid diganti stub: tes ini menguji komposisi chrome, bukan mesin DSG. */
vi.mock('./GridV2', () => ({
  default: ({
    fields,
    rows,
    dipilih,
    onTogglePilih,
    hideCheckbox,
    labelDb,
    alignDb,
    renderActions,
    barisAktifId,
    onBarisAktif,
  }: {
    fields: { key: string }[];
    rows: { id: string | number }[];
    dipilih: ReadonlySet<string | number>;
    onTogglePilih: (id: string | number) => void;
    hideCheckbox?: boolean;
    labelDb?: Record<string, string>;
    alignDb?: Record<string, string>;
    renderActions?: (id: string | number) => unknown;
    barisAktifId?: string | number | null;
    onBarisAktif?: (id: string | number) => void;
  }) => (
    <div data-slot="excel-table-grid">
      <span data-testid="jumlah-grid">{rows.length}</span>
      <span data-testid="dipilih-grid">{[...dipilih].join(',')}</span>
      <span data-testid="kolom-grid">{fields.map((f) => f.key).join(',')}</span>
      <span data-testid="hide-checkbox">{String(!!hideCheckbox)}</span>
      <span data-testid="ada-aksi">{String(!!renderActions)}</span>
      <span data-testid="baris-aktif">{String(barisAktifId ?? '')}</span>
      <span data-testid="label-db">{JSON.stringify(labelDb ?? {})}</span>
      <span data-testid="align-db">{JSON.stringify(alignDb ?? {})}</span>
      <button type="button" onClick={() => onTogglePilih(1)}>pilih-1</button>
      <button type="button" onClick={() => onBarisAktif?.(1)}>baris-1</button>
    </div>
  ),
}));

const rows = [
  { id: 1, nama: 'Ahmad' },
  { id: 2, nama: 'Bilal' },
];

const DUA_KOLOM: ExcelField[] = [
  { key: 'nama', label: 'Nama', kind: 'text' },
  { key: 'nis', label: 'NIS', kind: 'text' },
];

function tampilkan(extra: Record<string, unknown> = {}) {
  return render(
    <ExcelTabelV2
      judul="Daftar kelas"
      tableKey="daftar_kelas"
      fields={[]}
      rows={rows}
      getValues={(r) => ({ nama: r.nama })}
      onApplyPreset={() => {}}
      {...extra}
    />,
  );
}

beforeEach(() => {
  presetState.judulDb = null;
  presetState.labelDb = {};
  presetState.alignDb = {};
});

describe('ExcelTabelV2', () => {
  it('menyusun pembungkus toolbar, grid, dan footer', () => {
    const { container } = tampilkan();
    const root = container.querySelector('[data-slot="excel-table"]');
    const toolbar = container.querySelector('[data-slot="excel-table-toolbar"]');
    const grid = container.querySelector('[data-slot="excel-table-grid"]');
    const footer = container.querySelector('[data-slot="table-footer"]');

    expect(root).not.toBeNull();
    expect(root).toHaveAttribute('data-varian', 'v2');
    expect(toolbar).not.toBeNull();
    expect(footer).toHaveAttribute('data-part', 'kaki_tabel');
    expect(root).toContainElement(toolbar as HTMLElement);
    expect(root).toContainElement(grid as HTMLElement);
    expect(root).toContainElement(footer as HTMLElement);
  });

  it('menampilkan judul, aksi halaman, dan trigger tanpa label visual', () => {
    const { container } = tampilkan({ aksi: <button type="button">Tambah</button> });

    expect(screen.getByText('Daftar kelas')).toBeInTheDocument();

    const areaAksi = container.querySelector('[data-slot="excel-table-actions"]');
    expect(areaAksi).toContainElement(screen.getByRole('button', { name: 'Tambah' }));

    const tombolFilter = screen.getByRole('button', { name: 'Area filter' });
    expect(tombolFilter).toHaveAttribute('data-trigger', 'excel-table-filter');
    expect(tombolFilter.textContent).toBe('');

    const tombolMenu = screen.getByRole('button', { name: 'Menu lainnya' });
    expect(tombolMenu).toHaveAttribute('data-trigger', 'excel-table-menu');
    expect(tombolMenu.textContent).toBe('');
  });

  it('membuka area filter selebar toolbar saat tombol diklik', async () => {
    const user = userEvent.setup();
    const { container } = tampilkan({ filter: <span data-testid="filter-halaman" /> });
    const tombol = screen.getByRole('button', { name: 'Area filter' });

    expect(container.querySelector('[data-slot="excel-table-filter-area"]')).toBeNull();
    expect(tombol).toHaveAttribute('aria-expanded', 'false');

    await user.click(tombol);
    const area = container.querySelector('[data-slot="excel-table-filter-area"]');
    const kiri = area?.querySelector('[data-slot="excel-table-filter-left"]');
    expect(area).not.toBeNull();
    expect(area?.querySelector('[data-slot="excel-table-filter-right"]')).toBeNull();

    const presetKolom = kiri?.querySelector('[data-testid="preset-kolom"]');
    const presetUrut = kiri?.querySelector('[data-testid="preset-urut"]');
    const filterHalaman = kiri?.querySelector('[data-testid="filter-halaman"]');
    expect(presetKolom).not.toBeNull();
    expect(presetUrut).not.toBeNull();
    expect(filterHalaman).not.toBeNull();

    // urutan: kolom, urut, status
    const urutDom = (a: Element | null | undefined, b: Element | null | undefined) => {
      if (!a || !b) return 0;
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    };
    expect(urutDom(presetKolom, presetUrut)).toBe(-1);
    expect(urutDom(presetUrut, filterHalaman)).toBe(-1);
    expect(tombol).toHaveAttribute('aria-expanded', 'true');

    await user.click(tombol);
    expect(container.querySelector('[data-slot="excel-table-filter-area"]')).toBeNull();
    expect(tombol).toHaveAttribute('aria-expanded', 'false');
  });

  it('meneruskan baris ke grid dan menampilkan jumlahnya di footer', () => {
    tampilkan();

    expect(screen.getByTestId('jumlah-grid')).toHaveTextContent('2');
    expect(screen.getByText('2 baris')).toBeInTheDocument();
  });

  it('menampilkan jumlah baris terpilih setelah baris dipilih', async () => {
    const user = userEvent.setup();
    tampilkan();

    await user.click(screen.getByRole('button', { name: 'pilih-1' }));

    expect(screen.getByTestId('dipilih-grid')).toHaveTextContent('1');
    expect(screen.getByText('2 baris · 1 dipilih')).toBeInTheDocument();
  });

  it('mengabarkan baris tercentang ke halaman sebagai baris domain', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    tampilkan({ onCheckedChange });

    await user.click(screen.getByRole('button', { name: 'pilih-1' }));

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange.mock.calls[0][0]).toEqual([rows[0]]);
  });

  it('menerapkan preset kolom: hanya kolom di preset dan urut sesuai preset', async () => {
    const user = userEvent.setup();
    const onApplyPreset = vi.fn();
    tampilkan({ fields: DUA_KOLOM, onApplyPreset });

    expect(screen.getByTestId('kolom-grid')).toHaveTextContent('nama,nis');

    await user.click(screen.getByRole('button', { name: 'Area filter' }));
    await user.click(screen.getByRole('button', { name: 'terapkan-preset' }));

    expect(screen.getByTestId('kolom-grid')).toHaveTextContent('nama');
    expect(onApplyPreset).toHaveBeenCalledWith(['nama'], 7);
  });

  it('menyembunyikan pemilih preset kolom saat hidePreset', async () => {
    const user = userEvent.setup();
    tampilkan({ hidePreset: true });

    await user.click(screen.getByRole('button', { name: 'Area filter' }));
    expect(screen.queryByTestId('preset-kolom')).toBeNull();
    expect(screen.getByTestId('preset-urut')).toBeInTheDocument();
  });

  it('meneruskan opsi tabel ringkas ke grid tanpa mengubah bawaan', () => {
    const aksi = () => <span />;
    const bawaan = tampilkan({ renderActions: aksi });
    expect(bawaan.getByTestId('hide-checkbox')).toHaveTextContent('false');
    expect(bawaan.getByTestId('ada-aksi')).toHaveTextContent('true');

    const ringkas = tampilkan({ renderActions: aksi, hideCheckbox: true, hideActions: true });
    const cariRingkas = within(ringkas.container);
    expect(cariRingkas.getByTestId('hide-checkbox')).toHaveTextContent('true');
    expect(cariRingkas.getByTestId('ada-aksi')).toHaveTextContent('false');
  });

  it('meneruskan baris aktif dan memanggil onBarisKlik dengan baris domain', async () => {
    const user = userEvent.setup();
    const onBarisKlik = vi.fn();
    tampilkan({ onBarisKlik, barisAktifId: 2 });

    expect(screen.getByTestId('baris-aktif')).toHaveTextContent('2');

    await user.click(screen.getByRole('button', { name: 'baris-1' }));
    expect(onBarisKlik).toHaveBeenCalledWith(rows[0]);
  });

  it('judul isian pengguna menang atas prop judul', () => {
    presetState.judulDb = 'Kelas Kustom';
    tampilkan();

    expect(screen.getByText('Kelas Kustom')).toBeInTheDocument();
    expect(screen.queryByText('Daftar kelas')).toBeNull();
  });

  it('meneruskan label kustom dan perataan tabel ke grid', () => {
    presetState.labelDb = { nama: 'Nama Santri' };
    presetState.alignDb = { nama: 'right' };
    tampilkan({ fields: DUA_KOLOM });

    expect(screen.getByTestId('label-db').textContent).toBe('{"nama":"Nama Santri"}');
    expect(screen.getByTestId('align-db').textContent).toBe('{"nama":"right"}');
  });
});
