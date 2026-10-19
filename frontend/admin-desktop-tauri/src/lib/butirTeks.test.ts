import { describe, expect, it } from 'vitest';
import { pecahButir } from './butirTeks';

const BT = String.fromCharCode(96);

describe('pecahButir', () => {
  it('mengembalikan teks biasa sebagai satu potongan', () => {
    expect(pecahButir('Rekap per kas.')).toEqual([{ jenis: 'teks', isi: 'Rekap per kas.' }]);
  });

  it('mengenali kode di antara teks', () => {
    const hasil = pecahButir('Proyek dengan ' + BT + 'sanctum' + BT + ' berjalan.');

    expect(hasil).toEqual([
      { jenis: 'teks', isi: 'Proyek dengan ' },
      { jenis: 'kode', isi: 'sanctum' },
      { jenis: 'teks', isi: ' berjalan.' },
    ]);
  });

  it('mengenali teks tebal', () => {
    const hasil = pecahButir('Penting: **jangan diubah** ya.');

    expect(hasil).toEqual([
      { jenis: 'teks', isi: 'Penting: ' },
      { jenis: 'tebal', isi: 'jangan diubah' },
      { jenis: 'teks', isi: ' ya.' },
    ]);
  });

  it('mengubah tautan jadi teks + tujuan', () => {
    const hasil = pecahButir('Lihat [SCHEMA.md](SCHEMA.md) dulu.');

    expect(hasil).toEqual([
      { jenis: 'teks', isi: 'Lihat ' },
      { jenis: 'tautan', isi: 'SCHEMA.md', tujuan: 'SCHEMA.md' },
      { jenis: 'teks', isi: ' dulu.' },
    ]);
  });

  it('menangani beberapa markup sekaligus dengan urutan tetap', () => {
    const hasil = pecahButir(BT + 'a' + BT + ' dan **b** lalu [c](d).');

    expect(hasil.map((p) => p.jenis)).toEqual(['kode', 'teks', 'tebal', 'teks', 'tautan', 'teks']);
    expect(hasil[0].isi).toBe('a');
    expect(hasil[2].isi).toBe('b');
  });

  it('teks kosong menghasilkan daftar kosong', () => {
    expect(pecahButir('')).toEqual([]);
  });

  it('tidak membuang tanda yang tidak berpasangan', () => {
    const hasil = pecahButir('Nilai 2 * 3 dan ** ini.');

    expect(hasil).toEqual([{ jenis: 'teks', isi: 'Nilai 2 * 3 dan ** ini.' }]);
  });

  it('setiap potongan merekonstruksi teks asli bila markup dibuang', () => {
    const asal = 'Proyek dengan ' + BT + 'sanctum' + BT + ' dan [SCHEMA.md](SCHEMA.md).';
    const gabung = pecahButir(asal).map((p) => p.isi).join('');

    expect(gabung).toBe('Proyek dengan sanctum dan SCHEMA.md.');
  });
});
