import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import {
  catatTransaksi, daftarPembayaranHarian, daftarTagihan,
  type TransaksiHarianRow, type RekapHarianJenis, type TagihanRow,
} from '../api/keuangan';
import { listSantri, type Santri } from '../api/santri';
import { listKelas, type Kelas } from '../api/master';
import { tokenUrut, type PetaArahKolom } from '@/lib/urut';
import { hariIniIso, tanggalKeTampilan } from '@/lib/tanggal';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import LabeledInput from '@/components/LabeledInput';
import LabeledCombobox from '@/components/LabeledCombobox';
import {
  ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxRoot, ComboboxTrigger,
} from '@/components/ui/combobox';
import { Plus } from '@/icons';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { toast } from 'sonner';

const FIELDS_SANTRI: ExcelField[] = [
  { key: 'nama', label: 'Santri', kind: 'static' },
  { key: 'nisn', label: 'NISN', kind: 'static', width: 120 },
  { key: 'kelas', label: 'Kelas', kind: 'static', width: 100 },
];

const FIELDS_BIAYA: ExcelField[] = [
  { key: 'jenis', label: 'Jenis Tagihan', kind: 'static', width: 150 },
  { key: 'periode', label: 'Periode', kind: 'static', width: 90 },
  { key: 'sisa', label: 'Sisa', kind: 'static', width: 110 },
];

const FIELDS_CHECKOUT: ExcelField[] = [
  { key: 'jenis', label: 'Jenis Tagihan', kind: 'static', width: 150 },
  { key: 'periode', label: 'Periode', kind: 'static', width: 90 },
  { key: 'sisa', label: 'Sisa', kind: 'static', width: 110 },
];

const FIELDS_HARIAN: ExcelField[] = [
  { key: 'tanggal', label: 'Tanggal', kind: 'static', width: 100 },
  { key: 'kwitansi', label: 'Kwitansi', kind: 'static', width: 130 },
  { key: 'santri', label: 'Santri', kind: 'static' },
  { key: 'baris', label: 'Tagihan', kind: 'static', width: 80 },
  { key: 'total', label: 'Total', kind: 'static', width: 120 },
  { key: 'kas', label: 'Kas', kind: 'static', width: 110 },
];

const FIELDS_REKAP: ExcelField[] = [
  { key: 'jenis', label: 'Jenis Tagihan', kind: 'static' },
  { key: 'transaksi', label: 'Transaksi', kind: 'static', width: 90 },
  { key: 'total', label: 'Total', kind: 'static', width: 120 },
];

/** Opsi combobox header pembayaran (nilai enum + label). */
const OPSI_METODE: { nilai: 'tunai' | 'transfer'; label: string }[] = [
  { nilai: 'tunai', label: 'Tunai' },
  { nilai: 'transfer', label: 'Transfer' },
];
const OPSI_KAS: { nilai: 'tunai_tu' | 'bank_lembaga' | 'bank_pesantren'; label: string }[] = [
  { nilai: 'tunai_tu', label: 'Tunai TU' },
  { nilai: 'bank_lembaga', label: 'Bank Lembaga' },
  { nilai: 'bank_pesantren', label: 'Bank Pesantren' },
];

/** Label kas untuk struk/kartu (nilai enum → tulisan). */
const LABEL_KAS: Record<string, string> = {
  tunai_tu: 'Tunai TU',
  bank_lembaga: 'Bank Lembaga',
  bank_pesantren: 'Bank Pesantren',
};

/** Kwitansi yang baru tersimpan (dialog konfirmasi untuk kasir). */
interface Kwitansi {
  no: string;
  santri: string;
  jumlah: number;
  /** Jumlah tagihan dalam kwitansi ini (1 = bayar tunggal). */
  baris: number;
  /** Kas penerima (referensi laci kas kasir). */
  kas: string;
}

/** Halaman Pembayaran: kolom 1 = kartu tanggal + tombol bayar lalu tabel
 *  header transaksi harian; kolom 2 = rekap harian per jenis tagihan. Tombol
 *  Bayar membuka dialog kasir: pilih santri → centang biaya bulanan /
 *  non-bulanan → daftar bayar → bayar sekaligus satu kwitansi. */
export default function PembayaranPage() {
  const { user } = useAuth();
  const canBayar = bisa(user, 'keuangan.tambah');
  const { jenjangs, tahunAjaranNames, kelas: kelasAktif, loading: filterLoading } = useFilterGlobalAktif();

  const [err, setErr] = useState('');
  const [metode, setMetode] = useState<'tunai' | 'transfer'>('tunai');
  const [kas, setKas] = useState<'tunai_tu' | 'bank_lembaga' | 'bank_pesantren'>('tunai_tu');
  const [catatan, setCatatan] = useState('');
  /** No. kwitansi ketikan kasir; kosong = otomatis dari server. */
  const [noKwitansi, setNoKwitansi] = useState('');
  const [kwitansi, setKwitansi] = useState<Kwitansi | null>(null);

  /** Tanggal rekap harian (bisa digeser mundur/maju). */
  const [tanggal, setTanggal] = useState(hariIniIso());
  /** Dialog kasir dibuka tombol Bayar pada kartu tanggal. */
  const [bayarOpen, setBayarOpen] = useState(false);
  const [harian, setHarian] = useState<TransaksiHarianRow[]>([]);
  const [rekap, setRekap] = useState<RekapHarianJenis[]>([]);
  const [totalHarian, setTotalHarian] = useState(0);
  const [loadingHarian, setLoadingHarian] = useState(false);

  /** Dialog kasir: pencarian santri → daftar santri. */
  const [cari, setCari] = useState('');
  const [santriRows, setSantriRows] = useState<Santri[]>([]);
  const [santriLoading, setSantriLoading] = useState(false);
  /** Santri yang sedang dilayani kasir. */
  const [santriAktif, setSantriAktif] = useState<Santri | null>(null);
  /** Popover pilih santri pada dialog kasir. */
  const [santriPopOpen, setSantriPopOpen] = useState(false);
  /** Buku Induk = semua santri yang pernah terdaftar di lembaga (aktif maupun
   *  lulus/nonaktif): filter tahun ajaran TopBar diabaikan. Mati = Santri Aktif
   *  (mengikuti filter TopBar). */
  const [modeBukuInduk, setModeBukuInduk] = useState(false);
  /** Opsi kelas lingkup TopBar (rail bicara nama, endpoint minta id). */
  const [kelasOpsi, setKelasOpsi] = useState<Kelas[]>([]);
  /** Id kelas dari nama yang dipilih di rail (khusus mode Santri Aktif). */
  const kelasFilterIds = useMemo(
    () => kelasOpsi.filter((k) => kelasAktif.includes(k.nama_kelas)).map((k) => k.id),
    [kelasOpsi, kelasAktif],
  );
  /** Urut tabel santri di popover (perubahan memicu muat ulang via effect). */
  const [urutSantri, setUrutSantri] = useState<string[]>([]);
  const [arahSantri, setArahSantri] = useState<'naik' | 'turun'>('naik');
  const [arahKolomSantri, setArahKolomSantri] = useState<PetaArahKolom | undefined>(undefined);

  /** Klik header: simpan urut baru (effect memuat ulang). */
  function terapkanUrutSantri(nilai: string[], arah: 'naik' | 'turun', peta?: PetaArahKolom) {
    setUrutSantri(nilai);
    setArahSantri(arah);
    setArahKolomSantri(nilai.length > 0 ? peta : undefined);
  }
  /** Tagihan belum lunas milik santri aktif. */
  const [tagihanRows, setTagihanRows] = useState<TagihanRow[]>([]);
  const [tagihanLoading, setTagihanLoading] = useState(false);
  /** Daftar biaya yang akan dibayar (satu santri, satu kwitansi). */
  const [checkout, setCheckout] = useState<TagihanRow[]>([]);
  /** Draf cicilan per tagihan (teks ketikan; absen = lunasi sisa). */
  const [cicilan, setCicilan] = useState<Record<number, string>>({});

  const muatTagihanSantri = useCallback(async (santriId: number, bukuInduk = modeBukuInduk) => {
    setErr(''); setTagihanLoading(true);
    try {
      const res = await daftarTagihan({
        santri_id: santriId,
        belum_lunas: true,
        jenjang: jenjangs,
        tahun_ajaran: bukuInduk ? undefined : tahunAjaranNames,
        per_page: '200',
      });
      setTagihanRows(res.data);
    } catch (e) { setErr(errorMessage(e)); } finally { setTagihanLoading(false); }
  }, [jenjangs, modeBukuInduk, tahunAjaranNames]);

  /** Id santri terpilih (cermin ref agar auto-select tak memakai closure basi
   *  dan tak mengosongkan daftar bayar saat pencarian diketik ulang). */
  const santriAktifIdRef = useRef<number | null>(null);

  /** Ganti cakupan santri (dua checkbox eksklusif, bawaan Santri Aktif). */
  function gantiModeSantri(buku: boolean) {
    setModeBukuInduk(buku);
    if (santriAktif !== null) void muatTagihanSantri(santriAktif.id, buku);
  }

  /** Pilih santri yang dilayani; ganti santri mengosongkan daftar bayar. */
  const pilihSantri = useCallback((s: Santri) => {
    if (santriAktifIdRef.current !== s.id) {
      santriAktifIdRef.current = s.id;
      setSantriAktif(s);
      setCheckout([]);
      setCicilan({});
    }
    void muatTagihanSantri(s.id);
  }, [muatTagihanSantri]);

  useEffect(() => {
    if (filterLoading || jenjangs.length === 0) { setKelasOpsi([]); return; }
    let hidup = true;
    listKelas({ jenjang: jenjangs, tahun_ajaran: tahunAjaranNames, per_page: 1000 })
      .then((p) => { if (hidup) setKelasOpsi(p.data); })
      .catch(() => { if (hidup) setKelasOpsi([]); });
    return () => { hidup = false; };
  }, [filterLoading, jenjangs, tahunAjaranNames]);

  const muatSantri = useCallback(async () => {
    const q = cari.trim();
    // Di luar dialog tak perlu memuat apa pun; di dalam dialog daftar tampil
    // semua sejak awal (ketikan menyaring).
    if (filterLoading || (!bayarOpen && q === '')) { if (!bayarOpen) setSantriRows([]); return; }
    setErr(''); setSantriLoading(true);
    try {
      const res = await listSantri({
        q: q === '' ? undefined : q,
        jenjang: jenjangs,
        tahun_ajaran: modeBukuInduk ? undefined : tahunAjaranNames,
        kelas_id: !modeBukuInduk && kelasFilterIds.length ? kelasFilterIds : undefined,
        per_page: 50,
        sort: urutSantri.length ? tokenUrut(urutSantri, arahKolomSantri) : undefined,
        arah: urutSantri.length ? arahSantri : undefined,
      });
      setSantriRows(res.data);
      // Satu hasil pasti = langsung layani (mis. pindai NIS).
      if (q !== '' && res.data.length === 1) pilihSantri(res.data[0]);
    } catch (e) { setErr(errorMessage(e)); } finally { setSantriLoading(false); }
  }, [cari, filterLoading, bayarOpen, modeBukuInduk, kelasFilterIds, urutSantri, arahSantri, arahKolomSantri, jenjangs, tahunAjaranNames, pilihSantri]);

  // Ketikan ditahan sebentar agar tidak memanggil API tiap karakter.
  useEffect(() => {
    const t = setTimeout(() => { void muatSantri(); }, 250);
    return () => clearTimeout(t);
  }, [muatSantri]);

  // Buka dialog dengan santri yang sama → muat ulang tagihannya.
  useEffect(() => {
    if (bayarOpen && santriAktif !== null) void muatTagihanSantri(santriAktif.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bayarOpen]);

  const muatHarian = useCallback(async () => {
    if (filterLoading || tanggal === '') return;
    setErr(''); setLoadingHarian(true);
    try {
      const res = await daftarPembayaranHarian(tanggal, {
        jenjang: jenjangs,
        tahun_ajaran: tahunAjaranNames,
      });
      setHarian(res.data);
      setRekap(res.rekap);
      setTotalHarian(res.total);
    } catch (e) { setErr(errorMessage(e)); } finally { setLoadingHarian(false); }
  }, [tanggal, filterLoading, jenjangs, tahunAjaranNames]);

  useEffect(() => { void muatHarian(); }, [muatHarian]);

  const sisa = (r: TagihanRow) => Math.max(0, r.nominal - r.terbayar);
  /** Jumlah yang akan dibayar satu baris: draf ketikan, atau sisa bila kosong.
   *  `null` = ketikan bukan angka (ditolak saat bayar). */
  const jumlahBayar = useCallback((r: TagihanRow): number | null => {
    const teks = cicilan[r.id];
    if (teks === undefined || teks.trim() === '') return sisa(r);
    const n = Number(teks);
    if (!Number.isFinite(n)) return null;
    return Math.floor(n);
  }, [cicilan]);
  const bulanan = useMemo(
    () => tagihanRows
      .filter((r) => r.jenis?.tipe === 'bulanan')
      // Bulan tertua dulu (periode `YYYY-MM`; tanpa periode di paling bawah).
      .sort((a, b) => {
        if (a.periode === null && b.periode === null) return 0;
        if (a.periode === null) return 1;
        if (b.periode === null) return -1;
        return a.periode < b.periode ? -1 : (a.periode > b.periode ? 1 : 0);
      }),
    [tagihanRows],
  );
  const nonBulanan = useMemo(
    () => tagihanRows.filter((r) => r.jenis?.tipe !== 'bulanan'),
    [tagihanRows],
  );
  const dalamCheckout = useMemo(() => new Set(checkout.map((r) => r.id)), [checkout]);
  const checkoutBayar = useMemo(
    () => checkout.filter((r) => (jumlahBayar(r) ?? 0) > 0),
    [checkout, jumlahBayar],
  );
  const totalCheckout = useMemo(
    () => checkout.reduce((t, r) => t + (jumlahBayar(r) ?? 0), 0),
    [checkout, jumlahBayar],
  );
  /** Subtotal sisa per tabel biaya (bantuan kasir sebelum menambah). */
  const totalBulanan = useMemo(() => bulanan.reduce((t, r) => t + sisa(r), 0), [bulanan]);
  const totalNonBulanan = useMemo(() => nonBulanan.reduce((t, r) => t + sisa(r), 0), [nonBulanan]);

  function tambahCheckout(r: TagihanRow) {
    if (sisa(r) <= 0 || dalamCheckout.has(r.id)) return;
    setCheckout((prev) => [...prev, r]);
  }

  const bayarCheckout = async () => {
    const items: { tagihan_id: number; jumlah: number }[] = [];
    for (const r of checkout) {
      const j = jumlahBayar(r);
      if (j === null || j < 1 || j > sisa(r)) {
        toast.error(`Jumlah ${r.jenis?.nama ?? 'tagihan'} tidak valid (1–${sisa(r).toLocaleString('id')}).`);
        return;
      }
      items.push({ tagihan_id: r.id, jumlah: j });
    }
    if (items.length === 0) { toast.warning('Daftar bayar masih kosong.'); return; }
    try {
      const t = await catatTransaksi({
        items,
        metode,
        kas,
        catatan: catatan.trim() === '' ? null : catatan.trim(),
        no_kwitansi: noKwitansi.trim() === '' ? undefined : noKwitansi.trim(),
      });
      setKwitansi({
        no: t.no_kwitansi,
        santri: santriAktif?.nama_lengkap ?? '—',
        jumlah: t.total,
        baris: t.jumlah_baris,
        kas,
      });
      setCheckout([]); setCicilan({}); setCatatan(''); setNoKwitansi('');
      if (santriAktif !== null) await muatTagihanSantri(santriAktif.id);
      await muatHarian();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  /** NIS lokal per lembaga santri aktif (mis. "MI: 7741 • MD: 221"). */
  const nisLokalAktif = (santriAktif?.lembaga_aktif ?? [])
    .map((l) => `${l.jenjang}: ${l.nis_lokal ?? '—'}`)
    .join(' • ');
  /** Rekap butuh `id` untuk ExcelTable (jenis_id bisa null). */
  const rekapRows = rekap.map((r, i) => ({ ...r, id: r.jenis_id ?? `tanpa-${i}` }));

  const tombolTambah = (r: TagihanRow) => {
    const sudah = dalamCheckout.has(r.id);
    return (
      <Button
        id={`btn_bayar_tambah_${r.id}`}
        size="sm"
        variant={sudah ? 'ghost' : 'outline'}
        disabled={!canBayar || sudah || sisa(r) <= 0}
        title={sudah ? 'Sudah masuk daftar bayar' : `Tambah ${r.jenis?.nama ?? 'tagihan'} ke daftar bayar`}
        onClick={() => tambahCheckout(r)}
      >
        {sudah ? 'Ditambah' : 'Tambah'}
      </Button>
    );
  };

  const nilaiBiaya = (r: TagihanRow) => ({
    jenis: r.jenis?.nama ?? null,
    periode: r.periode,
    sisa: sisa(r).toLocaleString('id'),
  });

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <PengaturanHalaman tampil={{}} tabel={[
        { key: 'pembayaran_harian', judul: 'Transaksi Harian', fields: FIELDS_HARIAN },
        { key: 'pembayaran_rekap', judul: 'Rekap Harian', fields: FIELDS_REKAP },
        { key: 'pembayaran_santri', judul: 'Daftar Santri', fields: FIELDS_SANTRI },
        { key: 'pembayaran_bulanan', judul: 'Biaya Bulanan', fields: FIELDS_BIAYA },
        { key: 'pembayaran_non_bulanan', judul: 'Biaya Non-Bulanan', fields: FIELDS_BIAYA },
        { key: 'pembayaran_checkout', judul: 'Daftar Bayar', fields: FIELDS_CHECKOUT },
      ]} />

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1" id="grup_pembayaran_kolom">
        <ResizablePanel id="panel_pembayaran_harian" defaultSize="600px" minSize="600px" groupResizeBehavior="preserve-pixel-size" className="flex min-h-0 flex-col">
          <div className="flex h-full min-h-0 flex-col gap-3 pr-1">
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 p-4">
              <p className="w-full text-xs">
                <span className="text-muted-foreground">Petugas: </span>
                <span id="teks_petugas_kasir" className="font-semibold">
                  {user?.pegawai?.nama_lengkap ?? user?.name ?? '—'}
                </span>
                {(user?.roles?.length ?? 0) > 0 && (
                  <span className="text-muted-foreground">
                    {' '}({user?.roles?.map((r) => r.name).join(', ')})
                  </span>
                )}
              </p>
              <LabeledInput
                label="Tanggal"
                htmlFor="inp_harian_tanggal"
                type="date"
                tipeKontrol="tanggal"
                tipeTerkunci
                kelolaLebar={false}
                className="w-60"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
              />
              <p className="ml-auto text-xs text-muted-foreground tabular-nums">
                {harian.length} transaksi • Rp {totalHarian.toLocaleString('id')}
              </p>
            </CardContent>
          </Card>

          <ExcelTable<TransaksiHarianRow>
            tableKey="pembayaran_harian"
            fields={FIELDS_HARIAN}
            rows={harian}
            getValues={(r) => ({
              tanggal: tanggalKeTampilan(r.tanggal),
              kwitansi: r.no_kwitansi ?? null,
              santri: r.santri ?? null,
              baris: `${r.jumlah_baris} tagihan`,
              total: r.total.toLocaleString('id'),
              kas: r.kas === null ? null : (LABEL_KAS[r.kas] ?? r.kas),
            })}
            loading={loadingHarian}
            emptyText="Belum ada transaksi pada tanggal ini."
            canEdit={false}
            onCommit={async () => {}}
            onSaved={() => {}}
            renderActions={() => null}
            hideCheckbox
            hideActions
          />
          <Button
            id="btn_tambah_pembayaran"
            className="w-full shrink-0"
            size="lg"
            disabled={!canBayar}
            title={canBayar ? 'Catat pembayaran baru' : 'Butuh izin keuangan.tambah'}
            onClick={() => { setBayarOpen(true); }}
          >
            <Plus data-icon="inline-start" size={16} /> Tambah Pembayaran
          </Button>
          </div>
        </ResizablePanel>

        <ResizableHandle orientation="horizontal" withHandle id="gagang_pembayaran_kolom" />

        <ResizablePanel id="panel_pembayaran_rekap" defaultSize="40%" minSize="20%" groupResizeBehavior="preserve-relative-size" className="flex min-h-0 flex-col">
          <div className="flex h-full min-h-0 flex-col pl-1">
          <ExcelTable<RekapHarianJenis & { id: string | number }>
            tableKey="pembayaran_rekap"
            fields={FIELDS_REKAP}
            rows={rekapRows}
            getValues={(r) => ({
              jenis: r.jenis_nama,
              transaksi: String(r.jumlah_transaksi),
              total: r.total.toLocaleString('id'),
            })}
            loading={loadingHarian}
            emptyText="Belum ada rekap pada tanggal ini."
            canEdit={false}
            onCommit={async () => {}}
            onSaved={() => {}}
            renderActions={() => null}
            hideCheckbox
            hideActions
          />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <Dialog open={bayarOpen} onOpenChange={(o) => { setBayarOpen(o); }}>
        <DialogContent className="h-[100dvh] max-h-none w-screen max-w-none flex flex-col sm:max-w-none">
          <DialogHeader>
            <DialogTitle>Catat Pembayaran</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1">
          <ResizablePanelGroup orientation="horizontal" className="min-h-0 h-full" id="grup_bayar_kolom">
            <ResizablePanel id="panel_bayar_kiri" defaultSize="45%" minSize="25%" className="flex min-h-0 flex-col">
              <div className="flex h-full min-h-0 flex-col gap-2 pr-1">
              <Card id="kartu_bayar_santri">
                <CardContent className="grid gap-0 p-4 [&>*+*]:-mt-px">
                  <div className="grid gap-1 pb-2">
                    <span className="text-sm font-medium leading-none">Santri</span>
                    <Popover open={santriPopOpen} onOpenChange={setSantriPopOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          id="btn_pilih_santri"
                          className="justify-center font-normal"
                        >
                          {santriAktif?.nama_lengkap ?? 'Pilih Santri…'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="flex max-h-[70vh] w-(--radix-popper-anchor-width) flex-col border border-foreground/30 p-2" align="start">
                    <div className="mb-2 flex shrink-0 items-center justify-end gap-3 text-xs">
                      <label htmlFor="cek_santri_aktif" className="flex cursor-pointer items-center gap-1.5">
                        <Checkbox
                          id="cek_santri_aktif"
                          checked={!modeBukuInduk}
                          onCheckedChange={() => gantiModeSantri(false)}
                        />
                        Santri Aktif
                      </label>
                      <label htmlFor="cek_buku_induk" className="flex cursor-pointer items-center gap-1.5">
                        <Checkbox
                          id="cek_buku_induk"
                          checked={modeBukuInduk}
                          onCheckedChange={() => gantiModeSantri(true)}
                        />
                        Buku Induk
                      </label>
                    </div>
                    <Input
                      id="inp_cari_santri"
                      placeholder="Ketik nama / NIS / nama ortu…"
                      value={cari}
                      onChange={(e) => setCari(e.target.value)}
                      className="mb-2 shrink-0"
                    />
                    <ExcelTable<Santri>
                      tableKey="pembayaran_santri"
                      sumberTabel="santri"
                      fields={FIELDS_SANTRI}
                      rows={santriRows}
                      getValues={(r) => ({
                        nama: r.nama_lengkap,
                        nisn: r.nisn ?? null,
                        kelas: r.kelas ?? null,
                      })}
                      loading={santriLoading}
                      emptyText="Belum ada santri."
                      canEdit={false}
                      onCommit={async () => {}}
                      onSaved={() => {}}
                      renderActions={() => null}
                      hideCheckbox
                      hideActions
                      rail={!modeBukuInduk}
                      urutAktif={urutSantri}
                      arahUrut={arahSantri}
                      onUrut={terapkanUrutSantri}
                      onBarisKlik={(r) => { pilihSantri(r); setSantriPopOpen(false); }}
                      barisAktifId={santriAktif?.id ?? null}
                    />
                  </PopoverContent>
                </Popover>
              </div>
                    <LabeledInput
                      label="Nama lengkap"
                      htmlFor="inp_info_nama"
                      tipeTerkunci
                      lebarLabel={100}
                      kelolaLebar={false}
                      disabled
                      readOnly
                      value={santriAktif?.nama_lengkap ?? ''}
                      onChange={() => {}}
                    />
                    <LabeledInput
                      label="NIS lokal"
                      htmlFor="inp_info_nis"
                      tipeTerkunci
                      lebarLabel={100}
                      kelolaLebar={false}
                      disabled
                      readOnly
                      value={nisLokalAktif}
                      onChange={() => {}}
                    />
                    <LabeledInput
                      label="Ayah"
                      htmlFor="inp_info_ayah"
                      tipeTerkunci
                      lebarLabel={100}
                      kelolaLebar={false}
                      disabled
                      readOnly
                      value={santriAktif?.ayah_nama ?? ''}
                      onChange={() => {}}
                    />
                    <LabeledInput
                      label="Ibu"
                      htmlFor="inp_info_ibu"
                      tipeTerkunci
                      lebarLabel={100}
                      kelolaLebar={false}
                      disabled
                      readOnly
                      value={santriAktif?.ibu_nama ?? ''}
                      onChange={() => {}}
                    />
                  </CardContent>
                </Card>
              <Card>
                <CardContent className="grid gap-0 p-4 [&>*+*]:-mt-px">
                  <LabeledInput
                    label="Tanggal"
                    htmlFor="inp_bayar_tanggal"
                    type="date"
                    tipeKontrol="tanggal"
                    tipeTerkunci
                    kelolaLebar={false}
                    lebarLabel={100}
                    disabled
                    readOnly
                    value={hariIniIso()}
                    onChange={() => {}}
                  />
                  <LabeledInput
                    label="No. Kwitansi"
                    htmlFor="inp_bayar_kwitansi"
                    tipeTerkunci
                    kelolaLebar={false}
                    lebarLabel={100}
                    placeholder="Otomatis"
                    value={noKwitansi}
                    onChange={(e) => setNoKwitansi(e.target.value)}
                  />
                  <LabeledCombobox label="Metode" htmlFor="sel_bayar_metode" kelolaLebar={false} lebarLabel={100}>
                    <ComboboxRoot
                      items={OPSI_METODE}
                      itemToStringLabel={(o) => o.label}
                      isItemEqualToValue={(a, b) => a.nilai === b.nilai}
                      value={OPSI_METODE.find((o) => o.nilai === metode) ?? OPSI_METODE[0]}
                      onValueChange={(o) => { if (o !== null) setMetode(o.nilai); }}
                    >
                      <ComboboxInput id="sel_bayar_metode" aria-label="Metode pembayaran" />
                      <ComboboxTrigger aria-label="Buka daftar metode" />
                      <ComboboxContent>
                        <ComboboxEmpty>Tidak ada metode.</ComboboxEmpty>
                        <ComboboxList>
                          {(o) => <ComboboxItem key={o.nilai} value={o}>{o.label}</ComboboxItem>}
                        </ComboboxList>
                      </ComboboxContent>
                    </ComboboxRoot>
                  </LabeledCombobox>
                  <LabeledCombobox label="Kas" htmlFor="sel_bayar_kas" kelolaLebar={false} lebarLabel={100}>
                    <ComboboxRoot
                      items={OPSI_KAS}
                      itemToStringLabel={(o) => o.label}
                      isItemEqualToValue={(a, b) => a.nilai === b.nilai}
                      value={OPSI_KAS.find((o) => o.nilai === kas) ?? OPSI_KAS[0]}
                      onValueChange={(o) => { if (o !== null) setKas(o.nilai); }}
                    >
                      <ComboboxInput id="sel_bayar_kas" aria-label="Kas pembayaran" />
                      <ComboboxTrigger aria-label="Buka daftar kas" />
                      <ComboboxContent>
                        <ComboboxEmpty>Tidak ada kas.</ComboboxEmpty>
                        <ComboboxList>
                          {(o) => <ComboboxItem key={o.nilai} value={o}>{o.label}</ComboboxItem>}
                        </ComboboxList>
                      </ComboboxContent>
                    </ComboboxRoot>
                  </LabeledCombobox>
                  <LabeledInput
                    label="Catatan"
                    htmlFor="inp_bayar_catatan"
                    tipeTerkunci
                    kelolaLebar={false}
                    lebarLabel={100}
                    placeholder="Catatan (opsional)"
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                  />
                </CardContent>
              </Card>
              <ExcelTable<TagihanRow>
                tableKey="pembayaran_checkout"
                fields={FIELDS_CHECKOUT}
                rows={checkout}
                getValues={nilaiBiaya}
                emptyText="Belum ada biaya yang akan dibayar — tambah dari tabel sebelah kanan."
                canEdit={false}
                onCommit={async () => {}}
                onSaved={() => {}}
                renderActions={(r) => (
                  <div className="flex items-center gap-1">
                    <Input
                      id={`inp_cicilan_${r.id}`}
                      type="number"
                      min={1}
                      max={sisa(r)}
                      aria-label={`Jumlah bayar ${r.jenis?.nama ?? 'tagihan'}`}
                      title={`Cicilan — kosongkan untuk melunasi sisa Rp ${sisa(r).toLocaleString('id')}`}
                      value={cicilan[r.id] ?? String(sisa(r))}
                      onChange={(e) => setCicilan((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      className="w-28"
                    />
                    <Button
                      id={`btn_checkout_hapus_${r.id}`}
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setCheckout((prev) => prev.filter((x) => x.id !== r.id));
                        setCicilan((prev) => {
                          const next = { ...prev };
                          delete next[r.id];
                          return next;
                        });
                      }}
                    >
                      Hapus
                    </Button>
                  </div>
                )}
                hideCheckbox
                tengah={
                  <span>
                    Detail pembayaran
                    {checkoutBayar.length > 0 && (
                      <span className="text-muted-foreground tabular-nums">
                        {' '}• {checkoutBayar.length} tagihan • Rp {totalCheckout.toLocaleString('id')}
                      </span>
                    )}
                  </span>
                }
              />
              <div className="grid shrink-0 gap-2">
                <Card id="kartu_bayar_total">
                  <CardContent className="grid gap-1 p-4 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Jumlah tagihan</span>
                      <span className="tabular-nums">{checkoutBayar.length} tagihan</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Total pembayaran</span>
                      <span className="text-sm font-semibold tabular-nums">
                        Rp {totalCheckout.toLocaleString('id')}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <Button
                  id="btn_bayar_sekaligus"
                  className="w-full"
                  size="lg"
                  disabled={!canBayar || checkoutBayar.length === 0}
                  title={canBayar ? 'Bayar seluruh daftar dalam satu kwitansi' : 'Butuh izin keuangan.tambah'}
                  onClick={() => { void bayarCheckout(); }}
                >
                  Bayar
                </Button>
              </div>
              </div>
            </ResizablePanel>

            <ResizableHandle orientation="horizontal" withHandle id="gagang_bayar_kolom" />

            <ResizablePanel id="panel_bayar_kanan" defaultSize="55%" minSize="25%" className="flex min-h-0 flex-col">
              <div className="flex h-full min-h-0 flex-col gap-2 pl-1">
              <ExcelTable<TagihanRow>
                tableKey="pembayaran_bulanan"
                fields={FIELDS_BIAYA}
                rows={bulanan}
                getValues={nilaiBiaya}
                loading={tagihanLoading}
                emptyText={santriAktif === null
                  ? 'Pilih santri dulu untuk melihat biaya bulanannya.'
                  : 'Tidak ada biaya bulanan belum lunas.'}
                canEdit={false}
                onCommit={async () => {}}
                onSaved={() => {}}
                renderActions={tombolTambah}
                hideCheckbox
                tengah={
                  <span>
                    Biaya bulanan
                    {bulanan.length > 0 && (
                      <span className="text-muted-foreground tabular-nums">
                        {' '}• {bulanan.length} • Rp {totalBulanan.toLocaleString('id')}
                      </span>
                    )}
                  </span>
                }
              />
              <ExcelTable<TagihanRow>
                tableKey="pembayaran_non_bulanan"
                fields={FIELDS_BIAYA}
                rows={nonBulanan}
                getValues={nilaiBiaya}
                loading={tagihanLoading}
                emptyText={santriAktif === null
                  ? 'Pilih santri dulu untuk melihat biaya non-bulanannya.'
                  : 'Tidak ada biaya non-bulanan belum lunas.'}
                canEdit={false}
                onCommit={async () => {}}
                onSaved={() => {}}
                renderActions={tombolTambah}
                hideCheckbox
                tengah={
                  <span>
                    Biaya non-bulanan
                    {nonBulanan.length > 0 && (
                      <span className="text-muted-foreground tabular-nums">
                        {' '}• {nonBulanan.length} • Rp {totalNonBulanan.toLocaleString('id')}
                      </span>
                    )}
                  </span>
                }
              />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={kwitansi !== null} onOpenChange={(o) => { if (!o) setKwitansi(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pembayaran tersimpan</DialogTitle>
            <DialogDescription>Berikan nomor kwitansi ini kepada penyetor.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-2 text-xs">
            <span className="text-muted-foreground">No. Kwitansi</span>
            <span id="teks_no_kwitansi" className="select-all font-mono font-semibold">{kwitansi?.no}</span>
            <span className="text-muted-foreground">Santri</span>
            <span>{kwitansi?.santri}</span>
            <span className="text-muted-foreground">Kas</span>
            <span>{kwitansi ? (LABEL_KAS[kwitansi.kas] ?? kwitansi.kas) : '—'}</span>
            {(kwitansi?.baris ?? 1) > 1 && (
              <>
                <span className="text-muted-foreground">Tagihan</span>
                <span className="tabular-nums">{kwitansi?.baris} tagihan (1 kwitansi)</span>
              </>
            )}
            <span className="text-muted-foreground">Jumlah</span>
            <span className="tabular-nums">{kwitansi?.jumlah.toLocaleString('id')}</span>
          </div>
          <DialogFooter>
            <Button id="btn_kwitansi_tutup" onClick={() => setKwitansi(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
