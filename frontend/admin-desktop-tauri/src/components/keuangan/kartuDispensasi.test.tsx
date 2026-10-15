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

/** Kartu informasi paket terpilih di kolom kanan halaman Dispensasi: seluruh
 *  identitas paket + aturan potongannya. Isinya MURNI dari paket yang dipilih
 *  di tabel kiri — tak ada fetch di komponen ini. */
describe('KartuDispensasiTerpilih', () => {
  it('menampilkan identitas paket: nama, status, TA, jumlah penerima', () => {
    renderDenganTema(<KartuDispensasiTerpilih d={paket()} jumlahPenerima={3} />);

    expect(document.getElementById('kartu_dispensasi_nama')).toHaveTextContent('Anak Pegawai');
    expect(document.getElementById('kartu_dispensasi_status')).toHaveTextContent('Aktif');
    expect(document.getElementById('kartu_dispensasi_ta')).toHaveTextContent('2025/2026');
    expect(document.getElementById('kartu_dispensasi_penerima')).toHaveTextContent('3');
  });

  it('paket nonaktif diberi label Nonaktif', () => {
    renderDenganTema(<KartuDispensasiTerpilih d={paket({ is_active: false })} jumlahPenerima={0} />);
    expect(document.getElementById('kartu_dispensasi_status')).toHaveTextContent('Nonaktif');
  });

  it('kuota, grup, dan keterangan kosong ditulis apa adanya', () => {
    renderDenganTema(<KartuDispensasiTerpilih d={paket()} jumlahPenerima={0} />);
    expect(document.getElementById('kartu_dispensasi_kuota')).toHaveTextContent('Tanpa batas');
    expect(document.getElementById('kartu_dispensasi_grup')).toHaveTextContent('—');
    expect(document.getElementById('kartu_dispensasi_keterangan')).toHaveTextContent('—');
  });

  it('kuota, grup, dan keterangan terisi tampil apa adanya', () => {
    renderDenganTema(
      <KartuDispensasiTerpilih
        d={paket({ kuota_bulan: 6, grup: 'prestasi', keterangan: 'Untuk anak pegawai tetap' })}
        jumlahPenerima={1}
      />,
    );
    expect(document.getElementById('kartu_dispensasi_kuota')).toHaveTextContent('6 bulan');
    expect(document.getElementById('kartu_dispensasi_grup')).toHaveTextContent('prestasi');
    expect(document.getElementById('kartu_dispensasi_keterangan'))
      .toHaveTextContent('Untuk anak pegawai tetap');
  });

  it('aturan tiap jenis jadi chip "Jenis: potongan"', () => {
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

    expect(document.getElementById('kartu_dispensasi_aturan_11')).toHaveTextContent('SPP: 25%');
    // Aturan tanpa jenis = berlaku semua jenis tagihan.
    expect(document.getElementById('kartu_dispensasi_aturan_12')).toHaveTextContent('Semua jenis: Rp 5.000');
    expect(document.getElementById('kartu_dispensasi_aturan_kosong')).toBeNull();
  });

  it('paket tanpa aturan diberi keterangan kosong', () => {
    renderDenganTema(<KartuDispensasiTerpilih d={paket()} jumlahPenerima={0} />);
    expect(document.getElementById('kartu_dispensasi_aturan_kosong')).toHaveTextContent('belum ada aturan jenis');
    expect(screen.queryByText('SPP:')).toBeNull();
  });
});
