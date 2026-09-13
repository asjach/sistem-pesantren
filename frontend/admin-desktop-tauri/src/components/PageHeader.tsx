import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Kerangka halaman ber-tabel: mengisi sisa tinggi <main> (flex) sehingga grid
 *  mengisi ruang dan menggulir sendiri, tanpa hitung tinggi viewport manual. */
export const PAGE_SHELL = 'flex min-h-0 flex-1 flex-col';

/** Kotak pesan galat seragam untuk seluruh halaman. */
export function ErrorNotice({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className={cn(
        'mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive',
        className,
      )}
    >
      {children}
    </p>
  );
}
