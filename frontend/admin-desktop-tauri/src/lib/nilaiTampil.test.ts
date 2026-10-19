import { describe, expect, it } from 'vitest';

import { formatNilai, formatStatus, namaLembaga, namaTahunAjaran } from './nilaiTampil';

describe('formatNilai', () => {
  it('kosong/null jadi string kosong untuk format apa pun', () => {
    expect(formatNilai(null, 'angka')).toBe('');
    expect(formatNilai(undefined, 'tanggal')).toBe('');
    expect(formatNilai('', 'ya_tidak')).toBe('');
  });

  it('tanpa format: apa adanya (termasuk angka mentah)', () => {
    expect(formatNilai('1234', null)).toBe('1234');
    expect(formatNilai('teks', undefined)).toBe('teks');
    expect(formatNilai('  spasi  ', '')).toBe('  spasi  ');
  });

  it('angka: ribuan gaya Indonesia, pemisah asing dibuang', () => {
    expect(formatNilai('1234567', 'angka')).toBe('1.234.567');
    expect(formatNilai('-1500', 'angka')).toBe('-1.500');
    expect(formatNilai('2500', 'angka')).toBe('2.500');
  });

  it('angka: titik dibaca sebagai pemisah RIBUAN (perbaikan)', () => {
    expect(formatNilai('Rp 2.500', 'angka')).toBe('2.500');
    expect(formatNilai('1.234.567', 'angka')).toBe('1.234.567');
    expect(formatNilai('Rp 1.500.000', 'angka')).toBe('1.500.000');
  });

  it('angka: teks tanpa digit dikembalikan apa adanya (perbaikan)', () => {
    expect(formatNilai('abc', 'angka')).toBe('abc');
    expect(formatNilai('-', 'angka')).toBe('-');
    expect(formatNilai('Rp', 'angka')).toBe('Rp');
  });

  it('angka: koma adalah pemisah DESIMAL', () => {
    expect(formatNilai('1,5', 'angka')).toBe('1,5');
    expect(formatNilai('1.234,56', 'angka')).toBe('1.234,56');
  });

  it('angka: "20.5" diperlakukan sebagai ribuan (205), konsisten id-ID', () => {
    expect(formatNilai('20.5', 'angka')).toBe('205');
  });

  it('angka: keluaran format ini stabil bila diformat ulang (idempoten)', () => {
    const sekali = formatNilai('1234567', 'angka');
    expect(sekali).toBe('1.234.567');
    expect(formatNilai(sekali, 'angka')).toBe('1.234.567');
  });

  it('tanggal: ISO -> dd/mm/yyyy, sisanya apa adanya', () => {
    expect(formatNilai('2026-03-05', 'tanggal')).toBe('05/03/2026');

    expect(formatNilai('2026-03-05 14:30:00', 'tanggal')).toBe('05/03/2026');
    expect(formatNilai('05-03-2026', 'tanggal')).toBe('05-03-2026');
    expect(formatNilai('bukan tanggal', 'tanggal')).toBe('bukan tanggal');
  });

  it('ya_tidak: ragam penulisan benar/salah', () => {
    for (const ya of ['ya', 'YA', ' ya ', '1', 'true', 'y']) {
      expect(formatNilai(ya, 'ya_tidak')).toBe('Ya');
    }
    for (const tidak of ['tidak', '0', 'false', 't', '']) {

      if (tidak === '') continue;
      expect(formatNilai(tidak, 'ya_tidak')).toBe('Tidak');
    }
  });

  it('ya_tidak: nilai asing dikembalikan apa adanya', () => {
    expect(formatNilai('mungkin', 'ya_tidak')).toBe('mungkin');
  });

  it('format tak dikenal: apa adanya', () => {
    expect(formatNilai('x', 'format_asing')).toBe('x');
  });
});

describe('formatStatus', () => {
  it('snake_case -> Proper Case', () => {
    expect(formatStatus('santri_baru')).toBe('Santri Baru');
    expect(formatStatus('baru')).toBe('Baru');
  });

  it('null tetap null, string kosong/spasi jadi string kosong', () => {
    expect(formatStatus(null)).toBeNull();
    expect(formatStatus(undefined)).toBeNull();
    expect(formatStatus('')).toBe('');
    expect(formatStatus('   ')).toBe('');
  });

  it('underscore ganda/kosong tidak menghasilkan kata kosong', () => {
    expect(formatStatus('a__b')).toBe('A  B');
    expect(formatStatus('_awal')).toBe(' Awal');
  });
});

describe('namaTahunAjaran', () => {
  it('string langsung dipakai; kosong jadi null', () => {
    expect(namaTahunAjaran('2026/2027')).toBe('2026/2027');
    expect(namaTahunAjaran('')).toBeNull();
  });

  it('objek relasi { nama } diambil namanya (jebakan Laravel)', () => {
    expect(namaTahunAjaran({ nama: '2026/2027' })).toBe('2026/2027');
    expect(namaTahunAjaran({ nama: '' })).toBeNull();
  });

  it('bentuk tak dikenal jadi null, bukan "[object Object]"', () => {
    expect(namaTahunAjaran(null)).toBeNull();
    expect(namaTahunAjaran(undefined)).toBeNull();
    expect(namaTahunAjaran(2026)).toBeNull();
    expect(namaTahunAjaran({ id: 1 })).toBeNull();
    expect(namaTahunAjaran({ nama: 123 })).toBeNull();
  });
});

describe('namaLembaga', () => {
  it('string langsung dipakai; kosong jatuh ke jenjang lalu null', () => {
    expect(namaLembaga('MI')).toBe('MI');

    expect(namaLembaga('', 'MI')).toBeNull();
    expect(namaLembaga('')).toBeNull();
  });

  it('objek relasi: jenjang diprioritaskan atas nama', () => {
    expect(namaLembaga({ jenjang: 'MI', nama: 'Madrasah Ibtidaiyah' })).toBe('MI');
    expect(namaLembaga({ nama: 'Madrasah Ibtidaiyah' })).toBe('Madrasah Ibtidaiyah');
    expect(namaLembaga({ jenjang: '' , nama: 'MD' })).toBe('MD');
  });

  it('objek tanpa jenjang/nama yang berguna jatuh ke argumen jenjang', () => {
    expect(namaLembaga({}, 'MTS')).toBe('MTS');
    expect(namaLembaga({ jenjang: 123 }, 'MTS')).toBe('MTS');
    expect(namaLembaga(null, 'MTS')).toBe('MTS');
    expect(namaLembaga(null)).toBeNull();
  });
});
