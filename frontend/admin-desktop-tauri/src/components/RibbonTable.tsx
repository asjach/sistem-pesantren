import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/** Perintah tabel aktif yang dipakai tab ribbon "Tabel". */
export interface RibbonTableApi {
  tableKey: string;
  salin: () => void;
  autofit: () => void;
  reset: () => void;
  /** Mode edit sel: kemampuan + status (dipakai tombol toggle di ribbon). */
  canEdit: boolean;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  editing: boolean;
  /** Mode input baris baru: kemampuan + status. */
  inputEnabled: boolean;
  inputMode: boolean;
  setInputMode: (v: boolean) => void;
  showInput: boolean;
  /** Tinggi baris header EFEKTIF tabel aktif (hasil auto atau manual) — agar
   *  spinner di ribbon selalu sama dengan tinggi riil yang dirender. */
  headerHeight: number;
  /** Jumlah kolom DATA pertama yang dibekukan (freeze pane kiri; kolom centang
   *  ikut) + batas maksimum = jumlah kolom terlihat. */
  freeze: number;
  freezeMax: number;
  setFreeze: (n: number) => void;
}

interface RibbonTableCtxValue {
  api: RibbonTableApi | null;
  daftar: (key: string, api: RibbonTableApi) => void;
  lepas: (key: string) => void;
}

const Ctx = createContext<RibbonTableCtxValue | null>(null);

/** Registri tabel aktif: tabel pertama yang terdaftar (paling atas di halaman)
 *  dipakai sebagai sumber perintah ribbon. Objek api reaktif (memuat status mode
 *  edit/input), tetapi pendaftaran ulang hanya terjadi saat status itu atau
 *  kemampuan tabel berubah — bukan saat seleksi sel berubah; handler aksi selalu
 *  membaca versi terbaru lewat ref di ExcelTable. */
export function RibbonTableProvider({ children }: { children: ReactNode }) {
  const [apis, setApis] = useState<Record<string, RibbonTableApi>>({});

  const daftar = useCallback((key: string, api: RibbonTableApi) => {
    setApis((prev) => (prev[key] === api ? prev : { ...prev, [key]: api }));
  }, []);
  const lepas = useCallback((key: string) => {
    setApis((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const api = useMemo(() => Object.values(apis)[0] ?? null, [apis]);
  const value = useMemo(() => ({ api, daftar, lepas }), [api, daftar, lepas]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRibbonTable() {
  return useContext(Ctx);
}
