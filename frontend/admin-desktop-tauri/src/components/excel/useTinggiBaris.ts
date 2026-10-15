import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
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
 * Tinggi baris per tabel, **per baris**:
 * - **manual**: seret pegangan batas bawah baris hanya mengubah baris itu;
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
  /** Serial peta manual — dipakai ExcelTable sebagai tanda remount grid. */
  const [sigManual, setSigManual] = useState('');
  const refs = useRef({
    listener: null as null | (() => void),
    rowKey: '',
    mulai: 0,
    awal: 0,
    /** Jadwalkan pembaruan state (batasi frekuensi saat seret). */
    timer: null as null | ReturnType<typeof setTimeout>,
  });

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

  const setBaris = useCallback((rowKey: string, px: number) => {
    simpanManual({ ...manual, [rowKey]: Math.min(MAX_BARIS_H, Math.max(MIN_BARIS_H, Math.round(px))) });
  }, [manual, simpanManual]);

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

  /** Seret batas bawah baris: hanya baris ini yang berubah. */
  const mulaiSeret = useCallback((event: MouseEvent, rowKey: string, tinggiAwal: number) => {
    event.preventDefault();
    event.stopPropagation();
    const mulaiY = event.clientY;
    refs.current = { ...refs.current, rowKey, mulai: tinggiAwal, awal: tinggiAwal };

    const geser = (ev: globalThis.MouseEvent) => {
      const baru = Math.min(MAX_BARIS_H, Math.max(MIN_BARIS_H, Math.round(refs.current.awal + (ev.clientY - mulaiY))));
      refs.current.mulai = baru;
      // Batasi frekuensi state: grid di-remount setiap tinggi berubah.
      if (refs.current.timer !== null) return;
      refs.current.timer = setTimeout(() => {
        refs.current.timer = null;
        setManual((prev) => ({ ...prev, [rowKey]: refs.current.mulai }));
        setSigManual(serialPeta({ ...manual, [rowKey]: refs.current.mulai }));
      }, 60);
    };
    const selesai = () => {
      window.removeEventListener('mousemove', geser);
      window.removeEventListener('mouseup', selesai);
      refs.current.listener = null;
      if (refs.current.timer !== null) {
        clearTimeout(refs.current.timer);
        refs.current.timer = null;
      }
      const nilai = refs.current.mulai;
      const berikut = { ...manual, [rowKey]: nilai };
      setManual(berikut);
      setSigManual(serialPeta(berikut));
      prefSet(tinggiBarisKey(tableKey), JSON.stringify(berikut)).catch(() => {});
    };
    refs.current.listener?.();
    refs.current.listener = selesai;
    window.addEventListener('mousemove', geser);
    window.addEventListener('mouseup', selesai);
  }, [manual, tableKey]);

  useEffect(() => () => {
    refs.current.listener?.();
    if (refs.current.timer !== null) clearTimeout(refs.current.timer);
  }, []);

  return { manual, sigManual, autoIkut, setAutoIkut, setBaris, resetBaris, resetSemua, mulaiSeret };
}
