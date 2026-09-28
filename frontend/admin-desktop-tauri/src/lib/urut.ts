import type { ArahUrut } from '@/api/urutPreset';

export type PetaArahKolom = Record<string, ArahUrut>;

/**
 * Susun token `sort` dari daftar kode + arah per kolom opsional.
 * Kode dengan arah sendiri ditulis `kode:naik`/`kode:turun` (dikenali backend
 * `UrutDaftar::parseUrut`); kode lain dibiarkan mengikuti `arah` global.
 */
export function tokenUrut(urut: readonly string[], arahKolom?: PetaArahKolom | null): string[] {
  if (!arahKolom) return [...urut];
  return urut.map((k) => {
    const a = arahKolom[k];
    return a === 'naik' || a === 'turun' ? `${k}:${a}` : k;
  });
}
