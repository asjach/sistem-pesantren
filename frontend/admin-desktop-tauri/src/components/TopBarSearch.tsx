import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { NotebookTabs, Search, X } from '@/icons';
import { useCariGlobal } from '@/hooks/useCariGlobal';
import { sedangMengetik } from '@/hooks/usePintasanBaru';
import { usePencarianGlobal } from '@/components/PencarianGlobalProvider';
import PopupCariGlobal from '@/components/PopupCariGlobal';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** Slot pencarian tunggal di baris atas TopBar (menggantikan judul halaman).
 *
 *  Halaman menaruh `<TopBarSearch value onChange placeholder />` di mana pun
 *  dalam pohon halaman; inputnya dipindah (portal) ke TopBar. Satu input per
 *  halaman dipakai untuk semua tabel di halaman itu. Bila halaman tak
 *  menyumbang search, TopBar menampilkan judul halaman seperti biasa.
 *
 *  Tombol toggle di kiri input memilih jangkauan pencarian:
 *  - NONAKTIF (bawaan) = halaman aktif. Ketikan hanya menyaring tabel halaman
 *    ini lewat `onChange`; tidak ada popup.
 *  - AKTIF = global. Ketikan tetap menyaring tabel halaman ini SEKALIGUS
 *    membuka popup hasil lintas halaman. Klik hasil = pindah ke halaman tujuan
 *    dengan tabelnya tersaring oleh NIS/NIP/nama hasil tersebut. */
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

/** Input pencarian halaman di TopBar. Lepas otomatis saat halaman unmount.
 *
 *  Nilai bersifat global lintas halaman: saat dipasang, state lokal halaman
 *  mengadopsi nilai global (pindah halaman membawa kata kunci); tiap ketikan
 *  menulis balik ke global sekaligus ke state halaman. */
export function TopBarSearch({
  value,
  onChange,
  placeholder = 'Cari…',
  onFocus,
  popup,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  popup?: ReactNode;
}) {
  const ctx = useContext(Ctx);
  const setAda = ctx?.setAda;
  useEffect(() => {
    if (!setAda) return;
    setAda(true);
    return () => setAda(false);
  }, [setAda]);
  const { nilai: cariGlobal, ubah: ubahGlobal } = useCariGlobal();
  const pencarianGlobal = usePencarianGlobal();
  const [popupGlobal, setPopupGlobal] = useState(false);
  /** Jangkauan pencarian: `false` = halaman aktif (bawaan), `true` = global.
   *  State lokal per halaman — pindah halaman mengembalikannya ke halaman
   *  aktif, sesuai permintaan "default di halaman aktif". */
  const [global, setGlobal] = useState(false);
  /** Halaman yang menyumbang `popup` sendiri (mis. Board) memegang kendali
   *  penuh: tombol toggle tidak ditampilkan, popup global tidak dipakai. */
  const pakaiGlobal = popup === undefined && pencarianGlobal !== null;

  // tapi value sudah sama dengan global sehingga no-op).
  const adopsiRef = useRef(false);
  useEffect(() => {
    if (!adopsiRef.current && value !== cariGlobal) {
      adopsiRef.current = true;
      onChange(cariGlobal);
    }
  }, [value, cariGlobal, onChange]);
  const ketik = (v: string) => {
    ubahGlobal(v);
    onChange(v);
    // Mode halaman aktif: cukup saring tabel (tanpa popup). Mode global:
    // tabel tetap tersaring + popup hasil lintas halaman ikut terbuka.
    if (pakaiGlobal && global) setPopupGlobal(v.trim() !== '');
  };
  const fokus = () => {
    onFocus?.();
    if (pakaiGlobal && global && value.trim() !== '') setPopupGlobal(true);
  };
  const toggleGlobal = () => {
    const berikut = !global;
    setGlobal(berikut);
    setPopupGlobal(berikut && value.trim() !== '');
  };

  useEffect(() => {
    const fokus = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (sedangMengetik(e.target as HTMLElement | null)) return;
      if (document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')) return;
      const el = document.getElementById('input_cari_topbar');
      if (el) {
        e.preventDefault();
        el.focus();
      }
    };
    window.addEventListener('keydown', fokus);
    return () => window.removeEventListener('keydown', fokus);
  }, []);

  if (!ctx?.el) return null;
  return createPortal(
    <div className="flex w-full min-w-0 items-center gap-1">
      {pakaiGlobal ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              id="btn_toggle_cari_global"
              type="button"
              aria-pressed={global}
              aria-label={global ? 'Pencarian global aktif' : 'Pencarian halaman aktif'}
              onClick={toggleGlobal}
              className={cn(
                'grid h-[26px] w-[24px] shrink-0 place-items-center rounded-md border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--chrome-ring)]',
                global
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground,var(--primary-foreground))]'
                  : 'border-[color-mix(in_srgb,var(--sidebar-foreground)_20%,transparent)] bg-[color-mix(in_srgb,var(--sidebar-foreground)_10%,transparent)] text-[color-mix(in_srgb,var(--sidebar-foreground)_60%,transparent)] hover:text-[var(--sidebar-foreground)]',
              )}
            >
              <NotebookTabs size={12} />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {global
                ? 'Pencarian global: semua halaman aktif (klik untuk halaman ini saja)'
                : 'Pencarian halaman aktif (klik untuk cari di semua halaman)'}
            </p>
          </TooltipContent>
        </Tooltip>
      ) : null}
      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="relative flex min-w-0 flex-1 items-center"
      >
        <Search size={14} className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-[color-mix(in_srgb,var(--sidebar-foreground)_60%,transparent)]" />
        <input
          id="input_cari_topbar"
          type="search"
          value={value}
          onChange={(e) => ketik(e.target.value)}
          onFocus={fokus}
          aria-label={placeholder}
          aria-keyshortcuts="/"
          className="h-[26px] w-full rounded-md border border-[color-mix(in_srgb,var(--sidebar-foreground)_20%,transparent)] bg-[color-mix(in_srgb,var(--sidebar-foreground)_10%,transparent)] pr-14 pl-7 text-xs text-[var(--sidebar-foreground)] outline-none placeholder:text-[color-mix(in_srgb,var(--sidebar-foreground)_60%,transparent)] focus:border-[var(--accent)] focus:bg-[color-mix(in_srgb,var(--sidebar-foreground)_15%,transparent)] [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:appearance-none"
        />
        <kbd
          aria-hidden="true"
          title="Fokus pencarian (/)"
          className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border border-[color-mix(in_srgb,var(--sidebar-foreground)_20%,transparent)] px-1 font-mono text-[10px] text-[color-mix(in_srgb,var(--sidebar-foreground)_60%,transparent)] sm:inline"
        >
          /
        </kbd>
        {value !== '' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                id="btn_hapus_cari_topbar"
                aria-label="Bersihkan pencarian"
                onClick={() => ketik('')}
                className="absolute top-1/2 right-8 grid size-4 -translate-y-1/2 place-items-center rounded text-[color-mix(in_srgb,var(--sidebar-foreground)_60%,transparent)] hover:bg-[color-mix(in_srgb,var(--sidebar-foreground)_10%,transparent)] hover:text-[var(--sidebar-foreground)]"
              >
                <X size={12} />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Bersihkan pencarian</p>
            </TooltipContent>
          </Tooltip>
        )}
        {popup}
        {pakaiGlobal && global && popupGlobal && value.trim() !== '' ? (
          <PopupCariGlobal
            kueri={value}
            onPilih={(target, kueri) => {
              setPopupGlobal(false);
              pencarianGlobal?.pilih(target, kueri);
            }}
            onTutup={() => setPopupGlobal(false)}
          />
        ) : null}
      </form>
    </div>,
    ctx.el,
  );
}
