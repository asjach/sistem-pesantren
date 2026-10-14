import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Dispensasi, JenisTagihan } from '@/api/keuangan';
import type { TahunAjaran } from '@/api/master';
import { renderDenganTema } from '@/test/utils';
import { resetSetelanKomponen } from '@/components/komponenCustom';
import DispensasiDialog, { santriIdsUntuk } from './DispensasiDialog';

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

// ---- Tata letak ringkas: dialog tak lagi layar penuh & hemat baris ----

const JENIS: JenisTagihan[] = [
  { id: 1, nama: 'Infaq Bulanan', tipe: 'bulanan', jenjang: null, keterangan: null, urutan: 0, is_active: true },
  { id: 2, nama: 'Uang Pangkal', tipe: 'non_bulanan', jenjang: 'MI', keterangan: null, urutan: 0, is_active: true },
];

const DAFTAR_TA: TahunAjaran[] = [
  { nama: '2026/2027', tanggal_mulai: null, tanggal_selesai: null, is_aktif: true },
  { nama: '2025/2026', tanggal_mulai: null, tanggal_selesai: null, is_aktif: false },
];

function renderDialog(editing: Dispensasi | null = null) {
  return renderDenganTema(
    <DispensasiDialog
      open
      onOpenChange={() => {}}
      editing={editing}
      jenis={JENIS}
      daftarTA={DAFTAR_TA}
      onSaved={() => {}}
    />,
  );
}

describe('DispensasiDialog — tata letak ringkas', () => {
  it('merender seluruh isian identitas paket + aksi simpan', () => {
    resetSetelanKomponen();
    renderDialog();

    expect(screen.getByText('Tambah Dispensasi')).toBeInTheDocument();
    for (const id of [
      'inp_dispensasi_nama',
      'sel_dispensasi_ta',
      'inp_dispensasi_kuota',
      'inp_dispensasi_grup',
      'inp_dispensasi_keterangan',
      'chk_dispensasi_aktif',
      'btn_dispensasi_simpan',
    ]) {
      expect(document.getElementById(id), id).not.toBeNull();
    }
  });

  it('menitipkan kontrol tambah aturan di bilah judul tabel, bukan baris sendiri', () => {
    resetSetelanKomponen();
    renderDialog();

    const jenis = document.getElementById('sel_dispensasi_tambah_jenis');
    const tambah = document.getElementById('btn_dispensasi_tambah_aturan');
    expect(jenis).not.toBeNull();
    expect(tambah).not.toBeNull();
    // Keduanya sebaris dengan judul tabel ("Aturan Potongan").
    expect(jenis?.closest('[data-part="header_tabel"]')).not.toBeNull();
    expect(tambah?.closest('[data-part="header_tabel"]')).not.toBeNull();
    expect(screen.getByText('Aturan Potongan')).toBeInTheDocument();
  });
});
