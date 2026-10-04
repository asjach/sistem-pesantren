import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import { catatPembayaran, daftarTagihan, type TagihanRow } from '../api/keuangan';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
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

/** Kwitansi yang baru tersimpan (dialog konfirmasi untuk kasir). */
interface Kwitansi {
  no: string;
  santri: string;
  jumlah: number;
}

/** Halaman Pembayaran (kasir admin lembaga): cari santri → daftar tagihan
 *  belum lunas → catat pembayaran → tampilkan nomor kwitansi. */
export default function PembayaranPage() {
  const { user } = useAuth();
  const canBayar = bisa(user, 'keuangan.tambah');
  const { jenjangs, tahunAjaranNames, loading: filterLoading } = useFilterGlobalAktif();

  const [cari, setCari] = useState('');
  const [rows, setRows] = useState<TagihanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [bayarId, setBayarId] = useState<number | null>(null);
  const [jumlah, setJumlah] = useState('');
  const [metode, setMetode] = useState<'tunai' | 'transfer'>('tunai');
  const [kas, setKas] = useState<'tunai_tu' | 'bank_lembaga' | 'bank_pesantren'>('tunai_tu');
  const [catatan, setCatatan] = useState('');
  const [kwitansi, setKwitansi] = useState<Kwitansi | null>(null);

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
      });
      setRows(res.data);
    } catch (e) { setErr(errorMessage(e)); } finally { setLoading(false); }
  }, [cari, filterLoading, jenjangs, tahunAjaranNames]);

  // Ketikan ditahan sebentar agar tidak memanggil API tiap karakter.
  useEffect(() => {
    const t = setTimeout(() => { void muat(); }, 250);
    return () => clearTimeout(t);
  }, [muat]);

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
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari nama / NIS santri…" />
      <PengaturanHalaman tampil={{}} tabel={[{ key: 'pembayaran_kasir', judul: 'Pembayaran', fields: FIELDS }]} />

      <ExcelTable<TagihanRow>
        tableKey="pembayaran_kasir"
        fields={FIELDS}
        rows={rows}
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
              <select id={`sel_kasir_metode_${r.id}`} value={metode} onChange={(e) => setMetode(e.target.value as 'tunai' | 'transfer')} className="border rounded px-1">
                <option value="tunai">Tunai</option>
                <option value="transfer">Transfer</option>
              </select>
              <select id={`sel_kasir_kas_${r.id}`} value={kas} onChange={(e) => setKas(e.target.value as typeof kas)} className="border rounded px-1">
                <option value="tunai_tu">Tunai TU</option>
                <option value="bank_lembaga">Bank Lembaga</option>
                <option value="bank_pesantren">Bank Pesantren</option>
              </select>
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
