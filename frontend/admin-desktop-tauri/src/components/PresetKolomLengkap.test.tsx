import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MutableRefObject } from 'react';

import PresetKolom, { type PresetKolomApi } from './PresetKolom';
import type { ExcelField } from './ExcelTable';
import { renderDenganTema } from '@/test/utils';

/** Pengguna bisa ditukar per tes (mis. tanpa izin kelola preset). */
const { pengguna } = vi.hoisted(() => ({
  pengguna: { current: { permissions: ['preset_tabel.tambah'], roles: [{ name: 'super_admin' }] } as unknown as {
    permissions: string[];
    roles: { name: string }[];
  } | null },
}));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ user: pengguna.current }) }));

const { listPresetTabel, createPresetTabel, setPresetBawaan, setPresetAktif, updatePresetTabel } = vi.hoisted(() => ({
  listPresetTabel: vi.fn(),
  createPresetTabel: vi.fn(),
  setPresetBawaan: vi.fn(),
  setPresetAktif: vi.fn(),
  updatePresetTabel: vi.fn(),
}));
vi.mock('@/api/preset', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/preset')>();
  return {
    ...asli,
    listPresetTabel,
    createPresetTabel,
    setPresetBawaan,
    setPresetAktif,
    updatePresetTabel,
  };
});

const FIELDS = [{ key: 'nama', label: 'Nama' }, { key: 'jk', label: 'JK' }] as ExcelField[];

/** Balasan index saat tabel belum punya preset sama sekali. */
const KOSONG = {
  pesan: 'ok',
  data: { presets: [], aktif_preset_id: null, aktif_kolom: null, aktif_label: null, default_preset_id: null },
};

/** Balasan index setelah preset "Lengkap" terpasang sebagai bawaan. */
const ADA_LENGKAP = {
  pesan: 'ok',
  data: {
    presets: [{ id: 11, nama: 'Lengkap', kolom: ['nama', 'jk'], is_default: true }],
    aktif_preset_id: null,
    aktif_kolom: null,
    aktif_label: null,
    default_preset_id: 11,
  },
};

beforeEach(() => {
  pengguna.current = { permissions: ['preset_tabel.tambah'], roles: [{ name: 'super_admin' }] };
  vi.clearAllMocks();
  setPresetAktif.mockResolvedValue({ pesan: 'ok' });
  setPresetBawaan.mockResolvedValue({ pesan: 'ok' });
  updatePresetTabel.mockResolvedValue({ pesan: 'ok' });
});

describe('PresetKolom — preset "Lengkap" sungguhan', () => {
  it('membuat preset "Lengkap" berisi semua kolom lalu menjadikannya bawaan', async () => {
    listPresetTabel.mockResolvedValueOnce(KOSONG).mockResolvedValueOnce(ADA_LENGKAP);
    createPresetTabel.mockResolvedValue({
      pesan: 'ok',
      data: [{ id: 11, nama: 'Lengkap', kolom: ['nama', 'jk'] }],
    });
    const onApply = vi.fn();

    renderDenganTema(<PresetKolom tableKey="uji" fields={FIELDS} onApply={onApply} />);

    await waitFor(() =>
      expect(createPresetTabel).toHaveBeenCalledWith({
        table_key: 'uji',
        nama: 'Lengkap',
        kolom: ['nama', 'jk'],
      }),
    );
    await waitFor(() => expect(setPresetBawaan).toHaveBeenCalledWith(11, true));
    // Susunan "Lengkap" langsung dipakai tabel.
    await waitFor(() => expect(onApply).toHaveBeenCalledWith(['nama', 'jk'], null, 11));
  });

  it('tidak membuat ulang bila preset "Lengkap" sudah ada', async () => {
    listPresetTabel.mockResolvedValue(ADA_LENGKAP);
    const onApply = vi.fn();

    renderDenganTema(<PresetKolom tableKey="uji" fields={FIELDS} onApply={onApply} />);

    await waitFor(() => expect(onApply).toHaveBeenCalledWith(['nama', 'jk'], null, 11));
    expect(createPresetTabel).not.toHaveBeenCalled();
    expect(setPresetBawaan).not.toHaveBeenCalled();
  });

  it('tidak membuat preset bila pengguna tanpa izin kelola', async () => {
    pengguna.current = { permissions: [], roles: [{ name: 'admin' }] };
    listPresetTabel.mockResolvedValue(KOSONG);
    const onApply = vi.fn();

    renderDenganTema(<PresetKolom tableKey="uji" fields={FIELDS} onApply={onApply} />);

    await waitFor(() => expect(onApply).toHaveBeenCalledWith(null, null, null));
    expect(createPresetTabel).not.toHaveBeenCalled();
  });

  it('memancarkan EVENT_PRESET_BERUBAH setelah susunan disimpan dari menu konteks', async () => {
    listPresetTabel.mockResolvedValue(ADA_LENGKAP);
    const apiRef = { current: null } as MutableRefObject<PresetKolomApi | null>;
    const dengar = vi.fn();
    window.addEventListener('simpes:preset-berubah', dengar);

    renderDenganTema(
      <PresetKolom tableKey="uji" fields={FIELDS} onApply={() => {}} apiRef={apiRef} />,
    );
    await waitFor(() => expect(apiRef.current).not.toBeNull());

    await act(async () => {
      await apiRef.current?.toggleKolomAktif('jk', false);
    });

    // Preset "Lengkap" yang sedang aktif itulah yang ditulis (bukan susunan pribadi).
    expect(updatePresetTabel).toHaveBeenCalledWith(11, { kolom: ['nama'] });
    expect(setPresetAktif).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(dengar).toHaveBeenCalledWith(
        expect.objectContaining({ detail: { tableKey: 'uji', sumber: 'presetKolom' } }),
      ),
    );

    window.removeEventListener('simpes:preset-berubah', dengar);
  });
});
