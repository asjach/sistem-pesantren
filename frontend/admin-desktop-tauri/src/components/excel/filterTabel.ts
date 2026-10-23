/** Helper peta visibilitas `toolbar_preset.visibilitas` yang dipakai bersama
 *  oleh menu toolbar V2 dan dialog Kelola Tabel.
 *
 *  `simpanToolbarPreset` menimpa SATU PETA utuh, jadi setiap penulisan harus
 *  merge: kunci `false` ditulis, kunci `true` dihapus (absen = tampil), dan
 *  kunci milik fitur lain dibiarkan. */

/** Gabungkan peta server dengan nilai yang diubah. */
export function gabungVisibilitas(
  server: Record<string, boolean>,
  nilai: Record<string, boolean>,
): Record<string, boolean> {
  const gabung: Record<string, boolean> = { ...server };
  for (const [k, v] of Object.entries(nilai)) {
    if (v === false) gabung[k] = false;
    else delete gabung[k];
  }
  return gabung;
}

/** Peta server tanpa kunci milik fitur ini (dipakai aksi "kembalikan ke
 *  bawaan": hapus penanda fitur ini, kunci lain dibiarkan). */
export function buangKunciVisibilitas(
  server: Record<string, boolean>,
  kunci: readonly string[],
): Record<string, boolean> {
  const gabung: Record<string, boolean> = { ...server };
  for (const k of kunci) delete gabung[k];
  return gabung;
}
