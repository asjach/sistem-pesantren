import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { History, Pencil, Trash2 } from '@/icons';
import { cn } from '@/lib/utils';

export interface TagihanAktif {
  id: number;
  nama: string;
  label: string;
  nominal: number;
  sisa: number;
  status: 'belum' | 'sebagian' | 'lunas';
  /** Sudah lewat jatuh tempo (kunci warna badge & tunggakan). */
  terlambat: boolean;
  /** Tanggal jatuh tempo 'YYYY-MM-DD' atau null (tanpa batas). */
  jatuhTempo: string | null;
  tipe: 'bulanan' | 'non_bulanan';
}

export interface DataBayar {
  jumlah: number;
  metode: 'tunai' | 'transfer';
  kas: 'tunai_tu' | 'bank_lembaga' | 'bank_pesantren';
}

interface Props {
  tagihan: TagihanAktif | null;
  /** Elemen sel asal — jangkar popover. null = tertutup. */
  anchor: HTMLElement | null;
  onTutup: () => void;
  onBayar: (data: DataBayar) => Promise<void>;
  onUbah: () => void;
  onRiwayat: () => void;
  onHapus: () => void;
}

const METODE: { value: DataBayar['metode']; label: string }[] = [
  { value: 'tunai', label: 'Tunai' },
  { value: 'transfer', label: 'Transfer' },
];

const KAS: { value: DataBayar['kas']; label: string }[] = [
  { value: 'tunai_tu', label: 'Tunai TU' },
  { value: 'bank_lembaga', label: 'Bank Lembaga' },
  { value: 'bank_pesantren', label: 'Bank Pesantren' },
];

/** Badge status: lunas / tunggakan (lewat jatuh tempo) / belum jatuh tempo. */
function badge(t: TagihanAktif): { teks: string; kelas: string } {
  if (t.status === 'lunas') {
    return { teks: 'Lunas', kelas: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' };
  }
  if (t.terlambat) {
    return { teks: 'Tunggakan', kelas: 'bg-destructive/12 text-destructive' };
  }
  return { teks: 'Belum jatuh tempo', kelas: 'bg-muted text-muted-foreground' };
}

/** "10 Agu 2026" untuk label jatuh tempo ringkas. */
function tanggalPanjang(iso: string): string {
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const [y, b, h] = iso.split('-');
  return `${h} ${bulan[Number(b) - 1] ?? b} ${y}`;
}

/**
 * Popover aksi sel tagihan: ringkasan, pembayaran, dan aksi lain.
 *
 * Diletakkan sebagai komponen sendiri (bukan inline di halaman) agar state
 * pembayaran (jumlah/metode/kas) ikut terisolasi dan bisa diuji sendiri.
 */
export default function PopoverAksiTagihan({
  tagihan, anchor, onTutup, onBayar, onUbah, onRiwayat, onHapus,
}: Props) {
  const [teksJumlah, setTeksJumlah] = useState('');
  const [metode, setMetode] = useState<DataBayar['metode']>('tunai');
  const [kas, setKas] = useState<DataBayar['kas']>('tunai_tu');
  const [busy, setBusy] = useState(false);

  const terbuka = anchor !== null && tagihan !== null;

  // Sel baru → isi ulang form; jumlah defaultnya sisa tagihan (cases paling
  // umum adalah membayar penuh, dan nilainya masih bisa dikoreksi).
  useEffect(() => {
    if (tagihan === null) return;
    setTeksJumlah(tagihan.sisa > 0 ? String(tagihan.sisa) : '');
    setMetode('tunai');
    setKas('tunai_tu');
  }, [tagihan]);

  if (tagihan === null || anchor === null) return null;

  const sisa = tagihan.sisa;
  const lunas = tagihan.status === 'lunas' || sisa <= 0;
  const jumlahAngka = Number(teksJumlah);
  const jumlahValid = teksJumlah !== ''
    && Number.isInteger(jumlahAngka)
    && jumlahAngka >= 1
    && jumlahAngka <= sisa;
  const jumlahSalah = teksJumlah !== '' && !jumlahValid;
  const b = badge(tagihan);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jumlahValid || busy) return;
    setBusy(true);
    try {
      await onBayar({ jumlah: jumlahAngka, metode, kas });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover
      open={terbuka}
      onOpenChange={(o) => { if (!o) onTutup(); }}
    >
      {/* Jangkar virtual: satu popover untuk seluruh tabel, bukan per sel. */}
      <PopoverAnchor
        virtualRef={{
          current: { getBoundingClientRect: () => anchor.getBoundingClientRect() },
        }}
      />
      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={12}
        className="w-80 p-0"
      >
        {/* Ringkasan tagihan */}
        <div className="border-b px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">{tagihan.label}</p>
              <p className="truncate text-sm font-medium">{tagihan.nama}</p>
            </div>
            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', b.kelas)}>
              {b.teks}
            </span>
          </div>
          <p className="mt-1.5 text-xs tabular-nums">
            sisa{' '}
            <b className={cn('text-sm', lunas ? 'text-emerald-700 dark:text-emerald-300' : 'text-destructive')}>
              Rp {sisa.toLocaleString('id')}
            </b>
            <span className="text-muted-foreground"> dari Rp {tagihan.nominal.toLocaleString('id')}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {tagihan.jatuhTempo === null
              ? 'Tanpa batas jatuh tempo'
              : `Jatuh tempo ${tanggalPanjang(tagihan.jatuhTempo)}`}
          </p>
        </div>

        {/* Pembayaran — disembunyikan bila sudah lunas agar tidak Offering
            aksi yang pasti gagal. */}
        {!lunas && (
          <form id="form_bayar_sel" onSubmit={(e) => void submit(e)} className="border-b px-3 py-2.5">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Bayar</p>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">Rp</span>
              <Input
                /* autoFocus (bukan ref): komponen Input tidak forwardRef. */
                autoFocus
                id="inp_bayar_jumlah"
                type="number"
                inputMode="numeric"
                min={1}
                max={sisa}
                value={teksJumlah}
                onChange={(e) => setTeksJumlah(e.target.value)}
                aria-label="Jumlah pembayaran"
                aria-invalid={jumlahSalah}
                className={cn('h-8 tabular-nums', jumlahSalah && 'border-destructive')}
              />
              <Button
                id="btn_bayar_penuh"
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                disabled={sisa <= 0}
                onClick={() => setTeksJumlah(String(sisa))}
              >
                Penuh
              </Button>
            </div>
            {jumlahSalah && (
              <p id="galat_bayar_jumlah" className="mt-1 text-[11px] text-destructive">
                Isi Rp 1 sampai Rp {sisa.toLocaleString('id')} (sisa tagihan).
              </p>
            )}
            <div className="mt-2 flex items-center gap-1.5">
              <select
                id="sel_bayar_metode"
                aria-label="Metode pembayaran"
                className="h-8 flex-1 rounded-md border bg-transparent px-2 text-xs"
                value={metode}
                onChange={(e) => setMetode(e.target.value as DataBayar['metode'])}
              >
                {METODE.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <select
                id="sel_bayar_kas"
                aria-label="Kas tujuan"
                className="h-8 flex-1 rounded-md border bg-transparent px-2 text-xs"
                value={kas}
                onChange={(e) => setKas(e.target.value as DataBayar['kas'])}
              >
                {KAS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
              <Button id="btn_bayar_simpan" type="submit" size="sm" className="h-8" disabled={!jumlahValid || busy}>
                {busy ? '…' : 'Bayar'}
              </Button>
            </div>
          </form>
        )}

        {/* Aksi lain */}
        <div className="flex flex-col p-1">
          <MenuItem id="btn_ubah_tagihan" icon={<Pencil size={14} />} onClick={onUbah}>Ubah tagihan</MenuItem>
          <MenuItem id="btn_riwayat_bayar" icon={<History size={14} />} onClick={onRiwayat}>Lihat riwayat pembayaran</MenuItem>
          <MenuItem id="btn_hapus_tagihan" icon={<Trash2 size={14} />} onClick={onHapus} destructive>Hapus tagihan</MenuItem>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Baris menu: ikon + label, tinggi seragam, hover penuh lebar. */
function MenuItem({
  id, icon, children, onClick, destructive = false,
}: {
  id: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <Button
      id={id}
      type="button"
      size="sm"
      variant="ghost"
      className={cn(
        'h-8 w-full justify-start gap-2 px-2 text-xs font-normal',
        destructive && 'text-destructive hover:bg-destructive/10 hover:text-destructive',
      )}
      onClick={onClick}
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      {children}
    </Button>
  );
}