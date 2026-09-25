import { useRef, useState, type ReactNode } from 'react';
import { errorMessage } from '../api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download } from '@/icons';
import { toast } from 'sonner';
import DataExistingCard from '@/components/DataExistingCard';

/** Maks baris per panggilan (disamakan batas backend `baris.max:1000`). */
export const POTONGAN_IMPORT = 1000;

/** Kontrak respons bersama endpoint import-potong (santri/riwayat + fitur lain). */
export interface PotongRingkasan {
  baris_diproses: number;
  baris_valid: number;
  baris_gagal: number;
  baris_dilewati: number;
  dibuat: number;
  diperbarui: number;
}

export interface PotongGalat {
  baris: number;
  nis_lokal: string | null;
  kolom: string;
  pesan: string;
}

export interface PotongHasil {
  sesi_id: number;
  offset: number;
  total: number;
  selesai: boolean;
  ringkasan: PotongRingkasan;
  galat_baru: number;
  galat_contoh: PotongGalat[];
  galat_unduh: boolean;
}

/** Konteks tetap per sesi (PSB: gelombang + lembaga tujuan). */
export type KonteksSesi = Record<string, string | number>;

export type KirimPotongan = (input: {
  sesi_id?: number;
  mode: 'periksa' | 'eksekusi';
  /** Jumlah seluruh baris file; hanya bermakna pada panggilan pertama. */
  total: number;
  konteks: KonteksSesi;
  baris: Record<string, unknown>[];
  terakhir?: boolean;
}) => Promise<PotongHasil>;

export interface KonfigurasiImportBertahap {
  /** Judul dialog ( Bahasa Indonesia). */
  judul: string;
  /** Penjelasan singkat di bawah judul. */
  deskripsi: ReactNode;
  /** `id` elemen unik per dialog (NFR-05: snake_case). */
  idPrefix: string;
  /** Kolom template yang dikirim; kunci lain dari file diabaikan. */
  kolom: string[];
  /** Satu dari `kolom` yang wajib ada di header file. */
  wajib: string[];
  /** Label tombol unduh template + aksi unduh. */
  labelTemplate: string;
  unduhTemplate: () => Promise<unknown>;
  /** Unduh data existing (kolom identik template) bila tersedia; pilihan
   *  lembaga diteruskan sebagai argumen (tanpa argumen = seluruh lingkup). */
  unduhData?: { label: string; jalankan: (jenjangs?: string[]) => Promise<unknown> };
  /** Kirim satu potongan; `sesi_id` hanya pada panggilan lanjutan. */
  kirim: KirimPotongan;
  /** Batalkan sesi milik sendiri. */
  batal: (sesiId: number) => Promise<unknown>;
  /** Unduh CSV galat sesi milik sendiri. */
  unduhGalat: (sesiId: number) => Promise<unknown>;
  /** Konteks tetap sesi; `null` = tanpa konteks tambahan. */
  konteks?: () => KonteksSesi;
  /**
   * Override `id` tombol agar halaman bisa mempertahankan `id` lamanya
   * (NFR-05). Kosong = pola staged `btn_mulai_*` + `idPrefix`.
   */
  idTombol?: { template?: string; periksa?: string; mulai?: string; unduhGalat?: string };
  /** Elemen tambahan di atas input file (mis. select gelombang/lembaga). */
  children?: ReactNode;
  /** Nonaktifkan tombol selama konteks belum lengkap. */
  konteksSiap?: boolean;
  /** Dipanggil setelah eksekusi selesai sukses. */
  onSelesai: () => void;
}

type Fase = 'pilih' | 'siap' | 'jalan' | 'selesai';

/**
 * Dialog import bertahap generik: browser membaca XLSX/XLS/CSV (SheetJS,
 * lazy-load) lalu mengirim potongan JSON tepat 1000 baris per panggilan
 * dengan progres. Alur `periksa` (kering, tak menulis) → `eksekusi`.
 * Backend tidak pernah menyentuh file — ringan untuk file besar.
 *
 * Semua fitur bermigrasi ke sini lewat `KonfigurasiImportBertahap`, sehingga
 * label/`id` per halaman tetap bisa dipertahankan lewat `idPrefix`.
 */
export default function ImportBertahapUmumDialog({ open, onOpenChange, config }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  config: KonfigurasiImportBertahap;
}) {
  const [namaFile, setNamaFile] = useState('');
  const [baris, setBaris] = useState<Record<string, unknown>[]>([]);
  const [fase, setFase] = useState<Fase>('pilih');
  const [mode, setMode] = useState<'periksa' | 'eksekusi'>('periksa');
  const [sesiId, setSesiId] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [ringkasan, setRingkasan] = useState<PotongRingkasan | null>(null);
  const [contoh, setContoh] = useState<PotongGalat[]>([]);
  const [galatUnduh, setGalatUnduh] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const batalRef = useRef(false);

  const { idPrefix, idTombol } = config;
  const idTemplate = idTombol?.template ?? `btn_unduh_template_${idPrefix}`;
  const idPeriksa = idTombol?.periksa ?? `btn_mulai_periksa_${idPrefix}`;
  const idMulai = idTombol?.mulai ?? `btn_mulai_import_${idPrefix}`;
  const idUnduhGalat = idTombol?.unduhGalat ?? `btn_unduh_galat_${idPrefix}`;

  function bersihkanTampilan() {
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
    bersihkanTampilan();
    if (!f) return;
    setNamaFile(f.name);
    setSibuk(true);
    try {
      const XLSX = await import('xlsx');
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const matriks = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, blankrows: false }) as unknown[][];
      if (matriks.length < 1) {
        toast.error('File kosong.');
        return;
      }
      const kepala = (matriks[0] as unknown[]).map((h) => String(h ?? '').trim().toLowerCase());
      const hilang = config.wajib.filter((k) => !kepala.includes(k));
      if (hilang.length > 0) {
        toast.error(`Kolom wajib tidak ada: ${hilang.join(', ')}.`);
        return;
      }
      const data: Record<string, unknown>[] = [];
      for (const r of matriks.slice(1) as unknown[][]) {
        const o: Record<string, unknown> = {};
        kepala.forEach((k, i) => {
          if (config.kolom.includes(k)) o[k] = r[i] ?? null;
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
    const konteks = config.konteks?.() ?? {};
    try {
      for (let i = 0; i < baris.length; i += POTONGAN_IMPORT) {
        if (batalRef.current) break;
        const potong = baris.slice(i, i + POTONGAN_IMPORT);
        const res = await config.kirim({
          ...(sid === null ? { mode: modeJalan } : { sesi_id: sid, mode: modeJalan }),
          total: baris.length,
          konteks,
          baris: potong,
          ...(i + POTONGAN_IMPORT >= baris.length ? { terakhir: true } : {}),
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
        await config.batal(sid).catch(() => {});
        toast('Import dibatalkan.');
      } else {
        toast.success(modeJalan === 'periksa' ? 'Periksa bertahap selesai.' : 'Import bertahap selesai.');
        if (modeJalan === 'eksekusi') config.onSelesai();
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
  const konteksSiap = config.konteksSiap !== false;
  const bisaMulai = baris.length > 0 && konteksSiap;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && sibuk) return; onOpenChange(o); }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{config.judul}</DialogTitle>
          <DialogDescription>{config.deskripsi}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Template kosong</p>
              <p className="text-xs text-muted-foreground">Mulai dari nol.</p>
            </div>
            <Button id={idTemplate} type="button" variant="link" className="h-auto shrink-0 justify-start px-0"
              onClick={() => void config.unduhTemplate().catch((e) => toast.error(errorMessage(e)))}>
              <Download data-icon="inline-start" size={16} /> {config.labelTemplate}
            </Button>
          </div>
          {config.unduhData && (
            <DataExistingCard
              aktif={open}
              id={`btn_unduh_data_${idPrefix}`}
              labelTombol={config.unduhData.label}
              unduh={config.unduhData.jalankan}
            />
          )}
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Import bertahap</p>
          <p className="text-xs text-muted-foreground">1000 baris per panggilan — ringan untuk ribuan baris.</p>
          {config.children}
          <Input id={`input_file_import_${idPrefix}`} type="file" accept=".xlsx,.xls,.csv"
            className="h-11 cursor-pointer py-2 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-medium"
            disabled={sibuk} onChange={(e) => void pilihFile(e.target.files?.[0] ?? null)} />
          {fase !== 'pilih' && (
            <p className="text-sm text-muted-foreground">
              {namaFile} · {baris.length.toLocaleString('id-ID')} baris data
            </p>
          )}
          {(fase === 'jalan' || fase === 'selesai') && baris.length > 0 && (
            <div className="w-full" id={`progres_import_${idPrefix}`}>
              <div className="h-2 w-full overflow-hidden rounded bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${persen}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {offset.toLocaleString('id-ID')} / {baris.length.toLocaleString('id-ID')} ({persen}%) ·{' '}
                {ringkasan
                  ? `${ringkasan.dibuat} dibuat · ${ringkasan.diperbarui} diperbarui · ${ringkasan.baris_dilewati} dilewati · ${ringkasan.baris_gagal} gagal`
                  : '…'}
              </p>
            </div>
          )}
          {ringkasan && ringkasan.baris_gagal > 0 && (
            <div className="rounded-md border p-3 text-sm" id={`hasil_import_${idPrefix}`}>
              <p className="font-medium">
                {ringkasan.baris_gagal.toLocaleString('id-ID')} baris bermasalah{mode === 'eksekusi' ? ' (dilewati)' : ''}:
              </p>
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-destructive">
                {contoh.map((x, i) => (
                  <li key={`${x.baris}-${x.kolom}-${i}`}>
                    Baris {x.baris}{x.nis_lokal ? ` (${x.nis_lokal})` : ''} ({x.kolom}): {x.pesan}
                  </li>
                ))}
              </ul>
              {galatUnduh && sesiId !== null && (
                <Button id={idUnduhGalat} type="button" variant="link" className="h-auto px-0"
                  onClick={() => void config.unduhGalat(sesiId).catch((e) => toast.error(errorMessage(e)))}>
                  <Download data-icon="inline-start" size={16} /> Unduh CSV semua galat
                </Button>
              )}
            </div>
          )}
          {fase === 'selesai' && bersih && (
            <p className="text-sm text-emerald-600" id={`hasil_import_${idPrefix}`}>
              {mode === 'periksa' ? 'Tidak ada masalah — siap diimport.' : 'Import selesai tanpa galat.'}
            </p>
          )}
          <div className="flex justify-end gap-2">
            {fase === 'jalan' ? (
              <Button type="button" variant="outline" onClick={() => { batalRef.current = true; }}>
                Batalkan
              </Button>
            ) : null}
            <Button id={idPeriksa} type="button" variant="outline"
              disabled={sibuk || !bisaMulai || fase === 'jalan'}
              title={konteksSiap ? undefined : 'Lengkapi pilihan di atas dulu'}
              onClick={() => void jalan('periksa')}>Periksa</Button>
            <Button id={idMulai} type="button"
              disabled={sibuk || !bersih || mode !== 'periksa'}
              title={bersih ? 'Jalankan import setelah periksa bersih' : 'Periksa dulu hingga bersih'}
              onClick={() => void jalan('eksekusi')}>Import</Button>
          </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={sibuk}
            onClick={() => { bersihkanTampilan(); onOpenChange(false); }}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
