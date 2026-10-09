import { describe, expect, it } from 'vitest';

import type { JenisTagihan, Tarif } from '@/api/keuangan';
import {
  FIELDS_TARIF, nilaiGridTarif, opsiJenisTarif, pastikanTarifBaru, payloadBuatTarif, payloadUbahTarif,
  tarifBentrok,
} from './tabKeuangan';

/** Baris tarif lengkap dengan nilai bawaan; field tertentu bisa ditimpa. */
function tarif(partial: Partial<Tarif> = {}): Tarif {
  return {
    id: 1, jenjang: 'MI', tahun_ajaran: '2025/2026', jenis_id: 3,
    tingkat: null, nominal: 75000, is_active: true,
    jenis: { id: 3, nama: 'Infaq Bulanan' }, ...partial,
  };
}

function fieldTarif(key: string) {
  return FIELDS_TARIF.find((f) => f.key === key);
}

describe('FIELDS_TARIF — mode Edit', () => {
  it('hanya nominal & aktif yang bisa diedit; kunci baris tetap baca-saja', () => {
    expect(fieldTarif('jenjang')?.kind).toBe('static');
    expect(fieldTarif('tahun_ajaran')?.kind).toBe('static');
    expect(fieldTarif('jenis')?.kind).toBe('static');
    expect(fieldTarif('nominal')?.kind).toBe('text');
    // Switch status tersimpan langsung (tanpa Mode Edit), seperti kolom is_active lain.
    expect(fieldTarif('aktif')?.kind).toBe('toggle');
  });

  it('jenis & nominal wajib diisi pada baris input (mode Input)', () => {
    expect(fieldTarif('jenis')?.inputKind).toBe('select');
    expect(fieldTarif('jenis')?.required).toBe(true);
    expect(fieldTarif('nominal')?.required).toBe(true);
    // Lembaga & TA tidak diisi di baris input — nilainya dari filter halaman.
    expect(fieldTarif('jenjang')?.inputKind).toBeUndefined();
    expect(fieldTarif('tahun_ajaran')?.inputKind).toBeUndefined();
  });

  it('validator nominal menerima digit polos & bertitik ribuan, menolak selainnya', () => {
    const validate = fieldTarif('nominal')?.validate;
    expect(validate?.('75000')).toBeNull();
    expect(validate?.('75.000')).toBeNull();
    expect(validate?.('0')).toBeNull();

    // Kosong = ditolak: endpoint menuntut nominal (required).
    expect(validate?.('')).toBe('Nominal wajib diisi.');
    expect(validate?.(null)).toBe('Nominal wajib diisi.');

    // Desimal/tanda baca lain ambigu dengan titik ribuan → ditolak.
    expect(validate?.('abc')).toBe('Nominal harus angka bulat ≥ 0.');
    expect(validate?.('-1')).toBe('Nominal harus angka bulat ≥ 0.');
    expect(validate?.('7.5')).toBe('Nominal harus angka bulat ≥ 0.');
    expect(validate?.('1.2345')).toBe('Nominal harus angka bulat ≥ 0.');
  });
});

describe('nilaiGridTarif', () => {
  it('memformat nominal ribuan & status sebagai ya/tidak', () => {
    expect(nilaiGridTarif(tarif())).toMatchObject({
      jenjang: 'MI', tahun_ajaran: '2025/2026', jenis: 'Infaq Bulanan',
      nominal: '75.000', aktif: 'ya',
    });
    expect(nilaiGridTarif(tarif({ nominal: 1250000, is_active: false }))).toMatchObject({
      nominal: '1.250.000', aktif: 'tidak',
    });
  });

  it('jenis tanpa relasi tampil kosong', () => {
    expect(nilaiGridTarif(tarif({ jenis: undefined })).jenis).toBeNull();
  });
});

describe('payloadUbahTarif', () => {
  it('ubah nominal saja: titik ribuan dinormalisasi, status ikut nilai baris', () => {
    expect(payloadUbahTarif(tarif(), { nominal: '80.000' })).toEqual({ nominal: 80000, is_active: true });
  });

  it('ubah status saja (switch Aktif): nominal ikut nilai baris', () => {
    expect(payloadUbahTarif(tarif(), { aktif: 'tidak' })).toEqual({ nominal: 75000, is_active: false });
  });

  it('ubah keduanya dalam satu batch simpan', () => {
    expect(payloadUbahTarif(tarif({ is_active: false }), { nominal: '90000', aktif: 'ya' }))
      .toEqual({ nominal: 90000, is_active: true });
  });

  it('nominal tak terbaca jatuh ke nilai baris (jaring pengaman di luar validate)', () => {
    expect(payloadUbahTarif(tarif(), { nominal: 'abc' })).toEqual({ nominal: 75000, is_active: true });
  });
});

describe('payloadBuatTarif — mode Input', () => {
  it('memetakan jenis (id) & nominal (titik ribuan dinormalisasi)', () => {
    expect(payloadBuatTarif({ jenis: '3', nominal: '80.000' })).toEqual({ jenis_id: 3, nominal: 80000 });
    expect(payloadBuatTarif({ jenis: '12', nominal: '0' })).toEqual({ jenis_id: 12, nominal: 0 });
  });

  it('jenis belum dipilih → ditolak dengan pesan yang terbaca', () => {
    expect(() => payloadBuatTarif({ nominal: '80000' })).toThrow('Pilih jenis tagihan dulu.');
    expect(() => payloadBuatTarif({ jenis: '', nominal: '80000' })).toThrow('Pilih jenis tagihan dulu.');
    expect(() => payloadBuatTarif({ jenis: 'abc', nominal: '80000' })).toThrow('Pilih jenis tagihan dulu.');
  });

  it('nominal kosong/tak valid → ditolak', () => {
    expect(() => payloadBuatTarif({ jenis: '3' })).toThrow('Nominal harus angka bulat ≥ 0.');
    expect(() => payloadBuatTarif({ jenis: '3', nominal: '7.5' })).toThrow('Nominal harus angka bulat ≥ 0.');
  });
});

describe('tarifBentrok — cegah duplikat sebelum POST', () => {
  it('menemukan baris dengan lembaga + TA + jenis yang sama', () => {
    const rows = [tarif(), tarif({ id: 2, jenjang: 'MTs', jenis_id: 4 })];
    expect(tarifBentrok(rows, { jenjang: 'MI', tahun_ajaran: '2025/2026', jenis_id: 3 })?.id).toBe(1);
  });

  it('beda lembaga / TA / jenis mana pun bukan bentrok', () => {
    const rows = [tarif()];
    expect(tarifBentrok(rows, { jenjang: 'MTs', tahun_ajaran: '2025/2026', jenis_id: 3 })).toBeNull();
    expect(tarifBentrok(rows, { jenjang: 'MI', tahun_ajaran: '2026/2027', jenis_id: 3 })).toBeNull();
    expect(tarifBentrok(rows, { jenjang: 'MI', tahun_ajaran: '2025/2026', jenis_id: 9 })).toBeNull();
  });

  it('tingkat diabaikan: baris lama bertingkat tetap dianggap bentrok', () => {
    // Index DB `uq_tarif_tagihan` memuat tingkat, tapi NULL dianggap berbeda
    // oleh MySQL/SQLite — penjaga inilah yang menutup celahnya.
    const rows = [tarif({ tingkat: 'VII' })];
    expect(tarifBentrok(rows, { jenjang: 'MI', tahun_ajaran: '2025/2026', jenis_id: 3 })?.id).toBe(1);
    expect(tarifBentrok([], { jenjang: 'MI', tahun_ajaran: '2025/2026', jenis_id: 3 })).toBeNull();
  });
});

describe('pastikanTarifBaru — penjaga sebelum POST', () => {
  const calon = { jenjang: 'MI', tahun_ajaran: '2025/2026', jenis_id: 3 };

  it('lolos bila belum ada tarif untuk kombinasi itu', () => {
    expect(() => pastikanTarifBaru([tarif({ id: 2, jenis_id: 9 })], calon)).not.toThrow();
    expect(() => pastikanTarifBaru([], calon)).not.toThrow();
  });

  it('melempar pesan terbaca (nama jenis dari relasi) bila sudah ada', () => {
    expect(() => pastikanTarifBaru([tarif()], calon)).toThrow(
      'Tarif Infaq Bulanan untuk MI 2025/2026 sudah ada — ubah baris itu, bukan menambah baris baru.',
    );
  });

  it('relasi jenis tak termuat → pesan tetap jelas', () => {
    expect(() => pastikanTarifBaru([tarif({ jenis: undefined })], calon)).toThrow(
      'Tarif jenis ini untuk MI 2025/2026 sudah ada',
    );
  });
});

describe('opsiJenisTarif — dropdown baris input', () => {
  const jenis: JenisTagihan[] = [
    { id: 1, nama: 'SPP', tipe: 'bulanan', jenjang: 'MI', is_active: true },
    { id: 2, nama: 'Infaq', tipe: 'bulanan', jenjang: null, is_active: true },
    { id: 3, nama: 'Daftar Ulang', tipe: 'non_bulanan', jenjang: 'MTs', is_active: true },
  ];

  it('jenis global + jenis lembaga filter saja (pola dialog Tambah Tarif)', () => {
    expect(opsiJenisTarif(jenis, 'MI', new Set()).map((c) => c.label)).toEqual(['SPP', 'Infaq']);
  });

  it('jenis yang sudah punya tarif di lingkup ini ditandai "sudah ada"', () => {
    expect(opsiJenisTarif(jenis, 'MI', new Set([1]))).toEqual([
      { value: '1', label: 'SPP · sudah ada' },
      { value: '2', label: 'Infaq' },
    ]);
  });

  it('tanpa lembaga filter hanya jenis global yang tampil', () => {
    expect(opsiJenisTarif(jenis, null, new Set()).map((c) => c.label)).toEqual(['Infaq']);
  });
});
