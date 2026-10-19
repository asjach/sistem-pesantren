import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PembayaranPage from './PembayaranPage';

const uji = vi.hoisted(() => ({
  catat: vi.fn(), tagihan: vi.fn(), santri: vi.fn(),
  filter: { jenjangs: ['MI'], tahunAjaranNames: ['2025/2026'], kelas: [], loading: false },
  user: { permissions: ['keuangan.tambah'] },
}));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ user: uji.user }) }));
vi.mock('@/hooks/useFilterGlobalAktif', () => ({ useFilterGlobalAktif: () => uji.filter }));
vi.mock('@/api/keuangan', () => ({
  catatTransaksi: (...args: unknown[]) => uji.catat(...args),
  daftarTagihan: (...args: unknown[]) => uji.tagihan(...args),
  daftarPembayaranHarian: async () => ({ data: [], rekap: [], total: 0 }),
}));
vi.mock('@/api/santri', () => ({ listSantri: (...args: unknown[]) => uji.santri(...args) }));
vi.mock('@/api/master', () => ({ listKelas: async () => ({ data: [] }) }));
vi.mock('@/icons', () => ({ Plus: () => null, X: () => null, Check: () => null, Minus: () => null, AlertCircle: () => null }));
vi.mock('@/components/VisibilitasFilter', () => ({ PengaturanHalaman: () => null }));
vi.mock('@/components/ui/resizable', () => {
  const Panel = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { ResizablePanel: Panel, ResizablePanelGroup: Panel, ResizableHandle: () => null };
});
vi.mock('@/components/LabeledInput', () => ({ default: ({ label, htmlFor, value, onChange, readOnly }: { label: string; htmlFor: string; value?: string; onChange?: React.ChangeEventHandler<HTMLInputElement>; readOnly?: boolean }) => <label>{label}<input id={htmlFor} value={value ?? ''} onChange={onChange} readOnly={readOnly || !onChange} /></label> }));
vi.mock('@/components/LabeledCombobox', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/ui/combobox', () => {
  const Box = ({ children }: { children?: ReactNode }) => typeof children === 'function' ? null : <div>{children}</div>;
  return { ComboboxRoot: Box, ComboboxContent: () => null, ComboboxEmpty: Box, ComboboxInput: () => null, ComboboxItem: Box, ComboboxList: Box, ComboboxTrigger: () => null };
});
vi.mock('@/components/ExcelTable', () => ({
  default: ({ rows, renderActions, onBarisKlik }: { rows: { id: number; nama_lengkap?: string }[]; renderActions: (r: unknown) => ReactNode; onBarisKlik?: (r: unknown) => void }) => <div>{rows.map((r) => <div key={r.id}>{onBarisKlik && <button onClick={() => onBarisKlik(r)}>{r.nama_lengkap}</button>}{renderActions(r)}</div>)}</div>,
}));

const santri = { id: 1, nama_lengkap: 'Ahmad', lembaga_aktif: [] };
const biaya = { id: 11, santri_id: 1, nominal: 100, terbayar: 0, jenis: { nama: 'Infaq', tipe: 'bulanan' }, periode: '2025-07' };

beforeEach(() => {
  vi.clearAllMocks();
  uji.santri.mockResolvedValue({ data: [santri] });
  uji.tagihan.mockResolvedValue({ data: [biaya] });
});

async function siapkanCheckout() {
  render(<PembayaranPage />);
  fireEvent.click(document.getElementById('btn_tambah_pembayaran')!);
  fireEvent.click(document.getElementById('btn_pilih_santri')!);
  fireEvent.click(await screen.findByText('Ahmad', { selector: 'button' }));
  await waitFor(() => expect(document.getElementById('btn_bayar_tambah_11')).toBeInTheDocument());
  fireEvent.click(document.getElementById('btn_bayar_tambah_11')!);
  fireEvent.change(screen.getByLabelText('Jumlah bayar Infaq'), { target: { value: '20' } });
}

describe('checkout pembayaran', () => {
  it('mengunci kirim dan isian sampai transaksi selesai agar cicilan tidak tercatat dua kali', async () => {
    let selesai!: (value: unknown) => void;
    uji.catat.mockReturnValue(new Promise((r) => { selesai = r; }));
    await siapkanCheckout();
    const bayar = document.getElementById('btn_bayar_sekaligus')!;
    fireEvent.click(bayar);
    fireEvent.click(bayar);
    expect(uji.catat).toHaveBeenCalledTimes(1);
    expect(bayar).toBeDisabled();
    expect(screen.getByLabelText('Jumlah bayar Infaq')).toBeDisabled();
    expect(uji.catat.mock.calls[0][0].items).toEqual([{ tagihan_id: 11, jumlah: 20 }]);
    await act(async () => selesai({ no_kwitansi: 'Q-1', total: 20, jumlah_baris: 1 }));
    expect(await screen.findByText('Pembayaran tersimpan')).toBeInTheDocument();
  });

  it('membuka kunci lagi ketika penyimpanan gagal tanpa menghilangkan draf cicilan', async () => {
    uji.catat.mockRejectedValue(new Error('Server gagal'));
    await siapkanCheckout();
    fireEvent.click(document.getElementById('btn_bayar_sekaligus')!);
    await waitFor(() => expect(document.getElementById('btn_bayar_sekaligus')).toBeEnabled());
    expect(screen.getByLabelText('Jumlah bayar Infaq')).toHaveValue(20);
  });
});
