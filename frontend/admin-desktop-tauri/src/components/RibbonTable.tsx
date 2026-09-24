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
  /** Tandai tabel yang sedang aktif (dipakai halaman multi-tabel: ribbon
   *  mengikuti tabel yang terakhir berinteraksi). */
  aktif: (key: string) => void;
}

const Ctx = createContext<RibbonTableCtxValue | null>(null);

/** Registri tabel aktif: tabel pertama yang terdaftar (paling atas di halaman)
 *  dipakai sebagai sumber perintah ribbon. Objek api reaktif (memuat status mode
 *  edit/input), tetapi pendaftaran ulang hanya terjadi saat status itu atau
 *  kemampuan tabel berubah — bukan saat seleksi sel berubah; handler aksi selalu
 *  membaca versi terbaru lewat ref di ExcelTable. */
export function RibbonTableProvider({ children }: { children: ReactNode }) {
  const [apis, setApis] = useState<Record<string, RibbonTableApi>>({});
  const [aktifKey, setAktifKey] = useState<string | null>(null);

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
    setAktifKey((prev) => (prev === key ? null : prev));
  }, []);
  const aktif = useCallback((key: string) => {
    setAktifKey((prev) => (prev === key ? prev : key));
  }, []);

  // Halaman multi-tabel: pakai tabel yang terakhir berinteraksi; fallback tabel
  // pertama yang terdaftar (paling atas).
  const api = useMemo(
    () => (aktifKey != null ? apis[aktifKey] : undefined) ?? Object.values(apis)[0] ?? null,
    [apis, aktifKey],
  );
  const value = useMemo(() => ({ api, daftar, lepas, aktif }), [api, daftar, lepas, aktif]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRibbonTable() {
  return useContext(Ctx);
}
