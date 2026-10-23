import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import type { RiwayatRow } from '@/api/siklus';
import type { ExcelTabelV2Props } from '@/components/excelV2/ExcelTabelV2';
import type { EditSantriDialog } from '@/components/santri/EditSantriDialog';
import type { useDaftarTabel } from '@/hooks/useDaftarTabel';
import { renderDenganTema } from '@/test/utils';
import DaftarKelasPage from './DaftarKelasPage';

type OpsiDaftar = Parameters<typeof useDaftarTabel<RiwayatRow>>[0];
const uji = vi.hoisted(() => ({
  tabel: null as ExcelTabelV2Props<RiwayatRow> | null,
  opsi: null as OpsiDaftar | null,
  dialog: null as ComponentProps<typeof EditSantriDialog> | null,
  rows: [] as RiwayatRow[],
  izin: ['santri.ubah', 'riwayat_belajar.ubah'],
  filter: { jenjangs: ['MI'], tahunAjaranNames: ['2026/2027'], semesters: ['1'], tingkat: ['3'], kelas: ['3A'], loading: false },
  daftar: vi.fn(), kelas: vi.fn(), riwayat: vi.fn(), santri: vi.fn(), anggota: vi.fn(),
  load: vi.fn(), saved: vi.fn(), urut: vi.fn(), profil: vi.fn(),
  setPage: vi.fn(), setPerPage: vi.fn(),
  loading: false, err: '',
}));

vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, roles: [{ name: 'super_admin' }], lembagas: [], permissions: [] } }) }));
vi.mock('@/api/auth', () => ({ bisa: (_u: unknown, izin: string) => uji.izin.includes(izin) }));
vi.mock('@/api/siklus', () => ({ daftarKelas: (...a: unknown[]) => uji.daftar(...a), updateRiwayatBelajar: (...a: unknown[]) => uji.riwayat(...a) }));
vi.mock('@/api/santri', () => ({ updateSantri: (...a: unknown[]) => uji.santri(...a), updateLembagaSantri: (...a: unknown[]) => uji.anggota(...a) }));
vi.mock('@/api/master', () => ({ listKelas: (...a: unknown[]) => uji.kelas(...a) }));
vi.mock('@/hooks/useFilterGlobalAktif', () => ({ useFilterGlobalAktif: () => uji.filter }));
vi.mock('@/hooks/useDaftarTabel', () => ({
  useDaftarTabel: (opsi: OpsiDaftar) => {
    uji.opsi = opsi;
    return { rows: uji.rows, loading: uji.loading, err: uji.err,
      urut: ['nama_lengkap'], arahUrut: 'turun', terapkanUrut: uji.urut,
      load: uji.load, onSaved: uji.saved, lastPage: 3, total: 101,
      pager: { page: 2, perPage: 50, setPage: uji.setPage, setPerPage: uji.setPerPage } };
  },
}));
// Uji wiring halaman saja; kontrak grid/paste/dropdown diuji di test komponen V2.
vi.mock('@/components/excelV2/ExcelTabelV2', () => ({
  default: (props: ExcelTabelV2Props<RiwayatRow>) => {
    uji.tabel = props;
    return <section aria-label="Daftar kelas V2">{props.header}{props.filter}{props.pager}
      {props.rows.map((r) => <div key={r.id}>{props.renderActions?.(r)}</div>)}
    </section>;
  },
}));
vi.mock('@/components/VisibilitasFilter', () => ({ PengaturanHalaman: () => null }));
vi.mock('@/components/TopBarSearch', () => ({ TopBarSearch: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <input aria-label="Cari santri" value={value} onChange={(e) => onChange(e.target.value)} /> }));
vi.mock('@/components/santri/EditSantriDialog', () => ({
  EditSantriDialog: (props: ComponentProps<typeof EditSantriDialog>) => { uji.dialog = props; return props.open ? <div role="dialog" aria-label="Ubah santri" /> : null; },
}));
vi.mock('@/components/santri/useAksiProfilSantri', () => ({
  useAksiProfilSantri: () => ({ aksiProfil: (id: number, opsi: { daftar: number[] }) => <button onClick={() => uji.profil(id, opsi)}>Lihat profil {id}</button>, dialogProfil: null }),
}));

const ROW = {
  id: 101, santri_id: 11, tahun_ajaran: '2026/2027', jenjang: 'MI', kelas_id: 3,
  semester: '1', tgl_masuk: '2026-07-01T00:00:00.000Z', no_absen: 5, tingkat: '3',
  status_awal: 'Baru', status_akhir: 'Aktif', is_active_riwayat: 'Ya',
  santri: { id: 11, nama_lengkap: 'Ahmad', jk: 'L', nisn: '1234567890', is_active_pst: 'Ya', tgl_lahir: '2015-01-02T00:00:00.000Z' },
  lembaga_anggota: { id: 21, nis_lokal: '001', is_active_lembaga: 'Ya' },
  kelas: { id: 3, nama_kelas: '3A', tingkat: '3' },
} as RiwayatRow;

beforeEach(() => {
  vi.clearAllMocks();
  uji.tabel = null; uji.opsi = null; uji.dialog = null;
  uji.rows = [ROW, { ...ROW, id: 102, santri_id: 12, santri: { ...ROW.santri!, id: 12, nama_lengkap: 'Budi' } }];
  uji.izin = ['santri.ubah', 'riwayat_belajar.ubah'];
  uji.filter = { jenjangs: ['MI'], tahunAjaranNames: ['2026/2027'], semesters: ['1'], tingkat: ['3'], kelas: ['3A'], loading: false };
  uji.loading = false; uji.err = '';
  uji.kelas.mockResolvedValue({ data: [{ id: 3, nama_kelas: '3A' }] });
  uji.daftar.mockResolvedValue({ data: [], current_page: 1, last_page: 1, per_page: 50, total: 0 });
  uji.riwayat.mockReset().mockResolvedValue({});
  uji.santri.mockReset().mockResolvedValue({});
  uji.anggota.mockReset().mockResolvedValue({});
});
afterEach(() => vi.unstubAllEnvs());

async function tampil(url = '/daftar-kelas') {
  renderDenganTema(<MemoryRouter initialEntries={[url]}><DaftarKelasPage /></MemoryRouter>);
  await waitFor(() => expect(uji.kelas).toHaveBeenCalled());
  await waitFor(() => expect(uji.opsi?.deps).toContainEqual([3]));
}

describe('Daftar Kelas — V2 produksi', () => {
  it.each([true, false])('memakai V2 ketika DEV=%s dengan tableKey dan kontrak halaman tetap', async (dev) => {
    vi.stubEnv('DEV', dev);
    await tampil();
    expect(screen.getByRole('region', { name: 'Daftar kelas V2' })).toBeInTheDocument();
    expect(uji.tabel).toMatchObject({ tableKey: 'daftar_kelas', rail: true, rows: uji.rows, onSaved: uji.saved, onUrut: uji.urut, urutAktif: ['nama_lengkap'], arahUrut: 'turun', loading: false });
    expect(uji.tabel?.onCreateRow).toBeUndefined();
    expect(uji.tabel?.getValues(ROW)).toMatchObject({ nama_lengkap: 'Ahmad', nis_lokal: '001', semester: '1', no_absen: '5', anggota_aktif: 'ya', tgl_lahir: '2015-01-02' });
  });

  it.each([[true, true], [true, false], [false, true], [false, false]])('izin santri=%s dan riwayat=%s membatasi field yang tepat', async (santri, riwayat) => {
    uji.izin = [...(santri ? ['santri.ubah'] : []), ...(riwayat ? ['riwayat_belajar.ubah'] : [])];
    await tampil();
    const field = (key: string) => uji.tabel!.fields.find((f) => f.key === key)!;
    expect(uji.tabel?.canEdit).toBe(santri || riwayat);
    expect(field('nama_lengkap').kind).toBe(santri ? 'text' : 'static');
    expect(field('jk').kind).toBe(santri ? 'select' : 'static');
    expect(field('anggota_aktif').kind).toBe(santri ? 'toggle' : 'static');
    expect(field('semester').kind).toBe(riwayat ? 'select' : 'static');
    expect(field('no_absen').kind).toBe(riwayat ? 'text' : 'static');
    expect(field('kelas').kind).toBe('static');
    expect(screen.queryAllByRole('button', { name: 'Ubah detail santri' })).toHaveLength(santri ? 2 : 0);
  });

  it('meneruskan filter, kelas ID, status, pencarian, urutan dan pagination ke API', async () => {
    const user = userEvent.setup();
    await tampil('/daftar-kelas?cari=Ahmad');
    expect(screen.getByRole('textbox', { name: 'Cari santri' })).toHaveValue('Ahmad');
    await user.clear(screen.getByRole('textbox', { name: 'Cari santri' }));
    await user.type(screen.getByRole('textbox', { name: 'Cari santri' }), 'Budi');
    expect(uji.opsi?.search).toBe('Budi');
    await user.click(screen.getByRole('button', { name: 'Buka daftar status' }));
    await user.click(await screen.findByRole('option', { name: 'Tidak aktif' }));
    await uji.opsi!.ambil({ search: 'Budi', page: 2, perPage: 50, urut: ['nama_lengkap'], arah: 'turun' });
    expect(uji.daftar).toHaveBeenCalledWith(expect.objectContaining({ jenjang: ['MI'], tahun_ajaran: ['2026/2027'], semester: ['1'], tingkat: ['3'], kelas_id: [3], kelompok_status: 'nonaktif', search: 'Budi', sort: ['nama_lengkap'], arah: 'turun', page: 2, per_page: 50 }));
    await user.click(screen.getByRole('button', { name: 'Halaman berikutnya' }));
    expect(uji.load).toHaveBeenCalledWith(3);
    await user.click(screen.getByRole('radio', { name: '10 data per halaman' }));
    expect(uji.load).toHaveBeenCalledWith(1, 10);
  });

  it('tanpa lembaga tidak mengambil data', async () => {
    uji.filter.jenjangs = [];
    await act(async () => { renderDenganTema(<MemoryRouter><DaftarKelasPage /></MemoryRouter>); });
    expect(await uji.opsi!.ambil({ search: '', page: 1, perPage: 50, urut: [], arah: 'naik' })).toMatchObject({ data: [], total: 0 });
    expect(uji.daftar).not.toHaveBeenCalled();
  });

  it('lintas tahun ajaran atau semester tetap dikirim sebagai lintas periode', async () => {
    uji.filter.semesters = [];
    await tampil();
    await uji.opsi!.ambil({ search: '', page: 1, perPage: 50, urut: [], arah: 'naik' });
    expect(uji.daftar).toHaveBeenCalledWith(expect.objectContaining({ lintas_periode: true, search: undefined, sort: undefined }));
  });

  it('aksi profil dan dialog ubah memakai ID santri serta urutan navigasi yang benar', async () => {
    const user = userEvent.setup();
    await tampil();
    await user.click(screen.getByRole('button', { name: 'Lihat profil 11' }));
    expect(uji.profil).toHaveBeenCalledWith(11, { daftar: [11, 12] });
    await user.click(screen.getAllByRole('button', { name: 'Ubah detail santri' })[0]);
    expect(screen.getByRole('dialog', { name: 'Ubah santri' })).toBeInTheDocument();
    expect(uji.dialog?.santri?.id).toBe(11);
    expect(uji.dialog?.daftar?.map((s) => s.id)).toEqual([11, 12]);
    act(() => { uji.dialog!.onGanti!(uji.rows[1].santri!); });
    expect(uji.dialog?.santri?.id).toBe(12);
    expect(uji.dialog?.onSaved).toBe(uji.load);
    act(() => { uji.dialog!.onOpenChange(false); });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('loading dan error tetap diteruskan ke tabel dan pemberitahuan halaman', async () => {
    uji.loading = true; uji.err = 'Gagal memuat daftar kelas.';
    await tampil();
    expect(uji.tabel?.loading).toBe(true);
    expect(screen.getByText('Gagal memuat daftar kelas.')).toBeInTheDocument();
    expect(uji.tabel?.emptyText).toBe('Pilih lembaga untuk menampilkan daftar kelas.');
  });

  it('commit gabungan mengirim ID/payload terpisah ke riwayat, profil dan keanggotaan', async () => {
    await tampil();
    await uji.tabel!.onCommit!(101, { semester: '2', no_absen: ' 7 ', nama_lengkap: ' Ahmad Baru ', nis_lokal: ' 002 ', anggota_aktif: 'tidak', kelas: 'Tidak boleh dikirim' });
    expect(uji.riwayat).toHaveBeenCalledWith(101, { semester: '2', no_absen: '7' });
    expect(uji.santri).toHaveBeenCalledWith(11, { nama_lengkap: 'Ahmad Baru' });
    expect(uji.anggota).toHaveBeenCalledWith(21, { nis_lokal: '002', is_active_lembaga: 'Tidak' });
  });

  it('delete nilai opsional menjadi null dan validasi field wajib/dropdown tetap tersedia', async () => {
    await tampil();
    const field = (key: string) => uji.tabel!.fields.find((f) => f.key === key)!;
    expect(field('nama_lengkap').validate?.(null)).toBe('Nama wajib diisi.');
    expect(field('nisn').validate?.('abc')).toBeTruthy();
    expect(field('semester').choices).toEqual([{ value: '1', label: '1' }, { value: '2', label: '2' }]);
    await uji.tabel!.onCommit!(101, { no_absen: null, email_santri: '', nis_lokal: null });
    expect(uji.riwayat).toHaveBeenCalledWith(101, { no_absen: null });
    expect(uji.santri).toHaveBeenCalledWith(11, { email_santri: null });
    expect(uji.anggota).toHaveBeenCalledWith(21, { nis_lokal: null });
  });

  it('kegagalan API diteruskan ke antrean simpan V2 tanpa mengirim perubahan lanjutan', async () => {
    await tampil();
    uji.riwayat.mockRejectedValueOnce(new Error('Simpan ditolak.'));
    await expect(uji.tabel!.onCommit!(101, { semester: '2', nama_lengkap: 'Baru' })).rejects.toThrow('Simpan ditolak.');
    expect(uji.santri).not.toHaveBeenCalled();
    expect(uji.anggota).not.toHaveBeenCalled();
    expect(uji.saved).not.toHaveBeenCalled();
  });
});
