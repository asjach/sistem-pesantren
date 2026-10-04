import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage, prefGet, prefSet } from '../api/client';
import {
  daftarJenis, buatJenis, ubahJenis, buatTarif, daftarTarif, ubahTarif, hapusTarif,
  daftarTagihan, hapusTagihan, catatPembayaran, daftarTunggakan,
  riwayatPembayaran, hapusPembayaran, daftarDispensasi, hapusDispensasi,
  type JenisTagihan, type Tarif, type TagihanRow, type TunggakanRow, type PembayaranRow, type Dispensasi,
} from '../api/keuangan';
import { listLembaga, listTahunAjaran, type Lembaga, type TahunAjaran } from '../api/master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KELAS_LIST_TAB, KELAS_PANEL_TAB, KELAS_TRIGGER } from '@/components/HalamanTabs';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { FieldLabel } from '@/components/ui/field';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import ConfirmDelete from '@/components/ConfirmDelete';
import { Plus, Trash2 } from '@/icons';
import { ActionIcon, DeleteAction } from '@/components/RowActions';
import { History } from '@/icons';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { useFilterGlobalAktif, targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { useLembagaAktif } from '@/lembagaAktif';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';
import { EditAction } from '@/components/RowActions';
import GenerateTagihanDialog from '@/components/keuangan/GenerateTagihanDialog';
import DispensasiDialog from '@/components/keuangan/DispensasiDialog';

const FIELDS_JENIS: ExcelField[] = [
  { key: 'nama', label: 'Jenis Tagihan', kind: 'static' },
  { key: 'tipe', label: 'Tipe', kind: 'static', width: 90 },
  { key: 'lembaga', label: 'Lembaga', kind: 'static', width: 130 },
  { key: 'aktif', label: 'Status', kind: 'static', width: 80 },
];

const FIELDS_TARIF: ExcelField[] = [
  { key: 'jenjang', label: 'Lembaga', kind: 'static', width: 90 },
  { key: 'paket', label: 'Paket', kind: 'static', width: 90 },
  { key: 'tahun_ajaran', label: 'Tahun Ajaran', kind: 'static', width: 110 },
  { key: 'jenis', label: 'Jenis', kind: 'static' },
  { key: 'nominal', label: 'Nominal', kind: 'static', width: 110 },
  { key: 'aktif', label: 'Aktif', kind: 'static', width: 70 },
];

const FIELDS_TAGIHAN: ExcelField[] = [
  { key: 'santri', label: 'Santri', kind: 'static' },
  { key: 'jenis', label: 'Jenis', kind: 'static' },
  { key: 'periode', label: 'Periode', kind: 'static', width: 90 },
  { key: 'nominal', label: 'Nominal', kind: 'static', width: 100 },
  { key: 'terbayar', label: 'Terbayar', kind: 'static', width: 100 },
  { key: 'status', label: 'Status', kind: 'static', width: 90 },
];

const FIELDS_TUNGGAKAN: ExcelField[] = [
  { key: 'nama', label: 'Santri', kind: 'static' },
  { key: 'jumlah_tagihan', label: 'Jml Tagihan', kind: 'static', width: 100 },
  { key: 'total_tagihan', label: 'Total', kind: 'static', width: 110 },
  { key: 'terbayar', label: 'Terbayar', kind: 'static', width: 110 },
  { key: 'tunggakan', label: 'Tunggakan', kind: 'static', width: 110 },
];

const FIELDS_DISPENSASI: ExcelField[] = [
  { key: 'nama', label: 'Dispensasi', kind: 'static' },
  { key: 'jenis', label: 'Jenis', kind: 'static', width: 140 },
  { key: 'target', label: 'Sasaran', kind: 'static' },
  { key: 'nilai', label: 'Potongan', kind: 'static', width: 110 },
  { key: 'tahun_ajaran', label: 'TA', kind: 'static', width: 100 },
  { key: 'prioritas', label: 'Prioritas', kind: 'static', width: 80 },
  { key: 'status', label: 'Status', kind: 'static', width: 80 },
];

const OPSI_PAKET = ['MI', 'MD', 'MI-MD', 'MTS', 'MLN'];
const TAB_KEUANGAN = ['jenis', 'tarif', 'tagihan', 'tunggakan', 'dispensasi'] as const;

/** Halaman Keuangan: jenis tagihan, tarif, tagihan, pembayaran, tunggakan. */
export default function KeuanganPage() {
  const [jenis, setJenis] = useState<JenisTagihan[]>([]);
  const [tarif, setTarif] = useState<Tarif[]>([]);
  const [tagihan, setTagihan] = useState<TagihanRow[]>([]);
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

  const { page: tagihanPage, perPage: tagihanPerPage, ready: tagihanPagerReady, setPage: setTagihanPage, setPerPage: setTagihanPerPage, sync: tagihanSync } = usePager('keuangan_tagihan');
  const [tagihanLastPage, setTagihanLastPage] = useState(1);
  const [tagihanTotal, setTagihanTotal] = useState(0);
  const { jenjangs, tahunAjaranNames, loading: filterLoading } = useFilterGlobalAktif();
  /** Jenis global (Semua) hanya untuk super_admin efektif — mati saat bertindak. */
  const { efektifSuper, peranJenjang, pilihan: pilihanLembaga } = useLembagaAktif();

  const loadTagihan = useCallback(async (page: number, perPage: number, jenjang: readonly string[], ta: readonly string[]) => {
    try {
      const res = await daftarTagihan({ page: String(page), per_page: String(perPage), jenjang, tahun_ajaran: ta });
      const koreksi = tagihanSync(res.current_page, res.last_page);
      if (koreksi !== null) {
        const r2 = await daftarTagihan({ page: String(koreksi), per_page: String(perPage), jenjang, tahun_ajaran: ta });
        setTagihan(r2.data); setTagihanLastPage(r2.last_page); setTagihanTotal(r2.total);
      } else {
        setTagihan(res.data); setTagihanLastPage(res.last_page); setTagihanTotal(res.total);
      }
    } catch (e) { setErr(errorMessage(e)); }
  }, [tagihanSync]);

  useEffect(() => {
    if (!tagihanPagerReady || filterLoading || jenjangs.length === 0) { if (!filterLoading && jenjangs.length === 0) setTagihan([]); return; }
    void loadTagihan(tagihanPage, tagihanPerPage, jenjangs, tahunAjaranNames);
  }, [tagihanPagerReady, filterLoading, tagihanPage, tagihanPerPage, jenjangs, tahunAjaranNames, loadTagihan]);

  /** Tarif mengikuti filter lembaga & tahun ajaran (server-side; kosong = semua). */
  const loadTarif = useCallback(async (jenjang: readonly string[], ta: readonly string[]) => {
    try {
      setTarif(await daftarTarif({ jenjang, tahun_ajaran: ta }));
    } catch (e) { setErr(errorMessage(e)); }
  }, []);

  useEffect(() => {
    if (filterLoading) return;
    void loadTarif(jenjangs, tahunAjaranNames);
  }, [filterLoading, jenjangs, tahunAjaranNames, loadTarif]);

  useEffect(() => { setTagihanPage(1); }, [jenjangs, tahunAjaranNames]);

  const load = useCallback(async () => {
    setErr(''); setLoading(true);
    try {
      const [j, w, l, tas, dispen] = await Promise.all([daftarJenis(), daftarTunggakan(), listLembaga({ per_page: 100 }), listTahunAjaran({ per_page: 100 }), daftarDispensasi()]);
      setJenis(j); setTunggakan(w.per_santri);
      setLembagas(l.data); setDaftarTA(tas.data); setDispensasi(dispen);
      const taAktif = tas.data.find((x) => x.is_aktif)?.nama ?? tas.data[0]?.nama ?? '';
      const diTA = (v: string) => v !== '' && tas.data.some((x) => x.nama === v);
      setTfTA((v) => (diTA(v) ? v : taAktif));
      const diLembaga = (v: string) => v !== '' && l.data.some((x) => x.jenjang === v);
      const jenjangBawaan = l.data.some((x) => x.jenjang === 'MI') ? 'MI' : (l.data[0]?.jenjang ?? '');
      setTfJenjang((v) => (diLembaga(v) ? v : jenjangBawaan));
    } catch (e) { setErr(errorMessage(e)); } finally { setLoading(false); }
  }, []);
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
  const [tfPaket, setTfPaket] = useState('MI');
  const [tfTA, setTfTA] = useState('2025/2026');
  const [tfJenis, setTfJenis] = useState<number | ''>('');
  const [tfNominal, setTfNominal] = useState('');
  const genTAtopbar = targetTunggal(tahunAjaranNames);
  const [bayarId, setBayarId] = useState<number | null>(null);
  const [bayarJumlah, setBayarJumlah] = useState('');
  const [bayarMetode, setBayarMetode] = useState<'tunai' | 'transfer'>('tunai');
  const [bayarKas, setBayarKas] = useState<'tunai_tu' | 'bank_lembaga' | 'bank_pesantren'>('tunai_tu');

  const hapusBulkTagihan = useCallback(async (list: TagihanRow[]) => {
    if (list.length === 0) return;
    setErr('');
    const results = await Promise.allSettled(list.map((r) => hapusTagihan(r.id)));
    const gagal = results.filter((result) => result.status === 'rejected');
    if (gagal.length > 0) {
      const alasan = gagal
        .map((result) => result.status === 'rejected' ? errorMessage(result.reason) : '')
        .filter(Boolean)
        .join(' · ');
      setErr(`${gagal.length} tagihan gagal dihapus${alasan ? `: ${alasan}` : '.'}`);
      toast.error('Sebagian tagihan gagal dihapus.');
    } else {
      toast.success(`${list.length} tagihan dihapus.`);
    }
    await load();
    await loadTagihan(tagihanPage, tagihanPerPage, jenjangs, tahunAjaranNames);
  }, [load, loadTagihan, tagihanPage, tagihanPerPage, jenjangs, tahunAjaranNames]);

  const renderBulkActionsTagihan = useCallback((checked: TagihanRow[], clear: () => void) => {
    if (checked.length === 0) return null;
    return (
      <ConfirmDelete
        title={`Hapus ${checked.length} tagihan?`}
        description="Tagihan yang dipilih dihapus permanen dan tidak bisa dikembalikan. Tagihan yang sudah dibayar dilewati (hapus dulu pembayarannya)."
        confirmLabel="Hapus permanen"
        onConfirm={() => { clear(); void hapusBulkTagihan(checked); }}
      >
        <Button id="btn_bulk_hapus_tagihan" size="sm" variant="destructive">
          <Trash2 data-icon="inline-start" size={14} /> Hapus ({checked.length})
        </Button>
      </ConfirmDelete>
    );
  }, [hapusBulkTagihan]);

  const [riwayatTagihan, setRiwayatTagihan] = useState<TagihanRow | null>(null);
  const [riwayatRows, setRiwayatRows] = useState<PembayaranRow[]>([]);

  const bukaRiwayat = useCallback(async (t: TagihanRow) => {
    setRiwayatTagihan(t);
    try {
      setRiwayatRows(await riwayatPembayaran(t.id));
    } catch (e) { toast.error(errorMessage(e)); }
  }, []);

  const muatRiwayat = useCallback(async (t: TagihanRow) => {
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
          { key: 'keuangan_tagihan', judul: 'Tagihan', fields: FIELDS_TAGIHAN },
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
            getValues={(r) => ({
              jenjang: r.jenjang, paket: r.paket, tahun_ajaran: r.tahun_ajaran,
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
          <ExcelTable<TagihanRow & { id: number }>
            tableKey="keuangan_tagihan"
            fields={FIELDS_TAGIHAN}
            rows={tagihan.map((t) => ({ ...t, id: t.id }))}
            getValues={(r) => ({
              santri: r.santri?.nama_lengkap ?? null, jenis: r.jenis?.nama ?? null,
              periode: r.periode, nominal: r.nominal.toLocaleString('id'),
              terbayar: r.terbayar.toLocaleString('id'), status: r.status,
            })}
            loading={loading}
            emptyText="Belum ada tagihan."
            canEdit={false}
            onCommit={async () => {}}
            onSaved={() => {}}
            addButtonLangsung
            addButton={<Button id="btn_gen_buka" onClick={() => setGenerateOpen(true)}>+ Buat Tagihan</Button>}
            renderActions={(t) => (
              bayarId === t.id ? (
                <form className="flex gap-1" onSubmit={async (e) => { e.preventDefault(); if (!bayarJumlah) return; try { await catatPembayaran({ tagihan_id: t.id, jumlah: Number(bayarJumlah), metode: bayarMetode, kas: bayarKas }); toast.success('Tercatat.'); setBayarId(null); setBayarJumlah(''); await load(); await loadTagihan(tagihanPage, tagihanPerPage, jenjangs, tahunAjaranNames); } catch (e2) { toast.error(errorMessage(e2)); } }}>
                  <Input id={`inp_bayar_jumlah_${t.id}`} type="number" placeholder="Jumlah" value={bayarJumlah} onChange={(e) => setBayarJumlah(e.target.value)} className="w-24" />
                  <select id={`sel_bayar_metode_${t.id}`} value={bayarMetode} onChange={(e) => setBayarMetode(e.target.value as 'tunai' | 'transfer')} className="border rounded px-1"><option value="tunai">Tunai</option><option value="transfer">Transfer</option></select>
                  <select id={`sel_bayar_kas_${t.id}`} value={bayarKas} onChange={(e) => setBayarKas(e.target.value as typeof bayarKas)} className="border rounded px-1"><option value="tunai_tu">Tunai TU</option><option value="bank_lembaga">Bank Lembaga</option><option value="bank_pesantren">Bank Pesantren</option></select>
                  <Button id={`btn_bayar_simpan_${t.id}`} type="submit" size="sm">Simpan</Button>
                  <Button id={`btn_bayar_batal_${t.id}`} type="button" size="sm" variant="ghost" onClick={() => setBayarId(null)}>Batal</Button>
                </form>
              ) : (
                <>
                  <Button id={`btn_bayar_${t.id}`} size="sm" onClick={() => setBayarId(t.id)} disabled={t.status === 'lunas'}>Bayar</Button>
                  <ActionIcon id={`btn_riwayat_bayar_${t.id}`} title="Riwayat pembayaran" onClick={() => void bukaRiwayat(t)}>
                    <History size={16} />
                  </ActionIcon>
                  <DeleteAction
                    id={`btn_hapus_tagihan_${t.id}`}
                    title="Hapus tagihan?"
                    description="Tagihan dihapus permanen dan tidak bisa dikembalikan. Tagihan yang sudah dibayar harus dihapus pembayarannya dulu."
                    onConfirm={() => { void (async () => { try { await hapusTagihan(t.id); toast.success('Tagihan dihapus.'); await load(); await loadTagihan(tagihanPage, tagihanPerPage, jenjangs, tahunAjaranNames); } catch (e2) { toast.error(errorMessage(e2)); } })(); }}
                  />
                </>
              )
            )}
            renderBulkActions={renderBulkActionsTagihan}
          />
          <Pager
            page={tagihanPage}
            lastPage={tagihanLastPage}
            total={tagihanTotal}
            perPage={tagihanPerPage}
            onPage={setTagihanPage}
            onPerPage={setTagihanPerPage}
          />
        </TabsContent>

        <TabsContent value="tunggakan" className={`min-h-0 flex-1 flex flex-col gap-1 ${KELAS_PANEL_TAB}`}>
          <ExcelTable<TunggakanRow & { id: number }>
            tableKey="keuangan_tunggakan"
            fields={FIELDS_TUNGGAKAN}
            rows={tunggakan.map((w) => ({ ...w, id: w.santri_id }))}
            getValues={(r) => ({
              nama: r.nama, jumlah_tagihan: String(r.jumlah_tagihan),
              total_tagihan: r.total_tagihan.toLocaleString('id'),
              terbayar: r.terbayar.toLocaleString('id'),
              tunggakan: r.tunggakan.toLocaleString('id'),
            })}
            loading={loading}
            emptyText="Tidak ada tunggakan."
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
            getValues={(r) => ({
              nama: r.nama,
              jenis: r.jenis?.nama ?? 'Semua jenis',
              target: [
                (r.paket ?? []).join(', '),
                (r.tingkat ?? []).map((t) => `Tkt ${t}`).join(', '),
                (r.kelas_id ?? []).length > 0 ? `${(r.kelas_id ?? []).length} kelas` : '',
                (r.santri_ids ?? []).length > 0 ? `${(r.santri_ids ?? []).length} santri` : '',
              ].filter(Boolean).join(' · ') || 'Semua santri',
              nilai: r.tipe === 'persen' ? `${r.nilai}%` : r.tipe === 'bebas' ? 'Bebas penuh' : `Rp ${r.nilai.toLocaleString('id')}`,
              tahun_ajaran: r.tahun_ajaran,
              prioritas: String(r.prioritas),
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
      <Dialog open={riwayatTagihan !== null} onOpenChange={(o) => { if (!o) setRiwayatTagihan(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Riwayat Pembayaran{riwayatTagihan?.santri?.nama_lengkap ? ` — ${riwayatTagihan.santri.nama_lengkap}` : ''}</DialogTitle>
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
                        onConfirm={() => { void (async () => { try { await hapusPembayaran(p.id); toast.success('Pembayaran dihapus.'); if (riwayatTagihan) await muatRiwayat(riwayatTagihan); await load(); await loadTagihan(tagihanPage, tagihanPerPage, jenjangs, tahunAjaranNames); } catch (e2) { toast.error(errorMessage(e2)); } })(); }}
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
          await loadTagihan(1, tagihanPerPage, jenjangs, tahunAjaranNames);
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
          <form id="form_tambah_tarif" className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4" onSubmit={async (e) => { e.preventDefault(); if (tfJenis === '') return; try { await buatTarif({ jenjang: tfJenjang, paket: tfPaket, tahun_ajaran: tfTA, jenis_id: Number(tfJenis), nominal: Number(tfNominal) }); toast.success('Tarif dibuat.'); setTfJenis(''); setTfNominal(''); setTambahTarifOpen(false); await load(); await loadTarif(jenjangs, tahunAjaranNames); } catch (e2) { toast.error(errorMessage(e2)); } }}>
            <FieldLabel htmlFor="sel_tarif_jenjang">Jenjang</FieldLabel>
            <select id="sel_tarif_jenjang" className="border rounded px-2" value={tfJenjang} onChange={(e) => setTfJenjang(e.target.value)} required>
              {lembagas.map((l) => <option key={l.jenjang} value={l.jenjang}>{l.jenjang} — {l.nama}</option>)}
            </select>
            <FieldLabel htmlFor="sel_tarif_paket">Paket</FieldLabel>
            <select id="sel_tarif_paket" className="border rounded px-2" value={tfPaket} onChange={(e) => setTfPaket(e.target.value)} required>
              {OPSI_PAKET.map((x) => <option key={x} value={x}>{x}</option>)}
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
