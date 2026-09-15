import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Minus, Plus, type Ikon } from '@/icons';

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
  disabled = false,
  vertikal = false,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  title: string;
  ariaLabel: string;
  onChange: (n: number) => void;
  /** Nonaktifkan seluruh kontrol (mis. halaman ini tidak punya tabel grid). */
  disabled?: boolean;
  /** Tata letak tombol: `false` (bawaan) horizontal −/nilai/+;
   *  `true` vertikal (− di atas, nilai, + di bawah). */
  vertikal?: boolean;
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
  const btn = cn(
    'shrink-0 place-items-center text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-40 grid',
    vertikal ? 'h-4' : 'w-5',
  );
  return (
    <div
      title={title}
      data-part="spinbox"
      className={cn(
        'flex items-stretch overflow-hidden rounded-md border border-white/20 bg-white/5 focus-within:ring-2 focus-within:ring-white/30',
        vertikal ? 'w-8 flex-col' : 'h-6',
        disabled && 'pointer-events-none opacity-40',
      )}
    >
      <button
        type="button"
        id={`${id}_kurang`}
        aria-label={`${ariaLabel} kurang`}
        disabled={disabled || value <= min}
        className={btn}
        onClick={() => stepBy(-1)}
      >
        <Minus size={vertikal ? 11 : 12} />
      </button>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        aria-label={ariaLabel}
        disabled={disabled}
        className={cn(
          'border-white/20 bg-transparent px-0 text-center text-xs text-white outline-none',
          vertikal ? 'h-6 w-full border-y' : 'h-full w-8 border-x',
        )}
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
        disabled={disabled || value >= max}
        className={btn}
        onClick={() => stepBy(1)}
      >
        <Plus size={vertikal ? 11 : 12} />
      </button>
    </div>
  );
}

/** Tombol perintah ribbon (aksi, bukan navigasi). `aktif` untuk tombol toggle.
 *  `iconOnly` menyembunyikan label (label tetap jadi tooltip & aria-label). */
export function RibbonCmd({
  id,
  icon: Icon,
  label,
  onClick,
  disabled,
  aktif,
  iconOnly,
}: {
  id: string;
  icon: Ikon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  aktif?: boolean;
  iconOnly?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={aktif}
      disabled={disabled}
      onClick={onClick}
      data-part="menu_ribbon"
      className={cn(
        'flex h-6 items-center gap-1.5 rounded-md text-xs whitespace-nowrap transition-colors',
        iconOnly ? 'w-6 justify-center' : 'px-2',
        aktif
          ? 'bg-white/20 font-semibold text-white'
          : 'text-white/85 hover:bg-white/10 hover:text-white',
        'disabled:pointer-events-none disabled:opacity-40',
      )}
    >
      <Icon size={14} />
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}

/** Grup perintah ribbon + nama grup di atasnya.
 *  `disabled` mematikan seluruh isi grup (mis. tidak ada tabel pada halaman). */
export function RibbonGroup({ label, children, disabled }: { label: string; children: ReactNode; disabled?: boolean }) {
  return (
    <div
      data-part="grup_ribbon"
      aria-disabled={disabled || undefined}
      className={cn('flex shrink-0 flex-col items-center gap-1.5 px-1.5', disabled && 'pointer-events-none opacity-40')}
    >
      <span className="w-full pb-1 text-center text-[10px] uppercase tracking-wide text-white/50">
        {label}
      </span>
      <div className="flex flex-1 items-center gap-1">{children}</div>
    </div>
  );
}

export function RibbonPemisah() {
  return <span aria-hidden data-part="pemisah_ribbon" className="mx-0.5 h-[54px] w-px self-center bg-white/15" />;
}
