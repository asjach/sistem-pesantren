import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';

import { errorMessage } from '@/api/client';
import { simpanToolbarPreset } from '@/api/toolbarPreset';
import { updatePresetTabel } from '@/api/preset';
import { EVENT_PRESET_BERUBAH, EVENT_TOOLBAR_BERUBAH } from '@/components/kelolaTabel/jenis';
import { toast } from 'sonner';

/** Status seret kolom: kolom asal + kolom target (null = belum di atas target). */
export interface SeretKolom {
  dari: string;
  ke: string | null;
  sesudah: boolean;
}

export interface UrutanKolomOptions {
  tableKey: string;
  /** Id preset aktif (null = tanpa preset): target penyimpanan urutan. */
  presetAktifId: number | null;
  /** Timpa urutan preset aktif (optimistik). */
  setPresetKeys: (keys: string[]) => void;
  /** Timpa urutan global tersimpan (optimistik). */
  setUrutanDb: (keys: string[]) => void;
  /** Key kolom tampil saat ini (dibaca terkini saat callback jalan). */
  getVisibleKeys: () => string[];
  /** Key semua field halaman (dibaca terkini saat callback jalan). */
  getFieldKeys: () => string[];
}

/**
 * Seret & simpan urutan kolom (super_admin): state seret untuk umpan balik
 * visual, handler drag HTML5, penyimpanan ter-debounce (preset aktif → urutan
 * masuk ke preset itu; tanpa preset → urutan global per halaman), serta geser
 * satu langkah & reset urutan dari menu konteks header.
 */
export function useUrutanKolom({
  tableKey,
  presetAktifId,
  setPresetKeys,
  setUrutanDb,
  getVisibleKeys,
  getFieldKeys,
}: UrutanKolomOptions) {
  const [seret, setSeret] = useState<SeretKolom | null>(null);
  /** Cermin ref agar drop membaca nilai terbaru tanpa bikin ulang callback. */
  const seretRef = useRef<SeretKolom | null>(null);
  const tundaSimpanUrutan = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(tundaSimpanUrutan.current), []);

  /** Simpan urutan key kolom tampil. Preset aktif → urutan masuk ke preset itu
   *  (tiap preset bisa beda urutan); tanpa preset → urutan global per halaman. */
  const simpanUrutan = useCallback((keys: string[]) => {
    window.clearTimeout(tundaSimpanUrutan.current);
    if (presetAktifId !== null) {
      setPresetKeys(keys);
      tundaSimpanUrutan.current = window.setTimeout(() => {
        updatePresetTabel(presetAktifId, { kolom: keys })
          .then(() => {
            toast.success('Urutan kolom disimpan ke preset.');
            window.dispatchEvent(new CustomEvent(EVENT_PRESET_BERUBAH, { detail: { tableKey } }));
          })
          .catch((e) => toast.error(errorMessage(e)));
      }, 600);
      return;
    }
    setUrutanDb(keys);
    tundaSimpanUrutan.current = window.setTimeout(() => {
      simpanToolbarPreset(tableKey, undefined, undefined, keys)
        .then(() => {
          toast.success(keys.length === 0 ? 'Urutan kolom dikembalikan ke bawaan.' : 'Urutan kolom disimpan (berlaku semua).');
          window.dispatchEvent(new CustomEvent(EVENT_TOOLBAR_BERUBAH, { detail: { tableKey } }));
        })
        .catch((e) => toast.error(errorMessage(e)));
    }, 600);
  }, [tableKey, presetAktifId, setPresetKeys, setUrutanDb]);

  /** Geser satu langkah (tombol menu konteks). */
  const geserKolom = useCallback((colKey: string, arah: -1 | 1) => {
    const kini = getVisibleKeys();
    const i = kini.indexOf(colKey);
    const j = i + arah;
    if (i < 0 || j < 0 || j >= kini.length) return;
    const next = [...kini];
    next.splice(i, 1);
    next.splice(j, 0, colKey);
    simpanUrutan(next);
  }, [simpanUrutan, getVisibleKeys]);

  /** Pindahkan kolom `dari` ke posisi kolom `ke` (sesudah = di kanannya). */
  const pindahKolomKe = useCallback((dari: string, ke: string, sesudah: boolean) => {
    if (dari === ke) return;
    const kini = getVisibleKeys().filter((k) => k !== dari);
    let idx = kini.indexOf(ke);
    if (idx < 0) return;
    if (sesudah) idx += 1;
    kini.splice(idx, 0, dari);
    simpanUrutan(kini);
  }, [simpanUrutan, getVisibleKeys]);

  const kembalikanUrutan = useCallback(() => {
    // Preset aktif: kembalikan ke urutan bawaan halaman untuk kolom tampil.
    if (presetAktifId !== null) {
      const terlihat = new Set(getVisibleKeys());
      simpanUrutan(getFieldKeys().filter((k) => terlihat.has(k)));
      return;
    }
    simpanUrutan([]);
  }, [presetAktifId, simpanUrutan, getVisibleKeys, getFieldKeys]);

  const dragMulaiKolom = useCallback((key: string, e: DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', key);
    } catch {
      /* abaikan */
    }
    const s = { dari: key, ke: null as string | null, sesudah: false };
    seretRef.current = s;
    setSeret(s);
  }, []);
  const dragLewatKolom = useCallback((key: string, e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const sesudah = e.clientX > r.left + r.width / 2;
    const s = seretRef.current;
    if (s && s.dari !== key && (s.ke !== key || s.sesudah !== sesudah)) {
      const next = { ...s, ke: key, sesudah };
      seretRef.current = next;
      setSeret(next);
    }
  }, []);
  const dragJatuhKolom = useCallback((key: string, e: DragEvent) => {
    e.preventDefault();
    const s = seretRef.current;
    seretRef.current = null;
    setSeret(null);
    if (s && s.dari !== key) pindahKolomKe(s.dari, key, s.sesudah);
  }, [pindahKolomKe]);
  const dragSelesaiKolom = useCallback(() => {
    seretRef.current = null;
    setSeret(null);
  }, []);

  return { seret, geserKolom, kembalikanUrutan, dragMulaiKolom, dragLewatKolom, dragJatuhKolom, dragSelesaiKolom };
}
