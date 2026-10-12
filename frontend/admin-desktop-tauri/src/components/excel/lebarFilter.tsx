import { createContext, useContext } from 'react';

/**
 * Konteks "di dalam toolbar tabel" per tabel (`useToolbarPresetState`).
 *
 *  Isinya tinggal identitas tabel: setelan & ukuran tiap komponen kustom TAK
 *  lagi dibawa lewat konteks — semuanya dibaca dari store komponen custom
 *  (`components/komponenCustom.ts`, server), yang kuncinya `tableKey` +
 * `htmlFor`. Konteks ini tetap ada untuk (a) menandai komponen yang berada di
 *  dalam toolbar (gaya mendatar di `FilterField`, lebar bawaan 160px) dan
 *  (b)(setelan tabel sendiri: urutan kolom, perataan, visibilitas.
 */
export interface KonteksLebarFilter {
  tableKey: string;
}

export const KonteksLebarFilter = createContext<KonteksLebarFilter | null>(null);

export function pakaiLebarFilter(): KonteksLebarFilter | null {
  return useContext(KonteksLebarFilter);
}
