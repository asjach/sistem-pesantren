import { useEffect, useState } from 'react';

import type { PembayaranRow } from '@/api/keuangan';
import type { TahunAjaran } from '@/api/master';
import { DeleteAction } from '@/components/RowActions';
import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { History, Pencil, Trash2, Wallet } from '@/icons';
import { cn } from '@/lib/utils';

export interface TagihanAktif {
  id: number;
  nama: string;
  label: string;
  /** Nama ayah & ibu dari data santri; dipakai baris "Orang Tua". */
  ayah_nama: string | null;
  ibu_nama: string | null;
  nominal: number;
  /** Sudah dibayar untuk tagihan ini (bukan total baris). */
  terbayar: number;
  sisa: number;
  status: 'belum' | 'sebagian' | 'lunas';
  /** Sudah lewat jatuh tempo (kunci warna badge & tunggakan). */
  terlambat: boolean;
  /** Tanggal jatuh tempo 'YYYY-MM-DD' atau null (tanpa batas). */
  jatuhTempo: string | null;
  tahunAjaran: string;
  tipe: 'bulanan' | 'non_bulanan';
}

export interface DataBayar {
  jumlah: number;
  metode: 'tunai' | 'transfer';
  kas: 'tunai_tu' | 'bank_lembaga' | 'bank_pesantren';
}

/** Nilai yang boleh dikirim ke endpoint ubah tagihan. */
export interface DataUbah {
  nominal: number;
  tahun_ajaran: string;
  jatuh_tempo: string | null;
}

type TabKey = 'bayar' | 'ubah' | 'hapus' | 'detail';

interface Props {
  tagihan: TagihanAktif | null;
  /** Elemen sel asal — jangkar popover. null = tertutup. */
  anchor: HTMLElement | null;
  /** Daftar tahun ajaran sudah dimuat halaman (tak perlu fetch ulang). */
  daftarTA: TahunAjaran[];
  riwayat: PembayaranRow[];
  riwayatBusy: boolean;
  riwayatError: string;
  onTutup: () => void;
  onBayar: (data: DataBayar) => Promise<void>;
  onUbah: (data: DataUbah) => Promise<void>;
  onHapus: () => Promise<void>;
  /** Hapus satu baris pembayaran dari riwayat. */
  onHapusPembayaran: (id: number) => Promise<void>;
  /** Minta halaman memuat riwayat pembayaran (dipanggil saat tab Detail dibuka). */
  onMuatRiwayat: () => void;
}

const METODE: { value: DataBayar['metode']; label: string }[] = [
  { value: 'tunai', label: 'Tunai' },
  { value: 'transfer', label: 'Transfer' },
];

/** Pilihan posisi kas per metode pembayaran.
 *
 *  Uang tunai memang masuk ke Kas TU, dan transfer masuk ke bank — jadi
 *  menampilkan seluruh pilihan untuk kedua metode sekaligus menghasilkan
 *  kombinasi yang tidak masuk akal (mis. "Tunai" + "Bank Pesantren"). Nilai
 *  `kas` di backend tetap daftar tetap `tunai_tu,bank_lembaga,bank_pesantren`,
 *  jadi ini murni soal opsi yang ditawarkan, bukan perubahan data. */
const KAS_PER_METODE: Record<DataBayar['metode'], { value: DataBayar['kas']; label: string }[]> = {
  tunai: [{ value: 'tunai_tu', label: 'Kas TU' }],
  transfer: [
    { value: 'bank_pesantren', label: 'Bank Pesantren' },
    { value: 'bank_lembaga', label: 'Bank Jenjang' },
  ],
};

/** Semua nilai kas (untuk memetakan label di riwayat pembayaran). */
const KAS: { value: DataBayar['kas']; label: string }[] = [
  ...KAS_PER_METODE.tunai,
  ...KAS_PER_METODE.transfer,
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

/** "2026-08-10T09:12:00" → "10 Agu 2026, 09:12". */
function waktuBayar(iso: string): string {
  const tanggal = iso.slice(0, 10);
  const jam = iso.slice(11, 16);
  return jam.length === 5 ? `${tanggalPanjang(tanggal)} ${jam}` : tanggalPanjang(tanggal);
}

function labelMetode(m: string): string {
  return METODE.find((x) => x.value === m)?.label ?? m;
}

function labelKas(k: string): string {
  return KAS.find((x) => x.value === k)?.label ?? k;
}

/** Nama ayah atau ibu; '—' kalau kosong. */
function namaOrang(nama: string | null): string {
  const isi = nama?.trim();
  return isi ? isi : '—';
}

/** "Rp 1.234.567" */
function rupiah(n: number): string {
  return `Rp ${n.toLocaleString('id')}`;
}

/**
 * Popover aksi sel tagihan: ringkasan tagihan, lalu tab aksi (bayar, ubah,
 * hapus, detail pembayaran). Isi panel mengikuti tab yang sedang aktif.
 *
 * Diletakkan sebagai komponen sendiri (agar state form ikut terisolasi dan
 * bisa diuji sendiri), bukan inline di halaman.
 */
export default function PopoverAksiTagihan({
  tagihan, anchor, daftarTA, riwayat, riwayatBusy, riwayatError,
  onTutup, onBayar, onUbah, onHapus, onHapusPembayaran, onMuatRiwayat,
}: Props) {
  const [tab, setTab] = useState<TabKey>('bayar');
  const [teksJumlah, setTeksJumlah] = useState('');
  const [metode, setMetode] = useState<DataBayar['metode']>('tunai');
  const [kas, setKas] = useState<DataBayar['kas']>('tunai_tu');
  const [busy, setBusy] = useState(false);
  /* Form ubah */
  const [nominal, setNominal] = useState('');
  const [tahunAjaran, setTahunAjaran] = useState('');
  const [jatuhTempo, setJatuhTempo] = useState('');

  const terbuka = anchor !== null && tagihan !== null;

  // Sel baru → isi ulang seluruh form; jumlah defaultnya sisa tagihan (kasus
  // paling umum adalah membayar penuh, dan nilainya masih bisa dikoreksi).
  useEffect(() => {
    if (tagihan === null) return;
    setTeksJumlah(tagihan.sisa > 0 ? String(tagihan.sisa) : '');
    setMetode('tunai');
    setKas('tunai_tu');
    setNominal(String(tagihan.nominal));
    setTahunAjaran(tagihan.tahunAjaran);
    setJatuhTempo(tagihan.jatuhTempo ?? '');
    setTab('bayar');
  }, [tagihan]);

  // Riwayat diambil saat tab Detail benar-benar dibuka, bukan di awal — jangan
  //ountain request untuk tab yang mungkin tak pernah dibuka.
  useEffect(() => {
    if (tab === 'detail') onMuatRiwayat();
  }, [tab, onMuatRiwayat]);

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
  const bulanan = tagihan.tipe === 'bulanan';
  const adaPembayaran = tagihan.terbayar > 0;

  const nominalAngka = Number(nominal);
  const nominalSalah = nominal !== ''
    && (!Number.isInteger(nominalAngka) || nominalAngka < 0 || nominalAngka < tagihan.terbayar);
  const ubahValid = nominal !== ''
    && !nominalSalah
    && tahunAjaran !== ''
    && (!busy);

  const jalankan = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
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
        className="w-[22rem] p-0"
      >
        {/* Ringkasan tagihan: nama, orang tua, dan angka nominal/dibayar/sisa. */}
        <div className="border-b px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-medium">{tagihan.nama}</p>
            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', b.kelas)}>
              {b.teks}
            </span>
          </div>
          <dl className="mt-1.5 space-y-0.5 text-xs">
            <BarisRingkas label="Ayah" nilai={namaOrang(tagihan.ayah_nama)} />
            <BarisRingkas label="Ibu" nilai={namaOrang(tagihan.ibu_nama)} />
            <BarisRingkas label={tagihan.label} nilai={rupiah(tagihan.nominal)} />
            <BarisRingkas label="Dibayar" nilai={rupiah(tagihan.terbayar)} />
            <BarisRingkas
              label="Sisa"
              nilai={rupiah(sisa)}
              nilaiKelas={lunas ? 'text-emerald-700 dark:text-emerald-300' : 'text-destructive'}
            />
          </dl>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {tagihan.jatuhTempo === null
              ? 'Tanpa batas jatuh tempo'
              : `Jatuh tempo ${tanggalPanjang(tagihan.jatuhTempo)}`}
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="flex flex-col">
          {/* Tab: ikon di atas, label di bawahnya. */}
          <TabsList
            variant="line"
            /* `h-auto!` (important) wajib: `tabsListVariants` memaksa `h-9`
               (36px) untuk tab horizontal, padahal isi tab di sini 48,5px
               (ikon di atas label). Akibatnya trigger meluber 13px melewati
               tepi bawah tablist dan garis `border-b` lama tergambar melintasi
               area label — itu sebabnya posisinya terasa salah, bukan karena
               divider-nya sendiri. Sekarang tinggi tablist mengikuti isinya,
               divider duduk 4px di bawah penanda tab aktif (`pb-1`), dan
               penanda aktif dirapatkan dari `bottom:-5px` ke `bottom-0`
               supaya menempel pada labelnya. */
            className={cn(
              'grid h-auto! w-full gap-0 rounded-none border-b p-0 pb-1 [&_[role=tab]]:after:bottom-0',
              adaPembayaran ? 'grid-cols-4' : 'grid-cols-3',
            )}
          >
            <TabUji ikon={<Wallet size={15} />} label="Bayar" />
            <TabUji ikon={<Pencil size={15} />} label="Ubah" />
            <TabUji ikon={<Trash2 size={15} />} label="Hapus" />
            {adaPembayaran && <TabUji ikon={<History size={15} />} label="Detail" />}
          </TabsList>

          {/* --- Bayar --- */}
          <TabsContent value="bayar" className="m-0 space-y-2 p-3">
            {lunas ? (
              <p className="text-xs text-muted-foreground">
                Tagihan ini sudah lunas — tidak ada sisa yang perlu dibayar.
              </p>
            ) : (
              <>
                {/* Satu grid untuk ketiga kontrol: kolom label dikunci
                    `4rem` supaya "Bayar", "Metode", dan "Posisi Kas" rata kiri
                    dengan lebar sama (dulu tiap baris `grid-cols-[auto_1fr]`,
                    jadi tiap label lebarnya mengikuti teksnya sendiri dan
                    kontrolnya mulai di x berbeda-beda). 4rem cukup untuk
                    label terpanjang "Posisi Kas" (~52px) plus jarak. */}
                <div className="grid grid-cols-[4rem_1fr] items-center gap-x-2 gap-y-1.5">
                  <FieldLabel htmlFor="inp_bayar_jumlah" className="text-xs">Bayar</FieldLabel>
                  {/* Prefix "Rp" sengaja dihapus: Tanpanya baris ini dimulai
                      rata dengan select di bawahnya; dengan prefix, kolom
                      kontrolnya meleset 22px ke kanan. */}
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
                    className={cn('h-8 w-full min-w-0 tabular-nums', jumlahSalah && 'border-destructive')}
                  />

<FieldLabel htmlFor="sel_bayar_metode" className="text-xs">Metode</FieldLabel>
              <Select
                value={metode}
                onValueChange={(v) => {
                  const baru = v as DataBayar['metode'];
                  setMetode(baru);
                  /* Kas ikut menyesuaikan metode: kalau nilai kas sekarang
                     tidak ada di pilihan metode baru, ambil yang pertama —
                     mencegah form mengirim kombinasi yang tidak ada pilihannya. */
                  const opsi = KAS_PER_METODE[baru];
                  setKas((k) => (opsi.some((o) => o.value === k) ? k : opsi[0].value));
                }}
              >
                    <SelectTrigger
                      id="sel_bayar_metode"
                      aria-label="Metode pembayaran"
                      title={labelMetode(metode)}
                      className="h-8 w-full min-w-0 text-xs"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METODE.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <FieldLabel htmlFor="sel_bayar_kas" className="text-xs">Posisi Kas</FieldLabel>
                  <Select value={kas} onValueChange={(v) => setKas(v as DataBayar['kas'])}>
                    <SelectTrigger
                      id="sel_bayar_kas"
                      aria-label="Kas tujuan"
                      title={labelKas(kas)}
                      className="h-8 w-full min-w-0 text-xs"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KAS_PER_METODE[metode].map((k) => (
                        <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {jumlahSalah && (
                    <p id="galat_bayar_jumlah" className="col-start-2 text-[11px] text-destructive">
                      Isi Rp 1 sampai Rp {sisa.toLocaleString('id')} (sisa tagihan).
                    </p>
                  )}
                </div>

                <div className="flex justify-end pt-0.5">
                  <Button
                    id="btn_bayar_simpan"
                    type="button"
                    className="h-8"
                    disabled={!jumlahValid || busy}
                    onClick={() => void jalankan(() => onBayar({ jumlah: jumlahAngka, metode, kas }))}
                  >
                    {busy ? '…' : 'Bayar'}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* --- Ubah --- */}
          <TabsContent value="ubah" className="m-0 space-y-2 p-3">
            {/* Pola sama seperti panel Bayar: satu grid, kolom label dikunci 5rem
                supaya ketiganya rata kiri dan kontrolnya mulai di x yang sama.
                5rem (80px) dipilih karena label terpanjang di sini "Tahun Ajaran"
                (67px terukur) — 4rem milik panel Bayar tidak cukup. */}
            <div className="grid grid-cols-[5rem_1fr] items-center gap-x-2 gap-y-1.5">
              <FieldLabel htmlFor="inp_ubah_nominal" className="text-xs">Nominal</FieldLabel>
              <Input
                id="inp_ubah_nominal"
                type="number"
                min={tagihan.terbayar}
                value={nominal}
                onChange={(e) => setNominal(e.target.value)}
                aria-invalid={nominalSalah}
                className={cn('h-8 w-full min-w-0 tabular-nums', nominalSalah && 'border-destructive')}
              />

              <FieldLabel htmlFor="sel_ubah_ta" className="text-xs">Tahun Ajaran</FieldLabel>
              <Select value={tahunAjaran} onValueChange={setTahunAjaran}>
                <SelectTrigger id="sel_ubah_ta" aria-label="Tahun ajaran" className="h-8 w-full min-w-0 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* TA aktif mungkin belum ada di daftar → tetap offered. */}
                  {!daftarTA.some((t) => t.nama === tahunAjaran) && (
                    <SelectItem value={tahunAjaran}>{tahunAjaran}</SelectItem>
                  )}
                  {daftarTA.map((t) => (
                    <SelectItem key={t.nama} value={t.nama}>
                      {t.nama}{t.is_aktif ? ' (aktif)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <FieldLabel htmlFor="inp_ubah_jatuh_tempo" className="text-xs">Jatuh Tempo</FieldLabel>
              {bulanan ? (
                /* Tanggal + keterangan dipisah baris: dalam kolom kontrol yang
                   hanya ~238px, digabung jadi satu paragraf terlihat rapat. */
                <div className="min-w-0">
                  <p id="inp_ubah_jatuh_tempo" className="text-xs text-muted-foreground">
                    {tagihan.jatuhTempo ? tanggalPanjang(tagihan.jatuhTempo) : '—'}
                  </p>
                  <p className="text-[11px] text-muted-foreground/80">
                    <span>(otomatis: tanggal 10 bulan berjalan)</span>
                  </p>
                </div>
              ) : (
                <Input
                  id="inp_ubah_jatuh_tempo"
                  type="date"
                  className="h-8 w-full min-w-0"
                  value={jatuhTempo}
                  onChange={(e) => setJatuhTempo(e.target.value)}
                />
              )}

              {nominalSalah && (
                <p className="col-start-2 text-[11px] text-destructive">
                  Minimal Rp {tagihan.terbayar.toLocaleString('id')} (nilai yang sudah dibayar).
                </p>
              )}
            </div>

            <div className="flex justify-end pt-0.5">
              <Button
                id="btn_ubah_simpan"
                type="button"
                className="h-8"
                disabled={!ubahValid || busy}
                onClick={() => void jalankan(() => onUbah({
                  nominal: nominalAngka,
                  tahun_ajaran: tahunAjaran,
                  jatuh_tempo: bulanan ? null : (jatuhTempo || null),
                }))}
              >
                {busy ? '…' : 'Simpan'}
              </Button>
            </div>
          </TabsContent>

          {/* --- Hapus --- */}
          <TabsContent value="hapus" className="m-0 space-y-2 p-3">
            <p className="text-xs">
              Hapus tagihan <b>{tagihan.label}</b> milik <b>{tagihan.nama}</b>?
              {tagihan.terbayar > 0 && ' Pembayaran yang sudah tercatat ikut terhapus.'}
              {' '}Tindakan ini tidak bisa dibatalkan.
            </p>
            <div className="flex justify-end gap-1.5 pt-0.5">
              <Button id="btn_hapus_batal" type="button" variant="ghost" className="h-8" onClick={() => setTab('bayar')}>
                Batal
              </Button>
              <Button
                id="btn_hapus_konfirmasi"
                type="button"
                variant="destructive"
                className="h-8"
                disabled={busy}
                onClick={() => void jalankan(() => onHapus())}
              >
                {busy ? '…' : 'Hapus'}
              </Button>
            </div>
          </TabsContent>

          {/* --- Detail pembayaran --- */}
          <TabsContent value="detail" className="m-0 p-3">
            {riwayatBusy ? (
              <p className="text-xs text-muted-foreground">Memuat riwayat…</p>
            ) : riwayatError !== '' ? (
              <p className="text-xs text-destructive">{riwayatError}</p>
            ) : riwayat.length === 0 ? (
              <p className="text-xs text-muted-foreground">Belum ada pembayaran untuk tagihan ini.</p>
            ) : (
              <ul className="max-h-56 space-y-1.5 overflow-y-auto">
                {riwayat.map((r) => (
                  <li key={r.id} className="border-b pb-1.5 text-xs last:border-b-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="tabular-nums">{waktuBayar(r.created_at)}</span>
                      <span className="flex items-baseline gap-1">
                        <span className={cn('font-medium tabular-nums', r.status === 'batal' && 'text-muted-foreground line-through')}>
                          {rupiah(r.jumlah)}
                        </span>
                        <DeleteAction
                          id={`btn_hapus_bayar_${r.id}`}
                          title="Hapus pembayaran?"
                          description="Baris pembayaran dihapus permanen dan total tagihan menyesuaikan."
                          onConfirm={() => { void jalankan(() => onHapusPembayaran(r.id)); }}
                        />
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {labelMetode(r.metode)} · {labelKas(r.kas)}
                      {r.no_kwitansi !== null && ` · ${r.no_kwitansi}`}
                      {r.status === 'batal' && ' · dibatalkan'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

/** Tab aksi: ikon di atas, label di bawah. */
function TabUji({ ikon, label }: { ikon: React.ReactNode; label: string }) {
  return (
    <TabsTrigger
      value={label.toLowerCase()}
      className="flex h-full flex-col items-center justify-center gap-0.5 rounded-none px-1 py-1.5 text-[11px] font-normal"
    >
      {ikon}
      <span>{label}</span>
    </TabsTrigger>
  );
}

/** Satu baris "label: nilai" pada ringkasan; nilai rata kanan. */
function BarisRingkas({
  label, nilai, nilaiKelas,
}: {
  label: string; nilai: string; nilaiKelas?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 truncate text-right tabular-nums', nilaiKelas)}>{nilai}</dd>
    </div>
  );
}