import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { errorMessage } from '../../api/client';
import { ubahTagihan, type CrosstabKolom, type CrosstabSel } from '../../api/keuangan';
import { type TahunAjaran } from '../../api/master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from '@/icons';

export interface TargetUbahTagihan {
  sel: CrosstabSel;
  kolom: CrosstabKolom;
  nama: string;
  label: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: TargetUbahTagihan | null;
  /** Daftar tahun ajaran sudah dimuat halaman (tak perlu fetch ulang). */
  daftarTA: TahunAjaran[];
  onSelesai: () => void | Promise<void>;
}

/**
 * Ubah tagihan yang sudah terlanjur dibuat.
 *
 * Yang bisa diubah: nominal, tahun ajaran, dan jatuh tempo (khusus jenis
 * non-bulanan — jenis bulanan mengikuti aturan tanggal 10 bulan berikutnya,
 * jadi isni read-only di sini). Jenis & periode ditampilkan saja karena
 * keduanya bagian kunci unik tagihan; mengubahnya bukan koreksi.
 */
export default function UbahTagihanDialog({ open, onOpenChange, target, daftarTA, onSelesai }: Props) {
  const [nominal, setNominal] = useState('');
  const [tahunAjaran, setTahunAjaran] = useState('');
  const [jatuhTempo, setJatuhTempo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (target === null) return;
    setNominal(String(target.sel.nominal));
    setTahunAjaran(target.sel.tahun_ajaran);
    setJatuhTempo(target.sel.jatuh_tempo ?? '');
  }, [target]);

  if (target === null) return null;

  const bulanan = target.kolom.tipe === 'bulanan';
  const sudahBayar = target.sel.terbayar;
  const nominalAngka = Number(nominal);
  const valid = nominal !== ''
    && Number.isInteger(nominalAngka)
    && nominalAngka >= 0
    && nominalAngka >= sudahBayar
    && tahunAjaran !== '';

  const simpan = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await ubahTagihan(target.sel.id, {
        nominal: nominalAngka,
        tahun_ajaran: tahunAjaran,
        jatuh_tempo: bulanan ? null : (jatuhTempo || null),
      });
      toast.success('Tagihan diubah.');
      onOpenChange(false);
      await onSelesai();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ubah Tagihan</DialogTitle>
          <DialogDescription>
            {target.label} — {target.nama}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-3">
          <FieldLabel htmlFor="inp_ubah_nominal">Nominal</FieldLabel>
          <Input
            id="inp_ubah_nominal"
            type="number"
            min={sudahBayar}
            value={nominal}
            onChange={(e) => setNominal(e.target.value)}
            aria-invalid={nominal !== '' && (!Number.isInteger(nominalAngka) || nominalAngka < sudahBayar)}
          />

          <FieldLabel htmlFor="sel_ubah_ta">Tahun Ajaran</FieldLabel>
          <select
            id="sel_ubah_ta"
            className="h-9 rounded border px-2 text-sm"
            value={tahunAjaran}
            onChange={(e) => setTahunAjaran(e.target.value)}
          >
            {!daftarTA.some((t) => t.nama === tahunAjaran) && <option value={tahunAjaran}>{tahunAjaran}</option>}
            {daftarTA.map((t) => <option key={t.nama} value={t.nama}>{t.nama}{t.is_aktif ? ' (aktif)' : ''}</option>)}
          </select>

          <FieldLabel htmlFor="inp_ubah_jatuh_tempo">Jatuh Tempo</FieldLabel>
          {bulanan ? (
            <p id="inp_ubah_jatuh_tempo" className="flex h-9 items-center text-sm text-muted-foreground">
              {target.sel.jatuh_tempo ? tanggalPendek(target.sel.jatuh_tempo) : '—'}
              <span className="ml-1 text-xs">(otomatis: tanggal 10 bulan berikutnya)</span>
            </p>
          ) : (
            <Input
              id="inp_ubah_jatuh_tempo"
              type="date"
              value={jatuhTempo}
              onChange={(e) => setJatuhTempo(e.target.value)}
            />
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Sudah dibayar Rp {sudahBayar.toLocaleString('id')}
          {sudahBayar > 0 && nominalAngka < sudahBayar
            ? ' — nominal tidak boleh lebih kecil dari nilai itu.'
            : '. Jenis tagihan dan periode tidak bisa diubah.'}
        </p>

        <DialogFooter>
          <Button id="btn_ubah_batal" type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button id="btn_ubah_simpan" type="button" disabled={!valid || busy} onClick={() => void simpan()}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "2026-08-10" → "10-08-2026". */
function tanggalPendek(iso: string): string {
  const [y, b, h] = iso.split('-');
  return `${h}-${b}-${y}`;
}