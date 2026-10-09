import { describe, expect, it } from 'vitest';

import type { JenisTagihan } from '@/api/keuangan';
import {
  FIELDS_JENIS, JENIS_GLOBAL, nilaiGridJenis, payloadBuatJenis, payloadUbahJenis,
} from './tabKeuangan';

/** Baris jenis tagihan lengkap dengan nilai bawaan; field tertentu bisa ditimpa. */
function jenis(partial: Partial<JenisTagihan> = {}): JenisTagihan {
  return { id: 3, nama: 'HIPA', tipe: 'non_bulanan', jenjang: 'MI', is_active: true, ...partial };
}

function fieldJenis(key: string) {
  return FIELDS_JENIS.find((f) => f.key === key);
}

describe('FIELDS_JENIS — mode Edit & Input', () => {
  it('nama, tipe, status bisa diedit; lembaga baca-saja di baris data', () => {
    expect(fieldJenis('nama')?.kind).toBe('text');
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
    // Sel tipe yang dikosongkan ditolak, bukan diam-diam jadi Non-bulanan.
    expect(fieldJenis('tipe')?.validate?.('bulanan')).toBeNull();
    expect(fieldJenis('tipe')?.validate?.(null)).toBe('Tipe harus Bulanan atau Non-bulanan.');
  });
});

describe('nilaiGridJenis', () => {
  it('tipe mentah (label dari choices), lingkup tampil "Semua", status ya/tidak', () => {
    expect(nilaiGridJenis(jenis())).toMatchObject({
      nama: 'HIPA', tipe: 'non_bulanan', lembaga: 'MI', aktif: 'ya',
    });
    expect(nilaiGridJenis(jenis({ jenjang: null, is_active: false, tipe: 'bulanan' })))
      .toMatchObject({ tipe: 'bulanan', lembaga: 'Semua', aktif: 'tidak' });
  });
});

describe('payloadUbahJenis', () => {
  it('ubah nama saja: di-trim, tipe & status ikut nilai baris', () => {
    expect(payloadUbahJenis(jenis(), { nama: '  HIPA 2026 ' }))
      .toEqual({ nama: 'HIPA 2026', tipe: 'non_bulanan', is_active: true });
  });

  it('ubah tipe saja & status saja', () => {
    expect(payloadUbahJenis(jenis(), { tipe: 'bulanan' }))
      .toEqual({ nama: 'HIPA', tipe: 'bulanan', is_active: true });
    expect(payloadUbahJenis(jenis(), { aktif: 'tidak' }))
      .toEqual({ nama: 'HIPA', tipe: 'non_bulanan', is_active: false });
  });

  it('nama kosong jatuh ke nilai baris (jaring pengaman di luar validate)', () => {
    expect(payloadUbahJenis(jenis(), { nama: '   ' }))
      .toEqual({ nama: 'HIPA', tipe: 'non_bulanan', is_active: true });
  });
});

describe('payloadBuatJenis — mode Input', () => {
  it('memetakan nama (di-trim), tipe, dan lingkup lembaga', () => {
    expect(payloadBuatJenis({ nama: '  HIPA ', tipe: 'non_bulanan', lembaga: 'MI' }))
      .toEqual({ nama: 'HIPA', tipe: 'non_bulanan', jenjang: 'MI' });
  });

  it('pilihan "Semua (global)" → jenjang null', () => {
    expect(payloadBuatJenis({ nama: 'ASAS', tipe: 'non_bulanan', lembaga: JENIS_GLOBAL }))
      .toEqual({ nama: 'ASAS', tipe: 'non_bulanan', jenjang: null });
  });

  it('nama/tipe/lembaga belum lengkap → ditolak dengan pesan terbaca', () => {
    expect(() => payloadBuatJenis({ tipe: 'bulanan', lembaga: 'MI' })).toThrow('Nama jenis wajib diisi.');
    expect(() => payloadBuatJenis({ nama: 'HIPA', lembaga: 'MI' })).toThrow('Pilih tipe tagihan dulu.');
    expect(() => payloadBuatJenis({ nama: 'HIPA', tipe: 'bulanan' })).toThrow('Pilih lembaga dulu.');
  });
});
