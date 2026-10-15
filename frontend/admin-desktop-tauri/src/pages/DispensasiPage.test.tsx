import { MemoryRouter } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import DispensasiPage from './DispensasiPage';
import { CariGlobalProvider } from '@/hooks/useCariGlobal';
import { TopBarSearchProvider, useTopBarSearchCtx } from '@/components/TopBarSearch';
import { renderDenganTema } from '@/test/utils';
import type { Dispensasi, RekapDispensasiCrosstab } from '@/api/keuangan';

/** Kunci pref tab halaman: permukaan perilaku "ingat tab terakhir". */
const KUNCI_TAB = 'simpes_dispensasi_tab';

/* `vi.hoisted` wajib: factory vi.mock di-hoist, jadi fixture & mock fn harus
   sudah ada saat factory dipanggil. */
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
    DISPENSASI,
    REKAP,
    daftarDispensasi: vi.fn(async () => DISPENSASI),
    rekapDispensasiCrosstab: vi.fn(async () => REKAP),
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

/* Array filter WAJIB stabil (didefinisikan sekali): halaman memakainya sebagai
   dependensi effect, jadi array baru tiap render memicu loop render. */
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

/* Rail filter tingkat/kelas: butuh context yang di app disediakan layout. */
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
  listPresetTabel: vi.fn(async () => ({ pesan: 'ok', data: [] })),
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
  return { ...asli, DynamicDataSheetGrid: stub.DynamicDataSheetGridStub };
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
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

    // Tab bawaan = Kelola: area kerja dua kolom tampil, tabel rekap belum ada.
    expect(await screen.findByText('Daftar Santri (0)')).toBeInTheDocument();
    expect(screen.getByText('Khusus MI')).toBeInTheDocument();
    expect(screen.queryByText('Rekap Dampak per Paket')).toBeNull();

    await userEvent.click(screen.getByRole('tab', { name: 'Rekap Dispensasi' }));

    // Tab Rekap: crosstab paket × jenis selebar panel, area kerja disembunyikan.
    expect(await screen.findByText('Rekap Dampak per Paket')).toBeInTheDocument();
    expect(await screen.findByText('MI')).toBeInTheDocument();
    expect(await screen.findByText('Khusus MI')).toBeInTheDocument();
    // Kolom = jenis tagihan terdampak; sel = potongan paket di jenis itu.
    expect(await screen.findByText('Infaq Bulanan')).toBeInTheDocument();
    expect(document.getElementById('td_rekap_crosstab_MI|2025/2026|11_jenis-1')?.textContent)
      .toBe('Rp 50.000');
    expect(await screen.findByText('2 tagihan · Rp 50.000')).toBeInTheDocument();
    expect(screen.queryByText('Daftar Santri (0)')).toBeNull();

    // Tab terakhir disimpan supaya halaman kembali ke sana lain kali.
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

    // Grid di-stub: selnya `.dsg-cell`, bukan `th`/`td`.
    const sel = [...container.querySelectorAll('.dsg-cell')].map((s) => s.textContent?.trim());
    for (const judul of ['Nama Lengkap', 'NIS', 'JK', 'Kelas', 'Jenjang']) {
      expect(sel).toContain(judul);
    }
    // Nilainya benar-benar terisi: kelas dari `kelas`, jenjang dari keanggotaan.
    expect(sel).toContain('Kelas 1A');
    expect(sel).toContain('MI');
    // NIS yang tampil = NIS lokal per lembaga, bukan nisn.
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

    // Bawaan: aktif saja (nonaktif disembunyikan sampai diminta).
    await waitFor(() => expect(panggil).toHaveBeenCalled());
    const pertama = panggil.mock.calls.at(-1)?.[0] as { is_active_pst?: unknown };
    expect(pertama.is_active_pst).toBe(true);

    // Buka dropdown Status lalu pilih "Semua".
    const status = await screen.findByLabelText('Filter status keaktifan santri');
    await userEvent.click(status);
    await userEvent.click(await screen.findByRole('option', { name: 'Semua' }));

    // "Semua" dikirim eksplisit — absen dari query berarti hal lain bagi backend.
    await waitFor(() => {
      const akhir = panggil.mock.calls.at(-1)?.[0] as { is_active_pst?: unknown };
      expect(akhir.is_active_pst).toBe('semua');
    });
  });
});
