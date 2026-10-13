import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SantriCustomTab from './tabSantriCustom';
import type { GrupSantriCustom } from '@/api/grupCustom';
import { renderDenganTema } from '@/test/utils';

/* API dimock: grup + santri + master tanpa jaringan. */
const api = vi.hoisted(() => ({
  daftar: vi.fn(),
  buat: vi.fn(),
  ubah: vi.fn(),
  hapus: vi.fn(),
  tambah: vi.fn(),
  keluarkan: vi.fn(),
  santri: vi.fn(),
  lembaga: vi.fn(),
  ta: vi.fn(),
  kelas: vi.fn(),
}));

vi.mock('@/api/grupCustom', () => ({
  daftarGrupCustom: (...a: unknown[]) => api.daftar(...a),
  buatGrupCustom: (...a: unknown[]) => api.buat(...a),
  ubahGrupCustom: (...a: unknown[]) => api.ubah(...a),
  hapusGrupCustom: (...a: unknown[]) => api.hapus(...a),
  tambahAnggotaGrup: (...a: unknown[]) => api.tambah(...a),
  hapusAnggotaGrup: (...a: unknown[]) => api.keluarkan(...a),
}));

vi.mock('@/api/santri', () => ({
  listSantri: (...a: unknown[]) => api.santri(...a),
}));

vi.mock('@/api/master', () => ({
  listLembaga: (...a: unknown[]) => api.lembaga(...a),
  listTahunAjaran: (...a: unknown[]) => api.ta(...a),
  listKelas: (...a: unknown[]) => api.kelas(...a),
}));

vi.mock('react-datasheet-grid', async (importOriginal) => {
  const asli = await importOriginal<typeof import('react-datasheet-grid')>();
  const stub = await import('@/components/excel/_dsgStubDom');
  return { ...asli, DynamicDataSheetGrid: stub.DynamicDataSheetGridStub };
});

const GRUP: GrupSantriCustom = {
  id: 1, nama: 'Ekskul MTK', keterangan: 'Olimpiade',
  jenjang: 'MI', tahun_ajaran: '2025/2026', is_active: true,
  created_at: '2026-10-13', updated_at: '2026-10-13',
  santri: [{ id: 10, nama_lengkap: 'Ahmad', jk: 'L', nis: '77001', kelas: '3A', jenjang: 'MI' }],
};

const CALON = {
  id: 11, nama_lengkap: 'Budi', nisn: null, jk: 'L',
  lembaga_aktif: [{ jenjang: 'MI', nis_lokal: '88001' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  api.daftar.mockResolvedValue([GRUP]);
  api.santri.mockResolvedValue({ data: [CALON], current_page: 1, last_page: 1, per_page: 10, total: 1 });
  api.lembaga.mockResolvedValue({ data: [{ id: 'MI', jenjang: 'MI', nama: 'Madrasah Ibtidaiyah' }], current_page: 1, last_page: 1, per_page: 100, total: 1 });
  api.ta.mockResolvedValue({ data: [{ nama: '2025/2026' }], current_page: 1, last_page: 1, per_page: 100, total: 1 });
  api.kelas.mockResolvedValue({ data: [{ id: 3, nama_kelas: '3A', tingkat: '3' }], current_page: 1, last_page: 1, per_page: 100, total: 1 });
});

/* ExcelTable memvirtualkan baris berdasar tinggi wadah — wadah eksplisit. */
function renderTab() {
  renderDenganTema(
    <div style={{ height: 900 }} className="flex flex-col">
      <SantriCustomTab canEdit canTambah />
    </div>,
  );
}

describe('SantriCustomTab', () => {
  it('memuat grup + filter lembaga/TA memicu muat ulang berlingkup', async () => {
    renderTab();
    await waitFor(() => expect(document.getElementById('judul_grup_custom')).not.toBeNull());
    expect(api.daftar).toHaveBeenCalledWith({});
    await waitFor(() => expect(document.getElementById('btn_grup_custom_anggota_1')).not.toBeNull());

    // Filter Lembaga = MI → daftar dimuat ulang berlingkup.
    const el = document.getElementById('sel_grup_custom_lembaga') as HTMLElement;
    fireEvent.pointerDown(el);
    fireEvent.mouseDown(el);
    fireEvent.click(el);
    fireEvent.click(await screen.findByRole('option', { name: /MI —/ }));
    await waitFor(() => expect(api.daftar).toHaveBeenCalledWith({ jenjang: 'MI', tahun_ajaran: undefined }));
  });

  it('pivot kanan: anggota tampil dengan nis/kelas/jenjang + tambah/keluarkan', async () => {
    const sesudahTambah: GrupSantriCustom = {
      ...GRUP, santri: [...GRUP.santri, { id: 11, nama_lengkap: 'Budi', jk: 'L', nis: '88001', kelas: '3A', jenjang: 'MI' }],
    };
    api.tambah.mockImplementation(async () => sesudahTambah);
    api.keluarkan.mockImplementation(async () => GRUP);

    renderTab();
    await waitFor(() => expect(document.getElementById('btn_grup_custom_anggota_1')).not.toBeNull());

    // Buka pivot: kolom nis/kelas/jenjang dari pengayaan backend tampil.
    fireEvent.click(document.getElementById('btn_grup_custom_anggota_1') as HTMLElement);
    expect(await screen.findByText('77001')).not.toBeNull();
    expect(document.body.textContent).toContain('Anggota Ekskul MTK (1)');

    // Kandidat Budi (belum anggota) bisa dimasukkan.
    expect(await screen.findByText('88001')).not.toBeNull();
    fireEvent.click(document.getElementById('btn_grup_custom_tambah_11') as HTMLElement);
    await waitFor(() => expect(api.tambah).toHaveBeenCalledWith(1, [11]));

    // Keluarkan Ahmad dari pivot.
    fireEvent.click(document.getElementById('btn_grup_custom_keluarkan_10') as HTMLElement);
    await waitFor(() => expect(api.keluarkan).toHaveBeenCalledWith(1, 10));
  });

  it('tanpa grup terpilih: daftar santri tanpa tombol tambah', async () => {
    renderTab();
    await waitFor(() => expect(document.getElementById('judul_sc_santri')).not.toBeNull());
    expect(document.querySelector('[id^="btn_grup_custom_tambah_"]')).toBeNull();
    expect(document.body.textContent).toContain('Pilih grup dulu');
  });
});
