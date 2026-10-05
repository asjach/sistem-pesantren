import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useCallback, useState } from 'react';

import TabNamaPerataan from './TabNamaPerataan';
import { BagianProvider, useRegistriBagian } from '@/components/kelolaHalaman/kotor';
import { renderDenganTema } from '@/test/utils';

vi.mock('@/api/toolbarPreset', () => ({
  muatToolbarPreset: vi.fn(async () => ({
    pesan: 'ok',
    data: { table_key: 'uji', visibilitas: {}, lebar: {}, urutan: [], align: {} },
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

/** Harness dengan state nama nyata + menangkap fungsi simpan section. */
function renderTampilan(labelAwal: Record<string, string> = { nama: 'Nama Santri' }) {
  const simpanRef: { current: (() => void) | null } = { current: null };
  function Harness() {
    const [label, setLabel] = useState(labelAwal);
    const lapor = useCallback(() => {}, []);
    const daftarSimpan = useCallback((id: string, fn: (() => void) | null) => {
      if (id === 'tampilan') simpanRef.current = fn;
    }, []);
    const daftarAksi = useCallback(() => {}, []);
    const registri = useRegistriBagian(lapor, daftarSimpan, daftarAksi);
    return (
      <BagianProvider value={registri}>
        <TabNamaPerataan
          tableKey="uji"
          fields={fields}
          fieldKeys={new Set(['nama', 'kode'])}
          label={label}
          setLabel={setLabel}
        />
      </BagianProvider>
    );
  }
  const hasil = renderDenganTema(<Harness />);
  return { ...hasil, simpanRef };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TabNamaPerataan — tulis ulang nama header', () => {
  it('menampilkan nama kustom dari state + pensil bertanda', async () => {
    renderTampilan();
    expect(await screen.findByText('Nama Santri')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /kini: Nama Santri/ })).toBeInTheDocument();
  });

  it('pensil membuka editor dan menyimpan nama baru', async () => {
    renderTampilan();
    fireEvent.click(await screen.findByRole('button', { name: /Ubah nama header Nama/ }));
    const input = screen.getByLabelText(/Nama header Nama/);
    expect(input).toHaveValue('Nama Santri');
    fireEvent.change(input, { target: { value: 'Nama X' } });
    fireEvent.click(screen.getByRole('button', { name: /Simpan nama header/ }));
    expect(await screen.findByText('Nama X')).toBeInTheDocument();
  });

  it('input dikosongkan = kembali ke bawaan', async () => {
    renderTampilan();
    fireEvent.click(await screen.findByRole('button', { name: /Ubah nama header Nama/ }));
    const input = screen.getByLabelText(/Nama header Nama/);
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /Simpan nama header/ }));
    expect(await screen.findByText('Nama')).toBeInTheDocument();
    expect(screen.queryByText('Nama Santri')).not.toBeInTheDocument();
  });
});

describe('TabNamaPerataan — perataan kolom', () => {
  it('siklus tengah-kiri lalu simpan mengirim peta align', async () => {
    const { simpanRef } = renderTampilan({});
    const tombol = await screen.findByRole('button', { name: /Perataan Nama: tengah/ });
    fireEvent.click(tombol);
    expect(await screen.findByRole('button', { name: /Perataan Nama: kiri/ })).toBeInTheDocument();
    expect(simpanRef.current).not.toBeNull();
    await act(async () => {
      simpanRef.current?.();
    });
    await waitFor(() => expect(simpanToolbarPreset).toHaveBeenCalledWith(
      'uji', undefined, undefined, undefined, { nama: 'left' },
    ));
  });
});
