import { describe, expect, it } from 'vitest';

import type { Santri } from '@/api/santri';
import { jenjangTampilSantri, tokenUrut, urutSantriFilter, type InfoUrutSantri } from './urut';

const santri = (p: Record<string, unknown>): Santri => ({ nama_lengkap: 'X', ...p }) as Santri;

describe('tokenUrut', () => {
  it('tanpa peta arah: daftar disalin apa adanya', () => {
    const asal = ['nama', 'kelas'];
    const hasil = tokenUrut(asal, null);
    expect(hasil).toEqual(['nama', 'kelas']);
    expect(hasil).not.toBe(asal);
    expect(tokenUrut(asal, undefined)).toEqual(['nama', 'kelas']);
  });

  it('kode berarah ditulis kode:arah, lainnya dibiarkan', () => {
    expect(tokenUrut(['nama', 'kelas', 'jk'], { nama: 'turun' })).toEqual(['nama:turun', 'kelas', 'jk']);
    expect(tokenUrut(['a', 'b'], { a: 'naik', b: 'turun' })).toEqual(['a:naik', 'b:turun']);
  });

  it('peta kosong (bukan null) tetap melewati map', () => {
    expect(tokenUrut(['nama'], {})).toEqual(['nama']);
  });

  it('arah tak dikenal untuk sebuah kode: kode dibiarkan polos', () => {
    expect(tokenUrut(['nama'], { nama: 'menyamping' } as never)).toEqual(['nama']);
  });
});

describe('jenjangTampilSantri', () => {
  it('memilih keanggotaan yang AKTIF, bukan yang pertama', () => {
    const s = santri({ id: 1, lembaga_aktif: [
      { jenjang: 'MD', is_active_lembaga: 'Tidak' },
      { jenjang: 'MI', is_active_lembaga: 'Ya' },
    ] });
    expect(jenjangTampilSantri(s)).toBe('MI');
  });

  it('tanpa yang aktif: jatuh ke anggota pertama', () => {
    const s = santri({ id: 2, lembaga_aktif: [
      { jenjang: 'MD', is_active_lembaga: 'Tidak' },
      { jenjang: 'MI', is_active_lembaga: 'Tidak' },
    ] });
    expect(jenjangTampilSantri(s)).toBe('MD');
  });

  it('tanpa keanggotaan: string kosong, bukan null', () => {
    expect(jenjangTampilSantri(santri({ id: 3, lembaga_aktif: [] }))).toBe('');
    expect(jenjangTampilSantri(santri({ id: 4 }))).toBe('');
    expect(jenjangTampilSantri(santri({ id: 6, lembaga_aktif: null }))).toBe('');
  });
});
describe('urutSantriFilter', () => {
  const info = (m: Record<number, Partial<InfoUrutSantri>>) => {
    const out: Record<number, InfoUrutSantri | undefined> = {};
    for (const [k, v] of Object.entries(m)) {
      out[Number(k)] = { jenjang: '', tingkat: '', kelas: '', ...v };
    }
    return out;
  };

  it('urutan utama: kelas secara numerik (gaya Indonesia)', () => {
    const s = [santri({ id: 1 }), santri({ id: 2 }), santri({ id: 10 })];
    const hasil = urutSantriFilter(s, info({
      1: { kelas: 'Kelas 10' }, 2: { kelas: 'Kelas 2' }, 10: { kelas: 'Kelas 1' },
    }));
    expect(hasil.map((x) => x.id)).toEqual([10, 2, 1]);
  });

  it('kelas sama: yang AKTIF didahulukan, baru urut nama', () => {
    const s = [
      santri({ id: 1, nama_lengkap: 'Ahmad', is_active_pst: 'Tidak' }),
      santri({ id: 2, nama_lengkap: 'Zainab', is_active_pst: 'Ya' }),
      santri({ id: 3, nama_lengkap: 'Budi', is_active_pst: 'Ya' }),
    ];
    const hasil = urutSantriFilter(s, info({ 1: { kelas: '1' }, 2: { kelas: '1' }, 3: { kelas: '1' } }));
    expect(hasil.map((x) => x.id)).toEqual([3, 2, 1]);
  });

  it('nama sama: dibedakan jenis kelamin', () => {
    const s = [
      santri({ id: 1, nama_lengkap: 'Sama', jk: 'P' }),
      santri({ id: 2, nama_lengkap: 'Sama', jk: 'L' }),
    ];
    const hasil = urutSantriFilter(s, info({ 1: { kelas: '1' }, 2: { kelas: '1' } }));
    expect(hasil.map((x) => x.id)).toEqual([2, 1]);
  });

  it('info hilang untuk seorang santri: diperlakukan kosong, tak melempar', () => {
    const s = [santri({ id: 1, nama_lengkap: 'B' }), santri({ id: 2, nama_lengkap: 'A' })];
    const hasil = urutSantriFilter(s, info({ 1: { kelas: '' } }));
    expect(hasil.map((x) => x.id)).toEqual([2, 1]);
  });

  it('TIDAK mengubah array masukan (bekerja pada salinan)', () => {
    const s = [santri({ id: 1 }), santri({ id: 2 })];
    const asal = s.map((x) => x.id);
    urutSantriFilter(s, info({}));
    expect(s.map((x) => x.id)).toEqual(asal);
  });
});
