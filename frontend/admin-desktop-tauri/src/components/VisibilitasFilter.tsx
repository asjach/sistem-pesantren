import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/** Kunci filter global di topBar. */
export type KunciFilterGlobal = 'lembaga' | 'tahun_ajaran' | 'semester' | 'tingkat' | 'kelas';

/** Tampil bawaan: lembaga/TA/semester selalu; tingkat/kelas hanya bila halaman
 *  memintanya lewat `<VisibilitasFilter>`. */
export const TAMPIL_BAWAAN: Record<KunciFilterGlobal, boolean> = {
  lembaga: true,
  tahun_ajaran: true,
  semester: true,
  tingkat: false,
  kelas: false,
};

interface VisibilitasFilterCtxValue {
  tampil: Record<KunciFilterGlobal, boolean>;
  setTampil: React.Dispatch<React.SetStateAction<Record<KunciFilterGlobal, boolean>>>;
}

const Ctx = createContext<VisibilitasFilterCtxValue | null>(null);

export function VisibilitasFilterProvider({ children }: { children: ReactNode }) {
  const [tampil, setTampil] = useState<Record<KunciFilterGlobal, boolean>>(TAMPIL_BAWAAN);
  const value = useMemo(() => ({ tampil, setTampil }), [tampil]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Konteks visibilitas (dipakai TopBar untuk memutuskan filter yang tampil). */
export function useVisibilitasFilter() {
  return useContext(Ctx);
}

/** Deklarasikan filter yang tampil selama halaman ini aktif.
 *  Kembali ke bawaan otomatis saat halaman unmount. */
export function VisibilitasFilter({ tampil }: { tampil: Partial<Record<KunciFilterGlobal, boolean>> }) {
  const ctx = useContext(Ctx);
  const setTampil = ctx?.setTampil;
  const kunci = JSON.stringify(tampil);
  useEffect(() => {
    if (!setTampil) return;
    const parsed = JSON.parse(kunci) as Partial<Record<KunciFilterGlobal, boolean>>;
    setTampil((prev) => ({ ...prev, ...parsed }));
    return () => setTampil(TAMPIL_BAWAAN);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setTampil, kunci]);

  return null;
}
