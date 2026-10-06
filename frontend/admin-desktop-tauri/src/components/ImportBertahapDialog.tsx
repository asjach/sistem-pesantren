import { useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  batalPotongImport,
  potongImportRiwayat,
  dataRiwayatBelajarExisting,
  unduhGalatPotong,
  unduhTemplateRiwayatBelajar,
  type ImportPotongHasil,
  type ImportPotongRingkasan,
} from '../api/siklus';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download } from '@/icons';
import { toast } from 'sonner';
import DataExistingCard from '@/components/DataExistingCard';

/** Kolom template yang dikirim (kunci lain dari file diabaikan). */
const KOLOM_KIRIM = [
  'nis_lokal', 'santri_id', 'nama_lengkap', 'jenjang', 'tahun_ajaran', 'nama_kelas',
  'semester', 'tgl_masuk', 'no_absen', 'tingkat', 'status_awal', 'status_akhir',
];

/** Maks baris per panggilan (disamakan batas backend). */
const POTONGAN = 1000;

type Fase = 'pilih' | 'siap' | 'jalan' | 'selesai';

/** Import riwayat bertahap: browser membaca XLSX (SheetJS, lazy-load) lalu
 *  mengirim potongan JSON 1000 baris per panggilan dengan progress bar.
 *  Backend tidak pernah menyentuh file — ringan untuk file ratusan ribu baris. */
export default function ImportBertahapDialog({ open, onOpenChange, onSelesai }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSelesai: () => void;
}) {
  const [namaFile, setNamaFile] = useState('');
  const [baris, setBaris] = useState<Record<string, unknown>[]>([]);
  const [fase, setFase] = useState<Fase>('pilih');
  const [mode, setMode] = useState<'periksa' | 'eksekusi'>('periksa');
  const [sesiId, setSesiId] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [ringkasan, setRingkasan] = useState<ImportPotongRingkasan | null>(null);
  const [contoh, setContoh] = useState<ImportPotongHasil['galat_contoh']>([]);
  const [galatUnduh, setGalatUnduh] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  /** Mode gabungan: buatkan keanggotaan bila santri belum punya (cocok via
   *  santri_id / nama unik bila NIS tak terdaftar). */
  const [buatAnggota, setBuatAnggota] = useState(false);
  const batalRef = useRef(false);

  function reset() {
    setNamaFile('');
    setBaris([]);
    setFase('pilih');
    setSesiId(null);
    setOffset(0);
    setRingkasan(null);
    setContoh([]);
    setGalatUnduh(false);
    batalRef.current = false;
  }

  async function pilihFile(f: File | null) {
    reset();
    if (!f) return;
    setNamaFile(f.name);
    setSibuk(true);
    try {
      const XLSX = await import('xlsx-js-style');
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const matriks = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, blankrows: false }) as unknown[][];
      if (matriks.length < 1) {
        toast.error('File kosong.');
        return;
      }
      const kepala = (matriks[0] as unknown[]).map((h) => String(h ?? '').trim().toLowerCase());
      const wajib = ['nis_lokal', 'jenjang'];
      const hilang = wajib.filter((k) => !kepala.includes(k));
      if (hilang.length > 0) {
        toast.error(`Kolom wajib tidak ada: ${hilang.join(', ')}.`);
        return;
      }
      const data: Record<string, unknown>[] = [];
      for (const r of matriks.slice(1) as unknown[][]) {
        const o: Record<string, unknown> = {};
        kepala.forEach((k, i) => {
          if (KOLOM_KIRIM.includes(k)) o[k] = r[i] ?? null;
        });
        data.push(o);
      }
      if (data.length === 0) {
        toast.error('Tidak ada baris data.');
        return;
      }
      setBaris(data);
      setFase('siap');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSibuk(false);
    }
  }

  async function jalan(modeJalan: 'periksa' | 'eksekusi') {
    if (baris.length === 0 || sibuk) return;
    // Tiap penekanan mulai sesi baru dari baris pertama (upsert idempoten).
    setMode(modeJalan);
    setFase('jalan');
    setSibuk(true);
    setSesiId(null);
    setOffset(0);
    setRingkasan(null);
    setContoh([]);
    setGalatUnduh(false);
    batalRef.current = false;
    let sid: number | null = null;
    try {
      for (let i = 0; i < baris.length; i += POTONGAN) {
        if (batalRef.current) break;
        const potong = baris.slice(i, i + POTONGAN);
        const res = await potongImportRiwayat({
          ...(sid === null ? { mode: modeJalan, total: baris.length } : { sesi_id: sid, mode: modeJalan }),
          baris: potong,
          ...(i + POTONGAN >= baris.length ? { terakhir: true } : {}),
          ...(buatAnggota ? { buat_keanggotaan: true } : {}),
        });
        sid = res.sesi_id;
        setSesiId(sid);
        setOffset(res.offset);
        setRingkasan(res.ringkasan);
        setContoh(res.galat_contoh);
        setGalatUnduh(res.galat_unduh);
        if (res.selesai) break;
      }
      if (batalRef.current && sid !== null) {
        await batalPotongImport(sid).catch(() => {});
        toast('Import dibatalkan.');
      } else {
        toast.success(modeJalan === 'periksa' ? 'Periksa bertahap selesai.' : 'Import bertahap selesai.');
        if (modeJalan === 'eksekusi') onSelesai();
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSibuk(false);
      setFase('selesai');
    }
  }

  const persen = baris.length === 0 ? 0 : Math.round((offset / baris.length) * 100);
  const bersih = ringkasan !== null && ringkasan.baris_gagal === 0 && offset >= baris.length && baris.length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && sibuk) return; onOpenChange(o); }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import riwayat bertahap</DialogTitle>
          <DialogDescription>
            Untuk file besar (puluhan hingga ratusan ribu baris). File dibaca di browser lalu
            dikirim 1000 baris per panggilan dengan progres — backend tetap ringan.
            Kunci: NIS lokal + lembaga; baris cocok diperbarui, hanya kolom terisi.
            Centang di bawah untuk mengisi keanggotaan + riwayat sekaligus.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Template kosong</p>
              <p className="text-xs text-muted-foreground">Mulai dari nol.</p>
            </div>
            <Button id="btn_unduh_template_riwayat" type="button" variant="link" className="h-auto shrink-0 justify-start px-0"
              onClick={() => void unduhTemplateRiwayatBelajar().catch((e) => toast.error(errorMessage(e)))}>
              <Download data-icon="inline-start" size={16} /> Unduh template Excel
            </Button>
          </div>
          <DataExistingCard
            aktif={open}
            id="btn_unduh_data_riwayat"
            labelTombol="Unduh data"
            ambil={dataRiwayatBelajarExisting}
            namaBerkas="data-riwayat-belajar-existing.xlsx"
            judulSheet="Data Riwayat Belajar"
          />
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Import bertahap</p>
          <p className="text-xs text-muted-foreground">1000 baris per panggilan — ringan untuk ribuan baris.</p>
          <label htmlFor="check_import_riwayat_buat_keanggotaan" className="inline-flex cursor-pointer items-center gap-2 text-xs">
            <Checkbox
              id="check_import_riwayat_buat_keanggotaan"
              className="size-3.5"
              checked={buatAnggota}
              onCheckedChange={(v) => setBuatAnggota(v === true)}
            />
            Buatkan keanggotaan bila santri belum punya (cocok via santri_id / nama unik bila NIS tak terdaftar)
          </label>
          <Input id="input_file_import_bertahap" type="file" accept=".xlsx,.xls,.csv"
            className="h-11 cursor-pointer py-2 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-medium"
            disabled={sibuk} onChange={(e) => void pilihFile(e.target.files?.[0] ?? null)} />
          {fase !== 'pilih' && (
            <p className="text-xs text-muted-foreground">
              {namaFile} · {baris.length.toLocaleString('id-ID')} baris data
            </p>
          )}
          {(fase === 'jalan' || fase === 'selesai') && baris.length > 0 && (
            <div className="w-full" id="progres_import_bertahap">
              <div className="h-2 w-full overflow-hidden rounded bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${persen}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {offset.toLocaleString('id-ID')} / {baris.length.toLocaleString('id-ID')} ({persen}%) ·{' '}
                {ringkasan ? `${ringkasan.dibuat} dibuat · ${ringkasan.diperbarui} diperbarui · ${ringkasan.baris_gagal} gagal` : '…'}
              </p>
            </div>
          )}
          {ringkasan && ringkasan.baris_gagal > 0 && (
            <div className="rounded-md border p-3 text-xs" id="hasil_import_bertahap">
              <p className="font-medium">{ringkasan.baris_gagal.toLocaleString('id-ID')} baris bermasalah{mode === 'eksekusi' ? ' (dilewati)' : ''}:</p>
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-destructive">
                {contoh.map((x, i) => (
                  <li key={`${x.baris}-${x.kolom}-${i}`}>
                    Baris {x.baris}{x.nis_lokal ? ` (${x.nis_lokal})` : ''} ({x.kolom}): {x.pesan}
                  </li>
                ))}
              </ul>
              {galatUnduh && sesiId !== null && (
                <Button id="btn_unduh_galat_bertahap" type="button" variant="link" className="h-auto px-0"
                  onClick={() => void unduhGalatPotong(sesiId).catch((e) => toast.error(errorMessage(e)))}>
                  <Download data-icon="inline-start" size={16} /> Unduh CSV semua galat
                </Button>
              )}
            </div>
          )}
          {fase === 'selesai' && bersih && (
            <p className="text-xs text-emerald-600" id="hasil_import_bertahap">
              {mode === 'periksa' ? 'Tidak ada masalah — siap diimport.' : 'Import selesai tanpa galat.'}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button id="btn_mulai_periksa_bertahap" type="button" variant="outline"
              disabled={sibuk || baris.length === 0 || fase === 'jalan'}
              onClick={() => void jalan('periksa')}>Periksa</Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button id="btn_mulai_import_bertahap" type="button"
                  disabled={sibuk || !bersih || mode !== 'periksa'}
                  onClick={() => void jalan('eksekusi')}>Import</Button>
              </TooltipTrigger>
              <TooltipContent><p>{bersih ? 'Jalankan import setelah periksa bersih' : 'Periksa dulu hingga bersih'}</p></TooltipContent>
            </Tooltip>
          </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={sibuk}
            onClick={() => { if (fase !== 'jalan') { reset(); onOpenChange(false); } }}>
            {fase === 'jalan' ? 'Batalkan' : 'Tutup'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
