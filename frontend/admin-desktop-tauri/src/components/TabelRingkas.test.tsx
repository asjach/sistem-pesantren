import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderDenganTema } from '@/test/utils';

// ---- Mock API (unit test tidak boleh memanggil fetch nyata) ----

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

// ---- Stub jsdom untuk react-datasheet-grid ----

vi.mock('react-datasheet-grid', async (importOriginal) => {
  const asli = await importOriginal<typeof import('react-datasheet-grid')>();
  const stub = await import('./excel/_dsgStubDom');
  return { ...asli, DynamicDataSheetGrid: stub.DynamicDataSheetGridStub };
});

import TabelRingkas from './TabelRingkas';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

/** Root <section> pembungkus kartu tabel. */
function kartu(container: HTMLElement): HTMLElement {
  const el = container.querySelector('section');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

describe('TabelRingkas — jarak judul vs tabel', () => {
  it('section pembungkus tanpa padding; header judul tetap berpadding', () => {
    const { container } = renderDenganTema(
      <TabelRingkas
        tableKey="uji"
        judul="Per tahun ajaran"
        kolom={[{ key: 'ta', label: 'Tahun ajaran' }]}
        baris={[['2026/2027']]}
      />,
    );

    const section = kartu(container);
    // Padding luar = 0: kartu menempel tepi panel.
    expect(section.className).not.toMatch(/\bp[xytblr]?-\d/);
    // Header justru MENJAGA padding (px-3 py-1.5) agar judul tidak sesempit
    // tepi card — ini yang dikoreksi pengguna setelah padding dihapus.
    const header = section.querySelector('header');
    expect(header).not.toBeNull();
    expect((header as HTMLElement).className).toMatch(/\bpx-3\b/);
    expect((header as HTMLElement).className).toMatch(/\bpy-1\.5\b/);
    // Judul kartu tampil UPPERCASE (pola header tabel lain di aplikasi).
    const spanJudul = header?.querySelector('span');
    expect(spanJudul?.className).toMatch(/\buppercase\b/);
  });

  it('wrapper grid di dalam header tidak menambah padding', () => {
    const { container } = renderDenganTema(
      <TabelRingkas
        tableKey="uji"
        judul="Per kelas"
        kolom={[{ key: 'kelas', label: 'Kelas' }]}
        baris={[['VII-A']]}
      />,
    );

    // Padding dalam kartu dihapus: grid menempel tepat di bawah header.
    const wrapper = kartu(container).querySelector(':scope > div');
    expect(wrapper).not.toBeNull();
    expect((wrapper as HTMLElement).className).not.toMatch(/\bp[xytblr]?-\d/);
  });

  it('wrapper grid tidak menambah jarak vertikal (mt-2) antara judul dan tabel', () => {
    const { container } = renderDenganTema(
      <TabelRingkas
        tableKey="uji"
        judul="Per tingkat"
        kolom={[{ key: 'tingkat', label: 'Tingkat' }]}
        baris={[['VII']]}
      />,
    );

    // `mt-2` pada ExcelTable adalah celah yang dulu terlihat di antara judul
    // dan grid. TabelRingkas mematikan lewat `judulPemilik`, jadi kelas itu
    // tidak boleh muncul pada pembungkus grid di dalam kartu.
    const grid = container.querySelector<HTMLElement>('.simpes-dsg');
    expect(grid).not.toBeNull();
    // Berjalan naik dari grid: pembungkus ExcelTable (yang biasanya mt-2).
    let atas: HTMLElement | null = (grid as HTMLElement).parentElement;
    while (atas && !atas.className.includes('simpes-dsg')) {
      expect(atas.className).not.toMatch(/(^|\s)mt-\d/);
      atas = atas.parentElement;
    }
  });
});