import { describe, expect, it } from 'vitest';
import { formatContohNomorPeserta } from './nomorPeserta';

describe('formatContohNomorPeserta', () => {
  it('menampilkan contoh sesuai token pola', () => {
    expect(formatContohNomorPeserta(
      '{ta_awal_2}.{ta_akhir_2}.{kode_peristiwa}.{tingkat_2}.{nomor_4}',
      { tahunAjaran: '2026/2027', kodePeristiwa: 'ASAS', semester: '1', tingkat: '1', urutan: 1 },
    )).toBe('26.27.ASAS.01.0001');
  });

  it('mendukung urutan yang bersambung tanpa token tingkat', () => {
    expect(formatContohNomorPeserta(
      'UAP-{semester}-{nomor_3}',
      { tahunAjaran: '2026/2027', kodePeristiwa: 'UAP', semester: '2', tingkat: '6', urutan: 12 },
    )).toBe('UAP-2-012');
  });
});
