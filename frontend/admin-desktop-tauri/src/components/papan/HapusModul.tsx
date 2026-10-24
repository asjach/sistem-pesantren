import { useRef, useState } from 'react';
import type { ModulPapan } from '@/api/papan';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function HapusModul({ modul, onTutup, onHapus }: {
  modul: ModulPapan;
  onTutup: () => void;
  onHapus: () => Promise<void>;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');
  const mengirim = useRef(false);
  const poin = modul.sub.flatMap((sub) => sub.butir);
  const jumlahSubpoin = poin.reduce((total, butir) => total + (butir.subpoin?.length ?? 0), 0);

  async function hapus() {
    if (mengirim.current) return;
    mengirim.current = true;
    setSibuk(true);
    setGalat('');
    try {
      await onHapus();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Modul gagal dihapus.');
    } finally {
      mengirim.current = false;
      setSibuk(false);
    }
  }

  return (
    <Dialog open onOpenChange={(terbuka) => { if (!terbuka && !mengirim.current) onTutup(); }}>
      <DialogContent id="dialog_hapus_modul_papan" className="w-[min(460px,calc(100vw_-_1rem))]" aria-busy={sibuk}>
        <DialogHeader>
          <DialogTitle>Hapus modul?</DialogTitle>
          <DialogDescription>
            {modul.kode} · {modul.nama} akan dihapus permanen dari Board, termasuk {modul.sub.length} sub-modul, {poin.length} poin, {jumlahSubpoin} subpoin, dan seluruh riwayat terkait. Kode dan fitur project tidak ikut dihapus.
          </DialogDescription>
        </DialogHeader>
        {galat ? <p role="alert" className="text-xs text-destructive">{galat}</p> : null}
        <DialogFooter>
          <Button id="btn_batal_hapus_modul_papan" variant="outline" disabled={sibuk} onClick={onTutup}>Batal</Button>
          <Button id="btn_konfirmasi_hapus_modul_papan" variant="destructive" disabled={sibuk} onClick={() => void hapus()}>
            {sibuk ? 'Menghapus…' : 'Ya, hapus'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
