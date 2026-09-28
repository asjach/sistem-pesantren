import { describe, expect, it } from 'vitest';

import {
  definisiKosong,
  duplikatMedan,
  gayaBawaan,
  gantiMedan,
  hapusMedan,
  idBaru,
  medanBaru,
  normalisasiDefinisi,
  pindahMedan,
  pindahkanMedan,
  ubahGaya,
  ukuranA4,
} from './medan';
import type { Medan } from './tipe';

function daftar(): Medan[] {
  return [
    medanBaru('teks', 1, null, []),
    medanBaru('paragraf', 1, null, [medanBaru('teks', 1, null, [])]),
  ];
}

describe('reducer medan template', () => {
  it('membuat medan dengan kotak dan gaya bawaan yang masuk akal', () => {
    const m = medanBaru('teks', 1);
    expect(m.tipe).toBe('teks');
    expect(m.w).toBeGreaterThan(0);
    expect(m.h).toBeGreaterThan(0);
    expect(m.gaya.font).toBe('helvetica');
    expect(m.gaya.ukuran).toBe(11);
    expect(m.gaya.skala_otomatis).toBe(true);
  });

  it('median tabel baru memakai grid penuh dan kepala tersendiri', () => {
    const m = medanBaru('baris_berulang', 1);
    const tabel = m.baris_berulang!;

    expect(tabel.tinggi_kepala).toBe(6);
    expect(tabel.gaya.garis_sel).toBeGreaterThan(0);
    expect(tabel.gaya.warna_kepala).toBe('#f1f1f1');
    expect(tabel.gaya.tebal_kepala).toBe(true);
    // Kotak medan harus memuat kepala ditambah seluruh slot baris.
    expect(m.h).toBeCloseTo(tabel.tinggi_kepala + tabel.jumlah * tabel.tinggi_baris, 5);
  });

  it('memberi nilai bawaan khas tiap tipe', () => {
    expect(medanBaru('centang', 1).huruf).toBe('✓');
    expect(medanBaru('centang', 1).huruf_kosong).toBe('');
    expect(medanBaru('gambar', 1).sizemode).toBe('sesuaikan');
    expect(medanBaru('halaman_otomatis', 1).format).toBe('Halaman {halaman} dari {jumlah}');
    expect(medanBaru('paragraf', 1).gaya.baris).toBeGreaterThan(1);
  });

  it('menyiapkan dua kolom bawaan untuk baris berulang', () => {
    const m = medanBaru('baris_berulang', 1);
    expect(m.baris_berulang?.jumlah).toBe(10);
    expect(m.baris_berulang?.kolom).toHaveLength(2);
    expect(m.baris_berulang?.kolom[0].kunci).toBe('no_urut');
    expect(m.baris_berulang?.kolom[1].sumber).toBe('baris');
  });

  it('memberi id unik walau ada id yang bentrok', () => {
    const m: Medan = { ...medanBaru('teks', 1), id: 'm1' };
    const lain = { ...medanBaru('teks', 1), id: 'm1' };
    expect(idBaru([m, lain])).not.toBe('m1');
  });

  it('mengganti medan tanpa mengubah id dan tanpa menyentuh yang lain', () => {
    const awal = daftar();
    const hasil = gantiMedan(awal, awal[0].id, { label: 'Nama Santri' });

    expect(hasil[0].label).toBe('Nama Santri');
    expect(hasil[0].id).toBe(awal[0].id);
    expect(hasil[1]).toBe(awal[1]);
  });

  it('mengabaikan penggantian dengan id yang tidak ada', () => {
    const awal = daftar();
    expect(gantiMedan(awal, 'tidak-ada', { label: 'X' })).toEqual(awal);
  });

  it('menjaga kotak tetap di dalam halaman', () => {
    const awal = daftar();
    const hasil = pindahMedan(awal, awal[0].id, { x: -40, y: 500 }, ukuranA4());

    expect(hasil[0].x).toBe(0);
    expect(hasil[0].y).toBe(297);
  });

  it('membolehkan keluar halaman bila ukuran belum diketahui', () => {
    const awal = daftar();
    const hasil = pindahMedan(awal, awal[0].id, { x: -40 }, null);
    expect(hasil[0].x).toBe(0);
  });

  it('mengubah gaya tanpa menimpa gaya lain', () => {
    const awal = daftar();
    const hasil = ubahGaya(awal, awal[0].id, { tebal: true });

    expect(hasil[0].gaya.tebal).toBe(true);
    expect(hasil[0].gaya.ukuran).toBe(awal[0].gaya.ukuran);
  });

  it('menghapus medan berdasarkan id', () => {
    const awal = daftar();
    const hasil = hapusMedan(awal, awal[0].id);
    expect(hasil).toHaveLength(1);
    expect(hasil[0].id).toBe(awal[1].id);
  });

  it('menduplikasi medan dengan id baru, label, dan posisi berbeda', () => {
    const awal = daftar();
    const hasil = duplikatMedan(awal, awal[0].id);

    expect(hasil).toHaveLength(3);
    const salinan = hasil[1];
    expect(salinan.id).not.toBe(awal[0].id);
    expect(salinan.label).toContain('salinan');
    expect(salinan.x).toBeGreaterThan(awal[0].x);
    // Gaya harus disalin, bukan dipakai bersama.
    expect(salinan.gaya).not.toBe(awal[0].gaya);
    expect(salinan.gaya).toEqual(awal[0].gaya);
  });

  it('menduplikasi baris berulang beserta kolomnya secara dalam', () => {
    const asal = medanBaru('baris_berulang', 1);
    const hasil = duplikatMedan([asal], asal.id);
    const salinan = hasil[1];

    expect(salinan.baris_berulang?.kolom[0].gaya).not.toBe(asal.baris_berulang?.kolom[0].gaya);
    expect(salinan.baris_berulang?.kolom[0].label).toBe('No');
  });

  it('mengabaikan duplikasi id yang tidak ada', () => {
    const awal = daftar();
    expect(duplikatMedan(awal, 'tidak-ada')).toEqual(awal);
  });

  it('memindahkan medan ke atas dan ke bawah', () => {
    const awal = daftar();
    const atas = pindahkanMedan(awal, awal[1].id, -1);
    expect(atas[0].id).toBe(awal[1].id);

    const bawah = pindahkanMedan(awal, awal[0].id, 1);
    expect(bawah[1].id).toBe(awal[0].id);
  });

  it('tidak bergerak melewati batas daftar', () => {
    const awal = daftar();
    expect(pindahkanMedan(awal, awal[0].id, -1)).toEqual(awal);
    expect(pindahkanMedan(awal, awal[1].id, 1)).toEqual(awal);
  });

  it('membuang medan bertipe asing saat normalisasi definisi', () => {
    const hasil = normalisasiDefinisi({
      versi: 1,
      medan: [
        { id: 'm1', tipe: 'teks', label: 'A' },
        { id: 'm2', tipe: 'watermark', label: 'B' },
        null,
        'bukan objek',
      ],
    });

    expect(hasil.medan).toHaveLength(1);
    expect(hasil.medan[0].id).toBe('m1');
    expect(hasil.versi).toBe(1);
  });

  it('menangani definisi yang rusak tanpa melempar', () => {
    expect(normalisasiDefinisi(null).medan).toEqual([]);
    expect(normalisasiDefinisi({}).medan).toEqual([]);
    expect(normalisasiDefinisi({ medan: 'bukan array' }).medan).toEqual([]);
  });

  it('membatasi jumlah medan sesuai batas aman', () => {
    const banyak = Array.from({ length: 200 }, (_, i) => ({ id: `m${i}`, tipe: 'teks', label: `M${i}` }));
    expect(normalisasiDefinisi({ medan: banyak }).medan.length).toBeLessThanOrEqual(60);
  });

  it('menyediakan definisi kosong yang sah', () => {
    expect(definisiKosong()).toEqual({ versi: 1, medan: [] });
  });

  it('gaya bawaan dapat ditimpa sebagian', () => {
    const g = gayaBawaan({ ukuran: 9, rata: 'tengah' });
    expect(g.ukuran).toBe(9);
    expect(g.rata).toBe('tengah');
    expect(g.font).toBe('helvetica');
  });
});
