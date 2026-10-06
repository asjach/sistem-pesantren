import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useCallback, useState } from 'react';

import TabNamaPerataan from './TabNamaPerataan';
import { BagianProvider, useRegistriBagian } from '@/components/kelolaHalaman/kotor';
import { renderDenganTema } from '@/test/utils';
import { kanonLabel } from '@/lib/labelKolom';

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
  const labelAwalRef = { current: kanonLabel(labelAwal) };
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
          labelAwalRef={labelAwalRef}
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

describe('TabNamaPerataan — edit langsung di kolom EDIT', () => {
  it('kolom pertama menampilkan nama bawaan, kolom EDIT nilai kustom', async () => {
    renderTampilan();
    expect(await screen.findByTitle('Nama bawaan: Nama')).toBeInTheDocument();
    const input = screen.getByLabelText(/Edit nama header Nama/);
    expect(input).toHaveValue('Nama Santri');
    // Kolom tanpa kustom: input kosong, nama bawaan tetap tampil di kolom 1.
    expect(screen.getByLabelText(/Edit nama header Kode/)).toHaveValue('');
  });

  it('tanpa tombol edit: nama kustom berubah langsung dari input', async () => {
    renderTampilan();
    expect(screen.queryByRole('button', { name: /Ubah nama header/ })).not.toBeInTheDocument();
    const input = screen.getByLabelText(/Edit nama header Nama/);
    fireEvent.change(input, { target: { value: 'Nama X' } });
    expect(input).toHaveValue('Nama X');
  });

  it('spasi di tengah tidak terpotong, dirapikan saat blur', async () => {
    renderTampilan();
    const input = screen.getByLabelText(/Edit nama header Nama/);
    fireEvent.change(input, { target: { value: '  Nama Lengkap Santri  ' } });
    // Selama mengetik nilai mentah tersimpan apa adanya (spasi tidak terpotong).
    expect(input).toHaveValue('  Nama Lengkap Santri  ');
    // React 18 mendelegasikan onBlur ke `focusout`.
    fireEvent.focusOut(input);
    expect(input).toHaveValue('Nama Lengkap Santri');
  });

  it('input dikosongkan saat blur = kembali ke bawaan', async () => {
    renderTampilan();
    const input = screen.getByLabelText(/Edit nama header Nama/);
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.focusOut(input);
    expect(input).toHaveValue('');
    expect(screen.getByTitle('Nama bawaan: Nama')).toBeInTheDocument();
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
