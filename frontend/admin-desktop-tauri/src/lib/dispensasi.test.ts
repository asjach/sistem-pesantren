import { describe, expect, it } from 'vitest';

import type { Dispensasi } from '@/api/keuangan';
import {
  alokasiPaketKuota,
  aturanUntukJenis,
  hitungDispensasi,
  ringkasAturan,
  saringDispensasi,
  sisaKuota,
} from './dispensasi';

function paket(
  timpa: Partial<Dispensasi> & { id: number },
  aturan: Dispensasi['aturan'] = [],
  santriIds: number[] | null = null,
): Dispensasi {
  return {
    nama: `Paket ${timpa.id}`,
    keterangan: null,
    tahun_ajaran: '2025/2026',
    is_active: true,
    aturan,
    santri_ids: santriIds,
    ...timpa,
  } as Dispensasi;
}

function aturan(id: number, jenisId: number | null, tipe: 'persen' | 'nominal' | 'bebas', nilai: number) {
  return { id, dispensasi_id: 0, jenis_id: jenisId, tipe, nilai };
}

describe('aturanUntukJenis', () => {
  it('spesifik menang atas umum; null bila tak ada yang cocok', () => {
    const d = paket({ id: 1 }, [aturan(1, null, 'nominal', 5000), aturan(2, 7, 'persen', 50)]);
    expect(aturanUntukJenis(d, 7)?.nilai).toBe(50);
    expect(aturanUntukJenis(d, 9)?.nilai).toBe(5000);
    expect(aturanUntukJenis(paket({ id: 2 }, [aturan(3, 8, 'persen', 10)]), 9)).toBeNull();
  });
});

describe('saringDispensasi', () => {
  it('hanya penerima terdaftar; null tak cocok siapa pun', () => {
    const daftar = [
      paket({ id: 1 }, [], [7]),
      paket({ id: 2 }, [], null),
      paket({ id: 3 }, [], [8]),
    ];
    expect(saringDispensasi(daftar, 7).map((d) => d.id)).toEqual([1]);
    expect(saringDispensasi(daftar, 9)).toEqual([]);
  });
});

describe('hitungDispensasi', () => {
  it('akumulatif urut id: persen lalu nominal', () => {
    const daftar = [
      paket({ id: 2 }, [aturan(1, 1, 'nominal', 10000)]),
      paket({ id: 1 }, [aturan(2, 1, 'persen', 50)]),
    ];
    // 100.000 → 50% = 50.000 → −10.000 = 40.000.
    const h = hitungDispensasi(100000, daftar, 1);
    expect(h).toMatchObject({ nominal: 40000, potongan: 60000, ids: [1, 2] });
    expect(h.label).toContain('Paket 1');
  });

  it('bebas menihilkan; tanpa yang cocok nilai utuh', () => {
    const bebas = [paket({ id: 1 }, [aturan(1, 1, 'bebas', 0)])];
    expect(hitungDispensasi(75000, bebas, 1)).toMatchObject({ nominal: 0, potongan: 75000 });
    expect(hitungDispensasi(75000, [], 1)).toMatchObject({ nominal: 75000, potongan: 0, ids: [] });
  });
});

describe('ringkasAturan', () => {
  it('meringkas tiap tipe; null bila tak mencakup jenis', () => {
    expect(ringkasAturan(paket({ id: 1 }, [aturan(1, 1, 'persen', 50)]), 1)).toBe('50%');
    expect(ringkasAturan(paket({ id: 2 }, [aturan(1, 1, 'nominal', 10000)]), 1)).toBe('Rp 10.000');
    expect(ringkasAturan(paket({ id: 3 }, [aturan(1, 1, 'bebas', 0)]), 1)).toBe('Bebas');
    expect(ringkasAturan(paket({ id: 4 }, [aturan(1, 2, 'persen', 10)]), 1)).toBeNull();
  });
});

describe('sisaKuota', () => {
  it('null tanpa kuota; kuota − terpakai bila ada', () => {
    expect(sisaKuota(paket({ id: 1 }), 3)).toBeNull();
    expect(sisaKuota(paket({ id: 1, kuota_bulan: 6 }), 4)).toBe(2);
    expect(sisaKuota(paket({ id: 1, kuota_bulan: 2 }), 2)).toBe(0);
  });
});

describe('alokasiPaketKuota', () => {
  it('urut santri, bulan awal dulu; bukan-penerima & habis dicoret', () => {
    const kuota = paket({ id: 1, kuota_bulan: 2 }, [], [7, 8]);
    const tetap = paket({ id: 2 }, [], [7, 8]);
    const hasil = alokasiPaketKuota([kuota, tetap], [7, 8, 9], { 7: { 1: 1 } }, 1);
    // Santri 7: sisa 2−1=1 → dapat (konsumsi 1). Santri 8: sisa 2−0−0… run ini
    // belum pakai untuk 8 (alokasi per santri) → dapat. Bukan penerima tidak.
    expect(hasil.get(7)?.map((d) => d.id)).toEqual([1, 2]);
    expect(hasil.get(8)?.map((d) => d.id)).toEqual([1, 2]);
    expect(hasil.get(9)).toEqual([]);
  });

  it('penghitung per santri independen', () => {
    const kuota = paket({ id: 1, kuota_bulan: 1 }, [], [7, 8]);
    // Kuota 7 habis → 7 dicoret, 8 (penghitung sendiri) tetap dapat.
    const hasil = alokasiPaketKuota([kuota], [7, 8], { 7: { 1: 1 } }, 1);
    expect(hasil.get(7)).toEqual([]);
    expect(hasil.get(8)?.map((d) => d.id)).toEqual([1]);
  });
});
