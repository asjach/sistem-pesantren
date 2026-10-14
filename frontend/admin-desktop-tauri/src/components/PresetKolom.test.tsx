import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderDenganTema } from '@/test/utils';
import PresetKolom, { type PresetKolomApi } from './PresetKolom';

/* Mock API preset per file. `vi.hoisted` wajib: factory `vi.mock` di-hoist
   ke atas file sehingga tak boleh menyentuh const biasa (TDZ). */
interface AmplopDaftar {
  pesan: string;
  data: {
    presets: { id: number; jenjang: string | null; table_key: string; nama: string; kolom: string[]; is_default: boolean }[];
    aktif_preset_id: number | null;
    default_preset_id: number | null;
    aktif_kolom: string[] | null;
  };
}

const apiUji = vi.hoisted(() => {
  const penuh = (): AmplopDaftar => ({
    pesan: 'ok',
    data: {
      presets: [],
      aktif_preset_id: null,
      default_preset_id: null,
      aktif_kolom: null,
    },
  });
  return {
    penuh,
    listPresetTabel: vi.fn(async (): Promise<AmplopDaftar> => penuh()),
    updatePresetTabel: vi.fn(async () => ({ pesan: 'ok', data: [] })),
    setPresetAktif: vi.fn(async () => ({ pesan: 'ok' })),
    createPresetTabel: vi.fn(),
    deletePresetTabel: vi.fn(),
    setPresetBawaan: vi.fn(),
  };
});

vi.mock('../api/preset', () => ({
  listPresetTabel: apiUji.listPresetTabel,
  updatePresetTabel: apiUji.updatePresetTabel,
  setPresetAktif: apiUji.setPresetAktif,
  createPresetTabel: apiUji.createPresetTabel,
  deletePresetTabel: apiUji.deletePresetTabel,
  setPresetBawaan: apiUji.setPresetBawaan,
}));

const FIELDS = [
  { key: 'nama', label: 'Nama', kind: 'text' as const },
  { key: 'kode', label: 'Kode', kind: 'text' as const },
];

function presetRingkas(kolom: string[]) {
  return {
    pesan: 'ok',
    data: {
      presets: [{ id: 7, jenjang: null, table_key: 'uji', nama: 'Ringkas', kolom, is_default: false }],
      aktif_preset_id: 7,
      default_preset_id: null,
      aktif_kolom: null,
    },
  };
}

/* Holder ref: `apiRef.current` diganti objek BARU tiap state PresetKolom
   berubah, jadi tes wajib membaca `.current` segar (bukan pegangan closure
   lama) sebelum memanggil maupun menegaskan `terapan`. */
async function tungguApi(): Promise<{ current: PresetKolomApi | null }> {
  const api: { current: PresetKolomApi | null } = { current: null };
  renderDenganTema(
    <PresetKolom
      tableKey="uji"
      fields={FIELDS}
      onApply={() => {}}
      apiRef={api}
    />,
  );
  await waitFor(() => {
    if (api.current === null) throw new Error('api belum siap');
    return api;
  });
  /* `api.current` terpasang pada render PERTAMA, sedangkan `terapan` baru
     terisi setelah `listPresetTabel` selesai (async). Tanpa menunggu di sini,
     assert `terapan`/`toggleKolomAktif` bisa balapan dengan `muat()` — itulah
     penyebab tes ini sempat flaky saat suite dijalankan penuh. */
  await waitFor(() => expect(apiUji.listPresetTabel).toHaveBeenCalled());
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return api;
}

describe('PresetKolom — toggleKolomAktif', () => {
  /* Panggilan mock tidak boleh bocor antar tes; implementasi bawaan tetap
     dipertahankan (`clearAllMocks` hanya mengosongkan `calls`). */
  beforeEach(() => { vi.clearAllMocks(); });
  it('tanpa preset aktif: menyimpan susunan "Lengkap" pribadi', async () => {
    const ref = await tungguApi();
    expect(ref.current?.terapan).toEqual({ kolom: null, presetId: null });

    await act(async () => { await ref.current?.toggleKolomAktif('kode', false); });

    // Kolom tersisa ditulis apa adanya (urutan field), BUKAN susunan preset.
    expect(apiUji.setPresetAktif).toHaveBeenCalledWith('uji', null, ['nama']);
    expect(apiUji.updatePresetTabel).not.toHaveBeenCalled();
  });

  it('dengan preset aktif: menulis kolom preset itu juga', async () => {
    apiUji.listPresetTabel.mockResolvedValueOnce(presetRingkas(['nama', 'kode']));
    const ref = await tungguApi();
    expect(ref.current?.terapan.presetId).toBe(7);

    await act(async () => { await ref.current?.toggleKolomAktif('kode', false); });

    expect(apiUji.updatePresetTabel).toHaveBeenCalledWith(7, { kolom: ['nama'] });
    expect(apiUji.setPresetAktif).not.toHaveBeenCalled();
  });

  it('menampilkan kolom tersembunyi kembali', async () => {
    apiUji.listPresetTabel.mockResolvedValueOnce(presetRingkas(['nama']));
    const ref = await tungguApi();

    await act(async () => { await ref.current?.toggleKolomAktif('kode', true); });

    expect(apiUji.updatePresetTabel).toHaveBeenCalledWith(7, { kolom: ['nama', 'kode'] });
  });

  it('kolom terakhir tidak boleh disembunyikan', async () => {
    const ref = await tungguApi();

    await act(async () => { await ref.current?.toggleKolomAktif('nama', false); });
    await act(async () => { await ref.current?.toggleKolomAktif('kode', false); });

    // Tulis pertama menyimpan ['kode']; tulis kedua (sisa 0 kolom) ditolak
    // sehingga tidak ada panggilan simpan setelahnya.
    const panggil = apiUji.setPresetAktif.mock.calls.map((c) => (c as unknown[])[2]);
    expect(panggil).toEqual([['kode']]);
  });
});
