import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import DashboardPage from './DashboardPage';
import { renderDenganTema } from '@/test/utils';

vi.mock('@/api/master', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/master')>();
  const data = {
    lembaga: 4,
    pengguna: 73,
    tahun_ajaran_aktif: 1,
    kelas: 588,
    kelas_aktif: 32,
    tahun_aktif: [
      { nama: '2026/2027', tanggal_mulai: '2026-07-01', tanggal_selesai: '2027-06-30', is_aktif: true },
    ],
    santri: {
      total: 552,
      laki_laki: 272,
      perempuan: 280,
      asrama: 0,
      non_asrama: 552,
      baru_ta_aktif: 75,
      per_lembaga: [
        { jenjang: 'MD', nama: 'Diniyah', jumlah: 519 },
        { jenjang: 'MI', nama: 'Ibtidaiyah', jumlah: 543 },
      ],
      per_tingkat: [
        { jenjang: 'MI', tingkat: '1', jumlah: 72 },
        { jenjang: 'MI', tingkat: '2', jumlah: 104 },
      ],
    },
    pegawai: {
      total: 107,
      aktif: 66,
      per_lembaga: [{ jenjang: 'MI', nama: 'Ibtidaiyah', jumlah: 34 }],
    },
    keuangan: {
      jumlah_tagihan: 7186,
      nominal: 575050000,
      terbayar: 400000,
      tunggakan: 204025000,
      lunas: 5,
      belum: 7180,
      sebagian: 1,
    },
    siklus: {
      alumni: 2132,
      alumni_ta_aktif: 0,
      mutasi: 726,
      mutasi_ta_aktif: 18,
      alumni_per_ta: [
        { tahun_ajaran: '2024/2025', jumlah: 165 },
        { tahun_ajaran: '2025/2026', jumlah: 156 },
      ],
    },
    psb: { total: 0, per_status: {} },
  };
  return { ...asli, ringkasan: vi.fn(async () => data) };
});

describe('DashboardPage — statistik', () => {
  it('menampilkan KPI dan blok statistik dari data ringkasan', async () => {
    renderDenganTema(<DashboardPage />);

    expect(await screen.findByText('552', { selector: '#dashboard_angka_pokok' })).toBeInTheDocument();
    expect(screen.getByText('Rp 204.025.000')).toBeInTheDocument();
    expect(screen.getByText('PTK aktif')).toBeInTheDocument();
    expect(screen.getByText('Per tingkat, 2026/2027')).toBeInTheDocument();
    expect(screen.getAllByText('Ibtidaiyah (MI)').length).toBeGreaterThan(0);
    expect(screen.getByText('Alumni per tahun ajaran')).toBeInTheDocument();

    expect(screen.getByText('Belum ada calon pada lingkup ini')).toBeInTheDocument();
  });

  it('menyembunyikan blok santri/PTK bila akun tidak berizin modulnya', async () => {
    const master = await import('@/api/master');
    vi.mocked(master.ringkasan).mockResolvedValueOnce({
      lembaga: 4,
      pengguna: 73,
      tahun_ajaran_aktif: 1,
      kelas: 588,
      kelas_aktif: 32,
      tahun_aktif: [],
      santri: null,
      pegawai: null,
      keuangan: null,
      siklus: null,
      psb: null,
    });

    renderDenganTema(<DashboardPage />);

    expect(await screen.findByText('Kelas TA aktif')).toBeInTheDocument();
    expect(screen.queryByText(/Per tingkat/)).not.toBeInTheDocument();
    expect(screen.queryByText('Antrean PSB')).not.toBeInTheDocument();
  });
});
