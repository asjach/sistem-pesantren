import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import TabKolom from './TabKolom';
import { renderDenganTema } from '@/test/utils';

vi.mock('@/api/toolbarPreset', () => ({
  muatToolbarPreset: vi.fn(async () => ({
    pesan: 'ok',
    data: { table_key: 'uji', visibilitas: {}, lebar: {}, urutan: [], align: {} },
  })),
  simpanToolbarPreset: vi.fn(async () => ({ pesan: 'ok', data: null })),
}));

vi.mock('@/api/preset', async () => ({
  listPresetTabel: vi.fn(async () => ({ pesan: 'ok', data: [] })),
  createPresetTabel: vi.fn(),
  updatePresetTabel: vi.fn(async () => ({
    pesan: 'ok',
    data: [{ id: 1, table_key: 'uji', nama: 'ringkas', kolom: ['nama'] }],
  })),
  deletePresetTabel: vi.fn(),
  setPresetAktif: vi.fn(),
  setPresetBawaan: vi.fn(),
}));

vi.mock('@/lembagaAktif', async (asli) => ({
  ...(await asli()),
  useLembagaAktif: () => ({ efektifSuper: true }),
}));

import { updatePresetTabel } from '@/api/preset';

const fields = [
  { key: 'nama', label: 'Nama', kind: 'static' as const },
  { key: 'kode', label: 'Kode', kind: 'static' as const },
];

const preset = {
  id: 1,
  jenjang: null,
  table_key: 'uji',
  nama: 'ringkas',
  kolom: ['nama'],
  label: { nama: 'Nama Santri' },
  is_default: false,
};

function renderKolom() {
  return renderDenganTema(
    <TabKolom
      tableKey="uji"
      fields={fields}
      fieldKeys={new Set(['nama', 'kode'])}
      presets={[preset]}
      presetAwal={preset}
      mulaiLengkap={false}
      onPilihLengkap={vi.fn()}
      bawaanId={null}
      onPilihPreset={vi.fn()}
      onTersimpan={vi.fn(async () => {})}
      onPakaiLengkap={vi.fn()}
      onDihapus={vi.fn(async () => {})}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Checkbox Radix mengukur via ResizeObserver (tak ada di jsdom).
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

describe('TabKolom — tulis ulang nama header', () => {
  it('menampilkan nama kustom dari preset + pensil bertanda', async () => {
    renderKolom();
    expect(await screen.findByText('Nama Santri')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /kini: Nama Santri/ })).toBeInTheDocument();
  });

  it('pensil membuka editor dan menyimpan nama baru', async () => {
    renderKolom();
    fireEvent.click(await screen.findByRole('button', { name: /Ubah nama header Nama/ }));
    const input = screen.getByLabelText(/Nama header Nama/);
    expect(input).toHaveValue('Nama Santri');
    fireEvent.change(input, { target: { value: 'Nama X' } });
    fireEvent.click(screen.getByRole('button', { name: /Simpan nama header/ }));
    expect(await screen.findByText('Nama X')).toBeInTheDocument();
  });

  it('input dikosongkan = kembali ke bawaan', async () => {
    renderKolom();
    fireEvent.click(await screen.findByRole('button', { name: /Ubah nama header Nama/ }));
    const input = screen.getByLabelText(/Nama header Nama/);
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /Simpan nama header/ }));
    expect(await screen.findByText('Nama')).toBeInTheDocument();
    expect(screen.queryByText('Nama Santri')).not.toBeInTheDocument();
  });

  it('submit mengirim label ke updatePresetTabel', async () => {
    const { container } = renderKolom();
    fireEvent.click(await screen.findByRole('button', { name: /Ubah nama header Nama/ }));
    fireEvent.change(screen.getByLabelText(/Nama header Nama/), { target: { value: 'Nama X' } });
    fireEvent.click(screen.getByRole('button', { name: /Simpan nama header/ }));
    await screen.findByText('Nama X');
    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    await waitFor(() => expect(updatePresetTabel).toHaveBeenCalledWith(1, {
      nama: 'ringkas',
      kolom: ['nama'],
      label: { nama: 'Nama X' },
    }));
  });
});
