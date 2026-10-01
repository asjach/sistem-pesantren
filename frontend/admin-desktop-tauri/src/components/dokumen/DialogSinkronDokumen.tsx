import { useRef, useState } from 'react';
import { errorMessage } from '@/api/client';
import type { DokumenRow, TipeDokumen } from '@/api/dokumen';
import {
  depsPerangkat,
  ringkasanAwal,
  sinkronkanDaftar,
  type RingkasanSinkron,
} from '@/lib/sinkronDokumen';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** Dialog sinkron cermin dua arah (lokal ↔ server), tombol manual.
 *  Berjalan batch di perangkat (tanpa antrean backend): hilang satu sisi
 *  disalin dari yang ada; isi beda dimenangkan waktu ubah terbaru
 *  (seri <2 detik → server). Idempoten: batal kapan pun, ulang me-resume. */
export default function DialogSinkronDokumen({
  tipe,
  terbuka,
  onTutup,
  ambilBaris,
  onSelesai,
  lingkup,
}: {
  tipe: TipeDokumen;
  terbuka: boolean;
  onTutup: () => void;
  ambilBaris: () => Promise<DokumenRow[]>;
  onSelesai: () => void;
  lingkup: string;
}) {
  const [fase, setFase] = useState<'siap' | 'jalan' | 'selesai'>('siap');
  const [ringkas, setRingkas] = useState<RingkasanSinkron>(() => ringkasanAwal(0));
  const [galatFatal, setGalatFatal] = useState('');
  const batalRef = useRef(false);

  async function mulai() {
    setFase('jalan');
    setGalatFatal('');
    batalRef.current = false;
    try {
      const baris = await ambilBaris();
      const hasil = await sinkronkanDaftar(baris, depsPerangkat(tipe), {
        lapor: (r) => setRingkas({ ...r, galatDaftar: [...r.galatDaftar] }),
        dibatalkan: () => batalRef.current,
      });
      setRingkas({ ...hasil, galatDaftar: [...hasil.galatDaftar] });
      onSelesai();
    } catch (e) {
      setGalatFatal(errorMessage(e));
    } finally {
      setFase('selesai');
    }
  }

  function tutup() {
    if (fase === 'jalan') return;
    setFase('siap');
    setRingkas(ringkasanAwal(0));
    setGalatFatal('');
    onTutup();
  }

  const persen = ringkas.total === 0 ? 0 : Math.round((ringkas.selesai / ringkas.total) * 100);

  return (
    <Dialog open={terbuka} onOpenChange={(b) => { if (!b) tutup(); }}>
      <DialogContent id="dialog_sinkron_dokumen" className="max-w-lg">
        <DialogHeader>
          <DialogTitle id="judul_sinkron_dokumen">Sinkronkan arsip perangkat ↔ server</DialogTitle>
          <DialogDescription>
            Lingkup: {lingkup}. Baris yang hilang di satu sisi disalin dari sisi yang ada;
            isi yang beda dimenangkan waktu ubah terbaru. Aman diulang — baris yang sudah sama dilewati.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div id="progres_sinkron_dokumen" className="h-2 overflow-hidden rounded bg-muted" role="progressbar" aria-valuenow={persen} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-primary transition-all" style={{ width: `${persen}%` }} />
          </div>
          <p id="teks_progres_sinkron" className="text-xs text-muted-foreground">
            {fase === 'siap' && 'Siap dimulai.'}
            {fase === 'jalan' && `Berjalan… ${ringkas.selesai}/${ringkas.total} (${persen}%)`}
            {fase === 'selesai' && (ringkas.dibatalkan
              ? `Dibatalkan pada ${ringkas.selesai}/${ringkas.total} — ulangi untuk melanjutkan.`
              : `Selesai: ${ringkas.selesai}/${ringkas.total} baris.`)}
          </p>
          <div id="ringkasan_sinkron_dokumen" className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded border p-2"><div className="text-lg font-semibold">{ringkas.naik}</div>naik ke server</div>
            <div className="rounded border p-2"><div className="text-lg font-semibold">{ringkas.turun}</div>turun ke lokal</div>
            <div className="rounded border p-2"><div className="text-lg font-semibold">{ringkas.sama + ringkas.ditandai + ringkas.dilewati}</div>sudah sama</div>
            <div className="rounded border p-2"><div className="text-lg font-semibold">{ringkas.seri}</div>seri (server menang)</div>
            <div className="rounded border p-2"><div className="text-lg font-semibold">{ringkas.galat}</div>galat</div>
          </div>
          {galatFatal !== '' && <p id="galat_sinkron_dokumen" className="text-xs text-destructive">{galatFatal}</p>}
          {ringkas.galatDaftar.length > 0 && (
            <div id="daftar_galat_sinkron" className="max-h-36 overflow-y-auto rounded border p-2 text-xs">
              {ringkas.galatDaftar.map((g, i) => (
                <p key={i}><span className="font-medium">{g.nama}</span>: {g.pesan}</p>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          {fase === 'jalan'
            ? <Button id="tombol_batal_sinkron" variant="outline" onClick={() => { batalRef.current = true; }}>Batal</Button>
            : (
              <>
                <Button id="tombol_tutup_sinkron" variant="outline" onClick={tutup}>Tutup</Button>
                <Button id="tombol_mulai_sinkron" onClick={mulai}>{fase === 'selesai' ? 'Jalankan lagi' : 'Mulai'}</Button>
              </>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
