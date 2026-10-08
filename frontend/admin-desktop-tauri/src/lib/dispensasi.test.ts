import { describe, expect, it } from 'vitest';

import type { Dispensasi } from '@/api/keuangan';
import {
  aturanUntukJenis,
  hitungDispensasi,
  ringkasAturan,
  saringDispensasi,
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
