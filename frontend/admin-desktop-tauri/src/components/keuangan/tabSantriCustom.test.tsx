import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SantriCustomTab from './tabSantriCustom';
import type { GrupSantriCustom } from '@/api/grupCustom';
import { renderDenganTema } from '@/test/utils';

/* API dimock: grup + pencarian santri tanpa jaringan. */
const api = vi.hoisted(() => ({
  daftar: vi.fn(),
  buat: vi.fn(),
  ubah: vi.fn(),
  hapus: vi.fn(),
  tambah: vi.fn(),
  keluarkan: vi.fn(),
  santri: vi.fn(),
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

vi.mock('react-datasheet-grid', async (importOriginal) => {
  const asli = await importOriginal<typeof import('react-datasheet-grid')>();
  const stub = await import('@/components/excel/_dsgStubDom');
  return { ...asli, DynamicDataSheetGrid: stub.DynamicDataSheetGridStub };
});

const GRUP: GrupSantriCustom = {
  id: 1, nama: 'Ekskul MTK', keterangan: 'Olimpiade',
  created_at: '2026-10-13', updated_at: '2026-10-13',
  santri: [{ id: 10, nama_lengkap: 'Ahmad' }],
};

const CALON = {
  id: 11, nama_lengkap: 'Budi', nisn: '123', ayah_nama: 'Ayah Budi',
};

beforeEach(() => {
  vi.clearAllMocks();
  api.daftar.mockResolvedValue([GRUP]);
  api.santri.mockResolvedValue({ data: [CALON], current_page: 1, last_page: 1, per_page: 10, total: 1 });
});

/* ExcelTable memvirtualkan baris berdasar tinggi wadah — di tes telanjang
   (tanpa Dialog setinggi viewport) wadah harus diberi tinggi eksplisit. */
function renderTab() {
  renderDenganTema(
    <div style={{ height: 800 }} className="flex flex-col">
      <SantriCustomTab canEdit canTambah />
    </div>,
  );
}

describe('SantriCustomTab', () => {
  it('memuat daftar grup + jumlah anggota', async () => {
    renderTab();
    await waitFor(() => expect(document.getElementById('judul_grup_custom')).not.toBeNull());
    expect(document.getElementById('judul_grup_custom')?.textContent).toContain('(1)');
    expect(document.body.textContent).toContain('Ekskul MTK');
  });

  it('kelola anggota: tambah dari kandidat + keluarkan', async () => {
    const sesudahTambah: GrupSantriCustom = {
      ...GRUP, santri: [...GRUP.santri, { id: 11, nama_lengkap: 'Budi' }],
    };
    const sesudahKurang: GrupSantriCustom = { ...GRUP, santri: [] };
    api.tambah.mockResolvedValue(sesudahTambah);
    api.keluarkan.mockResolvedValue(sesudahKurang);

    renderTab();
    await waitFor(() => expect(document.getElementById('btn_grup_custom_anggota_1')).not.toBeNull());

    // Buka panel anggota: kandidat termuat, anggota lama tampil.
    fireEvent.click(document.getElementById('btn_grup_custom_anggota_1') as HTMLElement);
    await waitFor(() => expect(document.getElementById('inp_grup_custom_cari')).not.toBeNull());
    expect(await screen.findByText('Budi')).not.toBeNull();

    // Tambah Budi → API dipanggil + jumlah bertambah.
    fireEvent.click(document.getElementById('btn_grup_custom_tambah_11') as HTMLElement);
    await waitFor(() => expect(api.tambah).toHaveBeenCalledWith(1, [11]));
    await waitFor(() => expect(document.body.textContent).toContain('Anggota Ekskul MTK (2)'));

    // Keluarkan Ahmad → API dipanggil + jumlah berkurang.
    fireEvent.click(document.getElementById('btn_grup_custom_keluarkan_10') as HTMLElement);
    await waitFor(() => expect(api.keluarkan).toHaveBeenCalledWith(1, 10));
    await waitFor(() => expect(document.body.textContent).toContain('Anggota Ekskul MTK (0)'));
  });

  it('tanpa izin tambah: baris input grup tidak tersedia', async () => {
    renderDenganTema(
      <div style={{ height: 800 }} className="flex flex-col">
        <SantriCustomTab canEdit={false} canTambah={false} />
      </div>,
    );
    await waitFor(() => expect(document.getElementById('judul_grup_custom')).not.toBeNull());
    // Tombol tambah-baris bawaan ExcelTable hanya ada bila onCreateRow diset.
    expect(document.querySelector('[id^="btn_tambah_baris_keuangan_grup_custom"]')).toBeNull();
  });
});
