import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from '@/icons';

/** Slot pencarian tunggal di baris atas TopBar (menggantikan judul halaman).
 *
 *  Halaman menaruh `<TopBarSearch value onChange placeholder />` di mana pun
 *  dalam pohon halaman; inputnya dipindah (portal) ke TopBar. Satu input per
 *  halaman dipakai untuk semua tabel di halaman itu. Bila halaman tak
 *  menyumbang search, TopBar menampilkan judul halaman seperti biasa. */
interface TopBarSearchCtxValue {
  el: HTMLElement | null;
  setEl: (el: HTMLElement | null) => void;
  /** true bila ada halaman yang sedang menyumbang search. */
  ada: boolean;
  setAda: (v: boolean) => void;
}

const Ctx = createContext<TopBarSearchCtxValue | null>(null);

export function TopBarSearchProvider({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [ada, setAda] = useState(false);
  const value = useMemo(() => ({ el, setEl, ada, setAda }), [el, ada]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Konteks slot (dipakai TopBar untuk memasang elemen target & membaca `ada`). */
export function useTopBarSearchCtx() {
  return useContext(Ctx);
}

/** Input pencarian halaman di TopBar. Lepas otomatis saat halaman unmount. */
export function TopBarSearch({
  value,
  onChange,
  placeholder = 'Cari…',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const ctx = useContext(Ctx);
  const setAda = ctx?.setAda;
  useEffect(() => {
    if (!setAda) return;
    setAda(true);
    return () => setAda(false);
  }, [setAda]);

  if (!ctx?.el) return null;
  return createPortal(
    <form
      role="search"
      onSubmit={(e) => e.preventDefault()}
      className="relative flex w-[150px] shrink-0 items-center"
    >
      <Search size={15} className="pointer-events-none absolute left-2.5 text-white/60" />
      <input
        id="input_cari_topbar"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-7 w-full rounded-md border border-white/20 bg-white/10 pr-7 pl-8 text-xs text-white outline-none placeholder:text-white/50 focus:border-white/40 focus:bg-white/15 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:appearance-none"
      />
      {value !== '' && (
        <button
          type="button"
          id="btn_hapus_cari_topbar"
          title="Bersihkan pencarian"
          aria-label="Bersihkan pencarian"
          onClick={() => onChange('')}
          className="absolute right-1.5 grid size-5 place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white"
        >
          <X size={13} />
        </button>
      )}
    </form>,
    ctx.el,
  );
}
