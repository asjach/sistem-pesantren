import { useEffect, useState } from 'react';

import type { Dispensasi, PembayaranRow } from '@/api/keuangan';
import { daftarDispensasi, kuotaPakai } from '@/api/keuangan';
import type { TahunAjaran } from '@/api/master';
import { hitungDispensasi, ringkasAturan, saringDispensasi, sisaKuota } from '@/lib/dispensasi';
import { DeleteAction } from '@/components/RowActions';
import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { History, Pencil, Trash2, Wallet, X } from '@/icons';
import { cn } from '@/lib/utils';

export interface TagihanAktif {
  id: number;
  nama: string;
  label: string;
  /** Nama ayah & ibu dari data santri; dipakai baris "Orang Tua". */
  ayah_nama: string | null;
  ibu_nama: string | null;
  /** Kunci santri + jenis: dipakai memilih dispensasi yang penerimanya cocok. */
  santri_id: number;
  jenisId: number;
  nominal: number;
  /** Sudah dibayar untuk tagihan ini (bukan total baris). */
  terbayar: number;
  sisa: number;
  status: 'belum' | 'sebagian' | 'lunas';
  /** Jejak dispensasi saat ini (nominal kotor = nominal + potongan). */
  potongan: number;
  dispensasi_ids: number[] | null;
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
  /** Kunci eksplisit paket dispensasi ([] = lepas). Absen = jalur lama. */
  dispensasi_ids?: number[] | null;
}

/** Konteks tambah dari sel kosong: santri + kolom asal (belum ada tagihan). */
export interface TambahCtx {
  nama: string;
  /** Label sel: "Infaq Bulanan · Agu 2025". */
  label: string;
  santri_id: number;
  jenjang: string;
  ayah_nama: string | null;
  ibu_nama: string | null;
  jenis_id: number;
  periode: string | null;
  tipe: 'bulanan' | 'non_bulanan';
  /** TA filter tunggal (null = belum tunggal, simpan dikunci). */
  tahunAjaran: string | null;
  /** Nominal awal dari tarif yang cocok (null = isi manual). */
  nominalAwal: number | null;
}

/** Nilai yang dikirim ke endpoint buat tagihan satuan. */
export interface DataTambah {
  nominal: number;
  jatuh_tempo: string | null;
}

type TabKey = 'bayar' | 'ubah' | 'hapus' | 'detail';

interface Props {
  tagihan: TagihanAktif | null;
  /** Konteks tambah (sel kosong). Eksklusif terhadap `tagihan`: halaman
   *  membersihkan salah satunya setiap membuka yang lain. */
  tambah: TambahCtx | null;
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
  /** Buat tagihan satuan dari mode tambah. */
  onTambah: (data: DataTambah) => Promise<void>;
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
  tagihan, tambah, anchor, daftarTA, riwayat, riwayatBusy, riwayatError,
  onTutup, onBayar, onUbah, onHapus, onTambah, onHapusPembayaran, onMuatRiwayat,
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
  /** Pilihan dispensasi tab Ubah: undefined = belum disentuh (jalur lama),
   *  'tanpa' = lepas eksplisit, number = id paket (nominal mengikuti paket). */
  const [dispenPilih, setDispenPilih] = useState<number | 'tanpa' | undefined>(undefined);
  /** Daftar paket dispensasi untuk jenis+TA tagihan ini. */
  const [dispenDaftar, setDispenDaftar] = useState<Dispensasi[]>([]);
  const [dispenGagal, setDispenGagal] = useState(false);
  /** Kuota terpakai santri ini per paket (pratinjau; backend otoritatif). */
  const [kuotaPakaiMap, setKuotaPakaiMap] = useState<Record<number, number>>({});
  /* Form tambah (sel kosong) */
  const [nominalBaru, setNominalBaru] = useState('');
  const [jatuhTempoBaru, setJatuhTempoBaru] = useState('');

  const terbuka = anchor !== null && (tagihan !== null || tambah !== null);

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
    setDispenPilih(undefined);
    setTab('bayar');
  }, [tagihan]);

  // Daftar dispensasi untuk tagihan ini (dipakai combobox tab Ubah).
  useEffect(() => {
    if (tagihan === null) return;
    let hidup = true;
    setDispenGagal(false);
    daftarDispensasi({ tahun_ajaran: tagihan.tahunAjaran, jenis_id: tagihan.jenisId, is_active: true })
      .then((d) => { if (hidup) setDispenDaftar(d); })
      .catch(() => { if (hidup) { setDispenDaftar([]); setDispenGagal(true); } });
    // Sisa kuota santri ini (opsi habis dinonaktifkan; sudah-menempel tetap bisa dipilih).
    kuotaPakai([tagihan.santri_id])
      .then((m) => { if (hidup) setKuotaPakaiMap(m[tagihan.santri_id] ?? {}); })
      .catch(() => { if (hidup) setKuotaPakaiMap({}); });
    return () => { hidup = false; };
  }, [tagihan]);

  // Konteks tambah berganti → nominal mengikuti tarif yang cocok.
  useEffect(() => {
    if (tambah === null) return;
    setNominalBaru(tambah.nominalAwal != null ? String(tambah.nominalAwal) : '');
    setJatuhTempoBaru('');
  }, [tambah]);

  // Riwayat diambil saat tab Detail benar-benar dibuka, bukan di awal — jangan
  //ountain request untuk tab yang mungkin tak pernah dibuka.
  useEffect(() => {
    if (tab === 'detail') onMuatRiwayat();
  }, [tab, onMuatRiwayat]);

  if (tagihan === null && tambah === null) return null;
  if (anchor === null) return null;

  const tambahAktif = tambah !== null && tagihan === null;

  const jalankan = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  /* Mode tambah (sel kosong): ringkas + satu form, tanpa tab aksi. */
  if (tambahAktif && tambah) {
    const jangkar = anchor;
    const nBaru = Number(nominalBaru);
    const nominalBaruValid = nominalBaru !== '' && Number.isInteger(nBaru) && nBaru >= 1;
    const nominalBaruSalah = nominalBaru !== '' && !nominalBaruValid;
    const taSiap = tambah.tahunAjaran !== null && tambah.tahunAjaran !== '';
    const bulananBaru = tambah.tipe === 'bulanan';
    return (
      <Popover
        open={terbuka}
        onOpenChange={(o) => { if (!o) onTutup(); }}
      >
        <PopoverAnchor
          virtualRef={{
            current: { getBoundingClientRect: () => jangkar.getBoundingClientRect() },
          }}
        />
        <PopoverContent
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="w-[22rem] border-ring/50 p-0"
        >
          <div className="border-b px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="min-w-0 truncate text-sm font-medium">{tambah.nama}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Tambah tagihan · {tambah.label}</p>
              </div>
              <Button
                id="btn_tutup_popover_tambah"
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Tutup"
                title="Tutup"
                onClick={onTutup}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </Button>
            </div>
            <dl className="mt-1.5 space-y-0.5 text-xs">
              <BarisRingkas label="Ayah" nilai={namaOrang(tambah.ayah_nama)} />
              <BarisRingkas label="Ibu" nilai={namaOrang(tambah.ibu_nama)} />
              <BarisRingkas label="Tahun Ajaran" nilai={tambah.tahunAjaran ?? '—'} />
            </dl>
          </div>
          <div className="space-y-2 p-3">
            <div className="grid grid-cols-[5rem_1fr] items-center gap-x-2 gap-y-1.5">
              <FieldLabel htmlFor="inp_tambah_nominal" className="text-xs">Nominal</FieldLabel>
              <Input
                autoFocus
                id="inp_tambah_nominal"
                type="number"
                inputMode="numeric"
                min={1}
                value={nominalBaru}
                onChange={(e) => setNominalBaru(e.target.value)}
                aria-label="Nominal tagihan baru"
                aria-invalid={nominalBaruSalah}
                className={cn('h-8 w-full min-w-0 tabular-nums', nominalBaruSalah && 'border-destructive')}
              />
              <FieldLabel htmlFor="inp_tambah_jatuh_tempo" className="text-xs">Jatuh Tempo</FieldLabel>
              {bulananBaru ? (
                <p id="inp_tambah_jatuh_tempo" className="text-xs text-muted-foreground">
                  Otomatis: tanggal 10 bulan berjalan
                </p>
              ) : (
                <Input
                  id="inp_tambah_jatuh_tempo"
                  type="date"
                  className="h-8 w-full min-w-0"
                  value={jatuhTempoBaru}
                  onChange={(e) => setJatuhTempoBaru(e.target.value)}
                />
              )}
              {nominalBaruSalah && (
                <p className="col-start-2 text-[11px] text-destructive">
                  Isi nominal minimal Rp 1.
                </p>
              )}
              {!taSiap && (
                <p className="col-start-2 text-[11px] text-destructive">
                  Pilih satu tahun ajaran pada filter di atas.
                </p>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Nominal mengikuti tarif bila cocok — ketik manual untuk menimpa.
            </p>
            <div className="flex justify-end gap-1.5 pt-0.5">
              <Button id="btn_tambah_batal" type="button" variant="ghost" className="h-8" onClick={onTutup}>
                Batal
              </Button>
              <Button
                id="btn_tambah_simpan"
                type="button"
                className="h-8"
                disabled={!nominalBaruValid || !taSiap || busy}
                onClick={() => void jalankan(() => onTambah({
                  nominal: nBaru,
                  jatuh_tempo: bulananBaru ? null : (jatuhTempoBaru || null),
                }))}
              >
                {busy ? '…' : 'Simpan'}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  if (tagihan === null) return null;

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

  /** Nominal kotor = nominal tersimpan + potongan tercatat (tepat, karena
   *  potongan selalu `awal − akhir`). Dasar pratinjau & hitung backend. */
  const nominalKotor = tagihan.nominal + tagihan.potongan;
  /** Id paket yang santrinya sudah penerima (label saja — memilih paket
   *  lain otomatis mendaftarkan santri sebagai penerima saat Simpan). */
  const idPenerima = new Set(saringDispensasi(dispenDaftar, tagihan.santri_id).map((d) => d.id));
  const paketPilih = typeof dispenPilih === 'number'
    ? (dispenDaftar.find((d) => d.id === dispenPilih) ?? null)
    : null;
  /** Pratinjau hasil paket terpilih (cerminan hitung backend). */
  const pratinjau = paketPilih
    ? hitungDispensasi(nominalKotor, [paketPilih], tagihan.jenisId)
    : null;
  const dispenTersentuh = dispenPilih !== undefined;
  /** Nominal efektif terkirim: pratinjau paket, atau ketikan manual. */
  const nominalEfektif = pratinjau ? pratinjau.nominal : nominalAngka;
  const nominalEfektifSalah = pratinjau
    ? pratinjau.nominal < tagihan.terbayar
    : nominalSalah;
  const ubahValid = (pratinjau ? true : nominal !== '')
    && !nominalEfektifSalah
    && tahunAjaran !== ''
    && (!busy);
  /** Nama paket jejak saat ini (id tak dikenal = paket nonaktif/dihapus). */
  const jejakNama = (tagihan.dispensasi_ids ?? []).map((id) =>
    dispenDaftar.find((d) => d.id === id)?.nama ?? `paket #${id}`,
  );

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
        /* `border-ring/50` (bukan `border` bawaan 12%): panel ini
           mengambang di atas crosstab yang ramai, garis tipis low-contrast
           bawaan tak terlihat di antara warna sel. */
        className="w-[22rem] border-ring/50 p-0"
      >
        {/* Ringkasan tagihan: nama, orang tua, dan angka nominal/dibayar/sisa. */}
        <div className="border-b px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-medium">{tagihan.nama}</p>
            <div className="flex shrink-0 items-center gap-1">
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', b.kelas)}>
                {b.teks}
              </span>
              {/* Jalan tutup eksplisit: popover ini terkontrol halaman, jadi
                  tombol memanggil `onTutup` langsung (bukan PopoverClose) —
                  sama dengan yang dilakukan klik luar & Esc. */}
              <Button
                id="btn_tutup_popover_tagihan"
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Tutup"
                title="Tutup"
                onClick={onTutup}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </Button>
            </div>
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
              <FieldLabel htmlFor="sel_ubah_dispen" className="text-xs">Dispensasi</FieldLabel>
              <Select
                value={dispenPilih === undefined ? '' : dispenPilih === 'tanpa' ? 'tanpa' : String(dispenPilih)}
                onValueChange={(v) => {
                  if (v === '') setDispenPilih(undefined);
                  else if (v === 'tanpa') {
                    // Lepas: isi nominal dengan kotor (satu klik kembali);
                    // tetap bisa diketik ulang sebagai koreksi manual.
                    setDispenPilih('tanpa');
                    setNominal(String(nominalKotor));
                  } else setDispenPilih(Number(v));
                }}
              >
                <SelectTrigger id="sel_ubah_dispen" aria-label="Dispensasi tagihan" className="h-8 w-full min-w-0 text-xs">
                  <SelectValue placeholder="Tanpa perubahan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tanpa perubahan</SelectItem>
                  <SelectItem value="tanpa">Tanpa dispensasi (kotor)</SelectItem>
                  {dispenDaftar.map((d) => {
                    const penerima = idPenerima.has(d.id);
                    const ringkas = ringkasAturan(d, tagihan.jenisId);
                    if (ringkas === null) return null;
                    const sudahMenempel = (tagihan.dispensasi_ids ?? []).includes(d.id);
                    const kuotaHabis = (sisaKuota(d, kuotaPakaiMap[d.id] ?? 0) ?? 1) <= 0 && !sudahMenempel;
                    return (
                      <SelectItem key={d.id} value={String(d.id)} disabled={kuotaHabis}>
                        {d.nama} · {ringkas}{penerima ? '' : ' (otomatis terdaftar)'}{kuotaHabis ? ' (kuota habis)' : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {dispenGagal && (
                <p className="col-start-2 text-[11px] text-destructive">
                  Gagal memuat daftar dispensasi.
                </p>
              )}
              {tagihan.potongan > 0 && (
                <p className="col-start-2 text-[11px] text-muted-foreground">
                  Saat ini: potongan {rupiah(tagihan.potongan)}
                  {jejakNama.length > 0 ? ` (${jejakNama.join(', ')})` : ''}.
                </p>
              )}
              {pratinjau && paketPilih && (
                <p className="col-start-2 text-[11px] text-muted-foreground">
                  {rupiah(nominalKotor)} − {rupiah(pratinjau.potongan)} ({paketPilih.nama})
                  {' → '}<b>{rupiah(pratinjau.nominal)}</b>
                  {!idPenerima.has(paketPilih.id) ? ' · santri otomatis jadi penerima.' : ''}
                </p>
              )}
              {dispenPilih === 'tanpa' && tagihan.potongan > 0 && (
                <p className="col-start-2 text-[11px] text-muted-foreground">
                  Kembali kotor {rupiah(nominalKotor)} (melepas potongan).
                </p>
              )}

              <FieldLabel htmlFor="inp_ubah_nominal" className="text-xs">Nominal</FieldLabel>
              <Input
                id="inp_ubah_nominal"
                type="number"
                min={tagihan.terbayar}
                value={pratinjau ? String(pratinjau.nominal) : nominal}
                onChange={(e) => setNominal(e.target.value)}
                disabled={pratinjau !== null}
                title={pratinjau ? 'Mengikuti dispensasi terpilih' : undefined}
                aria-invalid={nominalEfektifSalah}
                className={cn('h-8 w-full min-w-0 tabular-nums', nominalEfektifSalah && 'border-destructive')}
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

              {nominalEfektifSalah && (
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
                  nominal: nominalEfektif,
                  tahun_ajaran: tahunAjaran,
                  jatuh_tempo: bulanan ? null : (jatuhTempo || null),
                  ...(dispenTersentuh
                    ? { dispensasi_ids: typeof dispenPilih === 'number' ? [dispenPilih] : [] }
                    : {}),
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