import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ProfilSantriDialog } from './ProfilSantriDialog';
import { renderDenganTema } from '@/test/utils';
import type { ProfilSantri } from '@/api/siklus';

const profil: ProfilSantri = {
  santri: {
    id: 7,
    nama_lengkap: 'Ahmad Fauzi',
    nama_singkat: 'Fauzi',
    nik: '3201011505950001',
    nisn: '0123456789',
    tmp_lahir: 'Bandung',
    tgl_lahir: '1995-05-15T00:00:00.000000Z',
    jk: 'L',
    tipe_santri: 'asrama',
    is_active_pst: 'Ya',
    // Kolom profil yang tidak ada di tipe ringkas tetap diteruskan apa adanya.
    ...({ agama: 'Islam', ayah_nik: '3201011205600002', wali_nama: null } as object),
  } as unknown as ProfilSantri['santri'],
  keanggotaan: [],
  riwayat: [
    {
      id: 1,
      tahun_ajaran: { nama: '2025/2026' },
      jenjang: 'MTs',
      semester: '1',
      tingkat: '7',
      status_awal: 'baru',
      status_akhir: 'naik',
      is_active_riwayat: 'Ya',
    },
  ] as unknown as ProfilSantri['riwayat'],
  mutasi: [],
  alumni: [],
} as unknown as ProfilSantri;

vi.mock('@/api/siklus', async (importOriginal) => {
  const asli = await importOriginal<typeof import('@/api/siklus')>();
  return { ...asli, profilSantri: vi.fn(async () => profil) };
});

function renderDialog() {
  return renderDenganTema(<ProfilSantriDialog santriId={7} open onOpenChange={() => {}} />);
}

describe('ProfilSantriDialog', () => {
  it('mengelompokkan field ke dalam tab, bukan satu daftar panjang', async () => {
    renderDialog();

    expect(await screen.findByRole('heading', { name: 'Ahmad Fauzi' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Identitas' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Alamat' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Keluarga' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Keanggotaan & riwayat/ })).toBeInTheDocument();
  });

  it('tab identitas: label ramah, nilai terkode dibaca, field kosong tampil "—"', async () => {
    renderDialog();
    await screen.findByRole('heading', { name: 'Ahmad Fauzi' });

    expect(screen.getByText('Nama lengkap')).toBeInTheDocument();
    expect(screen.getByText('3201011505950001')).toBeInTheDocument();
    // jk 'L' dan tipe_santri 'asrama' diterjemahkan, bukan kode mentah.
    expect(screen.getByText('Laki-laki')).toBeInTheDocument();
    // Panel Alamat tidak aktif, jadi isinya belum dirender — '—' milik tab ini.
    expect(within(screen.getByRole('tabpanel')).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('tab keluarga: field orang tua/wali punya label sendiri per orang', async () => {
    const user = userEvent.setup();
    renderDialog();
    await screen.findByRole('heading', { name: 'Ahmad Fauzi' });

    await user.click(screen.getByRole('tab', { name: 'Keluarga' }));

    const panel = screen.getByRole('tabpanel');
    for (const judul of ['Ayah', 'Ibu', 'Wali', 'Kartu keluarga']) {
      expect(within(panel).getByText(judul)).toBeInTheDocument();
    }
    // NIK ayah tampil di panel Ayah, bukan label mentah `ayah_nik`.
    expect(within(panel).getByText('3201011205600002')).toBeInTheDocument();
    expect(within(panel).queryByText('ayah_nik')).not.toBeInTheDocument();
  });

  it('tab keanggotaan & riwayat: jumlah baris per tabel dan pesan kosong', async () => {
    const user = userEvent.setup();
    renderDialog();
    await screen.findByRole('heading', { name: 'Ahmad Fauzi' });

    await user.click(screen.getByRole('tab', { name: /Keanggotaan & riwayat/ }));

    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText(/^Riwayat belajar/)).toBeInTheDocument();
    expect(within(panel).getByText('(1)')).toBeInTheDocument();
    // Tiga tabel tanpa data → pesan kosong, bukan tabel kosong.
    expect(within(panel).getAllByText('Tidak ada data.')).toHaveLength(3);
  });
});
