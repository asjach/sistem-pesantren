/**
 * Kelengkapan nilai kelas untuk pengaman cetak rapor.
 *
 * Dipakai halaman Rapor: tombol "Cetak / PDF" hanya boleh aktif bila SEMUA
 * santri dalam daftar sudah lengkap. Ringkasan dari server hanya memberi
 * hitungan agregat (`lengkap`), sehingga status per santri dihitung dari
 * `mapel` (jumlah mapel yang sudah bernilai) terhadap `mapel_wajib`
 * (jumlah mapel kelas yang seharusnya ternilai).
 */

/** Ringkasan kelas dari `GET /admin/penilaian/rapor-kelas`. */
export interface RingkasanKelengkapan {
  santri: number;
  lengkap: number;
  mapel: number;
}

/** Satu baris santri pada daftar rapor kelas. */
export interface BarisKelengkapanSantri {
  santri_id: number;
  mapel: number;
}

/** Daftar mapel kelas — panjangnya menjadi jumlah mapel wajib. */
export interface MapelKelengkapan {
  id: number;
}

export interface KelengkapanKelas {
  /** Semua santri sudah bernilai penuh DAN kelas punya mapel. */
  lengkap: boolean;
  /** Jumlah santri yang belum lengkap. */
  belum: number;
  /** Santri yang belum lengkap, dibesarkan dulu yang paling sedikit nilainya. */
  santriKurang: { santri_id: number; kurang: number }[];
  /** Jumlah mapel wajib kelas itu; 0 = mapel belum diisi. */
  mapelWajib: number;
}

/**
 * Hitung status kelengkapan kelas.
 *
 * Kelas tanpa mapel dianggap BELUM lengkap (tidak ada yang bisa dinilai),
 * begitu pula kelas tanpa santri.
 */
export function hitungKelengkapanKelas(
  baris: BarisKelengkapanSantri[],
  mapel: MapelKelengkapan[],
): KelengkapanKelas {
  const mapelWajib = mapel.length;

  const kurang = baris
    .map((b) => ({ santri_id: b.santri_id, kurang: Math.max(0, mapelWajib - b.mapel) }))
    .filter((b) => b.kurang > 0)
    .sort((a, b) => b.kurang - a.kurang || a.santri_id - b.santri_id);

  return {
    lengkap: mapelWajib > 0 && baris.length > 0 && kurang.length === 0,
    belum: kurang.length,
    santriKurang: kurang,
    mapelWajib,
  };
}

/** Kalimat alasan tombol cetak dikunci, atau '' bila boleh dicetak. */
export function alasanCetakTerkunci(k: KelengkapanKelas): string {
  if (k.lengkap) return '';
  if (k.mapelWajib === 0) return 'Kelas ini belum punya mapel — isi Pengampu dulu sebelum mencetak rapor.';
  if (k.belum === 0) return 'Belum ada santri pada kelas ini.';
  return `${k.belum} santri belum lengkap nilainya — lengkapi dulu sebelum mencetak rapor.`;
}
