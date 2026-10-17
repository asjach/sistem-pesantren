import { MemoryRouter } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import KurikulumPengampuPage from './KurikulumPengampuPage';
import { CariGlobalProvider } from '@/hooks/useCariGlobal';
import { TopBarSearchProvider, useTopBarSearchCtx } from '@/components/TopBarSearch';
import { renderDenganTema } from '@/test/utils';

/* `vi.hoisted` wajib: factory vi.mock di-hoist ke atas file, jadi fixture &
   mock fn harus sudah ada saat factory dipanggil. */
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
    KELAS, MAPEL, GURU, PENGAMPU,
    listKelas: vi.fn(async () => ({
      pesan: 'ok', data: KELAS,
      meta: { current_page: 1, last_page: 1, total: 2, per_page: 1000 },
    })),
    daftarMapel: vi.fn(async () => MAPEL),
    daftarGuruAktif: vi.fn(async () => GURU),
    daftarPengampus: vi.fn(async () => PENGAMPU),
    simpanPengampu: vi.fn(async () => ({ pesan: 'Pengampu disimpan.' })),
    salinPengampu: vi.fn(async () => ({ pesan: 'Daftar mapel disalin: 1 mapel ditambahkan (guru belum diisi).', ditambah: 1 })),
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
  };
});

/* Array filter WAJIB stabil (didefinisikan sekali): halaman memakainya sebagai
   dependensi effect, jadi array baru tiap render memicu loop render. */
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

/* Rail filter tingkat/kelas: butuh context yang di app disediakan layout. */
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
    // Satu request untuk semua kelas yang tampil (rail "All").
    expect(uji.daftarPengampus).toHaveBeenCalledWith([1, 2]);
  });

  it('dialog Tambah mapel mengirim baris kelas itu + mapel baru lewat simpanPengampu', async () => {
    renderHalaman();
    await waitFor(() => expect(teksSel('nama_mapel')).toContain('Fiqih'));

    await userEvent.click(screen.getByRole('button', { name: 'Tambah mapel' }));
    expect(await screen.findByText('Tambah mapel ke pengampu kelas')).toBeInTheDocument();

    // Kelas tujuan bawaan = kelas pertama yang tampil (1A).
    const selKelas = screen.getByLabelText('Kelas') as HTMLSelectElement;
    expect(selKelas.value).toBe('1');
    // Pilih mapel yang belum terpasang (Bahasa Arab), guru dibiarkan kosong.
    await userEvent.selectOptions(screen.getByLabelText('Mapel'), '11');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));

    await waitFor(() => expect(uji.simpanPengampu).toHaveBeenCalledTimes(1));
    expect(uji.simpanPengampu).toHaveBeenCalledWith(1, [
      { mata_pelajaran_id: 10, keaktifan_pegawai_id: 7 }, // baris lama (Fiqih + guru)
      { mata_pelajaran_id: 11, keaktifan_pegawai_id: null }, // mapel baru tanpa guru
    ]);
    // Setelah simpan, tabel dimuat ulang.
    await waitFor(() => expect(uji.daftarPengampus).toHaveBeenCalledTimes(2));
  });

  it('dialog Salin memanggil salinPengampu dengan kelas tujuan & sumber', async () => {
    renderHalaman();
    await waitFor(() => expect(teksSel('nama_mapel')).toContain('Fiqih'));

    await userEvent.click(screen.getByRole('button', { name: 'Salin dari kelas lain' }));
    expect(await screen.findByText('Salin daftar mapel dari kelas lain')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Kelas sumber'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Salin' }));

    await waitFor(() => expect(uji.salinPengampu).toHaveBeenCalledWith(1, 2));
    await waitFor(() => expect(uji.daftarPengampus).toHaveBeenCalledTimes(2));
  });
});
