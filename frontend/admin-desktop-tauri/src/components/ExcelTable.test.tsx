import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import ExcelTable, { diCornerButton, type ExcelTableProps } from './ExcelTable';
import { renderDenganTema } from '@/test/utils';

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
  arahKolomDariOpsi: vi.fn(() => undefined),
}));

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

describe('ExcelTable — corner button (sudut kiri-atas)', () => {
  it('mengenali sel header gutter (dengan segitiga) sebagai corner button', () => {
    const sel = document.createElement('div');
    sel.className = 'dsg-cell dsg-cell-gutter dsg-cell-header';
    const segitiga = document.createElement('span');
    segitiga.className = 'dsg-corner-indicator';
    sel.appendChild(segitiga);

    // Klik tepat di segitiga maupun di selnya sama-sama dikenali.
    expect(diCornerButton(segitiga)).toBe(true);
    expect(diCornerButton(sel)).toBe(true);
  });

  it('bukan corner button: header kolom, sel data, dan target kosong', () => {
    const header = document.createElement('div');
    header.className = 'dsg-cell dsg-cell-header';
    const selData = document.createElement('div');
    selData.className = 'dsg-cell';

    expect(diCornerButton(header)).toBe(false);
    expect(diCornerButton(selData)).toBe(false);
    expect(diCornerButton(null)).toBe(false);
  });
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

describe('ExcelTable — klik kanan baris', () => {
  /** Elemen baris grid yang memuat teks tertentu. Cakupannya dibatasi ke
   *  container tabel: span pengukur AutoFit di luar container ikut memuat
   *  nilai sel yang sama. */
  function baris(root: HTMLElement, nama: string): HTMLElement {
    const el = within(root).getByText(nama).closest('.dsg-row');
    expect(el).not.toBeNull();
    return el as HTMLElement;
  }

  it('menu konteks baris kedua menunjuk baris itu sendiri, bukan baris berikutnya', async () => {
    const { container } = renderTabel();

    fireEvent.contextMenu(baris(container, 'Budi'));

    const menu = await screen.findByRole('menu');
    expect(menu).toHaveTextContent('Budi');
    expect(menu).not.toHaveTextContent('Ahmad');
  });

  it('klik kanan pada baris terakhir tetap membuka menu', async () => {
    const { container } = renderTabel();

    fireEvent.contextMenu(baris(container, 'B-02'));

    const menu = await screen.findByRole('menu');
    expect(menu).toHaveTextContent('Budi');
  });
});

describe('penanda kelas grid yang dibaca CSS', () => {
  /** CSS index.css memakai `simpes-dsg-bleed` untuk tahu tepi kiri grid ada di
   *  luar bingkai panel (pasangan `-mx-1`) — kalau penanda ini lepas dari
   *  kondisinya, aturan tepi kiri tabel di panel jadi salah sasaran. */
  const kelasGrid = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('.simpes-dsg')?.className ?? '';

  it('tanpa bar judul (mis. hidePreset): grid bleed — `-mx-1` + penanda `simpes-dsg-bleed`', () => {
    const { container } = renderTabel({ hidePreset: true });
    expect(kelasGrid(container)).toContain('-mx-1');
    expect(kelasGrid(container)).toContain('simpes-dsg-bleed');
  });

  it('bar judul tampil: tak bleed, penandanya ikut hilang', () => {
    const { container } = renderTabel();
    expect(kelasGrid(container)).not.toContain('simpes-dsg-bleed');
  });

  it('pemilik judul (judulPemilik): tak bleed walau tanpa bar judul', () => {
    const { container } = renderTabel({ hidePreset: true, judulPemilik: true });
    expect(kelasGrid(container)).not.toContain('-mx-1');
    expect(kelasGrid(container)).not.toContain('simpes-dsg-bleed');
  });
});

describe('ExcelTable — tombol ikon kaki tabel', () => {
  it('tombol "Tambah baris" hanya tampil bila ada onCreateRow, dan kliknya menyalakan mode Input', async () => {
    const { unmount } = renderTabel();
    expect(screen.queryByLabelText('Tambah baris baru')).not.toBeInTheDocument();
    unmount();

    renderTabel({ onCreateRow: vi.fn(async () => {}) });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Tambah baris baru'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Mode Input aktif'));
    // Digantikan baris isian di ujung bawah grid.
    expect(screen.queryByLabelText('Tambah baris baru')).not.toBeInTheDocument();
  });

  it('tombol mode Edit menyalakan mode Edit', async () => {
    renderTabel();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Aktifkan mode Edit'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Mode Edit aktif'));
    expect(screen.queryByLabelText('Aktifkan mode Edit')).not.toBeInTheDocument();
  });
});

describe('ExcelTable — tinggi grid mengisi sisa ruang', () => {
  /** jsdom tak punya layout; tiru tinggi elemen lewat getter `clientHeight`.
   *  Wrapper grid (`.simpes-dsg`) 203 px, elemen lain 231 px — selisih 28 px itu
   *  tinggi bilah judul yang jadi jebakan saat mengukur PARENT. */
  async function denganTinggiTiruan(fn: () => Promise<void>) {
    const asli = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains('simpes-dsg') ? 203 : 231;
      },
    });
    try {
      await fn();
    } finally {
      if (asli) Object.defineProperty(HTMLElement.prototype, 'clientHeight', asli);
    }
  }

  it('pakai ruang wrapper, bukan parent yang ikut menghitung bilah judul', async () => {
    await denganTinggiTiruan(async () => {
      // `container`: pengukuran AutoFit juga memakai simpul `.simpes-dsg` di luar
      // pohon ini, jadi kueri harus dibatasi ke wadah hasil render.
      const { container } = renderTabel();
      const wrap = container.querySelector('.simpes-dsg') as HTMLElement;
      const kartu = wrap.querySelector('.simpes-dsg-kartu') as HTMLElement;

      // Tinggi kartu = ruang wrapper (203), bukan tinggi parent (231, sudah
      // termasuk bilah judul) — kalau 231 dipakai, 28 px tabel meluber ke bawah.
      await waitFor(() => expect(kartu.style.height).toBe('203px'));
    });
  });

  it('wrapper mode isi-penuh tanpa lantai tinggi tetap', () => {
    const { container } = renderTabel();
    const kelas = (container.querySelector('.simpes-dsg') as HTMLElement).className;

    // Lantai `min-h-[280px]` menahan wrapper saat panel resizable lebih pendek
    // dari 280 px sehingga kartu melewati dasar panel.
    expect(kelas).not.toContain('min-h-[280px]');
    expect(kelas).toContain('min-h-0');
    expect(kelas).toContain('flex-1');
  });

  it('tabel kompak (maxRows) tetap mengikuti isi, bukan ruang kosong', () => {
    const { container } = renderTabel({ maxRows: 3 });
    const kelas = (container.querySelector('.simpes-dsg') as HTMLElement).className;
    expect(kelas).toContain('shrink-0');
  });
});

describe('ExcelTable — klik ganda sel', () => {
  it('klik ganda sel memunculkan pill Mode Edit', async () => {
    renderTabel();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // Mode Edit dinyalakan lewat klik ganda sel.
    fireEvent.doubleClick(screen.getByText('Ahmad'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Mode Edit aktif'));
  });
});
