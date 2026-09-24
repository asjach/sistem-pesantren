import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/** Pengatur tampil/sembunyi dropdown Semester global di topBar.
 *
 *  Halaman yang datanya tidak mengenal semester (mis. Kelas: hanya per
 *  lembaga + tahun ajaran) merender `<TanpaSemester />` agar dropdown yang
 *  tak berpengaruh itu tidak tampil dan membingungkan. Lepas otomatis saat
 *  halaman unmount. */
interface TopBarSemesterCtxValue {
  sembunyi: boolean;
  setSembunyi: (v: boolean) => void;
}

const Ctx = createContext<TopBarSemesterCtxValue | null>(null);

export function TopBarSemesterProvider({ children }: { children: ReactNode }) {
  const [sembunyi, setSembunyi] = useState(false);
  const value = useMemo(() => ({ sembunyi, setSembunyi }), [sembunyi]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Konteks slot (dipakai TopBar untuk membaca `sembunyi`). */
export function useTopBarSemesterCtx() {
  return useContext(Ctx);
}

/** Sembunyikan dropdown Semester selama halaman ini aktif. */
export function TanpaSemester() {
  const ctx = useContext(Ctx);
  const setSembunyi = ctx?.setSembunyi;
  useEffect(() => {
    if (!setSembunyi) return;
    setSembunyi(true);
    return () => setSembunyi(false);
  }, [setSembunyi]);

  return null;
}
