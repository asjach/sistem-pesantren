import { describe, expect, it } from 'vitest';

import { BAGIAN_IDENTITAS, kolomDariKunci, fieldUntuk } from './bagianIdentitas';
import { SANTRI_IDENTITAS_FIELDS, TURUNAN_KEYS } from './kolomIdentitas';

const kunciTampil = BAGIAN_IDENTITAS.flatMap((b) => b.panels.flatMap((p) => p.kunci));

describe('bagianIdentitas', () => {
  it('menampilkan seluruh field yang bisa diedit', () => {
    // Kalau satu field lupa masuk kelompokan, field itu diam-diam tak bisa
    // diubah lagi dari form Ubah detail — jadi dijaga di sini.
    const editable = SANTRI_IDENTITAS_FIELDS
      .filter((f) => f.kind !== 'static' && !TURUNAN_KEYS.has(f.key))
      .map((f) => f.key);
    const tampil = new Set(kunciTampil.map(kolomDariKunci));

    expect(editable.filter((k) => !tampil.has(k))).toEqual([]);
  });

  it('tidak menggandakan field (satu kunci hanya di satu panel)', () => {
    const kembar = kunciTampil.filter((k, i) => kunciTampil.indexOf(k) !== i);
    expect(kembar).toEqual([]);
  });

  it('memetakan nama_lengkap ke kolom `nama`', () => {
    expect(kolomDariKunci('nama_lengkap')).toBe('nama');
    expect(kolomDariKunci('nik')).toBe('nik');
    expect(fieldUntuk('nama_lengkap')?.key).toBe('nama');
  });

  it('kunci tanpa kolom (id) tidak bisa diedit', () => {
    expect(fieldUntuk('id')).toBeNull();
  });

  it('keluarga tersusun 2×2: Ayah | Ibu di atas, Wali | Kartu keluarga di bawah', () => {
    const keluarga = BAGIAN_IDENTITAS.find((b) => b.judul === 'Keluarga');
    expect(keluarga?.panels.map((p) => p.judul)).toEqual([
      'Ayah', 'Ibu', 'Wali', 'Kartu keluarga',
    ]);
  });
});
