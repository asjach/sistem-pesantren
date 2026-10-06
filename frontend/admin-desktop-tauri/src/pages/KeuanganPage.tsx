import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage, prefGet, prefSet } from '../api/client';
import { tokenUrut, type PetaArahKolom } from '@/lib/urut';
import {
  daftarJenis, buatJenis, ubahJenis, buatTarif, daftarTarif, ubahTarif, hapusTarif,
  daftarTunggakan, crosstabTagihan, hapusTagihan, catatPembayaran,
  riwayatPembayaran, hapusPembayaran, daftarDispensasi, hapusDispensasi,
  type JenisTagihan, type Tarif, type TunggakanRow, type PembayaranRow, type Dispensasi,
  type CrosstabTagihan,
} from '../api/keuangan';
import { listLembaga, listTahunAjaran, type Lembaga, type TahunAjaran } from '../api/master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KELAS_LIST_TAB, KELAS_PANEL_TAB, KELAS_TRIGGER } from '@/components/HalamanTabs';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FieldLabel } from '@/components/ui/field';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { Plus } from '@/icons';
import { DeleteAction } from '@/components/RowActions';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { useFilterGlobalAktif, targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { useLembagaAktif } from '@/lembagaAktif';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';
import { EditAction } from '@/components/RowActions';
import GenerateTagihanDialog from '@/components/keuangan/GenerateTagihanDialog';
import TagihanCrosstab from '@/components/keuangan/TagihanCrosstab';
import DispensasiDialog from '@/components/keuangan/DispensasiDialog';
import { tanggal } from '@/lib/tanggal';

const FIELDS_JENIS: ExcelField[] = [
  { key: 'nama', label: 'Jenis Tagihan', kind: 'static' },
  { key: 'tipe', label: 'Tipe', kind: 'static', width: 90 },
  { key: 'lembaga', label: 'Lembaga', kind: 'static', width: 130 },
  { key: 'aktif', label: 'Status', kind: 'static', width: 80 },
];

const FIELDS_TARIF: ExcelField[] = [
  { key: 'jenjang', label: 'Lembaga', kind: 'static', width: 90 },
  { key: 'tahun_ajaran', label: 'Tahun Ajaran', kind: 'static', width: 110 },
  { key: 'jenis', label: 'Jenis', kind: 'static' },
  { key: 'nominal', label: 'Nominal', kind: 'static', width: 110 },
  { key: 'aktif', label: 'Aktif', kind: 'static', width: 70 },
];

const FIELDS_TUNGGAKAN: ExcelField[] = [
  { key: 'nama', label: 'Santri', kind: 'static' },
  { key: 'jumlah_tagihan', label: 'Jml Tagihan', kind: 'static', width: 100 },
  { key: 'total_tagihan', label: 'Total', kind: 'static', width: 110 },
  { key: 'terbayar', label: 'Terbayar', kind: 'static', width: 110 },
  { key: 'tunggakan', label: 'Tunggakan', kind: 'static', width: 110 },
  { key: 'terlambat_terlama', label: 'Lewat Sejak', kind: 'static', width: 120 },
];

const FIELDS_DISPENSASI: ExcelField[] = [
  { key: 'nama', label: 'Dispensasi', kind: 'static' },
  { key: 'aturan', label: 'Aturan per Jenis', kind: 'static' },
  { key: 'santri', label: 'Santri', kind: 'static', width: 90 },
  { key: 'tahun_ajaran', label: 'TA', kind: 'static', width: 100 },
  { key: 'status', label: 'Status', kind: 'static', width: 80 },
];

const TAB_KEUANGAN = ['jenis', 'tarif', 'tagihan', 'tunggakan', 'dispensasi'] as const;

/** State urut satu tabel; perubahan state memicu muat ulang via effect. */
function useUrutTabel() {
  const [urut, setUrut] = useState<string[]>([]);
  const [arah, setArah] = useState<'naik' | 'turun'>('naik');
  const [arahKolom, setArahKolom] = useState<PetaArahKolom | undefined>(undefined);
  const terapkan = useCallback((nilai: string[], a: 'naik' | 'turun', peta?: PetaArahKolom) => {
    const p = nilai.length > 0 ? peta : undefined;
    setUrut(nilai);
    setArah(a);
    setArahKolom(p);
  }, []);
  return { urut, arah, arahKolom, terapkan };
}

/** Halaman Keuangan: jenis tagihan, tarif, tagihan, pembayaran, tunggakan. */
export default function KeuanganPage() {
  const [jenis, setJenis] = useState<JenisTagihan[]>([]);
  const [tarif, setTarif] = useState<Tarif[]>([]);
  const [tunggakan, setTunggakan] = useState<TunggakanRow[]>([]);
  const [dispensasi, setDispensasi] = useState<Dispensasi[]>([]);
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [daftarTA, setDaftarTA] = useState<TahunAjaran[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<string>('jenis');

  useEffect(() => {
    let hidup = true;
    prefGet('simpes_keuangan_tab').then((v) => {
      if (hidup && v !== null && (TAB_KEUANGAN as readonly string[]).includes(v)) setTab(v);
    }).catch(() => {});
    return () => { hidup = false; };
  }, []);

  const { page: tagihanPage, perPage: tagihanPerPage, setPage: setTagihanPage, setPerPage: setTagihanPerPage } = usePager('keuangan_tagihan');
  const [tagihanLastPage, setTagihanLastPage] = useState(1);
  const [tagihanTotal, setTagihanTotal] = useState(0);
  const { jenjangs, tahunAjaranNames, loading: filterLoading } = useFilterGlobalAktif();
  /** Jenis global (Semua) hanya untuk super_admin efektif — mati saat bertindak. */
  const { efektifSuper, peranJenjang, pilihan: pilihanLembaga } = useLembagaAktif();
  /** Urut header tiap tabel (perubahan memicu muat ulang via effect). */
  const uJenis = useUrutTabel();
  const uTarif = useUrutTabel();
  const uTunggakan = useUrutTabel();
  const uDispensasi = useUrutTabel();

  /** Crosstab tagihan: baris = santri, kolom = jenis (bulanan per bulan). */
  const [crosstab, setCrosstab] = useState<CrosstabTagihan | null>(null);
  const [cariTagihan, setCariTagihan] = useState('');
  const [urutTagihan, setUrutTagihan] = useState('');
  const [arahTagihan, setArahTagihan] = useState<'naik' | 'turun'>('naik');
  /** Tab Tagihan: hanya sel yang sudah lewat jatuh tempo. */
  const [terlambatTagihan, setTerlambatTagihan] = useState(false);

  const loadCrosstab = useCallback(async (
    page: number, perPage: number, jenjang: readonly string[], ta: readonly string[],
  ) => {
    setLoading(true);
    try {
      const res = await crosstabTagihan({
        page,
        per_page: perPage === 0 ? 'all' : String(perPage),
        jenjang,
        tahun_ajaran: ta,
        santri: cariTagihan.trim() === '' ? undefined : cariTagihan.trim(),
        sort: urutTagihan === '' ? undefined : [urutTagihan],
        arah: urutTagihan === '' ? undefined : arahTagihan,
        terlambat: terlambatTagihan || undefined,
      });
      setCrosstab(res);
      setTagihanPage(res.current_page);
      setTagihanLastPage(res.last_page);
      setTagihanTotal(res.total);
    } catch (e) {
      setErr(errorMessage(e));
      setCrosstab(null);
    } finally { setLoading(false); }
  }, [cariTagihan, urutTagihan, arahTagihan, terlambatTagihan]);

  // Filter global/pencarian/urut berubah → muat dari halaman 1.
  useEffect(() => {
    if (filterLoading || jenjangs.length === 0) { if (!filterLoading && jenjangs.length === 0) setCrosstab(null); return; }
    void loadCrosstab(1, tagihanPerPage, jenjangs, tahunAjaranNames);
  }, [filterLoading, jenjangs, tahunAjaranNames, tagihanPerPage, cariTagihan, urutTagihan, arahTagihan, terlambatTagihan, loadCrosstab]);

  /** Tarif mengikuti filter lembaga & tahun ajaran (server-side; kosong = semua). */
  const loadTarif = useCallback(async (jenjang: readonly string[], ta: readonly string[]) => {
    try {
      setTarif(await daftarTarif({
        jenjang, tahun_ajaran: ta,
        sort: uTarif.urut.length ? tokenUrut(uTarif.urut, uTarif.arahKolom) : undefined,
        arah: uTarif.urut.length ? uTarif.arah : undefined,
      }));
    } catch (e) { setErr(errorMessage(e)); }
  }, [uTarif.urut, uTarif.arah, uTarif.arahKolom]);

  useEffect(() => {
    if (filterLoading) return;
    void loadTarif(jenjangs, tahunAjaranNames);
  }, [filterLoading, jenjangs, tahunAjaranNames, loadTarif]);

  useEffect(() => { setTagihanPage(1); }, [jenjangs, tahunAjaranNames]);

  const load = useCallback(async () => {
    setErr(''); setLoading(true);
    try {
      const [j, w, l, tas, dispen] = await Promise.all([
        daftarJenis({
          sort: uJenis.urut.length ? tokenUrut(uJenis.urut, uJenis.arahKolom) : undefined,
          arah: uJenis.urut.length ? uJenis.arah : undefined,
        }),
        daftarTunggakan({
          sort: uTunggakan.urut.length ? tokenUrut(uTunggakan.urut, uTunggakan.arahKolom) : undefined,
          arah: uTunggakan.urut.length ? uTunggakan.arah : undefined,
        }),
        listLembaga({ per_page: 100 }),
        listTahunAjaran({ per_page: 100 }),
        daftarDispensasi({
          sort: uDispensasi.urut.length ? tokenUrut(uDispensasi.urut, uDispensasi.arahKolom) : undefined,
          arah: uDispensasi.urut.length ? uDispensasi.arah : undefined,
        }),
      ]);
      setJenis(j); setTunggakan(w.per_santri);
      setLembagas(l.data); setDaftarTA(tas.data); setDispensasi(dispen);
      const taAktif = tas.data.find((x) => x.is_aktif)?.nama ?? tas.data[0]?.nama ?? '';
      const diTA = (v: string) => v !== '' && tas.data.some((x) => x.nama === v);
      setTfTA((v) => (diTA(v) ? v : taAktif));
      const diLembaga = (v: string) => v !== '' && l.data.some((x) => x.jenjang === v);
      const jenjangBawaan = l.data.some((x) => x.jenjang === 'MI') ? 'MI' : (l.data[0]?.jenjang ?? '');
      setTfJenjang((v) => (diLembaga(v) ? v : jenjangBawaan));
    } catch (e) { setErr(errorMessage(e)); } finally { setLoading(false); }
  }, [uJenis.urut, uJenis.arah, uJenis.arahKolom, uTunggakan.urut, uTunggakan.arah, uTunggakan.arahKolom, uDispensasi.urut, uDispensasi.arah, uDispensasi.arahKolom]);
  useEffect(() => { void load(); }, [load]);

  // Form sederhana
  const [namaJenis, setNamaJenis] = useState('');
  const [tambahJenisOpen, setTambahJenisOpen] = useState(false);
  const [tambahTarifOpen, setTambahTarifOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [dispensasiOpen, setDispensasiOpen] = useState(false);
  const [editDispensasi, setEditDispensasi] = useState<Dispensasi | null>(null);
  const [editJenis, setEditJenis] = useState<JenisTagihan | null>(null);
  const [editTarif, setEditTarif] = useState<Tarif | null>(null);
  const [eNama, setENama] = useState('');
  const [eTipe, setETipe] = useState<'bulanan' | 'non_bulanan'>('non_bulanan');
  const [eJenjang, setEJenjang] = useState('');
  const [eAktif, setEAktif] = useState(true);
  const [eNominal, setENominal] = useState('');
  const [tipeJenis, setTipeJenis] = useState<'bulanan' | 'non_bulanan'>('non_bulanan');
  const [lembagaJenis, setLembagaJenis] = useState('');
  const [tfJenjang, setTfJenjang] = useState('MI');
  const [tfTA, setTfTA] = useState('2025/2026');
  const [tfJenis, setTfJenis] = useState<number | ''>('');
  const [tfNominal, setTfNominal] = useState('');
  const genTAtopbar = targetTunggal(tahunAjaranNames);
  const [bayarId, setBayarId] = useState<number | null>(null);
  const [bayarJumlah, setBayarJumlah] = useState('');
  const [bayarMetode, setBayarMetode] = useState<'tunai' | 'transfer'>('tunai');
  const [bayarKas, setBayarKas] = useState<'tunai_tu' | 'bank_lembaga' | 'bank_pesantren'>('tunai_tu');
  /** Tagihan terpilih dari sel crosstab (aksi bayar/riwayat/hapus). */
  const [selTagihan, setSelTagihan] = useState<{
    id: number; nama: string; label: string; nominal: number; sisa: number;
    status: 'belum' | 'sebagian' | 'lunas';
  } | null>(null);

  /** Muat ulang crosstab pada posisi halaman saat ini. */
  const muatCrosstabSekarang = useCallback(async () => {
    await loadCrosstab(tagihanPage, tagihanPerPage, jenjangs, tahunAjaranNames);
  }, [loadCrosstab, tagihanPage, tagihanPerPage, jenjangs, tahunAjaranNames]);

  const [riwayatTagihan, setRiwayatTagihan] = useState<{ id: number; label: string } | null>(null);
  const [riwayatRows, setRiwayatRows] = useState<PembayaranRow[]>([]);

  /** Id tagihan yang menunggu konfirmasi hapus (dipicu dari context menu). */
  const [hapusTagihanId, setHapusTagihanId] = useState<number | null>(null);
  const [hapusTagihanBusy, setHapusTagihanBusy] = useState(false);

  const bukaRiwayat = useCallback(async (t: { id: number; label: string }) => {
    setRiwayatTagihan(t);
    try {
      setRiwayatRows(await riwayatPembayaran(t.id));
    } catch (e) { toast.error(errorMessage(e)); }
  }, []);

  const muatRiwayat = useCallback(async (t: { id: number; label: string }) => {
    try {
      setRiwayatRows(await riwayatPembayaran(t.id));
    } catch (e) { toast.error(errorMessage(e)); }
  }, []);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <PengaturanHalaman
        tampil={{ lembaga: true, tahun_ajaran: true }}
        tabel={[
          { key: 'keuangan_jenis', judul: 'Jenis Tagihan', fields: FIELDS_JENIS },
          { key: 'keuangan_tarif', judul: 'Tarif', fields: FIELDS_TARIF },
          { key: 'keuangan_tunggakan', judul: 'Tunggakan', fields: FIELDS_TUNGGAKAN },
          { key: 'keuangan_dispensasi', judul: 'Dispensasi', fields: FIELDS_DISPENSASI },
        ]}
      />
      <Tabs value={tab} onValueChange={(v) => { setTab(v); prefSet('simpes_keuangan_tab', v).catch(() => {}); }} className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList className={KELAS_LIST_TAB}>
          <TabsTrigger value="jenis" id="keu_tab_jenis" className={KELAS_TRIGGER}>Jenis Tagihan</TabsTrigger>
          <TabsTrigger value="tarif" id="keu_tab_tarif" className={KELAS_TRIGGER}>Tarif</TabsTrigger>
          <TabsTrigger value="tagihan" id="keu_tab_tagihan" className={KELAS_TRIGGER}>Tagihan</TabsTrigger>
          <TabsTrigger value="tunggakan" id="keu_tab_tunggakan" className={KELAS_TRIGGER}>Tunggakan</TabsTrigger>
          <TabsTrigger value="dispensasi" id="keu_tab_dispensasi" className={KELAS_TRIGGER}>Dispensasi</TabsTrigger>
        </TabsList>

        <TabsContent value="jenis" className={`min-h-0 flex-1 flex flex-col gap-1 ${KELAS_PANEL_TAB}`}>
          <ExcelTable<JenisTagihan & { id: number }>
            tableKey="keuangan_jenis"
            fields={FIELDS_JENIS}
            rows={jenis.map((j) => ({ ...j, id: j.id }))}
            urutAktif={uJenis.urut}
            arahUrut={uJenis.arah}
            onUrut={uJenis.terapkan}
            getValues={(r) => ({ nama: r.nama, tipe: r.tipe === 'bulanan' ? 'Bulanan' : 'Non-bulanan', lembaga: r.jenjang ?? 'Semua', aktif: r.is_active ? 'Aktif' : 'Nonaktif' })}
            loading={loading}
            emptyText="Belum ada jenis tagihan."
            canEdit={false}
            onCommit={async () => {}}
            onSaved={() => {}}
            renderActions={(j) => (
              (j.jenjang !== null || efektifSuper)
                ? <EditAction id={`btn_jenis_ubah_${j.id}`} onClick={() => { setEditJenis(j); setENama(j.nama); setETipe(j.tipe); setEJenjang(j.jenjang ?? ''); setEAktif(j.is_active); }} />
                : null
            )}
            hideCheckbox
            addButtonLangsung
            addButton={<Button id="btn_jenis_tambah_buka" size="icon" variant="outline" aria-label="Tambah jenis tagihan" title="Tambah jenis tagihan" onClick={() => { setNamaJenis(''); setTipeJenis('non_bulanan'); setLembagaJenis(peranJenjang ?? ''); setTambahJenisOpen(true); }}><Plus size={16} /></Button>}
          />
        </TabsContent>

        <TabsContent value="tarif" className={`min-h-0 flex-1 flex flex-col gap-1 ${KELAS_PANEL_TAB}`}>
          <ExcelTable<Tarif & { id: number }>
            tableKey="keuangan_tarif"
            fields={FIELDS_TARIF}
            rows={tarif.map((t) => ({ ...t, id: t.id }))}
            urutAktif={uTarif.urut}
            arahUrut={uTarif.arah}
            onUrut={uTarif.terapkan}
            getValues={(r) => ({
              jenjang: r.jenjang, tahun_ajaran: r.tahun_ajaran,
              jenis: r.jenis?.nama ?? null, nominal: r.nominal.toLocaleString('id'),
              aktif: r.is_active ? 'Ya' : 'Tidak',
            })}
            loading={loading}
            emptyText="Belum ada tarif."
            canEdit={false}
            onCommit={async () => {}}
            onSaved={() => {}}
            renderActions={(r) => (
              <>
                <EditAction id={`btn_tarif_ubah_${r.id}`} onClick={() => { setEditTarif(r); setENominal(String(r.nominal)); setEAktif(r.is_active); }} />
                <DeleteAction
                  id={`btn_tarif_hapus_${r.id}`}
                  title="Hapus tarif?"
                  description="Tarif dihapus permanen. Tarif yang sudah dipakai pada tagihan tidak bisa dihapus — nonaktifkan saja."
                  onConfirm={() => { void (async () => { try { await hapusTarif(r.id); toast.success('Tarif dihapus.'); await loadTarif(jenjangs, tahunAjaranNames); } catch (e2) { toast.error(errorMessage(e2)); } })(); }}
                />
              </>
            )}
            hideCheckbox
            addButtonLangsung
            addButton={<Button id="btn_tarif_tambah_buka" size="icon" variant="outline" aria-label="Tambah tarif" title="Tambah tarif" onClick={() => { setTfJenis(''); setTfNominal(''); if (genTAtopbar && daftarTA.some((x) => x.nama === genTAtopbar)) setTfTA(genTAtopbar); setTambahTarifOpen(true); }}><Plus size={16} /></Button>}
          />
        </TabsContent>

<TabsContent value="tagihan" className={`min-h-0 flex-1 flex flex-col gap-1 ${KELAS_PANEL_TAB}`}>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="inp_tagihan_cari"
              placeholder="Cari nama / NIS / NISN…"
              className="h-8 w-64"
              value={cariTagihan}
              onChange={(e) => setCariTagihan(e.target.value)}
            />
            <select
              id="sel_tagihan_urut"
              className="h-8 rounded border px-2 text-xs"
              value={urutTagihan}
              onChange={(e) => setUrutTagihan(e.target.value)}
              aria-label="Urutkan baris"
            >
              <option value="">Urutkan: nama</option>
              <option value="total">Total tagihan</option>
              <option value="bayar">Terbayar</option>
              <option value="sisa">Tunggakan</option>
            </select>
            <Button
              id="btn_tagihan_arah"
              size="sm"
              variant="outline"
              title={arahTagihan === 'naik' ? 'Arah: naik' : 'Arah: turun'}
              onClick={() => setArahTagihan((a) => (a === 'naik' ? 'turun' : 'naik'))}
            >
              {arahTagihan === 'naik' ? 'Naik' : 'Turun'}
            </Button>
            <Button
              id="btn_tagihan_terlambat"
              size="sm"
              variant={terlambatTagihan ? 'default' : 'outline'}
              aria-pressed={terlambatTagihan}
              title="Tampilkan hanya tagihan yang sudah lewat jatuh tempo"
              onClick={() => { setTerlambatTagihan((v) => !v); setTagihanPage(1); }}
            >
              Terlambat
            </Button>
            <Button id="btn_gen_buka" size="sm" onClick={() => setGenerateOpen(true)}>+ Buat Tagihan</Button>
          </div>

          {selTagihan === null ? (
            <p className="text-xs text-muted-foreground">
                Klik kanan sel tagihan untuk membayar, melihat riwayat, atau menghapusnya.
              </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded border bg-muted/30 px-2 py-1.5">
              <p className="text-xs">
                <b>{selTagihan.label}</b> — {selTagihan.nama} · sisa{' '}
                <b className={selTagihan.sisa > 0 ? 'text-destructive' : ''}>Rp {selTagihan.sisa.toLocaleString('id')}</b> dari Rp {selTagihan.nominal.toLocaleString('id')}
              </p>
              <div className="ml-auto flex items-center gap-1">
                <Button id="btn_tutup_sel" size="sm" variant="ghost" onClick={() => setSelTagihan(null)}>Tutup</Button>
              </div>
              {bayarId === selTagihan.id && (
                <form
                  id="form_bayar_sel"
                  className="flex flex-wrap items-center gap-1"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (bayarJumlah === '') return;
                    try {
                      await catatPembayaran({ tagihan_id: selTagihan.id, jumlah: Number(bayarJumlah), metode: bayarMetode, kas: bayarKas });
                      toast.success('Tercatat.');
                      setBayarId(null); setBayarJumlah('');
                      await load();
                      await muatCrosstabSekarang();
                    } catch (e2) { toast.error(errorMessage(e2)); }
                  }}
                >
                  <Input id="inp_bayar_jumlah" type="number" placeholder="Jumlah" value={bayarJumlah} onChange={(e) => setBayarJumlah(e.target.value)} className="w-28" />
                  <select id="sel_bayar_metode" value={bayarMetode} onChange={(e) => setBayarMetode(e.target.value as 'tunai' | 'transfer')} className="h-8 rounded border px-1 text-xs">
                    <option value="tunai">Tunai</option>
                    <option value="transfer">Transfer</option>
                  </select>
                  <select id="sel_bayar_kas" value={bayarKas} onChange={(e) => setBayarKas(e.target.value as typeof bayarKas)} className="h-8 rounded border px-1 text-xs">
                    <option value="tunai_tu">Tunai TU</option>
                    <option value="bank_lembaga">Bank Lembaga</option>
                    <option value="bank_pesantren">Bank Pesantren</option>
                  </select>
                  <Button id="btn_bayar_simpan" type="submit" size="sm">Simpan</Button>
                  <Button id="btn_bayar_batal" type="button" size="sm" variant="ghost" onClick={() => setBayarId(null)}>Batal</Button>
                </form>
              )}
            </div>
          )}

          <div className="min-h-0 flex-1">
            <TagihanCrosstab
              data={crosstab}
              loading={loading}
              terpilihId={selTagihan?.id ?? null}
              emptyText="Belum ada tagihan."
              onPilih={(sel, meta) => {
                setBayarId(null);
                setSelTagihan({
                  id: sel.id, nama: meta.nama, label: meta.label,
                  nominal: sel.nominal, sisa: sel.sisa, status: sel.status,
                });
              }}
              onBayar={(sel, meta) => {
                setBayarId(null);
                setSelTagihan({
                  id: sel.id, nama: meta.nama, label: meta.label,
                  nominal: sel.nominal, sisa: sel.sisa, status: sel.status,
                });
                setBayarId(sel.id);
              }}
              onRiwayat={(sel, meta) => {
                setSelTagihan({
                  id: sel.id, nama: meta.nama, label: meta.label,
                  nominal: sel.nominal, sisa: sel.sisa, status: sel.status,
                });
                void bukaRiwayat({ id: sel.id, label: meta.label });
              }}
              onHapus={(sel) => setHapusTagihanId(sel.id)}
            />
          </div>
          <Pager
            page={tagihanPage}
            lastPage={tagihanLastPage}
            total={tagihanTotal}
            perPage={tagihanPerPage}
            onPage={(p) => { setTagihanPage(p); void loadCrosstab(p, tagihanPerPage, jenjangs, tahunAjaranNames); }}
            onPerPage={(pp) => { setTagihanPerPage(pp); void loadCrosstab(1, pp, jenjangs, tahunAjaranNames); }}
          />
        </TabsContent>

        <TabsContent value="tunggakan" className={`min-h-0 flex-1 flex flex-col gap-1 ${KELAS_PANEL_TAB}`}>
          <ExcelTable<TunggakanRow & { id: number }>
            tableKey="keuangan_tunggakan"
            fields={FIELDS_TUNGGAKAN}
            rows={tunggakan.map((w) => ({ ...w, id: w.santri_id }))}
            urutAktif={uTunggakan.urut}
            arahUrut={uTunggakan.arah}
            onUrut={uTunggakan.terapkan}
            getValues={(r) => ({
              nama: r.nama, jumlah_tagihan: String(r.jumlah_tagihan),
              total_tagihan: r.total_tagihan.toLocaleString('id'),
              terbayar: r.terbayar.toLocaleString('id'),
              tunggakan: r.tunggakan.toLocaleString('id'),
              terlambat_terlama: r.tanpa_jatuh_tempo ? 'Tanpa batas' : tanggal(r.terlambat_terlama),
            })}
            loading={loading}
            emptyText="Tidak ada tagihan yang lewat jatuh tempo."
            canEdit={false}
            onCommit={async () => {}}
            onSaved={() => {}}
            renderActions={() => null}
            hideCheckbox
          />
        </TabsContent>

        <TabsContent value="dispensasi" className={`min-h-0 flex-1 flex flex-col gap-1 ${KELAS_PANEL_TAB}`}>
          <ExcelTable<Dispensasi & { id: number }>
            tableKey="keuangan_dispensasi"
            fields={FIELDS_DISPENSASI}
            rows={dispensasi}
            urutAktif={uDispensasi.urut}
            arahUrut={uDispensasi.arah}
            onUrut={uDispensasi.terapkan}
            getValues={(r) => ({
              nama: r.nama,
              aturan: (r.aturan ?? []).map((a) => `${a.jenis?.nama ?? 'Semua jenis'}: ${a.tipe === 'persen' ? `${a.nilai}%` : a.tipe === 'bebas' ? 'bebas' : `Rp ${a.nilai.toLocaleString('id')}`}`).join(' · '),
              santri: `${(r.santri_ids ?? []).length} santri`,
              tahun_ajaran: r.tahun_ajaran,
              status: r.is_active ? 'Aktif' : 'Nonaktif',
            })}
            loading={loading}
            emptyText="Belum ada dispensasi."
            canEdit={false}
            onCommit={async () => {}}
            onSaved={() => {}}
            renderActions={(r) => (
              <>
                <EditAction id={`btn_dispensasi_ubah_${r.id}`} onClick={() => { setEditDispensasi(r); setDispensasiOpen(true); }} />
                <DeleteAction
                  id={`btn_dispensasi_hapus_${r.id}`}
                  title="Hapus dispensasi?"
                  description="Dispensasi dihapus permanen. Dispensasi yang sudah dipakai tagihan tidak bisa dihapus — nonaktifkan saja."
                  onConfirm={() => { void (async () => { try { await hapusDispensasi(r.id); toast.success('Dispensasi dihapus.'); await load(); } catch (e2) { toast.error(errorMessage(e2)); } })(); }}
                />
              </>
            )}
            hideCheckbox
            addButtonLangsung
            addButton={<Button id="btn_dispensasi_tambah_buka" size="icon" variant="outline" aria-label="Tambah dispensasi" title="Tambah dispensasi" onClick={() => { setEditDispensasi(null); setDispensasiOpen(true); }}><Plus size={16} /></Button>}
          />
        </TabsContent>
      </Tabs>

      {/* Konfirmasi hapus tagihan dari context menu crosstab. */}
      <AlertDialog
        open={hapusTagihanId !== null}
        onOpenChange={(o) => { if (!o && !hapusTagihanBusy) setHapusTagihanId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus tagihan?</AlertDialogTitle>
            <AlertDialogDescription>
              Tagihan dihapus permanen dan tidak bisa dikembalikan. Tagihan yang sudah dibayar
              harus dihapus pembayarannya dulu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={hapusTagihanBusy}>Batal</AlertDialogCancel>
            <AlertDialogAction
              id="btn_konfirmasi_hapus_tagihan"
              className={cn(buttonVariants({ variant: 'destructive' }))}
              onClick={() => {
                const id = hapusTagihanId;
                if (id === null) return;
                setHapusTagihanBusy(true);
                void (async () => {
                  try {
                    await hapusTagihan(id);
                    toast.success('Tagihan dihapus.');
                    if (selTagihan?.id === id) setSelTagihan(null);
                    await load();
                    await muatCrosstabSekarang();
                  } catch (e2) { toast.error(errorMessage(e2)); }
                  finally { setHapusTagihanBusy(false); setHapusTagihanId(null); }
                })();
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={riwayatTagihan !== null} onOpenChange={(o) => { if (!o) setRiwayatTagihan(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Riwayat Pembayaran{riwayatTagihan ? ` — ${riwayatTagihan.label}` : ''}</DialogTitle>
            <DialogDescription className="sr-only">Daftar pembayaran tagihan ini.</DialogDescription>
          </DialogHeader>
          {riwayatRows.length === 0 ? (
            <p className="text-xs text-muted-foreground">Belum ada pembayaran.</p>
          ) : (
            <table className="w-full text-xs border">
              <thead><tr className="bg-muted/40"><th className="p-2">Tanggal</th><th className="p-2">Jumlah</th><th className="p-2">Metode</th><th className="p-2">Kas</th><th className="p-2">Kwitansi</th><th className="p-2">Status</th><th className="p-2">Aksi</th></tr></thead>
              <tbody>
                {riwayatRows.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-2">{p.created_at.slice(0, 10)}</td>
                    <td className="p-2 text-right">{p.jumlah.toLocaleString('id')}</td>
                    <td className="p-2">{p.metode}</td>
                    <td className="p-2">{p.kas}</td>
                    <td className="p-2">{p.no_kwitansi ?? '—'}</td>
                    <td className="p-2">{p.status}</td>
                    <td className="p-2">
                      <DeleteAction
                        id={`btn_hapus_bayar_${p.id}`}
                        title="Hapus pembayaran?"
                        description="Baris pembayaran dihapus permanen dan total tagihan menyesuaikan."
                        onConfirm={() => { void (async () => { try { await hapusPembayaran(p.id); toast.success('Pembayaran dihapus.'); if (riwayatTagihan) await muatRiwayat(riwayatTagihan); await load(); await muatCrosstabSekarang(); } catch (e2) { toast.error(errorMessage(e2)); } })(); }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRiwayatTagihan(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <GenerateTagihanDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        jenis={jenis}
        tarif={tarif}
        tahunAjaran={genTAtopbar}
        onSelesai={async () => {
          await load();
          setTagihanPage(1);
          await loadCrosstab(1, tagihanPerPage, jenjangs, tahunAjaranNames);
        }}
      />
      <DispensasiDialog
        open={dispensasiOpen}
        onOpenChange={setDispensasiOpen}
        editing={editDispensasi}
        jenis={jenis}
        daftarTA={daftarTA}
        taBawaan={genTAtopbar}
        onSaved={load}
      />

      <Dialog open={tambahTarifOpen} onOpenChange={setTambahTarifOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Tarif</DialogTitle>
            <DialogDescription className="sr-only">Formulir penambahan tarif tagihan.</DialogDescription>
          </DialogHeader>
          <form id="form_tambah_tarif" className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4" onSubmit={async (e) => { e.preventDefault(); if (tfJenis === '') return; try { await buatTarif({ jenjang: tfJenjang, tahun_ajaran: tfTA, jenis_id: Number(tfJenis), nominal: Number(tfNominal) }); toast.success('Tarif dibuat.'); setTfJenis(''); setTfNominal(''); setTambahTarifOpen(false); await load(); await loadTarif(jenjangs, tahunAjaranNames); } catch (e2) { toast.error(errorMessage(e2)); } }}>
            <FieldLabel htmlFor="sel_tarif_jenjang">Jenjang</FieldLabel>
            <select id="sel_tarif_jenjang" className="border rounded px-2" value={tfJenjang} onChange={(e) => setTfJenjang(e.target.value)} required>
              {lembagas.filter((l) => pilihanLembaga.some((p) => p.jenjang === l.jenjang)).map((l) => <option key={l.jenjang} value={l.jenjang}>{l.jenjang} — {l.nama}</option>)}
            </select>
            <FieldLabel htmlFor="sel_tarif_ta">Tahun Ajaran</FieldLabel>
            <select id="sel_tarif_ta" className="border rounded px-2" value={tfTA} onChange={(e) => setTfTA(e.target.value)} required>
              {daftarTA.map((x) => <option key={x.nama} value={x.nama}>{x.nama}{x.is_aktif ? ' (aktif)' : ''}</option>)}
            </select>
            <FieldLabel htmlFor="sel_tarif_jenis">Jenis</FieldLabel>
            <select id="sel_tarif_jenis" className="border rounded px-2" value={tfJenis} onChange={(e) => setTfJenis(e.target.value === '' ? '' : Number(e.target.value))} required>
              <option value="">Jenis…</option>{jenis.filter((j) => j.jenjang === null || j.jenjang === tfJenjang).map((j) => <option key={j.id} value={j.id}>{j.nama}</option>)}
            </select>
            <FieldLabel htmlFor="inp_tarif_nominal">Nominal</FieldLabel>
            <Input id="inp_tarif_nominal" type="number" value={tfNominal} onChange={(e) => setTfNominal(e.target.value)} required />
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setTambahTarifOpen(false)}>Batal</Button>
              <Button id="btn_tarif_simpan" type="submit">Tambah</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={tambahJenisOpen} onOpenChange={setTambahJenisOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Jenis Tagihan</DialogTitle>
            <DialogDescription className="sr-only">Formulir penambahan jenis tagihan.</DialogDescription>
          </DialogHeader>
          <form id="form_tambah_jenis" className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4" onSubmit={async (e) => { e.preventDefault(); if (!namaJenis) return; try { await buatJenis(namaJenis, tipeJenis, lembagaJenis === '' ? null : lembagaJenis); toast.success('Jenis dibuat.'); setNamaJenis(''); setLembagaJenis(''); setTambahJenisOpen(false); await load(); } catch (e2) { toast.error(errorMessage(e2)); } }}>
            <FieldLabel htmlFor="inp_jenis_nama">Nama</FieldLabel>
            <Input id="inp_jenis_nama" placeholder="mis. HIPA" value={namaJenis} required onChange={(e) => setNamaJenis(e.target.value)} />
            <FieldLabel htmlFor="sel_jenis_tipe">Tipe</FieldLabel>
            <select id="sel_jenis_tipe" className="border rounded px-2" value={tipeJenis} onChange={(e) => setTipeJenis(e.target.value as 'bulanan' | 'non_bulanan')}>
              <option value="non_bulanan">Non-bulanan</option>
              <option value="bulanan">Bulanan</option>
            </select>
            <FieldLabel htmlFor="sel_jenis_lembaga">Lembaga</FieldLabel>
            <select id="sel_jenis_lembaga" className="border rounded px-2" value={lembagaJenis} onChange={(e) => setLembagaJenis(e.target.value)}>
              {efektifSuper ? <option value="">Semua (global)</option> : null}
              {pilihanLembaga.map((l) => <option key={l.jenjang} value={l.jenjang}>{l.jenjang} — {l.nama}</option>)}
            </select>
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setTambahJenisOpen(false)}>Batal</Button>
              <Button id="btn_jenis_simpan" type="submit">Tambah</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={editJenis !== null} onOpenChange={(o) => { if (!o) setEditJenis(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Ubah Jenis Tagihan</DialogTitle></DialogHeader>
          <form id="form_ubah_jenis" className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4" onSubmit={async (e) => { e.preventDefault(); if (!editJenis) return; try { await ubahJenis(editJenis.id, { nama: eNama, tipe: eTipe, jenjang: eJenjang === '' ? null : eJenjang, is_active: eAktif }); toast.success('Tersimpan.'); setEditJenis(null); await load(); } catch (e2) { toast.error(errorMessage(e2)); } }}>
            <FieldLabel htmlFor="inp_jenis_edit_nama">Nama</FieldLabel>
            <Input id="inp_jenis_edit_nama" value={eNama} onChange={(e) => setENama(e.target.value)} required />
            <FieldLabel htmlFor="sel_jenis_edit_tipe">Tipe</FieldLabel>
            <select id="sel_jenis_edit_tipe" className="border rounded px-2" value={eTipe} onChange={(e) => setETipe(e.target.value as 'bulanan' | 'non_bulanan')}>
              <option value="non_bulanan">Non-bulanan</option><option value="bulanan">Bulanan</option>
            </select>
            <FieldLabel htmlFor="sel_jenis_edit_lembaga">Lembaga</FieldLabel>
            <select id="sel_jenis_edit_lembaga" className="border rounded px-2" value={eJenjang} onChange={(e) => setEJenjang(e.target.value)}>
              {efektifSuper ? <option value="">Semua (global)</option> : null}
              {pilihanLembaga.map((l) => <option key={l.jenjang} value={l.jenjang}>{l.jenjang} — {l.nama}</option>)}
            </select>
            <FieldLabel htmlFor="chk_jenis_edit_aktif">Aktif</FieldLabel>
            <input id="chk_jenis_edit_aktif" type="checkbox" checked={eAktif} onChange={(e) => setEAktif(e.target.checked)} />
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setEditJenis(null)}>Batal</Button>
              <Button id="btn_jenis_edit_simpan" type="submit">Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editTarif !== null} onOpenChange={(o) => { if (!o) setEditTarif(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Ubah Tarif</DialogTitle></DialogHeader>
          <form id="form_ubah_tarif" className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4" onSubmit={async (e) => { e.preventDefault(); if (!editTarif) return; try { await ubahTarif(editTarif.id, Number(eNominal), eAktif); toast.success('Tersimpan.'); setEditTarif(null); await load(); await loadTarif(jenjangs, tahunAjaranNames); } catch (e2) { toast.error(errorMessage(e2)); } }}>
            <FieldLabel htmlFor="inp_tarif_edit_nominal">Nominal</FieldLabel>
            <Input id="inp_tarif_edit_nominal" type="number" value={eNominal} onChange={(e) => setENominal(e.target.value)} required />
            <FieldLabel htmlFor="chk_tarif_edit_aktif">Aktif</FieldLabel>
            <input id="chk_tarif_edit_aktif" type="checkbox" checked={eAktif} onChange={(e) => setEAktif(e.target.checked)} />
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setEditTarif(null)}>Batal</Button>
              <Button id="btn_tarif_edit_simpan" type="submit">Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {loading && <p className="text-xs text-muted-foreground">Memuat…</p>}
    </div>
  );
}
