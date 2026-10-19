import { describe, expect, it } from 'vitest';

import type { JenisTagihan } from '@/api/keuangan';
import {
  FIELDS_JENIS, JENIS_GLOBAL, nilaiGridJenis, payloadBuatJenis, payloadUbahJenis,
} from './tabKeuangan';

/** Baris jenis tagihan lengkap dengan nilai bawaan; field tertentu bisa ditimpa. */
function jenis(partial: Partial<JenisTagihan> = {}): JenisTagihan {
  return { id: 3, nama: 'HIPA', tipe: 'non_bulanan', jenjang: 'MI', keterangan: null, urutan: 0, is_active: true, ...partial };
}

function fieldJenis(key: string) {
  return FIELDS_JENIS.find((f) => f.key === key);
}

describe('FIELDS_JENIS — mode Edit & Input', () => {
  it('nama, tipe, status bisa diedit; keterangan & lembaga baca-saja di baris data', () => {
    expect(fieldJenis('nama')?.kind).toBe('text');
    expect(fieldJenis('keterangan')?.kind).toBe('text');
    expect(fieldJenis('tipe')?.kind).toBe('select');
    expect(fieldJenis('aktif')?.kind).toBe('toggle');
    expect(fieldJenis('lembaga')?.kind).toBe('static');
  });

  it('nama, tipe, lembaga wajib diisi pada baris input (lembaga = dropdown)', () => {
    expect(fieldJenis('nama')?.required).toBe(true);
    expect(fieldJenis('tipe')?.required).toBe(true);
    expect(fieldJenis('lembaga')?.inputKind).toBe('select');
    expect(fieldJenis('lembaga')?.required).toBe(true);
  });

  it('tipe punya pilihan bulanan / non-bulanan; validator nama menolak kosong', () => {
    expect(fieldJenis('tipe')?.choices).toEqual([
      { value: 'bulanan', label: 'Bulanan' },
      { value: 'non_bulanan', label: 'Non-bulanan' },
    ]);
    expect(fieldJenis('nama')?.validate?.('   ')).toBe('Nama jenis wajib diisi.');
    expect(fieldJenis('nama')?.validate?.('HIPA')).toBeNull();

    expect(fieldJenis('tipe')?.validate?.('bulanan')).toBeNull();
    expect(fieldJenis('tipe')?.validate?.(null)).toBe('Tipe harus Bulanan atau Non-bulanan.');
  });

  it('urutan: boleh kosong (= 0), tapi teks bukan angka ditolak', () => {
    expect(fieldJenis('urutan')?.kind).toBe('text');
    expect(fieldJenis('urutan')?.required).toBeUndefined();
    expect(fieldJenis('urutan')?.validate?.(null)).toBeNull();
    expect(fieldJenis('urutan')?.validate?.('   ')).toBeNull();
    expect(fieldJenis('urutan')?.validate?.('10')).toBeNull();
    expect(fieldJenis('urutan')?.validate?.('-1')).toBe('Urutan harus angka bulat ≥ 0.');
    expect(fieldJenis('urutan')?.validate?.('abc')).toBe('Urutan harus angka bulat ≥ 0.');
  });
});

describe('nilaiGridJenis', () => {
  it('tipe mentah (label dari choices), lingkup tampil "Semua", status ya/tidak', () => {
    expect(nilaiGridJenis(jenis())).toMatchObject({
      nama: 'HIPA', keterangan: null, tipe: 'non_bulanan', lembaga: 'MI', aktif: 'ya',
    });
    expect(nilaiGridJenis(jenis({ jenjang: null, is_active: false, tipe: 'bulanan' })))
      .toMatchObject({ tipe: 'bulanan', lembaga: 'Semua', aktif: 'tidak' });
  });

  it('urutan 0 tampil kosong (belum diatur), angka lain tampil apa adanya', () => {
    expect(nilaiGridJenis(jenis()).urutan).toBeNull();
    expect(nilaiGridJenis(jenis({ urutan: 10 })).urutan).toBe('10');
  });
});

describe('payloadUbahJenis', () => {
  it('ubah nama saja: di-trim, tipe & status ikut nilai baris', () => {
    expect(payloadUbahJenis(jenis(), { nama: '  HIPA 2026 ' }))
      .toEqual({ nama: 'HIPA 2026', tipe: 'non_bulanan', is_active: true, keterangan: null, urutan: 0 });
  });

  it('ubah tipe saja & status saja', () => {
    expect(payloadUbahJenis(jenis(), { tipe: 'bulanan' }))
      .toEqual({ nama: 'HIPA', tipe: 'bulanan', is_active: true, keterangan: null, urutan: 0 });
    expect(payloadUbahJenis(jenis(), { aktif: 'tidak' }))
      .toEqual({ nama: 'HIPA', tipe: 'non_bulanan', is_active: false, keterangan: null, urutan: 0 });
  });

  it('nama kosong jatuh ke nilai baris (jaring pengaman di luar validate)', () => {
    expect(payloadUbahJenis(jenis(), { nama: '   ' }))
      .toEqual({ nama: 'HIPA', tipe: 'non_bulanan', is_active: true, keterangan: null, urutan: 0 });
  });

  it('keterangan kosong → null; terisi di-trim', () => {
    expect(payloadUbahJenis(jenis(), { keterangan: '   ' }).keterangan).toBeNull();
    expect(payloadUbahJenis(jenis(), { keterangan: '  Iuran pekanan ' }).keterangan).toBe('Iuran pekanan');
    expect(payloadUbahJenis(jenis({ keterangan: 'Lama' }), {}).keterangan).toBe('Lama');
  });

  it('urutan: angka dari sel, sel dikosongkan → 0, teks tak sah → nilai lama', () => {
    expect(payloadUbahJenis(jenis(), { urutan: '20' }).urutan).toBe(20);
    expect(payloadUbahJenis(jenis({ urutan: 20 }), { urutan: null }).urutan).toBe(0);
    expect(payloadUbahJenis(jenis({ urutan: 20 }), { urutan: 'abc' }).urutan).toBe(20);

    expect(payloadUbahJenis(jenis({ urutan: 7 }), { nama: 'X' }).urutan).toBe(7);
  });
});

describe('payloadBuatJenis — mode Input', () => {
  it('memetakan nama (di-trim), tipe, dan lingkup lembaga', () => {
    expect(payloadBuatJenis({ nama: '  HIPA ', tipe: 'non_bulanan', lembaga: 'MI' }))
      .toEqual({ nama: 'HIPA', tipe: 'non_bulanan', jenjang: 'MI', keterangan: null, urutan: 0 });
  });

  it('keterangan ikut dipetakan (kosong → null)', () => {
    expect(payloadBuatJenis({ nama: 'HIPA', tipe: 'bulanan', lembaga: 'MI', keterangan: '  Iuran pekanan ' }))
      .toEqual({ nama: 'HIPA', tipe: 'bulanan', jenjang: 'MI', keterangan: 'Iuran pekanan', urutan: 0 });
  });

  it('urutan ikut dipetakan; sel kosong → 0', () => {
    expect(payloadBuatJenis({ nama: 'HIPA', tipe: 'bulanan', lembaga: 'MI', urutan: '30' }).urutan).toBe(30);
    expect(payloadBuatJenis({ nama: 'HIPA', tipe: 'bulanan', lembaga: 'MI', urutan: '  ' }).urutan).toBe(0);
  });

  it('pilihan "Semua (global)" → jenjang null', () => {
    expect(payloadBuatJenis({ nama: 'ASAS', tipe: 'non_bulanan', lembaga: JENIS_GLOBAL }))
      .toEqual({ nama: 'ASAS', tipe: 'non_bulanan', jenjang: null, keterangan: null, urutan: 0 });
  });

  it('nama/tipe/lembaga belum lengkap → ditolak dengan pesan terbaca', () => {
    expect(() => payloadBuatJenis({ tipe: 'bulanan', lembaga: 'MI' })).toThrow('Nama jenis wajib diisi.');
    expect(() => payloadBuatJenis({ nama: 'HIPA', lembaga: 'MI' })).toThrow('Pilih tipe tagihan dulu.');
    expect(() => payloadBuatJenis({ nama: 'HIPA', tipe: 'bulanan' })).toThrow('Pilih lembaga dulu.');
  });
});
