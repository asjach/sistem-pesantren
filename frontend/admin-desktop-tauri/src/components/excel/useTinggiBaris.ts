import { useCallback, useEffect, useState } from 'react';
import { prefGet, prefSet } from '@/api/client';
import { EVENT_TAMPILAN_PERANGKAT_BERUBAH } from '@/components/kelolaTabel/jenis';
import { MAX_BARIS_H, MIN_BARIS_H } from './tinggiBaris';

/** Pref tinggi baris manual per baris (JSON peta rowKey → px) per tabel. */
export function tinggiBarisKey(tableKey: string) {
  return `simpes_grid_${tableKey}_rowh`;
}

/** Pref "baris ikut isi" per tabel. */
export function autoBarisKey(tableKey: string) {
  return `simpes_grid_${tableKey}_rowauto`;
}

/** Pref tinggi baris DASAR per tabel (px) — tinggi seragam semua baris tabel
 *  ini, terpisah dari tinggi manual per baris di `tinggiBarisKey`. */
export function tinggiDasarKey(tableKey: string) {
  return `simpes_grid_${tableKey}_rowh_dasar`;
}

/** Baca angka dari pref, dijepit ke rentang; hasil tak terbaca = null. */
function bacaAngka(v: string | null, min: number, maks: number): number | null {
  if (v === null || v.trim() === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(maks, Math.max(min, Math.round(n)));
}

function bacaPeta(v: string | null): Record<string, number> {
  if (v === null || v.trim() === '') return {};
  try {
    const parsed = JSON.parse(v) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [k, n] of Object.entries(parsed as Record<string, unknown>)) {
      const angka = Number(n);
      if (Number.isFinite(angka) && angka >= MIN_BARIS_H && angka <= MAX_BARIS_H) {
        out[k] = Math.round(angka);
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Serialkan peta tinggi manual (urutan kunci stabil). */
function serialPeta(peta: Record<string, number>): string {
  return Object.keys(peta).sort().map((k) => `${k}:${peta[k]}`).join(',');
}

/**
 * Tinggi baris per tabel:
 * - **dasar**: satu tinggi untuk semua baris tabel ini (diatur di Kelola
 *   Tabel → Umum);
 * - **manual per baris**: sisa tinggi per baris yang masih tersimpan (mis.
 *   dari setelan lama). Tidak ada lagi seret pegangan batas bawah baris —
 *   mengubah tinggi per baris kini hanya lewat Kelola Tabel;
 * - **ikut isi** (MATI bawaan, bisa dinyalakan per tabel dari menu klik
 *   kanan): baris membesar sendiri bila teksnya membungkus; baris yang
 *   isinya muat tetap memakai tinggi dasar. Bawaan mati agar refresh/
 *   pagination tidak me-remount grid (sumber kedip) kecuali pengguna
 *   memang butuh bungkus teks.
 *
 * Catatan: `react-datasheet-grid` meng-cache offset baris dan tidak pernah
 * membersihkannya sendiri, jadi pemanggil wajib me-remount grid saat tinggi
 * berubah (lihat `sigTinggiBaris` di ExcelTable). Tabel kosong diberi
 * `rowHeight` angka agar jalur tinggi variabel DSG tidak dipakai.
 */
export function useTinggiBaris(tableKey: string) {
  const [manual, setManual] = useState<Record<string, number>>({});
  const [autoIkut, setAutoIkutState] = useState(false);
  /** Tinggi dasar tabel ini (null = belum diatur → pakai bawaan global/24px). */
  const [dasar, setDasarState] = useState<number | null>(null);
  /** Serial peta manual — dipakai ExcelTable sebagai tanda remount grid. */
  const [sigManual, setSigManual] = useState('');

  useEffect(() => {
    let hidup = true;
    const muat = () => {
      prefGet(tinggiBarisKey(tableKey))
        .then((v) => {
          if (!hidup) return;
          const peta = bacaPeta(v);
          setManual(peta);
          setSigManual(serialPeta(peta));
        })
        .catch(() => { /* tanpa tinggi manual bila pref gagal dibaca */ });
      prefGet(autoBarisKey(tableKey))
        // Bawaan MATI: hanya nilai eksplisit '1' yang menyalakan (pengguna yang
        // pernah menyalakan tetap ON; yang belum pernah atur ikut bawaan baru).
        .then((v) => { if (hidup) setAutoIkutState(v === '1'); })
        .catch(() => { /* bawaan: tidak ikut isi */ });
      prefGet(tinggiDasarKey(tableKey))
        .then((v) => { if (hidup) setDasarState(bacaAngka(v, MIN_BARIS_H, MAX_BARIS_H)); })
        .catch(() => { /* belum diatur → bawaan global/24px */ });
    };
    muat();
    // Tab Umum dialog Kelola Tabel mengubah pref yang sama dari luar grid
    // (sakelar baris-ikut-isi, reset total) — baca ulang tanpa reload.
    const segarkan = (e: Event) => {
      if ((e as CustomEvent).detail?.tableKey === tableKey) muat();
    };
    window.addEventListener(EVENT_TAMPILAN_PERANGKAT_BERUBAH, segarkan);
    return () => {
      hidup = false;
      window.removeEventListener(EVENT_TAMPILAN_PERANGKAT_BERUBAH, segarkan);
    };
  }, [tableKey]);

  const simpanManual = useCallback((next: Record<string, number>) => {
    setManual(next);
    setSigManual(serialPeta(next));
    prefSet(tinggiBarisKey(tableKey), JSON.stringify(next)).catch(() => {});
  }, [tableKey]);

  const resetBaris = useCallback((rowKey: string) => {
    if (manual[rowKey] === undefined) return;
    const next = { ...manual };
    delete next[rowKey];
    simpanManual(next);
  }, [manual, simpanManual]);

  const resetSemua = useCallback(() => simpanManual({}), [simpanManual]);

  const setAutoIkut = useCallback((nyawa: boolean) => {
    setAutoIkutState(nyawa);
    prefSet(autoBarisKey(tableKey), nyawa ? '1' : '0').catch(() => {});
  }, [tableKey]);

  /** Atur/reset tinggi dasar tabel ini. `null` = kembali ke bawaan global. */
  const setDasar = useCallback((n: number | null) => {
    const v = n == null ? null : Math.min(MAX_BARIS_H, Math.max(MIN_BARIS_H, Math.round(n)));
    setDasarState(v);
    prefSet(tinggiDasarKey(tableKey), v == null ? '' : String(v)).catch(() => {});
  }, [tableKey]);

  return {
    manual,
    sigManual,
    autoIkut,
    setAutoIkut,
    dasar,
    setDasar,
    resetBaris,
    resetSemua,
  };
}
