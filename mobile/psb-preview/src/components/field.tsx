import type { ReactNode } from 'react';

export const kelasInput =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-500';

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}

export function Banner({ jenis, pesan }: { jenis: 'error' | 'info' | 'sukses'; pesan: string }) {
  const gaya =
    jenis === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : jenis === 'sukses'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-amber-200 bg-amber-50 text-amber-800';
  return <div className={`rounded-xl border px-3.5 py-3 text-sm ${gaya}`}>{pesan}</div>;
}
