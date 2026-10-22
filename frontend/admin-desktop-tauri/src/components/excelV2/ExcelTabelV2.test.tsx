import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ExcelTabelV2 from './ExcelTabelV2';
import type { ExcelField } from '@/components/excel/types';

const { presetState, halamanState, apiPreset, toastMock, gridState } = vi.hoisted(() => ({
  presetState: {
    judulDb: null as string | null,
    labelDb: {} as Record<string, string>,
    alignDb: {} as Record<string, 'left' | 'center' | 'right'>,
    visibilitas: {} as Record<string, boolean>,
    infoHtmlDb: null as string | null,
    urutanDb: [] as string[] | null,
    simpanUrutan: vi.fn(),
  },
  halamanState: { superAdmin: true, terdaftar: true },
  apiPreset: {
    listPresetTabel: vi.fn(),
    updatePresetTabel: vi.fn(),
    setPresetAktif: vi.fn(),
  },
  toastMock: { error: vi.fn(), success: vi.fn() },
  gridState: { onPindahKolom: null as null | ((urutan: string[]) => void) },
}));

vi.mock('@/lembagaAktif', () => ({
  useLembagaAktif: () => ({ efektifSuper: halamanState.superAdmin }),
}));

vi.mock('@/components/VisibilitasFilter', () => ({
  useVisibilitasFilter: () => halamanState.terdaftar
    ? { registrasi: { pageKey: 'daftar_kelas', tabel: [], filterRelevan: [], bawaan: {}, modeBawaan: {} } }
    : null,
}));

vi.mock('@/components/GridPrefs', async (asli) => ({
  ...(await asli<typeof import('@/components/GridPrefs')>()),
  useGridPrefs: () => ({ rowH: null, headerH: null, fontPx: 12, fontFamily: null }),
}));

vi.mock('@/components/FilterRail', () => ({
  default: ({ tinggiLabel }: { tinggiLabel?: number }) => (
    <aside data-testid="filter-rail" data-tinggi={String(tinggiLabel ?? '')} />
  ),
}));

vi.mock('@/components/kelolaTabel/DialogKelolaTabel', () => ({
  default: ({ open, ringkas }: { open: boolean; ringkas?: boolean }) => (
    open ? <div data-testid="dialog-kelola" data-ringkas={String(!!ringkas)} /> : null
  ),
}));

vi.mock('@/components/excel/useToolbarPreset', () => ({
  useToolbarPresetState: () => presetState,
}));

vi.mock('@/api/preset', () => ({
  listPresetTabel: apiPreset.listPresetTabel,
  updatePresetTabel: apiPreset.updatePresetTabel,
  setPresetAktif: apiPreset.setPresetAktif,
}));

vi.mock('sonner', () => ({ toast: toastMock }));

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
      <button type="button" onClick={() => onApply(['nis', 'nama'], 7)}>terapkan-preset-urut</button>
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
    hideHeader,
    labelDb,
    alignDb,
    renderActions,
    barisAktifId,
    onBarisAktif,
    maxRows,
    onTinggiHeaderChange,
    onPindahKolom,
  }: {
    fields: { key: string }[];
    rows: { id: string | number }[];
    dipilih: ReadonlySet<string | number>;
    onTogglePilih: (id: string | number) => void;
    hideCheckbox?: boolean;
    hideHeader?: boolean;
    labelDb?: Record<string, string>;
    alignDb?: Record<string, string>;
    renderActions?: (id: string | number) => unknown;
    barisAktifId?: string | number | null;
    onBarisAktif?: (id: string | number) => void;
    maxRows?: number;
    onTinggiHeaderChange?: (tinggi: number) => void;
    onPindahKolom?: (urutan: string[]) => void;
  }) => {
    gridState.onPindahKolom = onPindahKolom ?? null;
    return (
      <div data-slot="excel-table-grid">
        <span data-testid="jumlah-grid">{rows.length}</span>
        <span data-testid="dipilih-grid">{[...dipilih].join(',')}</span>
        <span data-testid="kolom-grid">{fields.map((f) => f.key).join(',')}</span>
        <span data-testid="hide-checkbox">{String(!!hideCheckbox)}</span>
        <span data-testid="hide-header">{String(!!hideHeader)}</span>
        <span data-testid="ada-aksi">{String(!!renderActions)}</span>
        <span data-testid="baris-aktif">{String(barisAktifId ?? '')}</span>
        <span data-testid="label-db">{JSON.stringify(labelDb ?? {})}</span>
        <span data-testid="align-db">{JSON.stringify(alignDb ?? {})}</span>
        <span data-testid="max-rows-grid">{String(maxRows ?? '')}</span>
        <button type="button" onClick={() => onTogglePilih(1)}>pilih-1</button>
        <button type="button" onClick={() => onBarisAktif?.(1)}>baris-1</button>
        <button type="button" onClick={() => onTinggiHeaderChange?.(52)}>ubah-tinggi-header</button>
        <button type="button" onClick={() => onPindahKolom?.(['nama', 'nis'])}>pindah-kolom</button>
      </div>
    );
  },
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
  presetState.visibilitas = {};
  presetState.infoHtmlDb = null;
  presetState.urutanDb = [];
  presetState.simpanUrutan.mockClear();
  halamanState.superAdmin = true;
  halamanState.terdaftar = true;
  gridState.onPindahKolom = null;
  toastMock.error.mockClear();
  toastMock.success.mockClear();
  apiPreset.listPresetTabel.mockReset().mockResolvedValue({
    data: { presets: [], aktif_preset_id: null, aktif_kolom: null },
  });
  apiPreset.updatePresetTabel.mockReset().mockResolvedValue({ pesan: 'ok', data: [] });
  apiPreset.setPresetAktif.mockReset().mockResolvedValue({ pesan: 'ok' });
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

  it('menyembunyikan footer pada tabel ringkas baca-saja', () => {
    const { container } = tampilkan({ hideFooter: true });
    expect(container.querySelector('[data-slot="table-footer"]')).toBeNull();
    expect(screen.queryByText('2 baris')).toBeNull();
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
    const { container } = tampilkan({ filter: <span data-testid="filter-halaman" />, onUrut: () => {} });
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
    tampilkan({ hidePreset: true, onUrut: () => {} });

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

  it('menghormati visibilitas judul, centang, header, dan pager', () => {
    presetState.visibilitas = {
      judul_tabel: false,
      kolom_centang: false,
      header_kolom: false,
      pager: false,
    };
    tampilkan({ pager: <span data-testid="pager" /> });

    expect(screen.queryByText('Daftar kelas')).toBeNull();
    expect(screen.getByTestId('hide-checkbox')).toHaveTextContent('true');
    expect(screen.getByTestId('hide-header')).toHaveTextContent('true');
    expect(screen.queryByTestId('pager')).toBeNull();
  });

  it('menampilkan pager secara bawaan', () => {
    tampilkan({ pager: <span data-testid="pager" /> });
    expect(screen.getByTestId('pager')).toBeInTheDocument();
  });

  it('membuka Kelola Tabel ringkas dari gerigi', async () => {
    const user = userEvent.setup();
    tampilkan();

    await user.click(screen.getByRole('button', { name: 'Pengaturan tabel' }));

    expect(screen.getByTestId('dialog-kelola')).toHaveAttribute('data-ringkas', 'true');
  });

  it('menyembunyikan gerigi saat sakelar tombol_pengaturan mati', () => {
    presetState.visibilitas = { tombol_pengaturan: false };
    tampilkan();

    expect(screen.queryByRole('button', { name: 'Pengaturan tabel' })).toBeNull();
  });

  it('menampilkan judul dari header node dan mengalahkan judul teks', () => {
    tampilkan({ judul: 'Judul teks', header: <span data-testid="header-halaman">MI Only</span> });

    expect(screen.getByTestId('header-halaman')).toHaveTextContent('MI Only');
    expect(screen.queryByText('Judul teks')).toBeNull();
  });

  it('judul setelan pengguna mengalahkan header node', () => {
    presetState.judulDb = 'Judul dari setelan';
    tampilkan({ judul: 'Judul teks', header: <span data-testid="header-halaman">MI Only</span> });

    expect(screen.getByText('Judul dari setelan')).toBeInTheDocument();
    expect(screen.queryByTestId('header-halaman')).toBeNull();
  });

  it('jatuh ke judul teks bila header tidak diberikan', () => {
    tampilkan({ judul: 'Daftar kelas' });

    expect(screen.getByText('Daftar kelas')).toBeInTheDocument();
  });

  it('jatuh ke judul bawaan tableKey bila judul dan header kosong', () => {
    render(
      <ExcelTabelV2
        tableKey="mi_md_mi"
        fields={DUA_KOLOM}
        rows={rows}
        getValues={(r) => ({ nama: r.nama })}
        onApplyPreset={() => {}}
      />,
    );

    expect(screen.getByText('MI Only')).toBeInTheDocument();
  });

  it('tidak menampilkan rail secara bawaan', () => {
    tampilkan();

    expect(screen.queryByTestId('filter-rail')).toBeNull();
  });

  it('menampilkan rail dengan tinggi label mengikuti header grid saat rail aktif', () => {
    tampilkan({ rail: true });

    const rail = screen.getByTestId('filter-rail');
    expect(rail).toBeInTheDocument();
    expect(rail).toHaveAttribute('data-tinggi', '26');
  });

  it('memperbarui tinggi label rail saat tinggi header grid berubah', async () => {
    const user = userEvent.setup();
    tampilkan({ rail: true });

    await user.click(screen.getByRole('button', { name: 'ubah-tinggi-header' }));

    expect(screen.getByTestId('filter-rail')).toHaveAttribute('data-tinggi', '52');
  });

  it('meneruskan maxRows dan membuat root tabel ringkas tidak mengambil sisa tinggi', () => {
    const { container } = tampilkan({ maxRows: 3 });

    expect(screen.getByTestId('max-rows-grid')).toHaveTextContent('3');
    const root = container.querySelector('[data-slot="excel-table"]');
    // Pengecualian struktural yang disengaja: jsdom tidak menghitung layout,
    // jadi kelas flex adalah satu-satunya sinyal stabil bahwa tabel ringkas
    // tidak mengambil sisa tinggi. Perilaku tinggi grid sendiri diuji di
    // GridV2.test (data-max-rows + tinggi).
    expect(root).toHaveClass('shrink-0');
    expect(root).not.toHaveClass('flex-1');
  });

  it('menyembunyikan rail saat sakelar rel_filter mati', () => {
    presetState.visibilitas = { rel_filter: false };
    tampilkan({ rail: true });

    expect(screen.queryByTestId('filter-rail')).toBeNull();
  });

  it('menampilkan tombol aksi utama secara langsung secara bawaan', () => {
    tampilkan({ addButton: <button type="button">Tambah</button> });

    expect(screen.getByRole('button', { name: 'Tambah' })).toBeInTheDocument();
  });

  it('membungkus tombol aksi utama jadi menu Aksi saat addButtonLangsung false', () => {
    tampilkan({
      addButton: <button type="button">Tambah</button>,
      addButtonLangsung: false,
    });

    expect(screen.queryByRole('button', { name: 'Tambah' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Aksi' })).toBeInTheDocument();
  });

  it('menyembunyikan tombol aksi utama saat sakelar tombol_aksi mati', () => {
    presetState.visibilitas = { tombol_aksi: false };
    tampilkan({ addButton: <button type="button">Tambah</button> });

    expect(screen.queryByRole('button', { name: 'Tambah' })).toBeNull();
  });

  it('menampilkan kontrol awalan dan akhir toolbar halaman', () => {
    tampilkan({
      awalanToolbar: <span data-testid="awalan">awalan</span>,
      akhirToolbar: <span data-testid="akhir">akhir</span>,
    });

    expect(screen.getByTestId('awalan')).toBeInTheDocument();
    expect(screen.getByTestId('akhir')).toBeInTheDocument();
  });

  it('memanggil aksi massal hanya saat ada baris tercentang lalu mengosongkan pilihan', async () => {
    const user = userEvent.setup();
    const aksi = vi.fn((checked: { id: number }[], clear: () => void) => (
      <button type="button" onClick={clear}>Bulk ({checked.length})</button>
    ));
    tampilkan({ renderBulkActions: aksi });

    expect(aksi).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Bulk/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'pilih-1' }));

    expect(await screen.findByRole('button', { name: 'Bulk (1)' })).toBeInTheDocument();
    expect(aksi).toHaveBeenCalledWith([rows[0]], expect.any(Function));

    await user.click(screen.getByRole('button', { name: 'Bulk (1)' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: /Bulk/ })).toBeNull());
    expect(screen.getByTestId('dipilih-grid')).toHaveTextContent('');
  });

  it('rail tetap dirender untuk halaman apa pun supaya FilterRail sendiri yang menyembunyikan diri bila tak relevan', () => {
    // V2 tidak menebak relevansi tingkat/kelas; keputusan itu milik FilterRail
    // lewat useVisibilitasFilter().filterRelevan.
    tampilkan({ rail: true });

    expect(screen.getByTestId('filter-rail')).toBeInTheDocument();
  });

  it('rail kembali tampil setelah sakelar rel_filter dinyalakan lagi', () => {
    presetState.visibilitas = { rel_filter: false };
    const { rerender } = tampilkan({ rail: true });
    expect(screen.queryByTestId('filter-rail')).toBeNull();

    presetState.visibilitas = { rel_filter: true };
    rerender(
      <ExcelTabelV2
        judul="Daftar kelas"
        tableKey="daftar_kelas"
        fields={[]}
        rows={rows}
        getValues={(r) => ({ nama: r.nama })}
        onApplyPreset={() => {}}
        rail
      />,
    );

    expect(screen.getByTestId('filter-rail')).toBeInTheDocument();
  });

  it('menampilkan info tabel di popover', async () => {
    presetState.infoHtmlDb = '<p>Info penting</p>';
    const user = userEvent.setup();
    tampilkan();

    await user.click(screen.getByRole('button', { name: 'Info tabel' }));

    expect(await screen.findByText('Info penting')).toBeInTheDocument();
  });
});

describe('ExcelTabelV2 — urutan kolom dan preset aktif', () => {
  it('memakai urutan tabel tersimpan saat tidak ada preset aktif', async () => {
    presetState.urutanDb = ['nis', 'nama'];
    tampilkan({ fields: DUA_KOLOM });

    await waitFor(() => expect(screen.getByTestId('kolom-grid')).toHaveTextContent('nis,nama'));
  });

  it('memuat preset aktif saat mount walau area filter tertutup', async () => {
    apiPreset.listPresetTabel.mockResolvedValueOnce({
      data: {
        presets: [{ id: 7, table_key: 'daftar_kelas', nama: 'Urut', kolom: ['nis', 'nama'] }],
        aktif_preset_id: 7,
        aktif_kolom: null,
      },
    });
    tampilkan({ fields: DUA_KOLOM });

    await waitFor(() => expect(screen.getByTestId('kolom-grid')).toHaveTextContent('nis,nama'));
  });

  it('menyimpan urutan hasil geser ke preset aktif', async () => {
    const user = userEvent.setup();
    tampilkan({ fields: DUA_KOLOM });
    await user.click(screen.getByRole('button', { name: 'Area filter' }));
    await user.click(screen.getByRole('button', { name: 'terapkan-preset-urut' }));
    expect(screen.getByTestId('kolom-grid')).toHaveTextContent('nis,nama');

    act(() => { gridState.onPindahKolom?.(['nama', 'nis']); });
    await waitFor(() => expect(apiPreset.updatePresetTabel).toHaveBeenCalledWith(7, { kolom: ['nama', 'nis'] }));
    expect(screen.getByTestId('kolom-grid')).toHaveTextContent('nama,nis');
  });

  it('mengembalikan urutan jika simpan preset gagal', async () => {
    const user = userEvent.setup();
    apiPreset.updatePresetTabel.mockRejectedValueOnce(new Error('gagal simpan'));
    tampilkan({ fields: DUA_KOLOM });
    await user.click(screen.getByRole('button', { name: 'Area filter' }));
    await user.click(screen.getByRole('button', { name: 'terapkan-preset-urut' }));

    act(() => { gridState.onPindahKolom?.(['nama', 'nis']); });
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(screen.getByTestId('kolom-grid')).toHaveTextContent('nis,nama');
  });

  it('menyimpan urutan global saat tidak ada preset', () => {
    tampilkan({ fields: DUA_KOLOM });

    gridState.onPindahKolom?.(['nis', 'nama']);
    expect(presetState.simpanUrutan).toHaveBeenCalledWith(['nis', 'nama']);
  });
});
