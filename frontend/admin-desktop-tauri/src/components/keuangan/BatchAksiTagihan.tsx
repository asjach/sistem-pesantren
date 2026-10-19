import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CrosstabKolom, Dispensasi } from '@/api/keuangan';
import { labelSel } from '@/components/keuangan/TagihanCrosstab';

export type AksiBatch = 'bayar' | 'hapus_tagihan' | 'hapus_riwayat' | 'ubah' | 'buat';

/** Satu kolom target Buat Massal: kolom crosstab (jenis + periode) beserta
 *  santri yang selnya masih KOSONG pada kolom itu. Jenis & periode tagihan
 *  yang dibuat datang dari KOLOM yang terseleksi — tak ada pilihan manual,
 *  jadi satu sel kosong terpilih = satu tagihan (baris × kolom). */
export interface TargetBuatKolom {
  /** Kunci kolom crosstab (mis. `12-2026-11` bulanan, `jenis-3` sekali). */
  key: string;
  /** Kolomnya sendiri — sumber label (`labelSel`) & jenis/periode kiriman. */
  kolom: CrosstabKolom;
  /** Santri (baris) yang selnya kosong di kolom ini, urut seperti tabel. */
  santriIds: number[];
}

/** Kunci kolom → penggalan id elemen. NFR-05 minta id snake_case, sedangkan
 *  kunci kolom memuat tanda hubung (`12-2026-11`) → dijadikan garis bawah. */
function kunciId(key: string): string {
  return key.replace(/[^a-zA-Z0-9]+/g, '_');
}

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

/** Dialog konfirmasi aksi sekaligus untuk banyak sel terpilih (klik kiri).
 *  Lima aksi: bayar lunas, ubah (jatuh tempo + dispensasi), hapus tagihan,
 *  hapus riwayat pembayaran, dan buat massal. Buat massal bekerja PER SEL:
 *  tiap sel KOSONG yang terseleksi dibuatkan satu tagihan dengan jenis +
 *  periode dari kolomnya dan santri dari barisnya; sel yang sudah punya
 *  tagihan tidak disentuh. Nominal tiap kolom terisi dari tarif jenisnya dan
 *  masih bisa diubah. State form ditahan halaman (KeuanganPage). */
export default function BatchAksiTagihan({
  aksi, jumlah, totalSisa, busy,
  metode, kas, onMetode, onKas,
  pakaiJatuhTempo, jatuhTempo, onPakaiJatuhTempo, onJatuhTempo,
  dispen, onDispen, daftarDispen,
  targetBuat, nonaktifDilewati,
  nominalBuat, onNominalBuat,
  jatuhTempoBuat, onJatuhTempoBuat,
  galatBuat,
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
  /** Target buat massal: satu entri per kolom crosstab yang selnya KOSONG
   *  terseleksi. Jenis + periode datang dari kolom itu sendiri. */
  targetBuat: TargetBuatKolom[];
  /** Sel terpilih yang dilewati karena santrinya nonaktif pada TA filter. */
  nonaktifDilewati: number;
  /** Nominal per kolom target (key = kunci kolom); terisi awal dari tarif
   *  jenis kolom itu, boleh diubah. */
  nominalBuat: Record<string, string>;
  onNominalBuat: (key: string, v: string) => void;
  /** Jatuh tempo per kolom target — hanya dipakai kolom non-bulanan
   *  (bulanan selalu tanggal 10 bulan periode). */
  jatuhTempoBuat: Record<string, string>;
  onJatuhTempoBuat: (key: string, v: string) => void;
  /** Galat validasi/eksekusi buat massal (null = tak ada). */
  galatBuat: string | null;
  onBatal: () => void;
  onKonfirmasi: () => void;
}) {
  const terbuka = aksi !== null;

  /** Tagihan yang akan dibuat = seluruh sel KOSONG terpilih (per kolom). */
  const totalBuat = targetBuat.reduce((t, k) => t + k.santriIds.length, 0);
  /** Sel terpilih yang sudah punya tagihan → dilewati. Sisanya (bila ada)
   *  adalah sel santri nonaktif, yang dihitung terpisah. */
  const sudahAdaBuat = Math.max(0, jumlah - totalBuat - nonaktifDilewati);

  const judul =
    aksi === 'bayar' ? `Bayar ${jumlah} tagihan?`
    : aksi === 'ubah' ? `Ubah ${jumlah} tagihan?`
    : aksi === 'hapus_tagihan' ? `Hapus ${jumlah} tagihan?`
    : aksi === 'hapus_riwayat' ? `Hapus riwayat ${jumlah} tagihan?`
    : aksi === 'buat' ? 'Buat tagihan massal'
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
      : aksi === 'buat'
      ? `Tiap sel kosong yang terseleksi dibuatkan satu tagihan menurut kolomnya (jenis & periode dari kolom, santri dari baris). Sel yang sudah punya tagihan tidak disentuh.`
    : '';
  const labelAksi =
    aksi === 'bayar' ? 'Bayar' : aksi === 'ubah' ? 'Ubah' : aksi === 'hapus_tagihan' ? 'Hapus Tagihan' : aksi === 'hapus_riwayat' ? 'Hapus Riwayat' : 'Buat';

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

        {aksi === 'buat' && (
          <div className="flex flex-col gap-2">
            {galatBuat !== null && (
              <p role="alert" className="text-xs text-destructive">{galatBuat}</p>
            )}
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{totalBuat} tagihan</span> akan dibuat dari
              sel kosong yang terseleksi
              {sudahAdaBuat > 0 ? `; ${sudahAdaBuat} sel sudah punya tagihan dilewati` : ''}.
            </p>
            {nonaktifDilewati > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {nonaktifDilewati} sel santri nonaktif dilewati.
              </p>
            )}
            {targetBuat.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Tak ada sel kosong pada kolom yang terseleksi.
              </p>
            ) : (

              <div className="flex max-h-72 flex-col gap-1.5 overflow-auto pr-0.5">
                {targetBuat.map((t) => (
                  <div key={t.key} className="border p-2">
                    <p className="text-xs font-medium">{labelSel(t.kolom)}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {t.santriIds.length} santri ·{' '}
                      {t.kolom.tipe === 'bulanan' ? 'jatuh tempo otomatis (tgl 10)' : 'jatuh tempo manual'}
                    </p>
                    <div className="mt-1.5 grid grid-cols-[5rem_1fr] items-center gap-x-2 gap-y-1">
                      <FieldLabel htmlFor={`inp_batch_buat_nominal_${kunciId(t.key)}`} className="text-xs">Nominal</FieldLabel>
                      <Input
                        id={`inp_batch_buat_nominal_${kunciId(t.key)}`}
                        inputMode="numeric"
                        value={nominalBuat[t.key] ?? ''}
                        onChange={(e) => onNominalBuat(t.key, e.target.value)}
                        placeholder="mis. 75000"
                        className="h-[26px] w-full min-w-0"
                      />
                      {t.kolom.tipe !== 'bulanan' && (
                        <>
                          <FieldLabel htmlFor={`inp_batch_buat_jt_${kunciId(t.key)}`} className="text-xs">Jatuh Tempo</FieldLabel>
                          <Input
                            id={`inp_batch_buat_jt_${kunciId(t.key)}`}
                            type="date"
                            value={jatuhTempoBuat[t.key] ?? ''}
                            onChange={(e) => onJatuhTempoBuat(t.key, e.target.value)}
                            className="h-[26px] w-full min-w-0"
                          />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
