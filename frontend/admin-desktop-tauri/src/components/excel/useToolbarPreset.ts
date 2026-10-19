import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { errorMessage } from '@/api/client';
import {
  muatToolbarPreset,
  simpanToolbarPreset,
  type AlignKolomApi,
  type VisibilitasToolbar,
} from '@/api/toolbarPreset';
import {
  EVENT_TOOLBAR_BERUBAH,
  bacaAlign,
  bacaLabel,
  kabariToolbar,
  type AlignKolom,
} from '@/components/kelolaTabel/jenis';

/** Bersihkan peta visibilitas dari server: kunci huruf kecil/underscore saja,
 *  nilai boolean saja. Absen = tampil, jadi yang benar-benar disimpan hanyalah
 *  penanda "sembunyi" — peta usang (termasuk kunci kontrol versi lama yang
 *  sudah tak ada) dibuang supaya tak membuat kontrol hilang tanpa alasan. */
function visibilitasBersih(v: Record<string, unknown> | undefined): VisibilitasToolbar {
  const hasil: VisibilitasToolbar = {};
  for (const [k, nilai] of Object.entries(v ?? {})) {
    if (!/^[a-z0-9_]{1,60}$/.test(k)) continue;
    if (nilai === true) hasil[k] = true;
    else if (nilai === false) hasil[k] = false;
  }
  return hasil;
}

/**
 * State + pemuatan preset toolbar per tabel: apa yang benar-benar milik
 * TABEL — visibilitas filter toolbar, urutan kolom, perataan kolom, judul,
 * info tabel, dan (dulu) peta `lebar`/`tinggi`/`nilai_default` yang dulu
 * menyimpan setelan komponen kustom.
 *
 * Setelan & ukuran komponen kustom (tinggi, lebar, lebar label/kontrol, sisi
 * yang mengembang, warna label, nilai awal, tipe input) TIDAK lagi lewat sini:
 * semuanya milik komponen dan disimpan di tabel `komponen_custom`, dibaca lewat
 * `useSetelanKomponen(konteks.tableKey, htmlFor)`. Yang tersisa di sini murni
 * setelan tabel, jadi memuat/menulis preset tak perlu menunggu peta komponen.
 *
 * `visibilitas` kini dipakai lagi: FILTER toolbar (lihat `filterTabel.ts`)
 * dinyalakan/dimatikan per tabel dari Kelola Tabel, disimpan sebagai peta
 * kunci filter → tampil (true/absen) / sembunyi (false). Dulu nilainya dibuang
 * saat dibaca.
 *
 * Dimuat ulang otomatis saat event EVENT_TOOLBAR_BERUBAH untuk tableKey yang
 * sama.
 */
export function useToolbarPresetState(tableKey: string) {
  /** Filter toolbar yang disembunyikan (kunci filter → false). Absen/`true` =
   *  tampil, jadi bawaan = "semua tampil". */
  const [visibilitas, setVisibilitas] = useState<VisibilitasToolbar>({});
  /** Perataan kolom global per tabel (absen = tengah). */
  const [alignDb, setAlignDb] = useState<Partial<Record<string, AlignKolom>>>({});
  /** Urutan kolom tersimpan di DB (null = belum dimuat; [] = bawaan halaman). */
  const [urutanDb, setUrutanDb] = useState<string[] | null>(null);
  /** Peta `label`/`align` dari `LabelKolomApi` -> peta perataan saja. */
  const [labelDb, setLabelDb] = useState<Record<string, string>>({});
  /** Judul tabel yang diisi pengguna. `null` = pakai judul bawaan kode. */
  const [judulDb, setJudulDb] = useState<string | null>(null);
  /** Info tabel (HTML ter-sanitasi). `null` = belum diisi → tanpa tombol Info.
   *  Hanya dibaca di grid; penulisannya di tab Info dialog Kelola Tabel. */
  const [infoHtmlDb, setInfoHtmlDb] = useState<string | null>(null);

  /** Konteks "di dalam toolbar tabel": tinggal identitas tabel. */
  const konteksLebarFilter = useMemo(() => ({ tableKey }), [tableKey]);

  useEffect(() => {
    let batal = false;
    const muat = async () => {
      try {
        const res = await muatToolbarPreset(tableKey);
        if (batal) return;
        setVisibilitas(visibilitasBersih(res.data.visibilitas));
        setAlignDb(bacaAlign(res.data.align));
        setUrutanDb(Array.isArray(res.data.urutan) ? res.data.urutan : []);
        setLabelDb(bacaLabel(res.data.label));
        setJudulDb(res.data.judul ?? null);
        setInfoHtmlDb(res.data.info_html ?? null);
      } catch {
        if (batal) return;
        setVisibilitas({});
        setAlignDb({});
        setUrutanDb([]);
        setLabelDb({});
        setJudulDb(null);
        setInfoHtmlDb(null);
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

  /** Cermin judulDb untuk tulis optimistis (pola sama dengan align). */
  const judulDbRef = useRef(judulDb);
  judulDbRef.current = judulDb;
  const versiJudulRef = useRef(0);

  /** Tulis perataan satu kolom ke DB global (satu sumber dengan dialog Kelola
   *  Tabel; dipakai menu klik-kanan): optimistis, rollback saat gagal. */
  const simpanAlign = useCallback((key: string, nilai: AlignKolom) => {
    const versi = ++versiAlignRef.current;
    const sebelum = alignDbRef.current;

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

  /** Tulis judul tabel ke DB (satu sumber dengan dialog Kelola Tabel).
   *  Optimistis + rollback, pola sama dengan `simpanAlign`. */
  const simpanJudul = useCallback((teks: string) => {
    const versi = ++versiJudulRef.current;
    const sebelum = judulDbRef.current;
    const bersih = teks.trim();
    judulDbRef.current = bersih === '' ? null : bersih;
    setJudulDb(bersih === '' ? null : bersih);
    void simpanToolbarPreset(tableKey, undefined, undefined, undefined, undefined, teks)
      .then(() => {
        if (versi === versiJudulRef.current) kabariToolbar(tableKey);
      })
      .catch((e: unknown) => {
        if (versi !== versiJudulRef.current) return;
        judulDbRef.current = sebelum;
        setJudulDb(sebelum);
        toast.error(errorMessage(e));
      });
  }, [tableKey]);

  /** Cermin terbaru urutanDb untuk tulis optimistis (pola sama dengan align). */
  const urutanDbRef = useRef(urutanDb);
  urutanDbRef.current = urutanDb;
  const versiUrutanRef = useRef(0);

  /** Tulis URUTAN kolom ke DB global (satu sumber dengan dialog Kelola Tabel
   *  -> tab Kolom). Dipakai seret judul kolom: optimistis + rollback.
   *
   *  `kabariToolbar` sengaja DIPANGGIL saat sukses supaya dialog Kelola Tabel
   *  (bila sedang terbuka) ikut memuat ulang susunannya - itulah yang membuat
   *  geser di tabel dan susunan di pengaturan tetap sinkron dua arah. */
  const simpanUrutan = useCallback((urutan: string[]) => {
    const versi = ++versiUrutanRef.current;
    const sebelum = urutanDbRef.current;
    urutanDbRef.current = urutan;
    setUrutanDb(urutan);
    void simpanToolbarPreset(tableKey, undefined, urutan)
      .then(() => {
        if (versi === versiUrutanRef.current) kabariToolbar(tableKey);
      })
      .catch((e: unknown) => {
        if (versi !== versiUrutanRef.current) return;
        urutanDbRef.current = sebelum;
        setUrutanDb(sebelum);
        toast.error(errorMessage(e));
      });
  }, [tableKey]);

  return {
    visibilitas, alignDb, urutanDb, setUrutanDb, simpanUrutan,
    labelDb, judulDb, simpanJudul, infoHtmlDb, simpanAlign, konteksLebarFilter,
  };
}
