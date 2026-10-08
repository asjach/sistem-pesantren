import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import DialogLihatLembaga, { formatTanggalLembaga } from './DialogLihatLembaga';
import { renderDenganTema } from '@/test/utils';
import type { Lembaga } from '@/api/master';

const penuh: Lembaga = {
  id: 'MI',
  jenjang: 'MI',
  nama: 'Madrasah Ibtidaiyah Contoh',
  nama_singkat: 'MI Contoh',
  mudir_am: 'H. Ahmad',
  status: 'swasta',
  npsn: '12345678',
  nsm: '123456789012',
  npwp: '01.234.567.8-901.000',
  no_izin_operasional: '421.1/001/2020',
  tgl_izin: '2020-03-02',
  no_sk_pendirian: 'SK-1',
  tgl_sk_pendirian: '1998-07-01',
  tahun_berdiri: 1998,
  no_sk_kemenkumham: 'AHU-1',
  akreditasi: 'A',
  tgl_akreditasi: '2023-11-20',
  penyelenggara: 'Yayasan Contoh',
  provinsi: 'Jawa Barat',
  kab_kota: 'Bandung',
  kecamatan: 'Coblong',
  desa: 'Dago',
  rt: '001',
  rw: '002',
  kode_pos: '40135',
  alamat: 'Jl. Contoh No. 1',
  lintang: -6.89,
  bujur: 107.61,
  telepon: '022123456',
  email: 'info@contoh.sch.id',
  website: 'contoh.sch.id',
  logo_url: 'https://contoh.sch.id/logo.png',
  waktu_belajar: 'pagi_siang',
  mode_rapor: 'digabung',
  template_rapor: 'rapor-mi',
  is_active: true,
  kelompok_psb: 'combo_mi_md',
  is_seleksi: true,
};

const kosong: Lembaga = {
  id: 'MD',
  jenjang: 'MD',
  nama: 'Madrasah Diniyah',
};

function renderDialog(props: Partial<React.ComponentProps<typeof DialogLihatLembaga>> = {}) {
  return renderDenganTema(
    <DialogLihatLembaga open onOpenChange={() => {}} lembaga={penuh} {...props} />,
  );
}

describe('formatTanggalLembaga', () => {
  it('memformat ISO ke Bahasa Indonesia', () => {
    expect(formatTanggalLembaga('2020-03-02')).toBe('2 Mar 2020');
  });

  it('mentoleransi ekor waktu dan nilai tak valid', () => {
    expect(formatTanggalLembaga('1998-07-01T00:00:00.000000Z')).toBe('1 Jul 1998');
    expect(formatTanggalLembaga('kapan-kapan')).toBe('kapan-kapan');
    expect(formatTanggalLembaga(null)).toBeNull();
    expect(formatTanggalLembaga('')).toBeNull();
  });
});

describe('DialogLihatLembaga', () => {
  it('menampilkan seluruh seksi dan seluruh data', () => {
    renderDialog();
    for (const seksi of ['Identitas', 'Legalitas & Akreditasi', 'Alamat & Kontak', 'Operasional & PSB']) {
      expect(screen.getByRole('heading', { name: seksi })).toBeInTheDocument();
    }
    // Identitas + terjemahan kode.
    expect(screen.getByText('Madrasah Ibtidaiyah Contoh')).toBeInTheDocument();
    // Lencana ringkasan + baris nilai memakai label sama.
    expect(screen.getAllByText('Swasta')).toHaveLength(2);
    expect(screen.getAllByText('Aktif')).toHaveLength(2);
    expect(within(screen.getByLabelText('Ringkasan status')).getByText('Jenjang MI')).toBeInTheDocument();
    // Legalitas: tanggal terformat, akreditasi, tahun.
    expect(screen.getByText('2 Mar 2020')).toBeInTheDocument();
    expect(screen.getByText('1998')).toBeInTheDocument();
    // Alamat gabungan RT/RW + kontak.
    expect(screen.getByText('001 / 002')).toBeInTheDocument();
    expect(screen.getByText('info@contoh.sch.id')).toBeInTheDocument();
    // Operasional: kode diterjemahkan.
    expect(screen.getByText('Pagi dan siang')).toBeInTheDocument();
    expect(screen.getByText('Digabung')).toBeInTheDocument();
    expect(screen.getByText('Combo MI-MD')).toBeInTheDocument();
    // Lencana ringkasan.
    expect(within(screen.getByLabelText('Ringkasan status')).getByText('Aktif')).toBeInTheDocument();
  });

  it('kolom kosong tampil "—", bukan hilang atau diklaim', () => {
    renderDialog({ lembaga: kosong });
    // Nama singkat kosong → baris tetap ada berisi strip.
    const baris = screen.getByText('Nama singkat').closest('div');
    expect(baris).not.toBeNull();
    expect(baris).toHaveTextContent('—');
    // Status aktif tak diketahui → tanpa lencana, baris strip.
    const ringkas = screen.getByLabelText('Ringkasan status');
    expect(within(ringkas).queryByText('Nonaktif')).not.toBeInTheDocument();
    expect(within(ringkas).queryByText('Aktif')).not.toBeInTheDocument();
    const aktif = screen.getByText('Aktif', { selector: 'dt' });
    expect(aktif.closest('div')).toHaveTextContent('—');
  });

  it('tombol Ubah hanya bila diizinkan dan memanggil onUbah', () => {
    const onUbah = vi.fn();
    const { rerender } = renderDenganTema(
      <DialogLihatLembaga open onOpenChange={() => {}} lembaga={penuh} />,
    );
    expect(screen.queryByRole('button', { name: 'Ubah' })).not.toBeInTheDocument();
    rerender(<DialogLihatLembaga open onOpenChange={() => {}} lembaga={penuh} onUbah={onUbah} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ubah' }));
    expect(onUbah).toHaveBeenCalledTimes(1);
  });
});
