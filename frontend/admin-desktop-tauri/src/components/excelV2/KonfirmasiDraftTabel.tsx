import { Loader2 } from '@/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** Penjaga konteks tabel: draft harus disimpan atau dibuang sebelum pindah. */
export function KonfirmasiDraftTabel({
  open,
  tujuan,
  sibuk,
  galat,
  onSimpan,
  onBuang,
  onTetap,
}: {
  open: boolean;
  tujuan: string;
  sibuk: boolean;
  galat: string;
  onSimpan: () => void;
  onBuang: () => void;
  onTetap: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(terbuka) => { if (!terbuka && !sibuk) onTetap(); }}>
      <DialogContent
        showCloseButton={!sibuk}
        aria-busy={sibuk}
        onEscapeKeyDown={(e) => { if (sibuk) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Simpan perubahan sebelum pindah?</DialogTitle>
          <DialogDescription>
            Ada nilai yang belum tersimpan. Pilih simpan, buang, atau tetap di halaman ini sebelum {tujuan}.
          </DialogDescription>
        </DialogHeader>
        {galat ? <p role="alert" className="text-xs text-destructive">{galat}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={sibuk} onClick={onTetap}>
            Tetap di sini
          </Button>
          <Button type="button" variant="destructive" disabled={sibuk} onClick={onBuang}>
            Buang perubahan
          </Button>
          <Button type="button" disabled={sibuk} onClick={onSimpan}>
            {sibuk ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Menyimpan…
              </>
            ) : 'Simpan dan lanjut'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
