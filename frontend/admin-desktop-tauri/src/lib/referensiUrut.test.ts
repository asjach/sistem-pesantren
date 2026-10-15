import { describe, expect, it } from 'vitest';

import { urutkanReferensi, type BarisReferensiUrut } from './referensiUrut';

const baris: BarisReferensiUrut[] = [
  { nama: 'Zakat', kode: 'Z', urutan: 10, is_active: true },
  { nama: 'Anak', kode: 'A', urutan: 9, is_active: false },
  { nama: 'budi', kode: 'B', urutan: 1, is_active: true },
];

const nama = (rows: BarisReferensiUrut[]) => rows.map((r) => r.nama);

describe('urutkanReferensi', () => {
  it('tanpa kode: mengembalikan salinan dengan urutan apa adanya', () => {
    const hasil = urutkanReferensi(baris, []);
    expect(nama(hasil)).toEqual(['Zakat', 'Anak', 'budi']);
    // Salinan, bukan array yang sama — `rows` biasanya state React.
    expect(hasil).not.toBe(baris);
  });

  it('tidak mengubah array masukan', () => {
    const asli = nama(baris);
    urutkanReferensi(baris, ['nama']);
    expect(nama(baris)).toEqual(asli);
  });

  it('mengurutkan kolom `urutan` sebagai ANGKA, bukan teks', () => {
    // Kalau diperlakukan sebagai teks: '1' < '10' < '9' → budi, Zakat, Anak.
    expect(nama(urutkanReferensi(baris, ['urutan']))).toEqual(['budi', 'Anak', 'Zakat']);
  });

  it('mengurutkan nama sebagai teks dan peka huruf besar/kecil', () => {
    // 'budi' (kecil) tetap sebelum 'Zakat' — localeCompare('id') mengabaikan
    // besar/kecil untuk keperluan pengurutan abjad.
    expect(nama(urutkanReferensi(baris, ['nama']))).toEqual(['Anak', 'budi', 'Zakat']);
  });

  it('arah turun membalik hasilnya', () => {
    expect(nama(urutkanReferensi(baris, ['nama'], 'turun'))).toEqual(['Zakat', 'budi', 'Anak']);
  });

  it('arah per kolom menang atas arah global', () => {
    const hasil = urutkanReferensi(baris, ['nama'], 'naik', { nama: 'turun' });
    expect(nama(hasil)).toEqual(['Zakat', 'budi', 'Anak']);
  });

  it('memecah token gabungan `a,b` dan memakai kolom berikutnya sebagai pemecah seri', () => {
    const seri: BarisReferensiUrut[] = [
      { nama: 'Sama', kode: 'B', urutan: 1 },
      { nama: 'Sama', kode: 'A', urutan: 2 },
    ];
    expect(urutkanReferensi(seri, ['nama,kode']).map((r) => r.kode)).toEqual(['A', 'B']);
  });

  it('`tampil` menerjemahkan is_active menjadi ya/tidak', () => {
    // 'tidak' < 'ya' secara abjad, jadi menaik menaruh yang NONAKTIF dulu.
    expect(urutkanReferensi(baris, ['tampil']).map((r) => r.is_active))
      .toEqual([false, true, true]);
    // Menurun membaliknya: yang aktif dulu.
    expect(urutkanReferensi(baris, ['tampil'], 'turun')[0].is_active).toBe(true);
  });

  it('`sumber` memakai resolver nama lembaga bila diberi', () => {
    const denganJenjang: BarisReferensiUrut[] = [
      { nama: 'a', jenjang: 'MD' },
      { nama: 'b', jenjang: 'MI' },
    ];
    const peta: Record<string, string> = { MI: 'Madrasah Ibtidaiyah', MD: 'Madrasah Diniyah' };
    const hasil = urutkanReferensi(denganJenjang, ['sumber'], 'naik', undefined,
      (j) => (j ? peta[j] ?? j : ''));
    // 'Madrasah Diniyah' < 'Madrasah Ibtidaiyah' → baris MD (nama 'a') dulu.
    expect(hasil.map((r) => r.nama)).toEqual(['a', 'b']);
    // Tanpa resolver, yang dibandingkan kode jenjang mentahnya; 'MD' < 'MI',
    // jadi kebetulan urutannya sama seperti lewat resolver di atas.
    expect(urutkanReferensi(denganJenjang, ['sumber']).map((r) => r.nama))
      .toEqual(['a', 'b']);
  });
});
