import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '../../api/client';
import {
  buatDispensasi, ubahDispensasi,
  type Dispensasi, type DispensasiInput, type JenisTagihan, type TipeDispensasi,
} from '../../api/keuangan';
import { type TahunAjaran } from '../../api/master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { ActionIcon } from '@/components/RowActions';
import { Info, Loader2, Plus, Save, X } from '@/icons';

interface BarisAturan {
  jenisId: number;
  tipe: TipeDispensasi;
  nilai: string;
}

const FIELDS_ATURAN: ExcelField[] = [
  { key: 'jenis', label: 'Jenis Tagihan', kind: 'static' },
  {
    key: 'tipe', label: 'Tipe', kind: 'select', width: 130,
    choices: [
      { value: 'nominal', label: 'Nominal (Rp)' },
      { value: 'persen', label: 'Persen (%)' },
      { value: 'bebas', label: 'Bebas penuh' },
    ],
  },
  {
    key: 'nilai', label: 'Nilai', kind: 'text', width: 110,
    validate: (v) => v !== null && /^\d+$/.test(v) ? null : 'Isi angka ≥ 0.',
  },
];

/**
 * Daftar penerima yang dikirim saat simpan.
 *
 * Dialog ini TIDAK lagi mengelola penerima (dipindah ke halaman Dispensasi,
 * kolom Daftar Penerima), jadi dua hal wajib dijaga:
 * - mode UBAH: pakai daftar yang sudah ada apa adanya. Mengirim `null` berarti
 *   backend `sync([])` → SELURUH penerima paket terhapus;
 * - mode TAMBAH dari profil santri (`santriAwal`): santri itu jadi penerima
 *   pertama, karena dialah alasan dialog dibuka.
 */
export function santriIdsUntuk(
  editing: Dispensasi | null,
  santriAwal: { id: number } | null,
): number[] | null {
  if (editing) return editing.santri_ids ?? null;
  return santriAwal === null ? null : [santriAwal.id];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Dispensasi | null;
  jenis: JenisTagihan[];
  daftarTA: TahunAjaran[];
  /** Prefill santri penerima saat membuka dari profil santri (mode tambah). */
  santriAwal?: { id: number; nama_lengkap: string } | null;
  /** Prefill TA saat membuka dari halaman Keuangan (mengikuti filter topbar). */
  taBawaan?: string | null;
  onSaved: () => void | Promise<void>;
}

/** Form tambah/ubah dispensasi: identitas paket + N aturan potongan per jenis
 *  tagihan. Daftar penerima TIDAK diatur di sini — dikelola di halaman
 *  Dispensasi (kolom Daftar Penerima), jadi paket lama tidak kehilangan
 *  penerimanya saat diubah dari dialog. */
export default function DispensasiDialog({ open, onOpenChange, editing, jenis, daftarTA, santriAwal = null, taBawaan = null, onSaved }: Props) {
  const [nama, setNama] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [ta, setTa] = useState('');
  const [kuota, setKuota] = useState('');
  const [grup, setGrup] = useState('');
  const [aktif, setAktif] = useState(true);

  const [baris, setBaris] = useState<BarisAturan[]>([]);
  const [tambahJenisId, setTambahJenisId] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);

  // Buka dialog: isi dari data ubah atau kosongkan.
  useEffect(() => {
    if (!open) return;
    setTambahJenisId('');
    if (editing) {
      setNama(editing.nama); setKeterangan(editing.keterangan ?? ''); setTa(editing.tahun_ajaran);
      setKuota(editing.kuota_bulan === null ? '' : String(editing.kuota_bulan));
      setGrup(editing.grup ?? '');
      setAktif(editing.is_active);
      const aturan = editing.aturan ?? [];
      setBaris(aturan.filter((a) => a.jenis_id !== null).map((a) => ({ jenisId: a.jenis_id as number, tipe: a.tipe, nilai: String(a.nilai) })));
    } else {
      const bawaan = taBawaan !== null && daftarTA.some((x) => x.nama === taBawaan)
        ? taBawaan
        : (daftarTA.find((x) => x.is_aktif)?.nama ?? daftarTA[0]?.nama ?? '');
      setNama(''); setKeterangan(''); setTa(bawaan); setKuota(''); setGrup(''); setAktif(true);
      setBaris([]);
    }
  }, [open, editing, daftarTA, santriAwal, taBawaan]);

  const namaJenis = (id: number) => {
    const j = jenis.find((x) => x.id === id);
    return j ? `${j.nama}${j.jenjang ? ` (${j.jenjang})` : ''}` : `Jenis #${id}`;
  };

  const tambahBaris = () => {
    if (tambahJenisId === '' || baris.some((b) => b.jenisId === tambahJenisId)) return;
    setBaris((lama) => [...lama, { jenisId: tambahJenisId, tipe: 'nominal', nilai: '' }]);
    setTambahJenisId('');
  };

  const validasiNilai = (tipe: TipeDispensasi, teks: string): number | null => {
    const angka = Number(teks);
    if (!Number.isInteger(angka) || angka < 0) return null;
    if (tipe === 'persen' && angka > 100) return null;
    return angka;
  };

  const simpan = async () => {
    if (nama.trim() === '') { toast.error('Isi nama dispensasi.'); return; }
    if (ta === '') { toast.error('Pilih tahun ajaran.'); return; }
    if (kuota.trim() !== '') {
      const k = Number(kuota);
      if (!Number.isInteger(k) || k < 1 || k > 120) { toast.error('Kuota bulan diisi 1–120 atau dikosongkan.'); return; }
    }
    if (grup.trim().length > 50) { toast.error('Grup maksimal 50 karakter.'); return; }

    if (baris.length === 0) { toast.error('Pilih minimal satu jenis tagihan.'); return; }
    const aturan: { jenis_id: number | null; tipe: TipeDispensasi; nilai: number }[] = [];
    for (const b of baris) {
      const angka = validasiNilai(b.tipe, b.tipe === 'bebas' ? '0' : b.nilai);
      if (angka === null) { toast.error(`Nilai potongan ${namaJenis(b.jenisId)} tidak valid (persen maks 100).`); return; }
      aturan.push({ jenis_id: b.jenisId, tipe: b.tipe, nilai: angka });
    }

    const payload: DispensasiInput = {
      nama: nama.trim(),
      keterangan: keterangan.trim() === '' ? null : keterangan.trim(),
      tahun_ajaran: ta,
      kuota_bulan: kuota.trim() === '' ? null : Number(kuota),
      grup: grup.trim() === '' ? null : grup.trim(),
      aturan,
      santri_ids: santriIdsUntuk(editing, santriAwal),
      is_active: aktif,
    };

    setBusy(true);
    try {
      if (editing) await ubahDispensasi(editing.id, payload);
      else await buatDispensasi(payload);
      toast.success(editing ? 'Dispensasi tersimpan.' : 'Dispensasi dibuat.');
      onOpenChange(false);
      await onSaved();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const sisaJenis = jenis.filter((j) => !baris.some((b) => b.jenisId === j.id));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }}
        className="flex h-[calc(100dvh-3rem)] max-h-[calc(100dvh-3rem)] w-[calc(100vw-3rem)] max-w-none flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-none"
      >
        <DialogHeader className="flex-row items-center justify-between gap-3 border-b px-3 py-2.5">
          <div className="min-w-0">
            <DialogTitle>{editing ? 'Ubah Dispensasi' : 'Tambah Dispensasi'}</DialogTitle>
            <DialogDescription className="mt-0.5">
              Keringanan tagihan per jenis. Daftar penerima diatur di halaman Dispensasi (kolom Daftar Penerima).
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label="Tutup" id="btn_dispensasi_tutup"><X size={14} /></Button>
          </DialogClose>
        </DialogHeader>

        {/* Identitas dispensasi: nama, tahun ajaran, kuota, grup, keterangan,
            status aktif. */}
        <div className="flex shrink-0 flex-wrap items-end gap-3 border-b bg-muted/30 px-3 py-2.5">
          <div className="flex min-w-52 flex-1 flex-col gap-1">
            <FieldLabel htmlFor="inp_dispensasi_nama">Nama Dispensasi</FieldLabel>
            <Input id="inp_dispensasi_nama" className="h-[26px]" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="mis. Anak Pegawai" />
          </div>
          <div className="flex w-52 flex-col gap-1">
            <FieldLabel htmlFor="sel_dispensasi_ta">Tahun Ajaran</FieldLabel>
            <Select value={ta} onValueChange={setTa}>
              <SelectTrigger id="sel_dispensasi_ta" className="h-[26px] w-full" aria-label="Tahun ajaran">
                <SelectValue placeholder="Pilih tahun ajaran" />
              </SelectTrigger>
              <SelectContent>
                {daftarTA.map((x) => (
                  <SelectItem key={x.nama} value={x.nama}>{x.nama}{x.is_aktif ? ' (aktif)' : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-28 flex-col gap-1">
            <FieldLabel htmlFor="inp_dispensasi_kuota">
              Kuota Bln <span className="font-normal text-muted-foreground">(opsional)</span>
            </FieldLabel>
            <Input id="inp_dispensasi_kuota" type="number" min={1} max={120} className="h-[26px]" value={kuota} onChange={(e) => setKuota(e.target.value)} placeholder="mis. 6" />
          </div>
          <div className="flex w-32 flex-col gap-1">
            <FieldLabel htmlFor="inp_dispensasi_grup">
              Grup <span className="font-normal text-muted-foreground">(opsional)</span>
            </FieldLabel>
            <Input id="inp_dispensasi_grup" className="h-[26px]" value={grup} onChange={(e) => setGrup(e.target.value)} placeholder="mis. prestasi" />
          </div>
          <div className="flex min-w-52 flex-1 flex-col gap-1">
            <FieldLabel htmlFor="inp_dispensasi_keterangan">
              Keterangan <span className="font-normal text-muted-foreground">(opsional)</span>
            </FieldLabel>
            <Input id="inp_dispensasi_keterangan" className="h-[26px]" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="Catatan tambahan…" />
          </div>
          <div className="flex h-[26px] items-center gap-2 rounded-md border bg-background px-2.5">
            <Switch id="chk_dispensasi_aktif" size="sm" checked={aktif} onCheckedChange={setAktif} aria-label="Status aktif dispensasi" />
            <label htmlFor="chk_dispensasi_aktif" className="cursor-pointer text-xs select-none">Aktif</label>
          </div>
        </div>

        {/* Aturan potongan per jenis tagihan. */}
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
            <FieldLabel htmlFor="sel_dispensasi_tambah_jenis" className="shrink-0">Jenis Tagihan</FieldLabel>
            <div className="min-w-64 flex-1 sm:max-w-80">
              <Select
                value={tambahJenisId === '' ? '' : String(tambahJenisId)}
                onValueChange={(v) => setTambahJenisId(v === '' ? '' : Number(v))}
              >
                <SelectTrigger id="sel_dispensasi_tambah_jenis" className="h-[26px] w-full" disabled={sisaJenis.length === 0} aria-label="Jenis tagihan untuk aturan baru">
                  <SelectValue placeholder={sisaJenis.length === 0 ? 'Semua jenis sudah diatur' : 'Pilih jenis tagihan…'} />
                </SelectTrigger>
                <SelectContent>
                  {sisaJenis.map((j) => (
                    <SelectItem key={j.id} value={String(j.id)}>{j.nama}{j.jenjang ? ` (${j.jenjang})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" size="sm" variant="outline" id="btn_dispensasi_tambah_aturan" className="h-[26px] gap-1.5 px-2.5" onClick={tambahBaris} disabled={tambahJenisId === ''}>
              <Plus data-icon="inline-start" size={14} /> Tambah
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <ExcelTable<BarisAturan & { id: number }>
              tableKey="dispensasi_aturan"
              fields={FIELDS_ATURAN}
              rows={baris.map((b) => ({ ...b, id: b.jenisId }))}
              getValues={(r) => ({ jenis: namaJenis(r.jenisId), tipe: r.tipe, nilai: r.nilai })}
              emptyText="Belum ada aturan jenis."
              canEdit
              onCommit={async (id, fields) => {
                setBaris((lama) => lama.map((x) => x.jenisId === id
                  ? {
                    ...x,
                    tipe: (fields.tipe as TipeDispensasi | null) ?? x.tipe,
                    nilai: fields.nilai ?? x.nilai,
                  }
                  : x));
              }}
              onSaved={() => {}}
              aksiLangsung
              hideCheckbox
              renderActions={(r) => (
                <ActionIcon id={`btn_dispensasi_hapus_aturan_${r.jenisId}`} title={`Hapus ${namaJenis(r.jenisId)}`} onClick={() => setBaris((lama) => lama.filter((x) => x.jenisId !== r.jenisId))}>
                  <X size={16} />
                </ActionIcon>
              )}
            />
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 border-t px-3 py-2.5 sm:justify-between">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info size={13} className="shrink-0" />
            <span>
              {baris.length > 0 ? `${baris.length} aturan jenis` : 'Belum ada aturan jenis'}
              {' · '}
              {editing
                ? `${(editing.santri_ids ?? []).length} penerima (diatur di halaman Dispensasi)`
                : santriAwal === null
                  ? 'penerima diatur di halaman Dispensasi'
                  : `penerima awal ${santriAwal.nama_lengkap}`}
              {' · bebas penuh → tagihan bernominal 0.'}
            </span>
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Batal</Button>
            <Button id="btn_dispensasi_simpan" type="button" className="gap-1.5" disabled={busy} onClick={() => void simpan()}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {busy ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
