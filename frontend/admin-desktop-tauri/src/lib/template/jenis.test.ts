import { describe, expect, it } from 'vitest';

import { AWAL_KUNCI_ASET, DESKRIPSI_JENIS, idAsetDariKunci, JENIS_TEMPLATE, kunciAset, LABEL_JENIS } from './tipe';

describe('jenis template', () => {
  it('mencakup dua cara membuat halaman cetak', () => {
    expect(JENIS_TEMPLATE).toEqual(['pdf', 'html']);
  });

  it('memberi label Bahasa Indonesia untuk setiap jenis', () => {
    for (const jenis of JENIS_TEMPLATE) {
      expect(LABEL_JENIS[jenis]).toBeTruthy();
      expect(LABEL_JENIS[jenis]).not.toBe(jenis);
    }
  });

  it('menjelaskan cara setiap jenis dibuat', () => {
    // Penjelasan ini muncul di dialog buat template, jadi harus terisi dan
    // tidak boleh sama dengan label.
    for (const jenis of JENIS_TEMPLATE) {
      expect(DESKRIPSI_JENIS[jenis].length).toBeGreaterThan(20);
      expect(DESKRIPSI_JENIS[jenis]).not.toBe(LABEL_JENIS[jenis]);
    }

    expect(DESKRIPSI_JENIS.pdf).toContain('PDF');
    expect(DESKRIPSI_JENIS.html.toLowerCase()).toContain('kanvas');
  });


  it('membentuk kunci aset dari nomor aset', () => {
    expect(AWAL_KUNCI_ASET).toBe('aset:');
    expect(kunciAset(12)).toBe('aset:12');
    expect(idAsetDariKunci('aset:12')).toBe(12);
  });

  it('menolak kunci yang bukan aset', () => {
    // Salah baca di sini membuat berkas aset yang salah yang tercetak, jadi
    // bentuk yang bukan aset harus ditolak, bukan dianggap nomor.
    const salah = [null, undefined, '', 'nama_lengkap', 'aset:', 'aset:abc', 'aset:0', 'aset:-3', 'aset:1.5', 'ASET:7'];

    for (const satu of salah) {
      expect(idAsetDariKunci(satu)).toBeNull();
    }
  });
});
