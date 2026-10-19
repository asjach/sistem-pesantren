import { useEffect, useSyncExternalStore } from 'react';
import { toast } from 'sonner';

import { errorMessage } from '@/api/client';
import {
  hapusKomponenCustom,
  muatKomponenCustom,
  simpanKomponenCustom,
  type SetelanKomponen,
  type UbahSetelanKomponen,
} from '@/api/komponenCustom';
import { normalkanSetelanTipe } from '@/components/tipeInput';

/** Setelan komponen CUSTOM — SATU-SATUNYA tempat setelan komponen kustom
 *  dibaca & ditulis (dulu: `toolbar_preset` untuk yang di dalam toolbar tabel,
 *  dan store perangkat `ukuranKombo` untuk sisanya).
 *
 *  Satu entri per komponen, kunci = `tableKey` + `komponen` (htmlFor),
 *  disimpan di server (tabel `komponen_custom`). `tableKey` kosong untuk
 *  komponen di luar tabel (dialog, form, popover), sehingga komponen yang
 *  sama tetap punya setelannya di mana pun dipakai.
 *
 *  Baca: satu permintaan untuk seluruh peta (muatan kecil — hanya komponen yang
 *  benar-benar disetel), lalu nilai diambil sinkron dari cache. Tulis:
 *  KEADAAN LOKAL DULU supaya UI responsif, baru ke server; bila server menolak,
 *  nilai dikembalikan seperti semula + toast. */
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

      });
  }
  return janjiMuat;
}

/** Setelan satu komponen (absen = bawaan pemanggil). */
export function setelanKomponen(tableKey: string, komponen: string): SetelanKomponen {
  return peta.get(kunciSetelan(tableKey, komponen)) ?? KOSONG;
}

/** Gabung perubahan ke setelan satu komponen lalu kirim ke server. */
export function gabungSetelanKomponen(tableKey: string, komponen: string, ubah: UbahSetelanKomponen): void {
  const setelan = gabung(ubah, setelanKomponen(tableKey, komponen));
  if (Object.keys(setelan).length === 0) hapusSetelanKomponen(tableKey, komponen);
  else simpanSetelanKomponen(tableKey, komponen, setelan);
}

/** Ubah SATU kunci pengaturan tipe aktif (mis. `preset` pada tipe `nominal`).
 *  `null` = hapus kunci itu; bila `tipe` jadi kosong, kuncinya ikut dibuang
 *  supaya setelan komponen tak menyimpan objek hampa. */
export function ubahPengaturanTipe(tableKey: string, komponen: string, kunci: string, nilai: unknown): void {
  const tipe = { ...normalkanSetelanTipe(setelanKomponen(tableKey, komponen).tipe) };
  if (nilai === null || nilai === undefined) delete tipe[kunci];
  else tipe[kunci] = nilai;
  gabungSetelanKomponen(tableKey, komponen, { tipe: Object.keys(tipe).length === 0 ? null : tipe });
}

/** Tulis setelan satu komponen: dulu lokal (UI responsif), lalu ke server.
 *  Kegagalan server mengembalikan nilai sebelumnya + toast. */
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

/**
 * Terapkan perubahan pada setelan.
 *
 *  - `null`/`undefined` untuk sebuah kunci = HAPUS kunci itu (kembali ke bawaan),
 *    mis. reset baris "Lebar".
 *  - `expandLabel: false` juga berarti hapus: yang disimpan hanya `true`, karena
 *    bawaannya sudah "kontrol yang mengembang" — menyimpan `false` hanya menambah
 *    data tanpa mengubah tampilan. `labelTransparan` berbeda: `false` DISIMPAN
 *    karena itu arti tersendiri (label ber-bg, bukan transparan).
 */
export function gabung(ubah: UbahSetelanKomponen, setelan: SetelanKomponen): SetelanKomponen {
  const hasil = { ...setelan };
  for (const [kunci, nilai] of Object.entries(ubah) as [keyof SetelanKomponen, unknown][]) {
    if (nilai === null || nilai === undefined || ((kunci === 'expandLabel' || kunci === 'tanpaLabel') && nilai === false)) delete hasil[kunci];
    else Object.assign(hasil, { [kunci]: nilai });
  }
  return hasil;
}
