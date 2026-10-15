/**
 * Penanda antre per bagian untuk indikator "Menyimpan…" dialog Kelola Tabel.
 *
 * Latar: tiap bagian dialog (umum/visibilitas/kolom/urutan) menyimpan sendiri
 * saat nilainya berubah. Indikator footer berbunyi "Menyimpan…" selama ada
 * bagian yang masih berjalan. Karena satu bagian bisa menyimpan beberapa kali
 * berturut-turut (ketikan cepat), hasil permintaan LAMA tidak boleh mematikan
 * indikator milik permintaan BARU — itulah gunanya nomor urut.
 *
 * Bug yang pernah terjadi: nomor urutnya SATU counter global, padahal yang
 * dijaga adalah balapan per bagian. Dua bagian berbeda yang tumpang tindih
 * membuat bagian yang selesai lebih dulu melihat nomornya bukan lagi yang
 * terakhir, sehingga namanya TIDAK PERNAH dibuang dari daftar — indikator
 * terus berbunyi "Menyimpan…" sampai dialog ditutup.
 */
export interface AntrePerBagian {
  /** Nomor urut permintaan berikutnya untuk satu bagian. */
  mulai: (id: string) => number;
  /** Apakah permintaan bernomor `nomor` milik `id` masih yang terakhir? */
  terakhir: (id: string, nomor: number) => boolean;
}

export function buatAntrePerBagian(): AntrePerBagian {
  const nomor: Record<string, number> = {};
  return {
    mulai(id) {
      const n = (nomor[id] ?? 0) + 1;
      nomor[id] = n;
      return n;
    },
    terakhir(id, n) {
      return nomor[id] === n;
    },
  };
}

/**
 * Buang `id` dari daftar "sedang disimpan" HANYA bila permintaannya masih
 * yang terakhir untuk bagian itu. Mengembalikan daftar yang sama (identitas
 * referensi dipertahankan) bila tak ada yang perlu diubah, supaya tak memicu
 * render ulang yang sia-sia.
 */
export function selesaikanSimpan(
  sedang: readonly string[],
  id: string,
  masihTerakhir: boolean,
): readonly string[] {
  if (!masihTerakhir) return sedang;
  if (!sedang.includes(id)) return sedang;
  return sedang.filter((x) => x !== id);
}
