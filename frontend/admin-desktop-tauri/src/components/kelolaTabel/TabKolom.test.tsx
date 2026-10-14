import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useRef, useState } from 'react';

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
/** Harness dengan state label nyata: mengubah nama harus benar-benar
 *  terlihat, bukan sekadar memanggil setter kosong. */
function HarnessKolom(opsi: { label?: Record<string, string>; mulaiLengkap?: boolean; kolomAwal?: string[] | null }) {
  const [label, setLabel] = useState<Record<string, string>>(opsi.label ?? {});
  const labelAwalRef = useRef(
    JSON.stringify(Object.keys(opsi.label ?? {}).sort().map((k) => [k, (opsi.label ?? {})[k]])),
  );
  return (
    <TabKolom
      tableKey="uji"
      fields={fields}
      fieldKeys={new Set(['nama', 'kode'])}
      presets={[]}
      kolomAwal={opsi.kolomAwal ?? null}
      presetAwal={null}
      mulaiLengkap={opsi.mulaiLengkap ?? true}
      label={label}
      setLabel={setLabel}
      labelAwalRef={labelAwalRef}
      onPilihLengkap={() => {}}
      onPilihPreset={() => {}}
      onTersimpan={async () => {}}
      onPakaiLengkap={() => {}}
      onDihapus={async () => {}}
    />
  );
}

function renderKolom(opsi: { label?: Record<string, string>; mulaiLengkap?: boolean; kolomAwal?: string[] | null } = {}) {
  return renderDenganTema(<HarnessKolom {...opsi} />);
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

describe('TabKolom — kolom TERSEMBUNYI juga bisa disiapkan namanya', () => {
  it('menyediakan kotak nama & tombol perataan untuk kolom tersembunyi', async () => {
    // Susunan hanya memuat 'nama' -> 'kode' masuk grup Tersembunyi.
    renderKolom({ label: { nama: 'Nama Santri' }, kolomAwal: ['nama'] });
    const inputKode = await screen.findByLabelText(/Nama tampilan Kode/);
    expect(inputKode).toBeInTheDocument();
    expect(screen.getByText(/Tersembunyi/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Perataan Kode: tengah/ })).toBeInTheDocument();
  });

  it('mengubah nama kolom tersembunyi tanpa menampilkannya', async () => {
    renderKolom({ label: { nama: 'Nama Santri' }, kolomAwal: ['nama'] });
    const inputKode = await screen.findByLabelText(/Nama tampilan Kode/);
    // Klik pada input tidak boleh menogol tampil/sembunyi kolomnya.
    fireEvent.click(inputKode);
    fireEvent.change(inputKode, { target: { value: 'Kode Santri' } });
    expect(inputKode).toHaveValue('Kode Santri');
    // Masih tersembunyi: checkbox-nya belum tercentang.
    expect(screen.getAllByRole('checkbox')[1]).not.toBeChecked();
  });
});
