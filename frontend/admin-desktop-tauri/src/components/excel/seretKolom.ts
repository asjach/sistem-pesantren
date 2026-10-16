/**
 * Geser posisi kolom lewat seret pada JUDUL kolom.
 *
 * Aturan bisnis (murni, tanpa DOM) supaya bisa diuji terpisah dari grid:
 * - `pindahKolom` memindahkan satu key dari indeks `dari` ke indeks `ke`
 *   dengan pola splice (bukan tukar posisi): kolom lain bergeser mengisi
 *   celah, persis seperti geser baris di aplikasi spreadsheet.
 * - `indeksSisip` menerjemahkan posisi kursor (px) menjadi indeks sisip,
 *   memakai titik tengah tiap kolom: kursor di separuh kiri kolom N berarti
 *   "sebelum N", di separuh kanan berarti "sesudah N".
 * - `tandaSisip` memberi garis indikator: di kiri kolom ke-`sisip`, atau di
 *   kanan kolom terakhir bila menyisip di ujung.
 *
 * Seret TIDAK boleh mengubah daftar yang tak terlihat: key yang tidak ada di
 * `terlihat` diabaikan, dan key di luar daftar itu tak pernah disisipkan.
 */

/** Bungkus indeks ke rentang valid `[0, panjang]` (indeks sisip boleh == n). */
function jepit(i: number, panjang: number): number {
  if (!Number.isFinite(i)) return 0;
  return Math.min(panjang, Math.max(0, Math.round(i)));
}

/**
 * Pindahkan `dari` ke posisi `ke` (indeks sisip pada daftar TANPA item yang
 * dipindah). Mengembalikan salinan baru; masukan tak diubah.
 *
 * `ke` dihitung pada daftar setelah item diangkat, sama seperti hasil
 * `indeksSisip` yang dijalankan sambil item sumber masih di tempat asalnya —
 * karena itu indeksnya disesuaikan lebih dulu bila `ke > dari`.
 */
export function pindahKolom(
  terlihat: readonly string[],
  dari: number,
  ke: number,
): string[] {
  const n = terlihat.length;
  if (n === 0) return [...terlihat];
  const asal = jepit(dari, n - 1);
  const tujuan = jepit(ke, n);
  const sisa = terlihat.filter((_, i) => i !== asal);
  // `ke` mengacu ke daftar yang MASIH memuat item sumber: bila tujuannya di
  // belakang asal, satu posisi tergeser setelah item itu diangkat.
  const sisip = tujuan > asal ? tujuan - 1 : tujuan;
  sisa.splice(jepit(sisip, sisa.length), 0, terlihat[asal]);
  return sisa;
}

/**
 * Indeks sisip dari posisi kursor X relatif terhadap daftar kolom.
 *
 * `batas[i]` = offset kiri kolom ke-i; `lebar[i]` = lebarnya. Kursor sebelum
 * titik tengah kolom i → sisip di i; setelahnya → i + 1. Di luar area kolom,
 * hasilnya dijepit ke 0 atau jumlah kolom.
 */
export function indeksSisip(
  batas: readonly number[],
  lebar: readonly number[],
  x: number,
): number {
  const n = Math.min(batas.length, lebar.length);
  if (n === 0) return 0;
  for (let i = 0; i < n; i += 1) {
    const tengah = batas[i] + lebar[i] / 2;
    if (x < tengah) return i;
  }
  return n;
}

/**
 * Tanda garis sisip untuk `sisip`, sebagai indeks kolom acuan + sisi mana.
 * `sisip === n` (ujung kanan) memakai kolom terakhir dengan sisi `kanan`.
 * Mengembalikan null bila tak ada kolom untuk dijadikan acuan.
 */
export function tandaSisip(
  jumlah: number,
  sisip: number,
): { indeks: number; sisi: 'kiri' | 'kanan' } | null {
  if (jumlah <= 0) return null;
  const s = jepit(sisip, jumlah);
  if (s >= jumlah) return { indeks: jumlah - 1, sisi: 'kanan' };
  return { indeks: s, sisi: 'kiri' };
}
