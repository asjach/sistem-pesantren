import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExcelField } from '@/components/excel/types';

vi.mock('react-datasheet-grid', async () => {
  const { DynamicDataSheetGridStub } = await import('@/components/excel/_dsgStubDom');
  return { DynamicDataSheetGrid: DynamicDataSheetGridStub };
});
vi.mock('@/theme', () => ({ useTheme: () => ({ iconSet: 'lucide' }) }));
vi.mock('@/lembagaAktif', () => ({ useLembagaAktif: () => ({ efektifSuper: true }) }));
vi.mock('@/components/VisibilitasFilter', () => ({ useVisibilitasFilter: () => null }));
vi.mock('@/components/GridPrefs', async (asli) => ({
  ...(await asli<typeof import('@/components/GridPrefs')>()),
  useGridPrefs: () => ({ rowH: null, headerH: null, fontPx: 11, fontFamily: null }),
}));
vi.mock('@/components/excel/useToolbarPreset', () => ({ useToolbarPresetState: () => ({
  judulDb: null, labelDb: {}, alignDb: {}, visibilitas: {}, infoHtmlDb: null,
}) }));
vi.mock('@/components/PresetKolom', () => ({ default: ({ onApply }: { onApply: (k: string[]) => void }) => (
  <button type="button" onClick={() => onApply(['aktif'])}>Hanya aktif</button>
) }));

import ExcelTabelV2 from './ExcelTabelV2';
import { dsgStub } from '@/components/excel/_dsgStubDom';
import { widthCache } from '@/components/excel/helpers';

const fields: ExcelField[] = [
  { key: 'kode', label: 'Kode', kind: 'static', inputKind: 'text', required: true },
  { key: 'nama', label: 'Nama', kind: 'text', required: true, validate: (v) => v === 'Ditolak' ? 'Nama tidak boleh Ditolak.' : null },
  { key: 'jenis', label: 'Jenis', kind: 'select', required: true, choices: [{ value: 'mi', label: 'MI' }, { value: 'md', label: 'MD' }] },
  { key: 'aktif', label: 'Aktif', kind: 'toggle' },
];
const rows = [{ id: 1, kode: 'A', nama: 'Ahmad', jenis: 'mi', aktif: 'ya' }];
const ukuran = ['clientHeight', 'clientWidth'] as const;
const descriptor = ukuran.map((k) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, k));
ukuran.forEach((k) => Object.defineProperty(HTMLElement.prototype, k, { configurable: true, get: () => k === 'clientHeight' ? 320 : 640 }));
const canvas = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = (() => null) as typeof canvas;
afterAll(() => {
  ukuran.forEach((k, i) => { if (descriptor[i]) Object.defineProperty(HTMLElement.prototype, k, descriptor[i]!); });
  HTMLCanvasElement.prototype.getContext = canvas;
});
beforeEach(() => { localStorage.clear(); widthCache.delete('contoh_input_test'); });

function tampilkan(extra: Record<string, unknown> = {}) {
  const onCreateRow = vi.fn(async (_nilai: Record<string, string | null>) => {});
  const view = render(<ExcelTabelV2 tableKey="contoh_input_test" judul="Contoh input" fields={fields}
    rows={rows} getValues={(r) => ({ kode: r.kode, nama: r.nama, jenis: r.jenis, aktif: r.aktif })}
    onApplyPreset={() => {}} onCreateRow={onCreateRow} inputRowValues={{ jenis: 'mi' }} {...extra} />);
  return { ...view, onCreateRow };
}

async function mulai() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Tambah baris' }));
  await screen.findByRole('textbox', { name: 'Kode' });
  return user;
}

describe('ExcelTabelV2 - input record baru', () => {
  it('memvalidasi kolom wajib, mempertahankan draft, dan menolak validator tanpa request', async () => {
    const { onCreateRow } = tampilkan();
    const user = await mulai();
    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(screen.getByRole('status')).toHaveTextContent('Kode wajib diisi.');
    expect(screen.getByRole('textbox', { name: 'Kode' })).toHaveAttribute('aria-invalid', 'true');
    await user.type(screen.getByRole('textbox', { name: 'Kode' }), 'B');
    await user.type(screen.getByRole('textbox', { name: 'Nama' }), 'Ditolak');
    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(screen.getByRole('status')).toHaveTextContent('Nama tidak boleh Ditolak.');
    expect(screen.getByRole('textbox', { name: 'Kode' })).toHaveValue('B');
    expect(onCreateRow).not.toHaveBeenCalled();
  });

  it('Enter menyimpan tepat sekali selama request aktif lalu reset dan focus ke input awal', async () => {
    let selesai!: () => void;
    const onCreateRow = vi.fn(() => new Promise<void>((resolve) => { selesai = resolve; }));
    tampilkan({ onCreateRow });
    const user = await mulai();
    await user.type(screen.getByRole('textbox', { name: 'Kode' }), 'B');
    await user.type(screen.getByRole('textbox', { name: 'Nama' }), 'Bilal');
    const nama = screen.getByRole('textbox', { name: 'Nama' });
    fireEvent.keyDown(nama, { key: 'Enter' });
    fireEvent.keyDown(nama, { key: 'Enter' });
    expect(onCreateRow).toHaveBeenCalledTimes(1);
    expect(onCreateRow).toHaveBeenCalledWith({ kode: 'B', nama: 'Bilal', jenis: 'mi', aktif: 'tidak' });
    expect(screen.getByRole('button', { name: 'Menyimpan…' })).toBeDisabled();
    await act(async () => selesai());
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Kode' })).toHaveFocus());
    expect(screen.getByRole('textbox', { name: 'Nama' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Jenis' })).toHaveValue('mi');
  });

  it('gagal simpan mempertahankan draft untuk dicoba ulang, termasuk pengosongan default secara eksplisit', async () => {
    const onCreateRow = vi.fn().mockRejectedValueOnce(new Error('Server gagal')).mockResolvedValueOnce(undefined);
    tampilkan({ onCreateRow });
    const user = await mulai();
    await user.type(screen.getByRole('textbox', { name: 'Kode' }), 'B');
    await user.type(screen.getByRole('textbox', { name: 'Nama' }), 'Bilal');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Jenis' }), '');
    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(onCreateRow).not.toHaveBeenCalled();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Jenis' }), 'md');
    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Server gagal'));
    expect(screen.getByRole('textbox', { name: 'Nama' })).toHaveValue('Bilal');
    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    await waitFor(() => expect(onCreateRow).toHaveBeenCalledTimes(2));
    expect(onCreateRow).toHaveBeenLastCalledWith(expect.objectContaining({ jenis: 'md' }));
  });

  it('preset tidak menyembunyikan field wajib selama mode Input dan Escape mengembalikan focus', async () => {
    tampilkan();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Area filter' }));
    await user.click(screen.getByRole('button', { name: 'Hanya aktif' }));
    await mulai();
    expect(screen.getByRole('textbox', { name: 'Kode' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nama' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Nama' }), { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Kode' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambah baris' })).toHaveFocus();
  });

  it('row input dikecualikan dari centang, aksi record, dan hitungan data', async () => {
    const renderActions = vi.fn((r: { id: number }) => <span>Aksi {r.id}</span>);
    tampilkan({ renderActions });
    await mulai();
    expect(screen.queryByRole('checkbox', { name: 'Pilih baris __input__' })).toBeNull();
    expect(screen.getByText('1 baris')).toBeInTheDocument();
    expect(renderActions.mock.calls.every(([r]) => r.id === 1)).toBe(true);
  });

  it('tabel kosong dengan maxRows menampilkan row input tanpa empty overlay', async () => {
    tampilkan({ rows: [], maxRows: 3, emptyText: 'Tidak ada data demo' });
    await mulai();
    expect(screen.queryByText('Tidak ada data demo')).toBeNull();
    expect(screen.getByText('0 baris')).toBeInTheDocument();
    expect(dsgStub.tinggi).toBe(51);
  });

  it('tanpa onCreateRow tidak ada tombol tambah; loading menonaktifkan tombol', () => {
    const view = tampilkan({ onCreateRow: undefined });
    expect(screen.queryByRole('button', { name: 'Tambah baris' })).toBeNull();
    view.unmount();
    tampilkan({ loading: true });
    expect(screen.getByRole('button', { name: 'Tambah baris' })).toBeDisabled();
  });

  it('inputKind select memakai pilihan dari draft dan toggle terkirim sesuai input', async () => {
    const fieldDinamis: ExcelField[] = fields.map((f) => f.key === 'kode' ? {
      ...f, inputKind: 'select',
      inputChoices: (draft) => [{ value: draft.jenis === 'md' ? 'D' : 'I', label: draft.jenis === 'md' ? 'Kode MD' : 'Kode MI' }],
    } : f);
    const { onCreateRow } = tampilkan({ fields: fieldDinamis });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Tambah baris' }));
    await screen.findByRole('combobox', { name: 'Kode' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Jenis' }), 'md');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Kode' }), 'D');
    await user.type(screen.getByRole('textbox', { name: 'Nama' }), 'Bilal');
    await user.click(screen.getByRole('checkbox', { name: 'Aktif' }));
    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(onCreateRow).toHaveBeenCalledWith({ kode: 'D', nama: 'Bilal', jenis: 'md', aktif: 'ya' });
  });

  it('refetch tidak membuang draft dan Batal membersihkannya saat mode dibuka lagi', async () => {
    const { rerender, onCreateRow } = tampilkan();
    const user = await mulai();
    await user.type(screen.getByRole('textbox', { name: 'Nama' }), 'Draft');
    const props = { tableKey: 'contoh_input_test', fields, rows,
      getValues: (r: typeof rows[number]) => ({ kode: r.kode, nama: r.nama, jenis: r.jenis, aktif: r.aktif }),
      onApplyPreset: () => {}, onCreateRow, inputRowValues: { jenis: 'mi' }, maxRows: 3 };
    rerender(<ExcelTabelV2 {...props} loading />);
    expect(screen.getByRole('textbox', { name: 'Nama' })).toHaveValue('Draft');
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeDisabled();
    rerender(<ExcelTabelV2 {...props} loading={false} />);
    await user.click(screen.getByRole('button', { name: 'Batal' }));
    await mulai();
    expect(screen.getByRole('textbox', { name: 'Nama' })).toHaveValue('');
    expect(onCreateRow).not.toHaveBeenCalled();
  });
});
