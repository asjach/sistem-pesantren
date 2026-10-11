import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { errorMessage } from '@/api/client';
import { muatToolbarPreset, simpanToolbarPreset, type AlignKolomApi, type LebarToolbarApi, type NilaiDefaultApi, type TinggiToolbarApi } from '@/api/toolbarPreset';
import {
  AWALAN_LEBAR_FILTER,
  EVENT_TOOLBAR_BERUBAH,
  SUFIKS_EXPAND_LABEL,
  SUFIKS_LABEL_TRANSPARAN,
  SUFIKS_LEBAR_KONTROL,
  SUFIKS_LEBAR_LABEL,
  bacaAlign,
  bacaExpandLabelFilter,
  bacaLabelTransparanFilter,
  bacaLebarFilter,
  bacaLebarKontrolFilter,
  bacaLebarLabelFilter,
  bacaNilaiDefault,
  bacaTinggiFilter,
  bacaVisToolbar,
  kabariToolbar,
  kunciUkuranServer,
  type AlignKolom,
  type VisToolbar,
} from '@/components/kelolaTabel/jenis';

/**
 * State + pemuatan preset toolbar per tabel: visibilitas kontrol (info/filter),
 * urutan kolom tersimpan di DB, perataan kolom global, dan setelan ukuran
 * combobox filter halaman. Dimuat ulang otomatis saat event
 * EVENT_TOOLBAR_BERUBAH untuk tableKey yang sama.
 *
 * Dropdown Urutkan & Kolom (PresetUrut/PresetKolom) SENGAJA tidak lagi dikelola
 * di sini: setelan kotaknya per perangkat (`ukuranKombo.ts`), bukan server.
 */
export function useToolbarPresetState(tableKey: string) {
  /** Visibilitas kontrol toolbar generik (section Toolbar dialog Kelola Tabel). */
  const [visToolbar, setVisToolbar] = useState<VisToolbar>({ info: true, urut: true, kolom: true, filter: true });
  /** Lebar filter halaman tersimpan (kunci → px); absen = bawaan halaman. */
  const [lebarFilter, setLebarFilter] = useState<Record<string, number>>({});
  /** Peta lebar MENTAH dari server (kunci `urut`/`kolom`/`filter.<htmlFor>`),
   *  dipakai untuk tulis read-modify-write + cermin optimistis. */
  const [lebarApi, setLebarApi] = useState<LebarToolbarApi>({});
  /** Tinggi kotak kontrol tersimpan, peta MENTAH dari server (kunci `urut` /
   *  `kolom` / `filter.<htmlFor>`) — dipakai untuk tulis read-modify-write. */
  const [tinggiApi, setTinggiApi] = useState<TinggiToolbarApi>({});
  /** Nilai AWAL combobox tersimpan, peta MENTAH dari server (kunci sama
   *  dengan `lebar`) — dipakai untuk tulis read-modify-write. */
  const [nilaiDefaultApi, setNilaiDefaultApi] = useState<NilaiDefaultApi>({});
  /** Perataan kolom global per tabel (absen = tengah). */
  const [alignDb, setAlignDb] = useState<Partial<Record<string, AlignKolom>>>({});
  /** Urutan kolom tersimpan di DB (null = belum dimuat; [] = bawaan halaman). */
  const [urutanDb, setUrutanDb] = useState<string[] | null>(null);
  /** Cermin peta mentah terbaru: sumber tulis (server mengganti peta utuh,
   *  jadi kunci lain wajib ikut dikirim). */
  const lebarApiRef = useRef<LebarToolbarApi>({});
  const tinggiApiRef = useRef<TinggiToolbarApi>({});
  const nilaiDefaultApiRef = useRef<NilaiDefaultApi>({});
  /** Tinggi kotak kontrol per `htmlFor` (kunci server diterjemahkan), supaya
   *  LabeledCombobox bisa membacanya tanpa prop tambahan. */
  const tinggiFilter = useMemo(() => bacaTinggiFilter(tinggiApi), [tinggiApi]);

  /** Simpan ukuran satu kontrol ke SERVER (dipakai popover klik-kanan):
   *  optimistis, kirim peta LENGKAP, lalu kabari grid lain. `null` = hapus
   *  kunci itu (kembali ke bawaan). Lebar label/kontrol terkunci memakai kunci
   *  sufiks (`<kunci>.label` / `<kunci>.kontrol`) di peta `lebar` yang sama. */
  const simpanUkuran = useCallback((htmlFor: string, ukuran: { lebar?: number | null; tinggi?: number | null; lebarLabel?: number | null; lebarKontrol?: number | null; expandLabel?: boolean | null; labelTransparan?: boolean | null; nilaiDefault?: string | null }) => {
    const kunci = kunciUkuranServer(htmlFor);
    const lebarBaru: LebarToolbarApi = { ...lebarApiRef.current };
    const tinggiBaru: TinggiToolbarApi = { ...tinggiApiRef.current };
    const nilaiDefaultBaru: NilaiDefaultApi = { ...nilaiDefaultApiRef.current };
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
    /* Flag expanding: `true` = tulis penanda `= 1`; `false`/`null` = hapus
       (kembali ke bawaan: kontrol mengembang). */
    if (ukuran.expandLabel !== undefined) {
      if (ukuran.expandLabel === true) lebarBaru[`${kunci}${SUFIKS_EXPAND_LABEL}`] = 1;
      else delete lebarBaru[`${kunci}${SUFIKS_EXPAND_LABEL}`];
    }
    /* Flag label transparan: `true` = 1, `false` eksplisit = 0,
       `null` = hapus (kembali ke bawaan). */
    if (ukuran.labelTransparan !== undefined) {
      if (ukuran.labelTransparan === null) delete lebarBaru[`${kunci}${SUFIKS_LABEL_TRANSPARAN}`];
      else lebarBaru[`${kunci}${SUFIKS_LABEL_TRANSPARAN}`] = ukuran.labelTransparan ? 1 : 0;
    }
    /* Nilai awal combobox: `null` = hapus (kembali ke nilai pemanggil). */
    if (ukuran.nilaiDefault !== undefined) {
      if (ukuran.nilaiDefault === null) delete nilaiDefaultBaru[kunci];
      else nilaiDefaultBaru[kunci] = ukuran.nilaiDefault;
    }
    lebarApiRef.current = lebarBaru;
    tinggiApiRef.current = tinggiBaru;
    nilaiDefaultApiRef.current = nilaiDefaultBaru;
    setLebarApi(lebarBaru);
    setTinggiApi(tinggiBaru);
    setNilaiDefaultApi(nilaiDefaultBaru);
    setLebarFilter(bacaLebarFilter(lebarBaru));
    void simpanToolbarPreset(tableKey, undefined, lebarBaru, undefined, undefined, tinggiBaru, nilaiDefaultBaru)
      .then(() => kabariToolbar(tableKey))
      .catch((e: unknown) => toast.error(errorMessage(e)));
  }, [tableKey]);

  /** Lebar label/kontrol terkunci per `htmlFor` (kunci server diterjemahkan),
   *  supaya LabeledCombobox bisa membacanya tanpa prop tambahan. */
  const lebarLabelFilter = useMemo(() => bacaLebarLabelFilter(lebarApi), [lebarApi]);
  const lebarKontrolFilter = useMemo(() => bacaLebarKontrolFilter(lebarApi), [lebarApi]);
  /** Kontrol yang labelnya mengembang (kunci server diterjemahkan). */
  const expandLabelFilter = useMemo(() => bacaExpandLabelFilter(lebarApi), [lebarApi]);
  /** Kontrol yang labelnya transparan (kunci server diterjemahkan). */
  const labelTransparanFilter = useMemo(() => bacaLabelTransparanFilter(lebarApi), [lebarApi]);
  /** Nilai awal combobox per `htmlFor` (kunci server diterjemahkan dari
   *  `filter.<htmlFor>`). */
  const nilaiDefaultFilter = useMemo(() => {
    const hasil: Record<string, string> = {};
    for (const [k, v] of Object.entries(nilaiDefaultApi)) {
      if (k.startsWith(AWALAN_LEBAR_FILTER)) hasil[k.slice(AWALAN_LEBAR_FILTER.length)] = v;
    }
    return hasil;
  }, [nilaiDefaultApi]);
  /** Lebar per `htmlFor` untuk konteks: combobox filter halaman yang tersimpan. */
  const lebarKonteks = useMemo(() => ({ ...lebarFilter }), [lebarFilter]);

  const konteksLebarFilter = useMemo(() => ({
    tableKey,
    lebar: lebarKonteks,
    tinggi: tinggiFilter,
    lebarLabel: lebarLabelFilter,
    lebarKontrol: lebarKontrolFilter,
    expandLabel: expandLabelFilter,
    labelTransparan: labelTransparanFilter,
    nilaiDefault: nilaiDefaultFilter,
    simpanUkuran,
  }), [tableKey, lebarKonteks, tinggiFilter, lebarLabelFilter, lebarKontrolFilter, expandLabelFilter, labelTransparanFilter, nilaiDefaultFilter, simpanUkuran]);

  useEffect(() => {
    let batal = false;
    const muat = async () => {
      try {
        const res = await muatToolbarPreset(tableKey);
        if (batal) return;
        setVisToolbar(bacaVisToolbar(res.data.visibilitas));
        setLebarFilter(bacaLebarFilter(res.data.lebar));
        setTinggiApi(res.data.tinggi ?? {});
        setLebarApi(res.data.lebar ?? {});
        lebarApiRef.current = res.data.lebar ?? {};
        tinggiApiRef.current = res.data.tinggi ?? {};
        const nilaiAwal = bacaNilaiDefault(res.data.nilai_default);
        setNilaiDefaultApi(nilaiAwal);
        nilaiDefaultApiRef.current = nilaiAwal;
        setAlignDb(bacaAlign(res.data.align));
        setUrutanDb(Array.isArray(res.data.urutan) ? res.data.urutan : []);
      } catch {
        if (batal) return;
        setVisToolbar({ info: true, urut: true, kolom: true, filter: true });
        setLebarFilter({});
        setTinggiApi({});
        setLebarApi({});
        lebarApiRef.current = {};
        tinggiApiRef.current = {};
        setNilaiDefaultApi({});
        nilaiDefaultApiRef.current = {};
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

  return { visToolbar, lebarFilter, alignDb, urutanDb, setUrutanDb, simpanAlign, konteksLebarFilter };
}
