import { act, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderDenganTema } from '@/test/utils';
import type { DataPapan, StatusPapan } from '@/api/papan';
import type { AksiButir } from '@/components/papan/PapanKolom';
import type { KartuPapan } from '@/lib/papan';
import PapanPage from './PapanPage';

const mock = vi.hoisted(() => ({
  muatPapan: vi.fn(),
  muatRiwayatPapan: vi.fn(async () => ({ riwayat: [] })),
  pindahStatusPapan: vi.fn(async () => ({})),
  ubahButirPapan: vi.fn(async () => ({})),
  hapusModulPapan: vi.fn(async () => ({})),
  prefGet: vi.fn(async (_key: string): Promise<string | null> => null),
  prefSet: vi.fn(async (_key: string, _value: string) => {}),
  bolehUbah: true,
}));
vi.mock('@/api/papan', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/api/papan')>(),
  ...mock,
}));
vi.mock('@/api/auth', () => ({ bisa: () => mock.bolehUbah }));
vi.mock('@/api/client', async (importOriginal) => ({ ...await importOriginal<typeof import('@/api/client')>(), prefGet: mock.prefGet, prefSet: mock.prefSet }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, roles: [], lembagas: [] } }) }));
vi.mock('@/hooks/useCariGlobal', () => ({ useCariGlobal: () => ({ ubah: vi.fn() }) }));
vi.mock('@/components/TopBarSearch', () => ({ TopBarSearch: ({ value, onChange, popup }: { value: string; onChange: (value: string) => void; popup?: ReactNode }) => (
  <div><input aria-label="Cari Board" value={value} onChange={(e) => onChange(e.target.value)} />{popup}</div>
) }));
vi.mock('@/components/papan/PapanKolom', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/components/papan/PapanKolom')>(),
  // Hanya wiring halaman; perilaku checklist dan dialog diuji pada komponen pemiliknya.
  PapanKolom: ({ kartu, onPindah, aksiButir, kolomTerlihat }: {
    kartu: KartuPapan[];
    onPindah: (id: number, status: string) => Promise<void>;
    aksiButir: (poin: KartuPapan) => AksiButir;
    kolomTerlihat: StatusPapan[];
  }) => (
    <div>
      <output aria-label="Status poin uji">{kartu[0]?.status}</output>
      <output aria-label="Status submodul uji">{kartu[0]?.statusSub}</output>
      <output aria-label="Kolom terlihat uji">{kolomTerlihat.join(',')}</output>
      <button type="button" onClick={() => void onPindah(kartu[0].id, 'pending')}>Pindah ke Pending</button>
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
  const ringkas = { pending: 0, backlog: 0, todo: 0, in_progress: 0, for_review: 0, done: 1 };
  return {
    workflow_master_aktif: true,
    status: ['pending', 'backlog', 'todo', 'in_progress', 'for_review', 'done'],
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
  mock.prefGet.mockReset().mockResolvedValue(null);
  mock.prefSet.mockClear();
  mock.bolehUbah = true;
});

describe('PapanPage - pengaturan kolom', () => {
  it('enam checkbox tercentang secara default dan keyboard menyimpan perubahan tanpa write data Board', async () => {
    const user = userEvent.setup();
    await pasang();
    await user.click(screen.getByRole('button', { name: 'Atur kolom Board' }));
    const cek = screen.getAllByRole('checkbox');
    expect(cek).toHaveLength(6);
    cek.forEach((el) => expect(el).toBeChecked());
    screen.getByRole('checkbox', { name: 'Pending' }).focus();
    await user.keyboard(' ');
    expect(screen.getByRole('checkbox', { name: 'Pending' })).not.toBeChecked();
    expect(mock.prefSet).toHaveBeenCalledWith('simpes_kolom_papan', JSON.stringify(['backlog', 'todo', 'in_progress', 'for_review', 'done']));
    expect(screen.getByLabelText('Kolom terlihat uji')).not.toHaveTextContent('pending');
    expect(mock.pindahStatusPapan).not.toHaveBeenCalled();
    expect(mock.ubahButirPapan).not.toHaveBeenCalled();
  });

  it('memuat pilihan tersimpan termasuk semua tersembunyi dan kontrol tetap dapat dipakai oleh pembaca', async () => {
    mock.prefGet.mockImplementation(async (key) => key === 'simpes_kolom_papan' ? '[]' : null);
    mock.bolehUbah = false;
    const user = userEvent.setup();
    await pasang();
    expect(screen.getByLabelText('Kolom terlihat uji')).toBeEmptyDOMElement();
    await user.click(screen.getByRole('button', { name: 'Atur kolom Board' }));
    const cek = screen.getAllByRole('checkbox');
    cek.forEach((el) => expect(el).not.toBeChecked());
    await user.click(screen.getByRole('checkbox', { name: 'Pending' }));
    expect(screen.getByLabelText('Kolom terlihat uji')).toHaveTextContent('pending');
    expect(mock.prefSet).toHaveBeenCalledWith('simpes_kolom_papan', '["pending"]');
  });

  it('hasil pencarian mencakup poin tersembunyi dan membuka kembali kolomnya', async () => {
    mock.prefGet.mockImplementation(async (key) => key === 'simpes_kolom_papan' ? '["todo"]' : null);
    const user = userEvent.setup();
    await pasang();
    expect(screen.getByLabelText('Kolom terlihat uji')).toHaveTextContent('todo');
    await user.type(screen.getByRole('textbox', { name: 'Cari Board' }), 'Ekspor rekap');
    const hasil = screen.getByRole('region', { name: 'Hasil pencarian Board' });
    await user.click(within(hasil).getByRole('button', { name: /Ekspor rekap/ }));
    expect(screen.getByLabelText('Kolom terlihat uji')).toHaveTextContent('todo,done');
    expect(mock.prefSet).toHaveBeenCalledWith('simpes_kolom_papan', '["todo","done"]');
  });

  it('pilihan pengguna tidak ditimpa oleh pembacaan preferensi yang terlambat', async () => {
    let selesaikan!: (nilai: string | null) => void;
    mock.prefGet.mockImplementation((key) => key === 'simpes_kolom_papan' ? new Promise((resolve) => { selesaikan = resolve; }) : Promise.resolve(null));
    const user = userEvent.setup();
    await pasang();
    await user.click(screen.getByRole('button', { name: 'Atur kolom Board' }));
    await user.click(screen.getByRole('checkbox', { name: 'Pending' }));
    await act(async () => selesaikan('[]'));
    expect(screen.getByLabelText('Kolom terlihat uji')).toHaveTextContent('backlog,todo,in_progress,for_review,done');
  });

  it('Pending tidak dianggap Done pada status submodul optimistis', async () => {
    const user = userEvent.setup();
    await pasang();
    await user.click(screen.getByRole('button', { name: 'Pindah ke Pending' }));
    expect(mock.pindahStatusPapan).toHaveBeenCalledWith('DA11.4', 128, 'pending', undefined, undefined);
    expect(screen.getByLabelText('Status submodul uji')).toHaveTextContent('pending');
  });
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
