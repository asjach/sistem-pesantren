import { describe, expect, it } from 'vitest';

import type { Dispensasi } from '@/api/keuangan';
import { santriIdsUntuk } from './DispensasiDialog';

function paket(partial: Partial<Dispensasi> = {}): Dispensasi {
  return {
    id: 2, nama: 'Anak Pegawai', keterangan: null, tahun_ajaran: '2025/2026',
    kuota_bulan: null, grup: null,
    santri_ids: null, is_active: true, aturan: [], ...partial,
  };
}

/* Dialog tidak lagi mengelola penerima (pindah ke halaman Dispensasi), jadi
   satu-satunya hal yang tersisa soal penerima adalah nilai `santri_ids` yang
   dikirim saat simpan — dan salah di sini artinya kehilangan data. */
describe('santriIdsUntuk', () => {
  it('mode ubah mempertahankan daftar penerima yang ada (bukan null)', () => {
    expect(santriIdsUntuk(paket({ santri_ids: [1, 2] }), null)).toEqual([1, 2]);
    // Paket tanpa penerima tetap null (tak ada yang perlu dijaga).
    expect(santriIdsUntuk(paket(), null)).toBeNull();
  });

  it('mode tambah: kosong, atau santri awal saat dibuka dari profil santri', () => {
    expect(santriIdsUntuk(null, null)).toBeNull();
    expect(santriIdsUntuk(null, { id: 7 })).toEqual([7]);
  });

  it('santri awal diabaikan saat mengubah paket yang sudah ada', () => {
    expect(santriIdsUntuk(paket({ santri_ids: [3] }), { id: 9 })).toEqual([3]);
  });
});
