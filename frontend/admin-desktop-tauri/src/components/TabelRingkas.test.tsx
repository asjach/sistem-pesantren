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
  arahKolomDariOpsi: vi.fn(() => undefined),
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
  it('section pembungkus tanpa padding; bilah judul tetap berpadding', () => {
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
    /* Bilah judul TIDAK lagi <header> milik TabelRingkas — ia bilah judul
       ExcelTable (yang juga menampung gerigi Pengaturan tabel ini). Yang penting
       tetap sama: padding kiri dijaga supaya judul tidak sesempit tepi card —
       ini yang dikoreksi pengguna setelah padding dihapus — sementara padding
       kanan ditipiskan ke 4px (kontrol paling kanan di tepi), dan tingginya
       dikunci `min-h-8`, bukan padding vertikal. */
    const bilah = container.querySelector<HTMLElement>('[data-part="header_tabel"]');
    expect(bilah).not.toBeNull();
    expect(bilah?.className).toMatch(/\bpl-3\b/);
    expect(bilah?.className).toMatch(/\bpr-1\b/);
    expect(bilah?.className).toMatch(/\bmin-h-8\b/);
    // Judul kartu sentence case (tanpa UPPERCASE) — diselaraskan dengan bilah
    // judul ExcelTable dan bahasa "buku induk" (skill frontend-design melarang
    // label huruf kapital semua).
    const spanJudul = bilah?.querySelector('span');
    expect(spanJudul?.className ?? '').not.toMatch(/\buppercase\b/);
    expect(spanJudul?.textContent).toBe('Per tahun ajaran');
  });

  it('gerigi Pengaturan tabel ini tampil di bilah judul tabel ringkas', () => {
    // TabelRingkas tak menggambar judul sendiri precisely supaya bilah judul
    // ExcelTable tetap dirender — tanpa itu gerigi Kelola Tabel tak terjangkau.
    renderDenganTema(
      <TabelRingkas
        tableKey="uji"
        judul="Per kelas"
        kolom={[{ key: 'kelas', label: 'Kelas' }]}
        baris={[['VII-A']]}
      />,
    );
    expect(document.getElementById('btn_pengaturan_tabel_uji')).not.toBeNull();
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
    // dan grid. Bilah judul ExcelTable kini ikut dirender (judul diserahkan ke
    // sana), jadi kelas itu tidak boleh muncul pada pembungkus grid.
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