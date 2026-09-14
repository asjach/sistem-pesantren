import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '@/api/client';
import { listRiwayat, type RiwayatRow } from '@/api/siklus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorNotice } from '@/components/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** Pilih santri aktif (baris riwayat) untuk memulai aksi mutasi/kelulusan
 *  dari halaman arsip. Mengembalikan RiwayatRow (butuh lembaga_id). */
export function SantriPickerDialog({ open, onOpenChange, judul, onPick }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  judul: string;
  onPick: (row: RiwayatRow) => void;
}) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<RiwayatRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const cari = useCallback(async (teks: string) => {
    setLoading(true);
    setErr('');
    try {
      const res = await listRiwayat({ q: teks || undefined, is_aktif: true, per_page: 50 });
      setRows(res.data);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setQ('');
      void cari('');
    }
  }, [open, cari]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{judul}</DialogTitle>
          <DialogDescription className="sr-only">Cari dan pilih santri aktif.</DialogDescription>
        </DialogHeader>
        <ErrorNotice>{err}</ErrorNotice>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => { e.preventDefault(); void cari(q.trim()); }}
        >
          <Input
            id="input_cari_picker_santri"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama / NIS"
            autoFocus
          />
          <Button id="btn_cari_picker_santri" type="submit" variant="outline" disabled={loading}>Cari</Button>
        </form>
        <ul className="max-h-[50vh] divide-y overflow-y-auto rounded-lg border">
          {loading && <li className="p-3 text-sm text-muted-foreground">Memuat…</li>}
          {!loading && rows.length === 0 && <li className="p-3 text-sm text-muted-foreground">Tidak ada santri aktif.</li>}
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="flex w-full flex-col items-start gap-0.5 p-3 text-left text-sm transition-colors hover:bg-accent"
                onClick={() => { onPick(r); onOpenChange(false); }}
              >
                <span className="font-medium">{r.santri?.nama_lengkap ?? `Santri #${r.santri_id}`}</span>
                <span className="text-xs text-muted-foreground">
                  {[
                    r.nis ?? r.santri?.nis,
                    r.lembaga?.kode ?? r.lembaga?.nama,
                    r.tingkat ? `tingkat ${r.tingkat}` : null,
                    r.kelas?.nama_kelas,
                    `smt ${r.semester}`,
                  ].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
