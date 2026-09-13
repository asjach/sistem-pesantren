import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/** Perintah tabel aktif yang dipakai tab ribbon "Tabel". */
export interface RibbonTableApi {
  tableKey: string;
  salin: () => void;
  autofit: () => void;
  reset: () => void;
}

interface RibbonTableCtxValue {
  api: RibbonTableApi | null;
  daftar: (key: string, api: RibbonTableApi) => void;
  lepas: (key: string) => void;
}

const Ctx = createContext<RibbonTableCtxValue | null>(null);

/** Registri tabel aktif: tabel pertama yang terdaftar (paling atas di halaman)
 *  dipakai sebagai sumber perintah ribbon. Tidak memicu re-render saat seleksi
 *  sel berubah — metode selalu membaca handler terbaru lewat ref di ExcelTable. */
export function RibbonTableProvider({ children }: { children: ReactNode }) {
  const [apis, setApis] = useState<Record<string, RibbonTableApi>>({});

  const daftar = useCallback((key: string, api: RibbonTableApi) => {
    setApis((prev) => (prev[key] ? prev : { ...prev, [key]: api }));
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
