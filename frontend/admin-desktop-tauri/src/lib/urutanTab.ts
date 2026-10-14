import type { TabHalamanDef } from './halaman';

/** Urutan rute tab yang sudah diterapkan. */
export interface SusunanTab {
  /** Tab yang tampil, sudah berurut. */
  tampil: TabHalamanDef[];
  /** Tab yang disembunyikan (masih terdaftar di kode), berurut. */
  sembunyi: TabHalamanDef[];
}

/**
 * Terapkan urutan + sembunyi tersimpan ke daftar tab dari kode.
 *
 * Prinsip (jangan diubah tanpa alasan kuat):
 * - Rute di KODE adalah sumber kebenaran daftar tab. `urutan` hanya mengatur
 *   POSISI, jadi tab yang baru lahir di kode tidak pernah hilang: rute yang
 *   belum ada di `urutan` ditempatkan mengikuti urutan kode, SETELAH rute
 *   yang sudah diatur tapi SEBELUM rute yang tak dikenal.
 * - Rute di `urutan` yang tak lagi ada di kode DIBUANG (sudah dihapus dari
 *   aplikasi) — kalau dibiarkan, ia menahan posisi tab yang sebenarnya.
 * - `sembunyi` hanya memindahkan tab dari `tampil` ke `sembunyi`; posisinya di
 *   `urutan` tidak disentuh supaya menampilkan lagi mengembalikan tempatnya.
 */
export function susunTab(
  tabKode: readonly TabHalamanDef[],
  urutan: readonly string[],
  sembunyi: readonly string[],
): SusunanTab {
  const adaDiKode = new Set(tabKode.map((t) => t.to));
  const disimpan = urutan.filter((r) => adaDiKode.has(r));
  const dikenal = new Set(disimpan);
  // Rute yang belum pernah diatur: pertahankan urutan kode, di akhir.
  const baru = tabKode.map((t) => t.to).filter((r) => !dikenal.has(r));
  const hasil = [...disimpan, ...baru];
  const peta = new Map(tabKode.map((t) => [t.to, t]));
  const setSembunyi = new Set(sembunyi);

  const tampil: TabHalamanDef[] = [];
  const tersembunyi: TabHalamanDef[] = [];
  for (const rute of hasil) {
    const tab = peta.get(rute);
    if (!tab) continue;
    if (setSembunyi.has(rute)) tersembunyi.push(tab);
    else tampil.push(tab);
  }
  return { tampil, sembunyi: tersembunyi };
}
