import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import DialogKelolaTabel from './DialogKelolaTabel';
import { listPresetTabel, setPresetAktif } from '@/api/preset';
import { simpanToolbarPreset } from '@/api/toolbarPreset';
import { renderDenganTema } from '@/test/utils';
import type { ModeSemuaFilterGlobal, TampilFilterGlobal } from '@/lib/filterHalaman';
import type { KunciFilterGlobal } from '@/components/VisibilitasFilter';
import type { KunciFilterToolbar } from '@/components/excel/filterTabel';

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

function renderDialog(
  filterRelevan: KunciFilterGlobal[] = [],
  opts: { filterTersedia?: KunciFilterToolbar[] } = {},
) {
  const tampil = (Object.fromEntries(
    filterRelevan.map((k) => [k, true]),
  ) ?? {}) as TampilFilterGlobal;
  const mode = (Object.fromEntries(
    filterRelevan.map((k) => [k, 'multiple']),
  ) ?? {}) as ModeSemuaFilterGlobal;

  return renderDenganTema(
    <DialogKelolaTabel
      open
      onOpenChange={() => {}}
      tableKey="uji"
      judul="Santri"
      fields={fields}
      filterTersedia={opts.filterTersedia ?? []}
    />,
  );
}

/** Panel tab "Kolom" — kini memuat pilihan kolom SEKALIGUS nama & perataan,
 *  karena keduanya setelan per tabel (bukan per preset). */
function panelNamaPerataan() {
  return screen.getByLabelText('Kolom');
}

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
  it('menampilkan tab Umum paling depan, lalu tiap bagian — dan tab Filter hanya bila ada filter', async () => {
    renderDialog();
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent?.replace(/\s+/g, ' ').trim());
    expect(tabs).toEqual(['Umum', 'Kolom', 'Urutan']);

    // Tab Umum aktif bawaan dan menampilkan identitas tabelnya.
    await waitFor(() => expect(screen.getByLabelText('Umum')).toBeInTheDocument());
    expect(document.getElementById('nilai_umum_kunci_uji')).toBeInTheDocument();
    expect(screen.getByLabelText('Umum').closest('[data-slot="tabs-content"]'))
      .toHaveAttribute('data-state', 'active');
  });

  it('menampilkan tab Filter di belakang bila tabel punya filter toolbar', async () => {
    renderDialog([], { filterTersedia: ['urutan', 'kolom'] });
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent?.replace(/\s+/g, ' ').trim());
    expect(tabs).toEqual(['Umum', 'Kolom', 'Urutan', 'Filter Tabel']);
  });

  it('TIDAK menampilkan tab Filter karena filter topBar kini milik Kelola Halaman', async () => {
    // Filter topBar disimpan per page_key dan dipakai bersama seluruh tabel
    // halaman, jadi rumahnya dialog Kelola Halaman — bukan dialog tabel.
    renderDialog(['lembaga']);
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent?.trim());
    expect(tabs).toEqual(['Umum', 'Kolom', 'Urutan']);
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
    // Tab aktif bawaan kini Umum, bukan Kolom.
    expect(screen.getByLabelText('Umum').closest('[data-slot="tabs-content"]'))
      .toHaveAttribute('data-state', 'active');
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
    renderDialog([], { filterTersedia: ['urutan', 'kolom'] });
    await waitFor(() => expect(panelNamaPerataan()).toBeInTheDocument());
    // Sakelar di tab Filter: bagian yang TIDAK ikut tersimpan saat diketik,
    // jadi inilah yang perlu dibuktikan tidak hilang saat pindah tab.
    await userEvent.click(screen.getByRole('tab', { name: /Filter Tabel/ }));
    const sakelar = await screen.findByLabelText('Tampilkan filter Kolom');
    expect(sakelar).toBeChecked();

    await userEvent.click(screen.getByRole('tab', { name: /Kolom/ }));
    await waitFor(() => expect(panelNamaPerataan()).toBeVisible());
    await userEvent.click(screen.getByRole('tab', { name: /Filter Tabel/ }));

    // Panel `forceMount`, jadi state bagian bertahan (bukan di-remount).
    await waitFor(() => expect(screen.getByLabelText('Tampilkan filter Kolom')).toBeInTheDocument());
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

describe('DialogKelolaTabel — section Filter Tabel (toolbar)', () => {
  const simpanToolbar = vi.mocked(simpanToolbarPreset);

  it('tab "Filter Tabel" muncul bila tabel punya filter toolbar', async () => {
    renderDialog([], { filterTersedia: ['urutan', 'kolom'] });
    await waitFor(() => expect(screen.getAllByRole('tab').map((t) => t.textContent?.trim())).toContain('Filter Tabel'));

    await userEvent.click(screen.getByRole('tab', { name: /Filter Tabel/ }));
    await waitFor(() => expect(screen.getByText('Filter Tabel (toolbar)')).toBeInTheDocument());
    // Filter topBar sudah pindah ke dialog Kelola Halaman.
    expect(screen.queryByText('Filter Halaman (topBar)')).toBeNull();
  });

  it('mengarahkan filter topBar ke Kelola Halaman lewat keterangan', async () => {
    renderDialog([], { filterTersedia: ['urutan'] });
    await userEvent.click(screen.getByRole('tab', { name: /Filter Tabel/ }));
    await waitFor(() => expect(screen.getByText('Kelola Halaman', { selector: 'strong' })).toBeInTheDocument());
  });

  it('mematikan Kolom → langsung menulis peta visibilitas lengkap', async () => {
    renderDialog([], { filterTersedia: ['urutan', 'kolom'] });
    await userEvent.click(screen.getByRole('tab', { name: /Filter Tabel/ }));
    await waitFor(() => expect(screen.getByLabelText('Tampilkan filter Kolom')).toBeChecked());

    // Tanpa menekan Simpan: sakelar berubah = langsung tersimpan.
    await userEvent.click(screen.getByLabelText('Tampilkan filter Kolom'));

    // Hanya penanda "sembunyi" yang ditulis; yang tetap nyala tidak ditulis
    // (absen = tampil), dan kunci milik fitur lain tidak tersentuh.
    await waitFor(() => expect(simpanToolbar).toHaveBeenCalledWith('uji', { kolom: false }));
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalled());
  });

  it("Kembalikan ke bawaan → menghapus penanda milik tabel ini saja", async () => {
    // Sudah ada penanda tersimpan: tombol Kembalikan baru aktif bila ada
    // simpanan milik tabel ini.
    serverToolbar.state.visibilitas = { kolom: false, legacy: false };
    renderDialog([], { filterTersedia: ['urutan', 'kolom'] });
    await userEvent.click(screen.getByRole('tab', { name: /Filter Tabel/ }));
    await waitFor(() => expect(screen.getByLabelText('Tampilkan filter Kolom')).not.toBeChecked());

    await userEvent.click(screen.getByRole('button', { name: 'Kembalikan ke bawaan tabel' }));

    // Penanda tabel ini dibuang; kunci milik fitur lain ('legacy') dipertahankan.
    await waitFor(() => expect(serverToolbar.simpan).toHaveBeenCalledWith('uji', { legacy: false }));
    await waitFor(() => expect(screen.getByLabelText('Tampilkan filter Kolom')).toBeChecked());
  });

  it('hanya berisi filter toolbar walau halaman punya filter topBar', async () => {
    // Dulu keduanya berdampingan; sekarang topBar pindah ke Kelola Halaman
    // supaya satu setelan tidak punya dua pintu.
    renderDialog(['lembaga'], { filterTersedia: ['urutan'] });
    await userEvent.click(screen.getByRole('tab', { name: /Filter Tabel/ }));
    await waitFor(() => {
      expect(screen.getByText('Filter Tabel (toolbar)')).toBeInTheDocument();
      expect(screen.queryByText('Filter Halaman (topBar)')).toBeNull();
    });
  });
});