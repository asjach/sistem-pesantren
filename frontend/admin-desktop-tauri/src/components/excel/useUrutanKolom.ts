import { useCallback, useEffect, useRef } from 'react';

import { errorMessage } from '@/api/client';
import { simpanToolbarPreset } from '@/api/toolbarPreset';
import { updatePresetTabel } from '@/api/preset';
import { EVENT_PRESET_BERUBAH, EVENT_TOOLBAR_BERUBAH } from '@/components/kelolaTabel/jenis';
import { toast } from 'sonner';

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
 * Simpan urutan kolom (super_admin) dari menu konteks header: geser satu
 * langkah & reset urutan; penyimpanan ter-debounce (preset aktif → urutan
 * masuk ke preset itu; tanpa preset → urutan global per halaman).
 */
export function useUrutanKolom({
  tableKey,
  presetAktifId,
  setPresetKeys,
  setUrutanDb,
  getVisibleKeys,
  getFieldKeys,
}: UrutanKolomOptions) {
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

  const kembalikanUrutan = useCallback(() => {
    // Preset aktif: kembalikan ke urutan bawaan halaman untuk kolom tampil.
    if (presetAktifId !== null) {
      const terlihat = new Set(getVisibleKeys());
      simpanUrutan(getFieldKeys().filter((k) => terlihat.has(k)));
      return;
    }
    simpanUrutan([]);
  }, [presetAktifId, simpanUrutan, getVisibleKeys, getFieldKeys]);

  return { geserKolom, kembalikanUrutan };
}
