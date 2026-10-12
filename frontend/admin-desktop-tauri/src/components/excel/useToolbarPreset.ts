import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { errorMessage } from '@/api/client';
import { muatToolbarPreset, simpanToolbarPreset, type AlignKolomApi } from '@/api/toolbarPreset';
import {
  EVENT_TOOLBAR_BERUBAH,
  bacaAlign,
  kabariToolbar,
  type AlignKolom,
} from '@/components/kelolaTabel/jenis';

/**
 * State + pemuatan preset toolbar per tabel: apa yang benar-benar milik
 * TABEL — urutan kolom, perataan kolom, dan (dulu) peta `lebar`/`tinggi`/
 * `nilai_default` yang dulu menyimpan setelan komponen kustom.
 *
 * Setelan & ukuran komponen kustom (tinggi, lebar, lebar label/kontrol, sisi
 * yang mengembang, warna label, nilai awal, tipe input) TIDAK lagi lewat sini:
 * semuanya milik komponen dan disimpan di tabel `komponen_custom`, dibaca lewat
 * `useSetelanKomponen(konteks.tableKey, htmlFor)`. Yang tersisa di sini murni
 * setelan tabel, jadi memuat/menulis preset tak perlu menunggu peta komponen.
 *
 * Dimuat ulang otomatis saat event EVENT_TOOLBAR_BERUBAH untuk tableKey yang
 * sama. Tab Toolbar (visibilitas kontrol) sudah dihapus: tampil/sembunyi
 * kontrol tak lagi diatur dari Kelola Tabel.
 */
export function useToolbarPresetState(tableKey: string) {
  /** Perataan kolom global per tabel (absen = tengah). */
  const [alignDb, setAlignDb] = useState<Partial<Record<string, AlignKolom>>>({});
  /** Urutan kolom tersimpan di DB (null = belum dimuat; [] = bawaan halaman). */
  const [urutanDb, setUrutanDb] = useState<string[] | null>(null);

  /** Konteks "di dalam toolbar tabel": tinggal identitas tabel. */
  const konteksLebarFilter = useMemo(() => ({ tableKey }), [tableKey]);

  useEffect(() => {
    let batal = false;
    const muat = async () => {
      try {
        const res = await muatToolbarPreset(tableKey);
        if (batal) return;
        setAlignDb(bacaAlign(res.data.align));
        setUrutanDb(Array.isArray(res.data.urutan) ? res.data.urutan : []);
      } catch {
        if (batal) return;
        setAlignDb({});
        setUrutanDb([]);
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
    void simpanToolbarPreset(tableKey, undefined, undefined, gabung)
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

  return { alignDb, urutanDb, setUrutanDb, simpanAlign, konteksLebarFilter };
}