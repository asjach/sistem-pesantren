import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** Dialog Lihat generik: tampilkan field skalar baris sebagai definisi. */
export function ViewDialog({
  open,
  onOpenChange,
  title,
  row,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  row: Record<string, unknown> | null;
}) {
  const entries = useMemo(() => {
    if (!row) return [];
    return Object.entries(row).filter(([, v]) => {
      if (v === null || v === undefined) return false;
      if (typeof v === 'object') return Array.isArray(v) && v.every((x) => ['string', 'number', 'boolean'].includes(typeof x));
      return ['string', 'number', 'boolean'].includes(typeof v);
    });
  }, [row]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Detail data (baca-saja).</DialogDescription>
        </DialogHeader>
        <dl className="grid max-h-[60vh] grid-cols-[140px_1fr] gap-x-3 gap-y-2 overflow-y-auto text-sm">
          {entries.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="break-words">{Array.isArray(v) ? v.join(', ') : String(v)}</dd>
            </div>
          ))}
          {entries.length === 0 && <p className="col-span-2 text-muted-foreground">Tidak ada detail.</p>}
        </dl>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
