import { describe, expect, it } from 'vitest';

import type { Dispensasi } from '@/api/keuangan';
import { penerimaAwal } from './DispensasiDialog';

function paket(partial: Partial<Dispensasi> = {}): Dispensasi {
  return {
    id: 2, nama: 'Anak Pegawai', keterangan: null, tahun_ajaran: '2025/2026',
    sifat: 'tetap' as const, kuota_bulan: null,
    santri_ids: null, is_active: true, aturan: [], ...partial,
  };
}

describe('penerimaAwal', () => {
  it('memakai nama asli dari relasi termuat', () => {
    const hasil = penerimaAwal(paket({
      santri_ids: [2445],
      santri_tambahan: [{
        id: 2445, nama_lengkap: 'AZKAYRA KIRANA', nama_singkat: null, nik: null, nisn: null,
        ayah_nama: 'Bpk. Kirana', ibu_nama: 'Ibu Kirana', tmp_lahir: null, tgl_lahir: null,
        jk: null, tipe_santri: null, is_active_pst: 'Ya',
        lembaga_aktif: [{ nis_lokal: '1234' }] as never,
      }],
    }));
    expect(hasil).toEqual([{
      id: 2445, nama: 'AZKAYRA KIRANA', nisLokal: '1234',
      ayah: 'Bpk. Kirana', ibu: 'Ibu Kirana',
    }]);
  });

  it('penanda karangan bila relasi tak ada, kosong bila tanpa penerima', () => {
    const hasil = penerimaAwal(paket({ santri_ids: [2445] }));
    expect(hasil).toEqual([{
      id: 2445, nama: 'Santri #2445', nisLokal: null, ayah: null, ibu: null, namaSemu: true,
    }]);
    expect(penerimaAwal(paket())).toEqual([]);
  });
});
