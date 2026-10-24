import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderDenganTema } from '@/test/utils';
import type { DataPapan } from '@/api/papan';
import type { AksiButir } from '@/components/papan/PapanKolom';
import type { KartuPapan } from '@/lib/papan';
import PapanPage from './PapanPage';

const mock = vi.hoisted(() => ({
  muatPapan: vi.fn(),
  muatRiwayatPapan: vi.fn(async () => ({ riwayat: [] })),
  pindahStatusPapan: vi.fn(async () => ({})),
  ubahButirPapan: vi.fn(async () => ({})),
  hapusModulPapan: vi.fn(async () => ({})),
  bolehUbah: true,
}));
vi.mock('@/api/papan', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/api/papan')>(),
  ...mock,
}));
vi.mock('@/api/auth', () => ({ bisa: () => mock.bolehUbah }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, roles: [], lembagas: [] } }) }));
vi.mock('@/hooks/useCariGlobal', () => ({ useCariGlobal: () => ({ ubah: vi.fn() }) }));
vi.mock('@/components/TopBarSearch', () => ({ TopBarSearch: () => null }));
vi.mock('@/components/papan/PapanKolom', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/components/papan/PapanKolom')>(),
  // Hanya wiring halaman; perilaku checklist dan dialog diuji pada komponen pemiliknya.
  PapanKolom: ({ kartu, onPindah, aksiButir }: {
    kartu: KartuPapan[];
    onPindah: (id: number, status: string) => Promise<void>;
    aksiButir: (poin: KartuPapan) => AksiButir;
  }) => (
    <div>
      <output aria-label="Status poin uji">{kartu[0]?.status}</output>
      <button type="button" onClick={() => void onPindah(kartu[0].id, 'in_progress')}>Pindah ke In Progress</button>
      <button type="button" onClick={() => void aksiButir(kartu[0]).onSimpanSubpoin([{ teks: 'Saldo cocok.', selesai: false }], true)}>
        Kirim checklist terkonfirmasi
      </button>
      <button type="button" onClick={() => void aksiButir(kartu[0]).onSimpanTeks(kartu[0].deskripsi, 'in_progress', undefined, true)}>
        Kirim editor terkonfirmasi
      </button>
    </div>
  ),
}));

function data(): DataPapan {
  const ringkas = { backlog: 0, todo: 0, in_progress: 0, for_review: 0, done: 1 };
  return {
    workflow_master_aktif: true,
    status: ['backlog', 'todo', 'in_progress', 'for_review', 'done'],
    ringkasan: { butir: ringkas, sub: ringkas },
    aplikasi: [{
      kode: 'desktop-admin', nama: 'Desktop Admin', workflow_aktif: true, workflow_efektif: true,
      modul: [{
        kode: 'DA11', nama: 'Pengaturan', aplikasi: 'desktop-admin',
        sub: [{
          kode: 'DA11.4', nama: 'Halaman Board', status: 'done',
          butir: [{ id: 128, deskripsi: 'Ekspor rekap.', status: 'done', subpoin: [{ teks: 'Saldo cocok.', selesai: true }] }],
        }],
      }],
    }],
  };
}

async function pasang() {
  renderDenganTema(
    <MemoryRouter initialEntries={['/board/desktop-admin/DA11']}>
      <Routes><Route path="/board/:kodeAplikasi/:kodeModul?" element={<PapanPage />} /></Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('button', { name: 'Pindah ke In Progress' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mock.muatPapan.mockResolvedValue(data());
  mock.pindahStatusPapan.mockResolvedValue({});
  mock.hapusModulPapan.mockResolvedValue({});
  mock.bolehUbah = true;
});

describe('PapanPage - hapus modul', () => {
  it('Batal tidak mengirim delete atau menghilangkan modul', async () => {
    const user = userEvent.setup();await pasang();
    await user.click(screen.getByRole('button', { name: 'Hapus modul' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('1 sub-modul, 1 poin, 1 subpoin');
    expect(mock.hapusModulPapan).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Batal' }));
    expect(mock.hapusModulPapan).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Hapus modul' })).toBeInTheDocument();
  });

  it('kegagalan mempertahankan modul dan menampilkan error pada dialog', async () => {
    mock.hapusModulPapan.mockRejectedValueOnce(new Error('Database sibuk.'));
    const user = userEvent.setup();await pasang();
    await user.click(screen.getByRole('button', { name: 'Hapus modul' }));
    await user.click(screen.getByRole('button', { name: 'Ya, hapus' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Database sibuk.');
    expect(mock.hapusModulPapan).toHaveBeenCalledWith('DA11');
    expect(mock.muatPapan).toHaveBeenCalledTimes(1);
  });

  it('modul terakhir yang dihapus menampilkan empty state sekalipun reload gagal', async () => {
    const user = userEvent.setup();await pasang();
    mock.muatPapan.mockRejectedValueOnce(new Error('Muat ulang gagal.'));
    await user.click(screen.getByRole('button', { name: 'Hapus modul' }));
    await user.click(screen.getByRole('button', { name: 'Ya, hapus' }));
    expect(await screen.findByText('Belum ada modul di aplikasi ini')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('beralih ke modul lain setelah target dihapus', async () => {
    const awal = data();const lain = { ...awal.aplikasi[0].modul[0], kode: 'DA12', nama: 'Modul lain' };
    awal.aplikasi[0].modul.push(lain);mock.muatPapan.mockResolvedValueOnce(awal);
    const sesudah = data();sesudah.aplikasi[0].modul = [lain];
    mock.muatPapan.mockResolvedValue(sesudah);
    const user = userEvent.setup();await pasang();
    await user.click(screen.getByRole('button', { name: 'Hapus modul' }));
    await user.click(screen.getByRole('button', { name: 'Ya, hapus' }));
    await waitFor(() => expect(screen.getByLabelText('Ringkasan modul DA12 Modul lain')).toBeInTheDocument());
    expect(mock.hapusModulPapan).toHaveBeenCalledWith('DA11');
  });

  it('pengguna pembaca tidak mendapat tombol hapus modul', async () => {
    mock.bolehUbah = false;await pasang();
    expect(screen.queryByRole('button', { name: 'Hapus modul' })).not.toBeInTheDocument();
  });
});

describe('PapanPage - wiring Reopen', () => {
  it('membatalkan perpindahan Done tidak mengirim write atau mengubah status', async () => {
    const user = userEvent.setup();
    await pasang();
    await user.click(screen.getByRole('button', { name: 'Pindah ke In Progress' }));
    expect(mock.pindahStatusPapan).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Batal' }));
    expect(screen.getByLabelText('Status poin uji')).toHaveTextContent('done');
    expect(mock.pindahStatusPapan).not.toHaveBeenCalled();
  });

  it('perpindahan Done yang disetujui mengirim flag persetujuan', async () => {
    const user = userEvent.setup();
    await pasang();
    await user.click(screen.getByRole('button', { name: 'Pindah ke In Progress' }));
    await user.click(screen.getByRole('button', { name: 'Ya, buka kembali' }));
    expect(mock.pindahStatusPapan).toHaveBeenCalledWith('DA11.4', 128, 'in_progress', undefined, true);
    expect(screen.getByLabelText('Status poin uji')).toHaveTextContent('in_progress');
  });

  it('backend menolak Reopen tanpa meninggalkan perubahan status di layar', async () => {
    const user = userEvent.setup();
    mock.pindahStatusPapan.mockRejectedValueOnce(new Error('Ada poin lain In Progress.'));
    await pasang();
    await user.click(screen.getByRole('button', { name: 'Pindah ke In Progress' }));
    await user.click(screen.getByRole('button', { name: 'Ya, buka kembali' }));
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('Ada poin lain In Progress.');
    await user.click(screen.getByRole('button', { name: 'Batal' }));
    expect(screen.getByLabelText('Status poin uji')).toHaveTextContent('done');
    expect(mock.muatPapan).toHaveBeenCalledTimes(1);
  });

  it('meneruskan persetujuan dari aksi checklist ke API', async () => {
    const user = userEvent.setup();
    await pasang();
    await user.click(screen.getByRole('button', { name: 'Kirim checklist terkonfirmasi' }));
    expect(mock.ubahButirPapan).toHaveBeenCalledWith('DA11.4', 128, {
      subpoin: [{ teks: 'Saldo cocok.', selesai: false }], konfirmasi_reopen: true,
    });
  });

  it('meneruskan persetujuan dari aksi editor ke API', async () => {
    const user = userEvent.setup();
    await pasang();
    await user.click(screen.getByRole('button', { name: 'Kirim editor terkonfirmasi' }));
    expect(mock.ubahButirPapan).toHaveBeenCalledWith('DA11.4', 128, {
      deskripsi: 'Ekspor rekap.', status: 'in_progress', konfirmasi_reopen: true,
    });
  });
});
