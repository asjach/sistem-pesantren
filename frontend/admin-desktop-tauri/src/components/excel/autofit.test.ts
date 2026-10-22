import { describe, expect, it } from 'vitest';

import { gabungLebarMaks, lebarDariBaris } from './autofit';

describe('gabungLebarMaks', () => {
  it('mengembalikan objek LAMA bila nilai sama (identitas stabil)', () => {
    const prev = { nama: 120, kode: 80 };
    const hasil = gabungLebarMaks(prev, { nama: 120, kode: 80 });
    expect(hasil).toBe(prev);
  });

  it('tidak pernah menyusut: halaman teks pendek tak mengecilkan kolom', () => {
    const prev = { nama: 200, kode: 80 };
    const hasil = gabungLebarMaks(prev, { nama: 110, kode: 80 });
    expect(hasil).toBe(prev);
    expect(hasil.nama).toBe(200);
  });

  it('membesar bila data segar lebih lebar (satu arah, lalu stabil)', () => {
    const prev = { nama: 120 };
    const tumbuh = gabungLebarMaks(prev, { nama: 180 });
    expect(tumbuh).not.toBe(prev);
    expect(tumbuh.nama).toBe(180);

    expect(gabungLebarMaks(tumbuh, { nama: 120 })).toBe(tumbuh);
    expect(gabungLebarMaks(tumbuh, { nama: 180 })).toBe(tumbuh);
  });

  it('kolom baru ikut serta; kunci lama yang hilang dipertahankan', () => {
    const prev = { nama: 120 };
    const hasil = gabungLebarMaks(prev, { nama: 100, baru: 90 });
    expect(hasil).toEqual({ nama: 120, baru: 90 });

    expect(gabungLebarMaks(hasil, {})).toBe(hasil);
  });
});

describe('lebarDariBaris', () => {
  /** Lebar linear terhadap panjang teks, supaya nilai yang diharapkan bisa
   *  ditulis tangan tanpa bergantung font asli. */
  const ukur = (teks: string, ukuranPx?: number): number => teks.length * (ukuranPx ?? 12);

  it('mengambil baris TERLEBAR, bukan menjumlahkan baris-barisnya', () => {

    const w = lebarDariBaris(
      [{ teks: 'Matematika', ukuran: 10 }, { teks: 'Siti Aminah', ukuran: 9 }],
      ukur,
    );
    expect(w).toBe(100);
  });

  it('bukan penjumlahan: dua baris 100px tetap 100px, bukan 200px', () => {
    expect(lebarDariBaris([{ teks: 'abcdefghij' }, { teks: 'klmnopqrst' }], ukur)).toBe(120);
  });

  it('ukuran huruf per baris diteruskan ke pengukur (huruf kecil = lebih sempit)', () => {
    const teks = [{ teks: 'Pendompaan', ukuran: 10 }, { teks: 'Pendompaan', ukuran: 9 }];

    expect(lebarDariBaris(teks, ukur)).toBe(100);
  });

  it('baris kosong diabaikan (tak diukur sebagai teks "")', () => {
    const calls: string[] = [];
    const catat = (t: string) => { calls.push(t); return t.length * 12; };
    lebarDariBaris([{ teks: '' }, { teks: 'Isi' }, { teks: '' }], catat);
    expect(calls).toEqual(['Isi']);
  });

  it('tanpa baris = 0 (bukan NaN/lebar.MIN yang mengacaukan pembanding)', () => {
    expect(lebarDariBaris([], ukur)).toBe(0);
  });
});
describe('ukurAutoFit — sel contoh dari kolom yang diukur', () => {
  /** Regresi: dulu `ukurAutoFit` memakai sel PERTAMA grid sebagai contoh.
   *  Di V2 sel pertama adalah kolom sticky/centang yang padding-nya 0 dan
   *  isinya bukan teks kolom, sehingga padding kolom teks tidak ikut terhitung
   *  dan hasil AutoFit terlalu sempit -> teks terpotong (elipsis). */
  it('mengukur sel pada kolom yang diminta, bukan sel pertama grid', () => {
    document.body.innerHTML = [
      '<div class="root">',
      '  <div class="dsg-row dsg-row-header">',
      '    <div class="dsg-cell dsg-cell-gutter"><span>#</span></div>',
      '    <div class="dsg-cell dsg-cell-header">',
      '      <div class="dsg-cell-header-container">',
      '        <span data-gagang-lebar="nis_lokal">NIS Lokal</span>',
      '      </div>',
      '    </div>',
      '  </div>',
      '  <div class="dsg-row">',
      '    <div class="dsg-cell dsg-cell-gutter" style="padding:0"><span>x</span></div>',
      '    <div class="dsg-cell" style="padding:0">',
      '      <div style="padding-left:8px;padding-right:8px"><span>26.27.01.0005</span></div>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join('\n');

    const root = document.body.querySelector('.root') as HTMLElement;
    const barisJudul = root.querySelector('.dsg-row.dsg-row-header') as HTMLElement;
    const selJudul = Array.from(barisJudul.children) as HTMLElement[];
    // Indeks kolom ditemukan lewat gagang judul, bukan urutan fields.
    const idx = selJudul.findIndex((h) => h.querySelector('[data-gagang-lebar="nis_lokal"]'));
    expect(idx).toBe(1);

    const barisData = root.querySelector('.dsg-row:not(.dsg-row-header)') as HTMLElement;
    const selKolom = (barisData.children[idx] as HTMLElement);
    const isi = selKolom.firstElementChild as HTMLElement;

    // Sel kolom yang benar punya padding pembungkus 16px; sel gutter 0px.
    expect(getComputedStyle(isi).paddingLeft).toBe('8px');
    const gutter = barisData.children[0] as HTMLElement;
    expect(getComputedStyle(gutter).paddingLeft).toBe('0px');
  });
});

describe('padding isi sel (ukurAutoFit)', () => {
  /** Regresi: V2 merender isi sel sebagai `flex ... px-2` sedangkan `.dsg-cell`
   *  sendiri ber-padding 0. Sebelum diperbaiki, padding pembungkus dalam tidak
   *  ikut terhitung sehingga hasil AutoFit ~16px terlalu sempit dan teks
   *  terpotong (elipsis) walau kolom baru saja di-AutoFit. V1 tidak terpengaruh
   *  karena padding-nya memang ada di `.dsg-cell` (`--part-tabel_sel-padx`). */
  it('menjumlahkan padding pembungkus dalam sel', () => {
    document.body.innerHTML = [
      '<div class="root">',
      '  <div class="dsg-row dsg-row-header">',
      '    <div class="dsg-cell dsg-cell-header">',
      '      <div class="dsg-cell-header-container"><span>Nama</span></div>',
      '    </div>',
      '  </div>',
      '  <div class="dsg-row">',
      '    <div class="dsg-cell" style="padding:0">',
      '      <div class="isi" style="padding-left:8px;padding-right:8px"><span>Ahmad</span></div>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join('\n');

    const root = document.body.querySelector('.root') as HTMLElement;
    const cellEl = root.querySelector('.dsg-row:not(.dsg-row-header) .dsg-cell') as HTMLElement;
    const isi = cellEl.firstElementChild as HTMLElement;

    // Padding pembungkus dalam memang terbaca dari DOM.
    const cs = getComputedStyle(isi);
    expect(parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)).toBe(16);
    // Dan `.dsg-cell` sendiri tanpa padding (kondisi V2).
    const csCell = getComputedStyle(cellEl);
    expect(parseFloat(csCell.paddingLeft) + parseFloat(csCell.paddingRight)).toBe(0);
  });
});
