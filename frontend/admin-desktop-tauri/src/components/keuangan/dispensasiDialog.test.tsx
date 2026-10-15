import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Dispensasi, JenisTagihan } from '@/api/keuangan';
import type { TahunAjaran } from '@/api/master';
import type { PilihanLembaga } from '@/lembagaAktif';
import { renderDenganTema } from '@/test/utils';
import { resetSetelanKomponen } from '@/components/komponenCustom';
import DispensasiDialog, { santriIdsUntuk, tambahAturan } from './DispensasiDialog';

// ---- Mock API (unit test tidak boleh memanggil fetch nyata) ----
// Sama dengan `ExcelTable.test.tsx`: dialog ini menanam ExcelTable, dan
// ExcelTable memuat preset/urut/komponen dari server saat dipasang.

vi.mock('@/api/toolbarPreset', () => ({
  muatToolbarPreset: vi.fn(async () => ({
    pesan: 'ok',
    data: { table_key: 'uji', visibilitas: {}, lebar: {}, urutan: [] },
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

// ---- Stub jsdom untuk react-datasheet-grid (grid tak bisa hidup di jsdom) ----

vi.mock('react-datasheet-grid', async (importOriginal) => {
  const asli = await importOriginal<typeof import('react-datasheet-grid')>();
  const stub = await import('@/components/excel/_dsgStubDom');
  return { ...asli, DynamicDataSheetGrid: stub.DynamicDataSheetGridStub };
});

function paket(partial: Partial<Dispensasi> = {}): Dispensasi {
  return {
    id: 2, nama: 'Anak Pegawai', keterangan: null, tahun_ajaran: '2025/2026',
    kuota_bulan: null, grup: null,
    santri_ids: null, is_active: true, aturan: [], ...partial,
  };
}

/* Dialog tidak lagi mengelola penerima (pindah ke halaman Dispensasi), jadi
   satu-satunya hal yang tersisa soal penerima adalah nilai `santri_ids` yang
   dikirim saat simpan — dan salah di sini artinya kehilangan data. */
describe('santriIdsUntuk', () => {
  it('mode ubah mempertahankan daftar penerima yang ada (bukan null)', () => {
    expect(santriIdsUntuk(paket({ santri_ids: [1, 2] }), null)).toEqual([1, 2]);
    // Paket tanpa penerima tetap null (tak ada yang perlu dijaga).
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

// ---- Dua tabel: Tagihan (kiri) -> Aturan Dispensasi (kanan) ----

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

function renderDialog(editing: Dispensasi | null = null, jenis: JenisTagihan[] = JENIS) {
  return renderDenganTema(
    <DispensasiDialog
      open
      onOpenChange={() => {}}
      editing={editing}
      jenis={jenis}
      daftarTA={DAFTAR_TA}
      pilihanLembaga={PILIHAN_LEMBAGA}
      onSaved={() => {}}
    />,
  );
}

/** Jenis lintas lembaga: satu global, satu MI, satu MD — untuk menguji
 *  penyaringan daftar kiri oleh lingkup jenjang paket. */
const JENIS_LINTAS: JenisTagihan[] = [
  { id: 1, nama: 'Infaq Bulanan', tipe: 'bulanan', jenjang: null, keterangan: null, urutan: 0, is_active: true },
  { id: 2, nama: 'Uang Pangkal', tipe: 'non_bulanan', jenjang: 'MI', keterangan: null, urutan: 0, is_active: true },
  { id: 3, nama: 'SPP MD', tipe: 'bulanan', jenjang: 'MD', keterangan: null, urutan: 0, is_active: true },
];

/* Aksi `→` di tabel Tagihan adalah satu-satunya jalan menambah aturan, jadi
   tipe & nilai bawaannya dikunci di sini: Persen 0%. */
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
  it('merender seluruh isian identitas paket + aksi simpan', () => {
    resetSetelanKomponen();
    renderDialog();

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

  it('lingkup jenjang paket menyembunyikan jenis lembaga lain', () => {
    resetSetelanKomponen();
    renderDialog(paket({ jenjang: 'MI' }), JENIS_LINTAS);

    // Lingkup MI: hanya jenis global + MI yang ditawarkan (MD disembunyikan).
    expect(screen.getByText('Tagihan (2)')).toBeInTheDocument();
    expect(document.getElementById('btn_dispensasi_tambah_1')).not.toBeNull();
    expect(document.getElementById('btn_dispensasi_tambah_2')).not.toBeNull();
    expect(document.getElementById('btn_dispensasi_tambah_3')).toBeNull();
  });

  it('paket berlingkup di luar wewenang tak menyamar jadi semua lembaga', () => {
    resetSetelanKomponen();
    renderDialog(paket({ jenjang: 'MTS' }));

    // PILIHAN_LEMBAGA hanya MI & MD — nilai lama tetap tampil apa adanya,
    // bukan jatuh ke "Semua lembaga".
    expect(document.getElementById('sel_dispensasi_jenjang')).toHaveValue('MTS — di luar lingkup Anda');
  });

  it('paket tanpa lingkup jenjang menawarkan seluruh jenis', () => {
    resetSetelanKomponen();
    renderDialog(paket({ jenjang: null }), JENIS_LINTAS);

    expect(screen.getByText('Tagihan (3)')).toBeInTheDocument();
    expect(document.getElementById('btn_dispensasi_tambah_3')).not.toBeNull();
  });

  it('tabel Tagihan hanya memuat jenis yang BELUM punya aturan', () => {
    resetSetelanKomponen();
    renderDialog(paket({ aturan: [{ id: 1, dispensasi_id: 2, jenis_id: 1, tipe: 'persen', nilai: 50 }] }));

    expect(screen.getByText('Aturan Dispensasi (1)')).toBeInTheDocument();
    expect(screen.getByText('Tagihan (1)')).toBeInTheDocument();
    // Jenis 1 sudah diatur → tak muncul lagi di kiri, tombol →-nya pun tak ada.
    expect(document.getElementById('btn_dispensasi_tambah_2')).not.toBeNull();
    expect(document.getElementById('btn_dispensasi_tambah_1')).toBeNull();
    expect(document.getElementById('btn_dispensasi_hapus_aturan_1')).not.toBeNull();
  });

  it('menekan → memindahkan tagihan ke tabel aturan', async () => {
    resetSetelanKomponen();
    renderDialog();
    expect(screen.getByText('Tagihan (2)')).toBeInTheDocument();
    expect(screen.getByText('Aturan Dispensasi (0)')).toBeInTheDocument();

    await userEvent.click(document.getElementById('btn_dispensasi_tambah_2') as HTMLElement);

    expect(screen.getByText('Aturan Dispensasi (1)')).toBeInTheDocument();
    expect(screen.getByText('Tagihan (1)')).toBeInTheDocument();
    expect(document.getElementById('btn_dispensasi_tambah_2')).toBeNull();
    expect(document.getElementById('btn_dispensasi_hapus_aturan_2')).not.toBeNull();
  });
});
