import { describe, expect, it } from 'vitest';

import { DESKRIPSI_JENIS, JENIS_TEMPLATE, LABEL_JENIS } from './tipe';

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

});
