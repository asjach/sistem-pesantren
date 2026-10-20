import { MemoryRouter } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import KurikulumPengampuPage from './KurikulumPengampuPage';
import { CariGlobalProvider } from '@/hooks/useCariGlobal';
import { TopBarSearchProvider, useTopBarSearchCtx } from '@/components/TopBarSearch';
import { renderDenganTema } from '@/test/utils';

const uji = vi.hoisted(() => {
  const KELAS = [
    { id: 1, nama_kelas: '1A', tingkat: '1', jenjang: 'MI' },
    { id: 2, nama_kelas: '1B', tingkat: '1', jenjang: 'MI' },
  ];
  const MAPEL = [
    { id: 10, jenjang: 'MI', nama_mapel: 'Fiqih', kode_mapel: null, singkatan: null, kelompok: 'formal', is_active: true, kkm: 70, urutan: 1 },
    { id: 11, jenjang: 'MI', nama_mapel: 'Bahasa Arab', kode_mapel: null, singkatan: null, kelompok: 'formal', is_active: true, kkm: null, urutan: 0 },
  ];
  const GURU = [
    { keaktifan_pegawai_id: 7, pegawai_id: 5, nama_lengkap: 'Ust. Ahmad', nip: null, gelar_depan: null, gelar_belakang: null, jenis_kelamin: 'L' },
  ];
  /** Pratinjau salin: sumber punya 2 mapel, tujuan sudah punya Fiqih. */
  const PRATINJAU = {
    tujuan: { kelas_id: 1, nama_kelas: '1A', tahun_ajaran: '2026/2027', jenjang: 'MI' },
    sumber: { kelas_id: 2, nama_kelas: '1B', tahun_ajaran: '2026/2027', jenjang: 'MI' },
    ditambah: [{ id: 11, nama_mapel: 'Bahasa Arab', kelompok: 'formal', kkm: null }],
    dilewati: [{ id: 10, nama_mapel: 'Fiqih', kelompok: 'formal', kkm: 70 }],
    jumlah_ditambah: 1,
    jumlah_dilewati: 1,
  };
  /** Daftar pengampu kelas 1A: Fiqih sudah berguru. Kelas 1B masih kosong. */
  const PENGAMPU = {
    kelas: KELAS,
    baris: [{
      kelas_id: 1, nama_kelas: '1A', mata_pelajaran_id: 10, nama_mapel: 'Fiqih',
      kelompok: 'formal', is_active: true, kkm: 70, pengampu_id: 100,
      keaktifan_pegawai_id: 7, guru: 'Ust. Ahmad',
    }],
  };
  return {
    KELAS, MAPEL, GURU, PENGAMPU, PRATINJAU,
    listKelas: vi.fn(async () => ({
      pesan: 'ok', data: KELAS,
      meta: { current_page: 1, last_page: 1, total: 2, per_page: 1000 },
    })),
    daftarMapel: vi.fn(async () => MAPEL),
    daftarGuruAktif: vi.fn(async () => GURU),
    daftarPengampus: vi.fn(async () => PENGAMPU),
    simpanPengampu: vi.fn(async () => ({ pesan: 'Pengampu disimpan.' })),
    salinPengampu: vi.fn(async () => ({ pesan: 'Daftar mapel disalin: 1 mapel ditambahkan (guru belum diisi).', ditambah: 1 })),
    pratinjauSalinPengampu: vi.fn(async () => PRATINJAU),
  };
});

beforeAll(() => {
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
  useAuth: () => ({ user: { id: 1, roles: [], lembagas: [], permissions: [] }, loading: false, setUser: () => {}, logoutLocal: async () => {} }),
}));

vi.mock('@/api/auth', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/auth')>();
  return { ...asli, bisa: () => true };
});

vi.mock('@/api/kurikulum', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/kurikulum')>();
  return {
    ...asli,
    daftarMapel: uji.daftarMapel,
    daftarGuruAktif: uji.daftarGuruAktif,
    daftarPengampus: uji.daftarPengampus,
    simpanPengampu: uji.simpanPengampu,
    salinPengampu: uji.salinPengampu,
    pratinjauSalinPengampu: uji.pratinjauSalinPengampu,
  };
});

const FILTER = {
  jenjangs: ['MI'],
  tahunAjaranNames: ['2026/2027'],
  semesters: ['1'],
  tingkat: [] as string[],
  kelas: [] as number[],
  loading: false,
};
vi.mock('@/hooks/useFilterGlobalAktif', () => ({
  useFilterGlobalAktif: () => FILTER,
  targetTunggal: (values: readonly string[]) => (values.length === 1 ? values[0] : null),
}));

vi.mock('@/tingkatAktif', () => ({ useTingkatAktif: () => ({ pilih: vi.fn() }) }));
vi.mock('@/kelasAktif', () => ({ useKelasAktif: () => ({ pilih: vi.fn() }) }));

vi.mock('@/api/master', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/master')>();
  return {
    ...asli,
    listKelas: uji.listKelas,
    listLembaga: vi.fn(async () => ({ pesan: 'ok', data: [], meta: { current_page: 1, last_page: 1, total: 0, per_page: 1000 } })),
    listTahunAjaran: vi.fn(async () => ({ pesan: 'ok', data: [], meta: { current_page: 1, last_page: 1, total: 0, per_page: 1000 } })),
  };
});

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
});

/** Slot TopBarSearch tiruan (app menyediakannya di layout). */
function SlotCari() {
  const ctx = useTopBarSearchCtx();
  return <div ref={(el) => ctx?.setEl(el)} />;
}

/** Teks semua sel kolom `colKey` tabel pengampu. */
function teksSel(colKey: string): string[] {
  return Array.from(document.querySelectorAll(`.simpes-dsg-fill[data-col-key="${colKey}"]`))
    .map((el) => el.textContent ?? '');
}

function renderHalaman() {
  return renderDenganTema(
    <CariGlobalProvider>
      <TopBarSearchProvider>
        <SlotCari />
        <MemoryRouter initialEntries={['/kurikulum/pengampu']}>
          <KurikulumPengampuPage />
        </MemoryRouter>
      </TopBarSearchProvider>
    </CariGlobalProvider>,
  );
}

describe('KurikulumPengampuPage', () => {
  it('menampilkan baris pengampu dari server (kelas, mapel, KKM, guru)', async () => {
    renderHalaman();

    await waitFor(() => expect(teksSel('nama_mapel')).toContain('Fiqih'));
    expect(teksSel('kelas')).toContain('1A');
    expect(teksSel('kkm')).toContain('70');

    expect(uji.daftarPengampus).toHaveBeenCalledWith([1, 2]);
  });

  it('dialog Tambah mapel mengirim baris kelas itu + mapel baru lewat simpanPengampu', async () => {
    renderHalaman();
    await waitFor(() => expect(teksSel('nama_mapel')).toContain('Fiqih'));

    await userEvent.click(screen.getByRole('button', { name: 'Tambah mapel' }));
    expect(await screen.findByText('Tambah mapel ke pengampu kelas')).toBeInTheDocument();

    const selKelas = screen.getByLabelText('Kelas') as HTMLSelectElement;
    expect(selKelas.value).toBe('1');

    await userEvent.selectOptions(screen.getByLabelText('Mapel'), '11');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));

    await waitFor(() => expect(uji.simpanPengampu).toHaveBeenCalledTimes(1));
    expect(uji.simpanPengampu).toHaveBeenCalledWith(1, [
      { mata_pelajaran_id: 10, keaktifan_pegawai_id: 7 },
      { mata_pelajaran_id: 11, keaktifan_pegawai_id: null },
    ]);

    await waitFor(() => expect(uji.daftarPengampus).toHaveBeenCalledTimes(2));
  });

  it('dialog Salin menampilkan pratinjau lalu menyalin', async () => {
    renderHalaman();
    await waitFor(() => expect(teksSel('nama_mapel')).toContain('Fiqih'));

    await userEvent.click(screen.getByRole('button', { name: 'Salin dari kelas lain' }));
    expect(await screen.findByText('Salin daftar mapel dari kelas lain')).toBeInTheDocument();

    // Sumber: kelas lain pada TA yang sama.
    await userEvent.selectOptions(screen.getByLabelText('Kelas sumber'), '2');

    // Pratinjau muncul sebelum menyimpan: yang ditambah & yang dilewati.
    expect(await screen.findByText(/Akan ditambahkan: 1 mapel/)).toBeInTheDocument();
    expect(screen.getByText(/Bahasa Arab/)).toBeInTheDocument();
    expect(uji.pratinjauSalinPengampu).toHaveBeenCalledWith(1, 2);

    await userEvent.click(screen.getByRole('button', { name: 'Salin 1 mapel' }));

    await waitFor(() => expect(uji.salinPengampu).toHaveBeenCalledWith(1, 2));
    await waitFor(() => expect(uji.daftarPengampus).toHaveBeenCalledTimes(2));
  });
});
