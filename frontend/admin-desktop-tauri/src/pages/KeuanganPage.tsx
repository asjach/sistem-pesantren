import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage, prefGet, prefSet } from '../api/client';
import { tokenUrut, type PetaArahKolom } from '@/lib/urut';
import {
  daftarJenis, daftarTarif, hapusTarif,
  daftarTunggakan, crosstabTagihan, hapusTagihan, ubahTagihan, catatPembayaran,
  riwayatPembayaran, hapusPembayaran, daftarDispensasi, hapusDispensasi,
  type JenisTagihan, type Tarif, type TunggakanRow, type PembayaranRow, type Dispensasi,
  type CrosstabTagihan, type CrosstabSel, type CrosstabKolom,
} from '../api/keuangan';
import { listLembaga, listTahunAjaran, type Lembaga, type TahunAjaran } from '../api/master';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KELAS_LIST_TAB, KELAS_PANEL_TAB, KELAS_TRIGGER } from '@/components/HalamanTabs';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import PopoverAksiTagihan, { type TagihanAktif } from '@/components/keuangan/PopoverAksiTagihan';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { useFilterGlobalAktif, targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { useLembagaAktif } from '@/lembagaAktif';
import { usePager } from '@/hooks/usePager';
import GenerateTagihanDialog from '@/components/keuangan/GenerateTagihanDialog';
import DispensasiDialog from '@/components/keuangan/DispensasiDialog';
import {
  DispensasiTab, FIELDS_DISPENSASI, FIELDS_JENIS, FIELDS_TARIF, FIELDS_TUNGGAKAN,
  JenisTab, TagihanTab, TarifTab, TunggakanTab,
} from '@/components/keuangan/tabKeuangan';
import {
  DialogTambahJenis, DialogTambahTarif, DialogUbahJenis, DialogUbahTarif,
} from '@/components/keuangan/jenisTarifDialogs';

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

/** Halaman Keuangan: jenis tagihan, tarif, tagihan, pembayaran, tunggakan.
 *
 *  Isi tiap tab hidup di `components/keuangan/tabKeuangan.tsx` dan form
 *  jenis/tarif di `components/keuangan/jenisTarifDialogs.tsx`. Seluruh state
 *  tetap di halaman ini (Radix melepas isi tab yang tidak aktif, jadi state di
 *  dalam komponen tab akan hilang saat berpindah tab) — hanya `loading`/`err`
 *  yang dipisah per tab supaya aktivitas satu tab tak menandai tab lain. */
export default function KeuanganPage() {
  const [jenis, setJenis] = useState<JenisTagihan[]>([]);
  const [tarif, setTarif] = useState<Tarif[]>([]);
  const [tunggakan, setTunggakan] = useState<TunggakanRow[]>([]);
  const [dispensasi, setDispensasi] = useState<Dispensasi[]>([]);
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [daftarTA, setDaftarTA] = useState<TahunAjaran[]>([]);
  /** Error per tab; digabung untuk satu ErrorNotice di atas halaman. */
  const [errJenis, setErrJenis] = useState('');
  const [errTarif, setErrTarif] = useState('');
  const [errTunggakan, setErrTunggakan] = useState('');
  const [errDispensasi, setErrDispensasi] = useState('');
  const [errTagihan, setErrTagihan] = useState('');
  /** Status muat per tab — supaya muat ulang satu tab tak menandai tab lain. */
  const [loadingJenis, setLoadingJenis] = useState(false);
  const [loadingTarif, setLoadingTarif] = useState(false);
  const [loadingTunggakan, setLoadingTunggakan] = useState(false);
  const [loadingDispensasi, setLoadingDispensasi] = useState(false);
  const [loadingTagihan, setLoadingTagihan] = useState(false);
  const [tab, setTab] = useState<string>('jenis');

  const err = errJenis || errTarif || errTunggakan || errDispensasi || errTagihan;

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
  const { page: tunggakanPage, perPage: tunggakanPerPage, setPage: setTunggakanPage, setPerPage: setTunggakanPerPage } = usePager('keuangan_tunggakan');
  const [tunggakanLastPage, setTunggakanLastPage] = useState(1);
  const [tunggakanTotal, setTunggakanTotal] = useState(0);
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
    setErrTagihan(''); setLoadingTagihan(true);
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
      setErrTagihan(errorMessage(e));
      setCrosstab(null);
    } finally { setLoadingTagihan(false); }
  }, [cariTagihan, urutTagihan, arahTagihan, terlambatTagihan]);

  // Filter global/pencarian/urut berubah → muat dari halaman 1.
  useEffect(() => {
    if (filterLoading || jenjangs.length === 0) { if (!filterLoading && jenjangs.length === 0) setCrosstab(null); return; }
    void loadCrosstab(1, tagihanPerPage, jenjangs, tahunAjaranNames);
  }, [filterLoading, jenjangs, tahunAjaranNames, tagihanPerPage, cariTagihan, urutTagihan, arahTagihan, terlambatTagihan, loadCrosstab]);

  /** Tarif mengikuti filter lembaga & tahun ajaran (server-side; kosong = semua). */
  const loadTarif = useCallback(async (jenjang: readonly string[], ta: readonly string[]) => {
    setErrTarif(''); setLoadingTarif(true);
    try {
      setTarif(await daftarTarif({
        jenjang, tahun_ajaran: ta,
        sort: uTarif.urut.length ? tokenUrut(uTarif.urut, uTarif.arahKolom) : undefined,
        arah: uTarif.urut.length ? uTarif.arah : undefined,
      }));
    } catch (e) { setErrTarif(errorMessage(e)); } finally { setLoadingTarif(false); }
  }, [uTarif.urut, uTarif.arah, uTarif.arahKolom]);

  useEffect(() => {
    if (filterLoading) return;
    void loadTarif(jenjangs, tahunAjaranNames);
  }, [filterLoading, jenjangs, tahunAjaranNames, loadTarif]);

  /**
   * Tunggakan per santri: server-side & terpaginasi. Perubahan urut header
   * mengganti identitas `loadTunggakan` sehingga effect memuat ulang dari
   * halaman 1 (pager ikut disinkronkan dari respons).
   */
  const loadTunggakan = useCallback(async (page: number, perPage: number) => {
    setErrTunggakan(''); setLoadingTunggakan(true);
    try {
      const res = await daftarTunggakan({
        page,
        per_page: perPage === 0 ? 'all' : String(perPage),
        sort: uTunggakan.urut.length ? tokenUrut(uTunggakan.urut, uTunggakan.arahKolom) : undefined,
        arah: uTunggakan.urut.length ? uTunggakan.arah : undefined,
      });
      setTunggakan(res.data);
      setTunggakanPage(res.current_page);
      setTunggakanLastPage(res.last_page);
      setTunggakanTotal(res.total);
    } catch (e) {
      setErrTunggakan(errorMessage(e));
      setTunggakan([]);
    } finally { setLoadingTunggakan(false); }
  }, [uTunggakan.urut, uTunggakan.arah, uTunggakan.arahKolom, setTunggakanPage]);

  useEffect(() => { void loadTunggakan(1, tunggakanPerPage); }, [loadTunggakan, tunggakanPerPage]);

  useEffect(() => { setTagihanPage(1); }, [jenjangs, tahunAjaranNames]);

  const load = useCallback(async () => {
    setErrJenis(''); setErrDispensasi('');
    setLoadingJenis(true); setLoadingDispensasi(true);
    try {
      const [j, l, tas, dispen] = await Promise.all([
        daftarJenis({
          sort: uJenis.urut.length ? tokenUrut(uJenis.urut, uJenis.arahKolom) : undefined,
          arah: uJenis.urut.length ? uJenis.arah : undefined,
        }),
        listLembaga({ per_page: 100 }),
        listTahunAjaran({ per_page: 100 }),
        daftarDispensasi({
          sort: uDispensasi.urut.length ? tokenUrut(uDispensasi.urut, uDispensasi.arahKolom) : undefined,
          arah: uDispensasi.urut.length ? uDispensasi.arah : undefined,
        }),
      ]);
      setJenis(j);
      setLembagas(l.data); setDaftarTA(tas.data); setDispensasi(dispen);
      const taAktif = tas.data.find((x) => x.is_aktif)?.nama ?? tas.data[0]?.nama ?? '';
      const diTA = (v: string) => v !== '' && tas.data.some((x) => x.nama === v);
      setTfTA((v) => (diTA(v) ? v : taAktif));
      const diLembaga = (v: string) => v !== '' && l.data.some((x) => x.jenjang === v);
      const jenjangBawaan = l.data.some((x) => x.jenjang === 'MI') ? 'MI' : (l.data[0]?.jenjang ?? '');
      setTfJenjang((v) => (diLembaga(v) ? v : jenjangBawaan));
    } catch (e) {
      const m = errorMessage(e);
      setErrJenis(m); setErrDispensasi(m);
    } finally {
      setLoadingJenis(false); setLoadingDispensasi(false);
    }
  }, [uJenis.urut, uJenis.arah, uJenis.arahKolom, uDispensasi.urut, uDispensasi.arah, uDispensasi.arahKolom]);
  useEffect(() => { void load(); }, [load]);

  // Form sederhana
  const [tambahJenisOpen, setTambahJenisOpen] = useState(false);
  const [tambahTarifOpen, setTambahTarifOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [dispensasiOpen, setDispensasiOpen] = useState(false);
  const [editDispensasi, setEditDispensasi] = useState<Dispensasi | null>(null);
  const [editJenis, setEditJenis] = useState<JenisTagihan | null>(null);
  const [editTarif, setEditTarif] = useState<Tarif | null>(null);
  const [tfJenjang, setTfJenjang] = useState('MI');
  const [tfTA, setTfTA] = useState('2025/2026');
  const genTAtopbar = targetTunggal(tahunAjaranNames);
  /** Sel asal popover aksi (jangkar). null = popover tertutup. */
  const [anchorSel, setAnchorSel] = useState<HTMLElement | null>(null);
  /** Tagihan terpilih dari sel crosstab (isi popover aksi). */
  const [selTagihan, setSelTagihan] = useState<{
    id: number; nama: string; label: string;
    ayah_nama: string | null; ibu_nama: string | null;
    nominal: number; sisa: number;
    status: 'belum' | 'sebagian' | 'lunas';
  } | null>(null);

  /** Muat ulang crosstab pada posisi halaman saat ini. */
  const muatCrosstabSekarang = useCallback(async () => {
    await loadCrosstab(tagihanPage, tagihanPerPage, jenjangs, tahunAjaranNames);
  }, [loadCrosstab, tagihanPage, tagihanPerPage, jenjangs, tahunAjaranNames]);

  /** Riwayat pembayaran untuk tab Detail di popover. */
  const [riwayatRows, setRiwayatRows] = useState<PembayaranRow[]>([]);
  /** Tagihan pemilik `riwayatRows` — biar tak difetch ulang saat tab dibuka berkali-kali. */
  const [riwayatUntuk, setRiwayatUntuk] = useState<number | null>(null);
  const [riwayatBusy, setRiwayatBusy] = useState(false);
  const [riwayatError, setRiwayatError] = useState('');

  /** Sel + kolom crosstab terpilih (dipakai popover aksi). */
  const [selPenuh, setSelPenuh] = useState<CrosstabSel | null>(null);
  const [kolomTerpilih, setKolomTerpilih] = useState<CrosstabKolom | null>(null);

  /** Data yang ditampilkan popover, diturunkan dari sel + kolom terpilih. */
  const popoverTagihan: TagihanAktif | null =
    selTagihan !== null && selPenuh !== null && kolomTerpilih !== null
      ? {
          id: selTagihan.id,
          nama: selTagihan.nama,
          label: selTagihan.label,
          ayah_nama: selTagihan.ayah_nama,
          ibu_nama: selTagihan.ibu_nama,
          nominal: selPenuh.nominal,
          terbayar: selPenuh.terbayar,
          sisa: selPenuh.sisa,
          status: selPenuh.status,
          terlambat: selPenuh.terlambat,
          jatuhTempo: selPenuh.jatuh_tempo,
          tahunAjaran: selPenuh.tahun_ajaran,
          tipe: kolomTerpilih.tipe,
        }
      : null;

  /* Menandai "gesture ini sedang memilih sel baru". Radix DismissableLayer
     menutup popover di pointerdown pertama, lalu memilih sel baru di
     pointerdown yang sama; tanpa penanda ini, pindah sel akan menutup popover
     sepenuhnya (tak ada sel terpilih) dan pengguna harus klik dua kali. Direset di task berikutnya supaya tak hinggap bila tak ada
     dismiss yang menyusul (mis. popover sedang tertutup). */
  const pindahSelRef = useRef(false);
  const pilihSel = useCallback((
    sel: CrosstabSel,
    meta: { nama: string; label: string; ayah_nama: string | null; ibu_nama: string | null },
    anchor: HTMLElement,
    kolom: CrosstabKolom,
  ) => {
    pindahSelRef.current = true;
    setTimeout(() => { pindahSelRef.current = false; }, 0);
    setSelTagihan({
      id: sel.id, nama: meta.nama, label: meta.label,
      ayah_nama: meta.ayah_nama, ibu_nama: meta.ibu_nama,
      nominal: sel.nominal, sisa: sel.sisa, status: sel.status,
    });
    setSelPenuh(sel);
    setKolomTerpilih(kolom);
    setAnchorSel(anchor);
  }, []);

  const tutupPopover = useCallback(() => {
    // Gesture pindah sel → biarkan popover tetap terbuka di sel baru.
    if (pindahSelRef.current) { pindahSelRef.current = false; return; }
    setAnchorSel(null);
    setSelTagihan(null);
    setSelPenuh(null);
    setKolomTerpilih(null);
  }, []);

  /** Muat riwayat pembayaran tagihan terpilih (dipanggil saat tab Detail dibuka). */
  const muatRiwayat = useCallback(async (id: number) => {
    if (riwayatUntuk === id) return;
    setRiwayatBusy(true);
    setRiwayatError('');
    try {
      setRiwayatRows(await riwayatPembayaran(id));
      setRiwayatUntuk(id);
    } catch (e) {
      setRiwayatError(errorMessage(e));
    } finally {
      setRiwayatBusy(false);
    }
  }, [riwayatUntuk]);

  /** Aksi tambah/ubah/hapus yang dipakai komponen tab & dialog. */
  const bukaTambahJenis = useCallback(() => setTambahJenisOpen(true), []);
  const bukaTambahTarif = useCallback(() => {
    if (genTAtopbar && daftarTA.some((x) => x.nama === genTAtopbar)) setTfTA(genTAtopbar);
    setTambahTarifOpen(true);
  }, [genTAtopbar, daftarTA]);
  const bukaTambahDispensasi = useCallback(() => { setEditDispensasi(null); setDispensasiOpen(true); }, []);
  const bukaUbahDispensasi = useCallback((d: Dispensasi) => { setEditDispensasi(d); setDispensasiOpen(true); }, []);
  const suksesTarif = useCallback(async () => {
    await load();
    await loadTarif(jenjangs, tahunAjaranNames);
  }, [load, loadTarif, jenjangs, tahunAjaranNames]);
  const hapusTarifBaris = useCallback((r: Tarif) => {
    void (async () => {
      try {
        await hapusTarif(r.id);
        toast.success('Tarif dihapus.');
        await loadTarif(jenjangs, tahunAjaranNames);
      } catch (e2) { toast.error(errorMessage(e2)); }
    })();
  }, [loadTarif, jenjangs, tahunAjaranNames]);
  const hapusDispensasiBaris = useCallback((r: Dispensasi) => {
    void (async () => {
      try {
        await hapusDispensasi(r.id);
        toast.success('Dispensasi dihapus.');
        await load();
      } catch (e2) { toast.error(errorMessage(e2)); }
    })();
  }, [load]);

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
          <JenisTab
            rows={jenis}
            loading={loadingJenis}
            sort={uJenis}
            efektifSuper={efektifSuper}
            onTambah={bukaTambahJenis}
            onEdit={setEditJenis}
          />
        </TabsContent>

        <TabsContent value="tarif" className={`min-h-0 flex-1 flex flex-col gap-1 ${KELAS_PANEL_TAB}`}>
          <TarifTab
            rows={tarif}
            loading={loadingTarif}
            sort={uTarif}
            onTambah={bukaTambahTarif}
            onEdit={setEditTarif}
            onHapus={hapusTarifBaris}
          />
        </TabsContent>

        <TabsContent value="tagihan" className={`min-h-0 flex-1 flex flex-col gap-1 bg-muted/30 p-1 ${KELAS_PANEL_TAB}`}>
          <TagihanTab
            crosstab={crosstab}
            loading={loadingTagihan}
            terpilihId={selTagihan?.id ?? null}
            total={tagihanTotal}
            cari={cariTagihan}
            onCari={setCariTagihan}
            urut={urutTagihan}
            onUrut={setUrutTagihan}
            arah={arahTagihan}
            onArah={setArahTagihan}
            terlambat={terlambatTagihan}
            onTerlambat={(v) => { setTerlambatTagihan(v); setTagihanPage(1); }}
            onPilih={pilihSel}
            onReset={() => { setCariTagihan(''); setUrutTagihan(''); setArahTagihan('naik'); setTerlambatTagihan(false); setTagihanPage(1); }}
            onBukaGenerate={() => setGenerateOpen(true)}
            pager={{
              page: tagihanPage,
              lastPage: tagihanLastPage,
              perPage: tagihanPerPage,
              onPage: (p) => { setTagihanPage(p); void loadCrosstab(p, tagihanPerPage, jenjangs, tahunAjaranNames); },
              onPerPage: (pp) => { setTagihanPerPage(pp); void loadCrosstab(1, pp, jenjangs, tahunAjaranNames); },
            }}
            popover={
              <PopoverAksiTagihan
                tagihan={popoverTagihan}
                anchor={anchorSel}
                daftarTA={daftarTA}
                riwayat={riwayatRows}
                riwayatBusy={riwayatBusy}
                riwayatError={riwayatError}
                onTutup={tutupPopover}
                onMuatRiwayat={() => { if (selTagihan !== null) void muatRiwayat(selTagihan.id); }}
                onBayar={async (d) => {
                  if (selTagihan === null) return;
                  try {
                    await catatPembayaran({ tagihan_id: selTagihan.id, jumlah: d.jumlah, metode: d.metode, kas: d.kas });
                    toast.success('Tercatat.');
                    tutupPopover();
                    await load();
                    await muatCrosstabSekarang();
                  } catch (e2) { toast.error(errorMessage(e2)); }
                }}
                onUbah={async (d) => {
                  if (selTagihan === null) return;
                  try {
                    await ubahTagihan(selTagihan.id, d);
                    toast.success('Tagihan diubah.');
                    tutupPopover();
                    await load();
                    await muatCrosstabSekarang();
                  } catch (e2) { toast.error(errorMessage(e2)); throw e2; }
                }}
                onHapusPembayaran={async (id) => {
                  try {
                    await hapusPembayaran(id);
                    toast.success('Pembayaran dihapus.');
                    if (selTagihan !== null) {
                      setRiwayatUntuk(null);
                      await muatRiwayat(selTagihan.id);
                    }
                    await load();
                    await muatCrosstabSekarang();
                  } catch (e2) { toast.error(errorMessage(e2)); throw e2; }
                }}
                onHapus={async () => {
                  if (selTagihan === null) return;
                  try {
                    await hapusTagihan(selTagihan.id);
                    toast.success('Tagihan dihapus.');
                    tutupPopover();
                    await load();
                    await muatCrosstabSekarang();
                  } catch (e2) { toast.error(errorMessage(e2)); throw e2; }
                }}
              />
            }
          />
        </TabsContent>

        <TabsContent value="tunggakan" className={`min-h-0 flex-1 flex flex-col gap-1 ${KELAS_PANEL_TAB}`}>
          <TunggakanTab
            rows={tunggakan}
            loading={loadingTunggakan}
            sort={uTunggakan}
            page={tunggakanPage}
            lastPage={tunggakanLastPage}
            total={tunggakanTotal}
            perPage={tunggakanPerPage}
            onPage={(p) => { setTunggakanPage(p); void loadTunggakan(p, tunggakanPerPage); }}
            onPerPage={(pp) => { setTunggakanPerPage(pp); void loadTunggakan(1, pp); }}
          />
        </TabsContent>

        <TabsContent value="dispensasi" className={`min-h-0 flex-1 flex flex-col gap-1 ${KELAS_PANEL_TAB}`}>
          <DispensasiTab
            rows={dispensasi}
            loading={loadingDispensasi}
            sort={uDispensasi}
            onTambah={bukaTambahDispensasi}
            onEdit={bukaUbahDispensasi}
            onHapus={hapusDispensasiBaris}
          />
        </TabsContent>
      </Tabs>

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

      {tambahTarifOpen && (
        <DialogTambahTarif
          onClose={() => setTambahTarifOpen(false)}
          onSukses={suksesTarif}
          jenis={jenis}
          lembagas={lembagas}
          daftarTA={daftarTA}
          pilihanLembaga={pilihanLembaga}
          jenjang={tfJenjang}
          ta={tfTA}
          onJenjang={setTfJenjang}
          onTa={setTfTA}
        />
      )}
      {tambahJenisOpen && (
        <DialogTambahJenis
          onClose={() => setTambahJenisOpen(false)}
          onSukses={load}
          pilihanLembaga={pilihanLembaga}
          efektifSuper={efektifSuper}
          peranJenjang={peranJenjang}
        />
      )}
      {editJenis !== null && (
        <DialogUbahJenis
          item={editJenis}
          onClose={() => setEditJenis(null)}
          onSukses={load}
          pilihanLembaga={pilihanLembaga}
          efektifSuper={efektifSuper}
        />
      )}
      {editTarif !== null && (
        <DialogUbahTarif
          item={editTarif}
          onClose={() => setEditTarif(null)}
          onSukses={suksesTarif}
        />
      )}
    </div>
  );
}
