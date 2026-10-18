import { describe, expect, it } from 'vitest';

import { klipSeragam, sasaranBlokJadwal, sasaranKosongkanBlok } from './jadwalKlip';

/** Kunci kolom grid matriks: kelas + jam + 3 hari (seperti ExcelTable). */
const K = ['__kelas', '__slot', 'senin', 'selasa', 'rabu'];

/** Layak = hanya sel yang ditandai benar-benar berisi slot pelajaran. */
function layakDari(peta: Record<string, boolean>) {
  return (baris: number, hari: string) => peta[`${baris}|${hari}`] === true;
}

describe('sasaranBlokJadwal', () => {
  it('hanya kolom HARI yang jadi sasaran', () => {
    const s = sasaranBlokJadwal(
      { r0: 0, r1: 0, kolom: [0, 1, 2] }, K, ['senin', 'selasa', 'rabu'],
      layakDari({ '0|senin': true }),
    );
    expect(s).toEqual([{ baris: 0, hari: 'senin' }]);
  });

  it('sel di luar rentang baris dilewati', () => {
    const s = sasaranBlokJadwal(
      { r0: 1, r1: 2, kolom: [2] }, K, ['senin', 'selasa', 'rabu'],
      layakDari({ '1|senin': true, '2|senin': true, '9|senin': true }),
    );
    expect(s.map((x) => x.baris)).toEqual([1, 2]);
  });

  it('kolom tak dikenal / bukan hari dilewati', () => {
    const s = sasaranBlokJadwal(
      { r0: 0, r1: 0, kolom: [1, 99] }, K, ['senin'],
      () => true,
    );
    expect(s).toEqual([]);
  });

  it('sel tak layak (mis. slot istirahat) tidak masuk sasaran', () => {
    const s = sasaranBlokJadwal(
      { r0: 0, r1: 1, kolom: [2, 3] }, K, ['senin', 'selasa'],
      layakDari({ '0|senin': true, '1|selasa': true }),
    );
    expect(s).toEqual([{ baris: 0, hari: 'senin' }, { baris: 1, hari: 'selasa' }]);
  });
});

describe('sasaranKosongkanBlok', () => {
  /** Slot pelajaran untuk sel (baris, hari); null = bukan sel pelajaran. */
  const slot = (peta: Record<string, { kelasId: number; id: number }>) =>
    (r: number, h: string) => {
      const s = peta[`${r}|${h}`];
      return s === undefined ? null : { kelasId: s.kelasId, kelasNama: `K${s.kelasId}`, id: s.id, nama: null };
    };

  it('mengosongkan SELURUH range, bukan cuma satu sel', () => {
    // Blok 2 baris × 2 hari, semua sel pelajaran & berisi.
    const peta = {
      '0|senin': { kelasId: 1, id: 10 }, '0|selasa': { kelasId: 1, id: 20 },
      '1|senin': { kelasId: 1, id: 11 }, '1|selasa': { kelasId: 1, id: 21 },
    };
    const hasil = sasaranKosongkanBlok(2, ['senin', 'selasa'], slot(peta), () => true);
    expect(hasil.map((s) => `${s.slotId}|${s.hari}`)).toEqual([
      '10|senin', '20|selasa', '11|senin', '21|selasa',
    ]);
  });

  it('melewati sel yang sudah kosong', () => {
    const peta = { '0|senin': { kelasId: 1, id: 10 }, '0|selasa': { kelasId: 1, id: 20 } };
    const hasil = sasaranKosongkanBlok(1, ['senin', 'selasa'], slot(peta),
      (_k, slotId) => slotId === 10);
    expect(hasil.map((s) => s.slotId)).toEqual([10]);
  });

  it('melewati sel non-pelajaran (mis. istirahat)', () => {
    const peta = { '0|senin': { kelasId: 1, id: 10 } };
    const hasil = sasaranKosongkanBlok(1, ['senin', 'selasa'], slot(peta), () => true);
    expect(hasil).toHaveLength(1);
  });

  it('range lintas kelas terangkum semua', () => {
    const peta = {
      '0|senin': { kelasId: 1, id: 10 },
      '1|senin': { kelasId: 2, id: 30 },
    };
    const hasil = sasaranKosongkanBlok(2, ['senin'], slot(peta), () => true);
    expect(hasil.map((s) => s.kelasId)).toEqual([1, 2]);
  });

  it('tanpa sel berisi → kosong (pemanggil memunculkan "sudah kosong")', () => {
    const peta = { '0|senin': { kelasId: 1, id: 10 } };
    expect(sasaranKosongkanBlok(1, ['senin'], slot(peta), () => false)).toEqual([]);
  });
});

describe('klipSeragam', () => {
  const baca = (v: { mapel: number | null; guru: number | null } | null) => v;

  it('blok kosong → null', () => {
    expect(klipSeragam([], baca)).toBeNull();
  });

  it('isi seragam → terangkum jadi satu klip', () => {
    const isi = [{ mapel: 7, guru: 3 }, { mapel: 7, guru: 3 }];
    expect(klipSeragam(isi, baca)).toEqual({ mata_pelajaran_id: 7, keaktifan_pegawai_id: 3, jumlahSel: 2 });
  });

  it('mapel berbeda → null', () => {
    expect(klipSeragam([{ mapel: 7, guru: 3 }, { mapel: 8, guru: 3 }], baca)).toBeNull();
  });

  it('guru berbeda → null', () => {
    expect(klipSeragam([{ mapel: 7, guru: 3 }, { mapel: 7, guru: 4 }], baca)).toBeNull();
  });

  it('satu sel tanpa isi jadwal → null (bukan dianggap kosong)', () => {
    expect(klipSeragam([{ mapel: 7, guru: 3 }, null], baca)).toBeNull();
  });

  it('blok seragam kosong tetap sah (untuk mengosongkan sel tujuan)', () => {
    const isi = [{ mapel: null, guru: null }, { mapel: null, guru: null }];
    expect(klipSeragam(isi, baca)).toEqual({ mata_pelajaran_id: null, keaktifan_pegawai_id: null, jumlahSel: 2 });
  });

  it('mapel sama tapi guru beda (null vs terisi) → null', () => {
    expect(klipSeragam([{ mapel: 7, guru: null }, { mapel: 7, guru: 3 }], baca)).toBeNull();
  });
});
