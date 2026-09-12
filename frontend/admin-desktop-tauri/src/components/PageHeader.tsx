import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Kerangka halaman ber-tabel: mengisi sisa tinggi <main> (flex) sehingga grid
 *  mengisi ruang dan menggulir sendiri, tanpa hitung tinggi viewport manual. */
export const PAGE_SHELL = 'flex min-h-0 flex-1 flex-col';

interface PageHeaderProps {
  /** id elemen judul (NFR-05, snake_case). */
  titleId?: string;
  title: string;
  /** Keterangan singkat di bawah judul (opsional). */
  description?: ReactNode;
  /** Aksi/kontrol di sisi kanan judul (opsional). */
  actions?: ReactNode;
  className?: string;
}

/** Judul halaman seragam: satu tinggi, jarak, dan tipografi untuk semua halaman. */
export default function PageHeader({
  titleId,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 id={titleId} className="text-2xl font-bold tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

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
