import { describe, expect, it } from 'vitest';

import {
  definisiTipe,
  FORMAT_RIBUAN,
  KUNCI_TIPE_INPUT,
  kunciDariTypeNative,
  OPSI_TIPE_INPUT,
  PRESET_NOMINAL,
} from '@/components/tipeInput';

describe('registry tipe input', () => {
  it('setiap kunci punya label & opsi popover memetakan 1:1', () => {
    expect(KUNCI_TIPE_INPUT.length).toBeGreaterThan(0);
    expect(OPSI_TIPE_INPUT).toHaveLength(KUNCI_TIPE_INPUT.length);
    for (const kunci of KUNCI_TIPE_INPUT) {
      const definisi = definisiTipe(kunci);
      expect(definisi).toBeDefined();
      expect(definisi?.label).not.toBe('');
      const opsi = OPSI_TIPE_INPUT.find((o) => o.nilai === kunci);
      expect(opsi?.label).toBe(definisi?.label);
    }
  });

  it('kunci tak dikenal → undefined (Input bawaan, tanpa error)', () => {
    expect(definisiTipe('entah')).toBeUndefined();
    expect(definisiTipe(undefined)).toBeUndefined();
  });

  it('kunciDariTypeNative memetakan tipe bawaan & jatuh ke teks', () => {
    expect(kunciDariTypeNative(undefined)).toBe('teks');
    expect(kunciDariTypeNative('text')).toBe('teks');
    expect(kunciDariTypeNative('date')).toBe('tanggal');
    expect(kunciDariTypeNative('month')).toBe('bulan');
    expect(kunciDariTypeNative('datetime-local')).toBe('tanggal_waktu');
    expect(kunciDariTypeNative('password')).toBe('teks_rahasia');
    // Tipe yang tak terdaftar (mis. `time` versi lama) tetap jatuh ke teks.
    expect(kunciDariTypeNative('waktu-tua')).toBe('teks');
  });

  it('tipe nominal: teks + inputMode numeric + kalkulator + pemisah ribuan', () => {
    const nominal = definisiTipe('nominal');
    // `text` (bukan `number`): pemisah ribuan tak sah di `type=number`.
    expect(nominal?.type).toBe('text');
    expect(nominal?.attrs?.inputMode).toBe('numeric');
    expect(typeof nominal?.aksiKanan).toBe('function');
    // Angka biasa tetap polos (tanpa papan rupiah & tanpa pemisah ribuan).
    expect(definisiTipe('angka')?.aksiKanan).toBeUndefined();
    expect(definisiTipe('angka')?.format).toBeUndefined();
  });

  it('FORMAT_RIBUAN: tampil berformat, nilai kembali ke digit mentah', () => {
    expect(FORMAT_RIBUAN.tampil('50000')).toBe('50.000');
    expect(FORMAT_RIBUAN.tampil('0')).toBe('0');
    expect(FORMAT_RIBUAN.tampil('')).toBe('');
    // Kebalikannya: titik/spasi/teks lain dibuang, nol di depan dibuang.
    expect(FORMAT_RIBUAN.nilai('50.000')).toBe('50000');
    expect(FORMAT_RIBUAN.nilai('Rp 1 234 567')).toBe('1234567');
    expect(FORMAT_RIBUAN.nilai('007')).toBe('7');
    expect(FORMAT_RIBUAN.nilai('abc')).toBe('');
  });

  it('preset nominal bawaan naik dan berakhir 1 juta', () => {
    expect(PRESET_NOMINAL[0]).toBe(1_000);
    expect(PRESET_NOMINAL.at(-1)).toBe(1_000_000);
  });
});