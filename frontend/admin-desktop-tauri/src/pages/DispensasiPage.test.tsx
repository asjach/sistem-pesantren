import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentPropsWithoutRef } from 'react';
import { toast } from 'sonner';

import DispensasiPage from './DispensasiPage';
import { CariGlobalProvider } from '@/hooks/useCariGlobal';
import { TopBarSearchProvider, useTopBarSearchCtx } from '@/components/TopBarSearch';
import { renderDenganTema } from '@/test/utils';
import type { Dispensasi, RekapDispensasiCrosstab } from '@/api/keuangan';
import { hapusDispensasi, kuotaPakai, ubahDispensasi } from '@/api/keuangan';

// Halaman berisi tiga grid. Tangkap active-cell callback milik daftar paket
// saja; stub tidak mensimulasikan geometri pointer atau navigasi DSG fisik.
const paketGrid = vi.hoisted(() => ({
  aktif: null as null | ((opts: { cell: { row: number } | null }) => void),
}));

/** Kunci pref tab halaman: permukaan perilaku "ingat tab terakhir". */
const KUNCI_TAB = 'simpes_dispensasi_tab';

const uji = vi.hoisted(() => {
  const DISPENSASI = [
    {
      id: 11,
      nama: 'Khusus MI',
      keterangan: null,
      tahun_ajaran: '2025/2026',
      kuota_bulan: null,
      grup: null,
      jenjang: 'MI',
      is_active: true,
      santri_ids: [],
      aturan: [],
    },
  ] as unknown as Dispensasi[];
  /** Rekap crosstab: satu baris (paket Khusus MI di MI) × satu kolom jenis. */
  const REKAP = {
    kolom: [{ key: 'jenis-1', jenis_id: 1, jenis_nama: 'Infaq Bulanan' }],
    baris: [
      {
        id: 'MI|2025/2026|11', jenjang: 'MI', tahun_ajaran: '2025/2026',
        paket_id: 11, paket: 'Khusus MI',
        total_potongan: 50000, total_kotor: 100000, jumlah_tagihan: 2, jumlah_penerima: 1,
        sel: {
          'jenis-1': { potongan: 50000, kotor: 100000, tarif: 150000, persen: 50, jumlah_tagihan: 2 },
        },
      },
    ],
  } as unknown as RekapDispensasiCrosstab;
  return {
    bolehUbah: true,
    DISPENSASI,
    REKAP,
    daftarDispensasi: vi.fn(async () => DISPENSASI),
    rekapDispensasiCrosstab: vi.fn(async () => REKAP),
  };
});

function paketDenganPenerima(): Dispensasi {
  return {
    ...uji.DISPENSASI[0], kuota_bulan: 3, santri_ids: [7, 8],
    aturan: [{ id: 1, dispensasi_id: 11, jenis_id: 2, tipe: 'persen', nilai: 50 }],
    santri_tambahan: [7, 8].map((id) => ({
      id, nama_lengkap: id === 7 ? 'Ani Penerima' : 'Budi Penerima',
      nama_singkat: null, nik: null, nisn: null, tmp_lahir: null,
      tgl_lahir: null, jk: 'L', tipe_santri: null, is_active_pst: 'Ya', lembaga_aktif: [],
    })),
  };
}

async function pilihPaketPertama() {
  renderHalaman();
  await tabSiap();
  await waitFor(() => expect(paketGrid.aktif).toBeTypeOf('function'));
  await act(async () => { paketGrid.aktif?.({ cell: { row: 0 } }); });
  await screen.findByText('Daftar Penerima Khusus MI (2)');
}

function panelPenerima() {
  // Header panel punya ID publik; tabel belum mempunyai region label.
  return within(document.getElementById('judul_penerima_dispensasi')!.closest('[data-slot="excel-table"]') as HTMLElement);
}

describe('DispensasiPage — panel penerima V2', () => {
  it('menjaga kuota, pencarian, dan aksi massal hanya untuk paket yang sedang ditampilkan', async () => {
    const paket = paketDenganPenerima();
    uji.daftarDispensasi.mockResolvedValue([paket, { ...paket, id: 12, nama: 'Tanpa Kuota', kuota_bulan: null }]);
    vi.mocked(kuotaPakai).mockResolvedValue({ 7: { 11: 1 }, 8: { 11: 5 } });
    await pilihPaketPertama();
    await waitFor(() => expect(panelPenerima().getByText('2/3')).toBeInTheDocument());
    expect(panelPenerima().getByText('0/3')).toBeInTheDocument();
    expect(panelPenerima().getByText('Sisa Kuota')).toBeInTheDocument();
    const cari = screen.getByRole('searchbox', { name: 'Cari nama / NIS…' });
    await userEvent.type(cari, 'Ani');
    expect(await screen.findByText('Daftar Penerima Khusus MI (1)')).toBeInTheDocument();
    expect(panelPenerima().queryByText('Budi Penerima')).toBeNull();
    await userEvent.clear(cari);
    await screen.findByText('Daftar Penerima Khusus MI (2)');
    await userEvent.click(panelPenerima().getByRole('checkbox', { name: 'Pilih baris 11:7' }));
    expect(screen.getByRole('button', { name: 'Keluarkan (1)' })).toBeInTheDocument();
    await act(async () => { paketGrid.aktif?.({ cell: { row: 1 } }); });
    await screen.findByText('Daftar Penerima Tanpa Kuota (2)');
    expect(panelPenerima().queryByText('Sisa Kuota')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Keluarkan (1)' })).toBeNull();
    expect(ubahDispensasi).not.toHaveBeenCalled();
  });

  it('keluarkan lewat button/klik kanan menjaga penerima saat gagal dan payload paket saat sukses', async () => {
    const paket = paketDenganPenerima();
    uji.daftarDispensasi.mockResolvedValue([paket]);
    await pilihPaketPertama();
    vi.mocked(ubahDispensasi).mockRejectedValueOnce(new Error('Gagal mengeluarkan penerima.'));
    await userEvent.click(panelPenerima().getByRole('button', { name: 'Keluarkan Ani Penerima' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Gagal mengeluarkan penerima.'));
    expect(screen.getByText('Daftar Penerima Khusus MI (2)')).toBeInTheDocument();
    uji.daftarDispensasi.mockResolvedValue([{
      ...paket, santri_ids: [8], santri_tambahan: paket.santri_tambahan!.filter((s) => s.id === 8),
    }]);
    fireEvent.contextMenu(panelPenerima().getByText('Ani Penerima'));
    const menu = await screen.findByRole('menu');
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Keluarkan Ani Penerima' }));
    await waitFor(() => expect(ubahDispensasi).toHaveBeenLastCalledWith(11, expect.objectContaining({
      nama: paket.nama, tahun_ajaran: paket.tahun_ajaran, kuota_bulan: 3,
      santri_ids: [8], aturan: [{ jenis_id: 2, tipe: 'persen', nilai: 50 }],
    })));
    await screen.findByText('Daftar Penerima Khusus MI (1)');
    expect(panelPenerima().queryByText('Ani Penerima')).toBeNull();
    expect(hapusDispensasi).not.toHaveBeenCalled();
  });

  it('keluarkan massal mengirim ID santri dan busy menonaktifkan aksi massal berikutnya', async () => {
    const paket = paketDenganPenerima();
    uji.daftarDispensasi.mockResolvedValue([paket]);
    await pilihPaketPertama();
    let selesai!: () => void;
    vi.mocked(ubahDispensasi).mockImplementationOnce(() => new Promise((resolve) => {
      selesai = () => resolve(paket);
    }));
    await userEvent.click(panelPenerima().getByRole('checkbox', { name: 'Pilih semua baris' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keluarkan (2)' }));
    expect(ubahDispensasi).toHaveBeenCalledWith(11, expect.objectContaining({ santri_ids: null }));
    expect(screen.queryByRole('button', { name: 'Keluarkan (2)' })).toBeNull();
    await userEvent.click(panelPenerima().getByRole('checkbox', { name: 'Pilih baris 11:7' }));
    expect(screen.getByRole('button', { name: 'Keluarkan (1)' })).toBeDisabled();
    uji.daftarDispensasi.mockResolvedValue([{ ...paket, santri_ids: [], santri_tambahan: [] }]);
    await act(async () => { selesai(); });
    await screen.findByText('Daftar Penerima Khusus MI (0)');
    expect(screen.getByText('Belum ada penerima — masukkan santri dari daftar di kiri.')).toBeInTheDocument();
  });

  it('tanpa izin ubah panel tidak menawarkan keluarkan tunggal maupun massal', async () => {
    uji.bolehUbah = false;
    uji.daftarDispensasi.mockResolvedValue([paketDenganPenerima()]);
    await pilihPaketPertama();
    expect(panelPenerima().queryByRole('button', { name: /Keluarkan/ })).toBeNull();
    await userEvent.click(panelPenerima().getByRole('checkbox', { name: 'Pilih semua baris' }));
    expect(screen.queryByRole('button', { name: /Keluarkan \(/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tambah baris' })).toBeNull();
    expect(ubahDispensasi).not.toHaveBeenCalled();
  });
});

const tinggi = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true, get() { return this.dataset?.slot === 'excel-table-grid' ? 320 : (tinggi?.get?.call(this) ?? 0); },
  });
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () => ({ length: 0, item: () => null }) as unknown as DOMRectList;
  }
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
afterAll(() => {
  if (tinggi) Object.defineProperty(HTMLElement.prototype, 'clientHeight', tinggi);
});

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, roles: [], lembagas: [], permissions: [] }, loading: false, setUser: () => {}, logoutLocal: async () => {} }),
}));

vi.mock('@/api/auth', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/auth')>();
  return { ...asli, bisa: (_user: unknown, izin: string) => izin !== 'keuangan.ubah' || uji.bolehUbah };
});

vi.mock('sonner', async (asli) => ({
  ...(await asli<typeof import('sonner')>()),
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock('@/api/keuangan', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/keuangan')>();
  return {
    ...asli,
    daftarDispensasi: uji.daftarDispensasi,
    rekapDispensasiCrosstab: uji.rekapDispensasiCrosstab,
    daftarJenis: vi.fn(async () => []),
    kuotaPakai: vi.fn(async () => ({})),
    ubahDispensasi: vi.fn(),
    hapusDispensasi: vi.fn(),
  };
});

vi.mock('@/api/santri', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/santri')>();
  return {
    ...asli,
    listSantri: vi.fn(async () => ({ data: [], current_page: 1, last_page: 1, total: 0 })),
  };
});

vi.mock('@/api/master', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/master')>();
  const paginasiKosong = async () => ({
    pesan: 'ok',
    data: [],
    meta: { current_page: 1, last_page: 1, total: 0, per_page: 1000 },
  });
  return {
    ...asli,
    listKelas: vi.fn(paginasiKosong),
    listLembaga: vi.fn(paginasiKosong),
    listTahunAjaran: vi.fn(paginasiKosong),
  };
});

const FILTER = {
  jenjangs: ['MI'],
  tahunAjaranNames: ['2025/2026'],
  semesters: ['1'],
  tingkat: [] as string[],
  kelas: [] as number[],
  loading: false,
};
vi.mock('@/hooks/useFilterGlobalAktif', () => ({
  useFilterGlobalAktif: () => FILTER,
  targetTunggal: (values: readonly string[]) => (values.length === 1 ? values[0] : null),
}));

vi.mock('@/tingkatAktif', () => ({
  useTingkatAktif: () => ({ pilih: vi.fn() }),
}));
vi.mock('@/kelasAktif', () => ({
  useKelasAktif: () => ({ pilih: vi.fn() }),
}));

vi.mock('@/api/toolbarPreset', () => ({
  muatToolbarPreset: vi.fn(async () => ({
    pesan: 'ok',
    data: { table_key: 'uji', visibilitas: {}, lebar: {}, urutan: [], align: {} },
  })),
  simpanToolbarPreset: vi.fn(async () => ({ pesan: 'ok', data: null })),
}));

vi.mock('@/api/preset', () => ({
  listPresetTabel: vi.fn(async () => ({ pesan: 'ok', data: {
    presets: [], aktif_preset_id: null, default_preset_id: null, aktif_kolom: null,
  } })),
  createPresetTabel: vi.fn(),
  updatePresetTabel: vi.fn(),
  deletePresetTabel: vi.fn(),
  setPresetAktif: vi.fn(),
  setPresetBawaan: vi.fn(),
}));

vi.mock('@/api/urutPreset', () => ({
  muatUrutPreset: vi.fn(async () => ({
    pesan: 'ok',
    data: {
      table_key: 'uji',
      opsi: [],
      tersedia: [
        { kode: 'nama', label: 'Nama Santri' },
        { kode: 'nisn', label: 'NISN' },
        { kode: 'jk', label: 'Jenis Kelamin' },
        { kode: 'kelas', label: 'Kelas' },
        { kode: 'jenjang', label: 'Jenjang' },
      ],
    },
  })),
  simpanUrutPreset: vi.fn(),
  hapusUrutPreset: vi.fn(),
  arahKolomDariOpsi: vi.fn(() => undefined),
}));

vi.mock('@/api/komponenCustom', () => ({
  muatKomponenCustom: vi.fn(async () => ({ pesan: '', data: { peta: {} } })),
  simpanKomponenCustom: vi.fn(async () => ({ pesan: '', data: {} })),
  hapusKomponenCustom: vi.fn(async () => ({ pesan: '' })),
}));

vi.mock('react-datasheet-grid', async (importOriginal) => {
  const asli = await importOriginal<typeof import('react-datasheet-grid')>();
  const stub = await import('@/components/excel/_dsgStubDom');
  const { forwardRef } = await import('react');
  const Grid = forwardRef<unknown, ComponentPropsWithoutRef<typeof stub.DynamicDataSheetGridStub>>((props, ref) => {
    if (props.columns.some((c) => c.id === 'aturan')) paketGrid.aktif = props.onActiveCellChange ?? null;
    return <stub.DynamicDataSheetGridStub {...props} ref={ref} />;
  });
  return { ...asli, DynamicDataSheetGrid: Grid };
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  paketGrid.aktif = null;
  uji.bolehUbah = true;
  vi.mocked(ubahDispensasi).mockReset().mockResolvedValue(uji.DISPENSASI[0]);
  vi.mocked(kuotaPakai).mockReset().mockResolvedValue({});
  uji.daftarDispensasi.mockImplementation(async () => uji.DISPENSASI);
  uji.rekapDispensasiCrosstab.mockImplementation(async () => uji.REKAP);
});

/** Input pencarian di-portal ke slot TopBar; tes menyediakan slot tiruan. */
function SlotCari() {
  const ctx = useTopBarSearchCtx();
  return <div ref={(el) => ctx?.setEl(el)} />;
}

function renderHalaman() {
  return renderDenganTema(
    <CariGlobalProvider>
      <TopBarSearchProvider>
        <SlotCari />
        <MemoryRouter initialEntries={['/keuangan/dispensasi']}>
          <DispensasiPage />
        </MemoryRouter>
      </TopBarSearchProvider>
    </CariGlobalProvider>,
  );
}

/** Tab bar halaman: dua tab dengan id snake_case (NFR-05). */
async function tabSiap() {
  const kelola = await screen.findByRole('tab', { name: 'Kelola Dispensasi' });
  const rekap = screen.getByRole('tab', { name: 'Rekap Dispensasi' });
  expect(document.getElementById('disp_tab_kelola')).not.toBeNull();
  expect(document.getElementById('disp_tab_rekap')).not.toBeNull();
  return { kelola, rekap };
}

describe('DispensasiPage — tab Kelola / Rekap', () => {
  it('menaruh rekap dampak di tab Rekap Dispensasi, bukan di kolom kanan tab Kelola', async () => {
    renderHalaman();
    await tabSiap();

    expect(await screen.findByText('Daftar Santri (0)')).toBeInTheDocument();
    expect(within(screen.getByRole('tabpanel')).getByText('Khusus MI')).toBeInTheDocument();
    expect(screen.queryByText('Rekap Dampak per Paket')).toBeNull();

    await userEvent.click(screen.getByRole('tab', { name: 'Rekap Dispensasi' }));

    expect(await screen.findByText('Rekap Dampak per Paket')).toBeInTheDocument();
    expect(await screen.findByText('MI')).toBeInTheDocument();
    expect(await screen.findByText('Khusus MI')).toBeInTheDocument();

    expect(await screen.findByText('Infaq Bulanan')).toBeInTheDocument();
    expect(document.getElementById('td_rekap_crosstab_MI|2025/2026|11_jenis-1')?.textContent)
      .toBe('Rp 50.000');
    expect(await screen.findByText('2 tagihan · Rp 50.000')).toBeInTheDocument();
    expect(screen.queryByText('Daftar Santri (0)')).toBeNull();

    await waitFor(() => expect(localStorage.getItem(KUNCI_TAB)).toBe('rekap'));
  });

  it('Daftar Santri menampilkan Nama, NIS, JK, Kelas, dan Jenjang', async () => {
    const santri = await import('@/api/santri');
    (santri.listSantri as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => ({
      data: [{
        id: 1, nama_lengkap: 'Ani Lestari', nik: null, nisn: '1111111111', jk: 'P',
        is_active_pst: 'Ya', kelas: 'Kelas 1A',
        lembaga_aktif: [{ id: 1, santri_id: 1, jenjang: 'MI', nis_lokal: 'M-001',
          nis_kemenag: null, is_active_lembaga: 'Ya' }],
      }],
      current_page: 1, last_page: 1, total: 1,
    }));
    const { container } = renderHalaman();
    await tabSiap();
    await waitFor(() => expect(screen.getByText('Ani Lestari')).toBeInTheDocument());

    const sel = [...container.querySelectorAll('.dsg-cell')].map((s) => s.textContent?.trim());
    for (const judul of ['Nama Lengkap', 'NIS', 'JK', 'Kelas', 'Jenjang']) {
      expect(sel).toContain(judul);
    }

    expect(sel).toContain('Kelas 1A');
    expect(sel).toContain('MI');

    expect(sel).toContain('M-001');
  });

  it('memulihkan tab terakhir dari pref perangkat dan menyimpan saat pindah kembali', async () => {
    localStorage.setItem(KUNCI_TAB, 'rekap');
    renderHalaman();

    expect(await screen.findByText('Rekap Dampak per Paket')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Rekap Dispensasi' })).toHaveAttribute('data-state', 'active');

    await userEvent.click(screen.getByRole('tab', { name: 'Kelola Dispensasi' }));
    expect(await screen.findByText('Daftar Santri (0)')).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem(KUNCI_TAB)).toBe('kelola'));
  });

  it('mengabaikan pref tab yang tak dikenal (kembali ke tab Kelola)', async () => {
    localStorage.setItem(KUNCI_TAB, 'ngawur');
    renderHalaman();
    await tabSiap();

    expect(await screen.findByText('Daftar Santri (0)')).toBeInTheDocument();
    expect(screen.queryByText('Rekap Dampak per Paket')).toBeNull();
  });
  it('menyaring kandidat ke santri aktif secara bawaan, dan bisa dibuka ke semua', async () => {
    const santri = await import('@/api/santri');
    const panggil = santri.listSantri as unknown as ReturnType<typeof vi.fn>;

    renderHalaman();
    await tabSiap();

    await waitFor(() => expect(panggil).toHaveBeenCalled());
    const pertama = panggil.mock.calls.at(-1)?.[0] as { is_active_pst?: unknown };
    expect(pertama.is_active_pst).toBe(true);

    const status = await screen.findByLabelText('Filter status keaktifan santri');
    await userEvent.click(status);
    await userEvent.click(await screen.findByRole('option', { name: 'Semua' }));

    await waitFor(() => {
      const akhir = panggil.mock.calls.at(-1)?.[0] as { is_active_pst?: unknown };
      expect(akhir.is_active_pst).toBe('semua');
    });
  });

  it('active cell daftar paket menyelaraskan kartu detail, penerima dan rekap tanpa edit/input', async () => {
    const pertama = { ...uji.DISPENSASI[0], keterangan: 'Detail paket pertama' };
    const kedua: Dispensasi = {
      ...uji.DISPENSASI[0], id: 12, nama: 'Paket Kedua', keterangan: 'Detail paket kedua',
      santri_ids: [8],
      santri_tambahan: [{
        id: 8, nama_lengkap: 'Penerima Kedua', nama_singkat: null,
        nik: null, nisn: null, tmp_lahir: null, tgl_lahir: null,
        jk: 'L', tipe_santri: null, is_active_pst: 'Ya', lembaga_aktif: [],
      }],
    };
    uji.daftarDispensasi.mockResolvedValue([pertama, kedua]);
    renderHalaman();
    await tabSiap();
    await waitFor(() => expect(paketGrid.aktif).toBeTypeOf('function'));
    expect(screen.queryByText('Detail paket pertama')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tambah baris' })).toBeNull();
    await act(async () => { paketGrid.aktif?.({ cell: { row: 1 } }); });
    expect(await screen.findByText('Detail paket kedua')).toBeInTheDocument();
    expect(screen.getByText('Daftar Penerima Paket Kedua (1)')).toBeInTheDocument();
    await waitFor(() => expect(uji.rekapDispensasiCrosstab).toHaveBeenLastCalledWith(expect.objectContaining({ dispensasi_id: 12 })));
    await act(async () => { paketGrid.aktif?.({ cell: { row: 0 } }); });
    expect(await screen.findByText('Detail paket pertama')).toBeInTheDocument();
    expect(screen.queryByText('Detail paket kedua')).toBeNull();
    expect(screen.queryByText('Mode Ubah aktif')).toBeNull();
    await waitFor(() => expect(uji.rekapDispensasiCrosstab).toHaveBeenLastCalledWith(expect.objectContaining({ dispensasi_id: 11 })));
  });

  it('hapus melalui klik kanan meminta konfirmasi dan reload tidak memilih paket lain', async () => {
    const pertama = { ...uji.DISPENSASI[0], keterangan: 'Detail yang dihapus' };
    const kedua = { ...uji.DISPENSASI[0], id: 12, nama: 'Paket Tersisa', keterangan: 'Jangan pilih otomatis' };
    uji.daftarDispensasi.mockResolvedValue([pertama, kedua]);
    renderHalaman();
    await tabSiap();
    await waitFor(() => expect(paketGrid.aktif).toBeTypeOf('function'));
    await act(async () => { paketGrid.aktif?.({ cell: { row: 0 } }); });
    await screen.findByText('Detail yang dihapus');
    // Nama paket juga tampil pada kartu detail. Batasi ke root V2 yang
    // dimigrasikan, karena tabel paket belum mempunyai region label sendiri.
    const tabel = document.querySelector('[data-slot="excel-table"][data-varian="v2"]') as HTMLElement;
    fireEvent.contextMenu(within(tabel).getByText('Khusus MI'));
    const menu = await screen.findByRole('menu');
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Hapus' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Hapus dispensasi?');
    expect(hapusDispensasi).not.toHaveBeenCalled();
    uji.daftarDispensasi.mockResolvedValue([kedua]);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hapus' }));
    await waitFor(() => expect(hapusDispensasi).toHaveBeenCalledWith(11));
    await waitFor(() => expect(screen.queryByText('Detail yang dihapus')).toBeNull());
    expect(screen.queryByText('Jangan pilih otomatis')).toBeNull();
    expect(within(screen.getByRole('tabpanel')).getByText('Paket Tersisa')).toBeInTheDocument();
  });

  it('pintasan tambah dan aksi Ubah membuka dialog yang sesuai tanpa edit cell', async () => {
    renderHalaman();
    await tabSiap();
    await waitFor(() => expect(paketGrid.aktif).toBeTypeOf('function'));
    await userEvent.keyboard('{Control>}n{/Control}');
    expect(await screen.findByRole('dialog', { name: 'Tambah Dispensasi' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const tabel = document.querySelector('[data-slot="excel-table"][data-varian="v2"]') as HTMLElement;
    fireEvent.contextMenu(within(tabel).getByText('Khusus MI'));
    const menu = await screen.findByRole('menu');
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Ubah' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ubah Dispensasi' });
    expect(within(dialog).getByRole('textbox', { name: 'Nama:' })).toHaveValue('Khusus MI');
    expect(screen.queryByText('Mode Ubah aktif')).toBeNull();
  });
});
