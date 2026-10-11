import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import RekapSantriPage from './RekapSantriPage';
import { renderDenganTema } from '@/test/utils';
import type { RekapSantri } from '@/api/siklus';

// ---- Stub jsdom untuk Radix Select + panel resizable ----

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
    HTMLElement.prototype.scrollIntoView = () => {};
  }
  // jsdom: Range.getClientRects belum ada; pengukur tinggi header ExcelTable
  // memakainya. Data kosong = 1 baris teks (cukup untuk pengukuran di test).
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () => ({ length: 0, item: () => null }) as unknown as DOMRectList;
  }
  // jsdom tanpa paket canvas: kembalikan null agar AutoFit lebar kolom berhenti
  // di gerbang `if (!ctx) return null` (bukan log "Not implemented").
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

const rekap: RekapSantri = {
  total_aktif: 543,
  per_tahun_ajaran: [],
  per_tingkat: [],
  per_kelas: [],
  usia_per_tingkat: [],
};

const rekapUsia: RekapSantri = {
  total_aktif: 2,
  per_tahun_ajaran: [],
  per_tingkat: [],
  per_kelas: [],
  usia_per_tingkat: [
    { lembaga: 'MD', tingkat: '2', jumlah: 1, rata_usia: 9, min: 9, max: 9, kelompok: { '<7': 0, '7-9': 1, '10-12': 0, '13-15': 0, '>=16': 0 } },
    { lembaga: 'MI', tingkat: '2', jumlah: 1, rata_usia: 9, min: 9, max: 9, kelompok: { '<7': 0, '7-9': 1, '10-12': 0, '13-15': 0, '>=16': 0 } },
  ],
};

/** Fixture yang dikembalikan mock; tiap tes boleh menimpanya (StrictMode
 *  memanggil efek dua kali, jadi `mockResolvedValueOnce` tak cukup). */
let rekapAktif: RekapSantri = rekap;

const rekapSantri = vi.fn(async (_params: { keaktifan?: string }) => rekapAktif);
vi.mock('@/api/siklus', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/siklus')>();
  return { ...asli, rekapSantri: (params: { keaktifan?: string }) => rekapSantri(params) };
});

vi.mock('@/hooks/useFilterGlobalAktif', () => ({
  useFilterGlobalAktif: () => ({
    jenjangs: ['MI'],
    tahunAjaranNames: ['2025/2026'],
    semesters: ['1'],
    tingkat: [],
    kelas: [],
    loading: false,
  }),
}));

// ---- Mock API preset/urut (ExcelTable tidak boleh memanggil fetch nyata) ----

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
  localStorage.clear();
  rekapAktif = rekap;
});

describe('RekapSantriPage — filter keaktifan', () => {
  it('bawaan memuat dengan keaktifan=aktif', async () => {
    renderDenganTema(<RekapSantriPage />);

    await waitFor(() => expect(rekapSantri).toHaveBeenCalled());
    expect(rekapSantri.mock.calls[0][0]).toMatchObject({ keaktifan: 'aktif', jenjang: ['MI'] });
  });

  it('memilih Semua memuat ulang dengan keaktifan=semua — bukan tanpa filter', async () => {
    const user = userEvent.setup();
    renderDenganTema(<RekapSantriPage />);
    await waitFor(() => expect(rekapSantri).toHaveBeenCalledTimes(1));

    // Combobox Base UI: daftar dibuka lewat KEYBOARD. Di jsdom klik pointer
    // (input maupun tombol panah) tidak membuka popup — `aria-expanded` tetap
    // false — sehingga `{ArrowDown}` pada input yang difokus jadi caranya.
    const inp = screen.getByRole('combobox', { name: 'Filter keaktifan' });
    inp.focus();
    await user.keyboard('{ArrowDown}');
    await user.click(await screen.findByRole('option', { name: 'Semua' }));

    await waitFor(() => {
      expect(rekapSantri.mock.calls.at(-1)?.[0]).toMatchObject({ keaktifan: 'semua' });
    });
  });
});

describe('RekapSantriPage — tabel usia per tingkat', () => {
  it('pisahkan baris per lembaga dan tampilkan kolom Lembaga', async () => {
    rekapAktif = rekapUsia;
    renderDenganTema(<RekapSantriPage />);

    // Baris usia terpisah: MI dan MD sama-sama tingkat "2" tetapi tidak digabung
    // (tabel Per tingkat/Per kelas sengaja kosong di fixture, jadi "MI"/"MD" di
    // sini hanya mungkin berasal dari baris usia).
    expect(await screen.findByText('MD')).toBeInTheDocument();
    expect(screen.getByText('MI')).toBeInTheDocument();
    // Nilai usia ikut tampil: rata/min/max 9 pada 2 baris lembaga (6 sel) +
    // rata/min/max di baris "Jumlah" (3 sel).
    expect(screen.getAllByText('9')).toHaveLength(9);

    // Kolom Lembaga kini ada di Usia per tingkat — sama seperti tabel lain di
    // halaman ini (Per tingkat, Per kelas, Usia).
    expect(screen.getByText('Rata usia')).toBeInTheDocument();
    expect(screen.getAllByText('Lembaga')).toHaveLength(3);
  });
});
