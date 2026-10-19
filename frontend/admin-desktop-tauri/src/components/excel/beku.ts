/** Kolom di kiri tabel yang dibekukan (sticky) menutupi konten yang digulir
 *  ke arahnya. Bila gulir horizontal berhenti di tengah kolom, kolom pertama
 *  di kanan area beku tampil terpotong. Fungsi ini menghitung `scrollLeft`
 *  yang meratakan tepi kiri kolom terdekat dengan tepi area beku, sehingga
 *  tidak ada kolom yang tersisa separuh terlihat setelah gulir berhenti.
 *
 *  `kolomKiri` = posisi tepi kiri tiap kolom (koordinat viewport) saat ini,
 *  `batas` = tepi kanan area beku (koordinat viewport). Hasil `null` = tak
 *  ada kolom yang bisa dijadikan patok. */
export function targetGulirBeku(
  kolomKiri: readonly number[],
  batas: number,
  scrollLeft: number,
  maxScroll: number,
): number | null {
  let terbaik: number | null = null;
  for (const kiri of kolomKiri) {
    const target = scrollLeft + (kiri - batas);

    if (target < 0 || target > maxScroll) continue;
    if (terbaik === null || Math.abs(target - scrollLeft) < Math.abs(terbaik - scrollLeft)) {
      terbaik = target;
    }
  }
  return terbaik;
}
