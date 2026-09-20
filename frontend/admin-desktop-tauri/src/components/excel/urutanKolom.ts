/** Gabung urutan kolom tersimpan (global, super_admin) dengan kolom yang
 *  terlihat saat ini. Key tersimpan yang masih terlihat dipakai berurutan;
 *  kolom terlihat yang tak ada di simpanan (kolom baru) menempel di akhir
 *  dengan urutan bawaan. Fungsi murni agar mudah diuji. */
export function gabungUrutan(disimpan: readonly string[], terlihat: readonly string[]): string[] {
  const himpunan = new Set(terlihat);
  const depan = disimpan.filter((k) => himpunan.has(k));
  const sudah = new Set(depan);
  return [...depan, ...terlihat.filter((k) => !sudah.has(k))];
}
