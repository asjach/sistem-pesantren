import { describe, expect, it } from 'vitest';

import {
  GRUP_KOMPONEN_TABEL,
  KOMPONEN_INFO_BEKAL,
  komponenAktif,
  grupAdaYangTampil,
  grupTersedia,
  kunciTersedia,
  type InfoKomponenTabel,
  type KunciKomponenTabel,
} from './komponenTabel';

const SEMUA: KunciKomponenTabel[] = GRUP_KOMPONEN_TABEL.flatMap((g) => g.items.map((i) => i.kunci));

const LENGKAP: InfoKomponenTabel = {
  adaBilahJudul: true,
  infoTengah: true,
  filter: true,
  cari: true,
  keaktifan: true,
  urut: true,
  kolom: true,
  tombolAksi: true,
  relFilter: true,
  pager: true,
  tombolTambah: true,
  tombolEdit: true,
  kolomCentang: true,
  kolomAksi: true,
};

describe('komponenAktif', () => {
  it('semua komponen tampil saat peta kosong (tabel yang belum pernah disetel)', () => {
    for (const k of SEMUA) expect(komponenAktif({}, k)).toBe(true);
  });

  it('hanya kunci bernilai false yang disembunyikan', () => {
    const peta = { judul_tabel: false, kolom: true, pager: false };
    expect(komponenAktif(peta, 'judul_tabel')).toBe(false);
    expect(komponenAktif(peta, 'pager')).toBe(false);
    // `true` eksplisit tetap tampil (sama seperti absen) — peta tak menumpuk
    // penanda `true`, tapi kalau ada tetap berarti nyala.
    expect(komponenAktif(peta, 'kolom')).toBe(true);
    // Kunci yang tak disebut di peta ikut tampil.
    expect(komponenAktif(peta, 'tombol_edit')).toBe(true);
  });

  it('kunci asing di peta tak memengaruhi komponen mana pun', () => {
    const peta = { info: false, urut: false, bilah_judul: false, legacy: false };
    for (const k of SEMUA) expect(komponenAktif(peta, k)).toBe(true);
  });
});

describe('grupTersedia', () => {
  it('tabel yang punya semuanya → empat grup, seluruh komponen', () => {
    expect(grupTersedia(LENGKAP).map((g) => g.grup.id)).toEqual([
      'bilah_judul',
      'kepala_tabel',
      'kolom_tetap',
      'kaki_tabel',
    ]);
    expect(grupTersedia(LENGKAP).flatMap(({ items }) => items.map((i) => i.kunci))).toEqual(SEMUA);
  });

  it('menyembunyikan komponen yang tak ada di tabel ini', () => {
    const info: InfoKomponenTabel = { ...LENGKAP, relFilter: false, pager: false, infoTengah: false };
    const kunci = grupTersedia(info).flatMap(({ items }) => items.map((i) => i.kunci));
    expect(kunci).not.toContain('rel_filter');
    expect(kunci).not.toContain('pager');
    expect(kunci).not.toContain('info_tengah');
    // Sisanya tetap muncul.
    expect(kunci).toContain('judul_tabel');
    expect(kunci).toContain('tombol_edit');
  });

  it('grup yang tak punya komponen satupun tidak dirender', () => {
    // Tanpa `adaBilahJudul` seluruh grup "Bilah judul" kosong (judul & info tengah
    // bergantung padanya), tapi kakinya masih punya header kolom.
    const info: InfoKomponenTabel = {
      ...KOMPONEN_INFO_BEKAL,
      adaBilahJudul: false,
      filter: false,
      urut: false,
      kolom: false,
    };
    const ids = grupTersedia(info).map((g) => g.grup.id);
    expect(ids).not.toContain('bilah_judul');
    expect(ids).toContain('kepala_tabel');
    expect(ids).toContain('kaki_tabel');
  });

  it('grup kolom tetap hilang kalau halaman memang memaksa keduanya sembunyi', () => {
    // Kolom centang & Aksi yang memang tak ada juga tak punya sakelar — tak
    // ada tempat menampilkan.
    const info: InfoKomponenTabel = { ...LENGKAP, kolomCentang: false, kolomAksi: false };
    const kunci = grupTersedia(info).flatMap(({ items }) => items.map((i) => i.kunci));
    expect(kunci).not.toContain('kolom_centang');
    expect(kunci).not.toContain('kolom_aksi');
    expect(grupTersedia(info).map((g) => g.grup.id)).not.toContain('kolom_tetap');
  });

  it('satu dari dua kolom tetap masih punya sakelar', () => {
    const kunci = grupTersedia({ ...LENGKAP, kolomCentang: false })
      .flatMap(({ items }) => items.map((i) => i.kunci));
    expect(kunci).not.toContain('kolom_centang');
    expect(kunci).toContain('kolom_aksi');
  });

  it('info tengah tak ditawarkan bila tabel tak punya bilah judul', () => {
    // Tanpa bilah judul tak ada tempat meletakkan info tengah — sakelarnya
    // akan jadi mati.
    const kunci = grupTersedia({ ...LENGKAP, adaBilahJudul: false })
      .flatMap(({ items }) => items.map((i) => i.kunci));
    expect(kunci).not.toContain('info_tengah');
    expect(kunci).not.toContain('judul_tabel');
  });
});

describe('kunciTersedia', () => {
  it('mengembalikan seluruh kunci komponen yang boleh ditulis section ini', () => {
    expect(kunciTersedia(LENGKAP)).toEqual(SEMUA);
  });

  it('tak memuat kunci tak tersedia (yang tak boleh ditulis/buang)', () => {
    const kunci = kunciTersedia({ ...LENGKAP, relFilter: false });
    expect(kunci).not.toContain('rel_filter');
    expect(kunci).toHaveLength(SEMUA.length - 1);
  });
});

describe('grupAdaYangTampil', () => {
  const bilah: KunciKomponenTabel[] = ['judul_tabel', 'urutan', 'kolom'];

  it('grup kosong terpotong dari peta → tak ada yang tampil', () => {
    expect(grupAdaYangTampil(
      { judul_tabel: false, urutan: false, kolom: false },
      bilah,
    )).toBe(false);
  });

  it('satu pun komponen yang hidup sudah cukup untuk mempertahankan kontainer', () => {
    expect(grupAdaYangTampil({ judul_tabel: false, urutan: false }, bilah)).toBe(true);
  });

  it('petanya kosong (bawaan) → grup utuh tampil', () => {
    expect(grupAdaYangTampil({}, bilah)).toBe(true);
  });
});