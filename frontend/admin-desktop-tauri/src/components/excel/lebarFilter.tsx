import { createContext, useContext } from 'react';

/** Konteks setelan kotak kontrol toolbar per tabel (`useToolbarPresetState`).
 *
 *  Override lebar/tinggi/label/nilai awal diterapkan ke kotak anak berdasarkan
 *  `htmlFor`-nya; penulisan dilakukan dari popover klik-kanan tiap kontrol
 *  (lihat `usePengaturanKotak`). */
export interface KonteksLebarFilter {
  tableKey: string;
  /** Override lebar tersimpan: kunci filter → px. Absen = bawaan halaman. */
  lebar: Record<string, number>;
  /** Override TINGGI kotak kontrol tersimpan (kunci htmlFor → px). Absen =
   *  ikut prop `tinggi` pemanggil. Opsional agar pemakai konteks lama (mis.
   *  tes komponen) tak wajib mengisinya. */
  tinggi?: Record<string, number>;
  /** Override LEBAR LABEL terkunci (kunci htmlFor → px). Absen = ikut prop
   *  `lebarLabel` pemanggil. */
  lebarLabel?: Record<string, number>;
  /** Override LEBAR KONTROL terkunci (kunci htmlFor → px). Absen = ikut prop
   *  `lebarKombo` pemanggil. */
  lebarKontrol?: Record<string, number>;
  /** LABEL mengembang saat total diubah (kunci htmlFor → true). Absen =
   *  KONTROL yang mengembang (bawaan). */
  expandLabel?: Record<string, boolean>;
  /** Label TRANSPARAN (kunci htmlFor → true). Absen = label ber-bg (bawaan). */
  labelTransparan?: Record<string, boolean>;
  /** Nilai AWAL combobox (kunci htmlFor → label opsi). Absen = pakai nilai
   *  dari pemanggil. */
  nilaiDefault?: Record<string, string>;
  /** Simpan ukuran satu kontrol ke SERVER (dipakai popover klik-kanan).
   *  Disediakan `useToolbarPresetState`; absen = hanya simpan per perangkat. */
  simpanUkuran?: (htmlFor: string, ukuran: { lebar?: number | null; tinggi?: number | null; lebarLabel?: number | null; lebarKontrol?: number | null; expandLabel?: boolean | null; labelTransparan?: boolean | null; nilaiDefault?: string | null }) => void;
}

export const KonteksLebarFilter = createContext<KonteksLebarFilter | null>(null);

export function pakaiLebarFilter(): KonteksLebarFilter | null {
  return useContext(KonteksLebarFilter);
}
