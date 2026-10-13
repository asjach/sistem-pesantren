import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SantriCustomTab from './tabSantriCustom';
import type { GrupSantriCustom } from '@/api/grupCustom';
import { renderDenganTema } from '@/test/utils';

/* API dimock: grup + santri + kelas + referensi tanpa jaringan. */
const api = vi.hoisted(() => ({
  daftar: vi.fn(),
  buat: vi.fn(),
  ubah: vi.fn(),
  hapus: vi.fn(),
  tambah: vi.fn(),
  keluarkan: vi.fn(),
  santri: vi.fn(),
  kelas: vi.fn(),
  ref: vi.fn(),
  pilihTingkat: vi.fn(),
  pilihKelas: vi.fn(),
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
  listKelas: (...a: unknown[]) => api.kelas(...a),
  referensiList: (...a: unknown[]) => api.ref(...a),
}));

/* Rail global dimock: tingkat/kelas + visibilitasnya tanpa provider. */
vi.mock('@/hooks/useFilterGlobalAktif', () => ({
  useFilterGlobalAktif: () => ({
    jenjangs: ['MI'], tahunAjaranNames: ['2025/2026'], semesters: ['1'],
    tingkat: [], kelas: [], loading: false,
  }),
  targetTunggal: (v: readonly string[]) => (v.length === 1 ? v[0] : null),
}));

vi.mock('@/tingkatAktif', () => ({
  useTingkatAktif: () => ({ tingkat: [], pilih: (...a: unknown[]) => api.pilihTingkat(...a), loading: false }),
}));

vi.mock('@/kelasAktif', () => ({
  useKelasAktif: () => ({ kelas: [], pilih: (...a: unknown[]) => api.pilihKelas(...a), loading: false }),
}));

vi.mock('@/components/VisibilitasFilter', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/components/VisibilitasFilter')>();
  return {
    ...asli,
    useVisibilitasFilter: () => ({
      tampil: { lembaga: true, tahun_ajaran: true, semester: true, tingkat: true, kelas: true },
      setTampil: vi.fn(),
      mode: { lembaga: 'single', tahun_ajaran: 'single', semester: 'single', tingkat: 'single', kelas: 'single' },
      setMode: vi.fn(),
      siap: true,
      filterRelevan: ['tingkat', 'kelas'],
      registrasi: null,
      setRegistrasi: vi.fn(),
    }),
  };
});

vi.mock('react-router-dom', async (importOriginal) => {
  const asli = await importOriginal<typeof import('react-router-dom')>();
  return { ...asli, useLocation: () => ({ pathname: '/keuangan', search: '', hash: '', state: null, key: 'uji' }) };
});

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

const PROPS = {
  jenjangs: ['MI'], tahunAjaranNames: ['2025/2026'], semesters: ['1'],
  tingkat: [], kelas: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  api.daftar.mockResolvedValue([GRUP]);
  api.santri.mockResolvedValue({ data: [CALON], current_page: 1, last_page: 1, per_page: 10, total: 1 });
  api.kelas.mockResolvedValue({ data: [{ id: 3, nama_kelas: '3A', tingkat: '3' }], current_page: 1, last_page: 1, per_page: 100, total: 1 });
  api.ref.mockResolvedValue([{ id: 1, nama: '3', is_active: true, urutan: 3 }]);
});

/* ExcelTable memvirtualkan baris berdasar tinggi wadah — wadah eksplisit. */
function renderTab() {
  renderDenganTema(
    <div style={{ height: 900 }} className="flex flex-col">
      <SantriCustomTab canEdit canTambah {...PROPS} />
    </div>,
  );
}

describe('SantriCustomTab', () => {
  it('filter topBar diteruskan ke API grup + santri; rail tingkat/kelas tampil', async () => {
    renderTab();
    await waitFor(() => expect(document.getElementById('judul_grup_custom')).not.toBeNull());
    await waitFor(() => expect(api.daftar).toHaveBeenCalledWith({ jenjang: ['MI'], tahun_ajaran: ['2025/2026'] }));
    await waitFor(() => expect(api.santri).toHaveBeenCalled());
    const panggilSantri = api.santri.mock.calls[0][0] as Record<string, unknown>;
    expect(panggilSantri).toMatchObject({ jenjang: ['MI'], tahun_ajaran: ['2025/2026'], semester: ['1'] });
    // Rail global (bukan combobox lokal) untuk tingkat & kelas.
    expect(document.getElementById('filter_rail_tingkat_kelas')).not.toBeNull();
    expect(document.getElementById('sel_sc_tingkat')).toBeNull();
    expect(document.getElementById('sel_sc_kelas')).toBeNull();
    expect(document.getElementById('inp_grup_custom_cari')).not.toBeNull();
  });

  it('pivot kanan: anggota tampil + tambah/keluarkan', async () => {
    const sesudahTambah: GrupSantriCustom = {
      ...GRUP, santri: [...GRUP.santri, { id: 11, nama_lengkap: 'Budi', jk: 'L', nis: '88001', kelas: '3A', jenjang: 'MI' }],
    };
    api.tambah.mockImplementation(async () => sesudahTambah);
    api.keluarkan.mockImplementation(async () => GRUP);

    renderTab();
    await waitFor(() => expect(document.getElementById('btn_grup_custom_anggota_1')).not.toBeNull());

    fireEvent.click(document.getElementById('btn_grup_custom_anggota_1') as HTMLElement);
    expect(await screen.findByText('77001')).not.toBeNull();
    expect(document.body.textContent).toContain('Anggota Ekskul MTK (1)');

    expect(await screen.findByText('88001')).not.toBeNull();
    fireEvent.click(document.getElementById('btn_grup_custom_tambah_11') as HTMLElement);
    await waitFor(() => expect(api.tambah).toHaveBeenCalledWith(1, [11]));

    fireEvent.click(document.getElementById('btn_grup_custom_keluarkan_10') as HTMLElement);
    await waitFor(() => expect(api.keluarkan).toHaveBeenCalledWith(1, 10));
  });

  it('tanpa grup terpilih: daftar santri tanpa tombol tambah', async () => {
    renderTab();
    await waitFor(() => expect(document.getElementById('judul_sc_santri')).not.toBeNull());
    expect(document.querySelector('[id^="btn_grup_custom_tambah_"]')).toBeNull();
    expect(document.body.textContent).toContain('Pilih grup dulu');
  });

  it('buat grup via popover (bukan dialog): nama + lingkup topBar', async () => {
    api.buat.mockResolvedValue({ ...GRUP, id: 2, nama: 'Ekskul MTK', santri: [] });

    renderTab();
    await waitFor(() => expect(document.getElementById('judul_grup_custom')).not.toBeNull());

    // Buka popover: lingkup mengikuti topBar, isian kosong.
    fireEvent.click(document.getElementById('btn_grup_custom_tambah') as HTMLElement);
    expect(await screen.findByText('Lingkup: MI · 2025/2026')).not.toBeNull();
    const nama = document.getElementById('inp_grup_custom_nama') as HTMLInputElement;
    expect(nama.value).toBe('');

    // Simpan kosong → galat inline, tanpa request.
    fireEvent.click(document.getElementById('btn_grup_custom_simpan') as HTMLElement);
    expect(await screen.findByText('Nama grup wajib diisi.')).not.toBeNull();
    expect(api.buat).not.toHaveBeenCalled();

    // Isi + simpan → API dipanggil dengan lingkup topBar, daftar dimuat ulang.
    fireEvent.change(nama, { target: { value: 'Ekskul MTK' } });
    fireEvent.change(document.getElementById('inp_grup_custom_keterangan') as HTMLInputElement, { target: { value: 'Olimpiade' } });
    fireEvent.click(document.getElementById('btn_grup_custom_simpan') as HTMLElement);
    await waitFor(() => expect(api.buat).toHaveBeenCalledWith({
      nama: 'Ekskul MTK', keterangan: 'Olimpiade', jenjang: 'MI', tahun_ajaran: '2025/2026',
    }));
    await waitFor(() => expect(api.daftar).toHaveBeenCalledTimes(2));
  });

  it('tanpa izin tambah: tombol buat grup tidak tampil', async () => {
    renderDenganTema(
      <div style={{ height: 900 }} className="flex flex-col">
        <SantriCustomTab canEdit={false} canTambah={false} {...PROPS} />
      </div>,
    );
    await waitFor(() => expect(document.getElementById('judul_grup_custom')).not.toBeNull());
    expect(document.getElementById('btn_grup_custom_tambah')).toBeNull();
  });
});
