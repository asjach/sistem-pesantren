import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Dispensasi } from '@/api/keuangan';

export type AksiBatch = 'bayar' | 'hapus_tagihan' | 'hapus_riwayat' | 'ubah';

type Metode = 'tunai' | 'transfer';
type Kas = 'tunai_tu' | 'bank_lembaga' | 'bank_pesantren';

/** Opsi metode & kas (sama dengan popover aksi tunggal). */
const METODE: { value: Metode; label: string }[] = [
  { value: 'tunai', label: 'Tunai' },
  { value: 'transfer', label: 'Transfer' },
];

const KAS_PER_METODE: Record<Metode, { value: Kas; label: string }[]> = {
  tunai: [{ value: 'tunai_tu', label: 'Kas TU' }],
  transfer: [
    { value: 'bank_pesantren', label: 'Bank Pesantren' },
    { value: 'bank_lembaga', label: 'Bank Jenjang' },
  ],
};

/** Dialog konfirmasi aksi sekaligus untuk banyak tagihan terpilih (klik kiri).
 *  Empat aksi: bayar lunas, ubah (jatuh tempo + dispensasi), hapus tagihan,
 *  hapus riwayat pembayaran. State form ditahan halaman (KeuanganPage). */
export default function BatchAksiTagihan({
  aksi, jumlah, totalSisa, busy,
  metode, kas, onMetode, onKas,
  pakaiJatuhTempo, jatuhTempo, onPakaiJatuhTempo, onJatuhTempo,
  dispen, onDispen, daftarDispen,
  onBatal, onKonfirmasi,
}: {
  aksi: AksiBatch | null;
  jumlah: number;
  /** Total sisa tagihan yang masih bisa dibayar (untuk aksi bayar). */
  totalSisa: number;
  busy: boolean;
  metode: Metode;
  kas: Kas;
  onMetode: (v: Metode) => void;
  onKas: (v: Kas) => void;
  pakaiJatuhTempo: boolean;
  jatuhTempo: string;
  onPakaiJatuhTempo: (v: boolean) => void;
  onJatuhTempo: (v: string) => void;
  /** '' = tanpa perubahan, 'tanpa' = lepas dispensasi, number = id paket. */
  dispen: number | 'tanpa' | '';
  onDispen: (v: number | 'tanpa' | '') => void;
  daftarDispen: Dispensasi[];
  onBatal: () => void;
  onKonfirmasi: () => void;
}) {
  const terbuka = aksi !== null;

  const judul =
    aksi === 'bayar' ? `Bayar ${jumlah} tagihan?`
    : aksi === 'ubah' ? `Ubah ${jumlah} tagihan?`
    : aksi === 'hapus_tagihan' ? `Hapus ${jumlah} tagihan?`
    : aksi === 'hapus_riwayat' ? `Hapus riwayat ${jumlah} tagihan?`
    : '';
  const deskripsi =
    aksi === 'bayar'
      ? `Sisa tiap tagihan akan dicatat lunas (total Rp ${totalSisa.toLocaleString('id')}). Pilih metode & kas tujuan di bawah.`
    : aksi === 'ubah'
      ? `Terapkan perubahan ke ${jumlah} tagihan terpilih. Field yang tak diubah dibiarkan tetap.`
    : aksi === 'hapus_tagihan'
      ? 'Tagihan terpilih dihapus permanen beserta pembayarannya. Tindakan tidak bisa dibatalkan.'
    : aksi === 'hapus_riwayat'
      ? 'Seluruh baris riwayat pembayaran pada tagihan terpilih dihapus permanen. Tindakan tidak bisa dibatalkan.'
    : '';
  const labelAksi =
    aksi === 'bayar' ? 'Bayar' : aksi === 'ubah' ? 'Ubah' : aksi === 'hapus_tagihan' ? 'Hapus Tagihan' : 'Hapus Riwayat';

  return (
    <AlertDialog open={terbuka} onOpenChange={(o) => { if (!o) onBatal(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{judul}</AlertDialogTitle>
          <AlertDialogDescription>{deskripsi}</AlertDialogDescription>
        </AlertDialogHeader>

        {aksi === 'bayar' && (
          <div className="grid grid-cols-[5rem_1fr] items-center gap-x-2 gap-y-1.5">
            <FieldLabel htmlFor="sel_batch_metode" className="text-xs">Metode</FieldLabel>
            <Select
              value={metode}
              onValueChange={(v) => {
                const baru = v as Metode;
                onMetode(baru);
                const opsi = KAS_PER_METODE[baru];
                if (!opsi.some((o) => o.value === kas)) onKas(opsi[0].value);
              }}
            >
              <SelectTrigger id="sel_batch_metode" className="h-[26px] w-full min-w-0 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METODE.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <FieldLabel htmlFor="sel_batch_kas" className="text-xs">Posisi Kas</FieldLabel>
            <Select value={kas} onValueChange={(v) => onKas(v as Kas)}>
              <SelectTrigger id="sel_batch_kas" className="h-[26px] w-full min-w-0 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KAS_PER_METODE[metode].map((k) => (
                  <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {aksi === 'ubah' && (
          <div className="grid grid-cols-[6rem_1fr] items-center gap-x-2 gap-y-2">
            {/* Jatuh tempo: opsi untuk mengubah semua sekaligus. */}
            <label className="flex items-center gap-1.5 text-xs">
              <input
                id="chk_batch_jatuh_tempo"
                type="checkbox"
                checked={pakaiJatuhTempo}
                onChange={(e) => onPakaiJatuhTempo(e.target.checked)}
                className="size-3.5 accent-primary"
              />
              Jatuh Tempo
            </label>
            <Input
              id="inp_batch_jatuh_tempo"
              type="date"
              disabled={!pakaiJatuhTempo}
              value={jatuhTempo}
              onChange={(e) => onJatuhTempo(e.target.value)}
              className="h-[26px] w-full min-w-0 disabled:opacity-50"
            />

            {/* Dispensasi: paket dipetakan per jenis di halaman (hanya jenis
                yang cocok yang diberi paket; lainnya dibiarkan tetap). */}
            <FieldLabel htmlFor="sel_batch_dispen" className="text-xs">Dispensasi</FieldLabel>
            <Select
              value={dispen === '' ? '' : dispen === 'tanpa' ? 'tanpa' : String(dispen)}
              onValueChange={(v) => {
                if (v === '') onDispen('');
                else if (v === 'tanpa') onDispen('tanpa');
                else onDispen(Number(v));
              }}
            >
              <SelectTrigger id="sel_batch_dispen" className="h-[26px] w-full min-w-0 text-xs">
                <SelectValue placeholder="Tanpa perubahan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tanpa perubahan</SelectItem>
                <SelectItem value="tanpa">Lepas dispensasi</SelectItem>
                {daftarDispen.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>{d.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="col-start-2 text-[11px] text-muted-foreground">
              Paket hanya diterapkan ke tagihan yang jenisnya cocok.
            </p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel id="btn_batch_batal_dialog" onClick={onBatal}>Batal</AlertDialogCancel>
          <Button
            id="btn_batch_konfirmasi"
            type="button"
            variant={aksi === 'hapus_tagihan' || aksi === 'hapus_riwayat' ? 'destructive' : 'default'}
            disabled={busy}
            onClick={() => void onKonfirmasi()}
          >
            {busy ? '…' : labelAksi}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
