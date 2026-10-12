import { describe, expect, it } from 'vitest';

import {
  definisiTipe,
  FORMAT_BULAN,
  FORMAT_RIBUAN,
  FORMAT_TANGGAL,
  KUNCI_TIPE_INPUT,
  kunciDariTypeNative,
  OPSI_FORMAT_TANGGAL,
  OPSI_TIPE_INPUT,
  PRESET_NOMINAL,
} from '@/components/tipeInput';
import { FORMAT_TANGGAL_BAWAAN, POLA_FORMAT_TANGGAL } from '@/lib/tanggal';

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

  it('tipe tanggal: teks ber-mask + kalender, bukan `date` native', () => {
    const tanggal = definisiTipe('tanggal');
    // `text`: `dd/mm/yyyy` bukan isi yang sah untuk `date` native.
    expect(tanggal?.type).toBe('text');
    expect(tanggal?.attrs?.inputMode).toBe('numeric');
    expect(tanggal?.attrs?.placeholder).toBe('dd/mm/yyyy');
    expect(typeof tanggal?.aksiKanan).toBe('function');
    expect(tanggal?.format).toBe(FORMAT_TANGGAL);
    // `type="date"` dari pemanggil lama tetap terbaca sebagai tipe ini.
    expect(tanggal?.typeNative).toContain('date');
    // Waktu masih native (belum punya pemilih sendiri).
    expect(definisiTipe('tanggal_waktu')?.format).toBeUndefined();
  });

  it('tipe bulan: teks ber-mask mm/yyyy + pemilih bulan sendiri, bukan `month` native', () => {
    const bulanDef = definisiTipe('bulan');
    // `text`: `mm/yyyy` bukan isi yang sah untuk `month` native.
    expect(bulanDef?.type).toBe('text');
    expect(bulanDef?.attrs?.inputMode).toBe('numeric');
    expect(bulanDef?.attrs?.placeholder).toBe('mm/yyyy');
    expect(bulanDef?.format).toBe(FORMAT_BULAN);
    expect(typeof bulanDef?.aksiKanan).toBe('function');
    // `type="month"` dari pemanggil lama tetap terbaca sebagai tipe ini.
    expect(bulanDef?.typeNative).toContain('month');
    expect(kunciDariTypeNative('month')).toBe('bulan');
  });

  it('FORMAT_BULAN: tampil mm/yyyy, nilai kembali YYYY-MM, pesan salahnya sendiri', () => {
    expect(FORMAT_BULAN.tampil('2026-10')).toBe('10/2026');
    expect(FORMAT_BULAN.tampil('')).toBe('');
    expect(FORMAT_BULAN.nilai('10/2026')).toBe('2026-10');
    expect(FORMAT_BULAN.ketik?.('102026')).toBe('10/2026');
    expect(FORMAT_BULAN.ketik?.('2026-10-12')).toBe('10/2026');
    expect(FORMAT_BULAN.takSah?.('13/2026')).toBe(true);
    expect(FORMAT_BULAN.takSah?.('12/2026')).toBe(false);
    // Kotak bulan tak boleh memakai pesan bawaan yang menyebut tanggal.
    expect(FORMAT_BULAN.judulTakSah).toBe('Bulan tidak ada di kalender (01–12)');
  });

  it('tipe tanggal: baris pengaturan "Format" berisi seluruh pola tanggal', () => {
    const tanggal = definisiTipe('tanggal');
    expect(tanggal?.pengaturan?.kunci).toBe('format');
    expect(tanggal?.pengaturan?.bawaan).toBe(FORMAT_TANGGAL_BAWAAN);
    expect(OPSI_FORMAT_TANGGAL).toHaveLength(POLA_FORMAT_TANGGAL.length);
    expect(OPSI_FORMAT_TANGGAL[0]).toEqual({ label: 'dd/mm/yyyy', nilai: 'dd/mm/yyyy' });
    // Tipe lain tak punya baris pengaturan apa pun.
    expect(definisiTipe('angka')?.pengaturan).toBeUndefined();
  });

  it('tipe tanggal: pola tersimpan mengubah format, mask, & placeholder kotak', () => {
    const kolom = definisiTipe('tanggal', 'yyyy-mm-dd');
    // Tetap kotak teks ber-mask — hanya polanya yang berbeda.
    expect(kolom?.type).toBe('text');
    expect(kolom?.attrs?.placeholder).toBe('yyyy-mm-dd');
    expect(kolom?.attrs?.inputMode).toBe('numeric');
    expect(kolom?.format?.tampil('2026-10-12')).toBe('2026-10-12');
    expect(kolom?.format?.nilai('2026-10-12')).toBe('2026-10-12');
    expect(kolom?.format?.ketik?.('20261012')).toBe('2026-10-12');
    // Pola ber-nama bulan: papan angka dimatikan (huruf perlu diketik).
    expect(definisiTipe('tanggal', 'dd Mmm yyyy')?.attrs?.inputMode).toBeUndefined();
  });

  it('tipe tanggal: pola bawaan/tak dikenal tetap memakai FORMAT_TANGGAL', () => {
    expect(definisiTipe('tanggal')?.format).toBe(FORMAT_TANGGAL);
    expect(definisiTipe('tanggal', FORMAT_TANGGAL_BAWAAN)?.format).toBe(FORMAT_TANGGAL);
    expect(definisiTipe('tanggal', 'gaya-bebas')?.format).toBe(FORMAT_TANGGAL);
    expect(definisiTipe('tanggal', 7)?.attrs?.placeholder).toBe('dd/mm/yyyy');
  });

  it('FORMAT_TANGGAL: tampil dd/mm/yyyy, nilai kembali ISO', () => {
    expect(FORMAT_TANGGAL.tampil('2026-10-12')).toBe('12/10/2026');
    expect(FORMAT_TANGGAL.tampil('')).toBe('');
    expect(FORMAT_TANGGAL.nilai('12/10/2026')).toBe('2026-10-12');
    // Belum lengkap / tak ada di kalender → kosong (bukan nilai asal-asalan).
    expect(FORMAT_TANGGAL.nilai('12/1')).toBe('');
    expect(FORMAT_TANGGAL.nilai('31/02/2026')).toBe('');
  });

  it('FORMAT_TANGGAL.ketik: mask menyisipkan "/" & menerima tempelan ISO', () => {
    expect(FORMAT_TANGGAL.ketik?.('121')).toBe('12/1');
    expect(FORMAT_TANGGAL.ketik?.('12102026')).toBe('12/10/2026');
    expect(FORMAT_TANGGAL.ketik?.('2026-10-12')).toBe('12/10/2026');
  });

  it('FORMAT_TANGGAL.takSah: hanya teks LENGKAP yang salah yang ditandai', () => {
    expect(FORMAT_TANGGAL.takSah?.('31/02/2026')).toBe(true);
    expect(FORMAT_TANGGAL.takSah?.('12/10/2026')).toBe(false);
    // Sambil diketik belum lengkap → belum boleh ditandai.
    expect(FORMAT_TANGGAL.takSah?.('12/1')).toBe(false);
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