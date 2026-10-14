import { MemoryRouter } from 'react-router-dom';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import KeuanganPage from './KeuanganPage';
import { renderDenganTema } from '@/test/utils';
import { daftarJenis, daftarTarif, type CrosstabTagihan, type JenisTagihan, type Tarif } from '@/api/keuangan';

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () => ({ length: 0, item: () => null }) as unknown as DOMRectList;
  }
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

/* Kunci diagnosa balapan: request "a" dibuat TERTUNDA (tidak langsung resolve),
   lalu "zzz" selesai duluan. Tanpa penjaga req/abort di loadCrosstab, balasan
   lama yang tiba belakangan menimpa data baru — persis yang terjadi di browser
   sebelum perbaikan ini (baris lama tetap tampil untuk kueri "zzz").

   `vi.hoisted` wajib: factory vi.mock di-hoist ke atas file, sehingga ia tak
   boleh menyentuh const biasa yang belum terinisialisasi. */
const uji = vi.hoisted(() => {
  const KOLOM = { key: '1|bulanan|2025-07', jenis_id: 1, jenis_nama: 'Infaq Bulanan', tipe: 'bulanan' as const, periode: '2025-07' };
  /** Crosstab `n` baris bernama "Awalan i" — nama dipakai sebagai pembeda. */
  const crosstub = (n: number, awalan: string) => ({
    kolom: [KOLOM],
    baris: Array.from({ length: n }, (_, i) => ({
      santri_id: i + 1,
      nama: `${awalan} ${i + 1}`,
      jenjang: 'MI',
      ayah_nama: null,
      ibu_nama: null,
      kelas: null, tingkat: null,
      jenjang_riwayat: ['MI'],
      foto_dokumen_id: null, foto_profil: false,
      status_akhir: 'aktif', aktif: true,
      sel: {
        [KOLOM.key]: {
          id: i + 1, nominal: 75000, terbayar: 0, sisa: 75000,
          status: 'belum' as const, terlambat: false, jatuh_tempo: null, tahun_ajaran: '2025/2026',
        },
      },
      total_tagihan: 75000, total_terbayar: 0, tunggakan: 0,
    })),
    total: n, per_page: 50, current_page: 1, last_page: 1,
  });
  const tertunda: { saisi: (() => void) | null } = { saisi: null };
  const crosstabTagihan = vi.fn(({ santri }: { santri?: string }) => {
    if (santri === 'a') {
      return new Promise((resolve) => {
        tertunda.saisi = () => resolve(crosstub(50, 'Lama'));
      });
    }
    return Promise.resolve(crosstub(santri === 'zzz' ? 0 : 50, 'Baru'));
  });
  return { crosstub, tertunda, crosstabTagihan };
});

/* Tab Tarif: mode Edit digerbangi izin `keuangan.ubah`. `user` bisa diganti
   per test lewat `ujiAuth`; bawaan tanpa pengguna = tabel baca-saja. */
const ujiAuth = vi.hoisted(() => ({
  user: null as null | {
    id: number;
    roles: { name: string }[];
    lembagas: { jenjang: string; nama: string }[];
    permissions: string[];
  },
}));

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ user: ujiAuth.user, loading: false, setUser: () => {}, logoutLocal: async () => {} }),
}));

vi.mock('@/api/keuangan', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/keuangan')>();
  return {
    ...asli,
    crosstabTagihan: uji.crosstabTagihan,
    daftarJenis: vi.fn(async () => []),
    daftarTarif: vi.fn(async () => []),
    daftarDispensasi: vi.fn(async () => []),
    // `muatRiwayat` di halaman menugaskan hasil langsung ke state
    // (`setRiwayatRows(await riwayatPembayaran(id))`), jadi mock mengembalikan
    // array `PembayaranRow[]` (bukan objek berbungkus `{data}`).
    riwayatPembayaran: vi.fn(async () => []),
  };
});

/* Array filter WAJIB stabil (didefinisikan sekali): halaman memakai
   `tahunAjaranNames`/`jenjangs` sebagai dependensi effect. Kalau factory mock
   mengembalikan array baru tiap render, effectnya berjalan berulang → loop render. */
const FILTER = {
  jenjangs: ['MI'],
  tahunAjaranNames: ['2025/2026'],
  semesters: ['1'],
  tingkat: [] as string[],
  kelas: [] as number[],
  loading: false,
};
vi.mock('@/hooks/useFilterGlobalAktif', () => ({
  useFilterGlobalAktif: () => FILTER,
  // Tiru implementasi asli: nilai tunggal mengembalikan isinya (bukan objek
  // apa pun) — lingkup baris input tabel Tarif bergantung pada ini.
  targetTunggal: (values: readonly string[]) => (values.length === 1 ? values[0] : null),
}));

/* Rail filter tingkat/kelas butuh context tingkat & kelas (halaman test ini
   memakai provider penuh) dan daftar kelas lingkup. */
vi.mock('@/tingkatAktif', () => ({
  useTingkatAktif: () => ({ pilih: vi.fn() }),
}));
vi.mock('@/kelasAktif', () => ({
  useKelasAktif: () => ({ pilih: vi.fn() }),
}));
vi.mock('@/api/master', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/master')>();
  const paginasiKosong = async () => ({
    pesan: 'ok',
    data: [],
    meta: { current_page: 1, last_page: 1, total: 0, per_page: 1000 },
  });
  return {
    ...asli,
    listKelas: vi.fn(paginasiKosong),
    // `load()` halaman menunggu lembaga + tahun ajaran bersama daftar jenis;
    // tanpa mock ini muat jenis menggantung dan baris uji tidak pernah tampil.
    listLembaga: vi.fn(paginasiKosong),
    listTahunAjaran: vi.fn(paginasiKosong),
  };
});

vi.mock('@/api/toolbarPreset', () => ({
  muatToolbarPreset: vi.fn(async () => ({
    pesan: 'ok',
    data: { table_key: 'uji', visibilitas: {}, lebar: {}, urutan: [], align: {} },
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
}));

vi.mock('react-datasheet-grid', async (importOriginal) => {
  const asli = await importOriginal<typeof import('react-datasheet-grid')>();
  const stub = await import('@/components/excel/_dsgStubDom');
  return { ...asli, DynamicDataSheetGrid: stub.DynamicDataSheetGridStub };
});

beforeEach(() => {
  vi.clearAllMocks();
  uji.tertunda.saisi = null;
  ujiAuth.user = null;
});

/** Buka tab Tagihan dan tunggu muat awal selesai. Halaman memakai
 *  `useLocation` (VisibilitasFilter), jadi dibungkus Router. */
async function bukaTabTagihan() {
  renderDenganTema(
    <MemoryRouter initialEntries={['/keuangan']}>
      <KeuanganPage />
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByRole('tab', { name: 'Tagihan' }));
  await waitFor(() => expect(screen.getByText('Baru 1')).toBeInTheDocument());
}

describe('KeuanganPage — muat crosstab', () => {
  it('menampilkan data crosstab setelah tab Tagihan dibuka', async () => {
    await bukaTabTagihan();
    expect(screen.getByText('Baru 1')).toBeInTheDocument();
  });

  it('menunda pencarian 400 ms sebelum memanggil API', async () => {
    await bukaTabTagihan();
    const sebelum = uji.crosstabTagihan.mock.calls.length;
    await userEvent.type(screen.getByPlaceholderText(/Cari nama/i), 'a');
    // Tiba-tiba belum ada request baru: nilai masih ditunda.
    expect(uji.crosstabTagihan.mock.calls.length).toBe(sebelum);
    await waitFor(() => expect(uji.crosstabTagihan.mock.calls.length).toBeGreaterThan(sebelum));
  });

  it('mengabaikan balasan lama yang tiba setelah balasan baru', async () => {
    await bukaTabTagihan();
    const input = screen.getByPlaceholderText(/Cari nama/i);

    await userEvent.type(input, 'a');
    // Tunggu debounce 400 ms agar request "a" benar-benar terkirim.
    await waitFor(() => expect(uji.tertunda.saisi).not.toBeNull());

    await userEvent.clear(input);
    await userEvent.type(input, 'zzz');
    // Hasil "zzz" = 0 baris → tabel kosong (nama "Barus" hilang).
    await waitFor(() => expect(screen.queryByText('Baru 1')).not.toBeInTheDocument());

    // Balasan lama tiba belakangan: harus TIDAK menimpa tabel.
    uji.tertunda.saisi?.();
    await waitFor(() => expect(screen.queryByText('Lama 1')).not.toBeInTheDocument());
  });
});

describe('KeuanganPage — mode Edit tabel Tarif', () => {
  const TARIF: Tarif = {
    id: 11, jenjang: 'MI', tahun_ajaran: '2025/2026', jenis_id: 1,
    tingkat: null, nominal: 75000, is_active: true,
    jenis: { id: 1, nama: 'Infaq Bulanan' },
  };

  async function bukaTabTarif() {
    renderDenganTema(
      <MemoryRouter initialEntries={['/keuangan']}>
        <KeuanganPage />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole('tab', { name: 'Tarif' }));
  }

  it('pemegang izin keuangan.ubah bisa menyalakan mode Edit', async () => {
    ujiAuth.user = {
      id: 7, roles: [{ name: 'admin' }],
      lembagas: [{ jenjang: 'MI', nama: 'MI' }],
      permissions: ['keuangan.lihat', 'keuangan.ubah'],
    };
    vi.mocked(daftarTarif).mockResolvedValue([TARIF]);
    await bukaTabTarif();

    // Baris tampil dengan nominal terformat; switch Aktif hidup langsung.
    // (Sel bisa muncul >1×: host pengukur lebar kolom AutoFit juga memuat teksnya.)
    expect((await screen.findAllByText('75.000')).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Aktif')).toBeEnabled();

    await userEvent.click(screen.getByLabelText('Aktifkan mode Edit'));
    expect(await screen.findByText('Mode Edit aktif')).toBeInTheDocument();
  });

  it('tanpa izin keuangan.ubah tabel tetap baca-saja (tanpa mode Edit)', async () => {
    vi.mocked(daftarTarif).mockResolvedValue([TARIF]);
    await bukaTabTarif();

    expect((await screen.findAllByText('75.000')).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Aktifkan mode Edit')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Aktif')).toBeDisabled();
  });

  it('pemegang izin keuangan.tambah bisa menyalakan mode Input', async () => {
    ujiAuth.user = {
      id: 7, roles: [{ name: 'admin' }],
      lembagas: [{ jenjang: 'MI', nama: 'MI' }],
      permissions: ['keuangan.lihat', 'keuangan.tambah'],
    };
    vi.mocked(daftarTarif).mockResolvedValue([TARIF]);
    await bukaTabTarif();

    await userEvent.click(await screen.findByLabelText('Tambah baris baru'));
    expect(await screen.findByText('Mode Input aktif')).toBeInTheDocument();
  });

  it('baris input mengambil lingkup lembaga + TA dari filter (dasar penjaga duplikat)', async () => {
    ujiAuth.user = {
      id: 7, roles: [{ name: 'admin' }],
      lembagas: [{ jenjang: 'MI', nama: 'MI' }],
      permissions: ['keuangan.lihat', 'keuangan.tambah'],
    };
    vi.mocked(daftarTarif).mockResolvedValue([TARIF]);
    await bukaTabTarif();
    await userEvent.click(await screen.findByLabelText('Tambah baris baru'));
    await screen.findByText('Mode Input aktif');

    // Lingkup baris input = filter tunggal topBar; pasangan inilah yang
    // diuji `tarifBentrok` sebelum POST (dropdown Jenis-nya sendiri hanya
    // ter-render saat sel aktif, di luar jangkauan stub grid).
    const selJenjang = document.querySelector('.simpes-dsg-row-input [data-col-key="jenjang"]');
    const selTa = document.querySelector('.simpes-dsg-row-input [data-col-key="tahun_ajaran"]');
    expect(selJenjang?.textContent).toBe('MI');
    expect(selTa?.textContent).toBe('2025/2026');
  });

  it('tanpa izin keuangan.tambah mode Input tidak tersedia', async () => {
    ujiAuth.user = {
      id: 7, roles: [{ name: 'admin' }],
      lembagas: [{ jenjang: 'MI', nama: 'MI' }],
      permissions: ['keuangan.lihat', 'keuangan.ubah'],
    };
    vi.mocked(daftarTarif).mockResolvedValue([TARIF]);
    await bukaTabTarif();

    expect((await screen.findAllByText('75.000')).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Tambah baris baru')).not.toBeInTheDocument();
  });
});

describe('KeuanganPage — tabel Jenis Tagihan (mode Edit & Input)', () => {
  const JENIS: JenisTagihan = { id: 5, nama: 'HIPA', tipe: 'non_bulanan', jenjang: 'MI', keterangan: null, is_active: true };

  /** Tab Jenis Tagihan: tab awal halaman, tapi tab tersimpan (pref) bisa
   *  berbeda antar test — jadi diklik eksplisit seperti tab lain. */
  async function bukaTabJenis() {
    renderDenganTema(
      <MemoryRouter initialEntries={['/keuangan']}>
        <KeuanganPage />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole('tab', { name: 'Jenis Tagihan' }));
  }

  it('pemegang izin keuangan.ubah bisa menyalakan mode Edit', async () => {
    ujiAuth.user = {
      id: 7, roles: [{ name: 'admin' }],
      lembagas: [{ jenjang: 'MI', nama: 'MI' }],
      permissions: ['keuangan.lihat', 'keuangan.ubah'],
    };
    vi.mocked(daftarJenis).mockResolvedValue([JENIS]);
    await bukaTabJenis();

    expect((await screen.findAllByText('HIPA')).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByLabelText('Aktifkan mode Edit'));
    expect(await screen.findByText('Mode Edit aktif')).toBeInTheDocument();
  });

  it('pemegang izin keuangan.tambah bisa menyalakan mode Input', async () => {
    ujiAuth.user = {
      id: 7, roles: [{ name: 'admin' }],
      lembagas: [{ jenjang: 'MI', nama: 'MI' }],
      permissions: ['keuangan.lihat', 'keuangan.tambah'],
    };
    vi.mocked(daftarJenis).mockResolvedValue([JENIS]);
    await bukaTabJenis();

    await userEvent.click(await screen.findByLabelText('Tambah baris baru'));
    expect(await screen.findByText('Mode Input aktif')).toBeInTheDocument();
  });
});

/* Sel crosstab bernominal 75.000; id sel = `btn_tagihan_sel_<n>` (n = nomor
 *  baris, sama dengan santri_id di `crosstub`). Dipakai test pilihan ganda &
 *  popover aksi batch di bawah. */
function selCell(id: number): HTMLElement {
  return document.getElementById(`btn_tagihan_sel_${id}`) as HTMLElement;
}

/** Apakah sel bergaris seleksi? Garis seleksi digambar sebagai boxShadow inline
 *  (lihat `bayangSeleksi`), jadi kehadirannya = sel itu ada di pilihan. */
function sorot(id: number): boolean {
  return (selCell(id).style.boxShadow ?? '') !== '';
}

/** jsdom tak punya PointerEvent; MouseEvent bertipe pointer* dipakai supaya
 *  properti `button`/`ctrlKey`/`shiftKey` terbaca seperti di browser. */
function pointerEv(el: Element, tipe: 'pointerdown' | 'pointerup', o: { button?: number; ctrlKey?: boolean; shiftKey?: boolean } = {}) {
  fireEvent(el, new MouseEvent(tipe, {
    bubbles: true, cancelable: true,
    button: o.button ?? 0, ctrlKey: o.ctrlKey ?? false, shiftKey: o.shiftKey ?? false,
  }));
}

describe('KeuanganPage — pilihan ganda (klik kiri) & aksi batch', () => {
  /* Menutupi handler batch halaman (pilihAnchorSatu/togglePilih/pilihBlok/
     pilihIrisan/lepasBlok/batalPilih/bukaBatch) lewat interaksi sel sungguhan —
     bukan memanggil closure secara langsung, sehingga wiring prop & Map status
     ikut teruji. */

  /* Tanpa bilah pilihan: jumlah terpilih diverifikasi lewat sorotan sel
     (boxShadow) karena tak ada lagi chip "N tagihan dipilih". */

  it('klik kiri memilih satu sel', async () => {
    await bukaTabTagihan();
    pointerEv(selCell(1), 'pointerup');
    await waitFor(() => expect(sorot(1)).toBe(true));
    expect(sorot(2)).toBe(false);
  });

  it('Ctrl+klik menambah sel ke pilihan (akumulasi)', async () => {
    await bukaTabTagihan();
    pointerEv(selCell(1), 'pointerup');
    for (const n of [2, 3]) {
      pointerEv(selCell(n), 'pointerdown');
      pointerEv(selCell(n), 'pointerup', { ctrlKey: true });
    }
    await waitFor(() => expect(sorot(3)).toBe(true));
    expect(sorot(1)).toBe(true);
    expect(sorot(2)).toBe(true);
  });

  it('Ctrl+klik pada sel terpilih melepasnya (toggle)', async () => {
    await bukaTabTagihan();
    pointerEv(selCell(1), 'pointerup');
    pointerEv(selCell(2), 'pointerdown');
    pointerEv(selCell(2), 'pointerup', { ctrlKey: true });
    await waitFor(() => expect(sorot(2)).toBe(true));
    // Ctrl+klik lagi pada sel yang sudah terpilih → lepas (toggle).
    pointerEv(selCell(2), 'pointerdown');
    pointerEv(selCell(2), 'pointerup', { ctrlKey: true });
    await waitFor(() => expect(sorot(2)).toBe(false));
    expect(sorot(1)).toBe(true);
  });

  it('klik kiri pada sel lain mengganti pilihan (bukan menumpuk)', async () => {
    await bukaTabTagihan();
    pointerEv(selCell(1), 'pointerup');
    pointerEv(selCell(2), 'pointerdown');
    pointerEv(selCell(2), 'pointerup', { ctrlKey: true });
    await waitFor(() => expect(sorot(2)).toBe(true));
    // Klik kiri biasa → ganti seluruh pilihan dengan satu sel itu.
    pointerEv(selCell(5), 'pointerdown');
    pointerEv(selCell(5), 'pointerup');
    await waitFor(() => expect(sorot(5)).toBe(true));
    expect(sorot(1)).toBe(false);
    expect(sorot(2)).toBe(false);
  });

  it('klik lalu tahan-geser dari sel yang sama memblok sampai ujung drag', async () => {
    /* Dulu tes ini mengunci perilaku sebaliknya ("irisan tetap 1"), yang
       justru jadi bug: setelah klik satu sel, drag dari sel itu tersaring
       oleh pilihan 1 sel sehingga tak ada blok terbentuk. Pilihan 1 sel
       sekarang diperlakukan sebagai seleksi baru. */
    await bukaTabTagihan();
    pointerEv(selCell(1), 'pointerup');
    await waitFor(() => expect(sorot(1)).toBe(true));
    pointerEv(selCell(1), 'pointerdown');
    fireEvent.pointerEnter(selCell(3));
    pointerEv(selCell(3), 'pointerup');
    await waitFor(() => expect(sorot(3)).toBe(true));
    expect(sorot(1)).toBe(true);
    expect(sorot(2)).toBe(true);
  });

  it('klik kiri TIDAK membuka aksi batch', async () => {
    await bukaTabTagihan();
    pointerEv(selCell(1), 'pointerup');
    await waitFor(() => expect(sorot(1)).toBe(true));
    expect(screen.queryByText('Hapus Riwayat Bayar')).toBeNull();
    expect(screen.queryByText('Batal Pilih')).toBeNull();
  });

  it('klik kanan saat >1 sel terpilih membuka aksi batch', async () => {
    await bukaTabTagihan();
    // Bangun pilihan 2 sel (klik biasa + Ctrl+klik).
    pointerEv(selCell(1), 'pointerup');
    pointerEv(selCell(2), 'pointerdown');
    pointerEv(selCell(2), 'pointerup', { ctrlKey: true });
    await waitFor(() => expect(sorot(2)).toBe(true));
    expect(sorot(1)).toBe(true);
    // Klik kanan di dalam range TIDAK mengubah pilihan — justru itu yang
    // membuat aksi batch bisa dibuka untuk seluruh range.
    fireEvent.contextMenu(selCell(2));
    expect(await screen.findByText('2 sel dipilih')).toBeInTheDocument();
    await userEvent.click(await screen.findByText('Bayar Lunas'));
    expect(await screen.findByText(/Bayar 2 tagihan\?/)).toBeInTheDocument();
  });
});

describe('KeuanganPage — geser blok bertahap (regresi multi-select)', () => {
  /* Fixture halaman hanya punya SATU kolom, jadi "blok" di sini = rentang
     BARIS. Drag nyata melewati sel satu per satu (satu onPointerEnter per
     sel); itulah bentuk yang mengungkap dua bug lama:
       1. blok menyusut sel demi sel (irisan diukur lawan hasil berjalan);
       2. drag KEDUA di luar pilihan pertama menghasilkan pilihan KOSONG
          (irisan masih diukur lawan pilihan gesture sebelumnya). */

  it('satu gesture: blok tumbuh penuh, bukan berhenti di sel kedua', async () => {
    await bukaTabTagihan();
    pointerEv(selCell(10), 'pointerdown');
    fireEvent.pointerEnter(selCell(11));
    // Langkah kedua sudah harus memblok dua sel (bukan satu).
    await waitFor(() => expect(sorot(11)).toBe(true));
    expect(sorot(10)).toBe(true);
    fireEvent.pointerEnter(selCell(12));
    await waitFor(() => expect(sorot(12)).toBe(true));
    expect(sorot(10)).toBe(true);
    pointerEv(selCell(12), 'pointerup');
  });

  it('drag kedua dari luar pilihan pertama = seleksi BARU (dulu kosong)', async () => {
    await bukaTabTagihan();
    // Gesture 1: blok baris 10–12.
    pointerEv(selCell(10), 'pointerdown');
    fireEvent.pointerEnter(selCell(12));
    pointerEv(selCell(12), 'pointerup');
    await waitFor(() => expect(sorot(12)).toBe(true));

    // Gesture 2 dimulai dari sel di LUAR pilihan (20) → seleksi baru,
    // bukan irisan dengan {10,11,12} yang menghasilkan nol sel.
    pointerEv(selCell(20), 'pointerdown');
    fireEvent.pointerEnter(selCell(21));
    pointerEv(selCell(21), 'pointerup');
    await waitFor(() => expect(sorot(21)).toBe(true));
    expect(sorot(20)).toBe(true);
    expect(sorot(10)).toBe(false);
    expect(sorot(12)).toBe(false);
  });

  it('klik lalu DRAG dari sel yang sama (pilihan 1 sel) tetap menyeleksi blok', async () => {
    /* Bug: klik kiri memilih satu sel; drag yang dimulai SESAAAT setelahnya
       dari sel itu dianggap "menggeser seleksi lama" (mode irisan). Karena
       pilihan lama hanya berisi sel itu, blok tersaring jadi satu sel dan
       seluruh drag terbuang — tak ada seleksi. Pilihan 1 sel harus
       diperlakukan sebagai seleksi BARU. */
    await bukaTabTagihan();
    pointerEv(selCell(10), 'pointerup'); // klik tunggal → pilihan {10}
    await waitFor(() => expect(sorot(10)).toBe(true));

    pointerEv(selCell(10), 'pointerdown'); // drag dimulai dari sel yang sama
    fireEvent.pointerEnter(selCell(11));
    fireEvent.pointerEnter(selCell(12));
    pointerEv(selCell(12), 'pointerup');
    await waitFor(() => expect(sorot(12)).toBe(true));
    expect(sorot(10)).toBe(true);
    expect(sorot(11)).toBe(true);
  });

  it('drag di dalam pilihan BANYAK tetap mengiris (perilaku Excel dipertahankan)', async () => {
    /* Aturan irisan hanya di-nonaktifkan untuk pilihan 1 sel. Dari dalam
       pilihan multi-sel, drag tetap menyusutkan seleksi ke irisan blok. */
    await bukaTabTagihan();
    pointerEv(selCell(10), 'pointerdown');
    fireEvent.pointerEnter(selCell(11));
    fireEvent.pointerEnter(selCell(12));
    fireEvent.pointerEnter(selCell(13));
    pointerEv(selCell(13), 'pointerup');
    await waitFor(() => expect(sorot(13)).toBe(true));
    expect(sorot(10)).toBe(true);

    // Drag dari tengah pilihan (11) ke 12 → irisan {11,12} saja.
    pointerEv(selCell(11), 'pointerdown');
    fireEvent.pointerEnter(selCell(12));
    pointerEv(selCell(12), 'pointerup');
    await waitFor(() => expect(sorot(12)).toBe(true));
    expect(sorot(11)).toBe(true);
    expect(sorot(10)).toBe(false);
    expect(sorot(13)).toBe(false);
  });
});

describe('KeuanganPage — klik kiri seleksi, klik kanan aksi', () => {
  /* Klik kiri murni seleksi sel (tanpa popover apa pun); aksi per tagihan
     hanya dari klik kanan/Enter. Bilah pilihan sudah dihapus, jadi tak ada
     chip jumlah maupun "Batal Pilih". */

  it('klik kiri TIDAK membuka popover apa pun', async () => {
    await bukaTabTagihan();
    pointerEv(selCell(1), 'pointerdown');
    pointerEv(selCell(1), 'pointerup');
    await waitFor(() => expect(sorot(1)).toBe(true));
    // Tak ada popover batch (Bayar/Ubah/Hapus Riwayat) maupun popover aksi
    // per tagihan (Detail/Ubah/Hapus).
    expect(screen.queryByText('Hapus Riwayat Bayar')).toBeNull();
    expect(screen.queryByText('Batal Pilih')).toBeNull();
    expect(screen.queryByText(/Tambah tagihan ·/)).toBeNull();
    expect(screen.queryByText('Detail')).toBeNull();
    expect(screen.queryByText('Ubah')).toBeNull();
    expect(screen.queryByText('Hapus')).toBeNull();
  });

  it('tak ada bilah pilihan / chip jumlah sama sekali', async () => {
    await bukaTabTagihan();
    pointerEv(selCell(1), 'pointerup');
    await waitFor(() => expect(sorot(1)).toBe(true));
    expect(screen.queryByText(/tagihan dipilih/)).toBeNull();
    expect(document.getElementById('btn_batch_pilih_aksi')).toBeNull();
  });

  it('geser dari keadaan KOSONG memblok banyak sel, bukan berhenti di sel kedua', async () => {
    await bukaTabTagihan();
    // Fixture hanya 1 kolom, jadi blok = rentang BARIS. Drag nyata melewati
    // sel SATU PER SATU (satu onPointerEnter per sel) — itulah yang memicu
    // bug lama: cabang "pilihan kosong" benar di sel pertama, lalu langkah
    // berikutnya jatuh ke irisan dan blok menyusut jadi 1 sel.
    pointerEv(selCell(10), 'pointerdown');
    for (let n = 11; n <= 20; n++) fireEvent.pointerEnter(selCell(n));
    pointerEv(selCell(20), 'pointerup');
    // Sel 10..20 tersorot semua (11 sel).
    await waitFor(() => expect(sorot(20)).toBe(true));
    for (const n of [10, 15, 20]) expect(sorot(n)).toBe(true);
    expect(sorot(9)).toBe(false);
    expect(sorot(21)).toBe(false);
  });

  it('sorotan hanya pada sel yang benar-benar terpilih', async () => {
    await bukaTabTagihan();
    pointerEv(selCell(10), 'pointerdown');
    pointerEv(selCell(10), 'pointerup');
    await waitFor(() => expect(sorot(10)).toBe(true));
    // Sel terpilih bergaris seleksi (boxShadow inline), yang lain tidak.
    expect(sorot(11)).toBe(false);
    expect(sorot(9)).toBe(false);
  });

  it('klik kanan dua kali berturut-turut tetap membuka popover', async () => {
    await bukaTabTagihan();
    fireEvent.contextMenu(selCell(1));
    expect(await screen.findByText('Detail')).toBeInTheDocument();
    // Klik kanan sel lain → popover pindah ke sel itu (tetap terbuka).
    fireEvent.contextMenu(selCell(2));
    expect(await screen.findByText('Detail')).toBeInTheDocument();
  });

  it('klik kanan satu sel membuka aksi per-tagihan', async () => {
    await bukaTabTagihan();
    fireEvent.contextMenu(selCell(1));
    expect(await screen.findByText('Detail')).toBeInTheDocument();
    // Satu sel → bukan mode batch.
    expect(screen.queryByText(/tagihan dipilih/)).toBeNull();
  });
});