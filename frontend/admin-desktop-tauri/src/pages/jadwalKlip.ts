/** Info blok dari ExcelTable (indeks baris/kolom grid). */
export interface BlokGrid {
  r0: number;
  r1: number;
  kolom: number[];
}

/** Satu sel pelajaran sebuah blok matriks. */
export interface SasaranBlokJadwal {
  /** Indeks baris matriks (= indeks grid). */
  baris: number;
  /** Kunci kolom grid — hanya kolom HARI yang sah jadi sasaran. */
  hari: string;
}

/** Isi papan klip internal: satu pasangan mapel+guru yang SERAGAM. */
export interface KlipJadwal {
  mata_pelajaran_id: number | null;
  keaktifan_pegawai_id: number | null;
  /** Jumlah sel yang tersalin (untuk pesan hasil). */
  jumlahSel: number;
}

/**
 * Susun daftar sel yang tercakup sebuah blok grid.
 *
 * Hanya kolom HARI yang jadi sasaran (kolom "Kelas"/"Jam" cuma label baris).
 * `layak` menentukan sel mana yang benar-benar boleh diisi (mis. slot
 * ber-jenis pelajaran); sel yang tak layak dilewati, bukan sekadar kosong.
 */
export function sasaranBlokJadwal(
  blok: BlokGrid,
  kunciKolom: readonly string[],
  hari: readonly string[],
  layak: (baris: number, hari: string) => boolean,
): SasaranBlokJadwal[] {
  const hariSet = new Set(hari);
  const out: SasaranBlokJadwal[] = [];
  for (let r = blok.r0; r <= blok.r1; r += 1) {
    for (const c of blok.kolom) {
      const key = kunciKolom[c];
      if (key === undefined || !hariSet.has(key)) continue;
      if (!layak(r, key)) continue;
      out.push({ baris: r, hari: key });
    }
  }
  return out;
}

/** Satu sel yang akan dikosongkan (mapel + guru dihapus). */
export interface SasaranKosong {
  kelasId: number;
  kelasNama: string;
  hari: string;
  slotId: number;
  slotNama: string | null;
}

/**
 * Sel-sel yang perlu dikosongkan dari sederet baris blok × kunci hari.
 *
 * `slot` mengembalikan slot pelajaran pada (baris, hari) atau null bila sel
 * itu bukan sel pelajaran. `adaIsi` menentukan apakah sel itu sudah berisi —
 * sel kosong DILEWATI supaya tak ada permintaan sia-sia ke server dan jumlah
 * "sel dikosongkan" pada pesan hasil jujur.
 *
 * Inti perilakunya: SELURUH sel dalam range yang terseleksi ikut diperiksa,
 * bukan cuma satu sel — inilah yang membuat aksi "Kosongkan mapel & guru"
 * berlaku untuk range, bukan hanya sel yang diklik kanan.
 */
export function sasaranKosongkanBlok(
  jumlahBaris: number,
  hariBlok: readonly string[],
  slot: (baris: number, hari: string) => { kelasId: number; kelasNama: string; id: number; nama: string | null } | null,
  adaIsi: (kelasId: number, slotId: number, hari: string) => boolean,
): SasaranKosong[] {
  const out: SasaranKosong[] = [];
  for (let r = 0; r < jumlahBaris; r += 1) {
    for (const h of hariBlok) {
      const s = slot(r, h);
      if (s === null) continue;
      if (!adaIsi(s.kelasId, s.id, h)) continue;
      out.push({ kelasId: s.kelasId, kelasNama: s.kelasNama, hari: h, slotId: s.id, slotNama: s.nama });
    }
  }
  return out;
}

/**
 * Nilai SERAGAM dari sekumpulan sel; null bila blok kosong atau isinya campur
 * (termasuk saat ada sel tanpa isi jadwal).
 *
 * Syarat ini sejalan dengan seret isi sel: blok dianggap satu isi utuh, jadi
 * menyalin blok yang isinya campur akan menempelkan isi sel pertama ke
 * seluruh tujuan — itu menipu, jadi ditolak.
 */
export function klipSeragam<T>(
  sasaran: readonly T[],
  baca: (s: T) => { mapel: number | null; guru: number | null } | null,
): KlipJadwal | null {
  if (sasaran.length === 0) return null;
  const pertama = baca(sasaran[0]);
  if (pertama === null) return null;
  for (const s of sasaran) {
    const v = baca(s);
    if (v === null || v.mapel !== pertama.mapel || v.guru !== pertama.guru) return null;
  }
  return {
    mata_pelajaran_id: pertama.mapel,
    keaktifan_pegawai_id: pertama.guru,
    jumlahSel: sasaran.length,
  };
}
