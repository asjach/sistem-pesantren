import { useRef, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { Download, Loader2, Upload } from '@/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { errorMessage } from '@/api/client';
import {
  pratinjauRestorePapan,
  restorePapan,
  unduhBackupKeamanan,
  unduhBackupPapan,
  type RingkasanBackupPapan,
} from '@/api/papan';

type Sibuk = 'backup' | 'pratinjau' | 'restore' | 'keamanan' | null;

function waktuTampil(nilai: string): string {
  const tanggal = new Date(nilai);

  return Number.isNaN(tanggal.getTime()) ? nilai : tanggal.toLocaleString('id-ID');
}

/** Tombol backup/restore Board beserta dialog pratinjau dan konfirmasi. */
export function BackupRestorePapan({ onSelesai }: { onSelesai: () => Promise<void> | void }) {
  const inputBerkas = useRef<HTMLInputElement>(null);
  const [sibuk, setSibuk] = useState<Sibuk>(null);
  const [berkas, setBerkas] = useState<File | null>(null);
  const [ringkasan, setRingkasan] = useState<RingkasanBackupPapan | null>(null);
  const [galat, setGalat] = useState('');
  const [dialogTerbuka, setDialogTerbuka] = useState(false);
  const [backupKeamanan, setBackupKeamanan] = useState<string | null>(null);

  async function backup() {
    if (sibuk !== null) return;

    setSibuk('backup');
    try {
      await unduhBackupPapan();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSibuk(null);
    }
  }

  async function pilihBerkas(e: ChangeEvent<HTMLInputElement>) {
    const berkasBaru = e.target.files?.[0];
    e.target.value = '';

    if (!berkasBaru) return;

    if (!berkasBaru.name.toLowerCase().endsWith('.json')) {
      toast.error('Pilih file backup berformat .json.');

      return;
    }

    setSibuk('pratinjau');
    try {
      const hasil = await pratinjauRestorePapan(berkasBaru);
      setBerkas(berkasBaru);
      setRingkasan(hasil.ringkasan);
      setGalat('');
      setDialogTerbuka(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSibuk(null);
    }
  }

  function tutup() {
    if (sibuk === 'restore') return;

    setDialogTerbuka(false);
    setBerkas(null);
    setRingkasan(null);
    setGalat('');
  }

  async function konfirmasiRestore() {
    if (!berkas || !ringkasan || sibuk !== null) return;

    setSibuk('restore');
    setGalat('');
    try {
      const hasil = await restorePapan(berkas);
      setDialogTerbuka(false);
      setBerkas(null);
      setRingkasan(null);
      setBackupKeamanan(hasil.backup_keamanan);
      toast.success(hasil.pesan);
      await onSelesai();
    } catch (e) {
      setGalat(errorMessage(e));
    } finally {
      setSibuk(null);
    }
  }

  async function unduhKeamanan() {
    if (!backupKeamanan || sibuk !== null) return;

    setSibuk('keamanan');
    try {
      await unduhBackupKeamanan(backupKeamanan);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSibuk(null);
    }
  }

  const aplikasiEfektif = ringkasan?.workflow.aplikasi.filter((aplikasi) => aplikasi.efektif) ?? [];

  return (
    <>
      <Button
        id="btn_backup_papan"
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Backup Board"
        title="Backup Board"
        disabled={sibuk !== null}
        onClick={() => void backup()}
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        {sibuk === 'backup' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      </Button>
      <Button
        id="btn_restore_papan"
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Restore Board dari file JSON"
        title="Restore Board"
        disabled={sibuk !== null}
        onClick={() => inputBerkas.current?.click()}
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        {sibuk === 'pratinjau' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
      </Button>
      {backupKeamanan ? (
        <Button
          id="btn_unduh_backup_sebelum_restore"
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Unduh backup sebelum restore"
          title="Unduh backup sebelum restore"
          disabled={sibuk !== null}
          onClick={() => void unduhKeamanan()}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          {sibuk === 'keamanan' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        </Button>
      ) : null}
      <input
        ref={inputBerkas}
        id="input_restore_papan"
        type="file"
        accept=".json,application/json"
        aria-label="File backup Board"
        className="sr-only"
        onChange={(e) => void pilihBerkas(e)}
      />

      <Dialog open={dialogTerbuka} onOpenChange={(terbuka) => { if (!terbuka) tutup(); }}>
        <DialogContent
          showCloseButton={sibuk !== 'restore'}
          aria-busy={sibuk === 'restore'}
          onEscapeKeyDown={(e) => { if (sibuk === 'restore') e.preventDefault(); }}
        >
          <DialogHeader>
            <DialogTitle>Restore Board dari file JSON?</DialogTitle>
            <DialogDescription>
              Seluruh isi Board saat ini akan diganti dengan isi file. Backup keamanan dibuat otomatis sebelum restore.
            </DialogDescription>
          </DialogHeader>

          {ringkasan ? (
            <div className="grid gap-1.5 text-xs">
              <p><span className="font-medium">File:</span> {berkas?.name}</p>
              <p><span className="font-medium">Dibuat:</span> {waktuTampil(ringkasan.dibuat_pada)}</p>
              <p>
                <span className="font-medium">Isi:</span>{' '}
                {ringkasan.modul} modul · {ringkasan.sub_modul} sub-modul · {ringkasan.butir} poin · {ringkasan.riwayat} riwayat
              </p>
              <p><span className="font-medium">Workflow:</span> {ringkasan.workflow.master ? 'Aktif' : 'Draf'}</p>
              <p>
                <span className="font-medium">Aplikasi efektif aktif:</span>{' '}
                {aplikasiEfektif.length > 0 ? aplikasiEfektif.map((aplikasi) => aplikasi.nama).join(', ') : 'Tidak ada'}
              </p>
            </div>
          ) : null}

          {galat ? <p role="alert" className="text-xs text-destructive">{galat}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={sibuk === 'restore'} onClick={tutup}>
              Batal
            </Button>
            <Button type="button" variant="destructive" disabled={sibuk !== null} onClick={() => void konfirmasiRestore()}>
              {sibuk === 'restore' ? 'Memulihkan…' : 'Restore Board'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
