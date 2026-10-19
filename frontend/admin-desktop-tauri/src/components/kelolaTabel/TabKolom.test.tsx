import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useRef, useState } from 'react';

import TabKolom from './TabKolom';
import { BagianProvider } from '@/components/kelolaHalaman/kotor';
import { renderDenganTema } from '@/test/utils';

function CangkangBagian({ children }: { children: React.ReactNode }) {
  const simpanRef = useRef<Record<string, () => unknown>>({});
  const nilai = useRef({
    lapor: (id: string, kotor: boolean) => {
      if (!kotor) return;
      void simpanRef.current[id]?.();
    },
    daftarSimpan: (id: string, simpan: (() => unknown) | null) => {
      if (simpan) simpanRef.current[id] = simpan;
      else delete simpanRef.current[id];
    },
    daftarAksi: () => {},
  });
  return <BagianProvider value={nilai.current}>{children}</BagianProvider>;
}

vi.mock('@/api/preset', () => ({
  listPresetTabel: vi.fn(async () => ({
    pesan: 'ok',
    data: { presets: [], aktif_preset_id: null, aktif_kolom: null,  },
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
    <CangkangBagian>
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
    </CangkangBagian>
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

    fireEvent.submit(document.getElementById('form_preset_kolom_uji')!);
    await waitFor(() => expect(simpanToolbarPreset).toHaveBeenCalled());
    const panggilan = vi.mocked(simpanToolbarPreset).mock.calls.at(-1);
    expect(panggilan?.[0]).toBe('uji');
    expect(panggilan?.[3]).toEqual({ nama: 'left' });
  });
});

describe('TabKolom — kolom TERSEMBUNYI juga bisa disiapkan namanya', () => {
  /** Buka grup Tersembunyi sebelum menelusuri isinya: sejak grupnya bisa
   *  dilipat (bawaan TERTUTUP), isi tersembunyi tak ada di DOM sampai dibuka. */
  async function bukaTersembunyi() {
    const pemicu = await screen.findByRole('button', { name: /Kolom tersembunyi/ });
    if (pemicu.getAttribute('data-state') === 'closed') fireEvent.click(pemicu);
    await waitFor(() => expect(pemicu).toHaveAttribute('data-state', 'open'));
  }
  it('menyediakan kotak nama & tombol perataan untuk kolom tersembunyi', async () => {

    renderKolom({ label: { nama: 'Nama Santri' }, kolomAwal: ['nama'] });
    await bukaTersembunyi();
    const inputKode = await screen.findByLabelText(/Nama tampilan Kode/);
    expect(inputKode).toBeInTheDocument();
    expect(screen.getByText(/Tersembunyi/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Perataan Kode: tengah/ })).toBeInTheDocument();
  });

  it('mengubah nama kolom tersembunyi tanpa menampilkannya', async () => {
    renderKolom({ label: { nama: 'Nama Santri' }, kolomAwal: ['nama'] });
    await bukaTersembunyi();
    const inputKode = await screen.findByLabelText(/Nama tampilan Kode/);

    fireEvent.click(inputKode);
    fireEvent.change(inputKode, { target: { value: 'Kode Santri' } });
    expect(inputKode).toHaveValue('Kode Santri');

    expect(screen.getAllByRole('checkbox')[1]).not.toBeChecked();
  });
});

describe('TabKolom — seret seluruh baris untuk mengubah urutan', () => {
  it('atribut draggable ada di BARIS, bukan di ikon handle', async () => {
    renderKolom();
    const handle = await screen.findByRole('button', { name: /Pindahkan Nama/ });

    expect(handle).not.toHaveAttribute('draggable');

    const baris = handle.closest('[draggable="true"]');
    expect(baris).not.toBeNull();

    expect(baris).toContainElement(screen.getByLabelText(/Nama tampilan Nama/));
    expect(baris).toContainElement(screen.getByRole('button', { name: /Perataan Nama/ }));
  });

  it('memindahkan kolom ke posisi kolom lain di dalam daftar', () => {

    const pindah = (daftar: string[], dari: string, ke: string, sesudah = false) => {
      const next = daftar.filter((k) => k !== dari);
      let i = next.indexOf(ke);
      if (i < 0) return daftar;
      if (sesudah) i += 1;
      next.splice(i, 0, dari);
      return next;
    };

    expect(pindah(['nama', 'kode', 'alamat'], 'nama', 'kode')).toEqual(['nama', 'kode', 'alamat']);

    expect(pindah(['nama', 'kode', 'alamat'], 'alamat', 'nama')).toEqual(['alamat', 'nama', 'kode']);

    expect(pindah(['nama', 'kode', 'alamat'], 'nama', 'kode', true)).toEqual(['kode', 'nama', 'alamat']);

    expect(pindah(['nama', 'kode', 'alamat'], 'kode', 'nama', true)).toEqual(['nama', 'kode', 'alamat']);

    expect(pindah(['nama', 'kode'], 'nama', 'hilang')).toEqual(['nama', 'kode']);
  });

  it('menyeret dari kotak nama TIDAK memindahkan baris', async () => {
    renderKolom();
    const baris = () => screen.getAllByRole('checkbox').map((c) => c.id.replace('chk_kolom_uji_', ''));
    const semula = baris();

    const input = screen.getByLabelText(/Nama tampilan Nama/);
    const data = { effectAllowed: '', setData: vi.fn(), setDragImage: vi.fn() };
    const batal = !fireEvent.dragStart(input, { dataTransfer: data });

    expect(batal).toBe(true);
    expect(baris()).toEqual(semula);
  });
});

describe('TabKolom — setelan label disimpan tanpa memuat ulang baris', () => {

  it('menyimpan label TANPA menyentuh preset', async () => {
    renderKolom();
    const input = await screen.findByLabelText(/Nama tampilan Nama/);
    fireEvent.change(input, { target: { value: 'Nama Santri' } });

    await waitFor(() => expect(simpanToolbarPreset).toHaveBeenCalled());

    expect(simpanToolbarPreset).toHaveBeenCalled();
  });
});

describe('TabKolom — grup Tersembunyi bisa dilipat', () => {
  beforeEach(() => localStorage.clear());

  it('bawaan TERTUTUP saat setelan belum pernah dibuat', async () => {
    renderKolom({ kolomAwal: ['nama'] });
    const pemicu = await screen.findByRole('button', { name: /Kolom tersembunyi \(1\)/ });

    expect(pemicu).toHaveAttribute('data-state', 'closed');
  });

  it('membuka lalu menutup, dan pilihannya disimpan', async () => {
    renderKolom({ kolomAwal: ['nama'] });
    const pemicu = await screen.findByRole('button', { name: /Kolom tersembunyi \(1\)/ });
    expect(pemicu).toHaveAttribute('data-state', 'closed');

    fireEvent.click(pemicu);
    await waitFor(() => expect(pemicu).toHaveAttribute('data-state', 'open'));

    expect(localStorage.getItem('simpes_kelola_tabel_tersembunyi_tutup')).toBe('0');

    fireEvent.click(pemicu);
    await waitFor(() => expect(pemicu).toHaveAttribute('data-state', 'closed'));
    expect(localStorage.getItem('simpes_kelola_tabel_tersembunyi_tutup')).toBe('1');
  });

  it('menghormati pilihan tersimpan saat panel dibuka lagi', async () => {
    localStorage.setItem('simpes_kelola_tabel_tersembunyi_tutup', '0');
    renderKolom({ kolomAwal: ['nama'] });
    const pemicu = await screen.findByRole('button', { name: /Kolom tersembunyi \(1\)/ });
    expect(pemicu).toHaveAttribute('data-state', 'open');
  });
});
