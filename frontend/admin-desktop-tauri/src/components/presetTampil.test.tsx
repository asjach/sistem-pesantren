import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderDenganTema } from '@/test/utils';
import { muatKomponenCustom } from '@/api/komponenCustom';
import { resetSetelanKomponen, simpanSetelanKomponen } from '@/components/komponenCustom';

/* Setelan komponen custom disimpan di server; API-nya dimock agar tes bisa
   menyemai setelan lewat store klien tanpa jaringan. */
vi.mock('@/api/komponenCustom', () => ({
  muatKomponenCustom: vi.fn(async () => ({ pesan: '', data: { peta: {} } })),
  simpanKomponenCustom: vi.fn(async () => ({ pesan: '', data: {} })),
  hapusKomponenCustom: vi.fn(async () => ({ pesan: '' })),
}));

beforeEach(() => {
  resetSetelanKomponen();
});
import type { ExcelField } from './ExcelTable';

// ---- Mock API preset (unit test tidak boleh memanggil fetch nyata) ----

const { muatUrutPreset, listPresetTabel } = vi.hoisted(() => ({
  muatUrutPreset: vi.fn((..._a: unknown[]): Promise<unknown> => Promise.resolve({
    pesan: 'ok',
    data: { table_key: 'uji', opsi: [], tersedia: [] },
  })),
  listPresetTabel: vi.fn((..._a: unknown[]): Promise<unknown> => Promise.resolve({
    pesan: 'ok',
    data: { presets: [], aktif_preset_id: null, aktif_kolom: null, default_preset_id: null },
  })),
}));

vi.mock('@/api/urutPreset', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/urutPreset')>();
  return { ...asli, muatUrutPreset: (...a: unknown[]) => muatUrutPreset(...a) };
});

vi.mock('@/api/preset', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/preset')>();
  return { ...asli, listPresetTabel: (...a: unknown[]) => listPresetTabel(...a) };
});

import PresetUrut from './PresetUrut';
import PresetKolom from './PresetKolom';

const FIELDS = [{ key: 'a', label: 'A' }] as ExcelField[];

function presetUrut(opsi: Array<{ kode: string[]; label: string }>, urutAktif: string[] = []) {
  muatUrutPreset.mockResolvedValue({
    pesan: 'ok',
    data: { table_key: 'uji', opsi, tersedia: [] },
  });
  return renderDenganTema(
    <PresetUrut tableKey="uji" urutAktif={urutAktif} arahUrut="naik" onUrut={() => {}} />,
  );
}

function presetKolom(jumlah: number) {
  listPresetTabel.mockResolvedValue({
    pesan: 'ok',
    data: {
      presets: Array.from({ length: jumlah }, (_, i) => ({ id: i + 1, nama: `Preset ${i + 1}`, kolom: ['a'] })),
      aktif_preset_id: null,
      aktif_kolom: null,
      default_preset_id: null,
    },
  });
  return renderDenganTema(
    <PresetKolom tableKey="uji" fields={FIELDS} onApply={() => {}} />,
  );
}

describe('dropdown Urutkan — tampil hanya bila pilihan > 1', () => {
  it('tersembunyi saat tidak ada preset (hanya "—")', async () => {
    presetUrut([]);
    await waitFor(() => expect(screen.queryByText('Urutkan:')).toBeNull());
  });

  it('tetap tampil saat ada 1 preset (2 item: "—" + preset)', async () => {
    presetUrut([{ kode: ['a'], label: 'Nama' }]);
    expect(await screen.findByText('Urutkan:')).toBeInTheDocument();
  });

  it('tampil saat ada 2 preset', async () => {
    presetUrut([
      { kode: ['a'], label: 'Nama' },
      { kode: ['b'], label: 'Kelas' },
    ]);
    expect(await screen.findByText('Urutkan:')).toBeInTheDocument();
  });

  it('tetap tampil saat urutan sedang aktif walau tanpa preset (arah bisa dibalik)', async () => {
    presetUrut([], ['a']);
    expect(await screen.findByText('Urutkan:')).toBeInTheDocument();
  });
});

describe('dropdown Urutkan — nilai awal dari popover', () => {
  it('menerapkan nilai awal saat preset termuat (bukan hanya tampilannya)', async () => {
    const tableKey = `uji_awal_${Date.now()}`;
    // Server sudah menyimpan nilai awal; komponen memuatnya sekali saat tampil.
    vi.mocked(muatKomponenCustom).mockResolvedValueOnce({
      pesan: 'ok',
      data: { peta: { [`|select_urut_${tableKey}`]: { nilaiDefault: 'Kelas' } } },
    });
    const onUrut = vi.fn();
    muatUrutPreset.mockResolvedValue({
      pesan: 'ok',
      data: {
        table_key: tableKey,
        opsi: [{ kode: ['a'], label: 'Nama' }, { kode: ['b'], label: 'Kelas' }],
        tersedia: [],
      },
    });
    renderDenganTema(<PresetUrut tableKey={tableKey} urutAktif={[]} arahUrut="naik" onUrut={onUrut} />);

    await waitFor(() => expect(onUrut).toHaveBeenCalledWith(['b'], 'naik', undefined));
  });

  it('nilai awal yang tiba BELAKANGAN (setelah preset termuat) tetap diterapkan', async () => {
    const tableKey = `uji_telat_${Date.now()}`;
    const onUrut = vi.fn();
    muatUrutPreset.mockResolvedValue({
      pesan: 'ok',
      data: {
        table_key: tableKey,
        opsi: [{ kode: ['a'], label: 'Nama' }, { kode: ['b'], label: 'Kelas' }],
        tersedia: [],
      },
    });
    renderDenganTema(<PresetUrut tableKey={tableKey} urutAktif={[]} arahUrut="naik" onUrut={onUrut} />);

    // Preset (isi dropdown) termuat dulu — di app nyata ini memicu re-render
    // dengan identitas `value` baru (opsiItem dibangun ulang tiap render).
    await waitFor(() => expect(muatUrutPreset).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));

    // BARU nilai awal datang dari server (async di app nyata).
    simpanSetelanKomponen('', `select_urut_${tableKey}`, { nilaiDefault: 'Kelas' });

    await waitFor(() => expect(onUrut).toHaveBeenCalledWith(['b'], 'naik', undefined));
  });
});

describe('dropdown Kolom — selalu tampil dengan awalan "Lengkap"', () => {
  it('tetap tampil walau belum ada preset (hanya "Lengkap")', async () => {
    presetKolom(0);
    expect(await screen.findByText('Kolom:')).toBeInTheDocument();
  });

  it('tetap tampil saat ada 1 preset (2 item: "Lengkap" + preset)', async () => {
    presetKolom(1);
    expect(await screen.findByText('Kolom:')).toBeInTheDocument();
  });

  it('jatuh ke preset "Lengkap" bila pengguna belum memilih (bukan preset bawaan)', async () => {
    const onApply = vi.fn();
    listPresetTabel.mockResolvedValue({
      pesan: 'ok',
      data: {
        presets: [{ id: 9, nama: 'Lengkap', kolom: ['a'] }],
        aktif_preset_id: null,
        aktif_kolom: null,
        default_preset_id: null,
      },
    });
    renderDenganTema(<PresetKolom tableKey="uji" fields={FIELDS} onApply={onApply} />);

    await waitFor(() => expect(onApply).toHaveBeenCalledWith(['a'], 9));
  });
});

describe('dropdown Kolom — nilai awal dari popover', () => {
  /** Preset "Lengkap" + satu preset lain; tanpa pilihan aktif pengguna. */
  const presetDua = (tambahan: Record<string, unknown> = {}) => listPresetTabel.mockResolvedValue({
    pesan: 'ok',
    data: {
      presets: [
        { id: 9, nama: 'Lengkap', kolom: ['a'] },
        { id: 7, nama: 'Ringkas', kolom: ['a'] },
      ],
      aktif_preset_id: null,
      aktif_kolom: null,
      default_preset_id: null,
      ...tambahan,
    },
  });

  it('menerapkan nilai awal saat preset termuat (bukan hanya tampilannya)', async () => {
    const tableKey = `uji_kolom_${Date.now()}`;
    // Server sudah menyimpan nilai awal; komponen memuatnya sekali saat tampil.
    vi.mocked(muatKomponenCustom).mockResolvedValueOnce({
      pesan: 'ok',
      data: { peta: { [`|select_preset_kolom_${tableKey}`]: { nilaiDefault: 'Ringkas' } } },
    });
    const onApply = vi.fn();
    presetDua();
    renderDenganTema(<PresetKolom tableKey={tableKey} fields={FIELDS} onApply={onApply} />);

    // Nilai awal = preset "Ringkas" (id 7), bukan "Lengkap" (id 9).
    await waitFor(() => expect(onApply).toHaveBeenCalledWith(['a'], 7));
  });

  it('nilai awal yang tiba BELAKANGAN (setelah preset termuat) tetap diterapkan', async () => {
    const tableKey = `uji_kolom_telat_${Date.now()}`;
    const onApply = vi.fn();
    presetDua();
    renderDenganTema(<PresetKolom tableKey={tableKey} fields={FIELDS} onApply={onApply} />);

    await waitFor(() => expect(listPresetTabel).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));

    // BARU nilai awal datang dari server (async di app nyata).
    simpanSetelanKomponen('', `select_preset_kolom_${tableKey}`, { nilaiDefault: 'Ringkas' });

    await waitFor(() => expect(onApply).toHaveBeenCalledWith(['a'], 7));
  });

  /**
   * Keluhan nyata: "ketika saya tentukan nilai default, nilainya tidak otomatis,
   * baik ketika dipilih maupun setelah refresh halaman".
   *
   *  Sebabnya: pengguna pernah memilih preset dari dropdown → tersimpan sebagai
   *  `aktif_preset_id`. Saat halaman dibuka, `PresetKolom` mengisi `value`-nya
   *  sendiri secara async (fallback "Lengkap" → preset aktif), dan perubahan itu
   *  dulu mematikan mode ikut-awal sehingga setelan "Nilai awal" tak pernah
   *  diterapkan.
   */
  it('nilai awal tetap diterapkan walau pengguna punya preset aktif tersimpan', async () => {
    const tableKey = `uji_kolom_aktif_${Date.now()}`;
    vi.mocked(muatKomponenCustom).mockResolvedValueOnce({
      pesan: 'ok',
      data: { peta: { [`|select_preset_kolom_${tableKey}`]: { nilaiDefault: 'Lengkap' } } },
    });
    const onApply = vi.fn();
    // Preset aktif tersimpan = "Ringkas" (id 7); nilai awal = "Lengkap" (id 9).
    listPresetTabel.mockResolvedValue({
      pesan: 'ok',
      data: {
        presets: [
          { id: 9, nama: 'Lengkap', kolom: ['a'] },
          { id: 7, nama: 'Ringkas', kolom: ['a'] },
        ],
        aktif_preset_id: 7,
        aktif_kolom: null,
        default_preset_id: null,
      },
    });
    renderDenganTema(<PresetKolom tableKey={tableKey} fields={FIELDS} onApply={onApply} />);

    // Penerapan TERAKHIR harus preset nilai awal (9), bukan preset aktif (7).
    await waitFor(() => expect(onApply).toHaveBeenLastCalledWith(['a'], 9));
  });

  it('mengubah nilai awal saat halaman terbuka langsung diterapkan (tanpa refresh)', async () => {
    const tableKey = `uji_kolom_ubah_${Date.now()}`;
    vi.mocked(muatKomponenCustom).mockResolvedValueOnce({
      pesan: 'ok',
      data: { peta: { [`|select_preset_kolom_${tableKey}`]: { nilaiDefault: 'Lengkap' } } },
    });
    const onApply = vi.fn();
    presetDua();
    renderDenganTema(<PresetKolom tableKey={tableKey} fields={FIELDS} onApply={onApply} />);
    await waitFor(() => expect(onApply).toHaveBeenCalled());

    // Pengguna mengganti nilai awal lewat popover klik-kanan → berlaku seketika.
    simpanSetelanKomponen('', `select_preset_kolom_${tableKey}`, { nilaiDefault: 'Ringkas' });

    await waitFor(() => expect(onApply).toHaveBeenLastCalledWith(['a'], 7));
  });
});
