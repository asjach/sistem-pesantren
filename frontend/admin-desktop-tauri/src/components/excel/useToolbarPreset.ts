import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { errorMessage } from '@/api/client';
import { muatToolbarPreset, simpanToolbarPreset, type AlignKolomApi } from '@/api/toolbarPreset';
import {
  EVENT_TOOLBAR_BERUBAH,
  LEBAR_BAWAHAN_TOOLBAR,
  bacaAlign,
  bacaLebarFilter,
  bacaLebarToolbar,
  bacaVisToolbar,
  kabariToolbar,
  type AlignKolom,
  type LebarToolbar,
  type VisToolbar,
} from '@/components/kelolaTabel/jenis';

/**
 * State + pemuatan preset toolbar per tabel: visibilitas kontrol (info/urut/
 * kolom/filter), lebar kontrol berlebar, lebar kolom trigger preset, lebar
 * filter halaman, urutan kolom tersimpan di DB, dan perataan kolom global.
 * Dimuat ulang otomatis saat event EVENT_TOOLBAR_BERUBAH untuk tableKey
 * yang sama.
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
  /** Perataan kolom global per tabel (absen = tengah). */
  const [alignDb, setAlignDb] = useState<Partial<Record<string, AlignKolom>>>({});
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
        setAlignDb(bacaAlign(res.data.align));
        setUrutanDb(Array.isArray(res.data.urutan) ? res.data.urutan : []);
        const tersimpan = res.data.lebar?.kolom;
        setLebarKolomDb(typeof tersimpan === 'number' && tersimpan >= 40 && tersimpan <= 480 ? tersimpan : undefined);
      } catch {
        if (batal) return;
        setVisToolbar({ info: true, urut: true, kolom: true, filter: true });
        setLebarToolbar({ ...LEBAR_BAWAHAN_TOOLBAR });
        setLebarFilter({});
        setAlignDb({});
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

  /** Cermin terbaru alignDb untuk tulis optimistis (tanpa menunggu render). */
  const alignDbRef = useRef(alignDb);
  alignDbRef.current = alignDb;
  /** Monoton: hanya tulis terakhir yang boleh kabari/rollback (anti balapan
   *  klik cepat). */
  const versiAlignRef = useRef(0);

  /** Tulis perataan satu kolom ke DB global (satu sumber dengan dialog Kelola
   *  Tabel; dipakai menu klik-kanan): optimistis, rollback saat gagal. */
  const simpanAlign = useCallback((key: string, nilai: AlignKolom) => {
    const versi = ++versiAlignRef.current;
    const sebelum = alignDbRef.current;
    // Bersihkan undefined (rentang Partial) agar sesuai AlignKolomApi.
    const gabung: AlignKolomApi = {};
    for (const [k, v] of Object.entries(sebelum)) {
      if (v === 'left' || v === 'center' || v === 'right') gabung[k] = v;
    }
    gabung[key] = nilai;
    alignDbRef.current = gabung;
    setAlignDb(gabung);
    void simpanToolbarPreset(tableKey, undefined, undefined, undefined, gabung)
      .then(() => {
        if (versi === versiAlignRef.current) kabariToolbar(tableKey);
      })
      .catch((e: unknown) => {
        if (versi !== versiAlignRef.current) return;
        alignDbRef.current = sebelum;
        setAlignDb(sebelum);
        toast.error(errorMessage(e));
      });
  }, [tableKey]);

  return { visToolbar, lebarToolbar, lebarKolomDb, lebarFilter, alignDb, urutanDb, setUrutanDb, simpanAlign, konteksLebarFilter };
}
