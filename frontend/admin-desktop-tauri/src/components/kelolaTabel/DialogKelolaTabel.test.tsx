import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import DialogKelolaTabel from './DialogKelolaTabel';
import { listPresetTabel, setPresetAktif } from '@/api/preset';
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
  // TabKolom memakai create/update/delete preset: tanpa ketiganya di sini,
  // simpan preset melempar sebelum sempat menyimpan setelan per tabel.
  createPresetTabel: vi.fn(async () => ({ pesan: 'ok', data: [{ id: 9 }] })),
  updatePresetTabel: vi.fn(async () => ({ pesan: 'ok', data: [{ id: 7 }] })),
  deletePresetTabel: vi.fn(async () => ({ pesan: 'ok', data: null })),
}));

/** Tiruan server stateful untuk preset toolbar: `visibilitas` bisa disemai
 *  per tes, dan `simpan` benar-benar mengubah yang dibaca `muat`. */
const serverToolbar = vi.hoisted(() => {
  const state = { visibilitas: {} as Record<string, boolean> };
  const muat = vi.fn(async () => ({
    pesan: 'ok',
    data: { table_key: 'uji', visibilitas: { ...state.visibilitas }, lebar: {}, urutan: [], align: {} },
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
  hapusToolbarPreset: vi.fn(async () => ({ pesan: 'ok', data: null })),
}));

vi.mock('@/api/client', async (asli) => ({
  ...(await asli()),
  prefGet: vi.fn(async () => null),
  prefSet: vi.fn(async () => {}),
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
};

beforeEach(() => {
  serverToolbar.state.visibilitas = {};
  vi.clearAllMocks();
});

describe('DialogKelolaTabel — tab Umum', () => {
  it('menampilkan identitas tabel: kunci, jumlah kolom, preset aktif & bawaan', async () => {
    renderDialog();
    await waitFor(() => expect(document.getElementById('nilai_umum_kunci_uji')).toBeInTheDocument());
    expect(document.getElementById('nilai_umum_kunci_uji')).toHaveTextContent('uji');
    expect(document.getElementById('nilai_umum_jumlah_kolom_uji')).toHaveTextContent('2');
    // Preset aktif = id 7 "Preset Uji"; bawaan = null → '—'.
    await waitFor(() => expect(document.getElementById('nilai_umum_preset_aktif_uji')).toHaveTextContent('Preset Uji'));
    expect(document.getElementById('nilai_umum_preset_bawaan_uji')).toHaveTextContent('—');
  });

  it('menampilkan kontrol tampilan perangkat: kolom beku + baris ikut isi', async () => {
    renderDialog();
    await waitFor(() => expect(screen.getByLabelText('Kolom beku dari kiri')).toBeInTheDocument());
    expect(screen.getByLabelText('Kolom beku dari kiri')).toHaveValue(0);
    expect(screen.getByRole('switch', { name: /Baris ikut isi/ })).not.toBeChecked();
    expect(screen.getByText('Hanya di perangkat ini — pengguna lain tidak ikut berubah.')).toBeInTheDocument();
  });

  it('menampilkan tombol kembalikan bawaan dengan konfirmasi', async () => {
    renderDialog();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Kembalikan tabel ini' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Kembalikan tabel ini' }));
    // ConfirmDelete membuka alertdialog berisi deskripsi + tombol Kembalikan.
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Kembalikan' })).toBeInTheDocument();
  });
});

describe('DialogKelolaTabel — sinkronisasi preset dari luar', () => {
  it('memuat ulang daftar preset saat menerima EVENT_PRESET_BERUBAH tabel ini', async () => {
    const muat = vi.mocked(listPresetTabel);
    renderDialog();
    // Dialog (useKelolaKolom) + tab Umum masing-masing memuat sekali.
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
  it('hanya ada tiga tab: Umum, Kolom, Urutan (tab Filter Tabel sudah dihapus)', () => {
    renderDialog(LENGKAP);
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent?.replace(/\s+/g, ' ').trim());
    expect(tabs).toEqual(['Umum', 'Kolom', 'Urutan']);
    // Sakelar filter toolbar pindah ke tab Umum, jadi tak ada tab Filter lagi.
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
    // Tab Umum aktif bawaan; panel Kolom ikut ter-mount tapi tidak aktif.
    await waitFor(() => expect(screen.getByLabelText('Umum')).toBeInTheDocument());
    const kolom = screen.getByLabelText('Kolom');
    expect(within(kolom).getByText(/Nama Lengkap/)).toBeInTheDocument();
    // Panel tab lain tetap ter-render (forceMount, supaya state tidak hilang)
    // tapi ditandai tidak aktif; sembunyannya_guard CSS `data-[state=inactive]:hidden`.
    const panel = screen.getByLabelText('Urutan').closest('[data-slot="tabs-content"]');
    expect(panel).toHaveAttribute('data-state', 'inactive');
    expect(panel?.className).toContain('data-[state=inactive]:hidden');
    expect(screen.getByLabelText('Kolom').closest('[data-slot="tabs-content"]'))
      .toHaveAttribute('data-state', 'inactive');
  });

  it('berpindah tab saat tab lain diklik', async () => {
    renderDialog();
    await waitFor(() => expect(screen.getByLabelText('Umum')).toBeInTheDocument());
    // Radix TabsTrigger aktif pada mousedown, bukan click — pakai userEvent.
    await userEvent.click(screen.getByRole('tab', { name: /^Kolom/ }));
    await waitFor(() => expect(screen.getByLabelText('Kolom')).toBeVisible());
    expect(screen.getByLabelText('Umum').closest('[data-slot="tabs-content"]'))
      .toHaveAttribute('data-state', 'inactive');
  });

  it('pindah tab tidak membuang bagian yang sudah diisi', async () => {
    renderDialog(LENGKAP);
    await waitFor(() => expect(panelNamaPerataan()).toBeInTheDocument());
    // Sakelar di tab Umum: bagian yang TIDAK ikut tersimpan saat diketik, jadi
    // inilah yang perlu dibuktikan tidak hilang saat pindah tab.
    const sakelar = screen.getByLabelText('Tampilkan Kolom');
    await userEvent.click(sakelar);

    await userEvent.click(screen.getByRole('tab', { name: /^Kolom/ }));
    await waitFor(() => expect(panelNamaPerataan()).toBeVisible());
    await userEvent.click(screen.getByRole('tab', { name: /^Umum/ }));

    // Panel `forceMount`, jadi state bagian bertahan (bukan di-remount).
    await waitFor(() => expect(screen.getByLabelText('Tampilkan Kolom')).not.toBeChecked());
  });
});

describe('DialogKelolaTabel — tersimpan sendiri (tanpa tombol Simpan)', () => {
  it('menyatakan semua tersimpan saat belum ada perubahan, tanpa tombol Simpan', async () => {
    renderDialog();
    await waitFor(() => expect(screen.getByLabelText('Kolom')).toBeInTheDocument());
    expect(screen.getByText(/Semua perubahan tersimpan/)).toBeInTheDocument();
    // Tak ada lagi tombol Simpan: perubahan diterapkan saat diubah.
    expect(screen.queryByRole('button', { name: 'Simpan' })).not.toBeInTheDocument();
  });

  it('menyimpan sendiri saat nama kolom diubah (tanpa menekan Simpan)', async () => {
    renderDialog();
    await waitFor(() => expect(panelNamaPerataan()).toBeInTheDocument());
    // Hanya input yang TERLIHAT: panel lain ikut ter-mount (forceMount),
    // jadi `getByLabelText` bisa menemukan elemen tersembunyi.
    // 2 input (satu per baris kolom). Ambil yang pertama = "Nama Lengkap".
    const input = screen.getAllByLabelText(/Nama tampilan/)[0];
    fireEvent.change(input, { target: { value: 'Nama Baru' } });

    // Perubahan mengalir ke server tanpa aksi tambahan dari pengguna.
    await waitFor(() => expect(vi.mocked(simpanToolbarPreset)).toHaveBeenCalled());
    const panggilan = vi.mocked(simpanToolbarPreset).mock.calls.at(-1);
    expect(panggilan?.[4]).toEqual({ nama: 'Nama Baru' });
  });

  it('menandai tab yang belum tersimpan, termasuk tab tempat mengetik', async () => {
    renderDialog();
    await waitFor(() => expect(panelNamaPerataan()).toBeInTheDocument());
    const input = within(panelNamaPerataan()).getAllByRole('textbox')[0];
    fireEvent.change(input, { target: { value: 'Nama Baru' } });

    // Nama & perataan kini DI TAB YANG SAMA dengan pilihan kolom, jadi satu
    // penanda saja yang menyala - tak ada lagi dua tab yang menyala bersamaan.
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

    // Tiga grup, dan tiap komponen punya sakelarnya sendiri.
    for (const grup of ['Bilah judul', 'Kepala tabel', 'Kaki tabel']) {
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
      'Tampilkan Pager / jumlah baris',
      'Tampilkan Tombol Pengaturan tabel',
      'Tampilkan Tombol tinggi baris',
      'Tampilkan Tombol tambah baris',
      'Tampilkan Tombol Edit',
    ]) {
      await waitFor(() => expect(screen.getByLabelText(label)).toBeChecked());
    }
  });

  it('menyembunyikan sakelar komponen yang tak ada di tabel ini', async () => {
    // Tabel tanpa rel filter, pager, tombol tambah, dan info tengah.
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
    });
    await waitFor(() => expect(screen.getByText('Visibilitas komponen tabel')).toBeInTheDocument());
    expect(screen.queryByLabelText('Tampilkan Info tengah')).toBeNull();
    expect(screen.queryByLabelText('Tampilkan Filter tabel')).toBeNull();
    expect(screen.queryByLabelText('Tampilkan Rel filter di kiri grid')).toBeNull();
    expect(screen.queryByLabelText('Tampilkan Pager / jumlah baris')).toBeNull();
    expect(screen.queryByLabelText('Tampilkan Tombol tambah baris')).toBeNull();
    // Yang tetap ada: Urutan, Kolom, Judul, header kolom, dan 3 tombol kaki.
    expect(screen.getByLabelText('Tampilkan Urutan')).toBeInTheDocument();
    expect(screen.getByLabelText('Tampilkan Header kolom (kepala kolom)')).toBeInTheDocument();
    expect(screen.getByLabelText('Tampilkan Tombol Pengaturan tabel')).toBeInTheDocument();
  });

  it('mematikan komponen → langsung menulis peta merge, penanda lain utuh', async () => {
    // Peta server sudah punya penanda versi lama; penulisan visibilitas
    // komponen tak boleh menghapusnya (satu peta JSON dipakai bersama).
    serverToolbar.state.visibilitas = { urut: false };
    renderDialog(LENGKAP);
    await waitFor(() => expect(screen.getByLabelText('Tampilkan Header kolom (kepala kolom)')).toBeChecked());

    await userEvent.click(screen.getByLabelText('Tampilkan Header kolom (kepala kolom)'));

    await waitFor(() => expect(simpanToolbar).toHaveBeenCalledWith('uji', {
      urut: false,
      header_kolom: false,
    }));
  });

  it('menyalakan lagi komponen → penanda "sembunyi" dihapus dari peta', async () => {
    serverToolbar.state.visibilitas = { tombol_edit: false };
    renderDialog(LENGKAP);
    await waitFor(() => expect(screen.getByLabelText('Tampilkan Tombol Edit')).not.toBeChecked());

    await userEvent.click(screen.getByLabelText('Tampilkan Tombol Edit'));

    // Absen = tampil, jadi kuncinya dihapus, bukan ditulis `true`.
    await waitFor(() => expect(simpanToolbar).toHaveBeenCalledWith('uji', {}));
  });

  it('Kembalikan ke bawaan → membuang hanya kunci milik komponen tabel', async () => {
    serverToolbar.state.visibilitas = { judul_tabel: false, header_kolom: false, urut: false };
    renderDialog(LENGKAP);
    await waitFor(() => expect(screen.getByLabelText('Tampilkan Judul tabel')).not.toBeChecked());

    await userEvent.click(screen.getByRole('button', { name: 'Kembalikan ke bawaan' }));

    // Penanda komponen tabel dibuang; penanda versi lama dipertahankan.
    await waitFor(() => expect(simpanToolbar).toHaveBeenCalledWith('uji', { urut: false }));
    await waitFor(() => expect(screen.getByLabelText('Tampilkan Judul tabel')).toBeChecked());
  });

  it('menandai tab Umum belum tersimpan saat sakelar visibilitas berubah', async () => {
    renderDialog(LENGKAP);
    await waitFor(() => expect(screen.getByLabelText('Tampilkan Tombol tinggi baris')).toBeChecked());

    await userEvent.click(screen.getByLabelText('Tampilkan Tombol tinggi baris'));

    await waitFor(() => expect(
      screen.getByRole('tab', { name: /^Umum \(belum tersimpan\)/ }),
    ).toBeInTheDocument());
  });
});