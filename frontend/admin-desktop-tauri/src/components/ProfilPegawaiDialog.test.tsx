import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfilPegawaiDialog } from '@/components/ProfilPegawaiDialog';
import { profilPegawai, unduhProfilPegawaiPdf, type ProfilPegawai } from '@/api/pegawai';
import { renderDenganTema } from '@/test/utils';

vi.mock('@/api/pegawai', () => ({
  profilPegawai: vi.fn(),
  unduhProfilPegawaiPdf: vi.fn(async () => {}),
}));

const profil: ProfilPegawai = {
  pegawai: {
    id: 7,
    user_id: 21,
    nip: '198501012010012001',
    nipp: null,
    nik: null,
    nama_lengkap: 'Ahmad Fauzi',
    gelar_depan: null,
    gelar_belakang: 'S.Pd.',
    jenis_kelamin: 'L',
    tempat_lahir: 'Jombang',
    tanggal_lahir: '1985-01-01',
    no_hp: null,
    email_pribadi: null,
    email_gws: null,
    status_aktif: 'Ya',
    tgl_mulai_kerja: null,
    no_sk_awal: null,
    tgl_sk_awal: null,
    pendidikan_terakhir: null,
    jenis_ptk: null,
    status_pernikahan: null,
    agama: null,
    gol_darah: null,
    foto_url: null,
    npwp: null,
    no_kk: null,
    no_bpjs: null,
    status_tempat_tinggal: null,
    niat_npa: null,
    jarak_ke_pesantren: null,
    waktu_tempuh: null,
    transportasi: null,
    sertifikasi: null,
    provinsi: null,
    kab_kota: null,
    kecamatan: null,
    desa_kelurahan: null,
    rt: null,
    rw: null,
    kode_pos: null,
    alamat: null,
  },
  penempatan: [
    {
      id: 3,
      pegawai_id: 7,
      jenjang: 'MI',
      tugas_utama: 'Guru Kelas',
      is_active_lembaga: 'Ya',
      tgl_masuk: '2010-07-01',
      tgl_selesai: null,
      tahaj_masuk: null,
      no_sk_awal_ptk: 'SK/12/2010',
      tgl_sk_awal_ptk: '2010-07-01',
      lembaga: { jenjang: 'MI', nama: 'Madrasah Ibtidaiyah' },
    },
  ],
  keaktifan: [
    {
      id: 9,
      pegawai_id: 7,
      jenjang: 'MI',
      tahun_ajaran: '2026/2027',
      tugas_utama: 'Guru Kelas',
      status_keaktifan: 'inaktif',
      no_sk: 'SK/77/2026',
      tgl_sk: '2026-07-01',
      lembaga: { jenjang: 'MI', nama: 'Madrasah Ibtidaiyah' },
    },
  ],
  akun: {
    id: 21,
    name: 'Ahmad Fauzi',
    email: 'ahmad.fauzi@example.com',
    phone: '628991234567',
    username: null,
    roles: [{ id: 2, name: 'guru' }],
    lembagas: [{ jenjang: 'MI', nama: 'Madrasah Ibtidaiyah', pivot: { role: 'guru' } }],
  },
};

describe('ProfilPegawaiDialog', () => {
  beforeEach(() => {
    vi.mocked(profilPegawai).mockResolvedValue(profil);
    vi.mocked(unduhProfilPegawaiPdf).mockResolvedValue(undefined);
  });

  it('memuat profil lalu menampilkan identitas, penempatan, keaktifan, dan akun', async () => {
    renderDenganTema(
      <ProfilPegawaiDialog pegawaiId={7} open onOpenChange={() => {}} />,
    );

    await waitFor(() => expect(profilPegawai).toHaveBeenCalledWith(7));

    // Identitas Buku Induk (baris skalar).
    expect(await screen.findByText('Profil: Ahmad Fauzi')).toBeInTheDocument();
    expect(screen.getByText('Jombang')).toBeInTheDocument();
    expect(screen.getByText('S.Pd.')).toBeInTheDocument();

    // Seksi relasi.
    expect(screen.getByText('Penempatan lembaga')).toBeInTheDocument();
    expect(screen.getByText('Keaktifan per tahun ajaran')).toBeInTheDocument();
    expect(screen.getByText('Akun login tertaut')).toBeInTheDocument();
    expect(screen.getByText('SK/12/2010')).toBeInTheDocument();
    expect(screen.getByText('SK/77/2026')).toBeInTheDocument();
    // Status keaktifan ditampilkan sebagai teks berkapital.
    expect(screen.getByText('Inaktif')).toBeInTheDocument();
    // Peran + akses lembaga akun tertaut.
    expect(screen.getByText('Guru')).toBeInTheDocument();
    expect(screen.getByText('MI (Guru)')).toBeInTheDocument();
  });

  it('mengunduh PDF profil dari footer dialog', async () => {
    renderDenganTema(
      <ProfilPegawaiDialog pegawaiId={7} open onOpenChange={() => {}} />,
    );

    const tombol = await screen.findByRole('button', { name: /unduh pdf/i });
    await waitFor(() => expect(tombol).toBeEnabled());
    await userEvent.click(tombol);

    await waitFor(() => expect(unduhProfilPegawaiPdf).toHaveBeenCalledWith(7));
  });

  it('menampilkan "Tidak ada data" bila tanpa penempatan, keaktifan, dan akun', async () => {
    vi.mocked(profilPegawai).mockResolvedValue({
      ...profil,
      penempatan: [],
      keaktifan: [],
      akun: null,
    });

    renderDenganTema(
      <ProfilPegawaiDialog pegawaiId={8} open onOpenChange={() => {}} />,
    );

    // Tiga seksi kosong (penempatan, keaktifan, akun) → masing-masing "Tidak ada data.".
    expect(await screen.findAllByText('Tidak ada data.')).toHaveLength(3);
  });
});
