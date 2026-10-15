import { describe, expect, it } from 'vitest';

import {
  BAGIAN_INFO_BEKAL,
  bagianAktif,
  bagianTersedia,
  type InfoBagianTabel,
  type KunciBagianTabel,
} from './bagianTabel';

const SEMUA: KunciBagianTabel[] = [
  'bilah_judul',
  'info_tengah',
  'header_kolom',
  'rel_filter',
  'kaki_tabel',
];

describe('bagianAktif', () => {
  it('semua bagian tampil saat peta kosong (tabel yang belum pernah disetel)', () => {
    for (const k of SEMUA) expect(bagianAktif({}, k)).toBe(true);
  });

  it('hanya kunci bernilai false yang disembunyikan', () => {
    const peta = { bilah_judul: false, header_kolom: true, kaki_tabel: false };
    expect(bagianAktif(peta, 'bilah_judul')).toBe(false);
    expect(bagianAktif(peta, 'kaki_tabel')).toBe(false);
    // `true` eksplisit tetap tampil (sama seperti absen) — peta tak menumpuk
    // penanda `true`, tapi kalau ada tetap berarti nyala.
    expect(bagianAktif(peta, 'header_kolom')).toBe(true);
    // Kunci yang tak disebut di peta ikut tampil.
    expect(bagianAktif(peta, 'info_tengah')).toBe(true);
  });

  it('kunci asing di peta tak memengaruhi bagian mana pun', () => {
    const peta = { urut: false, legacy: false };
    for (const k of SEMUA) expect(bagianAktif(peta, k)).toBe(true);
  });
});

describe('bagianTersedia', () => {
  it('bawaan TopBar hanya menawarkan bagian yang pasti ada', () => {
    expect(bagianTersedia(BAGIAN_INFO_BEKAL).map((b) => b.kunci))
      .toEqual(['bilah_judul', 'header_kolom', 'kaki_tabel']);
  });

  it('menambah info tengah & rel filter hanya bila tabel punya keduanya', () => {
    const info: InfoBagianTabel = {
      adaBilahJudul: true,
      adaInfoTengah: true,
      adaRelFilter: true,
    };
    expect(bagianTersedia(info).map((b) => b.kunci)).toEqual(SEMUA);
  });

  it('info tengah tak ditawarkan bila tabel tak punya bilah judul', () => {
    // Tanpa bilah judul tak ada tempat meletakkan info tengah — sakelarnya
    // akan jadi mati.
    const info: InfoBagianTabel = {
      adaBilahJudul: false,
      adaInfoTengah: true,
      adaRelFilter: false,
    };
    const kunci = bagianTersedia(info).map((b) => b.kunci);
    expect(kunci).not.toContain('bilah_judul');
    expect(kunci).not.toContain('info_tengah');
    // Header kolom & kaki tabel tetap ada di tabel mana pun.
    expect(kunci).toEqual(['header_kolom', 'kaki_tabel']);
  });

  it('rel filter tak ditawarkan pada tabel tanpa rel', () => {
    const info: InfoBagianTabel = { ...BAGIAN_INFO_BEKAL, adaRelFilter: false };
    expect(bagianTersedia(info).map((b) => b.kunci)).not.toContain('rel_filter');
  });
});