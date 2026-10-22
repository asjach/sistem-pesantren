import { MemoryRouter } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import KurikulumMapelPage from './KurikulumMapelPage';
import { CariGlobalProvider } from '@/hooks/useCariGlobal';
import { TopBarSearchProvider, useTopBarSearchCtx } from '@/components/TopBarSearch';
import { renderDenganTema } from '@/test/utils';
import type { MataPelajaran } from '@/api/kurikulum';

const uji = vi.hoisted(() => {
  const BARIS = [
    {
      id: 7, jenjang: 'MI', nama_mapel: 'Aljabar',
      kode_mapel: 'ALJ', singkatan: 'Alj.', kelompok: 'formal', is_active: true,
      kkm: null, urutan: 0,
    },
  ] as unknown as MataPelajaran[];
  return {
    BARIS,
    daftarMapel: vi.fn(async () => BARIS),
    ubahMapel: vi.fn(async () => BARIS[0]),
    hapusMapel: vi.fn(async () => ({ pesan: 'ok' })),
    buatMapel: vi.fn(async () => BARIS[0]),
    /** "Terapkan dari kamus": pratinjau (`periksa`) vs hasil sungguhan. */
    terapkanKamusMapel: vi.fn(),
    PRATINJAU: {
      pesan: '2 mapel akan diisi dari kamus.', jenjang: 'MI',
      diubah: 2, sudah_lengkap: 1, tanpa_kamus: 0,
      contoh: [{ nama_mapel: 'Aljabar', kode_mapel: null, singkatan: 'Alj.' }],
    },
    HASIL: {
      pesan: '2 mapel diisi dari kamus.', jenjang: 'MI',
      diubah: 2, sudah_lengkap: 1, tanpa_kamus: 0, contoh: [],
    },
    /** Baris kamus `ref_mapel` — kolom kiri halaman. Diisi per uji. */
    SARAN: [] as { id: number; nama: string; kode?: string | null; singkatan?: string | null }[],
    /** Izin user per uji — diganti di beforeEach. */
    izin: ['kurikulum.lihat', 'kurikulum.ubah', 'kurikulum.hapus'] as string[],
  };
});

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() { return this.dataset?.slot === 'excel-table-grid' ? 320 : 0; },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() { return this.dataset?.slot === 'excel-table-grid' ? 900 : 0; },
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

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, roles: [{ name: 'admin' }], lembagas: [], permissions: uji.izin },
    loading: false, setUser: () => {}, logoutLocal: async () => {},
  }),
}));

vi.mock('@/api/kurikulum', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/kurikulum')>();
  return {
    ...asli,
    daftarMapel: uji.daftarMapel,
    ubahMapel: uji.ubahMapel,
    hapusMapel: uji.hapusMapel,
    buatMapel: uji.buatMapel,
    terapkanKamusMapel: uji.terapkanKamusMapel,
  };
});

const FILTER = { jenjangs: ['MI'], tahunAjaranNames: ['2025/2026'], semesters: ['1'], tingkat: [] as string[], kelas: [] as number[], loading: false };
vi.mock('@/hooks/useFilterGlobalAktif', () => ({
  useFilterGlobalAktif: () => FILTER,
  targetTunggal: (values: readonly string[]) => (values.length === 1 ? values[0] : null),
}));

vi.mock('@/api/master', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/master')>();
  const paginasiKosong = async () => ({
    pesan: 'ok',
    data: [],
    meta: { current_page: 1, last_page: 1, total: 0, per_page: 1000 },
  });
  return {
    ...asli,
    listLembaga: vi.fn(paginasiKosong),
    listKelas: vi.fn(paginasiKosong),

    referensiList: vi.fn(async () => uji.SARAN),
  };
});

vi.mock('@/tingkatAktif', () => ({ useTingkatAktif: () => ({ pilih: vi.fn() }) }));
vi.mock('@/kelasAktif', () => ({ useKelasAktif: () => ({ pilih: vi.fn() }) }));

vi.mock('@/api/toolbarPreset', () => ({
  muatToolbarPreset: vi.fn(async () => ({
    pesan: 'ok',
    data: { table_key: 'uji', visibilitas: {}, lebar: {}, urutan: [], align: {} },
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

vi.mock('@/api/komponenCustom', () => ({
  muatKomponenCustom: vi.fn(async () => ({ pesan: '', data: { peta: {} } })),
  simpanKomponenCustom: vi.fn(async () => ({ pesan: '', data: {} })),
  hapusKomponenCustom: vi.fn(async () => ({ pesan: '' })),
}));

vi.mock('react-datasheet-grid', async (importOriginal) => {
  const asli = await importOriginal<typeof import('react-datasheet-grid')>();
  const stub = await import('@/components/excel/_dsgStubDom');
  return { ...asli, DynamicDataSheetGrid: stub.DynamicDataSheetGridStub };
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  uji.daftarMapel.mockImplementation(async () => uji.BARIS);
  uji.ubahMapel.mockImplementation(async () => uji.BARIS[0]);
  uji.buatMapel.mockImplementation(async () => uji.BARIS[0]);
  uji.terapkanKamusMapel.mockImplementation(async (input: { mode: string }) => (
    input.mode === 'periksa' ? uji.PRATINJAU : uji.HASIL
  ));
  uji.SARAN = [];
  uji.izin = ['kurikulum.lihat', 'kurikulum.ubah', 'kurikulum.hapus'];
});

/** Input pencarian di-portal ke slot TopBar; tes menyediakan slot tiruan. */
function SlotCari() {
  const ctx = useTopBarSearchCtx();
  return <div ref={(el) => ctx?.setEl(el)} />;
}

/** Teks sel kolom kamus (kolom kiri). V2 memakai `data-col-key` langsung. */
function teksSel(colKey: string): string[] {
  const kolom = document.getElementById('kolom_kamus_mapel');
  if (kolom === null) return [];
  return Array.from(kolom.querySelectorAll(`.dsg-row:not(.dsg-row-header) [data-col-key="${colKey}"]`))
    .map((el) => el.textContent ?? '');
}

/** Buka menu titik-tiga "Aksi" di bilah judul tabel mapel, lalu kembalikan
 *  item menu berlabel `label` (belum diklik). Semua tombol aksi halaman
 *  (Terapkan kamus, Import, Tambah) tinggal di dalam menu ini.
 *
 *  Menu dibuka lewat papan ketik (fokus + Enter): di jsdom klik pointer pada
 *  pemicu Radix tak terbaca karena stub `hasPointerCapture` di berkas ini. */
async function itemAksi(label: string): Promise<HTMLElement> {
  const pemicu = await screen.findByRole('button', { name: 'Aksi' });
  pemicu.focus();
  await userEvent.keyboard('{Enter}');
  return screen.findByRole('menuitem', { name: label });
}

function renderHalaman() {
  return renderDenganTema(
    <CariGlobalProvider>
      <TopBarSearchProvider>
        <SlotCari />
        <MemoryRouter initialEntries={['/kurikulum/mapel']}>
          <KurikulumMapelPage />
        </MemoryRouter>
      </TopBarSearchProvider>
    </CariGlobalProvider>,
  );
}

describe('KurikulumMapelPage — aksi baris Ubah', () => {
  it('menampilkan aksi Ubah lalu menyimpan perubahan lewat dialog', async () => {
    renderHalaman();

    const tombol = await screen.findByRole('button', { name: 'Ubah' });
    expect(tombol.id).toBe('btn_ubah_mapel_7');

    await userEvent.click(tombol);
    expect(screen.getByText('Ubah mapel')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Nama mapel'));
    await userEvent.type(screen.getByLabelText('Nama mapel'), 'Aljabar Lanjut');

    await userEvent.clear(screen.getByLabelText('Singkatan (opsional)'));
    await userEvent.type(screen.getByLabelText('Singkatan (opsional)'), 'Alj.');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));

    await waitFor(() => expect(uji.ubahMapel).toHaveBeenCalledTimes(1));
    expect(uji.ubahMapel).toHaveBeenCalledWith(7, {
      nama_mapel: 'Aljabar Lanjut',
      kode_mapel: 'ALJ',
      singkatan: 'Alj.',
      kkm: null,
      urutan: 0,
      kelompok: 'formal',
      is_active: true,
    });

    await waitFor(() => expect(screen.queryByText('Ubah mapel')).toBeNull());
  });

  it('tombol Simpan mati selama nama kosong (validasi wajib isi)', async () => {
    renderHalaman();
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah' }));

    const simpan = screen.getByRole('button', { name: 'Simpan' });
    expect(simpan).toBeEnabled();

    await userEvent.clear(screen.getByLabelText('Nama mapel'));
    expect(simpan).toBeDisabled();
    expect(uji.ubahMapel).not.toHaveBeenCalled();
  });

  it('tanpa izin kurikulum.ubah aksi Ubah tidak dirender (hapus tetap ada)', async () => {
    uji.izin = ['kurikulum.lihat', 'kurikulum.hapus'];
    renderHalaman();

    await screen.findByRole('button', { name: 'Hapus' });
    expect(screen.queryByRole('button', { name: 'Ubah' })).toBeNull();
    expect(uji.ubahMapel).not.toHaveBeenCalled();
  });
});

describe('KurikulumMapelPage — filter status tabel mapel', () => {
  it('memakai LabeledCombobox: nilai awal "Aktif" dan pilihan baru memuat ulang tabel', async () => {
    uji.izin = ['kurikulum.lihat', 'kurikulum.ubah', 'kurikulum.hapus'];
    renderHalaman();

    await userEvent.click(await screen.findByRole('button', { name: 'Area filter' }));
    const input = await screen.findByLabelText('Filter status mapel');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveValue('Aktif');

    input.focus();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.click(await screen.findByRole('option', { name: 'Nonaktif' }));

    await waitFor(() => expect(uji.daftarMapel).toHaveBeenLastCalledWith(
      expect.objectContaining({ jenjang: 'MI', keaktifan: 'nonaktif' }),
    ));
  });
});

describe('KurikulumMapelPage — tambah dari kamus (kolom kiri)', () => {
  it('tabel kamus menampilkan kode, nama & singkatan ref; tombol → menginput entri ke mata_pelajaran', async () => {
    uji.izin = ['kurikulum.lihat', 'kurikulum.tambah', 'kurikulum.ubah', 'kurikulum.hapus'];
    uji.SARAN = [
      { id: 1, nama: 'Fikih', kode: 'FKH', singkatan: null },
      { id: 2, nama: 'Bahasa Arab', kode: 'BAR', singkatan: 'B. Ar.' },
    ];
    renderHalaman();

    await screen.findByRole('button', { name: 'Tambah Fikih' });

    expect(teksSel('kode')).toEqual(expect.arrayContaining(['FKH', 'BAR']));
    expect(teksSel('nama')).toEqual(expect.arrayContaining(['Fikih', 'Bahasa Arab']));
    expect(teksSel('singkatan')).toEqual(expect.arrayContaining(['B. Ar.']));

    await userEvent.click(screen.getByRole('button', { name: 'Tambah Fikih' }));
    await waitFor(() => expect(uji.buatMapel).toHaveBeenCalledWith({
      jenjang: 'MI', nama_mapel: 'Fikih', kode_mapel: 'FKH', singkatan: null, kelompok: 'formal',
    }));

    await userEvent.click(screen.getByRole('button', { name: 'Tambah Bahasa Arab' }));
    await waitFor(() => expect(uji.buatMapel).toHaveBeenCalledWith({
      jenjang: 'MI', nama_mapel: 'Bahasa Arab', kode_mapel: 'BAR', singkatan: 'B. Ar.', kelompok: 'formal',
    }));
  });

  it('entri kamus yang namanya sudah ada sebagai mapel disembunyikan dari tabel kamus', async () => {
    uji.izin = ['kurikulum.lihat', 'kurikulum.tambah'];

    uji.SARAN = [{ id: 9, nama: 'Aljabar', kode: 'ALJ', singkatan: 'Alj.' }];
    renderHalaman();

    await waitFor(() => expect(teksSel('nama')).not.toContain('Aljabar'));
    expect(screen.queryByRole('button', { name: 'Tambah Aljabar' })).toBeNull();
    expect(uji.buatMapel).not.toHaveBeenCalled();
  });

  it('baris kamus langsung hilang setelah diinput ke tabel mapel', async () => {
    uji.izin = ['kurikulum.lihat', 'kurikulum.tambah'];
    uji.SARAN = [
      { id: 1, nama: 'Fikih', kode: 'FKH', singkatan: null },
      { id: 2, nama: 'Bahasa Arab', kode: 'BAR', singkatan: 'B. Ar.' },
    ];
    renderHalaman();

    await userEvent.click(await screen.findByRole('button', { name: 'Tambah Fikih' }));
    await waitFor(() => expect(uji.buatMapel).toHaveBeenCalledTimes(1));

    await waitFor(() => expect(teksSel('nama')).not.toContain('Fikih'));
    expect(teksSel('nama')).toContain('Bahasa Arab');
    expect(screen.queryByRole('button', { name: 'Tambah Fikih' })).toBeNull();
  });

  it('tanpa izin kurikulum.tambah baris kamus tetap tampil tanpa tombol →', async () => {
    uji.SARAN = [{ id: 1, nama: 'Fikih', kode: 'FKH', singkatan: null }];
    renderHalaman();

    await waitFor(() => expect(teksSel('nama')).toContain('Fikih'));
    expect(screen.queryByRole('button', { name: 'Tambah Fikih' })).toBeNull();
  });
});

describe('KurikulumMapelPage — tambah mapel lewat dialog', () => {
  /** Tombol Tambah hanya bisa dipakai dengan izin kurikulum.tambah. */
  beforeEach(() => {
    uji.izin = ['kurikulum.lihat', 'kurikulum.tambah', 'kurikulum.ubah', 'kurikulum.hapus'];
  });

  it('membuka dialog kosong dan BELUM membuat mapel apa pun', async () => {
    renderHalaman();

    const tombol = await itemAksi('Tambah');
    expect(tombol.id).toBe('btn_tambah_mapel');
    await userEvent.click(tombol);

    expect(await screen.findByText('Tambah mapel')).toBeInTheDocument();
    expect(screen.getByLabelText('Nama mapel')).toHaveValue('');
    expect(screen.getByLabelText('Kode (opsional)')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeDisabled();
    expect(uji.buatMapel).not.toHaveBeenCalled();
  });

  it('Simpan mengirim isi formulir, menutup dialog, dan mengosongkan isian untuk pemakaian berikutnya', async () => {
    renderHalaman();

    await userEvent.click(await itemAksi('Tambah'));
    await userEvent.type(screen.getByLabelText('Nama mapel'), 'Fikih');
    await userEvent.type(screen.getByLabelText('Kode (opsional)'), 'FKH');
    await userEvent.type(screen.getByLabelText('Singkatan (opsional)'), 'Fik.');

    await userEvent.type(screen.getByLabelText('KKM (opsional)'), '75');
    await userEvent.clear(screen.getByLabelText('Urutan rapor'));
    await userEvent.type(screen.getByLabelText('Urutan rapor'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));

    await waitFor(() => expect(uji.buatMapel).toHaveBeenCalledWith({
      jenjang: 'MI', nama_mapel: 'Fikih', kelompok: 'formal',
      kode_mapel: 'FKH', singkatan: 'Fik.', is_active: true,
      kkm: 75, urutan: 3,
    }));
    await waitFor(() => expect(screen.queryByText('Tambah mapel')).toBeNull());

    await userEvent.click(await itemAksi('Tambah'));
    expect(await screen.findByText('Tambah mapel')).toBeInTheDocument();
    expect(screen.getByLabelText('Nama mapel')).toHaveValue('');
    expect(screen.getByLabelText('Kode (opsional)')).toHaveValue('');
    expect(screen.getByLabelText('KKM (opsional)')).toHaveValue('');
    expect(screen.getByLabelText('Urutan rapor')).toHaveValue('0');
  });
});

describe('KurikulumMapelPage — terapkan dari kamus', () => {
  it('tanpa izin kurikulum.ubah tombol tidak dirender', async () => {
    uji.izin = ['kurikulum.lihat'];
    renderHalaman();

    const tambah = await itemAksi('Tambah');
    expect(tambah.id).toBe('btn_tambah_mapel');
    expect(tambah).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('menuitem', { name: 'Terapkan kamus' })).toBeNull();
    expect(uji.terapkanKamusMapel).not.toHaveBeenCalled();
  });

  it('menampilkan pratinjau lebih dulu, lalu mengisi saat Terapkan ditekan', async () => {
    renderHalaman();

    const item = await itemAksi('Terapkan kamus');

    expect(item.querySelector('svg')).not.toBeNull();
    await userEvent.click(item);

    await waitFor(() => expect(uji.terapkanKamusMapel).toHaveBeenCalledWith({
      jenjang: 'MI', timpa: false, mode: 'periksa',
    }));
    expect(await screen.findByText('2 mapel akan diisi dari kamus · 1 sudah lengkap · 0 tanpa kamus'))
      .toBeInTheDocument();

    expect(uji.terapkanKamusMapel.mock.calls.every((c) => (c[0] as { mode: string }).mode === 'periksa')).toBe(true);

    const sebelum = uji.daftarMapel.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Terapkan' }));

    await waitFor(() => expect(uji.terapkanKamusMapel).toHaveBeenCalledWith({
      jenjang: 'MI', timpa: false, mode: 'eksekusi',
    }));

    await waitFor(() => expect(screen.queryByText('Terapkan dari kamus')).toBeNull());
    await waitFor(() => expect(uji.daftarMapel.mock.calls.length).toBeGreaterThan(sebelum));
  });

  it('sakelar timpa menghitung ulang pratinjau dengan timpa aktif', async () => {
    renderHalaman();

    await userEvent.click(await itemAksi('Terapkan kamus'));
    await waitFor(() => expect(uji.terapkanKamusMapel).toHaveBeenCalled());
    const sebelum = uji.terapkanKamusMapel.mock.calls.length;

    await userEvent.click(await screen.findByRole('checkbox', { name: /Timpa kode/ }));

    await waitFor(() => expect(uji.terapkanKamusMapel).toHaveBeenLastCalledWith({
      jenjang: 'MI', timpa: true, mode: 'periksa',
    }));
    expect(uji.terapkanKamusMapel.mock.calls.length).toBeGreaterThan(sebelum);
  });
});
