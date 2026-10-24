import { useEffect } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderDenganTema } from '@/test/utils';
import { normalizePerPage } from '@/prefs';
import type { AksiDraftTabel } from '@/components/excel/useAntreanSimpan';
import { DraftGuardProvider, useMintaJalan } from '@/draftGuard';
import PenilaianLegerPage from './PenilaianLegerPage';

const api = vi.hoisted(() => ({
  goFirst: vi.fn(),
  setPage: vi.fn(),
  setPerPage: vi.fn(),
  sync: vi.fn(),
  listKelas: vi.fn(async () => ({ data: [] })),
  daftar: vi.fn(async () => ({
    kegiatan_evaluatif: [
      { id: 1, kode: 'PTS', nama: 'Penilaian Tengah Semester', jenis_rapor: 'rapor', rentang_nilai: '0-100' },
      { id: 2, kode: 'ASAS', nama: 'Asesmen Sumatif', jenis_rapor: 'rapor', rentang_nilai: '0-100' },
    ],
  })),
  leger: vi.fn(async () => ({
    current_page: 1,
    last_page: 1,
    total: 0,
    kolom: [],
    baris: [],
  })),
  simpan: vi.fn(async () => {}),
  ubah: vi.fn(async () => {}),
  hitung: vi.fn(async () => ({ pesan: 'ok' })),
  unduh: vi.fn(async () => {}),
  flush: vi.fn(),
  buang: vi.fn(),
}));

vi.mock('@/hooks/useFilterGlobalAktif', () => ({
  useFilterGlobalAktif: () => ({
    jenjangs: ['MI'],
    tahunAjaranNames: ['2026/2027'],
    semesters: ['1'],
    tingkat: [],
    kelas: [],
    loading: false,
  }),
  targetTunggal: (values: string[]) => values.length === 1 ? values[0] : null,
}));

vi.mock('@/hooks/usePager', () => ({
  usePager: () => ({
    page: 1,
    perPage: normalizePerPage(50),
    ready: true,
    goFirst: api.goFirst,
    setPage: api.setPage,
    setPerPage: api.setPerPage,
    sync: api.sync,
  }),
}));

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ user: { roles: [{ name: 'super_admin' }], lembagas: [] } }),
}));
vi.mock('@/api/auth', () => ({ bisa: () => true }));
vi.mock('@/api/master', () => ({ listKelas: api.listKelas }));
vi.mock('@/api/penilaian', () => ({
  daftarKegiatanEvaluatif: api.daftar,
  legerNilai: api.leger,
  simpanNilaiManual: api.simpan,
  ubahKegiatanEvaluatif: api.ubah,
  hitungUlang: api.hitung,
  unduhLeger: api.unduh,
}));
vi.mock('@/components/TopBarSearch', () => ({
  TopBarSearch: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <input aria-label="Cari nama / NIS" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock('@/components/Pager', () => ({ default: () => <div data-testid="pager" /> }));
vi.mock('@/components/excelV2/ExcelTabelV2', () => {
  function MockExcelTabelV2({ onAksiDraftSiap }: { onAksiDraftSiap?: (aksi: AksiDraftTabel) => void }) {
    useEffect(() => {
      onAksiDraftSiap?.({
        adaDraft: () => true,
        flush: api.flush,
        buang: api.buang,
      });
    }, [onAksiDraftSiap]);

    return <div data-testid="tabel-leger" />;
  }

  return { default: MockExcelTabelV2 };
});

function tampilkan() {
  renderDenganTema(
    <MemoryRouter initialEntries={['/penilaian/leger']}>
      <PenilaianLegerPage />
    </MemoryRouter>,
  );
}

function KontrolFilter({ onJalan }: { onJalan: () => void }) {
  const mintaJalan = useMintaJalan();
  return <button type="button" onClick={() => mintaJalan('mengubah filter semester', onJalan)}>Ganti semester</button>;
}

async function pilihKegiatan(user: ReturnType<typeof userEvent.setup>, nilai: string) {
  await waitFor(() => expect(screen.getByRole('option', { name: /PTS/ })).toBeInTheDocument());
  await user.selectOptions(screen.getByLabelText('Kegiatan Evaluatif'), nilai);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.flush.mockResolvedValue({ sukses: true, tersimpan: 1, gagal: 0 });
  api.leger.mockResolvedValue({ current_page: 1, last_page: 1, total: 0, kolom: [], baris: [] });
});

describe('PenilaianLegerPage — penjaga draft', () => {
  it('Tetap di sini mempertahankan kegiatan dan draft', async () => {
    const user = userEvent.setup();
    tampilkan();
    await screen.findByTestId('tabel-leger');

    await pilihKegiatan(user, '2');
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Tetap di sini' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Kegiatan Evaluatif')).toHaveValue('1');
    expect(api.buang).not.toHaveBeenCalled();
  });

  it('Buang perubahan melanjutkan perpindahan kegiatan', async () => {
    const user = userEvent.setup();
    tampilkan();
    await screen.findByTestId('tabel-leger');

    await pilihKegiatan(user, '2');
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Buang perubahan' }));

    await waitFor(() => expect(screen.getByLabelText('Kegiatan Evaluatif')).toHaveValue('2'));
    expect(api.buang).toHaveBeenCalledTimes(1);
  });

  it('Simpan dan lanjut menunggu flush sebelum berpindah', async () => {
    const user = userEvent.setup();
    tampilkan();
    await screen.findByTestId('tabel-leger');

    await pilihKegiatan(user, '2');
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Simpan dan lanjut' }));

    await waitFor(() => expect(api.flush).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByLabelText('Kegiatan Evaluatif')).toHaveValue('2'));
  });

  it('gagal simpan tetap di kegiatan asal dan menampilkan galat', async () => {
    api.flush.mockResolvedValueOnce({ sukses: false, tersimpan: 0, gagal: 1, pesan: 'Jaringan putus.' });
    const user = userEvent.setup();
    tampilkan();
    await screen.findByTestId('tabel-leger');

    await pilihKegiatan(user, '2');
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Simpan dan lanjut' }));

    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('Jaringan putus.'));
    expect(screen.getByLabelText('Kegiatan Evaluatif')).toHaveValue('1');
  });

  it('perubahan filter global menunggu keputusan draft', async () => {
    const user = userEvent.setup();
    const onJalan = vi.fn();
    renderDenganTema(
      <MemoryRouter initialEntries={['/penilaian/leger']}>
        <DraftGuardProvider>
          <KontrolFilter onJalan={onJalan} />
          <PenilaianLegerPage />
        </DraftGuardProvider>
      </MemoryRouter>,
    );
    await screen.findByTestId('tabel-leger');

    await user.click(screen.getByRole('button', { name: 'Ganti semester' }));

    expect(onJalan).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Buang perubahan' }));

    await waitFor(() => expect(onJalan).toHaveBeenCalledTimes(1));
  });
});
