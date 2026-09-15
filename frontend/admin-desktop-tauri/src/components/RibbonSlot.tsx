import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Slot tools per halaman pada baris ribbon.
 *
 *  Halaman menaruh kontrol khususnya dengan merender `<RibbonSlot>…</RibbonSlot>`
 *  di mana pun dalam pohon halaman; isinya dipindah (portal) ke baris ribbon di
 *  header. Hanya halaman yang sedang ter-mount yang menyumbang tools, dan
 *  `ada` dipakai header untuk memutuskan apakah baris tools perlu tampil.
 *  Tools tabel (lihat `RibbonTable`) tetap sumber terpisah dan digabung di baris
 *  yang sama oleh TopBar. */
interface RibbonSlotCtxValue {
  /** Elemen target baris tools di header (null sebelum TopBar ter-mount). */
  el: HTMLElement | null;
  setEl: (el: HTMLElement | null) => void;
  /** true bila ada halaman yang sedang menyumbang tools. */
  ada: boolean;
  setAda: (v: boolean) => void;
}

const Ctx = createContext<RibbonSlotCtxValue | null>(null);

export function RibbonSlotProvider({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [ada, setAda] = useState(false);
  // `setEl`/`setAda` dari useState stabil; value berubah saat el/ada berubah.
  const value = useMemo(() => ({ el, setEl, ada, setAda }), [el, ada]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Konteks slot (dipakai TopBar untuk memasang elemen target & membaca `ada`). */
export function useRibbonSlotCtx() {
  return useContext(Ctx);
}

/** Taruh tools halaman ke baris ribbon. Lepas otomatis saat halaman unmount. */
export function RibbonSlot({ children }: { children: ReactNode }) {
  const ctx = useContext(Ctx);
  const setAda = ctx?.setAda;
  useEffect(() => {
    if (!setAda) return;
    setAda(true);
    return () => setAda(false);
  }, [setAda]);

  if (!ctx?.el) return null;
  return createPortal(children, ctx.el);
}
