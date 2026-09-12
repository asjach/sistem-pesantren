import type { ReactNode } from 'react';

export function PilihanKartu({
  id,
  aktif,
  judul,
  deskripsi,
  onClick,
  disabled,
}: {
  id: string;
  aktif: boolean;
  judul: string;
  deskripsi?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      aria-pressed={aktif}
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-1 flex-col gap-0.5 rounded-2xl border-2 px-3.5 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
        aktif
          ? 'border-emerald-600 bg-emerald-50'
          : 'border-slate-200 bg-white active:border-slate-300'
      }`}
    >
      <span className="text-sm font-semibold text-slate-900">{judul}</span>
      {deskripsi ? <span className="text-xs leading-snug text-slate-500">{deskripsi}</span> : null}
    </button>
  );
}

export function KartuInfo({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900">
      {children}
    </div>
  );
}
