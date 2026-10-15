import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderDenganTema } from '@/test/utils';
import RekapDispensasiCrosstab from './RekapDispensasiCrosstab';
import type { RekapDispensasiCrosstab as DataCrosstab } from '@/api/keuangan';

function data(partial: Partial<DataCrosstab> = {}): DataCrosstab {
  return {
    kolom: [
      { key: 'jenis-1', jenis_id: 1, jenis_nama: 'Infaq Bulanan' },
      { key: 'jenis-2', jenis_id: 2, jenis_nama: 'Biaya Masuk' },
    ],
    baris: [
      {
        id: 'MI|2025/2026|11', jenjang: 'MI', tahun_ajaran: '2025/2026',
        paket_id: 11, paket: 'Khusus MI',
        total_potongan: 60000, total_kotor: 130000, jumlah_tagihan: 2, jumlah_penerima: 2,
        sel: {
          'jenis-1': { potongan: 50000, kotor: 100000, tarif: 150000, persen: 50, jumlah_tagihan: 1 },
          'jenis-2': { potongan: 10000, kotor: 30000, tarif: null, persen: 33, jumlah_tagihan: 1 },
        },
      },
    ],
    ...partial,
  };
}

function render(dataCrosstab: DataCrosstab | null, loading = false) {
  return renderDenganTema(
    <RekapDispensasiCrosstab
      data={dataCrosstab}
      loading={loading}
      emptyText="Belum ada tagihan yang memuat dispensasi pada lingkup filter ini."
    />,
  );
}

/** Sel dicari lewat `id` (bukan teks) karena angka sel bisa sama dengan total
 *  baris/kolom — pencarian teks jadi ambigu. */
function sel(barisId: string, key: string): HTMLElement {
  return document.getElementById(`td_rekap_crosstab_${barisId}_${key}`) as HTMLElement;
}

/** Crosstab rekap: baris = paket × lembaga × TA, kolom = jenis tagihan yang
 *  terdampak, sel = total potongan paket di jenis itu. */
describe('RekapDispensasiCrosstab', () => {
  it('menampilkan identitas baris dan kolom jenis terdampak', () => {
    render(data());

    // Identitas baris: lembaga, paket, TA.
    expect(screen.getByText('MI')).toBeInTheDocument();
    expect(screen.getByText('Khusus MI')).toBeInTheDocument();
    expect(screen.getByText('2025/2026')).toBeInTheDocument();
    // Kolom = nama jenis tagihan.
    expect(screen.getByText('Infaq Bulanan')).toBeInTheDocument();
    expect(screen.getByText('Biaya Masuk')).toBeInTheDocument();
    // Header kolom memakai id snake_case.
    expect(document.getElementById('th_rekap_crosstab_jenis-1')).not.toBeNull();
  });

  it('sel berisi total potongan paket pada jenis itu', () => {
    render(data());

    expect(sel('MI|2025/2026|11', 'jenis-1').textContent).toBe('Rp 50.000');
    expect(sel('MI|2025/2026|11', 'jenis-2').textContent).toBe('Rp 10.000');
  });

  it('sel kosong ditandai titik, bukan Rp 0', () => {
    const d = data();
    // Paket tak menyentuh Biaya Masuk sama sekali.
    delete d.baris[0].sel['jenis-2'];
    render(d);

    // Rp 0 terbaca seperti "digratiskan"; titik menandai tak terdampak.
    expect(sel('MI|2025/2026|11', 'jenis-2').textContent).toBe('·');
    // Yang dicek hanya sel: footer kolom kosong memang menjumlah Rp 0
    // (itu total, bukan klaim "jenis ini gratis").
    const selKosong = document.querySelectorAll('td[id^="td_rekap_crosstab_"]');
    expect([...selKosong].every((td) => !/(^|\s)Rp 0(\s|$)/.test(td.textContent ?? ''))).toBe(true);
  });

  it('menjumlahkan total per baris dan total per kolom', () => {
    render(data());

    // Total baris = potongan dua jenis (60.000) — ada di sel total maupun footer.
    expect(screen.getAllByText('Rp 60.000').length).toBeGreaterThan(0);
    expect(screen.getByText('Total (tampil)')).toBeInTheDocument();
    // Footer per kolom: Infaq 50.000 & Biaya Masuk 10.000, masing-masing dobel
    // dengan selnya, jadi pakai *All*.
    expect(screen.getAllByText('Rp 50.000').length).toBeGreaterThanOrEqual(2);
  });

  it('tooltip membawa tarif, kotor, potongan, dan jumlah tagihan', async () => {
    render(data());

    await userEvent.hover(sel('MI|2025/2026|11', 'jenis-1'));

    await waitFor(() => {
      expect(screen.getByText('Tarif')).toBeInTheDocument();
    });
    expect(screen.getByText('Rp 150.000')).toBeInTheDocument();
    expect(screen.getByText('Rp 100.000')).toBeInTheDocument();
    expect(screen.getByText('Rp 50.000 (50%)')).toBeInTheDocument();
  });

  it('tarif yang belum diatur tampil sebagai "—" di tooltip', async () => {
    render(data());

    // Sel Biaya Masuk punya tarif null.
    await userEvent.hover(sel('MI|2025/2026|11', 'jenis-2'));

    await waitFor(() => {
      expect(screen.getByText('Tarif')).toBeInTheDocument();
    });
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('tanpa kolom menampilkan pesan kosong halaman', () => {
    render({ baris: [], kolom: [] });

    expect(
      screen.getByText('Belum ada tagihan yang memuat dispensasi pada lingkup filter ini.'),
    ).toBeInTheDocument();
  });

  it('saat memuat pertama kali menampilkan pesan muat', () => {
    render(null, true);

    expect(screen.getByText('Memuat…')).toBeInTheDocument();
  });
});
