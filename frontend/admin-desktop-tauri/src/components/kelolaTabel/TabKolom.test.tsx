import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import TabKolom from './TabKolom';
import { renderDenganTema } from '@/test/utils';

vi.mock('@/api/preset', () => ({
  listPresetTabel: vi.fn(async () => ({
    pesan: 'ok',
    data: { presets: [], aktif_preset_id: null, aktif_kolom: null, aktif_label: null },
  })),
  createPresetTabel: vi.fn(),
  updatePresetTabel: vi.fn(),
  deletePresetTabel: vi.fn(),
}));

vi.mock('@/api/toolbarPreset', () => ({
  muatToolbarPreset: vi.fn(async () => ({
    pesan: 'ok',
    data: { table_key: 'uji', visibilitas: {}, lebar: {}, urutan: [], align: {}, label: {} },
  })),
  simpanToolbarPreset: vi.fn(async () => ({ pesan: 'ok', data: null })),
}));

vi.mock('@/lembagaAktif', async (asli) => ({
  ...(await asli()),
  useLembagaAktif: () => ({ efektifSuper: true }),
}));

import { simpanToolbarPreset } from '@/api/toolbarPreset';

const fields = [
  { key: 'nama', label: 'Nama', kind: 'static' as const },
  { key: 'kode', label: 'Kode', kind: 'static' as const },
];

/** Tab Kolom kini memuat nama & perataan sekaligus: keduanya setelan per
 *  TABEL (bukan per preset), jadi tetap walau preset berganti. */
function renderKolom() {
  return renderDenganTema(
    <TabKolom
      tableKey="uji"
      fields={fields}
      fieldKeys={new Set(['nama', 'kode'])}
      presets={[]}
      kolomAwal={null}
      presetAwal={null}
      mulaiLengkap
      label={{}}
      setLabel={() => {}}
      labelAwalRef={{ current: '[]' }}
      onPilihLengkap={() => {}}
      onPilihPreset={() => {}}
      onTersimpan={async () => {}}
      onPakaiLengkap={() => {}}
      onDihapus={async () => {}}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TabKolom — nama & perataan per TABEL', () => {
  it('menyediakan kotak nama tampilan untuk kolom yang TAMPIL', async () => {
    renderKolom();
    // `mulaiLengkap` = semua kolom tampil, jadi keduanya bisa dinamai.
    expect(await screen.findByLabelText(/Nama tampilan Nama/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nama tampilan Kode/)).toBeInTheDocument();
  });

  it('menyediakan tombol perataan per kolom, mulai dari tengah', async () => {
    renderKolom();
    expect(await screen.findByRole('button', { name: /Perataan Nama: tengah/ })).toBeInTheDocument();
  });

  it('siklus perataan tengah ke kiri dan tersimpan sebagai setelan tabel', async () => {
    renderKolom();
    const tombol = await screen.findByRole('button', { name: /Perataan Nama: tengah/ });
    fireEvent.click(tombol);
    expect(await screen.findByRole('button', { name: /Perataan Nama: kiri/ })).toBeInTheDocument();
    // Simpan lewat form (tombolnya di footer dialog, bukan di sini).
    fireEvent.submit(document.getElementById('form_preset_kolom_uji')!);
    await waitFor(() => expect(simpanToolbarPreset).toHaveBeenCalled());
    const panggilan = vi.mocked(simpanToolbarPreset).mock.calls.at(-1);
    expect(panggilan?.[0]).toBe('uji');
    expect(panggilan?.[3]).toEqual({ nama: 'left' });
  });
});
