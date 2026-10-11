import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { errorMessage } from '@/api/client';
import { muatToolbarPreset, simpanToolbarPreset, type AlignKolomApi, type LebarToolbarApi, type TinggiToolbarApi } from '@/api/toolbarPreset';
import {
  EVENT_TOOLBAR_BERUBAH,
  LEBAR_BAWAHAN_TOOLBAR,
  SUFIKS_LEBAR_KONTROL,
  SUFIKS_LEBAR_LABEL,
  bacaAlign,
  bacaLebarFilter,
  bacaLebarKontrolFilter,
  bacaLebarLabelFilter,
  bacaLebarToolbar,
  bacaTinggiFilter,
  bacaVisToolbar,
  kabariToolbar,
  kunciUkuranServer,
  type AlignKolom,
  type LebarToolbar,
  type VisToolbar,
} from '@/components/kelolaTabel/jenis';

/** Batas lebar kolom yang dipakai sebagai lebar preset kolom (px). */
const LEBAR_KOLOM_MIN = 40;
const LEBAR_KOLOM_MAKS = 1200;

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
  /** Peta lebar MENTAH dari server (kunci `urut`/`kolom`/`filter.<htmlFor>`),
   *  dipakai untuk tulis read-modify-write + cermin optimistis. */
  const [lebarApi, setLebarApi] = useState<LebarToolbarApi>({});
  /** Tinggi kotak kontrol tersimpan, peta MENTAH dari server (kunci `urut` /
   *  `kolom` / `filter.<htmlFor>`) — dipakai untuk tulis read-modify-write. */
  const [tinggiApi, setTinggiApi] = useState<TinggiToolbarApi>({});
  /** Perataan kolom global per tabel (absen = tengah). */
  const [alignDb, setAlignDb] = useState<Partial<Record<string, AlignKolom>>>({});
  /** Urutan kolom tersimpan di DB (null = belum dimuat; [] = bawaan halaman). */
  const [urutanDb, setUrutanDb] = useState<string[] | null>(null);
  /** Cermin peta mentah terbaru: sumber tulis (server mengganti peta utuh,
   *  jadi kunci lain wajib ikut dikirim). */
  const lebarApiRef = useRef<LebarToolbarApi>({});
  const tinggiApiRef = useRef<TinggiToolbarApi>({});
  /** Tinggi kotak kontrol per `htmlFor` (kunci server diterjemahkan), supaya
   *  LabeledCombobox bisa membacanya tanpa prop tambahan. */
  const tinggiFilter = useMemo(() => {
    const hasil = bacaTinggiFilter(tinggiApi);
    if (typeof tinggiApi.urut === 'number') hasil[`select_urut_${tableKey}`] = tinggiApi.urut;
    if (typeof tinggiApi.kolom === 'number') hasil[`select_preset_kolom_${tableKey}`] = tinggiApi.kolom;
    return hasil;
  }, [tinggiApi, tableKey]);

  /** Simpan ukuran satu kontrol ke SERVER (dipakai popover klik-kanan):
   *  optimistis, kirim peta LENGKAP, lalu kabari grid lain. `null` = hapus
   *  kunci itu (kembali ke bawaan). Lebar label/kontrol terkunci memakai kunci
   *  sufiks (`<kunci>.label` / `<kunci>.kontrol`) di peta `lebar` yang sama. */
  const simpanUkuran = useCallback((htmlFor: string, ukuran: { lebar?: number | null; tinggi?: number | null; lebarLabel?: number | null; lebarKontrol?: number | null }) => {
    const kunci = kunciUkuranServer(htmlFor);
    const lebarBaru: LebarToolbarApi = { ...lebarApiRef.current };
    const tinggiBaru: TinggiToolbarApi = { ...tinggiApiRef.current };
    if (ukuran.lebar !== undefined) {
      if (ukuran.lebar === null) delete lebarBaru[kunci];
      else lebarBaru[kunci] = ukuran.lebar;
    }
    if (ukuran.tinggi !== undefined) {
      if (ukuran.tinggi === null) delete tinggiBaru[kunci];
      else tinggiBaru[kunci] = ukuran.tinggi;
    }
    if (ukuran.lebarLabel !== undefined) {
      if (ukuran.lebarLabel === null) delete lebarBaru[`${kunci}${SUFIKS_LEBAR_LABEL}`];
      else lebarBaru[`${kunci}${SUFIKS_LEBAR_LABEL}`] = ukuran.lebarLabel;
    }
    if (ukuran.lebarKontrol !== undefined) {
      if (ukuran.lebarKontrol === null) delete lebarBaru[`${kunci}${SUFIKS_LEBAR_KONTROL}`];
      else lebarBaru[`${kunci}${SUFIKS_LEBAR_KONTROL}`] = ukuran.lebarKontrol;
    }
    lebarApiRef.current = lebarBaru;
    tinggiApiRef.current = tinggiBaru;
    setLebarApi(lebarBaru);
    setTinggiApi(tinggiBaru);
    setLebarFilter(bacaLebarFilter(lebarBaru));
    setLebarToolbar(bacaLebarToolbar(lebarBaru));
    const kolomDb = lebarBaru.kolom;
    setLebarKolomDb(typeof kolomDb === 'number' && kolomDb >= LEBAR_KOLOM_MIN && kolomDb <= LEBAR_KOLOM_MAKS ? kolomDb : undefined);
    void simpanToolbarPreset(tableKey, undefined, lebarBaru, undefined, undefined, tinggiBaru)
      .then(() => kabariToolbar(tableKey))
      .catch((e: unknown) => toast.error(errorMessage(e)));
  }, [tableKey]);

  /** Lebar label/kontrol terkunci per `htmlFor` (kunci server diterjemahkan),
   *  supaya LabeledCombobox bisa membacanya tanpa prop tambahan. */
  const lebarLabelFilter = useMemo(() => {
    const hasil = bacaLebarLabelFilter(lebarApi);
    if (typeof lebarApi[`urut${SUFIKS_LEBAR_LABEL}`] === 'number') hasil[`select_urut_${tableKey}`] = lebarApi[`urut${SUFIKS_LEBAR_LABEL}`];
    if (typeof lebarApi[`kolom${SUFIKS_LEBAR_LABEL}`] === 'number') hasil[`select_preset_kolom_${tableKey}`] = lebarApi[`kolom${SUFIKS_LEBAR_LABEL}`];
    return hasil;
  }, [lebarApi, tableKey]);
  const lebarKontrolFilter = useMemo(() => {
    const hasil = bacaLebarKontrolFilter(lebarApi);
    if (typeof lebarApi[`urut${SUFIKS_LEBAR_KONTROL}`] === 'number') hasil[`select_urut_${tableKey}`] = lebarApi[`urut${SUFIKS_LEBAR_KONTROL}`];
    if (typeof lebarApi[`kolom${SUFIKS_LEBAR_KONTROL}`] === 'number') hasil[`select_preset_kolom_${tableKey}`] = lebarApi[`kolom${SUFIKS_LEBAR_KONTROL}`];
    return hasil;
  }, [lebarApi, tableKey]);
  /** Lebar per `htmlFor` untuk konteks: filter + kontrol bawaan toolbar
   *  (Urutkan/Kolom) yang tersimpan, supaya popover tahu nilai berlakunya. */
  const lebarKonteks = useMemo(() => {
    const hasil = { ...lebarFilter };
    if (typeof lebarApi.urut === 'number') hasil[`select_urut_${tableKey}`] = lebarApi.urut;
    if (typeof lebarApi.kolom === 'number') hasil[`select_preset_kolom_${tableKey}`] = lebarApi.kolom;
    return hasil;
  }, [lebarFilter, lebarApi, tableKey]);

  const konteksLebarFilter = useMemo(() => ({
    tableKey,
    lebar: lebarKonteks,
    tinggi: tinggiFilter,
    lebarLabel: lebarLabelFilter,
    lebarKontrol: lebarKontrolFilter,
    simpanUkuran,
  }), [tableKey, lebarKonteks, tinggiFilter, lebarLabelFilter, lebarKontrolFilter, simpanUkuran]);

  useEffect(() => {
    let batal = false;
    const muat = async () => {
      try {
        const res = await muatToolbarPreset(tableKey);
        if (batal) return;
        setVisToolbar(bacaVisToolbar(res.data.visibilitas));
        setLebarToolbar(bacaLebarToolbar(res.data.lebar));
        setLebarFilter(bacaLebarFilter(res.data.lebar));
        setTinggiApi(res.data.tinggi ?? {});
        setLebarApi(res.data.lebar ?? {});
        lebarApiRef.current = res.data.lebar ?? {};
        tinggiApiRef.current = res.data.tinggi ?? {};
        setAlignDb(bacaAlign(res.data.align));
        setUrutanDb(Array.isArray(res.data.urutan) ? res.data.urutan : []);
        const tersimpan = res.data.lebar?.kolom;
        setLebarKolomDb(typeof tersimpan === 'number' && tersimpan >= LEBAR_KOLOM_MIN && tersimpan <= LEBAR_KOLOM_MAKS ? tersimpan : undefined);
      } catch {
        if (batal) return;
        setVisToolbar({ info: true, urut: true, kolom: true, filter: true });
        setLebarToolbar({ ...LEBAR_BAWAHAN_TOOLBAR });
        setLebarFilter({});
        setTinggiApi({});
        setLebarApi({});
        lebarApiRef.current = {};
        tinggiApiRef.current = {};
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
