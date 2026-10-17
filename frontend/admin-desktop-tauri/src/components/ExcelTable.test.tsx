import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import ExcelTable, { diCornerButton, type ExcelTableProps } from './ExcelTable';
import { resetSetelanKomponen } from './komponenCustom';
import { dsgStub } from './excel/_dsgStubDom';
import { listPresetTabel } from '@/api/preset';
import { muatKomponenCustom } from '@/api/komponenCustom';
import { renderDenganTema } from '@/test/utils';

// Rel tingkat-kelas butuh Router + provider tahun ajaran; yang diuji cuma
// apakah ExcelTable merendernya, jadi diganti stub ringan.
vi.mock('@/components/FilterRail', () => ({
  default: () => <div data-testid="rel_filter" />,
}));

// ---- Mock API (unit test tidak boleh memanggil fetch nyata) ----

/** Tiruan server stateful untuk preset toolbar: `visibilitas` bisa disemai
 *  per tes, dan `simpan` benar-benar mengubah yang dibaca `muat`. */
const serverToolbar = vi.hoisted(() => {
  const state = { visibilitas: {} as Record<string, boolean>, judul: null as string | null };
  const muat = vi.fn(async () => ({
    pesan: 'ok',
    data: {
      table_key: 'uji',
      visibilitas: { ...state.visibilitas },
      lebar: {},
      urutan: [],
      align: {},
      judul: state.judul,
    },
  }));
  const simpan = vi.fn(async (_t: string, v?: Record<string, boolean>) => {
    if (v !== undefined) state.visibilitas = { ...v };
    return { pesan: 'ok', data: null };
  });
  return { state, muat, simpan };
});

vi.mock('@/api/toolbarPreset', () => ({
  muatToolbarPreset: serverToolbar.muat,
  simpanToolbarPreset: serverToolbar.simpan,
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

/* Setelan komponen custom (mis. "Nilai awal" preset kolom) disimpan di server;
   API-nya dimock agar tes bisa menyemai setelan lewat store klien. */
vi.mock('@/api/komponenCustom', () => ({
  muatKomponenCustom: vi.fn(async () => ({ pesan: '', data: { peta: {} } })),
  simpanKomponenCustom: vi.fn(async () => ({ pesan: '', data: {} })),
  hapusKomponenCustom: vi.fn(async () => ({ pesan: '' })),
}));

// ---- Stub jsdom untuk react-datasheet-grid ----

vi.mock('react-datasheet-grid', async (importOriginal) => {
  const asli = await importOriginal<typeof import('react-datasheet-grid')>();
  const stub = await import('./excel/_dsgStubDom');
  return {
    ...asli,
    DynamicDataSheetGrid: stub.DynamicDataSheetGridStub,
  };
});

// ---- Fixtures ----

interface Baris {
  id: string;
  nama: string | null;
  kode: string | null;
}

const fields = [
  { key: 'nama', label: 'Nama', kind: 'text' as const },
  { key: 'kode', label: 'Kode', kind: 'text' as const },
];

const rows: Baris[] = [
  { id: '1', nama: 'Ahmad', kode: 'A-01' },
  { id: '2', nama: 'Budi', kode: 'B-02' },
];

const getValues = (r: Baris) => ({ nama: r.nama, kode: r.kode });

function renderTabel(props: Partial<ExcelTableProps<Baris>> = {}) {
  return renderDenganTema(
    <ExcelTable<Baris>
      tableKey="uji"
      fields={fields}
      rows={rows}
      getValues={getValues}
      canEdit
      onCommit={vi.fn(async () => {})}
      onSaved={vi.fn()}
      renderActions={() => <button type="button">Aksi-uji</button>}
      {...props}
    />,
  );
}

beforeEach(() => {
  serverToolbar.state.visibilitas = {};
  vi.clearAllMocks();
  localStorage.clear();
});

describe('ExcelTable — bilah judul', () => {
  /* Filter milik halaman (prop `filter`) harus dihitung sebagai isi bilah
     judul. Tanpa itu tabel yang HANYA punya filter — mis. tabel "Kamus Mapel"
     di halaman Kurikulum → Mata Pelajaran — tak mendapat bilah judul sama
     sekali, sehingga judul & kontrol filternya tak pernah dirender. */
  it('tabel yang hanya punya filter tetap mendapat bilah judul + filternya', () => {
    renderTabel({ filter: <input id="uji_filter" aria-label="Cari uji" /> });

    const bilah = document.querySelector('[data-part="header_tabel"]');
    expect(bilah).not.toBeNull();
    expect(bilah?.textContent).toContain('Uji');
    expect(document.getElementById('uji_filter')).not.toBeNull();
  });
});

describe('ExcelTable — baris dipilih (onBarisKlik)', () => {
  /* Fitur opt-in: tabel pemilih (mis. Daftar Dispensasi) memakai baris aktif
     DSG untuk memilih baris; tabel lain tak boleh terpengaruh. */
  it('sel aktif memanggil onBarisKlik dengan baris pada indeks itu', () => {
    const onBarisKlik = vi.fn();
    renderTabel({ onBarisKlik });

    dsgStub.aktifSel?.({ cell: { row: 1 } });
    expect(onBarisKlik).toHaveBeenCalledWith(rows[1]);

    dsgStub.aktifSel?.({ cell: { row: 0 } });
    expect(onBarisKlik).toHaveBeenLastCalledWith(rows[0]);
  });

  it('indeks di luar baris (mis. baris input) diabaikan, sel null juga', () => {
    const onBarisKlik = vi.fn();
    renderTabel({ onBarisKlik });

    dsgStub.aktifSel?.({ cell: null });
    dsgStub.aktifSel?.({ cell: { row: 99 } });
    expect(onBarisKlik).not.toHaveBeenCalled();
  });

  it('barisAktifId menyorot hanya baris itu', () => {
    renderTabel({ onBarisKlik: () => {}, barisAktifId: '2' });

    const disorot = document.querySelectorAll('.simpes-dsg-row-aktif');
    expect(disorot).toHaveLength(1);
    expect(disorot[0].textContent).toContain('Budi');
  });

  it('tanpa barisAktifId tak ada baris tersorot', () => {
    renderTabel({ onBarisKlik: () => {} });
    expect(document.querySelectorAll('.simpes-dsg-row-aktif')).toHaveLength(0);
  });
});

describe('ExcelTable — nilai awal preset kolom dari popover', () => {
  /** Preset "Lengkap" (semua kolom) + "Ringkas" (hanya Nama). */
  const presetDua = () => vi.mocked(listPresetTabel).mockResolvedValueOnce({
    pesan: 'ok',
    data: {
      presets: [
        { id: 9, jenjang: null, table_key: 'uji', nama: 'Lengkap', kolom: ['nama', 'kode'], is_default: true },
        { id: 7, jenjang: null, table_key: 'uji', nama: 'Ringkas', kolom: ['nama'], is_default: false },
      ],
      aktif_preset_id: null,
      default_preset_id: 9,
      aktif_kolom: null,
    },
  });

  it('menerapkan preset "nilai awal" saat tabel dimuat', async () => {
    resetSetelanKomponen();
    vi.mocked(muatKomponenCustom).mockResolvedValueOnce({
      pesan: 'ok',
      // Kunci setelan = `tableKey|komponen` (komponen hidup di toolbar tabel).
      data: { peta: { 'uji|select_preset_kolom_uji': { nilaiDefault: 'Ringkas' } } },
    });
    presetDua();

    renderTabel();

    // "Ringkas" hanya memuat kolom Nama → header Kode tak ikut tampil.
    await waitFor(() => expect(screen.getByText('Nama')).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText('Kode')).toBeNull());
  });

  it('tanpa nilai awal: jatuh ke preset bawaan "Lengkap" (semua kolom)', async () => {
    resetSetelanKomponen();
    presetDua();

    renderTabel();

    await waitFor(() => expect(screen.getAllByText('Kode').length).toBeGreaterThan(0));
  });
});

describe('ExcelTable — corner button (sudut kiri-atas)', () => {
  it('mengenali sel header gutter (dengan segitiga) sebagai corner button', () => {
    const sel = document.createElement('div');
    sel.className = 'dsg-cell dsg-cell-gutter dsg-cell-header';
    const segitiga = document.createElement('span');
    segitiga.className = 'dsg-corner-indicator';
    sel.appendChild(segitiga);

    // Klik tepat di segitiga maupun di selnya sama-sama dikenali.
    expect(diCornerButton(segitiga)).toBe(true);
    expect(diCornerButton(sel)).toBe(true);
  });

  it('bukan corner button: header kolom, sel data, dan target kosong', () => {
    const header = document.createElement('div');
    header.className = 'dsg-cell dsg-cell-header';
    const selData = document.createElement('div');
    selData.className = 'dsg-cell';

    expect(diCornerButton(header)).toBe(false);
    expect(diCornerButton(selData)).toBe(false);
    expect(diCornerButton(null)).toBe(false);
  });
});

describe('ExcelTable', () => {
  it('merender judul header (judulTabel), kolom Aksi, dan isi sel', async () => {
    renderTabel();

    expect(screen.getByText('Uji')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Aksi-uji').length).toBe(2));
    expect(screen.getByText('Ahmad')).toBeInTheDocument();
    expect(screen.getAllByText('B-02').length).toBeGreaterThan(0);
  });

  it('menimpa judul header lewat prop header', () => {
    renderTabel({ header: <span>Judul Kustom</span> });

    expect(screen.getByText('Judul Kustom')).toBeInTheDocument();
    expect(screen.queryByText('Uji')).not.toBeInTheDocument();
  });
  it('judul isian pengguna menang atas prop header', async () => {
    // Judul dinamis dari halaman (mis. "Daftar Santri (12)") boleh ditimpa
    // lewat Kelola Tabel — itu tujuan fiturnya, jadi isian pengguna yang
    // menang, bukan prop `header`.
    serverToolbar.state.judul = 'Buku Induk';
    renderTabel({ header: <span>Judul Halaman</span> });

    await waitFor(() => expect(screen.getByText('Buku Induk')).toBeInTheDocument());
    expect(screen.queryByText('Judul Halaman')).not.toBeInTheDocument();
  });

  it('judul kosong kembali ke rantai bawaan (header → judulTabel)', async () => {
    serverToolbar.state.judul = null;
    renderTabel({ header: <span>Judul Halaman</span> });

    // Menunggu muat selesai dulu supaya pengecekan bukan sekadar kondisi awal.
    await waitFor(() => expect(serverToolbar.muat).toHaveBeenCalled());
    expect(screen.getByText('Judul Halaman')).toBeInTheDocument();
  });

  it('menampilkan emptyText saat rows kosong', () => {
    renderTabel({ rows: [], emptyText: 'Tidak ada data uji.' });

    expect(screen.getByText('Tidak ada data uji.')).toBeInTheDocument();
  });

  it('hideCheckbox dan hideActions menyembunyikan kolom centang & Aksi', async () => {
    const { container } = renderTabel({ hideCheckbox: true, hideActions: true });

    expect(container.querySelector('[data-col-key="check"]')).toBeNull();
    expect(container.querySelector('[data-col-key="__aksi"]')).toBeNull();
    await waitFor(() => expect(screen.getByText('A-01')).toBeInTheDocument());
  });

  it('menampilkan kontrol toolbar di baris judul, bukan baris toolbar', async () => {
    const { container } = renderTabel({
      awalanToolbar: <span>Awal uji</span>,
      akhirToolbar: <span>Akhir uji</span>,
      tengah: <span>Info tengah uji</span>,
      renderBulkActions: (checked) => (
        <button type="button">Bulk uji ({checked.length})</button>
      ),
    });
    const kotak = container.querySelector('input.dsg-checkbox[data-row-id="1"]');
    expect(kotak).not.toBeNull();
    fireEvent.click(kotak as HTMLElement);

    await waitFor(() => expect(screen.getByText('Bulk uji (1)')).toBeInTheDocument());
    expect(container.querySelector('[data-part="toolbar_tabel"]')).toBeNull();
    const header = screen.getByText('Bulk uji (1)').closest('[data-part="header_tabel"]');
    expect(header).not.toBeNull();
    expect(header).toHaveTextContent('Awal uji');
    expect(header).toHaveTextContent('Akhir uji');
    expect(header).toHaveTextContent('Info tengah uji');
  });
});

/* Filter toolbar (Urutan & Kolom) bisa dinyalakan/dimatikan per tabel dari
   dialog Kelola Tabel; setelannya disimpan di toolbar_preset.visibilitas. */
describe('ExcelTable — filter toolbar mengikuti setelan Kelola Tabel', () => {
  const onUrut = vi.fn();

  it('bawaan (tak ada penanda): Urutan & Kolom tampil seperti sebelumnya', async () => {
    renderTabel({ onUrut });
    await waitFor(() => expect(document.getElementById('select_urut_uji')).not.toBeNull());
    expect(document.getElementById('select_preset_kolom_uji')).not.toBeNull();
  });

  it('urutan disembunyikan → dropdown Urutan hilang, Kolom tetap', async () => {
    serverToolbar.state.visibilitas = { urutan: false };
    renderTabel({ onUrut });
    await waitFor(() => expect(document.getElementById('select_urut_uji')).toBeNull());
    expect(document.getElementById('select_preset_kolom_uji')).not.toBeNull();
  });

  it('kolom disembunyikan → dropdown Kolom hilang, Urutan tetap', async () => {
    serverToolbar.state.visibilitas = { kolom: false };
    renderTabel({ onUrut });
    await waitFor(() => expect(document.getElementById('select_urut_uji')).not.toBeNull());
    expect(document.getElementById('select_preset_kolom_uji')).toBeNull();
  });

  it('keduanya disembunyikan → tak ada kontrol filter di bilah judul', async () => {
    serverToolbar.state.visibilitas = { urutan: false, kolom: false };
    renderTabel({ onUrut });
    await waitFor(() => expect(document.getElementById('select_urut_uji')).toBeNull());
    expect(document.getElementById('select_preset_kolom_uji')).toBeNull();
    // Judul tabel tetap ada (baris judul tak ikut hilang).
    expect(screen.getByText('Uji')).toBeInTheDocument();
  });

  it('tabel tanpa onUrut tak punya dropdown Urutan sejak awal', async () => {
    renderTabel();
    await waitFor(() => expect(screen.getByText('Ahmad')).toBeInTheDocument());
    expect(document.getElementById('select_urut_uji')).toBeNull();
  });

  it('hidePreset: tanpa Kolom, dan setelannya tak menghidupkannya kembali', async () => {
    serverToolbar.state.visibilitas = { kolom: false };
    renderTabel({ onUrut, hidePreset: true });
    await waitFor(() => expect(document.getElementById('select_urut_uji')).not.toBeNull());
    expect(document.getElementById('select_preset_kolom_uji')).toBeNull();
  });
});

describe('ExcelTable — visibilitas komponen tabel (setelan Kelola Tabel → Umum)', () => {
  /** `FilterRail` (rel tingkat-kelas) butuh Router + provider tahun ajaran, jadi
 *  diganti stub ringan: yang diuji di sini cuma apakah ExcelTable merendernya
 *  atau tidak. */
  function renderTabelRel() {
    return renderTabel({ rail: true });
  }

  /** `style.top` baris data pertama pada stub DSG = tinggi header + indeks×
   *  tinggi baris. Stub tak merapikan apa pun saat `headerRowHeight` 0 — DSG
   *  asli yang berhenti merender kepala kolom — jadi yang diperiksa di sini
   *  justru nilai prop itu lewat `top`. */
  function topBarisPertama(): string {
    const semua = document.querySelectorAll('.dsg-row');
    // Lewati baris kepala kolom (index 0) dan cari baris data pertama yang
    // punya `top` — skeleton "TabelMemuat" juga memakai kelas `dsg-row`.
    for (const el of Array.from(semua) as HTMLElement[]) {
      if (el.style.top !== '') return el.style.top;
    }
    return '(tak ada)';
  }

  it('bawaan (tak ada penanda): semua komponen tampil seperti sebelumnya', async () => {
    const { container } = renderTabel({
      tengah: <span>Info tengah uji</span>,
      pager: <span>Pager uji</span>,
      filter: <span>Filter uji</span>,
    });
    await waitFor(() => expect(screen.getByText('Ahmad')).toBeInTheDocument());
    expect(container.querySelector('[data-part="header_tabel"]')).not.toBeNull();
    expect(screen.getByText('Uji')).toBeInTheDocument();
    expect(screen.getByText('Info tengah uji')).toBeInTheDocument();
    expect(screen.getByText('Filter uji')).toBeInTheDocument();
    expect(screen.getByText('Pager uji')).toBeInTheDocument();
    expect(container.querySelector('[data-part="kaki_tabel"]')).not.toBeNull();
    // Kepala kolom tetap setinggi DEFAULT_HEADER_H (26), jadi baris data
    // pertama digeser sebesar itu.
    expect(topBarisPertama()).toBe('26px');
  });

  it('judul tabel dimatikan → teks judul hilang, bilah & komponen lain tetap', async () => {
    serverToolbar.state.visibilitas = { judul_tabel: false };
    const { container } = renderTabel();
    await waitFor(() => expect(screen.getByText('Ahmad')).toBeInTheDocument());
    expect(screen.queryByText('Uji')).toBeNull();
    expect(container.querySelector('[data-part="header_tabel"]')).not.toBeNull();
    expect(document.getElementById('select_preset_kolom_uji')).not.toBeNull();
  });

  it('slot filter dimatikan → hanya slot filter yang hilang, bukan bilah judul', async () => {
    serverToolbar.state.visibilitas = { filter: false };
    const { container } = renderTabel({ filter: <span>Filter uji</span> });
    await waitFor(() => expect(screen.getByText('Ahmad')).toBeInTheDocument());
    expect(screen.queryByText('Filter uji')).toBeNull();
    expect(container.querySelector('[data-part="header_tabel"]')).not.toBeNull();
    expect(screen.getByText('Uji')).toBeInTheDocument();
  });

  it('seluruh komponen bilah judul dimatikan → bilah judul ikut hilang', async () => {
    // Bilah tak perlu dibungkus kalau isinya sudah tak ada satu pun. Gerigi
    // "Pengaturan tabel ini" juga harus ikut dimatikan — dialah satu-satunya
    // pintu Kelola Tabel dari tabel ini.
    serverToolbar.state.visibilitas = {
      judul_tabel: false, urutan: false, kolom: false, filter: false,
      tombol_aksi: false, tombol_pengaturan: false,
    };
    const { container } = renderTabel({ onUrut: vi.fn(), filter: <span>Filter uji</span> });
    await waitFor(() => expect(screen.getByText('Ahmad')).toBeInTheDocument());
    expect(container.querySelector('[data-part="header_tabel"]')).toBeNull();
    expect(screen.queryByText('Uji')).toBeNull();
  });

  it('gerigi Pengaturan tabel menyalakan bilah judul lagi walau semua komponen mati', async () => {
    serverToolbar.state.visibilitas = {
      judul_tabel: false, urutan: false, kolom: false, filter: false, tombol_aksi: false,
    };
    const { container } = renderTabel({ onUrut: vi.fn(), filter: <span>Filter uji</span> });
    await waitFor(() => expect(screen.getByText('Ahmad')).toBeInTheDocument());
    // Gerigi hidup → bilah judul tetap ada walau isinya cuma gerigi itu.
    expect(container.querySelector('[data-part="header_tabel"]')).not.toBeNull();
    expect(document.getElementById('btn_pengaturan_tabel_uji')).not.toBeNull();
  });

  it('info tengah dimatikan → pil info hilang, judul & toolbar tetap', async () => {
    serverToolbar.state.visibilitas = { info_tengah: false };
    const { container } = renderTabel({ tengah: <span>Info tengah uji</span> });
    await waitFor(() => expect(screen.getByText('Ahmad')).toBeInTheDocument());
    expect(screen.queryByText('Info tengah uji')).toBeNull();
    expect(container.querySelector('[data-part="header_tabel"]')).not.toBeNull();
    expect(screen.getByText('Uji')).toBeInTheDocument();
  });

  it('rel filter dimatikan → rel tingkat-kelas hilang', async () => {
    serverToolbar.state.visibilitas = { rel_filter: false };
    renderTabelRel();
    await waitFor(() => expect(screen.getByText('Ahmad')).toBeInTheDocument());
    expect(screen.queryByTestId('rel_filter')).toBeNull();
  });

  it('rel filter tetap tampil pada tabel yang punya rel dan tak ada penanda', async () => {
    renderTabelRel();
    await waitFor(() => expect(screen.getByTestId('rel_filter')).toBeInTheDocument());
  });

  it('header kolom dimatikan → tinggi kepala kolom 0, jadi DSG tak merendernya', async () => {
    serverToolbar.state.visibilitas = { header_kolom: false };
    renderTabel();
    await waitFor(() => expect(screen.getByText('Ahmad')).toBeInTheDocument());
    // `top` baris data pertama jadi 0 → `headerRowHeight` 0, dan itulah yang
    // membuat DSG asli tak merender kepala kolom sama sekali (bukan sekadar
    // tak terlihat, yang menyisakan celah setinggi header di atas grid).
    expect(topBarisPertama()).toBe('0px');
  });

  it('pager dimatikan → hanya pager hilang, tombol kaki tabel tetap', async () => {
    serverToolbar.state.visibilitas = { pager: false };
    const { container } = renderTabel({ pager: <span>Pager uji</span> });
    await waitFor(() => expect(screen.getByText('Ahmad')).toBeInTheDocument());
    expect(screen.queryByText('Pager uji')).toBeNull();
    // Tombol Edit (halaman uji `canEdit`) masih mengisi kaki tabel. Gerigi
    // Pengaturan tabel tak lagi ada di kaki — ia di bilah judul.
    expect(container.querySelector('[data-part="kaki_tabel"]')).not.toBeNull();
    expect(document.getElementById('btn_mode_edit_uji')).not.toBeNull();
    expect(container.querySelector('[data-part="kaki_tabel"]')?.querySelector('#btn_pengaturan_tabel_uji')).toBeNull();
    expect(document.getElementById('btn_pengaturan_tabel_uji')).not.toBeNull();
  });

  it('gerigi Pengaturan tabel dimatikan → hanya gerigi hilang', async () => {
    serverToolbar.state.visibilitas = { tombol_pengaturan: false };
    renderTabel({ onCreateRow: vi.fn(async () => {}) });
    await waitFor(() => expect(screen.getByText('Ahmad')).toBeInTheDocument());
    expect(document.getElementById('btn_pengaturan_tabel_uji')).toBeNull();
    expect(document.getElementById('btn_tambah_baris_uji')).not.toBeNull();
    expect(document.getElementById('btn_mode_edit_uji')).not.toBeNull();
  });

  it('setiap tombol kaki tabel punya sakelarnya sendiri', async () => {
    // Mematikan "Edit" tak boleh ikut menghilangkan tombol tambah.
    serverToolbar.state.visibilitas = { tombol_edit: false };
    renderTabel({ onCreateRow: vi.fn(async () => {}) });
    await waitFor(() => expect(screen.getByText('Ahmad')).toBeInTheDocument());
    expect(document.getElementById('btn_tambah_baris_uji')).not.toBeNull();
    expect(document.getElementById('btn_mode_edit_uji')).toBeNull();
  });

  it('seluruh komponen kaki tabel dimatikan → kaki tabel ikut hilang', async () => {
    serverToolbar.state.visibilitas = {
      pager: false, tombol_tambah: false, tombol_edit: false,
    };
    const { container } = renderTabel({ pager: <span>Pager uji</span>, canEdit: false });
    await waitFor(() => expect(screen.getByText('Ahmad')).toBeInTheDocument());
    expect(container.querySelector('[data-part="kaki_tabel"]')).toBeNull();
    // Gerigi tetap ada karena ia hidup di bilah judul.
    expect(document.getElementById('btn_pengaturan_tabel_uji')).not.toBeNull();
  });

  it('kontrol milik halaman di bilah judul tak bisa dimatikan lewat sakelar tabel', async () => {
    // `awalanToolbar` milik halaman, tak punya sakelar — bilah judul tetap ada
    // walau seluruh komponen tabelnya dimatikan, jangan sampai kontrol
    // halaman ikut hilang diam-diam.
    serverToolbar.state.visibilitas = {
      judul_tabel: false, urutan: false, kolom: false, filter: false, tombol_aksi: false,
    };
    const { container } = renderTabel({
      onUrut: vi.fn(),
      awalanToolbar: <span>Awalan halaman</span>,
    });
    await waitFor(() => expect(screen.getByText('Ahmad')).toBeInTheDocument());
    expect(container.querySelector('[data-part="header_tabel"]')).not.toBeNull();
    expect(screen.getByText('Awalan halaman')).toBeInTheDocument();
  });

  /** Jumlah checkbox per baris (`CheckCell` merender `input.dsg-checkbox`) —
   *  kolom centang punya satu per baris, kolom lain tak punya. */
  function kotakCentang(): number {
    return document.querySelectorAll('input.dsg-checkbox').length;
  }

  it('bawaannya kolom centang & Aksi tampil', async () => {
    renderTabel();
    await waitFor(() => expect(screen.getByText('Ahmad')).toBeInTheDocument());
    // 2 baris data → 2 checkbox centang + "pilih semua" di kepala kolom.
    expect(kotakCentang()).toBe(2);
    expect(screen.getByLabelText('Pilih semua baris')).toBeInTheDocument();
    expect(screen.getAllByText('Aksi-uji')).toHaveLength(2);
  });

  it('sakelar kolom centang & Aksi menyembunyikan kolomnya', async () => {
    serverToolbar.state.visibilitas = { kolom_centang: false, kolom_aksi: false };
    renderTabel();
    await waitFor(() => expect(screen.getByText('Ahmad')).toBeInTheDocument());
    // Kolom centang: tak ada checkbox baris maupun "pilih semua" di header.
    expect(kotakCentang()).toBe(0);
    expect(screen.queryByLabelText('Pilih semua baris')).toBeNull();
    // Kolom Aksi: tombol aksi per baris ikut hilang.
    expect(screen.queryByText('Aksi-uji')).toBeNull();
  });

  it('mematikan hanya kolom centang tak ikut menghilangkan kolom Aksi', async () => {
    serverToolbar.state.visibilitas = { kolom_centang: false };
    renderTabel();
    await waitFor(() => expect(screen.getByText('Ahmad')).toBeInTheDocument());
    expect(kotakCentang()).toBe(0);
    expect(screen.getAllByText('Aksi-uji')).toHaveLength(2);
  });

  it('prop hideCheckbox halaman menang atas sakelar tabel', async () => {
    // Halaman sudah memaksa sembunyi, jadi sakelarnya tak ada artinya dan
    // kolom centang tetap tak dirender walau peta server kosong.
    renderTabel({ hideCheckbox: true });
    await waitFor(() => expect(screen.getByText('Ahmad')).toBeInTheDocument());
    expect(kotakCentang()).toBe(0);
    expect(screen.getAllByText('Aksi-uji')).toHaveLength(2);
  });
});

describe('ExcelTable — klik kanan baris', () => {
  /** Elemen baris grid yang memuat teks tertentu. Cakupannya dibatasi ke
   *  container tabel: span pengukur AutoFit di luar container ikut memuat
   *  nilai sel yang sama. */
  function baris(root: HTMLElement, nama: string): HTMLElement {
    const el = within(root).getByText(nama).closest('.dsg-row');
    expect(el).not.toBeNull();
    return el as HTMLElement;
  }

  it('menu konteks baris kedua menunjuk baris itu sendiri, bukan baris berikutnya', async () => {
    const { container } = renderTabel();

    fireEvent.contextMenu(baris(container, 'Budi'));

    const menu = await screen.findByRole('menu');
    expect(menu).toHaveTextContent('Budi');
    expect(menu).not.toHaveTextContent('Ahmad');
  });

  it('klik kanan pada baris terakhir tetap membuka menu', async () => {
    const { container } = renderTabel();

    fireEvent.contextMenu(baris(container, 'B-02'));

    const menu = await screen.findByRole('menu');
    expect(menu).toHaveTextContent('Budi');
  });

  it('klik kanan satu sel tanpa seleksi tetap menawarkan aksi blok', async () => {
    const onIsiBlok = vi.fn();
    const { container } = renderTabel({ onIsiBlok, blokAksiLabel: 'Isi mapel & guru…' });
    await waitFor(() => expect(screen.getByText('Ahmad')).toBeInTheDocument());

    const sel = within(container).getByText('Ahmad').closest('.dsg-cell') as HTMLElement;
    fireEvent.contextMenu(sel);

    const menu = await screen.findByRole('menu');
    expect(menu).toHaveTextContent('BLOK 1 SEL');
    await userEvent.click(screen.getByText('Isi mapel & guru…'));

    const [blokRows, blokFields] = onIsiBlok.mock.calls[0] as [Baris[], { key: string }[]];
    expect(blokRows).toEqual([rows[0]]);
    expect(blokFields.map((f) => f.key)).toEqual(['nama']);
  });

  it('klik kanan di area sel (bukan teks) tetap menawarkan aksi blok', async () => {
    const onIsiBlok = vi.fn();
    const { container } = renderTabel({ onIsiBlok, blokAksiLabel: 'Isi mapel & guru…' });
    await waitFor(() => expect(screen.getByText('Ahmad')).toBeInTheDocument());

    // Seleksi 2 baris × 2 kolom data (nama + kode), lalu klik kanan pada
    // PEMBUNGKUS sel (area padding) yang tidak membawa `data-col-key`.
    act(() => dsgStub.seleksi?.({
      selection: { min: { row: 0, col: 1 }, max: { row: 1, col: 2 } },
    }));
    const sel = within(container).getByText('Ahmad').closest('.dsg-cell') as HTMLElement;
    fireEvent.contextMenu(sel);

    const menu = await screen.findByRole('menu');
    expect(menu).toHaveTextContent('BLOK 4 SEL');
    await userEvent.click(screen.getByText('Isi mapel & guru…'));

    const [blokRows, blokFields] = onIsiBlok.mock.calls[0] as [Baris[], { key: string }[]];
    expect(blokRows).toHaveLength(2);
    expect(blokFields.map((f) => f.key)).toEqual(['nama', 'kode']);
  });
});

describe('penanda kelas grid yang dibaca CSS', () => {
  /** CSS index.css memakai `simpes-dsg-bleed` untuk tahu tepi kiri grid ada di
   *  luar bingkai panel (pasangan `-mx-1`) — kalau penanda ini lepas dari
   *  kondisinya, aturan tepi kiri tabel di panel jadi salah sasaran. */
  const kelasGrid = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('.simpes-dsg')?.className ?? '';

  it('tanpa bar judul (mis. hidePreset): grid bleed — `-mx-1` + penanda `simpes-dsg-bleed`', () => {
    const { container } = renderTabel({ hidePreset: true });
    expect(kelasGrid(container)).toContain('-mx-1');
    expect(kelasGrid(container)).toContain('simpes-dsg-bleed');
  });

  it('bar judul tampil: tak bleed, penandanya ikut hilang', () => {
    const { container } = renderTabel();
    expect(kelasGrid(container)).not.toContain('simpes-dsg-bleed');
  });

});

describe('ExcelTable — tombol ikon kaki tabel', () => {
  it('tombol "Tambah baris" hanya tampil bila ada onCreateRow, dan kliknya menyalakan mode Input', async () => {
    const { unmount } = renderTabel();
    expect(screen.queryByLabelText('Tambah baris baru')).not.toBeInTheDocument();
    unmount();

    renderTabel({ onCreateRow: vi.fn(async () => {}) });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Tambah baris baru'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Mode Input aktif'));
    // Digantikan baris isian di ujung bawah grid.
    expect(screen.queryByLabelText('Tambah baris baru')).not.toBeInTheDocument();
  });

  it('tombol mode Edit menyalakan mode Edit', async () => {
    renderTabel();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Aktifkan mode Edit'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Mode Edit aktif'));
    expect(screen.queryByLabelText('Aktifkan mode Edit')).not.toBeInTheDocument();
  });
});

describe('ExcelTable — tinggi grid mengisi sisa ruang', () => {
  /** jsdom tak punya layout; tiru tinggi elemen lewat getter `clientHeight`.
   *  Wrapper grid (`.simpes-dsg`) 203 px, elemen lain 231 px — selisih 28 px itu
   *  tinggi bilah judul yang jadi jebakan saat mengukur PARENT. */
  async function denganTinggiTiruan(fn: () => Promise<void>) {
    const asli = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains('simpes-dsg') ? 203 : 231;
      },
    });
    try {
      await fn();
    } finally {
      if (asli) Object.defineProperty(HTMLElement.prototype, 'clientHeight', asli);
    }
  }

  it('pakai ruang wrapper, bukan parent yang ikut menghitung bilah judul', async () => {
    await denganTinggiTiruan(async () => {
      // `container`: pengukuran AutoFit juga memakai simpul `.simpes-dsg` di luar
      // pohon ini, jadi kueri harus dibatasi ke wadah hasil render.
      const { container } = renderTabel();
      const wrap = container.querySelector('.simpes-dsg') as HTMLElement;
      const kartu = wrap.querySelector('.simpes-dsg-kartu') as HTMLElement;

      // Tinggi kartu = ruang wrapper (203), bukan tinggi parent (231, sudah
      // termasuk bilah judul) — kalau 231 dipakai, 28 px tabel meluber ke bawah.
      await waitFor(() => expect(kartu.style.height).toBe('203px'));
    });
  });

  it('wrapper mode isi-penuh tanpa lantai tinggi tetap', () => {
    const { container } = renderTabel();
    const kelas = (container.querySelector('.simpes-dsg') as HTMLElement).className;

    // Lantai `min-h-[280px]` menahan wrapper saat panel resizable lebih pendek
    // dari 280 px sehingga kartu melewati dasar panel.
    expect(kelas).not.toContain('min-h-[280px]');
    expect(kelas).toContain('min-h-0');
    expect(kelas).toContain('flex-1');
  });

  it('tabel kompak (maxRows) tetap mengikuti isi, bukan ruang kosong', () => {
    const { container } = renderTabel({ maxRows: 3 });
    const kelas = (container.querySelector('.simpes-dsg') as HTMLElement).className;
    expect(kelas).toContain('shrink-0');
  });
});

describe('ExcelTable — klik ganda sel', () => {
  it('klik ganda sel memunculkan pill Mode Edit', async () => {
    renderTabel();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // Mode Edit dinyalakan lewat klik ganda sel.
    fireEvent.doubleClick(screen.getByText('Ahmad'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Mode Edit aktif'));
  });
});

/* Gerigi PALING KANAN bilah judul = pengaturan khusus TABEL INI saja. Setelan
   global punya pintunya sendiri di TopBar; keduanya sengaja dipisah supaya
   jangkauannya jelas. */
describe('ExcelTable — gerigi pengaturan tabel', () => {
  it('menonaktifkan gerigi bila halaman ini tak mendaftarkan tabelnya', async () => {
    // Tanpa registrasi, DialogKelolaTabel tak akan terisi - jadi pintunya
    // dimatikan daripada membuka dialog kosong.
    renderTabel({});
    const gerigi = await screen.findByRole('button', { name: 'Pengaturan tabel ini' });
    expect(gerigi).toBeDisabled();
  });

  it('tidak menawarkan setelan global di kaki tabel', async () => {
    // Setelan global ada di gerigi TopBar; menu di sini akan menyesatkan.
    renderTabel({});
    expect(screen.queryByText('Semua tabel')).not.toBeInTheDocument();
    expect(screen.queryByText('Tampilan global')).not.toBeInTheDocument();
  });
});

describe('ExcelTable — sel statis kustom', () => {
  it('merender isi kustom dan meneruskan klik sel', async () => {
    const onCellClick = vi.fn();
    renderDenganTema(
      <ExcelTable<Baris>
        tableKey="uji_statis"
        fields={[
          { key: 'nama', label: 'Nama', kind: 'text' },
          {
            key: 'kode',
            label: 'Kode',
            kind: 'static',
            renderCell: (g) => <span data-testid={`kode_${g.id}`}>Kode {g.kode}</span>,
            onCellClick,
          },
        ]}
        rows={rows}
        getValues={getValues}
        canEdit={false}
        onCommit={async () => {}}
        onSaved={() => {}}
        renderActions={() => null}
        hideCheckbox
        hideActions
      />,
    );

    expect(screen.getByTestId('kode_1')).toHaveTextContent('Kode A-01');
    await userEvent.click(screen.getByTestId('kode_1'));
    expect(onCellClick).toHaveBeenCalledWith('1');
  });
});
