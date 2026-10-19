import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderDenganTema } from '@/test/utils';
import BatchAksiTagihan, { type TargetBuatKolom } from './BatchAksiTagihan';

/** Satu kolom target Buat Massal (jenis + periode datang dari kolomnya). */
function kolom(
  key: string,
  jenisNama: string,
  tipe: 'bulanan' | 'non_bulanan',
  periode: string | null,
  santriIds: number[],
): TargetBuatKolom {
  return { key, kolom: { key, jenis_id: 1, jenis_nama: jenisNama, tipe, periode }, santriIds };
}

function renderBuat(p: Partial<Parameters<typeof BatchAksiTagihan>[0]> = {}) {
  const onKonfirmasi = vi.fn();
  const onNominalBuat = vi.fn();
  const onJatuhTempoBuat = vi.fn();
  renderDenganTema(
    <BatchAksiTagihan
      aksi="buat"
      jumlah={6}
      totalSisa={0}
      busy={false}
      metode="tunai"
      kas="tunai_tu"
      onMetode={() => {}}
      onKas={() => {}}
      pakaiJatuhTempo={false}
      jatuhTempo=""
      onPakaiJatuhTempo={() => {}}
      onJatuhTempo={() => {}}
      dispen=""
      onDispen={() => {}}
      daftarDispen={[]}
      targetBuat={[
        kolom('11-2026-11', 'Infaq Bulanan', 'bulanan', '2026-11', [1, 2, 3]),
        kolom('jenis-2', 'Daftar Ulang', 'non_bulanan', null, [4, 5]),
      ]}
      nonaktifDilewati={0}
      nominalBuat={{ '11-2026-11': '75000', 'jenis-2': '150000' }}
      onNominalBuat={onNominalBuat}
      jatuhTempoBuat={{ 'jenis-2': '2026-10-20' }}
      onJatuhTempoBuat={onJatuhTempoBuat}
      galatBuat={null}
      onBatal={() => {}}
      onKonfirmasi={onKonfirmasi}
      {...p}
    />,
  );
  return { onKonfirmasi, onNominalBuat, onJatuhTempoBuat };
}

describe('BatchAksiTagihan — Buat Massal per sel', () => {
  it('menampilkan satu kartu per kolom target + jumlah tagihan yang akan dibuat', () => {
    renderBuat();

    expect(screen.getByText('5 tagihan')).toBeInTheDocument();
    expect(screen.getByText(/1 sel sudah punya tagihan dilewati/)).toBeInTheDocument();

    expect(screen.getByText('Infaq Bulanan · Nov 2026')).toBeInTheDocument();
    expect(screen.getByText('Daftar Ulang · sekali')).toBeInTheDocument();
    expect(screen.getByText(/3 santri/)).toBeInTheDocument();
    expect(screen.getByText(/2 santri/)).toBeInTheDocument();
  });

  it('nominal per kolom terisi dari prop dan perubahannya diteruskan', () => {
    const { onNominalBuat } = renderBuat();
    const nominalBulanan = document.getElementById('inp_batch_buat_nominal_11_2026_11') as HTMLInputElement;
    const nominalSekali = document.getElementById('inp_batch_buat_nominal_jenis_2') as HTMLInputElement;
    expect(nominalBulanan.value).toBe('75000');
    expect(nominalSekali.value).toBe('150000');

    fireEvent.change(nominalSekali, { target: { value: '175000' } });
    expect(onNominalBuat).toHaveBeenLastCalledWith('jenis-2', '175000');
  });

  it('jatuh tempo hanya untuk kolom non-bulanan (bulanan tetap tanggal 10)', () => {
    renderBuat();
    expect(document.getElementById('inp_batch_buat_jt_11_2026_11')).toBeNull();
    const jt = document.getElementById('inp_batch_buat_jt_jenis_2') as HTMLInputElement;
    expect(jt.value).toBe('2026-10-20');
  });

  it('kolom nonaktif dilewati dilaporkan terpisah', () => {
    renderBuat({ nonaktifDilewati: 2 });
    expect(screen.getByText('2 sel santri nonaktif dilewati.')).toBeInTheDocument();

    expect(screen.queryByText(/sel sudah punya tagihan dilewati/)).toBeNull();
  });

  it('tanpa sel kosong: tak ada kartu kolom, hanya pesan', () => {
    renderBuat({ targetBuat: [], nominalBuat: {}, jumlah: 3 });
    expect(screen.getByText('0 tagihan')).toBeInTheDocument();
    expect(screen.getByText('Tak ada sel kosong pada kolom yang terseleksi.')).toBeInTheDocument();
  });

  it('galat validasi ditampilkan dan tombol Buat meneruskan konfirmasi', async () => {
    const { onKonfirmasi } = renderBuat({ galatBuat: 'Nominal Infaq Bulanan · Nov 2026 harus bilangan bulat ≥ 0.' });
    expect(screen.getByRole('alert')).toHaveTextContent('harus bilangan bulat');

    await userEvent.click(document.getElementById('btn_batch_konfirmasi')!);
    expect(onKonfirmasi).toHaveBeenCalledTimes(1);
  });
});
