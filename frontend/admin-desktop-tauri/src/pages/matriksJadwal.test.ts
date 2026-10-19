import { describe, expect, it } from 'vitest';

import type { JadwalBaris, SlotJadwal } from '@/api/kurikulum';

import { GAYA_GARIS, garisSelMatriks, type OpsiGaris } from './matriksJadwal';

function slot(ubah: Partial<SlotJadwal> = {}): SlotJadwal {
  return {
    id: 1, kelas_id: 7, hari: 'senin', nama_slot: 'JP 1', jenis: 'pelajaran',
    jam_mulai: '07:15', jam_selesai: '07:55', urutan: 1, ...ubah,
  };
}

function jadwal(ubah: Partial<JadwalBaris> = {}): JadwalBaris {
  return {
    id: 11, hari: 'senin', slot_jam_id: 1,
    pengampu_mapel_id: 3, mata_pelajaran_id: 5, keaktifan_pegawai_id: 9,
    nama_mapel: 'Matematika', guru: 'Siti Aminah',
    guru_nama_panggilan: 'Bu Siti', guru_nama_singkat: 'Siti',
    kode_mapel: 'MTK', singkatan: 'MTK',
    guru_gelar_depan: 'Drs.', guru_gelar_belakang: 'M.Pd',
    guru_jenis_kelamin: 'P', guru_pegawai_id: 9,
    ruangan: null,
    ...ubah,
  };
}

const OPSI: OpsiGaris = { tampilan: 'keduanya', formatMapel: 'nama', formatGuru: 'nama' };

describe('garisSelMatriks', () => {
  it('mapel + guru jadi DUA baris terpisah (bukan satu teksjoined)', () => {
    const baris = garisSelMatriks(slot(), jadwal(), OPSI);
    expect(baris).toHaveLength(2);
    expect(baris[0]).toEqual({ teks: 'Matematika', gaya: 'mapel' });
    expect(baris[1]).toEqual({ teks: 'Siti Aminah', gaya: 'guru_muda' });
  });

  it('huruf mapel & guru dibedakan lewat ukuran, bukan ikut huruf sel', () => {
    expect(GAYA_GARIS.mapel.ukuran).toBe(10);
    expect(GAYA_GARIS.guru_muda.ukuran).toBe(9);

    expect(GAYA_GARIS.penuh.ukuran).toBeUndefined();
  });

  it('guru belum diisi: baris guru DIHILANGKAN, tak jadi baris kosong', () => {
    const baris = garisSelMatriks(slot(), jadwal({ guru: null }), OPSI);
    expect(baris).toEqual([{ teks: 'Matematika', gaya: 'mapel' }]);
  });

  it('sel guru-saja (mapel null): satu baris guru, gaya huruf sel', () => {
    const baris = garisSelMatriks(
      slot(),
      jadwal({ mata_pelajaran_id: null, pengampu_mapel_id: null }),
      OPSI,
    );
    expect(baris).toEqual([{ teks: 'Siti Aminah', gaya: 'penuh' }]);
  });

  it('sel benar-benar kosong: tanpa baris sama sekali (tak ada placeholder)', () => {
    const baris = garisSelMatriks(
      slot(),
      jadwal({ mata_pelajaran_id: null, pengampu_mapel_id: null, guru: null }),
      OPSI,
    );
    expect(baris).toEqual([]);
  });

  it('tampilan "mapel" menyingkirkan baris guru', () => {
    const baris = garisSelMatriks(slot(), jadwal(), { ...OPSI, tampilan: 'mapel' });
    expect(baris).toEqual([{ teks: 'Matematika', gaya: 'penuh' }]);
  });

  it('tampilan "mapel" pada sel kosong: tak ada baris', () => {
    const baris = garisSelMatriks(slot(), jadwal({ nama_mapel: null }), { ...OPSI, tampilan: 'mapel' });
    expect(baris).toEqual([]);
  });

  it('tampilan "guru" pakai placeholder — untuk sel kosong & guru kosong', () => {
    expect(garisSelMatriks(slot(), jadwal(), { ...OPSI, tampilan: 'guru' })).toEqual([
      { teks: 'Siti Aminah', gaya: 'penuh' },
    ]);
    const kosong = jadwal({ mata_pelajaran_id: null, pengampu_mapel_id: null, guru: null });
    expect(garisSelMatriks(slot(), kosong, { ...OPSI, tampilan: 'guru' })).toEqual([
      { teks: '—', gaya: 'penuh' },
    ]);
  });

  it('format nama diteruskan ke tiap baris (kode mapel, prefiks guru)', () => {
    const baris = garisSelMatriks(slot(), jadwal(), {
      tampilan: 'keduanya', formatMapel: 'kode', formatGuru: 'prefiks',
    });
    expect(baris).toEqual([
      { teks: 'MTK', gaya: 'mapel' },
      { teks: 'Usth. Siti Aminah', gaya: 'guru_muda' },
    ]);
  });

  it('slot non-pelajaran terkunci: nama slot, tanpa mapel/guru walau ada', () => {
    const s = slot({ jenis: 'istirahat', nama_slot: 'Istirahat Pagi' });
    const baris = garisSelMatriks(s, jadwal(), OPSI);
    expect(baris).toEqual([{ teks: 'Istirahat Pagi', gaya: 'slot' }]);
  });

  it('slot non-pelajaran tanpa nama: pakai label jenisnya', () => {
    const s = slot({ jenis: 'pembiasaan', nama_slot: null });
    expect(garisSelMatriks(s, undefined, OPSI)).toEqual([
      { teks: 'Pembiasaan', gaya: 'slot' },
    ]);
  });

  it('slot tak ada (hari tanpa JP) atau jadwal tak termuat: tak ada baris', () => {
    expect(garisSelMatriks(undefined, jadwal(), OPSI)).toEqual([]);
    expect(garisSelMatriks(slot(), undefined, OPSI)).toEqual([]);
  });

  it('setiap gaya punya kelas Tailwind utuh (bukan dirakit saat runtime)', () => {
    for (const [nama, gaya] of Object.entries(GAYA_GARIS)) {
      expect(gaya.kelas, nama).toMatch(/\S/);

      expect(gaya.kelas, nama).not.toMatch(/\$\{|\s{2,}/);
    }
  });
});
