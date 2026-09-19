import { createContext, useContext } from 'react';

/** Filter halaman yang terdaftar dari FilterField yang ter-render. */
export interface FilterTerdaftar {
  kunci: string;
  label: string;
  /** Lebar bawaan halaman terukur (px); kosong = belum terukur. */
  bawaanPx?: number;
}

/** Registri per tabel (modul-level): kunci filter → label + lebar terukur. */
const registri = new Map<string, Map<string, FilterTerdaftar>>();

export function daftarkanFilter(tableKey: string, kunci: string, label: string, bawaanPx?: number) {
  let daftar = registri.get(tableKey);
  if (!daftar) {
    daftar = new Map();
    registri.set(tableKey, daftar);
  }
  const lama = daftar.get(kunci);
  daftar.set(kunci, { kunci, label, bawaanPx: bawaanPx ?? lama?.bawaanPx });
}

export function daftarFilter(tableKey: string): FilterTerdaftar[] {
  return [...(registri.get(tableKey)?.values() ?? [])];
}

export function hapusFilter(tableKey: string, kunci: string) {
  registri.get(tableKey)?.delete(kunci);
}

/** Kunci bawaan toolbar (Urutkan/Kolom) yang tidak boleh masuk daftar filter. */
export function kunciFilterBawaan(kunci: string): boolean {
  return kunci.startsWith('select_urut_') || kunci.startsWith('select_preset_kolom_');
}

export interface KonteksLebarFilter {
  tableKey: string;
  /** Override lebar tersimpan: kunci filter → px. Absen = bawaan halaman. */
  lebar: Record<string, number>;
}

export const KonteksLebarFilter = createContext<KonteksLebarFilter | null>(null);

export function pakaiLebarFilter(): KonteksLebarFilter | null {
  return useContext(KonteksLebarFilter);
}
