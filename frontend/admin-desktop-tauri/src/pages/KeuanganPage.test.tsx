import { MemoryRouter } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import KeuanganPage from './KeuanganPage';
import { renderDenganTema } from '@/test/utils';
import type { CrosstabTagihan } from '@/api/keuangan';

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

/* Kunci diagnosa balapan: request "a" dibuat TERTUNDA (tidak langsung resolve),
   lalu "zzz" selesai duluan. Tanpa penjaga req/abort di loadCrosstab, balasan
   lama yang tiba belakangan menimpa data baru — persis yang terjadi di browser
   sebelum perbaikan ini (baris lama tetap tampil untuk kueri "zzz").

   `vi.hoisted` wajib: factory vi.mock di-hoist ke atas file, sehingga ia tak
   boleh menyentuh const biasa yang belum terinisialisasi. */
const uji = vi.hoisted(() => {
  const KOLOM = { key: '1|bulanan|2025-07', jenis_id: 1, jenis_nama: 'Infaq Bulanan', tipe: 'bulanan' as const, periode: '2025-07' };
  /** Crosstab `n` baris bernama "Awalan i" — nama dipakai sebagai pembeda. */
  const crosstub = (n: number, awalan: string) => ({
    kolom: [KOLOM],
    baris: Array.from({ length: n }, (_, i) => ({
      santri_id: i + 1,
      nama: `${awalan} ${i + 1}`,
      jenjang: 'MI',
      ayah_nama: null,
      ibu_nama: null,
      sel: {
        [KOLOM.key]: {
          id: i + 1, nominal: 75000, terbayar: 0, sisa: 75000,
          status: 'belum' as const, terlambat: false, jatuh_tempo: null, tahun_ajaran: '2025/2026',
        },
      },
      total_tagihan: 75000, total_terbayar: 0, tunggakan: 0,
    })),
    total: n, per_page: 50, current_page: 1, last_page: 1,
  });
  const tertunda: { saisi: (() => void) | null } = { saisi: null };
  const crosstabTagihan = vi.fn(({ santri }: { santri?: string }) => {
    if (santri === 'a') {
      return new Promise((resolve) => {
        tertunda.saisi = () => resolve(crosstub(50, 'Lama'));
      });
    }
    return Promise.resolve(crosstub(santri === 'zzz' ? 0 : 50, 'Baru'));
  });
  return { crosstub, tertunda, crosstabTagihan };
});

vi.mock('@/api/keuangan', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/keuangan')>();
  return {
    ...asli,
    crosstabTagihan: uji.crosstabTagihan,
    daftarJenis: vi.fn(async () => []),
    daftarTarif: vi.fn(async () => []),
    daftarTunggakan: vi.fn(async () => ({ pesan: 'ok', data: [], meta: { current_page: 1, last_page: 1, total: 0, per_page: 50 } })),
    daftarDispensasi: vi.fn(async () => []),
    riwayatPembayaran: vi.fn(async () => ({ pesan: 'ok', data: [] })),
  };
});

/* Array filter WAJIB stabil (didefinisikan sekali): halaman memakai
   `tahunAjaranNames`/`jenjangs` sebagai dependensi effect. Kalau factory mock
   mengembalikan array baru tiap render, effectnya berjalan berulang → loop render. */
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
  targetTunggal: () => new Date(),
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
  muatUrutPreset: vi.fn(async () => ({ pesan: 'ok', data: { table_key: 'uji', opsi: [], tersedia: [] } })),
  simpanUrutPreset: vi.fn(),
  hapusUrutPreset: vi.fn(),
}));

vi.mock('react-datasheet-grid', async (importOriginal) => {
  const asli = await importOriginal<typeof import('react-datasheet-grid')>();
  const stub = await import('@/components/excel/_dsgStubDom');
  return { ...asli, DynamicDataSheetGrid: stub.DynamicDataSheetGridStub };
});

beforeEach(() => {
  vi.clearAllMocks();
  uji.tertunda.saisi = null;
});

/** Buka tab Tagihan dan tunggu muat awal selesai. Halaman memakai
 *  `useLocation` (VisibilitasFilter), jadi dibungkus Router. */
async function bukaTabTagihan() {
  renderDenganTema(
    <MemoryRouter initialEntries={['/keuangan']}>
      <KeuanganPage />
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole('tab', { name: 'Tagihan' }));
  await waitFor(() => expect(screen.getByText('Baru 1')).toBeInTheDocument());
}

describe('KeuanganPage — muat crosstab', () => {
  it('menampilkan data crosstab setelah tab Tagihan dibuka', async () => {
    await bukaTabTagihan();
    expect(screen.getByText('Baru 1')).toBeInTheDocument();
  });

  it('menunda pencarian 400 ms sebelum memanggil API', async () => {
    await bukaTabTagihan();
    const sebelum = uji.crosstabTagihan.mock.calls.length;
    await userEvent.type(screen.getByPlaceholderText(/Cari nama/i), 'a');
    // Tiba-tiba belum ada request baru: nilai masih ditunda.
    expect(uji.crosstabTagihan.mock.calls.length).toBe(sebelum);
    await waitFor(() => expect(uji.crosstabTagihan.mock.calls.length).toBeGreaterThan(sebelum));
  });

  it('mengabaikan balasan lama yang tiba setelah balasan baru', async () => {
    await bukaTabTagihan();
    const input = screen.getByPlaceholderText(/Cari nama/i);

    await userEvent.type(input, 'a');
    // Tunggu debounce 400 ms agar request "a" benar-benar terkirim.
    await waitFor(() => expect(uji.tertunda.saisi).not.toBeNull());

    await userEvent.clear(input);
    await userEvent.type(input, 'zzz');
    // Hasil "zzz" = 0 baris → tabel kosong (nama "Barus" hilang).
    await waitFor(() => expect(screen.queryByText('Baru 1')).not.toBeInTheDocument());

    // Balasan lama tiba belakangan: harus TIDAK menimpa tabel.
    uji.tertunda.saisi?.();
    await waitFor(() => expect(screen.queryByText('Lama 1')).not.toBeInTheDocument());
  });
});