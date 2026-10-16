import { describe, expect, it } from 'vitest';
import { konfigurasiFilterHalaman } from './filterHalaman';

describe('konfigurasiFilterHalaman', () => {
  it('pembayaran (kasir) memakai filter lembaga & tahun ajaran, plus rail kelas saja', () => {
    const k = konfigurasiFilterHalaman('pembayaran');
    expect(k.filter).toEqual(['lembaga', 'tahun_ajaran', 'kelas']);
    expect(k.tampil).toMatchObject({
      lembaga: true, tahun_ajaran: true, tingkat: false, kelas: true, semester: false,
    });
  });

  // Rail filter tab Tagihan (crosstab) hanya tampil bila `tingkat` & `kelas`
  // masuk daftar relevan — `tampil` saja tak cukup (lihat FilterRail).
  it('keuangan menyertakan filter tingkat & kelas untuk rail crosstab', () => {
    const k = konfigurasiFilterHalaman('keuangan');
    expect(k.filter).toContain('tingkat');
    expect(k.filter).toContain('kelas');
    expect(k.tampil).toMatchObject({ tingkat: true, kelas: true, semester: false });
  });

  // Halaman Dispensasi: jenjang + TA tampil di TopBar, tingkat & kelas di rail
  // tabel santrinya (halaman mendeklarasikan `rail` + keempat kunci ini).
  it('dispensasi menampilkan jenjang & tahun ajaran, plus rail tingkat & kelas', () => {
    const k = konfigurasiFilterHalaman('keuangan_dispensasi');
    expect(k.filter).toEqual(['lembaga', 'tahun_ajaran', 'tingkat', 'kelas']);
    expect(k.tampil).toMatchObject({
      lembaga: true, tahun_ajaran: true, tingkat: true, kelas: true, semester: false,
    });
  });

  it('halaman tanpa konfigurasi tampil tanpa filter', () => {
    const k = konfigurasiFilterHalaman('halaman_tidak_dikenal');
    expect(k.filter).toEqual([]);
    expect(k.tampil.lembaga).toBe(false);
  });

  // Modul Penilaian: master cukup jenjang + TA; leger/rapor butuh semester
  // (+ rail tingkat & kelas) karena nilainya per semester.
  it('penilaian: master hanya jenjang & TA, leger/rapor menyertakan semester', () => {
    const master = konfigurasiFilterHalaman('penilaian_master');
    expect(master.filter).toEqual(['lembaga', 'tahun_ajaran']);
    expect(master.tampil).toMatchObject({ lembaga: true, tahun_ajaran: true, semester: false });

    for (const key of ['penilaian_leger', 'penilaian_rapor']) {
      const k = konfigurasiFilterHalaman(key);
      expect(k.filter).toContain('semester');
      expect(k.filter).toContain('tingkat');
      expect(k.filter).toContain('kelas');
      expect(k.tampil).toMatchObject({ lembaga: true, tahun_ajaran: true, semester: true, tingkat: true, kelas: true });
    }

    const impor = konfigurasiFilterHalaman('penilaian_impor');
    expect(impor.filter).toContain('semester');
    expect(impor.tampil.kelas).toBe(true);
  });
});
