import { MIN_COL_W } from './helpers';

/** Sisa lebar gagang seret kolom (`.simpes-dsg-resizer`) yang menjorok ke
 *  KANAN tepi kolom terakhir. Gagangnya 12 px dan digambar di tengah garis
 *  tepi, jadi ±5 px menggantung di luar `.dsg-container`; tanpa dipotong,
 *  `scrollWidth` jadi 5 px lebih besar dari `clientWidth` dan gulir
 *  horizontal muncul sendiri walau kolom sudah pas. */
export const RESIZER_OVERHANG = 6;

/** Lebar basis satu kolom data (px) — hasil rantai lebar yang sama dengan
 *  `basis` kolom di ExcelTable (lebar pengguna → AutoFit → lebar field). */
export interface KolomBasis {
  key: string;
  lebar: number;
}

/** Hasil penskalaan: lebar final per kolom + rasio yang dipakai (dibutuhkan
 *  seret gagang lebar agar gerakan kursor 1 px tetap terasa 1 px di layar). */
export interface HasilSkalaIsi {
  lebar: Record<string, number>;
  rasio: number;
}

/**
 * Skala lebar kolom data agar TOTAL tabel mengisi lebar wadahnya.
 *
 * Rasio = (lebar wadah − kolom tetap) / total lebar kolom data, lalu rasio itu
 * dikalikan ke SETIAP kolom data. Rasio bisa > 1 (tabel melebar mengisi ruang
 * kosong) maupun < 1 (tabel menyempit agar tak menggulir horizontal):
 *
 * ```
 * wadah 800, tabel 400 (50 + 150 + 200) → rasio 2 → 100 + 300 + 400
 * wadah 300, tabel 400 (50 + 150 + 200) → rasio 3/4 → 37,5 + 112,5 + 150
 * ```
 *
 * Kolom tetap (gutter nomor baris, centang, Aksi) TIDAK ikut diskalakan — ia
 * chrome tabel, bukan data: mencentang kolom jadi 200px hanya karena tabelnya
 * lebar itu jelas salah. Karena itu ruang untuk kolom data = wadah − kolom
 * tetap, bukan rasio terhadap lebar seluruh tabel.
 *
 * Pembulatan: tiap kolom di-`floor` dulu, lalu sisa 1–2 px dibagikan ke kolom
 * berfraksi terbesar supaya jumlahnya TEPAT selebar wadah (tanpa celah di
 * kanan, tanpa gulir horizontal karena kelebihan 1 px). Saat menyusut, kolom
 * tak pernah lebih sempit dari `minKolom`; bila batas itu membuat total masih
 * kelebihan, hasilnya memang lebih lebar dari wadah (tabel menggulir) —
 * menyusutkan teks sampai tak terbaca bukan pilihan yang lebih baik.
 *
 * @returns lebar final + rasio, atau `null` bila penskalaan tak masuk akal
 *          (wadah belum terukur, tak ada kolom, ruang habis oleh kolom tetap)
 *          — pemanggil memakai lebar basis apa adanya.
 */
export function skalaLebarIsi(
  kolom: readonly KolomBasis[],
  lebarWadah: number,
  lebarTetap: number,
  minKolom: number = MIN_COL_W,
): HasilSkalaIsi | null {
  if (kolom.length === 0) return null;
  const totalBasis = kolom.reduce((n, k) => n + Math.max(0, k.lebar), 0);

  const tersedia = Math.floor(lebarWadah - lebarTetap);
  if (totalBasis <= 0 || tersedia <= 0) return null;

  const rasio = tersedia / totalBasis;
  const hasil = kolom.map((k) => {
    const mentah = Math.max(0, k.lebar) * rasio;
    const bulat = Math.floor(mentah);
    return { key: k.key, lebar: Math.max(minKolom, bulat), fraksi: mentah - bulat };
  });

  let selisih = tersedia - hasil.reduce((n, h) => n + h.lebar, 0);

  const urutFraksi = [...hasil].sort((a, b) => b.fraksi - a.fraksi);
  let i = 0;
  while (selisih > 0 && urutFraksi.length > 0) {
    urutFraksi[i % urutFraksi.length].lebar += 1;
    selisih -= 1;
    i += 1;
  }

  const urutLebar = [...hasil].sort((a, b) => b.lebar - a.lebar);
  i = 0;
  while (selisih < 0 && urutLebar.some((h) => h.lebar > minKolom)) {
    const h = urutLebar[i % urutLebar.length];
    if (h.lebar > minKolom) {
      h.lebar -= 1;
      selisih += 1;
    }
    i += 1;
  }

  const out: Record<string, number> = {};
  for (const h of hasil) out[h.key] = h.lebar;
  return { lebar: out, rasio };
}
