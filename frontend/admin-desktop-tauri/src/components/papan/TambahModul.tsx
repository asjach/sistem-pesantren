import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Dialog modul baru; tab papan dibangun dari data sehingga langsung muncul. */
export function TambahModul({
  onTutup,
  onSimpan,
}: {
  onTutup: () => void;
  onSimpan: (kode: string, nama: string) => Promise<void>;
}) {
  const [kode, setKode] = useState('');
  const [nama, setNama] = useState('');
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  async function simpan() {
    setSibuk(true);
    setGalat('');

    try {
      await onSimpan(kode.trim(), nama.trim());
      onTutup();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Modul gagal ditambahkan.');
    } finally {
      setSibuk(false);
    }
  }

  return (
    <Dialog open onOpenChange={(b) => { if (!b) onTutup(); }}>
      <DialogContent id="dialog_tambah_modul" className="w-[min(420px,calc(100vw_-_1rem))]">
        <DialogHeader>
          <DialogTitle id="judul_tambah_modul">Tambah modul</DialogTitle>
        </DialogHeader>
        {galat ? <p role="alert" className="text-xs text-destructive">{galat}</p> : null}
        <label htmlFor="input_kode_modul_baru" className="text-xs text-muted-foreground">Kode</label>
        <input id="input_kode_modul_baru" value={kode} maxLength={10} onChange={(e) => setKode(e.target.value)} className="w-full border bg-transparent px-2 py-1.5 text-sm font-mono" style={{ borderColor: 'var(--divider)' }} />
        <label htmlFor="input_nama_modul_baru" className="text-xs text-muted-foreground">Nama modul</label>
        <input id="input_nama_modul_baru" value={nama} maxLength={100} onChange={(e) => setNama(e.target.value)} className="w-full border bg-transparent px-2 py-1.5 text-sm" style={{ borderColor: 'var(--divider)' }} />
        <Button id="btn_simpan_modul_baru" type="button" disabled={sibuk || !kode.trim() || !nama.trim()} onClick={() => void simpan()} className="self-start">
          Tambah modul
        </Button>
      </DialogContent>
    </Dialog>
  );
}
