import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Pembungkus kontrol filter toolbar tabel: label kecil di atas kontrol. */
export default function FilterField({ label, htmlFor, children, className }: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('flex flex-col gap-0.5', className)}>
      <label htmlFor={htmlFor} className="text-[11px] leading-tight text-muted-foreground">
        {label}
      </label>
      {children}
    </span>
  );
}
