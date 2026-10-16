import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import {
  catatPembayaran, daftarPembayaranHarian, daftarTagihan,
  type PembayaranHarianRow, type RekapHarianJenis, type TagihanRow,
} from '../api/keuangan';
import { tokenUrut, type PetaArahKolom } from '@/lib/urut';
import { hariIniIso } from '@/lib/tanggal';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { TopBarSearch } from '@/components/TopBarSearch';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { toast } from 'sonner';

const FIELDS: ExcelField[] = [
  { key: 'santri', label: 'Santri', kind: 'static' },
  { key: 'jenis', label: 'Jenis Tagihan', kind: 'static', width: 150 },
  { key: 'periode', label: 'Periode', kind: 'static', width: 90 },
  { key: 'tahun_ajaran', label: 'Tahun Ajaran', kind: 'static', width: 110 },
  { key: 'nominal', label: 'Nominal', kind: 'static', width: 110 },
  { key: 'terbayar', label: 'Terbayar', kind: 'static', width: 110 },
  { key: 'sisa', label: 'Sisa', kind: 'static', width: 110 },
];

const FIELDS_HARIAN: ExcelField[] = [
  { key: 'waktu', label: 'Jam', kind: 'static', width: 70 },
  { key: 'kwitansi', label: 'Kwitansi', kind: 'static', width: 130 },
  { key: 'santri', label: 'Santri', kind: 'static' },
  { key: 'jenis', label: 'Jenis Tagihan', kind: 'static', width: 150 },
  { key: 'jumlah', label: 'Jumlah', kind: 'static', width: 110 },
  { key: 'kas', label: 'Kas', kind: 'static', width: 110 },
];

const FIELDS_REKAP: ExcelField[] = [
  { key: 'jenis', label: 'Jenis Tagihan', kind: 'static' },
  { key: 'transaksi', label: 'Transaksi', kind: 'static', width: 90 },
  { key: 'total', label: 'Total', kind: 'static', width: 120 },
];

/** Kwitansi yang baru tersimpan (dialog konfirmasi untuk kasir). */
interface Kwitansi {
  no: string;
  santri: string;
  jumlah: number;
}

/** Halaman Pembayaran: kolom 1 = kartu tanggal + tombol bayar lalu tabel
 *  pembayaran harian; kolom 2 = rekap harian per jenis tagihan. Alur kasir
 *  (cari santri → bayar) pindah ke dialog yang dibuka tombol Bayar. */
export default function PembayaranPage() {
  const { user } = useAuth();
  const canBayar = bisa(user, 'keuangan.tambah');
  const { jenjangs, tahunAjaranNames, loading: filterLoading } = useFilterGlobalAktif();

  const [cari, setCari] = useState('');
  const [rows, setRows] = useState<TagihanRow[]>([]);
  const [loading, setLoading] = useState(false);
  /** Urut header tabel kasir (perubahan memicu muat ulang via effect). */
  const [urut, setUrut] = useState<string[]>([]);
  const [arahUrut, setArahUrut] = useState<'naik' | 'turun'>('naik');
  const [arahKolom, setArahKolom] = useState<PetaArahKolom | undefined>(undefined);

  /** Klik header: simpan urut baru (effect memuat ulang). */
  function terapkanUrut(nilai: string[], arah: 'naik' | 'turun', peta?: PetaArahKolom) {
    setUrut(nilai);
    setArahUrut(arah);
    setArahKolom(nilai.length > 0 ? peta : undefined);
  }
  const [err, setErr] = useState('');
  const [bayarId, setBayarId] = useState<number | null>(null);
  const [jumlah, setJumlah] = useState('');
  const [metode, setMetode] = useState<'tunai' | 'transfer'>('tunai');
  const [kas, setKas] = useState<'tunai_tu' | 'bank_lembaga' | 'bank_pesantren'>('tunai_tu');
  const [catatan, setCatatan] = useState('');
  const [kwitansi, setKwitansi] = useState<Kwitansi | null>(null);

  /** Tanggal rekap harian (bisa digeser mundur/maju). */
  const [tanggal, setTanggal] = useState(hariIniIso());
  /** Dialog kasir dibuka tombol Bayar pada kartu tanggal. */
  const [bayarOpen, setBayarOpen] = useState(false);
  const [harian, setHarian] = useState<PembayaranHarianRow[]>([]);
  const [rekap, setRekap] = useState<RekapHarianJenis[]>([]);
  const [totalHarian, setTotalHarian] = useState(0);
  const [loadingHarian, setLoadingHarian] = useState(false);

  const muat = useCallback(async () => {
    const q = cari.trim();
    if (filterLoading || q === '') { setRows([]); return; }
    setErr(''); setLoading(true);
    try {
      const res = await daftarTagihan({
        santri: q,
        belum_lunas: true,
        jenjang: jenjangs,
        tahun_ajaran: tahunAjaranNames,
        per_page: '200',
        sort: urut.length ? tokenUrut(urut, arahKolom) : undefined,
        arah: urut.length ? arahUrut : undefined,
      });
      setRows(res.data);
    } catch (e) { setErr(errorMessage(e)); } finally { setLoading(false); }
  }, [cari, filterLoading, jenjangs, tahunAjaranNames, urut, arahUrut, arahKolom]);

  // Ketikan ditahan sebentar agar tidak memanggil API tiap karakter.
  useEffect(() => {
    const t = setTimeout(() => { void muat(); }, 250);
    return () => clearTimeout(t);
  }, [muat]);

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

  const simpan = async (r: TagihanRow) => {
    const nilai = Number(jumlah);
    if (!Number.isFinite(nilai) || nilai < 1) { toast.error('Jumlah pembayaran tidak valid.'); return; }
    try {
      const p = await catatPembayaran({
        tagihan_id: r.id,
        jumlah: nilai,
        metode,
        kas,
        catatan: catatan.trim() === '' ? null : catatan.trim(),
      });
      setKwitansi({ no: p.no_kwitansi, santri: r.santri?.nama_lengkap ?? '—', jumlah: nilai });
      setBayarId(null); setCatatan('');
      await muat();
      await muatHarian();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const jam = (iso: string) => iso.slice(11, 16) || '—';
  /** Rekap butuh `id` untuk ExcelTable (jenis_id bisa null). */
  const rekapRows = rekap.map((r, i) => ({ ...r, id: r.jenis_id ?? `tanpa-${i}` }));

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <PengaturanHalaman tampil={{}} tabel={[
        { key: 'pembayaran_harian', judul: 'Pembayaran Harian', fields: FIELDS_HARIAN },
        { key: 'pembayaran_rekap', judul: 'Rekap Harian', fields: FIELDS_REKAP },
        { key: 'pembayaran_kasir', judul: 'Kasir', fields: FIELDS },
      ]} />

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1" id="grup_pembayaran_kolom">
        <ResizablePanel id="panel_pembayaran_harian" defaultSize="60%" minSize="25%" className="flex min-h-0 flex-col">
          <div className="flex h-full min-h-0 flex-col gap-3 pr-1">
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 p-4">
              <div className="grid gap-1">
                <Label htmlFor="inp_harian_tanggal">Tanggal</Label>
                <Input
                  id="inp_harian_tanggal"
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-44"
                />
              </div>
              <Button
                id="btn_harian_bayar"
                disabled={!canBayar}
                title={canBayar ? 'Catat pembayaran baru' : 'Butuh izin keuangan.tambah'}
                onClick={() => { setBayarOpen(true); }}
              >
                Bayar
              </Button>
              <p className="ml-auto text-xs text-muted-foreground tabular-nums">
                {harian.length} transaksi • Rp {totalHarian.toLocaleString('id')}
              </p>
            </CardContent>
          </Card>

          <ExcelTable<PembayaranHarianRow>
            tableKey="pembayaran_harian"
            fields={FIELDS_HARIAN}
            rows={harian}
            getValues={(r) => ({
              waktu: jam(r.waktu),
              kwitansi: r.no_kwitansi ?? null,
              santri: r.santri ?? null,
              jenis: r.jenis_nama ?? null,
              jumlah: r.jumlah.toLocaleString('id'),
              kas: r.kas,
            })}
            loading={loadingHarian}
            emptyText="Belum ada pembayaran pada tanggal ini."
            canEdit={false}
            onCommit={async () => {}}
            onSaved={() => {}}
            renderActions={() => null}
            hideCheckbox
            hideActions
          />
          </div>
        </ResizablePanel>

        <ResizableHandle orientation="horizontal" withHandle id="gagang_pembayaran_kolom" />

        <ResizablePanel id="panel_pembayaran_rekap" defaultSize="40%" minSize="20%" className="flex min-h-0 flex-col">
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

      <Dialog open={bayarOpen} onOpenChange={(o) => { setBayarOpen(o); if (!o) { setBayarId(null); setCatatan(''); } }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Catat Pembayaran</DialogTitle>
            <DialogDescription>Cari santri lalu bayar tagihan yang belum lunas.</DialogDescription>
          </DialogHeader>
          <TopBarSearch value={cari} onChange={setCari} placeholder="Cari nama / NIS santri…" />
          <ExcelTable<TagihanRow>
            tableKey="pembayaran_kasir"
            fields={FIELDS}
            rows={rows}
            urutAktif={urut}
            arahUrut={arahUrut}
            onUrut={terapkanUrut}
            getValues={(r) => ({
              santri: r.santri?.nama_lengkap ?? null,
              jenis: r.jenis?.nama ?? null,
              periode: r.periode,
              tahun_ajaran: r.tahun_ajaran,
              nominal: r.nominal.toLocaleString('id'),
              terbayar: r.terbayar.toLocaleString('id'),
              sisa: sisa(r).toLocaleString('id'),
            })}
            loading={loading}
            emptyText={cari.trim() === ''
              ? 'Ketik nama atau NIS santri untuk menampilkan tagihan belum lunas.'
              : 'Tidak ada tagihan belum lunas untuk pencarian ini.'}
            canEdit={false}
            onCommit={async () => {}}
            onSaved={() => {}}
            renderActions={(r) => (
              bayarId === r.id ? (
                <form
                  className="flex flex-wrap items-center gap-1"
                  onSubmit={(e) => { e.preventDefault(); void simpan(r); }}
                >
                  <Input
                    id={`inp_kasir_jumlah_${r.id}`}
                    type="number"
                    min={1}
                    max={sisa(r)}
                    placeholder="Jumlah"
                    value={jumlah}
                    onChange={(e) => setJumlah(e.target.value)}
                    className="w-24"
                    autoFocus
                    required
                  />
                  <Select value={metode} onValueChange={(v) => setMetode(v as 'tunai' | 'transfer')}>
                    <SelectTrigger id={`sel_kasir_metode_${r.id}`} aria-label="Metode pembayaran" className="h-[26px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tunai">Tunai</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={kas} onValueChange={(v) => setKas(v as typeof kas)}>
                    <SelectTrigger id={`sel_kasir_kas_${r.id}`} aria-label="Kas pembayaran" className="h-[26px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tunai_tu">Tunai TU</SelectItem>
                      <SelectItem value="bank_lembaga">Bank Lembaga</SelectItem>
                      <SelectItem value="bank_pesantren">Bank Pesantren</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id={`inp_kasir_catatan_${r.id}`}
                    placeholder="Catatan (opsional)"
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    className="w-40"
                  />
                  <Button id={`btn_kasir_simpan_${r.id}`} type="submit" size="sm">Simpan</Button>
                  <Button id={`btn_kasir_batal_${r.id}`} type="button" size="sm" variant="ghost" onClick={() => { setBayarId(null); setCatatan(''); }}>Batal</Button>
                </form>
              ) : (
                <Button
                  id={`btn_kasir_bayar_${r.id}`}
                  size="sm"
                  disabled={!canBayar}
                  title={canBayar ? `Bayar ${r.jenis?.nama ?? 'tagihan'}` : 'Butuh izin keuangan.tambah'}
                  onClick={() => { setBayarId(r.id); setJumlah(String(sisa(r))); setMetode('tunai'); setKas('tunai_tu'); setCatatan(''); }}
                >
                  Bayar
                </Button>
              )
            )}
            hideCheckbox
          />
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
