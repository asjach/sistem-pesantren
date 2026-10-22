import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

import type { Dispensasi, JenisTagihan } from '@/api/keuangan';
import type { TahunAjaran } from '@/api/master';
import type { PilihanLembaga } from '@/lembagaAktif';
import { renderDenganTema } from '@/test/utils';
import { resetSetelanKomponen } from '@/components/komponenCustom';
import DispensasiDialog, { santriIdsUntuk, tambahAturan } from './DispensasiDialog';
import { dsgStub, kolomTerakhir } from '@/components/excel/_dsgStubDom';

const api = vi.hoisted(() => ({ buat: vi.fn(async () => ({})), ubah: vi.fn(async () => ({})) }));
vi.mock('@/api/keuangan', async (asli) => ({
  ...(await asli<typeof import('@/api/keuangan')>()),
  buatDispensasi: api.buat,
  ubahDispensasi: api.ubah,
}));
vi.mock('sonner', async (asli) => ({
  ...(await asli<typeof import('sonner')>()),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
beforeEach(() => { vi.clearAllMocks(); });

vi.mock('@/api/toolbarPreset', () => ({
  muatToolbarPreset: vi.fn(async () => ({
    pesan: 'ok',
    data: { table_key: 'uji', visibilitas: {}, lebar: {}, urutan: [] },
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

// GridV2 menunggu ukuran container sebelum render. Ini hanya membuka jalur
// wiring dialog di jsdom; layout dan scroll tetap diperiksa manual.
const tinggi = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
const canvas = HTMLCanvasElement.prototype.getContext;
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 320 });
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof canvas;
});
afterAll(() => {
  if (tinggi) Object.defineProperty(HTMLElement.prototype, 'clientHeight', tinggi);
  HTMLCanvasElement.prototype.getContext = canvas;
});

function paket(partial: Partial<Dispensasi> = {}): Dispensasi {
  return {
    id: 2, nama: 'Anak Pegawai', keterangan: null, tahun_ajaran: '2025/2026',
    kuota_bulan: null, grup: null,
    santri_ids: null, is_active: true, aturan: [], ...partial,
  };
}

describe('santriIdsUntuk', () => {
  it('mode ubah mempertahankan daftar penerima yang ada (bukan null)', () => {
    expect(santriIdsUntuk(paket({ santri_ids: [1, 2] }), null)).toEqual([1, 2]);

    expect(santriIdsUntuk(paket(), null)).toBeNull();
  });

  it('mode tambah: kosong, atau santri awal saat dibuka dari profil santri', () => {
    expect(santriIdsUntuk(null, null)).toBeNull();
    expect(santriIdsUntuk(null, { id: 7 })).toEqual([7]);
  });

  it('santri awal diabaikan saat mengubah paket yang sudah ada', () => {
    expect(santriIdsUntuk(paket({ santri_ids: [3] }), { id: 9 })).toEqual([3]);
  });
});

const JENIS: JenisTagihan[] = [
  { id: 1, nama: 'Infaq Bulanan', tipe: 'bulanan', jenjang: null, keterangan: null, urutan: 0, is_active: true },
  { id: 2, nama: 'Uang Pangkal', tipe: 'non_bulanan', jenjang: 'MI', keterangan: null, urutan: 0, is_active: true },
];

const DAFTAR_TA: TahunAjaran[] = [
  { nama: '2026/2027', tanggal_mulai: null, tanggal_selesai: null, is_aktif: true },
  { nama: '2025/2026', tanggal_mulai: null, tanggal_selesai: null, is_aktif: false },
];

/** Lingkup jenjang yang boleh dipakai pembuat paket (dari perannya). */
const PILIHAN_LEMBAGA: PilihanLembaga[] = [
  { jenjang: 'MI', nama: 'Madrasah Ibtidaiyah' },
  { jenjang: 'MD', nama: 'Madrasah Diniyah' },
];

async function renderDialog(editing: Dispensasi | null = null, jenis: JenisTagihan[] = JENIS, onOpenChange = vi.fn()) {
  // Tunggu preference async dan pengukuran awal grid sebelum assertion.
  await act(async () => {
    renderDenganTema(
      <DispensasiDialog
        open
        onOpenChange={onOpenChange}
        editing={editing}
        jenis={jenis}
        daftarTA={DAFTAR_TA}
        pilihanLembaga={PILIHAN_LEMBAGA}
        onSaved={() => {}}
      />,
    );
  });
  return { onOpenChange };
}

/** Jenis lintas lembaga: satu global, satu MI, satu MD — untuk menguji
 *  penyaringan daftar kiri oleh lingkup jenjang paket. */
const JENIS_LINTAS: JenisTagihan[] = [
  { id: 1, nama: 'Infaq Bulanan', tipe: 'bulanan', jenjang: null, keterangan: null, urutan: 0, is_active: true },
  { id: 2, nama: 'Uang Pangkal', tipe: 'non_bulanan', jenjang: 'MI', keterangan: null, urutan: 0, is_active: true },
  { id: 3, nama: 'SPP MD', tipe: 'bulanan', jenjang: 'MD', keterangan: null, urutan: 0, is_active: true },
];

describe('tambahAturan', () => {
  it('aturan baru memakai bawaan Persen 0%', () => {
    expect(tambahAturan([], 5)).toEqual([{ jenisId: 5, tipe: 'persen', nilai: '0' }]);
  });

  it('jenis yang sudah punya aturan tidak digandakan', () => {
    const lama = [{ jenisId: 5, tipe: 'nominal' as const, nilai: '25000' }];
    expect(tambahAturan(lama, 5)).toBe(lama);
  });
});

describe('DispensasiDialog — dua tabel tagihan & aturan', () => {
  it('merender seluruh isian identitas paket + aksi simpan', async () => {
    resetSetelanKomponen();
    await renderDialog();

    expect(screen.getByText('Tambah Dispensasi')).toBeInTheDocument();
    for (const id of [
      'inp_dispensasi_nama',
      'sel_dispensasi_ta',
      'sel_dispensasi_jenjang',
      'inp_dispensasi_kuota',
      'inp_dispensasi_grup',
      'inp_dispensasi_keterangan',
      'chk_dispensasi_aktif',
      'btn_dispensasi_simpan',
    ]) {
      expect(document.getElementById(id), id).not.toBeNull();
    }
  });

  it('lingkup jenjang paket menyembunyikan jenis lembaga lain', async () => {
    resetSetelanKomponen();
    await renderDialog(paket({ jenjang: 'MI' }), JENIS_LINTAS);
    await screen.findByRole('button', { name: 'Tambahkan Infaq Bulanan ke aturan dispensasi' });

    // Lingkup MI: hanya jenis global + MI yang ditawarkan (MD disembunyikan).
    expect(screen.getByText('Tagihan (2)')).toBeInTheDocument();
    expect(document.getElementById('btn_dispensasi_tambah_1')).not.toBeNull();
    expect(document.getElementById('btn_dispensasi_tambah_2')).not.toBeNull();
    expect(document.getElementById('btn_dispensasi_tambah_3')).toBeNull();
  });

  it('paket berlingkup di luar wewenang tak menyamar jadi semua lembaga', async () => {
    resetSetelanKomponen();
    await renderDialog(paket({ jenjang: 'MTS' }));

    expect(document.getElementById('sel_dispensasi_jenjang')).toHaveValue('MTS — di luar lingkup Anda');
  });

  it('paket tanpa lingkup jenjang menawarkan seluruh jenis', async () => {
    resetSetelanKomponen();
    await renderDialog(paket({ jenjang: null }), JENIS_LINTAS);
    await screen.findByRole('button', { name: 'Tambahkan SPP MD (MD) ke aturan dispensasi' });

    expect(screen.getByText('Tagihan (3)')).toBeInTheDocument();
    expect(document.getElementById('btn_dispensasi_tambah_3')).not.toBeNull();
  });

  it('tabel Tagihan hanya memuat jenis yang BELUM punya aturan', async () => {
    resetSetelanKomponen();
    await renderDialog(paket({ aturan: [{ id: 1, dispensasi_id: 2, jenis_id: 1, tipe: 'persen', nilai: 50 }] }));
    await screen.findByRole('button', { name: 'Tambahkan Uang Pangkal (MI) ke aturan dispensasi' });

    expect(screen.getByText('Aturan Dispensasi (1)')).toBeInTheDocument();
    expect(screen.getByText('Tagihan (1)')).toBeInTheDocument();

    expect(document.getElementById('btn_dispensasi_tambah_2')).not.toBeNull();
    expect(document.getElementById('btn_dispensasi_tambah_1')).toBeNull();
    expect(document.getElementById('btn_dispensasi_hapus_aturan_1')).not.toBeNull();
  });

  it('menekan → memindahkan tagihan ke tabel aturan', async () => {
    resetSetelanKomponen();
    await renderDialog();
    expect(screen.getByText('Tagihan (2)')).toBeInTheDocument();
    expect(screen.getByText('Aturan Dispensasi (0)')).toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: 'Tambahkan Uang Pangkal (MI) ke aturan dispensasi' }));

    expect(screen.getByText('Aturan Dispensasi (1)')).toBeInTheDocument();
    expect(screen.getByText('Tagihan (1)')).toBeInTheDocument();
    expect(document.getElementById('btn_dispensasi_tambah_2')).toBeNull();
    expect(document.getElementById('btn_dispensasi_hapus_aturan_2')).not.toBeNull();
  });

  it('aksi klik kanan V2 menambahkan aturan bawaan dan menghabiskan daftar tanpa duplikasi', async () => {
    resetSetelanKomponen();
    await renderDialog(null, [JENIS[0]]);
    const button = await screen.findByRole('button', { name: 'Tambahkan Infaq Bulanan ke aturan dispensasi' });
    fireEvent.contextMenu(button);
    const menu = await screen.findByRole('menu');
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Tambahkan Infaq Bulanan ke aturan dispensasi' }));

    await waitFor(() => expect(screen.getByText('Tagihan (0)')).toBeInTheDocument());
    expect(screen.getByText('Aturan Dispensasi (1)')).toBeInTheDocument();
    expect(screen.getByText('Semua jenis tagihan sudah punya aturan.')).toBeInTheDocument();
    expect(screen.getByText('Persen (%)')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByText('0')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tambahkan Infaq Bulanan ke aturan dispensasi' })).toBeNull();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Escape menutup menu tagihan tanpa menutup dialog atau mengubah aturan', async () => {
    resetSetelanKomponen();
    await renderDialog();
    const button = await screen.findByRole('button', { name: 'Tambahkan Infaq Bulanan ke aturan dispensasi' });
    fireEvent.contextMenu(button);
    await screen.findByRole('menu');
    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Aturan Dispensasi (0)')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });
});

const PAKET_ATURAN = () => paket({
  aturan: [{ id: 1, dispensasi_id: 2, jenis_id: 1, tipe: 'persen', nilai: 50 }],
});

async function mulaiEditAturan() {
  fireEvent.doubleClick(within(screen.getByRole('dialog')).getByText('Persen (%)'));
  await screen.findByRole('combobox', { name: 'Tipe' });
}

describe('DispensasiDialog — aturan V2', () => {
  it.each([
    ['Nominal (Rp)', 'nominal', 50],
    ['Persen (%)', 'persen', 50],
    ['Bebas penuh', 'bebas', 0],
  ])('pilihan %s dikirim dengan nilai API yang sama hanya saat Simpan', async (label, tipe, nilai) => {
    resetSetelanKomponen();
    await renderDialog(PAKET_ATURAN());
    await mulaiEditAturan();
    await userEvent.click(screen.getByRole('combobox', { name: 'Tipe' }));
    await userEvent.click(await screen.findByRole('option', { name: label }));
    expect(api.ubah).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    await waitFor(() => expect(api.ubah).toHaveBeenCalledWith(2, expect.objectContaining({
      aturan: [{ jenis_id: 1, tipe, nilai }],
    })));
  });

  it('hapus aturan lewat klik kanan mengembalikan tagihan ke daftar kandidat', async () => {
    resetSetelanKomponen();
    await renderDialog(PAKET_ATURAN());
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Hapus Infaq Bulanan' }));
    const menu = await screen.findByRole('menu');
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Hapus Infaq Bulanan' }));
    expect(screen.getByText('Aturan Dispensasi (0)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambahkan Infaq Bulanan ke aturan dispensasi' })).toBeInTheDocument();
    expect(api.ubah).not.toHaveBeenCalled();
  });

  it('paste dan delete nilai mempertahankan validasi angka dan batas persen saat Simpan', async () => {
    resetSetelanKomponen();
    await renderDialog(PAKET_ATURAN());
    await mulaiEditAturan();
    // Stub tidak meniru clipboard/geometri DSG. Jalankan kontrak column yang
    // diberikan dialog agar hanya wiring nilai dan validasi yang diuji.
    const row = { id: 1, jenis: 'Infaq Bulanan', tipe: 'persen', nilai: '50', checked: false };
    const column = kolomTerakhir().find((c) => c.id === 'nilai')!;
    expect(column.pasteValue).toBeTypeOf('function');
    expect(column.deleteValue).toBeTypeOf('function');
    for (const value of ['-1', 'abc']) {
      await act(async () => { dsgStub.ubah?.([column.pasteValue!({ rowData: row, value })]); });
      expect(toast.error).toHaveBeenLastCalledWith('Isi angka ≥ 0.');
    }
    await act(async () => { dsgStub.ubah?.([column.deleteValue!({ rowData: row })]); });
    expect(toast.error).toHaveBeenLastCalledWith('Isi angka ≥ 0.');
    await act(async () => { dsgStub.ubah?.([column.pasteValue!({ rowData: row, value: '101' })]); });
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(toast.error).toHaveBeenLastCalledWith('Nilai potongan Infaq Bulanan tidak valid (persen maks 100).');
    expect(api.ubah).not.toHaveBeenCalled();
    await act(async () => { dsgStub.ubah?.([column.pasteValue!({ rowData: { ...row, nilai: '101' }, value: '100' })]); });
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));
    await waitFor(() => expect(api.ubah).toHaveBeenCalledWith(2, expect.objectContaining({
      aturan: [{ jenis_id: 1, tipe: 'persen', nilai: 100 }],
    })));
  });

  it('edit nilai hanya mengubah draft dan Batal tidak memanggil API', async () => {
    resetSetelanKomponen();
    const { onOpenChange } = await renderDialog(PAKET_ATURAN());
    await mulaiEditAturan();
    fireEvent.doubleClick(within(screen.getByRole('dialog')).getByText('50'));
    // Editor cell belum memiliki label publik; batasi query ke container
    // field nilai agar tidak mengenai input identitas paket.
    const editor = screen.getByRole('dialog').querySelector('[data-col-key="nilai"] input') as HTMLInputElement;
    expect(editor).not.toBeNull();
    await userEvent.clear(editor);
    await userEvent.type(editor, '75{Enter}');
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByText('75')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(api.ubah).not.toHaveBeenCalled();
    expect(api.buat).not.toHaveBeenCalled();
  });
});
