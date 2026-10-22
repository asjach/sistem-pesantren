import { terapkanSeret, type BlokIsi, type ModeSeret } from '@/components/excel/seretIsiSel';
import type { GridRow } from '@/components/excel/types';

/** Perubahan satu baris hasil seret isi sel. */
export interface PerubahanBaris {
  /** Id baris dalam bentuk string (kunci draft & antrean simpan). */
  id: string;
  /** Field yang nilainya berubah; siap dikirim ke antrean simpan. */
  fields: Record<string, string | null>;
}

/**
 * Susun perubahan per baris untuk seret isi sel V2.
 *
 *  `terapkanSeret` dari V1 dipakai apa adanya supaya semantik salin/pindah
 *  identik. Hasilnya dipersempit ke kolom yang benar-benar bisa disunting:
 *  kolom `static` tidak ikut berubah dan tidak ikut disimpan.
 */
export function susunPerubahanSeret(
  baris: readonly GridRow[],
  sumber: BlokIsi,
  target: BlokIsi,
  kunciKolom: readonly string[],
  editableKeys: ReadonlySet<string>,
  mode: ModeSeret,
): PerubahanBaris[] {
  const baru = terapkanSeret(baris, sumber, target, kunciKolom, mode);

  const barisTerdampak = new Set<number>();
  for (let r = target.r0; r <= target.r1; r += 1) barisTerdampak.add(r);
  if (mode === 'pindah') {
    for (let r = sumber.r0; r <= sumber.r1; r += 1) barisTerdampak.add(r);
  }

  const out: PerubahanBaris[] = [];
  for (const r of [...barisTerdampak].sort((a, b) => a - b)) {
    const lama = baris[r];
    const anyar = baru[r];
    if (!lama || !anyar) continue;

    const fields: Record<string, string | null> = {};
    for (const key of kunciKolom) {
      if (!editableKeys.has(key)) continue;
      const a = (lama[key] ?? null) as string | null;
      const b = (anyar[key] ?? null) as string | null;
      if ((a ?? '') !== (b ?? '')) fields[key] = b;
    }
    if (Object.keys(fields).length > 0) {
      out.push({ id: String(lama.id), fields });
    }
  }
  return out;
}
