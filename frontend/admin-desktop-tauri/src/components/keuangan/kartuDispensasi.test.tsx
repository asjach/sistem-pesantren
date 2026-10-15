import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Dispensasi } from '@/api/keuangan';
import { renderDenganTema } from '@/test/utils';
import { KartuDispensasiTerpilih } from './tabKeuangan';

function paket(timpa: Partial<Dispensasi> = {}): Dispensasi {
  return {
    id: 1, nama: 'Anak Pegawai', keterangan: null, tahun_ajaran: '2025/2026',
    kuota_bulan: null, grup: null, santri_ids: null, is_active: true, aturan: [],
    ...timpa,
  };
}

const nilai = (id: string) => document.getElementById(id);

/** Kartu informasi paket terpilih di kolom kanan halaman Dispensasi: kepala
 *  (nama + status + jumlah penerima) lalu label–nilai sejajar kolom + chip
 *  aturan. Isinya MURNI dari paket yang dipilih di tabel kiri. */
describe('KartuDispensasiTerpilih', () => {
  it('kepala: nama, badge status, dan jumlah penerima', () => {
    renderDenganTema(<KartuDispensasiTerpilih d={paket()} jumlahPenerima={3} />);

    expect(nilai('kartu_dispensasi_nama')).toHaveTextContent('Anak Pegawai');
    expect(nilai('kartu_dispensasi_status')).toHaveTextContent('Aktif');
    expect(nilai('kartu_dispensasi_status')).toHaveAttribute('data-variant', 'default');
    expect(nilai('kartu_dispensasi_penerima')).toHaveTextContent('3');
  });

  it('paket nonaktif diberi badge Nonaktif bergaya peringatan', () => {
    renderDenganTema(<KartuDispensasiTerpilih d={paket({ is_active: false })} jumlahPenerima={0} />);
    expect(nilai('kartu_dispensasi_status')).toHaveTextContent('Nonaktif');
    expect(nilai('kartu_dispensasi_status')).toHaveAttribute('data-variant', 'destructive');
  });

  it('label–nilai: tiap label punya barisnya sendiri (TA, kuota, grup, keterangan)', () => {
    renderDenganTema(
      <KartuDispensasiTerpilih
        d={paket({ kuota_bulan: 6, grup: 'prestasi', keterangan: 'Untuk anak pegawai tetap' })}
        jumlahPenerima={1}
      />,
    );

    for (const label of ['Tahun ajaran', 'Kuota', 'Grup', 'Keterangan', 'Aturan']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(nilai('kartu_dispensasi_ta')).toHaveTextContent('2025/2026');
    expect(nilai('kartu_dispensasi_kuota')).toHaveTextContent('6 bulan');
    expect(nilai('kartu_dispensasi_grup')).toHaveTextContent('prestasi');
    expect(nilai('kartu_dispensasi_keterangan')).toHaveTextContent('Untuk anak pegawai tetap');
  });

  it('kuota, grup, dan keterangan kosong ditulis "—" tanpa nilai palsu', () => {
    renderDenganTema(<KartuDispensasiTerpilih d={paket()} jumlahPenerima={0} />);
    expect(nilai('kartu_dispensasi_kuota')).toHaveTextContent('Tanpa batas');
    expect(nilai('kartu_dispensasi_grup')).toHaveTextContent('—');
    expect(nilai('kartu_dispensasi_keterangan')).toHaveTextContent('—');
  });

  it('aturan tiap jenis jadi chip "Jenis potongan" yang terbaca utuh', () => {
    renderDenganTema(
      <KartuDispensasiTerpilih
        d={paket({
          aturan: [
            { id: 11, dispensasi_id: 1, jenis_id: 7, tipe: 'persen', nilai: 25, jenis: { id: 7, nama: 'SPP' } },
            { id: 12, dispensasi_id: 1, jenis_id: null, tipe: 'nominal', nilai: 5000, jenis: null },
          ],
        })}
        jumlahPenerima={0}
      />,
    );

    // Chip memisahkan jenis & potongan secara VISUAL (gap) — nama aksesibilitas
    // dan tooltip-nya tetap satu kalimat utuh.
    expect(nilai('kartu_dispensasi_aturan_11')).toHaveAccessibleName('SPP: 25%');
    expect(nilai('kartu_dispensasi_aturan_11')).toHaveTextContent('25%');
    // Aturan tanpa jenis = berlaku semua jenis tagihan (nama lengkapnya
    // dipakai di title/aria, teks visualnya cukup "Semua jenis").
    expect(nilai('kartu_dispensasi_aturan_12')).toHaveAccessibleName('Semua jenis tagihan: Rp 5.000');
    expect(nilai('kartu_dispensasi_aturan_kosong')).toBeNull();
  });

  it('paket tanpa aturan diberi keterangan kosong, bukan chip palsu', () => {
    renderDenganTema(<KartuDispensasiTerpilih d={paket()} jumlahPenerima={0} />);
    expect(nilai('kartu_dispensasi_aturan_kosong')).toHaveTextContent('belum ada aturan jenis');
    expect(screen.queryByText('SPP')).toBeNull();
  });
});
