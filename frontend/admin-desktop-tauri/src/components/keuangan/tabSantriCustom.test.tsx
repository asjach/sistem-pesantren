import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

import SantriCustomTab from './tabSantriCustom';
import type { GrupSantriCustom } from '@/api/grupCustom';
import { TopBarSearchProvider, useTopBarSearchCtx } from '@/components/TopBarSearch';
import { CariGlobalProvider } from '@/hooks/useCariGlobal';
import { renderDenganTema } from '@/test/utils';

const tinggi = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
const canvas = HTMLCanvasElement.prototype.getContext;
beforeAll(() => {
  // Hanya membuka jalur render V2 di jsdom, bukan memverifikasi layout.
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true, get() { return this.dataset?.slot === 'excel-table-grid' ? 320 : (tinggi?.get?.call(this) ?? 0); },
  });
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof canvas;
});
afterAll(() => {
  if (tinggi) Object.defineProperty(HTMLElement.prototype, 'clientHeight', tinggi);
  HTMLCanvasElement.prototype.getContext = canvas;
});

vi.mock('sonner', async (asli) => ({
  ...(await asli<typeof import('sonner')>()),
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
vi.mock('@/api/preset', () => ({
  listPresetTabel: vi.fn(async () => ({ pesan: 'ok', data: {
    presets: [], aktif_preset_id: null, default_preset_id: null, aktif_kolom: null,
  } })),
  createPresetTabel: vi.fn(), updatePresetTabel: vi.fn(), deletePresetTabel: vi.fn(),
  setPresetAktif: vi.fn(), setPresetBawaan: vi.fn(),
}));

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
  api.tambah.mockReset().mockResolvedValue(GRUP);
  api.keluarkan.mockReset().mockResolvedValue(GRUP);
  api.daftar.mockResolvedValue([GRUP]);
  api.santri.mockResolvedValue({ data: [CALON], current_page: 1, last_page: 1, per_page: 10, total: 1 });
  api.kelas.mockResolvedValue({ data: [{ id: 3, nama_kelas: '3A', tingkat: '3' }], current_page: 1, last_page: 1, per_page: 100, total: 1 });
  api.ref.mockResolvedValue([{ id: 1, nama: '3', is_active: true, urutan: 3 }]);
});

function SlotCari() {
  const ctx = useTopBarSearchCtx();
  return <div ref={(el) => ctx?.setEl(el)} />;
}

function renderTab() {
  renderDenganTema(
    <CariGlobalProvider>
      <TopBarSearchProvider>
        <SlotCari />
        <div style={{ height: 900 }} className="flex flex-col">
          <SantriCustomTab canEdit canTambah {...PROPS} />
        </div>
      </TopBarSearchProvider>
    </CariGlobalProvider>,
  );
}

describe('SantriCustomTab', () => {
  function panelKandidat() {
    // Header mengidentifikasi panel kandidat; kedua panel belum memiliki accessible name pada container.
    return within(document.getElementById('judul_sc_santri')!.closest('[data-slot="excel-table"]') as HTMLElement);
  }

  it('aksi kandidat mempertahankan data saat gagal dan reload anggota setelah sukses lewat klik kanan', async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(await screen.findByText('Ekskul MTK'));
    await panelKandidat().findByText('Budi');
    api.tambah.mockRejectedValueOnce(new Error('Gagal menambah anggota.'));
    await user.click(panelKandidat().getByRole('button', { name: 'Masukkan Budi ke Ekskul MTK' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Gagal menambah anggota.'));
    expect(panelKandidat().getByText('Budi')).toBeInTheDocument();

    api.daftar.mockResolvedValue([{ ...GRUP, santri: [...GRUP.santri, {
      id: 11, nama_lengkap: 'Budi', jk: 'L', nis: '88001', kelas: '3A', jenjang: 'MI',
    }] }]);
    fireEvent.contextMenu(panelKandidat().getByText('Budi'));
    const menu = await screen.findByRole('menu');
    await user.click(within(menu).getByRole('menuitem', { name: 'Masukkan Budi ke Ekskul MTK' }));
    await waitFor(() => expect(api.tambah).toHaveBeenLastCalledWith(1, [11]));
    await waitFor(() => expect(panelKandidat().queryByText('Budi')).not.toBeInTheDocument());
    expect(await screen.findByText('Anggota Ekskul MTK (2)')).toBeInTheDocument();
    expect(api.hapus).not.toHaveBeenCalled();
  });

  it('checkbox massal mengirim ID kandidat dan menahan aksi selama request berjalan', async () => {
    const user = userEvent.setup();
    api.santri.mockResolvedValue({ data: [CALON, { ...CALON, id: 12, nama_lengkap: 'Cici' }], current_page: 1, last_page: 1, total: 2 });
    let selesai!: (value: GrupSantriCustom) => void;
    api.tambah.mockImplementation(() => new Promise<GrupSantriCustom>((resolve) => { selesai = resolve; }));
    renderTab();
    await user.click(await screen.findByText('Ekskul MTK'));
    await panelKandidat().findByText('Cici');
    await user.click(panelKandidat().getByRole('checkbox', { name: 'Pilih semua baris' }));
    await user.click(panelKandidat().getByRole('button', { name: 'Masukkan (2)' }));
    expect(api.tambah).toHaveBeenCalledWith(1, [11, 12]);
    await user.click(panelKandidat().getByRole('checkbox', { name: 'Pilih baris 11' }));
    expect(panelKandidat().getByRole('button', { name: 'Masukkan (1)' })).toBeDisabled();
    await act(async () => { selesai(GRUP); });
    await waitFor(() => expect(panelKandidat().getByRole('button', { name: 'Masukkan (1)' })).toBeEnabled());
  });

  it('pergantian grup menyelaraskan kandidat dan tujuan aksi tanpa mengubah panel anggota', async () => {
    const user = userEvent.setup();
    api.daftar.mockResolvedValue([GRUP, { ...GRUP, id: 2, nama: 'Grup Kedua', santri: [] }]);
    api.santri.mockResolvedValue({ data: [{ ...CALON, id: 10, nama_lengkap: 'Ahmad' }, CALON], current_page: 1, last_page: 1, total: 2 });
    renderTab();
    await user.click(await screen.findByText('Ekskul MTK'));
    await panelKandidat().findByText('Budi');
    expect(panelKandidat().queryByText('Ahmad')).not.toBeInTheDocument();
    await user.click(screen.getByText('Grup Kedua'));
    expect(await panelKandidat().findByText('Ahmad')).toBeInTheDocument();
    await user.click(panelKandidat().getByRole('button', { name: 'Masukkan Budi ke Grup Kedua' }));
    await waitFor(() => expect(api.tambah).toHaveBeenCalledWith(2, [11]));
    expect(panelKandidat().queryByRole('button', { name: /Tambah baris/ })).not.toBeInTheDocument();
  });

  it('pagination dan per-page kandidat tetap diteruskan bersama lingkup filter', async () => {
    const user = userEvent.setup();
    api.santri.mockResolvedValue({ data: [CALON], current_page: 1, last_page: 2, total: 51 });
    renderTab();
    await waitFor(() => expect(api.santri).toHaveBeenCalled());
    await user.click(panelKandidat().getByRole('button', { name: 'Halaman berikutnya' }));
    await waitFor(() => expect(api.santri).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, jenjang: ['MI'], tahun_ajaran: ['2025/2026'], semester: ['1'] })));
    await user.click(panelKandidat().getByRole('radio', { name: '10 data per halaman' }));
    await waitFor(() => expect(api.santri).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, per_page: 10 })));
  });

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

    expect(document.getElementById('inp_grup_custom_cari')).toBeNull();
    expect(document.getElementById('input_cari_topbar')).not.toBeNull();
  });

  it('pivot kanan: anggota tampil + tambah/keluarkan', async () => {
    const sesudahTambah: GrupSantriCustom = {
      ...GRUP, santri: [...GRUP.santri, { id: 11, nama_lengkap: 'Budi', jk: 'L', nis: '88001', kelas: '3A', jenjang: 'MI' }],
    };
    api.tambah.mockImplementation(async () => sesudahTambah);
    api.keluarkan.mockImplementation(async () => GRUP);

    renderTab();
    await waitFor(() => expect(document.getElementById('row_grup_custom_1')).not.toBeNull());

    fireEvent.click(document.getElementById('row_grup_custom_1') as HTMLElement);
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

  it('klik baris memilih grup (pivot kanan terbuka)', async () => {
    renderTab();
    await waitFor(() => expect(document.getElementById('row_grup_custom_1')).not.toBeNull());
    fireEvent.click(document.getElementById('row_grup_custom_1') as HTMLElement);
    expect(await screen.findByText('Anggota Ekskul MTK (1)')).not.toBeNull();
  });

  it('ubah grup sebaris: pensil → input → simpan', async () => {
    api.ubah.mockResolvedValue({ ...GRUP, nama: 'Ekskul MTK Baru' });
    renderTab();
    await waitFor(() => expect(document.getElementById('row_grup_custom_1')).not.toBeNull());
    fireEvent.click(document.getElementById('btn_grup_custom_ubah_1') as HTMLElement);
    const nama = document.getElementById('inp_grup_custom_ubah_nama') as HTMLInputElement;
    expect(nama.value).toBe('Ekskul MTK');
    fireEvent.change(nama, { target: { value: 'Ekskul MTK Baru' } });
    fireEvent.click(document.getElementById('btn_grup_custom_ubah_simpan') as HTMLElement);
    await waitFor(() => expect(api.ubah).toHaveBeenCalledWith(1, expect.objectContaining({ nama: 'Ekskul MTK Baru' })));
  });

  it('sakelar status mengubah is_active', async () => {
    api.ubah.mockResolvedValue({ ...GRUP, is_active: false });
    renderTab();
    await waitFor(() => expect(document.getElementById('row_grup_custom_1')).not.toBeNull());
    const sw = document.getElementById('sw_grup_custom_status_1') as HTMLElement;
    expect(sw.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(sw);
    await waitFor(() => expect(api.ubah).toHaveBeenCalledWith(1, expect.objectContaining({ is_active: false })));
  });

  it('cari topBar menyaring grup + daftar santri', async () => {
    renderTab();
    const kotak = await waitFor(() => document.getElementById('input_cari_topbar') as HTMLInputElement);
    await waitFor(() => expect(document.getElementById('row_grup_custom_1')).not.toBeNull());

    fireEvent.change(kotak, { target: { value: 'olim' } });

    await waitFor(() => expect(document.getElementById('row_grup_custom_1')).not.toBeNull());
    await waitFor(() => {
      const terakhir = api.santri.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(terakhir).toMatchObject({ q: 'olim' });
    });

    fireEvent.change(kotak, { target: { value: 'olimzzz' } });
    await waitFor(() => expect(document.getElementById('row_grup_custom_1')).toBeNull());
    expect(document.body.textContent).toContain('0 dari 1');
  });

  it('buat grup via popover (bukan dialog): nama + lingkup topBar', async () => {
    api.buat.mockResolvedValue({ ...GRUP, id: 2, nama: 'Ekskul MTK', santri: [] });

    renderTab();
    await waitFor(() => expect(document.getElementById('judul_grup_custom')).not.toBeNull());

    fireEvent.click(document.getElementById('btn_grup_custom_tambah') as HTMLElement);
    expect(await screen.findByText('Lingkup: MI · 2025/2026')).not.toBeNull();
    const nama = document.getElementById('inp_grup_custom_nama') as HTMLInputElement;
    expect(nama.value).toBe('');

    fireEvent.click(document.getElementById('btn_grup_custom_simpan') as HTMLElement);
    expect(await screen.findByText('Nama grup wajib diisi.')).not.toBeNull();
    expect(api.buat).not.toHaveBeenCalled();

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
      <CariGlobalProvider>
        <TopBarSearchProvider>
          <div style={{ height: 900 }} className="flex flex-col">
            <SantriCustomTab canEdit={false} canTambah={false} {...PROPS} />
          </div>
        </TopBarSearchProvider>
      </CariGlobalProvider>,
    );
    await waitFor(() => expect(document.getElementById('judul_grup_custom')).not.toBeNull());
    expect(document.getElementById('btn_grup_custom_tambah')).toBeNull();
  });
});
