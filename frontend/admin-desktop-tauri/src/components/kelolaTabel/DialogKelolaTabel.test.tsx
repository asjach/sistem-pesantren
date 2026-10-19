import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import DialogKelolaTabel from './DialogKelolaTabel';
import { prefSet } from '@/api/client';
import { listPresetTabel } from '@/api/preset';
import { simpanToolbarPreset } from '@/api/toolbarPreset';
import { renderDenganTema } from '@/test/utils';
import { KOMPONEN_INFO_BEKAL, type InfoKomponenTabel } from '@/components/excel/komponenTabel';

vi.mock('@/api/preset', () => ({
  listPresetTabel: vi.fn(async () => ({
    pesan: 'ok',
    data: {
      presets: [
        {
          id: 7,
          jenjang: null,
          table_key: 'uji',
          nama: 'Preset Uji',
          kolom: ['nama', 'kode'],
          label: null,
          is_default: false,
          lembaga: null,
        },
      ],
      aktif_preset_id: 7,
      default_preset_id: null,
      aktif_kolom: null,
    },
  })),
  setPresetAktif: vi.fn(async () => ({ pesan: 'ok', data: null })),
  simpanPresetTabel: vi.fn(async () => ({ pesan: 'ok', data: { id: 9 } })),

  createPresetTabel: vi.fn(async () => ({ pesan: 'ok', data: [{ id: 9 }] })),
  updatePresetTabel: vi.fn(async () => ({ pesan: 'ok', data: [{ id: 7 }] })),
  deletePresetTabel: vi.fn(async () => ({ pesan: 'ok', data: null })),
}));

/** Tiruan server stateful untuk preset toolbar: `visibilitas` bisa disemai
 *  per tes, dan `simpan` benar-benar mengubah yang dibaca `muat`. */
const serverToolbar = vi.hoisted(() => {
  const state = {
    visibilitas: {} as Record<string, boolean>,
    judul: null as string | null,
    infoHtml: null as string | null,
  };
  /** Bila diisi, `simpan` MENUNGGU promise ini selesai sebelum kembali.
   *  Dipakai tes indikator untuk mengatur urutan penyelesaian (balapan). */
  let tahan: Promise<void> | null = null;
  let lepasTahan: (() => void) | null = null;
  const muat = vi.fn(async () => ({
    pesan: 'ok',
    data: {
      table_key: 'uji',
      visibilitas: { ...state.visibilitas },
      lebar: {},
      urutan: [],
      align: {},
      judul: state.judul,
      info_html: state.infoHtml,
    },
  }));

  const simpan = vi.fn(async (
    _t: string,
    v?: Record<string, boolean>,
    _u?: string[],
    _a?: unknown,
    _l?: unknown,
    judul?: string,
    infoHtml?: string,
  ) => {
    if (v !== undefined) state.visibilitas = { ...v };
    if (judul !== undefined) state.judul = judul.trim() === '' ? null : judul.trim();
    if (infoHtml !== undefined) state.infoHtml = infoHtml === '' ? null : infoHtml;
    if (tahan) await tahan;
    return { pesan: 'ok', data: null };
  });
  /** Tahan semua simpan berikutnya sampai `lepas()` dipanggil. */
  const tahanSimpan = () => {
    tahan = new Promise<void>((resolve) => { lepasTahan = resolve; });
  };
  const lepas = () => { const r = lepasTahan; tahan = null; lepasTahan = null; r?.(); };
  return { state, muat, simpan, tahanSimpan, lepas };
});

vi.mock('@/api/toolbarPreset', () => ({
  muatToolbarPreset: serverToolbar.muat,
  simpanToolbarPreset: serverToolbar.simpan,
  hapusToolbarPreset: vi.fn(async () => ({ pesan: 'ok', data: null })),
}));

/** Tiruan pref PERANGKAT yang stateful (seperti `serverToolbar` di bawah):
 *  nilai yang ditulis `prefSet` benar-benar terbaca `prefGet`. Tanpa ini,
 *  event "tampilan perangkat berubah" (yang dikirim tiap perubahan kolom
 *  beku/tinggi baris) memuat ulang pref dan mengembalikan nilainya ke 0. */
const serverPref = vi.hoisted(() => {
  const state: Record<string, string> = {};
  return {
    state,
    get: vi.fn(async (k: string) => state[k] ?? null),
    set: vi.fn(async (k: string, v: string) => { state[k] = v; }),
    bersihkan: () => { for (const k of Object.keys(state)) delete state[k]; },
  };
});

vi.mock('@/api/client', async (asli) => ({
  ...(await asli()),
  prefGet: serverPref.get,
  prefSet: serverPref.set,
}));

vi.mock('@/lembagaAktif', async (asli) => ({
  ...(await asli()),
  useLembagaAktif: () => ({ efektifSuper: true }),
}));

const toastSuccessMock = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccessMock(...a),
    error: vi.fn(),
  },
}));

const fields = [
  { key: 'nama', label: 'Nama Lengkap', kind: 'static' as const },
  { key: 'kode', label: 'Kode', kind: 'static' as const },
];

function renderDialog(infoKomponen: InfoKomponenTabel = KOMPONEN_INFO_BEKAL) {
  return renderDenganTema(
    <DialogKelolaTabel
      open
      onOpenChange={() => {}}
      tableKey="uji"
      judul="Santri"
      fields={fields}
      infoKomponen={infoKomponen}
    />,
  );
}

/** Panel tab "Kolom" — memuat pilihan kolom SEKALIGUS nama & perataan,
 *  karena keduanya setelan per tabel (bukan per preset). */
function panelNamaPerataan() {
  return screen.getByLabelText('Kolom');
}

/** Info komponen tabel yang punya segalanya — daftar sakelar terpanjang. */
const LENGKAP: InfoKomponenTabel = {
  adaBilahJudul: true,
  infoTengah: true,
  filter: true,
  cari: true,
  keaktifan: true,
  urut: true,
  kolom: true,
  tombolAksi: true,
  relFilter: true,
  pager: true,
  tombolTambah: true,
  tombolEdit: true,
  kolomCentang: true,
  kolomAksi: true,
};

beforeEach(() => {
  serverToolbar.state.visibilitas = {};
  serverToolbar.state.infoHtml = null;
  serverPref.bersihkan();
  vi.clearAllMocks();
});

describe('DialogKelolaTabel — tab Umum', () => {
  it('menampilkan identitas tabel: kunci, jumlah kolom, preset aktif & bawaan', async () => {
    renderDialog();
    await waitFor(() => expect(document.getElementById('nilai_umum_kunci_uji')).toBeInTheDocument());
    expect(document.getElementById('nilai_umum_kunci_uji')).toHaveTextContent('uji');
    expect(document.getElementById('nilai_umum_jumlah_kolom_uji')).toHaveTextContent('2');

    await waitFor(() => expect(document.getElementById('nilai_umum_preset_aktif_uji')).toHaveTextContent('Preset Uji'));
    expect(document.getElementById('nilai_umum_preset_bawaan_uji')).toHaveTextContent('—');
  });

  it('menampilkan kontrol tampilan perangkat: kolom beku + tinggi baris + baris ikut isi + isi lebar', async () => {
    renderDialog();
    await waitFor(() => expect(screen.getByLabelText('Kolom beku dari kiri')).toBeInTheDocument());

    expect(screen.getByLabelText('Kolom beku dari kiri')).toHaveValue('0');
    expect(document.getElementById('input_beku_uji_kurang')).not.toBeNull();
    expect(document.getElementById('input_beku_uji_tambah')).not.toBeNull();
    expect(screen.getByRole('switch', { name: /Baris ikut isi/ })).not.toBeChecked();

    expect(screen.getByRole('switch', { name: /Tabel mengisi lebar/ })).not.toBeChecked();
    expect(screen.getByText(/Semua di atas hanya di perangkat ini/)).toBeInTheDocument();
  });

  it('sakelar gestur tidak lagi ada di tab Umum', async () => {
    renderDialog();
    await waitFor(() => expect(screen.getByLabelText('Kolom beku dari kiri')).toBeInTheDocument());
    expect(screen.queryByRole('switch', { name: /Geser judul kolom/ })).toBeNull();
    expect(screen.queryByRole('switch', { name: /Seret isi sel/ })).toBeNull();
  });

  it('stepper kolom beku menyimpan pref tiap klik dan mati di batas jumlah kolom', async () => {
    renderDialog();
    const input = await screen.findByLabelText('Kolom beku dari kiri');
    const tombolTambah = () => document.getElementById('input_beku_uji_tambah') as HTMLButtonElement;

    const klikTambah = async () => {
      await waitFor(() => expect(tombolTambah()).not.toBeDisabled());
      fireEvent.click(tombolTambah());
    };

    await klikTambah();
    await waitFor(() => expect(prefSet).toHaveBeenCalledWith('simpes_grid_uji_freeze', '1'));
    await klikTambah();
    await waitFor(() => expect(prefSet).toHaveBeenCalledWith('simpes_grid_uji_freeze', '2'));
    expect(input).toHaveValue('2');
    await waitFor(() => expect(tombolTambah()).toBeDisabled());
  });

  it('menampilkan tombol kembalikan bawaan dengan konfirmasi', async () => {
    renderDialog();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Kembalikan tabel ini' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Kembalikan tabel ini' }));

    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Kembalikan' })).toBeInTheDocument();
  });
});

describe('DialogKelolaTabel — tab Info', () => {
  it('memuat info tersimpan ke editor', async () => {
    serverToolbar.state.infoHtml = '<p>Ketentuan tabel.</p>';
    renderDialog();
    await userEvent.click(screen.getByRole('tab', { name: /^Info/ }));

    const editor = await screen.findByLabelText('Isi info tabel');
    await waitFor(() => expect(editor.textContent).toContain('Ketentuan tabel.'));
  });

  it('mengetik di editor menyimpan HTML setelah jeda, bukan tiap ketukan', async () => {
    renderDialog();
    const editor = await screen.findByLabelText('Isi info tabel');

    editor.innerHTML = '<p>Ketentuan <strong>baru</strong>.</p>';
    fireEvent.input(editor);

    await waitFor(
      () => expect(serverToolbar.simpan).toHaveBeenCalledWith(
        'uji',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        '<p>Ketentuan <strong>baru</strong>.</p>',
      ),
      { timeout: 3000 },
    );
    expect(serverToolbar.state.infoHtml).toBe('<p>Ketentuan <strong>baru</strong>.</p>');
  });
});

describe('DialogKelolaTabel — sinkronisasi preset dari luar', () => {
  it('memuat ulang daftar preset saat menerima EVENT_PRESET_BERUBAH tabel ini', async () => {
    const muat = vi.mocked(listPresetTabel);
    renderDialog();

    await waitFor(() => expect(muat).toHaveBeenCalledTimes(2));

    await act(async () => {
      window.dispatchEvent(new CustomEvent('simpes:preset-berubah', { detail: { tableKey: 'uji' } }));
    });

    await waitFor(() => expect(muat).toHaveBeenCalledTimes(4));
  });

  it('mengabaikan event dari tabel lain', async () => {
    const muat = vi.mocked(listPresetTabel);
    renderDialog();
    await waitFor(() => expect(muat).toHaveBeenCalledTimes(2));

    await act(async () => {
      window.dispatchEvent(new CustomEvent('simpes:preset-berubah', { detail: { tableKey: 'tabel_lain' } }));
    });

    expect(muat).toHaveBeenCalledTimes(2);
  });
});

describe('DialogKelolaTabel — navigasi tab', () => {
  it('tab-nya Umum, Info, Kolom, Urutan (tab Filter Tabel sudah dihapus)', () => {
    renderDialog(LENGKAP);
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent?.replace(/\s+/g, ' ').trim());
    expect(tabs).toEqual(['Umum', 'Info', 'Kolom', 'Urutan']);

    expect(screen.queryByRole('tab', { name: /Filter Tabel/ })).not.toBeInTheDocument();
  });

  it('tab Umum aktif bawaan dan menampilkan identitas tabelnya', async () => {
    renderDialog();
    await waitFor(() => expect(screen.getByLabelText('Umum')).toBeInTheDocument());
    expect(document.getElementById('nilai_umum_kunci_uji')).toBeInTheDocument();
    expect(screen.getByLabelText('Umum').closest('[data-slot="tabs-content"]'))
      .toHaveAttribute('data-state', 'active');
  });

  it('hanya menampilkan isi tab yang aktif', async () => {
    renderDialog();

    await waitFor(() => expect(screen.getByLabelText('Umum')).toBeInTheDocument());
    const kolom = screen.getByLabelText('Kolom');
    expect(within(kolom).getByText(/Nama Lengkap/)).toBeInTheDocument();

    const panel = screen.getByLabelText('Urutan').closest('[data-slot="tabs-content"]');
    expect(panel).toHaveAttribute('data-state', 'inactive');
    expect(panel?.className).toContain('data-[state=inactive]:hidden');
    expect(screen.getByLabelText('Kolom').closest('[data-slot="tabs-content"]'))
      .toHaveAttribute('data-state', 'inactive');
  });

  it('berpindah tab saat tab lain diklik', async () => {
    renderDialog();
    await waitFor(() => expect(screen.getByLabelText('Umum')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('tab', { name: /^Kolom/ }));
    await waitFor(() => expect(screen.getByLabelText('Kolom')).toBeVisible());
    expect(screen.getByLabelText('Umum').closest('[data-slot="tabs-content"]'))
      .toHaveAttribute('data-state', 'inactive');
  });

  it('pindah tab tidak membuang bagian yang sudah diisi', async () => {
    renderDialog(LENGKAP);
    await waitFor(() => expect(panelNamaPerataan()).toBeInTheDocument());

    const sakelar = screen.getByLabelText('Tampilkan Kolom');
    await userEvent.click(sakelar);

    await userEvent.click(screen.getByRole('tab', { name: /^Kolom/ }));
    await waitFor(() => expect(panelNamaPerataan()).toBeVisible());
    await userEvent.click(screen.getByRole('tab', { name: /^Umum/ }));

    await waitFor(() => expect(screen.getByLabelText('Tampilkan Kolom')).not.toBeChecked());
  });
});

describe('DialogKelolaTabel — tersimpan sendiri (tanpa tombol Simpan)', () => {
  it('menyatakan semua tersimpan saat belum ada perubahan, tanpa tombol Simpan', async () => {
    renderDialog();
    await waitFor(() => expect(screen.getByLabelText('Kolom')).toBeInTheDocument());
    expect(screen.getByText(/Semua perubahan tersimpan/)).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Simpan' })).not.toBeInTheDocument();
  });

  it('menyimpan sendiri saat nama kolom diubah (tanpa menekan Simpan)', async () => {
    renderDialog();
    await waitFor(() => expect(panelNamaPerataan()).toBeInTheDocument());

    const input = screen.getAllByLabelText(/Nama tampilan/)[0];
    fireEvent.change(input, { target: { value: 'Nama Baru' } });

    await waitFor(() => expect(vi.mocked(simpanToolbarPreset)).toHaveBeenCalled());
    const panggilan = vi.mocked(simpanToolbarPreset).mock.calls.at(-1);
    expect(panggilan?.[4]).toEqual({ nama: 'Nama Baru' });
  });

  it('menandai tab yang belum tersimpan, termasuk tab tempat mengetik', async () => {
    renderDialog();
    await waitFor(() => expect(panelNamaPerataan()).toBeInTheDocument());
    const input = within(panelNamaPerataan()).getAllByRole('textbox')[0];
    fireEvent.change(input, { target: { value: 'Nama Baru' } });

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /^Kolom \(belum tersimpan\)/ })).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /Nama & Perataan/ })).not.toBeInTheDocument();
    });
  });
});

describe('DialogKelolaTabel — section Visibilitas komponen tabel (tab Umum)', () => {
  const simpanToolbar = vi.mocked(simpanToolbarPreset);

  it('menampilkan sakelar tiap komponen, dikelompokkan per bagian tabel', async () => {
    renderDialog(LENGKAP);
    await waitFor(() => expect(screen.getByText('Visibilitas komponen tabel')).toBeInTheDocument());

    for (const grup of ['Bilah judul', 'Kepala tabel', 'Kolom tetap', 'Kaki tabel']) {
      await waitFor(() => expect(screen.getByText(grup)).toBeInTheDocument());
    }
    for (const label of [
      'Tampilkan Judul tabel',
      'Tampilkan Info tengah',
      'Tampilkan Filter tabel',
      'Tampilkan Pencarian tabel',
      'Tampilkan Keaktifan / Status',
      'Tampilkan Urutan',
      'Tampilkan Kolom',
      'Tampilkan Tombol aksi utama',
      'Tampilkan Header kolom (kepala kolom)',
      'Tampilkan Rel filter di kiri grid',
      'Tampilkan Kolom centang',
      'Tampilkan Kolom Aksi',
      'Tampilkan Pager / jumlah baris',
      'Tampilkan Tombol Pengaturan tabel',
      'Tampilkan Tombol tambah baris',
      'Tampilkan Tombol Mode Ubah',
    ]) {
      await waitFor(() => expect(screen.getByLabelText(label)).toBeChecked());
    }
  });

  it('menyembunyikan sakelar komponen yang tak ada di tabel ini', async () => {

    renderDialog({
      adaBilahJudul: true,
      infoTengah: false,
      filter: false,
      cari: false,
      keaktifan: false,
      urut: true,
      kolom: true,
      tombolAksi: false,
      relFilter: false,
      pager: false,
      tombolTambah: false,
      tombolEdit: false,
      kolomCentang: false,
      kolomAksi: false,
    });
    await waitFor(() => expect(screen.getByText('Visibilitas komponen tabel')).toBeInTheDocument());
    expect(screen.queryByLabelText('Tampilkan Info tengah')).toBeNull();
    expect(screen.queryByLabelText('Tampilkan Filter tabel')).toBeNull();
    expect(screen.queryByLabelText('Tampilkan Rel filter di kiri grid')).toBeNull();
    expect(screen.queryByLabelText('Tampilkan Pager / jumlah baris')).toBeNull();
    expect(screen.queryByLabelText('Tampilkan Tombol tambah baris')).toBeNull();

    expect(screen.queryByLabelText('Tampilkan Kolom centang')).toBeNull();
    expect(screen.queryByLabelText('Tampilkan Kolom Aksi')).toBeNull();

    expect(screen.getByLabelText('Tampilkan Urutan')).toBeInTheDocument();
    expect(screen.getByLabelText('Tampilkan Header kolom (kepala kolom)')).toBeInTheDocument();
    expect(screen.getByLabelText('Tampilkan Tombol Pengaturan tabel')).toBeInTheDocument();
  });

  it('mematikan komponen → langsung menulis peta merge, penanda lain utuh', async () => {

    serverToolbar.state.visibilitas = { urut: false };
    renderDialog(LENGKAP);
    await waitFor(() => expect(screen.getByLabelText('Tampilkan Header kolom (kepala kolom)')).toBeChecked());

    await userEvent.click(screen.getByLabelText('Tampilkan Header kolom (kepala kolom)'));

    await waitFor(() => expect(simpanToolbar.mock.calls.at(-1)?.[1]).toEqual({
      urut: false,
      header_kolom: false,
    }));
  });

  it('menyalakan lagi komponen → penanda "sembunyi" dihapus dari peta', async () => {
    serverToolbar.state.visibilitas = { tombol_edit: false };
    renderDialog(LENGKAP);
    await waitFor(() => expect(screen.getByLabelText('Tampilkan Tombol Mode Ubah')).not.toBeChecked());

    await userEvent.click(screen.getByLabelText('Tampilkan Tombol Mode Ubah'));

    await waitFor(() => expect(simpanToolbar.mock.calls.at(-1)?.[1]).toEqual({}));
  });

  it('Kembalikan ke bawaan → membuang hanya kunci milik komponen tabel', async () => {
    serverToolbar.state.visibilitas = { judul_tabel: false, header_kolom: false, urut: false };
    renderDialog(LENGKAP);
    await waitFor(() => expect(screen.getByLabelText('Tampilkan Judul tabel')).not.toBeChecked());

    await userEvent.click(screen.getByRole('button', { name: 'Kembalikan ke bawaan' }));

    await waitFor(() => expect(simpanToolbar.mock.calls.at(-1)?.[1]).toEqual({ urut: false }));
    await waitFor(() => expect(screen.getByLabelText('Tampilkan Judul tabel')).toBeChecked());
  });

  it('menandai tab Umum belum tersimpan saat sakelar visibilitas berubah', async () => {
    renderDialog(LENGKAP);
    await waitFor(() => expect(screen.getByLabelText('Tampilkan Tombol Pengaturan tabel')).toBeChecked());

    await userEvent.click(screen.getByLabelText('Tampilkan Tombol Pengaturan tabel'));

    await waitFor(() => expect(
      screen.getByRole('tab', { name: /^Umum \(belum tersimpan\)/ }),
    ).toBeInTheDocument());
  });
});

describe('DialogKelolaTabel — menutup panel', () => {
  it('klik di luar panel menutupnya (varian non-modal dari tabel)', async () => {

    const onOpenChange = vi.fn();
    renderDenganTema(
      <DialogKelolaTabel
        open
        onOpenChange={onOpenChange}
        tableKey="uji"
        judul="Santri"
        fields={fields}
        nonModal
      />,
    );
    await waitFor(() => expect(screen.getByLabelText('Pengaturan tabel Santri')).toBeInTheDocument());

    await userEvent.click(document.body);

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
  it('input judul tersimpan dan judul kosong mengembalikan ke bawaan', async () => {
    serverToolbar.state.visibilitas = {};
    serverToolbar.state.judul = null;
    renderDialog();
    await waitFor(() => expect(screen.getByLabelText('Judul tabel')).toBeInTheDocument());

    const input = screen.getByLabelText('Judul tabel');

    expect(input).toHaveValue('');

    expect(input).toHaveAttribute('placeholder', 'Santri');

    await userEvent.type(input, 'Buku Induk Santri');
    await waitFor(() => expect(serverToolbar.state.judul).toBe('Buku Induk Santri'));

    await userEvent.clear(input);
    await waitFor(() => expect(serverToolbar.state.judul).toBeNull());
  });
});
