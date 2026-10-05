import { useEffect, useMemo, useState } from 'react';

import { muatToolbarPreset } from '@/api/toolbarPreset';
import {
  EVENT_TOOLBAR_BERUBAH,
  LEBAR_BAWAHAN_TOOLBAR,
  bacaLebarFilter,
  bacaLebarToolbar,
  bacaVisToolbar,
  type LebarToolbar,
  type VisToolbar,
} from '@/components/kelolaTabel/jenis';

/**
 * State + pemuatan preset toolbar per tabel: visibilitas kontrol (info/urut/
 * kolom/filter), lebar kontrol berlebar, lebar kolom trigger preset, lebar
 * filter halaman, dan urutan kolom tersimpan di DB. Dimuat ulang otomatis
 * saat event EVENT_TOOLBAR_BERUBAH untuk tableKey yang sama.
 */
export function useToolbarPresetState(tableKey: string) {
  /** Visibilitas kontrol toolbar generik (section Toolbar dialog Kelola Tabel). */
  const [visToolbar, setVisToolbar] = useState<VisToolbar>({ info: true, urut: true, kolom: true, filter: true });
  /** Lebar efektif kontrol berlebar (px); nilai awal = bawaan meski belum tersimpan. */
  const [lebarToolbar, setLebarToolbar] = useState<LebarToolbar>({ ...LEBAR_BAWAHAN_TOOLBAR });
  /** Lebar kolom tersimpan di DB (undefined = pakai presetKolomClassName halaman). */
  const [lebarKolomDb, setLebarKolomDb] = useState<number | undefined>(undefined);
  /** Lebar filter halaman tersimpan (kunci → px); absen = bawaan halaman. */
  const [lebarFilter, setLebarFilter] = useState<Record<string, number>>({});
  /** Urutan kolom tersimpan di DB (null = belum dimuat; [] = bawaan halaman). */
  const [urutanDb, setUrutanDb] = useState<string[] | null>(null);
  const konteksLebarFilter = useMemo(() => ({ tableKey, lebar: lebarFilter }), [tableKey, lebarFilter]);

  useEffect(() => {
    let batal = false;
    const muat = async () => {
      try {
        const res = await muatToolbarPreset(tableKey);
        if (batal) return;
        setVisToolbar(bacaVisToolbar(res.data.visibilitas));
        setLebarToolbar(bacaLebarToolbar(res.data.lebar));
        setLebarFilter(bacaLebarFilter(res.data.lebar));
        setUrutanDb(Array.isArray(res.data.urutan) ? res.data.urutan : []);
        const tersimpan = res.data.lebar?.kolom;
        setLebarKolomDb(typeof tersimpan === 'number' && tersimpan >= 40 && tersimpan <= 480 ? tersimpan : undefined);
      } catch {
        if (batal) return;
        setVisToolbar({ info: true, urut: true, kolom: true, filter: true });
        setLebarToolbar({ ...LEBAR_BAWAHAN_TOOLBAR });
        setLebarFilter({});
        setUrutanDb([]);
        setLebarKolomDb(undefined);
      }
    };
    void muat();
    const segarkan = (e: Event) => {
      if ((e as CustomEvent).detail?.tableKey === tableKey) void muat();
    };
    window.addEventListener(EVENT_TOOLBAR_BERUBAH, segarkan);
    return () => {
      batal = true;
      window.removeEventListener(EVENT_TOOLBAR_BERUBAH, segarkan);
    };
  }, [tableKey]);

  return { visToolbar, lebarToolbar, lebarKolomDb, lebarFilter, urutanDb, setUrutanDb, konteksLebarFilter };
}
