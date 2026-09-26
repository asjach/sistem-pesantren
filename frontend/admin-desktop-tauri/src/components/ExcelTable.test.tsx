import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import ExcelTable, { type ExcelTableProps } from './ExcelTable';
import { RibbonTableProvider, useRibbonTable, type RibbonTableApi } from '@/components/RibbonTable';
import { renderDenganTema, PembungkusTema } from '@/test/utils';

// ---- Mock API (unit test tidak boleh memanggil fetch nyata) ----

vi.mock('@/api/toolbarPreset', () => ({
  muatToolbarPreset: vi.fn(async () => ({
    pesan: 'ok',
    data: { table_key: 'uji', visibilitas: {}, lebar: {}, urutan: [] },
  })),
  simpanToolbarPreset: vi.fn(async () => ({ pesan: 'ok', data: null })),
}));

vi.mock('@/api/preset', () => ({
  listPresetTabel: vi.fn(async () => ({ pesan: 'ok', data: [] })),
  createPresetTabel: vi.fn(),
  updatePresetTabel: vi.fn(),
  deletePresetTabel: vi.fn(),
  setPresetAktif: vi.fn(),
  setPresetBawaan: vi.fn(),
}));

vi.mock('@/api/urutPreset', () => ({
  muatUrutPreset: vi.fn(async () => ({ pesan: 'ok', data: { table_key: 'uji', opsi: [], tersedia: [] } })),
  simpanUrutPreset: vi.fn(),
  hapusUrutPreset: vi.fn(),
}));

vi.mock('@/api/kamusLabel', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/kamusLabel')>();
  return { ...asli, petaKolom: vi.fn(async () => ({})) };
});

// ---- Stub jsdom untuk react-datasheet-grid ----

vi.mock('react-datasheet-grid', async (importOriginal) => {
  const asli = await importOriginal<typeof import('react-datasheet-grid')>();
  const stub = await import('./excel/_dsgStubDom');
  return {
    ...asli,
    DynamicDataSheetGrid: stub.DynamicDataSheetGridStub,
  };
});

// ---- Fixtures ----

interface Baris {
  id: string;
  nama: string | null;
  kode: string | null;
}

const fields = [
  { key: 'nama', label: 'Nama', kind: 'text' as const },
  { key: 'kode', label: 'Kode', kind: 'text' as const },
];

const rows: Baris[] = [
  { id: '1', nama: 'Ahmad', kode: 'A-01' },
  { id: '2', nama: 'Budi', kode: 'B-02' },
];

const getValues = (r: Baris) => ({ nama: r.nama, kode: r.kode });

function renderTabel(props: Partial<ExcelTableProps<Baris>> = {}) {
  return renderDenganTema(
    <ExcelTable<Baris>
      tableKey="uji"
      fields={fields}
      rows={rows}
      getValues={getValues}
      canEdit
      onCommit={vi.fn(async () => {})}
      onSaved={vi.fn()}
      renderActions={() => <button type="button">Aksi-uji</button>}
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('ExcelTable', () => {
  it('merender judul header (judulTabel), kolom Aksi, dan isi sel', async () => {
    renderTabel();

    expect(screen.getByText('Uji')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Aksi-uji').length).toBe(2));
    expect(screen.getByText('Ahmad')).toBeInTheDocument();
    expect(screen.getAllByText('B-02').length).toBeGreaterThan(0);
  });

  it('menimpa judul header lewat prop header', () => {
    renderTabel({ header: <span>Judul Kustom</span> });

    expect(screen.getByText('Judul Kustom')).toBeInTheDocument();
    expect(screen.queryByText('Uji')).not.toBeInTheDocument();
  });

  it('menampilkan emptyText saat rows kosong', () => {
    renderTabel({ rows: [], emptyText: 'Tidak ada data uji.' });

    expect(screen.getByText('Tidak ada data uji.')).toBeInTheDocument();
  });

  it('hideCheckbox dan hideActions menyembunyikan kolom centang & Aksi', async () => {
    const { container } = renderTabel({ hideCheckbox: true, hideActions: true });

    expect(container.querySelector('[data-col-key="check"]')).toBeNull();
    expect(container.querySelector('[data-col-key="__aksi"]')).toBeNull();
    await waitFor(() => expect(screen.getByText('A-01')).toBeInTheDocument());
  });

  it('menampilkan kontrol toolbar di baris judul, bukan baris toolbar', async () => {
    const { container } = renderTabel({
      awalanToolbar: <span>Awal uji</span>,
      akhirToolbar: <span>Akhir uji</span>,
      tengah: <span>Info tengah uji</span>,
      renderBulkActions: (checked) => (
        <button type="button">Bulk uji ({checked.length})</button>
      ),
    });
    const kotak = container.querySelector('input.dsg-checkbox[data-row-id="1"]');
    expect(kotak).not.toBeNull();
    fireEvent.click(kotak as HTMLElement);

    await waitFor(() => expect(screen.getByText('Bulk uji (1)')).toBeInTheDocument());
    expect(container.querySelector('[data-part="toolbar_tabel"]')).toBeNull();
    const header = screen.getByText('Bulk uji (1)').closest('[data-part="header_tabel"]');
    expect(header).not.toBeNull();
    expect(header).toHaveTextContent('Awal uji');
    expect(header).toHaveTextContent('Akhir uji');
    expect(header).toHaveTextContent('Info tengah uji');
  });
});

describe('ExcelTable × RibbonTableProvider', () => {
  it('mendaftarkan tabel; mode Edit dari ribbon memunculkan pill mode', async () => {
    const status = { ada: false, editMode: false };
    let apiTerakhir: RibbonTableApi | null = null;

    /** Konsumen kecil di dalam provider: membaca status & API tabel aktif. */
    function RibbonProbe() {
      const ribbon = useRibbonTable();
      status.ada = ribbon?.api != null;
      status.editMode = ribbon?.api?.editMode ?? false;
      if (ribbon?.api) apiTerakhir = ribbon.api;
      return null;
    }

    render(
      <PembungkusTema>
        <RibbonTableProvider>
          <ExcelTable<Baris>
            tableKey="uji"
            fields={fields}
            rows={rows}
            getValues={getValues}
            canEdit
            onCommit={vi.fn(async () => {})}
            onSaved={vi.fn()}
            renderActions={() => null}
            tengah={<span>10 baris</span>}
          />
          <RibbonProbe />
        </RibbonTableProvider>
      </PembungkusTema>,
    );

    await waitFor(() => expect(status.ada).toBe(true));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    // Nyalakan mode Edit seperti tombol ribbon (tanpa interaksi DOM grid DSG).
    apiTerakhir!.setEditMode(true);
    await waitFor(() => expect(status.editMode).toBe(true));
    expect(screen.getByRole('status')).toHaveTextContent('Mode Edit aktif');
  });
});
