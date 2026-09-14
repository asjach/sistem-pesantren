import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Minus, Plus, type Ikon } from '@/icons';

export function pathAktif(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);
}

export function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

/** Spinbox dengan tombol −/+ yang selalu tampil (bukan spinner native saat hover). */
export function SpinBox({
  id,
  value,
  min,
  max,
  title,
  ariaLabel,
  onChange,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  title: string;
  ariaLabel: string;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  // Commit hanya saat blur/Enter/± agar mengetik tidak memicu re-render global
  // dan AutoFit tiap karakter.
  const commit = (raw: string | null) => {
    setDraft(null);
    if (raw === null || raw.trim() === '') return;
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    onChange(clamp(n, min, max));
  };
  const stepBy = (d: number) => {
    const typed = draft !== null && draft.trim() !== '' && Number.isFinite(Number(draft))
      ? Number(draft)
      : value;
    setDraft(null);
    onChange(clamp(typed + d, min, max));
  };
  const btn =
    'grid w-5 shrink-0 place-items-center text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-40';
  return (
    <div
      title={title}
      data-part="spinbox"
      className="flex h-[30px] items-stretch overflow-hidden rounded-md border border-white/20 bg-white/5 focus-within:ring-2 focus-within:ring-white/30"
    >
      <button
        type="button"
        id={`${id}_kurang`}
        aria-label={`${ariaLabel} kurang`}
        disabled={value <= min}
        className={btn}
        onClick={() => stepBy(-1)}
      >
        <Minus size={12} />
      </button>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        aria-label={ariaLabel}
        className="h-full w-8 border-x border-white/20 bg-transparent px-0 text-center text-xs text-white outline-none"
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      <button
        type="button"
        id={`${id}_tambah`}
        aria-label={`${ariaLabel} tambah`}
        disabled={value >= max}
        className={btn}
        onClick={() => stepBy(1)}
      >
        <Plus size={12} />
      </button>
    </div>
  );
}

/** Tombol besar ribbon: ikon di atas label (ala Office). */
export function RibbonBtn({
  id,
  to,
  icon: Icon,
  label,
  aktif,
}: {
  id: string;
  to: string;
  icon: Ikon;
  label: string;
  aktif: boolean;
}) {
  return (
    <NavLink
      id={id}
      to={to}
      end={to === '/'}
      title={label}
      data-part="menu_ribbon"
      className={cn(
        'flex h-[58px] w-[76px] flex-col items-center justify-center gap-1 rounded-md px-1 text-center text-[11px] leading-tight transition-colors',
        aktif ? 'bg-white/20 font-semibold text-white' : 'text-white/85 hover:bg-white/10 hover:text-white',
      )}
    >
      <Icon size={20} />
      <span className="line-clamp-2">{label}</span>
    </NavLink>
  );
}

/** Tombol perintah ribbon (aksi, bukan navigasi). `aktif` untuk tombol toggle. */
export function RibbonCmd({
  id,
  icon: Icon,
  label,
  onClick,
  disabled,
  aktif,
}: {
  id: string;
  icon: Ikon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  aktif?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      title={label}
      aria-pressed={aktif}
      disabled={disabled}
      onClick={onClick}
      data-part="menu_ribbon"
      className={cn(
        'flex h-[58px] w-[76px] flex-col items-center justify-center gap-1 rounded-md px-1 text-center text-[11px] leading-tight transition-colors',
        aktif
          ? 'bg-white/20 font-semibold text-white'
          : 'text-white/85 hover:bg-white/10 hover:text-white',
        'disabled:pointer-events-none disabled:opacity-40',
      )}
    >
      <Icon size={20} />
      <span className="line-clamp-2">{label}</span>
    </button>
  );
}

/** Grup perintah ribbon + nama grup di bawahnya (ala Office). */
export function RibbonGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div data-part="grup_ribbon" className="flex shrink-0 flex-col items-center gap-0.5 px-1.5">
      <div className="flex flex-1 items-center gap-1">{children}</div>
      <span className="text-[10px] uppercase tracking-wide text-white/50">{label}</span>
    </div>
  );
}

export function RibbonPemisah() {
  return <span aria-hidden data-part="pemisah_ribbon" className="mx-0.5 h-[54px] w-px self-center bg-white/15" />;
}
