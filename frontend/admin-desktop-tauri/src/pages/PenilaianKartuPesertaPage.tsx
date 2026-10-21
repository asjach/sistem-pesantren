import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useFilterGlobalAktif, targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { useAuth } from '@/auth/AuthContext';
import { bisa } from '@/api/auth';
import { errorMessage } from '@/api/client';
import { listKelas, type Kelas } from '@/api/master';
import {
  daftarDesainKartu, daftarKegiatanEvaluatif, daftarPesertaKegiatanEvaluatif, generateNomorPeserta,
  simpanPengaturanNomorPeserta, ubahNomorPeserta,
  type BarisPesertaKegiatanEvaluatif, type DesainKartuResp, type ModeUrutanNomorPeserta,
  type KegiatanEvaluatif, type PesertaKegiatanEvaluatifResp,
} from '@/api/penilaian';
import { RefreshCw, RotateCcw, Save, Settings } from '@/icons';
import { formatContohNomorPeserta } from '@/lib/nomorPeserta';
import { KELAS_LIST_TAB, KELAS_TRIGGER } from '@/components/HalamanTabs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import KartuPesertaDesainTab from '@/components/kartuPeserta/KartuPesertaDesainTab';
import KartuPesertaCetakTab from '@/components/kartuPeserta/KartuPesertaCetakTab';
import { useFotoPeserta } from '@/components/kartuPeserta/useFotoPeserta';
import { TopBarSearch } from '@/components/TopBarSearch';

type TabKartu = 'nomor' | 'desain' | 'cetak';

type BarisNomorGrid = BarisPesertaKegiatanEvaluatif & { id: number };

const FIELDS_NOMOR: ExcelField[] = [
  {
    key: 'nis_lokal', label: 'NIS', kind: 'static', width: 110,
    renderCell: (row) => row.nis_lokal === null || row.nis_lokal === ''
      ? <span className="text-muted-foreground">—</span>
      : <span className="font-mono">{String(row.nis_lokal)}</span>,
  },
  { key: 'nama', label: 'Nama', kind: 'static', width: 200 },
  {
    key: 'kelas', label: 'Kelas', kind: 'static', width: 90,
    renderCell: (row) => row.kelas === null || row.kelas === ''
      ? <span className="text-muted-foreground">—</span>
      : String(row.kelas),
  },
  {
    key: 'tingkat', label: 'Tingkat', kind: 'static', width: 80,
    renderCell: (row) => row.tingkat === null || row.tingkat === ''
      ? <span className="text-muted-foreground">—</span>
      : String(row.tingkat),
  },
  { key: 'nomor_peserta', label: 'Nomor peserta', kind: 'text', width: 230, maxLength: 100 },
  {
    key: 'sumber_nomor', label: 'Sumber', kind: 'static', width: 100,
    renderCell: (row) => row.sumber_nomor
      ? <span className="text-[10px] uppercase tracking-wide">{String(row.sumber_nomor)}</span>
      : <span className="text-muted-foreground">—</span>,
  },
];

export default function PenilaianKartuPesertaPage() {
  const { jenjangs, tahunAjaranNames, semesters, tingkat, kelas: kelasAktif, loading: filterLoading } = useFilterGlobalAktif();
  const { user } = useAuth();
  const canUbah = bisa(user, 'penilaian.ubah');

  const jenjang = targetTunggal(jenjangs);
  const tahunAjaran = targetTunggal(tahunAjaranNames);
  const semester = targetTunggal(semesters);
  const siap = jenjang !== null && tahunAjaran !== null && semester !== null;

  const [kegiatanEvaluatif, setKegiatanEvaluatif] = useState<KegiatanEvaluatif[]>([]);
  const [kegiatanEvaluatifId, setKegiatanEvaluatifId] = useState<number | ''>('');
  const [kelasOpsi, setKelasOpsi] = useState<Kelas[]>([]);
  const [data, setData] = useState<PesertaKegiatanEvaluatifResp | null>(null);
  const [template, setTemplate] = useState('');
  const [modeUrutan, setModeUrutan] = useState<ModeUrutanNomorPeserta>('per_tingkat');
  const [cari, setCari] = useState('');
  const [cariTertunda, setCariTertunda] = useState('');
  const [loading, setLoading] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [konfirmasiUlang, setKonfirmasiUlang] = useState(false);
  const [polaOpen, setPolaOpen] = useState(false);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<TabKartu>('nomor');
  const [muatanDesain, setMuatanDesain] = useState<DesainKartuResp | null>(null);
  const pengaturanKey = useRef('');
  const permintaanDesain = useRef(0);

  useEffect(() => {
    if (filterLoading || jenjang === null || tahunAjaran === null) {
      setKelasOpsi([]);
      return;
    }
    let hidup = true;
    listKelas({ jenjang, tahun_ajaran: tahunAjaran, per_page: 1000 })
      .then((hasil) => { if (hidup) setKelasOpsi(hasil.data); })
      .catch(() => { if (hidup) setKelasOpsi([]); });
    return () => { hidup = false; };
  }, [filterLoading, jenjang, tahunAjaran]);

  useEffect(() => {
    if (filterLoading || jenjang === null || tahunAjaran === null) {
      setKegiatanEvaluatif([]);
      setKegiatanEvaluatifId('');
      return;
    }
    let hidup = true;
    daftarKegiatanEvaluatif({ jenjang, tahun_ajaran: tahunAjaran })
      .then((hasil) => {
        if (!hidup) return;
        const aktif = hasil.kegiatan_evaluatif.filter((item) => item.is_active);
        setKegiatanEvaluatif(aktif);
        setKegiatanEvaluatifId((saatIni) => aktif.some((item) => item.id === saatIni) ? saatIni : (aktif[0]?.id ?? ''));
      })
      .catch((e) => { if (hidup) setErr(errorMessage(e)); });
    return () => { hidup = false; };
  }, [filterLoading, jenjang, tahunAjaran]);

  const kelasIds = useMemo(
    () => kelasOpsi.filter((item) => kelasAktif.includes(item.nama_kelas)).map((item) => item.id),
    [kelasOpsi, kelasAktif],
  );

  useEffect(() => {
    const bersih = cari.trim();
    const jeda = setTimeout(() => setCariTertunda(bersih), bersih === '' ? 0 : 350);
    return () => clearTimeout(jeda);
  }, [cari]);

  const permintaanTerakhir = useRef(0);
  const muat = useCallback(async () => {
    if (kegiatanEvaluatifId === '' || semester === null) {
      setData(null);
      return;
    }
    const permintaan = ++permintaanTerakhir.current;
    setLoading(true);
    setErr('');
    try {
      const hasil = await daftarPesertaKegiatanEvaluatif({
        kegiatan_evaluatif_id: Number(kegiatanEvaluatifId),
        semester,
        tingkat: tingkat.length > 0 ? tingkat : undefined,
        kelas_id: kelasIds.length > 0 ? kelasIds : undefined,
        q: cariTertunda || undefined,
      });
      if (permintaan !== permintaanTerakhir.current) return;
      setData(hasil);
      const key = `${kegiatanEvaluatifId}:${semester}`;
      if (pengaturanKey.current !== key) {
        pengaturanKey.current = key;
        setTemplate(hasil.pengaturan.template);
        setModeUrutan(hasil.pengaturan.mode_urutan);
      }
    } catch (e) {
      if (permintaan !== permintaanTerakhir.current) return;
      setErr(errorMessage(e));
      setData(null);
    } finally {
      if (permintaan === permintaanTerakhir.current) setLoading(false);
    }
  }, [kegiatanEvaluatifId, semester, tingkat, kelasIds, cariTertunda]);

  useEffect(() => {
    if (filterLoading) return;
    void muat();
  }, [filterLoading, muat]);

  const muatDesain = useCallback(async () => {
    if (kegiatanEvaluatifId === '') {
      setMuatanDesain(null);
      return;
    }
    const permintaan = ++permintaanDesain.current;
    setErr('');
    try {
      const hasil = await daftarDesainKartu(Number(kegiatanEvaluatifId));
      if (permintaan === permintaanDesain.current) setMuatanDesain(hasil);
    } catch (e) {
      if (permintaan === permintaanDesain.current) setErr(errorMessage(e));
    }
  }, [kegiatanEvaluatifId]);

  useEffect(() => {
    setMuatanDesain(null);
    void muatDesain();
  }, [muatDesain]);

  const pesertaSemua = useMemo(() => data?.peserta ?? [], [data]);
  const { foto, memuat: memuatFoto } = useFotoPeserta(pesertaSemua, tab !== 'nomor');
  const kegiatanEvaluatifAktif = kegiatanEvaluatif.find((item) => item.id === kegiatanEvaluatifId) ?? null;
  const lembagaNama = data?.lembaga?.nama ?? jenjang ?? '';
  const pesertaContoh = pesertaSemua[0] ?? null;

  const barisNomor = useMemo<BarisNomorGrid[]>(
    () => (data?.peserta ?? []).map((b) => ({ ...b, id: b.santri_id })),
    [data],
  );

  const getValuesNomor = useCallback((b: BarisNomorGrid) => ({
    nis_lokal: b.nis_lokal,
    nama: b.nama,
    kelas: b.kelas,
    tingkat: b.tingkat,
    nomor_peserta: b.nomor_peserta,
    sumber_nomor: b.sumber_nomor,
  }), []);

  const simpanNomor = useCallback(async (santriId: number, fields: Record<string, string | null>) => {
    if (kegiatanEvaluatifId === '' || semester === null || fields.nomor_peserta === undefined) return;
    await ubahNomorPeserta(santriId, {
      kegiatan_evaluatif_id: Number(kegiatanEvaluatifId),
      semester,
      nomor_peserta: fields.nomor_peserta?.trim() || null,
    });
  }, [kegiatanEvaluatifId, semester]);

  const selesaiNomor = useCallback(async () => { await muat(); }, [muat]);

  const contoh = useMemo(() => {
    const pilihan = kegiatanEvaluatif.find((item) => item.id === kegiatanEvaluatifId);
    if (!pilihan || semester === null || template === '') return '—';
    return formatContohNomorPeserta(template, {
      tahunAjaran: pilihan.tahun_ajaran,
      kodeKegiatanEvaluatif: pilihan.kode,
      semester,
      tingkat: tingkat[0] ?? data?.peserta[0]?.tingkat ?? '1',
      urutan: 1,
    });
  }, [kegiatanEvaluatif, kegiatanEvaluatifId, semester, template, tingkat, data]);

  const payload = useCallback(() => {
    if (kegiatanEvaluatifId === '' || semester === null) return null;
    return {
      kegiatan_evaluatif_id: Number(kegiatanEvaluatifId),
      semester,
      template,
      mode_urutan: modeUrutan,
    };
  }, [kegiatanEvaluatifId, semester, template, modeUrutan]);

  const simpanPola = useCallback(async () => {
    const isi = payload();
    if (isi === null) return;
    setMenyimpan(true);
    try {
      const hasil = await simpanPengaturanNomorPeserta(isi);
      toast.success(hasil.pesan);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setMenyimpan(false);
    }
  }, [payload]);

  const buatNomor = useCallback(async (buatUlangOtomatis: boolean) => {
    const isi = payload();
    if (isi === null) return;
    setMenyimpan(true);
    try {
      const hasil = await generateNomorPeserta({ ...isi, buat_ulang_otomatis: buatUlangOtomatis });
      toast.success(hasil.pesan);
      await muat();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setMenyimpan(false);
      setKonfirmasiUlang(false);
    }
  }, [payload, muat]);

  const tambahToken = useCallback((token: string) => setTemplate((nilai) => `${nilai}${token}`), []);
  const aksiNonaktif = !canUbah || !siap || kegiatanEvaluatifId === '' || template.trim() === '' || menyimpan;

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>

      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari nama, NIS, atau nomor…" />

      <Tabs
        value={tab}
        onValueChange={(nilai) => setTab(nilai as TabKartu)}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <TabsList className={KELAS_LIST_TAB} indikator="primer">
          <TabsTrigger value="nomor" id="tab_nomor_kartu_peserta" className={KELAS_TRIGGER}>Nomor peserta</TabsTrigger>
          <TabsTrigger value="desain" id="tab_desain_kartu_peserta" className={KELAS_TRIGGER}>Desain kartu</TabsTrigger>
          <TabsTrigger value="cetak" id="tab_cetak_kartu_peserta" className={KELAS_TRIGGER}>Cetak</TabsTrigger>
        </TabsList>

        <TabsContent value="nomor" className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 sm:px-6">
        <ExcelTable<BarisNomorGrid>
          tableKey="penilaian_kartu_nomor"
          header="Nomor peserta"
          fields={FIELDS_NOMOR}
          rows={barisNomor}
          getValues={getValuesNomor}
          loading={loading}
          emptyText={!siap ? 'Pilih satu lembaga, tahun ajaran, dan semester.'
            : kegiatanEvaluatif.length === 0 ? 'Belum ada kegiatan evaluatif aktif.'
              : 'Tidak ada peserta pada lingkup ini.'}
          canEdit={canUbah}
          onCommit={simpanNomor}
          onSaved={selesaiNomor}
          renderActions={() => null}
          hideCheckbox
          hideActions
          rail
          awalanToolbar={(
            <label className="flex items-center gap-1.5 text-xs" htmlFor="select_kegiatan_evaluatif_kartu">
              <span className="text-muted-foreground">Kegiatan Evaluatif</span>
              <select
                id="select_kegiatan_evaluatif_kartu"
                className="h-7 border border-input bg-transparent px-2 text-xs"
                value={kegiatanEvaluatifId === '' ? '' : String(kegiatanEvaluatifId)}
                onChange={(e) => {
                  pengaturanKey.current = '';
                  setKegiatanEvaluatifId(e.target.value === '' ? '' : Number(e.target.value));
                }}
              >
                <option value="">— pilih kegiatan evaluatif —</option>
                {kegiatanEvaluatif.map((item) => <option key={item.id} value={item.id}>{item.kode} — {item.nama}</option>)}
              </select>
            </label>
          )}
          akhirToolbar={(
            <Button
              type="button"
              variant="outline"
              size="sm"
              id="btn_pola_nomor"
              disabled={!siap || kegiatanEvaluatifId === ''}
              onClick={() => setPolaOpen(true)}
            >
              <Settings data-icon="inline-start" size={16} /> Pola nomor
            </Button>
          )}
        />
      </div>
        </TabsContent>

        <TabsContent value="desain" className="min-h-0 flex-1 overflow-auto p-3">
          {!siap || kegiatanEvaluatifAktif === null ? (
            <p className="text-xs text-muted-foreground">Pilih kegiatan evaluatif aktif terlebih dahulu.</p>
          ) : (
            <KartuPesertaDesainTab
              kegiatanEvaluatifId={Number(kegiatanEvaluatifId)}
              kegiatanEvaluatif={kegiatanEvaluatifAktif}
              semester={semester ?? '1'}
              lembaga={lembagaNama}
              pesertaContoh={pesertaContoh}
              foto={foto}
              muatan={muatanDesain}
              canUbah={canUbah}
              onMuatUlang={muatDesain}
            />
          )}
        </TabsContent>

        <TabsContent value="cetak" className="min-h-0 flex-1 overflow-auto p-3">
          {!siap || kegiatanEvaluatifAktif === null ? (
            <p className="text-xs text-muted-foreground">Pilih kegiatan evaluatif aktif terlebih dahulu.</p>
          ) : (
            <KartuPesertaCetakTab
              kegiatanEvaluatif={kegiatanEvaluatifAktif}
              semester={semester ?? '1'}
              lembaga={lembagaNama}
              peserta={pesertaSemua}
              foto={foto}
              memuatFoto={memuatFoto}
              muatan={muatanDesain}
            />
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={polaOpen} onOpenChange={setPolaOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Penyusun pola nomor</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
              <div className="min-w-0">
                <span className="mb-2 block text-xs font-semibold">Bagian pola (token)</span>
                <Input
                  id="input_template_nomor_peserta"
                  aria-label="Pola nomor peserta"
                  className="h-9 font-mono text-xs"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  placeholder="{ta_awal_2}.{ta_akhir_2}.{kode_kegiatan_evaluatif}.{tingkat_2}.{nomor_4}"
                />
                <div className="mt-2 flex flex-wrap gap-1">
                  {(data?.token ?? []).map((item) => (
                    <Button
                      key={item.token}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 font-mono text-[11px]"
                      title={`${item.label}; contoh ${item.contoh}`}
                      onClick={() => tambahToken(item.token)}
                      disabled={!canUbah}
                    >
                      {item.token}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold" htmlFor="select_mode_urutan_peserta">Urutan nomor</label>
                <select
                  id="select_mode_urutan_peserta"
                  className="h-9 w-full border border-input bg-background px-2 text-xs"
                  value={modeUrutan}
                  onChange={(e) => setModeUrutan(e.target.value as ModeUrutanNomorPeserta)}
                  disabled={!canUbah}
                >
                  <option value="per_tingkat">Mulai kembali per tingkat</option>
                  <option value="semua_tingkat">Bersambung semua tingkat</option>
                </select>
                <div className="mt-3 border-l-4 border-primary bg-background px-3 py-2">
                  <span className="block text-[11px] text-muted-foreground">Contoh langsung (pratinjau)</span>
                  <strong className="block truncate font-mono text-sm" title={contoh}>{contoh}</strong>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
              <Ringkasan label="Total" nilai={data?.ringkasan.total ?? 0} />
              <Ringkasan label="Belum bernomor" nilai={data?.ringkasan.belum_bernomor ?? 0} />
              <Ringkasan label="Manual" nilai={data?.ringkasan.manual ?? 0} />
              <Ringkasan label="Otomatis" nilai={data?.ringkasan.otomatis ?? 0} />
            </div>

            <DialogFooter className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" size="sm" id="btn_simpan_pola_nomor" disabled={aksiNonaktif} onClick={() => void simpanPola()}>
                <Save data-icon="inline-start" size={16} /> Simpan pola
              </Button>
              <Button type="button" size="sm" id="btn_isi_nomor_kosong" disabled={aksiNonaktif} onClick={() => void buatNomor(false)}>
                <RefreshCw data-icon="inline-start" size={16} /> Isi yang kosong
              </Button>
              <Button type="button" variant="outline" size="sm" id="btn_buat_ulang_nomor" disabled={aksiNonaktif} onClick={() => setKonfirmasiUlang(true)}>
                <RotateCcw data-icon="inline-start" size={16} /> Buat ulang otomatis
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={konfirmasiUlang} onOpenChange={setKonfirmasiUlang}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Buat ulang seluruh nomor otomatis?</AlertDialogTitle>
            <AlertDialogDescription>
              Nomor otomatis akan mengikuti pola dan urutan terbaru. Nomor yang diisi manual tetap dipertahankan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction id="btn_konfirmasi_buat_ulang_nomor" onClick={() => void buatNomor(true)}>Buat ulang</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Ringkasan({ label, nilai }: { label: string; nilai: number }) {
  return (
    <div className="bg-background px-3 py-2">
      <span className="block text-[11px] text-muted-foreground">{label}</span>
      <strong className="text-lg tabular-nums">{nilai}</strong>
    </div>
  );
}
