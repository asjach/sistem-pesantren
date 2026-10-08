import { describe, expect, it } from 'vitest';

import type { Dispensasi } from '@/api/keuangan';
import type { Santri } from '@/api/santri';
import { barisPenerima } from './tabKeuangan';

function santri(partial: Partial<Santri> & Pick<Santri, 'id' | 'nama_lengkap'>): Santri {
  return {
    nama_singkat: null, nik: null, nisn: null, tmp_lahir: null, tgl_lahir: null,
    jk: null, tipe_santri: null, is_active_pst: 'Ya', ...partial,
  };
}

function paket(partial: Partial<Dispensasi> & Pick<Dispensasi, 'id' | 'nama'>): Dispensasi {
  return {
    keterangan: null, tahun_ajaran: '2025/2026', kuota_bulan: null, grup: null,
    santri_ids: null, is_active: true, aturan: [], ...partial,
  };
}

describe('barisPenerima', () => {
  it('meratakan penerima per paket, urut nama, NIS lokal lebih dulu', () => {
    const hasil = barisPenerima([
      paket({
        id: 1, nama: 'Anak Pegawai',
        santri_tambahan: [santri({ id: 2, nama_lengkap: 'Budi' })],
      }),
      paket({
        id: 2, nama: 'Yatim',
        santri_tambahan: [
          santri({
            id: 1, nama_lengkap: 'Ahmad',
            lembaga_aktif: [
              { jenjang: 'MI', nis_lokal: '111' },
              { jenjang: 'MD', nis_kemenag: '999' },
            ] as never,
          }),
          santri({ id: 3, nama_lengkap: 'Cici' }),
        ],
      }),
    ]);

    expect(hasil.map((r) => r.id)).toEqual(['2:1', '1:2', '2:3']);
    expect(hasil[0]).toMatchObject({ nama: 'Ahmad', nis: '111', lembaga: 'MI, MD', dispensasi: 'Yatim' });
    expect(hasil[1]).toMatchObject({ nama: 'Budi', nis: null, lembaga: null, dispensasi: 'Anak Pegawai' });
  });

  it('jatuh ke NIS kemenag bila NIS lokal kosong', () => {
    const hasil = barisPenerima([
      paket({
        id: 5, nama: 'Dhuafa',
        santri_tambahan: [santri({
          id: 7, nama_lengkap: 'Dina',
          lembaga_aktif: [{ jenjang: 'MD', nis_lokal: null, nis_kemenag: '888' }] as never,
        })],
      }),
    ]);

    expect(hasil[0]).toMatchObject({ nis: '888', lembaga: 'MD' });
  });

  it('kosong bila paket tanpa penerima termuat', () => {
    expect(barisPenerima([paket({ id: 9, nama: 'Kosong' })])).toEqual([]);
  });
});
