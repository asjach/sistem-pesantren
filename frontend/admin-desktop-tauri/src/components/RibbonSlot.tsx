import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Slot tools per halaman pada baris ribbon.
 *
 *  Halaman menaruh kontrol khususnya dengan merender `<RibbonSlot label="…">…</RibbonSlot>`
 *  di mana pun dalam pohon halaman; isinya dipindah (portal) ke baris ribbon di
 *  header. Hanya halaman yang sedang ter-mount yang menyumbang tools, dan
 *  `ada`/`label` dipakai header untuk memutuskan isi baris tools:
 *  - hanya satu sumber (halaman saja / tabel saja) → ditampilkan langsung;
 *  - ada dua sumber (tools halaman + tools tabel) → header menampilkan tab
 *    agar baris tetap ringkas. */
interface RibbonSlotCtxValue {
  /** Elemen target baris tools di header (null sebelum TopBar ter-mount). */
  el: HTMLElement | null;
  setEl: (el: HTMLElement | null) => void;
  /** true bila ada halaman yang sedang menyumbang tools. */
  ada: boolean;
  setAda: (v: boolean) => void;
  /** Label tab tools halaman (mis. "PSB"). */
  label: string | null;
  setLabel: (v: string | null) => void;
}

const Ctx = createContext<RibbonSlotCtxValue | null>(null);

export function RibbonSlotProvider({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [ada, setAda] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  // `setEl`/`setAda`/`setLabel` dari useState stabil; value berubah saat datanya berubah.
  const value = useMemo(() => ({ el, setEl, ada, setAda, label, setLabel }), [el, ada, label]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Konteks slot (dipakai TopBar untuk memasang elemen target & membaca `ada`/`label`). */
export function useRibbonSlotCtx() {
  return useContext(Ctx);
}

/** Taruh tools halaman ke baris ribbon. Lepas otomatis saat halaman unmount. */
export function RibbonSlot({ label = 'Halaman', children }: { label?: string; children: ReactNode }) {
  const ctx = useContext(Ctx);
  const setAda = ctx?.setAda;
  const setLabel = ctx?.setLabel;
  useEffect(() => {
    if (!setAda) return;
    setAda(true);
    setLabel?.(label);
    return () => {
      setAda(false);
      setLabel?.(null);
    };
  }, [setAda, setLabel, label]);

  if (!ctx?.el) return null;
  return createPortal(children, ctx.el);
}
