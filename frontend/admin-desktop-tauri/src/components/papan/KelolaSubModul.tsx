import { useState } from 'react';
import { tambahSubPapan } from '@/api/papan';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Sub-modul baru belum mempunyai kartu; pembuatannya tersedia di toolbar papan. */
export function KelolaSubModul({
  modulKode,
  modulNama,
  onTutup,
  onBerubah,
}: {
  modulKode: string;
  modulNama: string;
  onTutup: () => void;
  onBerubah: () => Promise<void>;
}) {
  const [kode, setKode] = useState('');
  const [nama, setNama] = useState('');
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  async function simpan() {
    setSibuk(true);
    setGalat('');
    try {
      await tambahSubPapan(modulKode, kode.trim(), nama.trim());
      await onBerubah();
      onTutup();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Sub-modul gagal ditambahkan.');
    } finally {
      setSibuk(false);
    }
  }

  return (
    <Dialog open onOpenChange={(b) => { if (!b) onTutup(); }}>
      <DialogContent id="dialog_kelola_papan" className="w-[min(420px,calc(100vw_-_1rem))]">
        <DialogHeader>
          <DialogTitle id="judul_kelola_papan">Tambah sub-modul · {modulKode}. {modulNama}</DialogTitle>
        </DialogHeader>
        {galat ? <p role="alert" className="text-xs text-destructive">{galat}</p> : null}
        <label htmlFor="input_kode_sub_baru" className="text-xs text-muted-foreground">Kode</label>
        <input id="input_kode_sub_baru" value={kode} maxLength={20} onChange={(e) => setKode(e.target.value)} placeholder={`${modulKode}.1`} className="w-full border bg-transparent px-2 py-1.5 text-sm" style={{ borderColor: 'var(--divider)' }} />
        <label htmlFor="input_nama_sub_baru" className="text-xs text-muted-foreground">Nama sub-modul</label>
        <input id="input_nama_sub_baru" value={nama} onChange={(e) => setNama(e.target.value)} className="w-full border bg-transparent px-2 py-1.5 text-sm" style={{ borderColor: 'var(--divider)' }} />
        <Button id="btn_tambah_sub_baru" type="button" disabled={sibuk || !kode.trim() || !nama.trim()} onClick={() => void simpan()} className="self-start">Tambah sub-modul</Button>
      </DialogContent>
    </Dialog>
  );
}
