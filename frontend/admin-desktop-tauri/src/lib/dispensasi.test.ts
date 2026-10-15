import { describe, expect, it } from 'vitest';

import type { Dispensasi, PratinjauBaris } from '@/api/keuangan';
import {
  aturanUntukJenis,
  hitungDispensasi,
  labelBulan,
  rincianPeriode,
  ringkasAturan,
  saringDispensasi,
  selaraskanGrup,
  sisaKuota,
  teksAturan,
  teksAturanPaket,
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

describe('teksAturan & teksAturanPaket', () => {
  it('satu aturan: persen, nominal, bebas', () => {
    expect(teksAturan(aturan(1, 1, 'persen', 50))).toBe('50%');
    expect(teksAturan(aturan(2, 1, 'nominal', 10000))).toBe('Rp 10.000');
    expect(teksAturan(aturan(3, 1, 'bebas', 0))).toBe('Bebas');
  });

  it('paket: semua aturan berurutan, tanpa jenis = "Semua jenis"', () => {
    const d = paket({ id: 1 }, [
      { ...aturan(1, 7, 'persen', 25), jenis: { id: 7, nama: 'SPP' } },
      aturan(2, null, 'nominal', 5000),
    ]);
    expect(teksAturanPaket(d)).toBe('SPP: 25% · Semua jenis: Rp 5.000');
  });

  it('paket tanpa aturan → teks kosong', () => {
    expect(teksAturanPaket(paket({ id: 2 }))).toBe('');
    expect(teksAturanPaket({} as Pick<Dispensasi, 'aturan'>)).toBe('');
  });
});

describe('selaraskanGrup', () => {
  const g = (id: number, grup: string | null) => ({ id, grup });
  it('utama menang se-grup; null selalu gabung; duplikat sekali', () => {
    expect(selaraskanGrup([g(2, 'prestasi')], [g(1, 'prestasi'), g(3, null)])).toEqual([g(2, 'prestasi'), g(3, null)]);
    expect(selaraskanGrup([g(1, null)], [g(1, null), g(2, null)])).toEqual([g(1, null), g(2, null)]);
    expect(selaraskanGrup([], [g(1, 'a'), g(2, 'a')])).toEqual([g(1, 'a')]);
  });
  it('ganda se-grup di dalam utama: daftar pertama menang (legacy)', () => {
    expect(selaraskanGrup([g(1, 'p'), g(2, 'p'), g(3, null)], [])).toEqual([g(1, 'p'), g(3, null)]);
  });
});

describe('labelBulan', () => {
  it('menerjemahkan YYYY-MM jadi bulan singkat; periode lain apa adanya', () => {
    expect(labelBulan('2025-07')).toBe('Jul');
    expect(labelBulan('2026-12')).toBe('Des');
    expect(labelBulan('2025/2026')).toBe('2025/2026');
  });
});

describe('rincianPeriode', () => {
  const b = (
    periode: string, nominal: number, ids: number[] = [], sebab: string | null = null,
    nama: string[] = [],
  ): PratinjauBaris => ({ periode, nominal, potongan: 0, dispensasi_ids: ids, nama, langkah: [], sebab });

  it('null untuk satu bulan, "Sama tiap bulan" bila seragam', () => {
    expect(rincianPeriode([b('2025-07', 50000)])).toBeNull();
    expect(rincianPeriode([b('2025-07', 0), b('2025-08', 0)])).toBe('Sama tiap bulan');
  });

  it('menggabung bulan berurutan yang sama & menandai bulan yang dilewati', () => {
    expect(rincianPeriode([
      b('2025-07', 0, [1]),
      b('2025-08', 50000, [2]),
      b('2025-09', 50000, [2]),
      b('2026-06', 100000, [], 'sudah ada pembayaran'),
    ])).toBe('Jul: 0 · Agu–Sep: 50.000 · Jun: 100.000 (dilewati)');
  });

  it('rentang lintas tahun tanpa tahun; nominal sama tapi paket beda tetap dipisah', () => {
    expect(rincianPeriode([
      b('2025-07', 0, [1]),
      b('2025-08', 50000, [2]),
      b('2026-06', 50000, [2]),
    ])).toBe('Jul: 0 · Agu–Jun: 50.000');
    expect(rincianPeriode([b('2025-07', 0, [1]), b('2025-08', 0, [2])]))
      .toBe('Jul: 0 · Agu: 0');
  });

  it('menyebut nama paket saat paketnya berpindah (nominal bisa sama)', () => {
    expect(rincianPeriode([
      b('2025-07', 0, [2, 5], null, ['Anak Pegawai', 'Genap']),
      b('2025-08', 0, [2, 3], null, ['Anak Pegawai', 'Ganjil']),
      b('2025-09', 0, [2, 3], null, ['Anak Pegawai', 'Ganjil']),
    ])).toBe('Jul: 0 (Anak Pegawai, Genap) · Agu–Sep: 0 (Anak Pegawai, Ganjil)');
    // Paket sama terus → namanya disebut sekali (di rentang pertama) saja.
    expect(rincianPeriode([
      b('2025-07', 0, [2], null, ['Anak Pegawai']),
      b('2025-08', 50000, [2], null, ['Anak Pegawai']),
    ])).toBe('Jul: 0 (Anak Pegawai) · Agu: 50.000');
  });

  it('kasus failover nyata: bulan dibiarkan, lalu paket berganti di tengah', () => {
    expect(rincianPeriode([
      b('2026-07', 10000, [], 'sudah ada pembayaran'),
      b('2026-08', 10000, [], 'sudah ada pembayaran'),
      b('2026-09', 0, [2, 3], null, ['Anak Pegawai', 'Prestasi Ganjil']),
      b('2027-02', 0, [2, 3], null, ['Anak Pegawai', 'Prestasi Ganjil']),
      b('2027-03', 0, [2, 5], null, ['Anak Pegawai', 'Prestasi Genap']),
      b('2027-06', 0, [2, 5], null, ['Anak Pegawai', 'Prestasi Genap']),
    ])).toBe('Jul–Agu: 10.000 (dilewati) · Sep–Feb: 0 (Anak Pegawai, Prestasi Ganjil)'
      + ' · Mar–Jun: 0 (Anak Pegawai, Prestasi Genap)');
  });
});

describe('sisaKuota', () => {
  it('null tanpa kuota; kuota − terpakai bila ada', () => {
    expect(sisaKuota(paket({ id: 1 }), 3)).toBeNull();
    expect(sisaKuota(paket({ id: 1, kuota_bulan: 6 }), 4)).toBe(2);
    expect(sisaKuota(paket({ id: 1, kuota_bulan: 2 }), 2)).toBe(0);
  });
});
