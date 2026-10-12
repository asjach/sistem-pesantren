import { useEffect, useSyncExternalStore } from 'react';
import { toast } from 'sonner';

import {
  hapusKomponenCustom,
  muatKomponenCustom,
  simpanKomponenCustom,
  type SetelanKomponen,
} from '@/api/komponenCustom';
import { errorMessage } from '@/api/client';

/** Setelan komponen CUSTOM, satu entri per komponen: kunci = `tableKey` +
 *  `komponen` (htmlFor). Berbeda dengan ukuran toolbox, setelan ini milik
 *  komponen dan disimpan di SERVER (tabel `komponen_custom`), jadi ikut saat
 *  tabel dibuka di perangkat lain; komponen di luar tabel memakai `tableKey`
 *  kosong.
 *
 *  Tidak perlu izin khusus: setelannya diatur dari popover klik-kanan
 *  komponen, seperti ukuran kotak kontrol. */
const peta = new Map<string, SetelanKomponen>();
const pendengar = new Set<() => void>();
/** Setelan kosong yang selalu bernilai sama (dipakai `getSnapshot` bawaan). */
const KOSONG: SetelanKomponen = Object.freeze({});

/** Kunci gabung tabel + komponen. `tableKey` kosong = komponen di luar tabel. */
export function kunciSetelan(tableKey: string, komponen: string): string {
  return `${tableKey}|${komponen}`;
}

function beritahu(): void {
  for (const f of pendengar) f();
}

function langganan(f: () => void): () => void {
  pendengar.add(f);
  return () => {
    pendengar.delete(f);
  };
}

let janjiMuat: Promise<void> | null = null;

/** Muat peta setelan dari server SEKALI per sesi aplikasi. Kegagalan (offline /
 *  belum login) diabaikan: komponen memakai bawaan pemanggil. */
export function muatSetelanKomponen(): Promise<void> {
  if (janjiMuat === null) {
    janjiMuat = muatKomponenCustom()
      .then((res) => {
        peta.clear();
        for (const [kunci, setelan] of Object.entries(res.data.peta)) peta.set(kunci, setelan);
        beritahu();
      })
      .catch(() => {
        /* biarkan peta kosong: semua komponen jatuh ke bawaan pemanggil */
      });
  }
  return janjiMuat;
}

/** Setelan satu komponen (absen = bawaan pemanggil). */
export function setelanKomponen(tableKey: string, komponen: string): SetelanKomponen {
  return peta.get(kunciSetelan(tableKey, komponen)) ?? KOSONG;
}

/** Tulis setelan satu komponen: duluan lokal (UI responsif), lalu ke server.
 *  Kegagalan server dikembalikan ke setelan sebelumnya + toast. */
export function simpanSetelanKomponen(tableKey: string, komponen: string, setelan: SetelanKomponen): void {
  const kunci = kunciSetelan(tableKey, komponen);
  const sebelumnya = peta.get(kunci);
  peta.set(kunci, setelan);
  beritahu();
  simpanKomponenCustom(komponen, setelan, tableKey)
    .catch((e: unknown) => {
      if (sebelumnya === undefined) peta.delete(kunci);
      else peta.set(kunci, sebelumnya);
      beritahu();
      toast.error(errorMessage(e));
    });
}

/** Kembalikan setelan satu komponen ke bawaan (optimistik + hapus di server). */
export function hapusSetelanKomponen(tableKey: string, komponen: string): void {
  const kunci = kunciSetelan(tableKey, komponen);
  const sebelumnya = peta.get(kunci);
  peta.delete(kunci);
  beritahu();
  hapusKomponenCustom(komponen, tableKey)
    .catch((e: unknown) => {
      if (sebelumnya !== undefined) peta.set(kunci, sebelumnya);
      beritahu();
      toast.error(errorMessage(e));
    });
}

/** Hook setelan komponen; ikut berubah begitu popover mengubahnya. Memicu
 *  pemuatan sekali untuk seluruh aplikasi. */
export function useSetelanKomponen(tableKey: string, komponen: string): SetelanKomponen {
  useEffect(() => {
    void muatSetelanKomponen();
  }, []);
  return useSyncExternalStore(
    langganan,
    () => setelanKomponen(tableKey, komponen),
    () => KOSONG,
  );
}

/** Kosongkan cache (dipakai tes agar antar-tes tak saling memengaruhi). */
export function resetSetelanKomponen(): void {
  peta.clear();
  janjiMuat = null;
}