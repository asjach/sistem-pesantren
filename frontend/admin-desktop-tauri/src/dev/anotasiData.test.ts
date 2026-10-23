import { describe, expect, it } from 'vitest';
import { normalisasiAnotasi } from './anotasiData';

const asal = { selector: '#tombol', tag: 'button', teks: 'Simpan', komponen: ['TopBar'], sumber: 'src/components/TopBar.tsx:20' };
const tujuan = { selector: '#wadah', tag: 'div', teks: '', komponen: ['Layout'], sumber: 'src/components/Layout.tsx:10', posisi: 'di_dalam' };

describe('normalisasiAnotasi', () => {
  const gambar = { berkas: 'screenshots/a1.png', lebar: 640, tinggi: 480, dibuat: '2026-10-23T00:00:00Z', preview_aktif: true };
  it('mengaitkan screenshot dengan ID anotasi tanpa mempertahankan field asing', () => {
    expect(normalisasiAnotasi({ ...asal, id: 'a1', instruksi: 'Ubah', gambar: { ...gambar, asing: 'x' } }).gambar).toEqual(gambar);
  });
  it.each([{}, [], 'x', { ...gambar, berkas: '../a1.png' }, { ...gambar, lebar: 0 }, { ...gambar, tinggi: 4097 }, { ...gambar, lebar: 1.5 }, { ...gambar, preview_aktif: 'true' }, { ...gambar, dibuat: 'bukan_tanggal' }])('menolak metadata screenshot tidak valid: %j', (nilai) => {
    expect(() => normalisasiAnotasi({ ...asal, id: 'a1', instruksi: 'Ubah', gambar: nilai })).toThrow();
  });
  it('mempertahankan preview sebelum dan sesudah pada asal maupun tujuan', () => {
    const preview = { sebelum: { color: 'red' }, sesudah: { color: 'rgb(0, 0, 255)' }, perubahan: { color: 'blue' } };
    const hasil = normalisasiAnotasi({ ...asal, instruksi: 'Samakan', preview, tujuan: { ...tujuan, preview } });
    expect(hasil.preview).toEqual(preview);
    expect(hasil.tujuan?.preview).toEqual(preview);
  });

  it.each([
    [], 'preview', {}, { sebelum: {}, sesudah: {}, perubahan: {} },
    { sebelum: {}, sesudah: {}, perubahan: { display: 'none' } },
    { sebelum: {}, sesudah: {}, perubahan: { color: 12 } },
    { sebelum: {}, sesudah: {}, perubahan: { asing: 'x' } },
  ])('menolak preview yang tidak valid atau tidak didukung: %j', (preview) => {
    expect(() => normalisasiAnotasi({ ...asal, instruksi: 'Samakan', preview })).toThrow();
    expect(() => normalisasiAnotasi({ ...asal, instruksi: 'Samakan', tujuan: { ...tujuan, preview } })).toThrow();
  });

  it('mempertahankan snapshot asal dan tujuan yang didukung', () => {
    const hasil = normalisasiAnotasi({ ...asal, instruksi: 'Samakan', style: { 'padding-top': '4px', color: 'red' }, tujuan: { ...tujuan, style: { 'background-color': 'rgba(0, 0, 0, 0)', 'font-size': '14px' } } });
    expect(hasil.style).toEqual({ 'padding-top': '4px', color: 'red' });
    expect(hasil.tujuan?.style).toEqual({ 'background-color': 'rgba(0, 0, 0, 0)', 'font-size': '14px' });
  });

  it('membatasi nilai snapshot dan membuang properti tidak dikenal', () => {
    const hasil = normalisasiAnotasi({ ...asal, instruksi: 'Samakan', style: { 'font-family': 'x'.repeat(300), color: '  red  ', width: '', asing: 'rahasia' } });
    expect(hasil.style?.['font-family']).toHaveLength(256);
    expect(hasil.style?.color).toBe('red');
    expect(hasil.style).not.toHaveProperty('asing');
    expect(hasil.style).not.toHaveProperty('width');
  });

  it.each(['style', [], { color: 10 }])('menolak bentuk snapshot yang tidak valid: %j', (style) => {
    expect(() => normalisasiAnotasi({ ...asal, instruksi: 'Samakan', style })).toThrow();
    expect(() => normalisasiAnotasi({ ...asal, instruksi: 'Samakan', tujuan: { ...tujuan, style } })).toThrow();
  });

  it('mempertahankan anotasi biasa tanpa field tujuan', () => {
    const hasil = normalisasiAnotasi({ ...asal, instruksi: '  Perbesar tombol  ' });
    expect(hasil).toMatchObject({ ...asal, instruksi: 'Perbesar tombol' });
    expect(hasil).not.toHaveProperty('tujuan');
  });

  it.each(['di_dalam', 'sebelum', 'sesudah'])('mempertahankan metadata lengkap kedua elemen dengan posisi %s', (posisi) => {
    const data = { ...asal, id: 'a1', dibuat: '2026-10-23T00:00:00Z', rute: '/daftar-kelas', instruksi: 'Pindahkan', tujuan: { ...tujuan, posisi } };
    expect(normalisasiAnotasi(data)).toEqual(data);
  });

  it.each([{}, { ...tujuan, posisi: 'di_atas' }, { ...tujuan, selector: '' }, { ...tujuan, tag: '' }, { ...tujuan, posisi: '__proto__' }, 'wadah', []])('menolak tujuan tidak lengkap atau posisi tidak dikenal: %j', (nilai) => {
    expect(() => normalisasiAnotasi({ ...asal, instruksi: 'Pindahkan', tujuan: nilai })).toThrow();
  });

  it('menolak asal dan tujuan dengan selector sama', () => {
    expect(() => normalisasiAnotasi({ ...asal, instruksi: 'Pindahkan', tujuan: { ...tujuan, selector: asal.selector } })).toThrow('harus berbeda');
  });

  it('menolak instruksi kosong', () => {
    expect(() => normalisasiAnotasi({ ...asal, instruksi: '  ', tujuan })).toThrow('Instruksi wajib diisi');
  });

  it('membatasi metadata asal dan tujuan serta membuang field asing', () => {
    const hasil = normalisasiAnotasi({ ...asal, instruksi: 'x'.repeat(5000), tujuan: { ...tujuan, sumber: 'x'.repeat(700), komponen: ['Layout', 1], tidak_dikenal: 'x' } });
    expect(hasil.instruksi).toHaveLength(4000);
    expect(hasil.tujuan?.sumber).toHaveLength(600);
    expect(hasil.tujuan?.komponen).toEqual(['Layout']);
    expect(hasil.tujuan).not.toHaveProperty('tidak_dikenal');
  });
});
