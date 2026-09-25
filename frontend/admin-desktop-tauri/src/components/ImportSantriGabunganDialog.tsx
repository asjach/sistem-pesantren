import { useState } from 'react';
import { errorMessage } from '@/api/client';
import {
  unduhDataSantriGabungan,
  unduhTemplateSantriGabungan,
} from '@/api/santri';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download } from '@/icons';
import { toast } from 'sonner';
import DataExistingCard from '@/components/DataExistingCard';
import ImportSantriBertahapPanel from '@/components/ImportSantriBertahapPanel';

/**
 * Dialog import gabungan siswa (keanggotaan + identitas) — SEMUA dalam satu
 * dialog: unduh template, unduh data existing (pilih lembaga), lalu langsung
 * import bertahap (browser membaca file lalu mengirim 1000 baris per panggilan).
 * Keanggotaan WAJIB: tiap baris harus punya `jenjang` (santri minimal
 * terdaftar di 1 jenjang). Dipakai halaman Santri Per Lembaga.
 */
export default function ImportSantriGabunganDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void | Promise<void>;
}) {
  const [sibuk, setSibuk] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && sibuk) return; onOpenChange(o); }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import santri</DialogTitle>
          <DialogDescription>Satu file: keanggotaan + identitas. Kolom `jenjang` wajib diisi.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Template kosong</p>
              <p className="text-xs text-muted-foreground">Mulai dari nol.</p>
            </div>
            <Button
              id="btn_unduh_template_gabungan"
              type="button"
              variant="link"
              className="h-auto shrink-0 justify-start px-0"
              onClick={() => void unduhTemplateSantriGabungan().catch((e) => toast.error(errorMessage(e)))}
            >
              <Download data-icon="inline-start" size={16} /> Template gabungan
            </Button>
          </div>
          <DataExistingCard
            aktif={open}
            id="btn_unduh_data_gabungan"
            labelTombol="Unduh data"
            unduh={unduhDataSantriGabungan}
          />
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Langkah 2 — Import bertahap</p>
            <p className="text-xs text-muted-foreground">1000 baris per panggilan — ringan untuk ribuan baris.</p>
            <ImportSantriBertahapPanel
              onSibuk={setSibuk}
              onSelesai={() => { onOpenChange(false); void onDone(); }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={sibuk} onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
