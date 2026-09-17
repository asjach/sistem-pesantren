import { createContext, useContext, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { CheckAllState } from './types';

/** Penanda mode (Edit/Input) bergaya bilah status di badan halaman (bawah
 *  tabel): ikon + judul + tombol keluar; keterangan lengkap ada di tooltip. */
export function PillMode({
  id,
  btnId,
  aksen,
  ikon,
  judul,
  petunjuk,
  onKeluar,
}: {
  id: string;
  btnId: string;
  aksen: 'warning' | 'primary';
  ikon: ReactNode;
  judul: string;
  petunjuk: string;
  onKeluar: () => void;
}) {
  const warn = aksen === 'warning';
  return (
    <div
      id={id}
      role="status"
      title={petunjuk}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs',
        warn ? 'border-warning/40 bg-warning/10 text-warning-foreground' : 'border-primary/40 bg-primary/10 text-foreground',
      )}
    >
      {ikon}
      <span className="font-semibold">{judul}</span>
      <Button
        id={btnId}
        variant="outline"
        size="sm"
        className={cn(
          'h-6 px-2',
          warn
            ? 'border-warning/40 bg-transparent text-warning-foreground hover:bg-warning/10 hover:text-warning-foreground'
            : 'border-primary/40 bg-transparent hover:bg-primary/10',
        )}
        onClick={onKeluar}
      >
        Keluar mode
      </Button>
    </div>
  );
}

/** Kerangka tabel saat memuat: menyerupai grid (baris header + baris data)
 *  agar area tabel tidak tampak seperti blok abu-abu kosong. */
export function TabelMemuat({ rowH, baris = 14 }: { rowH: number; baris?: number }) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-card" aria-hidden="true">
      <div className="h-[26px] shrink-0 border-b bg-muted/60" />
      <div className="flex min-h-0 flex-1 flex-col">
        {Array.from({ length: baris }).map((_, i) => (
          <div key={i} className="shrink-0 border-b border-border/50" style={{ height: rowH }} />
        ))}
      </div>
    </div>
  );
}

export const CheckAllContext = createContext<CheckAllState | null>(null);

export function CheckAllCell() {
  const ctx = useContext(CheckAllContext);
  if (!ctx) return null;
  const all = ctx.ids.length > 0 && ctx.ids.every((id) => ctx.checked.has(id));
  const some = ctx.ids.some((id) => ctx.checked.has(id));
  return (
    <span className="flex w-full items-center justify-center">
      <input
        type="checkbox"
        aria-label="Pilih semua baris"
        className="simpes-dsg-checkall"
        checked={all}
        ref={(el) => {
          if (el) el.indeterminate = some && !all;
        }}
        onChange={(e) => {
          const next = new Set<string | number>();
          if (e.target.checked) for (const id of ctx.ids) next.add(id);
          ctx.setChecked(next);
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      />
    </span>
  );
}
