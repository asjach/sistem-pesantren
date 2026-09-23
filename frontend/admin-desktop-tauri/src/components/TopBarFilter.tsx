import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Slot filter halaman pada baris atas TopBar (sebelah dropdown Semester).
 *
 *  Halaman menaruh kontrol filternya dengan merender `<TopBarFilter>…</TopBarFilter>`
 *  di mana pun dalam pohon halaman; isinya dipindah (portal) ke TopBar tepat
 *  setelah dropdown Semester. Hanya halaman yang sedang ter-mount yang
 *  menyumbang filter, sehingga baris bersih saat halaman tak memakainya. */
interface TopBarFilterCtxValue {
  /** Elemen target di TopBar (null sebelum TopBar ter-mount). */
  el: HTMLElement | null;
  setEl: (el: HTMLElement | null) => void;
}

const Ctx = createContext<TopBarFilterCtxValue | null>(null);

export function TopBarFilterProvider({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ el, setEl }), [el]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Konteks slot (dipakai TopBar untuk memasang elemen target). */
export function useTopBarFilterCtx() {
  return useContext(Ctx);
}

/** Taruh filter halaman ke baris atas TopBar. Lepas otomatis saat unmount. */
export function TopBarFilter({ children }: { children: ReactNode }) {
  const ctx = useContext(Ctx);
  if (!ctx?.el) return null;
  return createPortal(children, ctx.el);
}
