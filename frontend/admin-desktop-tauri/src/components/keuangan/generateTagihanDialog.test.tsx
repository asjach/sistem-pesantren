import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import GenerateTagihanDialog from './GenerateTagihanDialog';
import type { JenisTagihan, KandidatTagihanRow, PratinjauSantri } from '@/api/keuangan';
import { renderDenganTema } from '@/test/utils';

/** Kandidat & pratinjau dipanggil komponen; sisanya dijinakkan agar test ini
 *  tidak menyentuh jaringan lewat ExcelTable/preset. */
const api = vi.hoisted(() => ({ kandidat: vi.fn(), pratinjau: vi.fn() }));

vi.mock('@/api/keuangan', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/keuangan')>();
  return {
    ...asli,
    kandidatTagihan: (p: unknown) => api.kandidat(p),
    pratinjauTagihan: (p: unknown) => api.pratinjau(p),
  };
});

vi.mock('@/api/toolbarPreset', () => ({
  muatToolbarPreset: vi.fn(async () => ({ pesan: 'ok', data: { table_key: 'uji', visibilitas: {}, lebar: {}, urutan: [], align: {} } })),
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

beforeAll(() => {
  // jsdom tak punya PointerEvent; kartu hover Radix (HoverCardTrigger) membaca
  // onPointerEnter, jadi event pointer harus bisa dibentuk userEvent.hover.
  if (!('PointerEvent' in globalThis)) {
    (globalThis as unknown as { PointerEvent: unknown }).PointerEvent = MouseEvent;
  }
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

const JENIS: JenisTagihan[] = [{ id: 1, nama: 'Infaq Bulanan', tipe: 'bulanan', jenjang: null, is_active: true }];

const KANDIDAT: KandidatTagihanRow = {
  santri_id: 7, nama_lengkap: 'Ahmad Fauzi', jk: 'L', nisn: null, nis_lokal: '1234',
  jenjang: 'MI', tingkat: '1', kelas: 'MI-1A', kelas_id: 3, status_akhir: 'aktif',
  tagihan_periode: 0, tagihan_nominal: 0, tagihan_terbayar: 0,
};

/** Balasan pratinjau: 100.000 dipotong 50% oleh paket "Anak Pegawai". */
const PRATINJAU: PratinjauSantri = {
  santri_id: 7, nominal: 50000, potongan: 50000,
  dispensasi_ids: [9], dispensasi_nama: ['Anak Pegawai'],
  seragam: true, tak_kebagian: [],
  periode: [{
    periode: '2025-07', nominal: 50000, potongan: 50000,
    dispensasi_ids: [9], nama: ['Anak Pegawai'],
    langkah: [{ id: 9, nama: 'Anak Pegawai', tipe: 'persen', nilai: 50, sebelum: 100000, sesudah: 50000, potongan: 50000 }],
    sebab: null,
  }],
};

beforeEach(() => {
  api.kandidat.mockReset();
  api.pratinjau.mockReset();
});

function renderDialog() {
  renderDenganTema(
    <GenerateTagihanDialog
      open
      onOpenChange={vi.fn()}
      jenis={JENIS}
      tarif={[]}
      tahunAjaran="2025/2026"
      onSelesai={vi.fn()}
    />,
  );
}

/** Pilih jenis + isi nominal default, lalu pindahkan satu santri ke kanan. */
async function siapkanSatuBaris() {
  renderDialog();
  await userEvent.selectOptions(document.getElementById('sel_gen_jenis') as HTMLSelectElement, '1');
  fireEvent.change(document.getElementById('inp_gen_nominal') as HTMLInputElement, { target: { value: '100000' } });
  // Tombol aksi baris hanya muncul setelah kandidat termuat dari API.
  await waitFor(() => expect(document.getElementById('btn_gen_pindah_7')).not.toBeNull());
  await userEvent.click(document.getElementById('btn_gen_pindah_7') as HTMLButtonElement);
}

describe('GenerateTagihanDialog — pratinjau backend', () => {
  it('memakai nominal & dispensasi dari pratinjau backend, bukan hitungan lokal', async () => {
    api.kandidat.mockResolvedValue({ data: [KANDIDAT], current_page: 1, last_page: 1, total: 1, per_page: 50 });
    api.pratinjau.mockResolvedValue([PRATINJAU]);

    await siapkanSatuBaris();

    await waitFor(() => expect(api.pratinjau).toHaveBeenCalled());
    // Payload sama dengan yang nanti dikirim generate: baris otomatis tanpa
    // nominal (backend yang menghitung), periode rentang TA terisi.
    expect(api.pratinjau).toHaveBeenLastCalledWith({
      tahun_ajaran: '2025/2026', jenis_id: 1,
      periode: '2025-07', periode_sampai: '2026-06',
      nominal: 100000, santri: [{ santri_id: 7 }],
    });
    await waitFor(() => expect(document.body.textContent).toContain('−Rp 50.000 · Anak Pegawai'));
    expect(screen.getByText(/total Rp 50\.000/)).toBeInTheDocument();
  });

  it('menampilkan rincian potongan per bulan saat nominalnya berubah antar bulan', async () => {
    api.kandidat.mockResolvedValue({ data: [KANDIDAT], current_page: 1, last_page: 1, total: 1, per_page: 50 });
    // Juli bebas penuh (kuota paket habis), Agustus–September failover 50%.
    api.pratinjau.mockResolvedValue([{
      ...PRATINJAU,
      seragam: false,
      periode: [
        { periode: '2025-07', nominal: 0, potongan: 100000, dispensasi_ids: [9], nama: ['Anak Pegawai'], langkah: [], sebab: null },
        { periode: '2025-08', nominal: 50000, potongan: 50000, dispensasi_ids: [10], nama: ['Prestasi'], langkah: [], sebab: null },
        { periode: '2025-09', nominal: 50000, potongan: 50000, dispensasi_ids: [10], nama: ['Prestasi'], langkah: [], sebab: null },
      ],
    }]);

    await siapkanSatuBaris();

    // Nama paket ikut tampil karena paketnya berpindah antar rentang.
    await waitFor(() => expect(document.body.textContent)
      .toContain('Jul: 0 (Anak Pegawai) · Agu–Sep: 50.000 (Prestasi)'));
  });

  it('menampilkan kartu hover berisi potongan tiap paket per rentang bulan', async () => {
    api.kandidat.mockResolvedValue({ data: [KANDIDAT], current_page: 1, last_page: 1, total: 1, per_page: 50 });
    // Juli–September sama; Oktober pindah paket karena kuota yang lama habis.
    api.pratinjau.mockResolvedValue([{
      ...PRATINJAU,
      seragam: false,
      periode: [
        {
          periode: '2025-07', nominal: 50000, potongan: 50000, dispensasi_ids: [9], nama: ['Anak Pegawai'],
          langkah: [{ id: 9, nama: 'Anak Pegawai', tipe: 'persen', nilai: 50, sebelum: 100000, sesudah: 50000, potongan: 50000 }],
          sebab: null,
        },
        {
          periode: '2025-08', nominal: 50000, potongan: 50000, dispensasi_ids: [9], nama: ['Anak Pegawai'],
          langkah: [{ id: 9, nama: 'Anak Pegawai', tipe: 'persen', nilai: 50, sebelum: 100000, sesudah: 50000, potongan: 50000 }],
          sebab: null,
        },
        {
          periode: '2025-09', nominal: 50000, potongan: 50000, dispensasi_ids: [9], nama: ['Anak Pegawai'],
          langkah: [{ id: 9, nama: 'Anak Pegawai', tipe: 'persen', nilai: 50, sebelum: 100000, sesudah: 50000, potongan: 50000 }],
          sebab: null,
        },
        {
          periode: '2025-10', nominal: 0, potongan: 100000, dispensasi_ids: [11], nama: ['Prestasi Ganjil'],
          langkah: [{ id: 11, nama: 'Prestasi Ganjil', tipe: 'bebas', nilai: 0, sebelum: 100000, sesudah: 0, potongan: 100000 }],
          sebab: null,
        },
      ],
    }]);

    await siapkanSatuBaris();

    // Sel ringkas dulu (teks tetap pendek).
    await waitFor(() => expect(document.body.textContent)
      .toContain('Jul–Sep: 50.000 (Anak Pegawai) · Okt: 0 (Prestasi Ganjil)'));

    // Hover sel → kartu memuat rentang + potongan tiap paket.
    const sel = [...document.querySelectorAll('[data-col-key="rincian"]')]
      .find((e) => e.textContent.trim() !== 'Rincian Bulan') as HTMLElement;
    await userEvent.hover(sel);

    await screen.findByText('Rincian potongan per bulan');
    expect(screen.getByText('Jul 2025 – Sep 2025')).toBeInTheDocument();
    expect(screen.getByText('(3 bulan)')).toBeInTheDocument();
    expect(screen.getAllByText(/Anak Pegawai · 50%/).length).toBeGreaterThan(0);
    expect(screen.getByText('Okt 2025')).toBeInTheDocument();
    expect(screen.getByText(/Prestasi Ganjil · Bebas/)).toBeInTheDocument();
    expect(screen.getAllByText('−50.000').length).toBeGreaterThan(0);
    expect(screen.getByText('−100.000')).toBeInTheDocument();
  });

  it('menyebut baris yang dilewati generate di kolom dispensasi', async () => {
    api.kandidat.mockResolvedValue({ data: [KANDIDAT], current_page: 1, last_page: 1, total: 1, per_page: 50 });
    api.pratinjau.mockResolvedValue([{
      ...PRATINJAU,
      nominal: 100000, potongan: 0, dispensasi_ids: null, dispensasi_nama: [],
      periode: [{
        periode: '2025-07', nominal: 100000, potongan: 0,
        dispensasi_ids: [], nama: [], langkah: [], sebab: 'sudah ada pembayaran',
      }],
    }]);

    await siapkanSatuBaris();

    await waitFor(() => expect(document.body.textContent).toContain('sudah ada pembayaran'));
    expect(screen.getByText(/total Rp 100\.000/)).toBeInTheDocument();
  });

  it('memberi tahu saat pratinjau gagal (nominal tampil sebelum dispensasi)', async () => {
    api.kandidat.mockResolvedValue({ data: [KANDIDAT], current_page: 1, last_page: 1, total: 1, per_page: 50 });
    api.pratinjau.mockRejectedValue(new Error('jaringan putus'));

    await siapkanSatuBaris();

    await waitFor(() => expect(
      screen.getByText(/Pratinjau potongan gagal dimuat/),
    ).toBeInTheDocument());
  });
});
