import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** Label khusus untuk kunci umum yang tidak enak kalau disekadar dihumanisasi. */
const ALIAS_KUNCI: Record<string, string> = {
  id: 'ID',
  parent_id: 'Induk',
  created_at: 'Dibuat',
  updated_at: 'Diperbarui',
};

/** Ubah kunci data (snake_case/camelCase) jadi label yang enak dibaca. */
function judulKolom(kunci: string): string {
  if (ALIAS_KUNCI[kunci]) return ALIAS_KUNCI[kunci];
  const teks = kunci
    .replace(/^is_/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return teks.charAt(0).toUpperCase() + teks.slice(1);
}

function nilaiTeks(v: unknown): string {
  if (typeof v === 'boolean') return v ? 'Ya' : 'Tidak';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

/** Seksi tabel tambahan (mis. riwayat/mutasi/alumni) di bawah detail skalar. */
export interface ViewDialogSection {
  title: string;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
}

/** Dialog Lihat generik: tampilkan field skalar baris sebagai definisi.
 *  `sections` opsional untuk relasi (tabel per seksi). */
export function ViewDialog({
  open,
  onOpenChange,
  title,
  row,
  sections = [],
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  row: Record<string, unknown> | null;
  sections?: ViewDialogSection[];
}) {
  const entries = useMemo(() => {
    if (!row) return [];
    return Object.entries(row).filter(([, v]) => {
      if (v === null || v === undefined) return false;
      if (typeof v === 'object') return Array.isArray(v) && v.every((x) => ['string', 'number', 'boolean'].includes(typeof x));
      return ['string', 'number', 'boolean'].includes(typeof v);
    });
  }, [row]);

  const kosong = entries.length === 0 && sections.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Detail data (baca-saja).</DialogDescription>
        </DialogHeader>
        {kosong ? (
          <p className="text-sm text-muted-foreground">Tidak ada detail.</p>
        ) : (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto">
            {entries.length > 0 && (
              <dl className="rounded-lg border bg-card">
                {entries.map(([k, v], i) => (
                  <div
                    key={k}
                    className={cn(
                      'grid grid-cols-[9rem_1fr] gap-x-4 px-3 py-2 text-sm',
                      i > 0 && 'border-t',
                    )}
                  >
                    <dt className="text-muted-foreground">{judulKolom(k)}</dt>
                    <dd className="break-words font-medium">{nilaiTeks(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {sections.map((s) => (
              <section key={s.title} className="space-y-1.5">
                <h3 className="text-sm font-semibold">{s.title}</h3>
                {s.rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada data.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          {s.columns.map((c) => (
                            <th key={c.key} className="px-3 py-1.5 text-left font-medium whitespace-nowrap">
                              {c.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {s.rows.map((r, i) => (
                          <tr key={i} className="border-t">
                            {s.columns.map((c) => (
                              <td key={c.key} className="px-3 py-1.5 whitespace-nowrap">
                                {nilaiTeks(r[c.key] ?? '—')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
