import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { errorMessage, prefGet, prefSet } from '../api/client';
import { tokenUrut, type PetaArahKolom } from '@/lib/urut';
import { hariIniIso } from '@/lib/tanggal';
import {
  daftarJenis, daftarTarif, hapusTarif, buatJenis, ubahJenis, hapusJenis, buatTarif, buatTagihan, ubahTarif,
  crosstabTagihan, hapusTagihan, ubahTagihan, catatPembayaran, daftarDispensasi,
  riwayatPembayaran, hapusPembayaran, generateTagihan,
  type JenisTagihan, type Tarif, type PembayaranRow, type Dispensasi,
  type CrosstabBaris, type CrosstabTagihan, type CrosstabSel, type CrosstabKolom,
} from '../api/keuangan';
import { kunciSel, labelSel, type MetaSel, type SelBlok } from '@/components/keuangan/TagihanCrosstab';
import { lingkupCocokJenjang } from '@/lib/dispensasi';
import { listKelas, listLembaga, listTahunAjaran, type Kelas, type Lembaga, type TahunAjaran } from '../api/master';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KELAS_LIST_TAB, KELAS_PANEL_TAB, KELAS_TRIGGER } from '@/components/HalamanTabs';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { TopBarSearch } from '@/components/TopBarSearch';
import PopoverAksiTagihan, { type TagihanAktif, type TambahCtx } from '@/components/keuangan/PopoverAksiTagihan';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { useFilterGlobalAktif, targetTunggal } from '@/hooks/useFilterGlobalAktif';
import { useLembagaAktif } from '@/lembagaAktif';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { usePager } from '@/hooks/usePager';
import GenerateTagihanDialog from '@/components/keuangan/GenerateTagihanDialog';
import {
  FIELDS_JENIS, FIELDS_TARIF,
  JenisTab, TagihanTab, TarifTab,
  pastikanTarifBaru, payloadBuatJenis, payloadBuatTarif, payloadUbahJenis, payloadUbahTarif,
} from '@/components/keuangan/tabKeuangan';
import BatchAksiTagihan, { type AksiBatch, type TargetBuatKolom } from '@/components/keuangan/BatchAksiTagihan';
import SantriCustomTab from '@/components/keuangan/tabSantriCustom';
import {
  DialogTambahJenis, DialogTambahTarif, DialogUbahJenis, DialogUbahTarif,
} from '@/components/keuangan/jenisTarifDialogs';

const TAB_KEUANGAN = ['jenis', 'tarif', 'tagihan', 'custom'] as const;

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

/** Halaman Keuangan: jenis tagihan, tarif, dan tagihan (crosstab).
 *
 *  Isi tiap tab hidup di `components/keuangan/tabKeuangan.tsx` dan form
 *  jenis/tarif di `components/keuangan/jenisTarifDialogs.tsx`. Seluruh state
 *  tetap di halaman ini (Radix melepas isi tab yang tidak aktif, jadi state di
 *  dalam komponen tab akan hilang saat berpindah tab) — hanya `loading`/`err`
 *  yang dipisah per tab supaya aktivitas satu tab tak menandai tab lain. */
export default function KeuanganPage() {
  const [jenis, setJenis] = useState<JenisTagihan[]>([]);
  const [tarif, setTarif] = useState<Tarif[]>([]);
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [daftarTA, setDaftarTA] = useState<TahunAjaran[]>([]);
  /** Error per tab; digabung untuk satu ErrorNotice di atas halaman. */
  const [errJenis, setErrJenis] = useState('');
  const [errTarif, setErrTarif] = useState('');
  const [errTagihan, setErrTagihan] = useState('');
  /** Status muat per tab — supaya muat ulang satu tab tak menandai tab lain. */
  const [loadingJenis, setLoadingJenis] = useState(false);
  const [loadingTarif, setLoadingTarif] = useState(false);
  const [loadingTagihan, setLoadingTagihan] = useState(false);
  const [tab, setTab] = useState<string>('jenis');

  const err = errJenis || errTarif || errTagihan;

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
  const { jenjangs, tahunAjaranNames, semesters, tingkat, kelas: kelasAktif, loading: filterLoading } = useFilterGlobalAktif();
  /** Jenis global (Semua) hanya untuk super_admin efektif — mati saat bertindak. */
  const { efektifSuper, peranJenjang, pilihan: pilihanLembaga } = useLembagaAktif();
  const { user } = useAuth();
  /** Mode Edit tabel Jenis & Tarif = izin `keuangan.ubah` (endpoint PUT). */
  const canUbahKeuangan = bisa(user, 'keuangan.ubah');
  /** Mode Input tabel Jenis & Tarif = izin `keuangan.tambah` (endpoint POST). */
  const canTambahKeuangan = bisa(user, 'keuangan.tambah');
  /** Urut header tiap tabel (perubahan memicu muat ulang via effect). */
  const uJenis = useUrutTabel();
  const uTarif = useUrutTabel();
  /** Crosstab Tagihan: urut dari Preset Urut (`keuangan_tagihan_crosstab`). */
  const uTagihan = useUrutTabel();

  /** Crosstab tagihan: baris = santri, kolom = jenis (bulanan per bulan). */
  const [crosstab, setCrosstab] = useState<CrosstabTagihan | null>(null);
  const [cariTagihan, setCariTagihan] = useState('');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const tabUrl = searchParams.get('tab');
    const cariUrl = searchParams.get('cari');

    if (tabUrl && (TAB_KEUANGAN as readonly string[]).includes(tabUrl)) setTab(tabUrl);
    if (cariUrl !== null) setCariTagihan(cariUrl);
  }, [searchParams]);
  /** Pencarian yang benar-benar dipakai saat muat: ditunda 400 ms supaya tak
   *  memanggil API tiap ketikan (pola sama dengan `useDaftarTabel`). */
  const [cariTagihanTertunda, setCariTagihanTertunda] = useState('');
  /** Tab Tagihan: hanya sel yang sudah lewat jatuh tempo. */
  const [terlambatTagihan, setTerlambatTagihan] = useState(false);
  /** Tab Tagihan: keaktifan santri ('' = semua). */
  const [keaktifanTagihan, setKeaktifanTagihan] = useState<'' | 'aktif' | 'nonaktif'>('');

  /** Opsi kelas lingkup: rail bekerja dengan NAMA kelas (filter global),
   *  sedangkan endpoint crosstab minta ID — jadi dipetakan di sini. */
  const [kelasOpsi, setKelasOpsi] = useState<Kelas[]>([]);
  useEffect(() => {
    if (filterLoading || jenjangs.length === 0) { setKelasOpsi([]); return; }
    let hidup = true;
    listKelas({ jenjang: jenjangs, tahun_ajaran: tahunAjaranNames, per_page: 1000 })
      .then((p) => { if (hidup) setKelasOpsi(p.data); })
      .catch(() => { if (hidup) setKelasOpsi([]); });
    return () => { hidup = false; };
  }, [filterLoading, jenjangs, tahunAjaranNames]);
  /** Id kelas dari nama yang dipilih di rail. */
  const kelasFilterIds = useMemo(
    () => kelasOpsi.filter((k) => kelasAktif.includes(k.nama_kelas)).map((k) => k.id),
    [kelasOpsi, kelasAktif],
  );

  /** Request terakhir; naik tiap muat. Balasan yang tak lagi relevan diabaikan. */
  const crosstabReqRef = useRef(0);
  const crosstabAbortRef = useRef<AbortController | null>(null);

  const loadCrosstab = useCallback(async (
    page: number, perPage: number, jenjang: readonly string[], ta: readonly string[],
  ) => {

    const req = ++crosstabReqRef.current;
    crosstabAbortRef.current?.abort();
    const ac = new AbortController();
    crosstabAbortRef.current = ac;
    setErrTagihan(''); setLoadingTagihan(true);
    try {
      const res = await crosstabTagihan({
        page,
        per_page: perPage === 0 ? 'all' : String(perPage),
        jenjang,
        tahun_ajaran: ta,
        santri: cariTagihanTertunda === '' ? undefined : cariTagihanTertunda,

        sort: uTagihan.urut.length ? tokenUrut(uTagihan.urut, uTagihan.arahKolom) : undefined,
        arah: uTagihan.urut.length ? uTagihan.arah : undefined,
        terlambat: terlambatTagihan || undefined,
        keaktifan: keaktifanTagihan || undefined,
        tingkat: tingkat.length ? tingkat : undefined,
        kelas_id: kelasFilterIds.length ? kelasFilterIds : undefined,
        signal: ac.signal,
      });
      if (req !== crosstabReqRef.current) return;
      setCrosstab(res);
      setTagihanPage(res.current_page);
      setTagihanLastPage(res.last_page);
      setTagihanTotal(res.total);
    } catch (e) {
      if (ac.signal.aborted) return;
      if (req !== crosstabReqRef.current) return;
      setErrTagihan(errorMessage(e));
      setCrosstab(null);
    } finally {
      if (req === crosstabReqRef.current) setLoadingTagihan(false);
    }
  }, [cariTagihanTertunda, uTagihan.urut, uTagihan.arah, uTagihan.arahKolom, terlambatTagihan, keaktifanTagihan, tingkat, kelasFilterIds]);

  useEffect(() => {
    const bersih = cariTagihan.trim();
    const t = setTimeout(() => setCariTagihanTertunda(bersih), bersih === '' ? 0 : 400);
    return () => clearTimeout(t);
  }, [cariTagihan]);

  useEffect(() => {
    if (filterLoading || jenjangs.length === 0) { if (!filterLoading && jenjangs.length === 0) setCrosstab(null); return; }
    void loadCrosstab(1, tagihanPerPage, jenjangs, tahunAjaranNames);
  }, [filterLoading, jenjangs, tahunAjaranNames, tagihanPerPage, cariTagihanTertunda, uTagihan.urut, uTagihan.arah, uTagihan.arahKolom, terlambatTagihan, keaktifanTagihan, loadCrosstab]);

  useEffect(() => () => crosstabAbortRef.current?.abort(), []);

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

  useEffect(() => { setTagihanPage(1); }, [jenjangs, tahunAjaranNames]);

  const load = useCallback(async () => {
    setErrJenis('');
    setLoadingJenis(true);
    try {
      const [j, l, tas] = await Promise.all([
        daftarJenis({
          sort: uJenis.urut.length ? tokenUrut(uJenis.urut, uJenis.arahKolom) : undefined,
          arah: uJenis.urut.length ? uJenis.arah : undefined,
        }),
        listLembaga({ per_page: 100 }),
        listTahunAjaran({ per_page: 100 }),
      ]);
      setJenis(j);
      setLembagas(l.data);
      setDaftarTA(tas.data);
      const taAktif = tas.data.find((x) => x.is_aktif)?.nama ?? tas.data[0]?.nama ?? '';
      const diTA = (v: string) => v !== '' && tas.data.some((x) => x.nama === v);
      setTfTA((v) => (diTA(v) ? v : taAktif));
      const diLembaga = (v: string) => v !== '' && l.data.some((x) => x.jenjang === v);
      const jenjangBawaan = l.data.some((x) => x.jenjang === 'MI') ? 'MI' : (l.data[0]?.jenjang ?? '');
      setTfJenjang((v) => (diLembaga(v) ? v : jenjangBawaan));
    } catch (e) {
      const m = errorMessage(e);
      setErrJenis(m);
    } finally {
      setLoadingJenis(false);
    }
  }, [uJenis.urut, uJenis.arah, uJenis.arahKolom]);
  useEffect(() => { void load(); }, [load]);

  const [tambahJenisOpen, setTambahJenisOpen] = useState(false);
  const [tambahTarifOpen, setTambahTarifOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [editJenis, setEditJenis] = useState<JenisTagihan | null>(null);
  const [editTarif, setEditTarif] = useState<Tarif | null>(null);
  const [tfJenjang, setTfJenjang] = useState('MI');
  const [tfTA, setTfTA] = useState('2025/2026');
  const genTAtopbar = targetTunggal(tahunAjaranNames);
  /** Lembaga filter tunggal — lingkup baris input tabel Tarif (mode Input). */
  const jenjangInputTarif = targetTunggal(jenjangs);
  /** Jenis yang sudah punya tarif di lingkup baris input (lembaga + TA filter):
   *  ditandai "sudah ada" di dropdown agar bentrok terlihat sebelum disimpan. */
  const jenisTerpakaiTarif = useMemo(() => {
    if (jenjangInputTarif === null || genTAtopbar === null) return new Set<number>();
    return new Set(
      tarif
        .filter((t) => t.jenjang === jenjangInputTarif && t.tahun_ajaran === genTAtopbar)
        .map((t) => t.jenis_id),
    );
  }, [tarif, jenjangInputTarif, genTAtopbar]);
  /** Jenjang lembaga master ∩ akses akun — opsi popover Buat Tarif di dialog
   *  generate agar tetap lengkap meski TA terpilih belum punya tarif. */
  const jenjangPilihan = useMemo(
    () => lembagas.filter((l) => pilihanLembaga.some((p) => p.jenjang === l.jenjang)).map((l) => l.jenjang),
    [lembagas, pilihanLembaga],
  );
  /** Sel asal popover aksi (jangkar). null = popover tertutup. */
  const [anchorSel, setAnchorSel] = useState<HTMLElement | null>(null);
  /** Tagihan terpilih dari sel crosstab (isi popover aksi). */
  const [selTagihan, setSelTagihan] = useState<{
    id: number; nama: string; label: string;
    ayah_nama: string | null; ibu_nama: string | null;
    santri_id: number; foto_dokumen_id: number | null; foto_profil: boolean; kelas: string | null; jenjang_riwayat: string[];
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

  /** Data yang ditampilkan popover, diturunkan dari sel + kolom terpilih.
   *  Di-memo agar identitas stabil: popover me-reset form + fetch ulang tiap
   *  identitas berganti, dan render halaman (ketikan cari, reload) tidak boleh
   *  mengulanginya selama sel yang sama masih terpilih. */
  const popoverTagihan: TagihanAktif | null = useMemo(
    () => (selTagihan !== null && selPenuh !== null && kolomTerpilih !== null
      ? {
          id: selTagihan.id,
          nama: selTagihan.nama,
          label: selTagihan.label,
          ayah_nama: selTagihan.ayah_nama,
          ibu_nama: selTagihan.ibu_nama,
          santri_id: selTagihan.santri_id,
          fotoDokumenId: selTagihan.foto_dokumen_id,
          fotoProfil: selTagihan.foto_profil,
          kelas: selTagihan.kelas,
          jenjang: selPenuh.jenjang ?? null,
          jenjangRiwayat: selTagihan.jenjang_riwayat,
          jenisId: kolomTerpilih.jenis_id,
          nominal: selPenuh.nominal,
          terbayar: selPenuh.terbayar,
          sisa: selPenuh.sisa,
          status: selPenuh.status,
          potongan: selPenuh.potongan ?? 0,
          dispensasi_ids: selPenuh.dispensasi_ids ?? null,
          terlambat: selPenuh.terlambat,
          jatuhTempo: selPenuh.jatuh_tempo,
          tahunAjaran: selPenuh.tahun_ajaran,
          tipe: kolomTerpilih.tipe,
        }
      : null),
    [selTagihan, selPenuh, kolomTerpilih],
  );

  /** Tagihan terpilih klik kiri: id → snapshot sel + jenis_id kolomnya.
   *  Snapshot dipakai menjalankan aksi batch tanpa bergantung pada halaman
   *  crosstab saat ini (pilihan bisa lintas halaman). */
  const [pilihanTerpilih, setPilihanTerpilih] = useState<Map<string, { santriId: number; key: string; jenisId: number; sel?: CrosstabSel }>>(new Map());
  /** Aksi batch yang sedang dikonfirmasi (null = dialog tertutup). */
  const [batchDialog, setBatchDialog] = useState<AksiBatch | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  /** Form dialog bayar. */
  const [batchMetode, setBatchMetode] = useState<'tunai' | 'transfer'>('tunai');
  const [batchKas, setBatchKas] = useState<'tunai_tu' | 'bank_lembaga' | 'bank_pesantren'>('tunai_tu');
  /** Form dialog ubah. */
  const [ubahPakaiJatuhTempo, setUbahPakaiJatuhTempo] = useState(false);
  const [ubahJatuhTempo, setUbahJatuhTempo] = useState('');
  /** '' = tanpa perubahan, 'tanpa' = lepas dispensasi, number = id paket. */
  const [ubahDispen, setUbahDispen] = useState<number | 'tanpa' | ''>('');
  const [daftarDispenBatch, setDaftarDispenBatch] = useState<Dispensasi[]>([]);
  /** Form dialog buat massal: nominal & jatuh tempo PER KOLOM target (key =
   *  kunci kolom crosstab). Jenis & periode tidak diisi di sini — keduanya
   *  datang dari kolom sel yang terseleksi. */
  const [nominalBuat, setNominalBuat] = useState<Record<string, string>>({});
  const [jatuhTempoBuat, setJatuhTempoBuat] = useState<Record<string, string>>({});
  const [galatBuat, setGalatBuat] = useState<string | null>(null);

  /** Set id tagihan terpilih — crosstab menggambar garis seleksinya. */
  const selectionSet = useMemo(() => new Set(pilihanTerpilih.keys()), [pilihanTerpilih]);
  /** Total sisa tagihan yang masih bisa dibayar (dialog bayar). */
  const totalSisaTerpilih = useMemo(() => {
    let t = 0;
    for (const v of pilihanTerpilih.values()) if ((v.sel?.sisa ?? 0) > 0) t += v.sel!.sisa;
    return t;
  }, [pilihanTerpilih]);
  /** Cacah sel terpilih yang punya tagihan (aksi bayar/ubah/hapus). */
  const jmlTagihanTerpilih = useMemo(
    () => [...pilihanTerpilih.values()].filter((v) => v.sel !== undefined).length,
    [pilihanTerpilih],
  );
  /** Baris crosstab per santri (sumber keaktifan untuk target buat massal). */
  const barisPerSantri = useMemo(() => {
    const m = new Map<number, CrosstabBaris>();
    for (const b of crosstab?.baris ?? []) m.set(b.santri_id, b);
    return m;
  }, [crosstab]);

  /** Target buat massal: satu entri per kolom crosstab yang punya sel KOSONG
   *  terseleksi. Jenis & periode tiap tagihan datang dari KOLOM sel itu dan
   *  santrinya dari BARIS sel itu — jadi pilihan sel-lah yang menentukan
   *  target, bukan dropdown jenis. Sel yang sudah punya tagihan dan santri
   *  nonaktif (generate menolaknya) tidak ikut. */
  const targetBuat = useMemo<TargetBuatKolom[]>(() => {
    const perKolom = new Map<string, number[]>();
    for (const v of pilihanTerpilih.values()) {
      if (v.sel !== undefined) continue;
      if (barisPerSantri.get(v.santriId)?.aktif === false) continue;
      const arr = perKolom.get(v.key);
      if (arr === undefined) perKolom.set(v.key, [v.santriId]);
      else arr.push(v.santriId);
    }

    const urutSantri = new Map<number, number>();
    (crosstab?.baris ?? []).forEach((b, i) => urutSantri.set(b.santri_id, i));
    return (crosstab?.kolom ?? [])
      .filter((k) => perKolom.has(k.key))
      .map((k) => ({
        key: k.key,
        kolom: k,
        santriIds: [...(perKolom.get(k.key) ?? [])].sort(
          (a, b) => (urutSantri.get(a) ?? 0) - (urutSantri.get(b) ?? 0),
        ),
      }));
  }, [pilihanTerpilih, barisPerSantri, crosstab]);
  /** Sel terpilih yang dilewati buat massal karena santrinya nonaktif. */
  const nonaktifBuat = useMemo(() => {
    let n = 0;
    for (const v of pilihanTerpilih.values()) {
      if (v.sel === undefined && barisPerSantri.get(v.santriId)?.aktif === false) n += 1;
    }
    return n;
  }, [pilihanTerpilih, barisPerSantri]);

  /** Cermin sinkron pilihan terkini. Dibaca dari callback ber-identitas stabil
   *  (mis. `mulaiGeser` saat gesture berikutnya dimulai). Ditulis LANGSUNG
   *  saat pilihan diubah — BUKAN lewat `useEffect`, sebab effect berjalan
   *  setelah render: nilainya masih basi ketika gesture baru dimulai dalam
   *  frame yang sama, sehingga sel yang jelas terpilih tak dikenali dan mode
   *  irisan salah ditentukan. */
  const pilihRef = useRef<ReadonlySet<string>>(new Set());
  /** Satu-satunya pintu perubahan pilihan: state + cermin diperbarui bersama. */
  const setPilih = useCallback((
    berikut: (prev: ReadonlyMap<string, { santriId: number; key: string; jenisId: number; sel?: CrosstabSel }>) =>
      Map<string, { santriId: number; key: string; jenisId: number; sel?: CrosstabSel }>,
  ) => {
    setPilihanTerpilih((prev) => {
      const n = berikut(prev);
      pilihRef.current = new Set(n.keys());
      return n;
    });
  }, []);
  /** Klik kiri sel → toggle pilihan (termasuk sel kosong). */
  const togglePilih = useCallback((cell: SelBlok) => {
    const kunci = kunciSel(cell);
    setPilih((prev) => {
      const n = new Map(prev);
      if (n.has(kunci)) n.delete(kunci);
      else n.set(kunci, { santriId: cell.santriId, key: cell.key, jenisId: cell.jenisId, sel: cell.sel });
      return n;
    });
  }, [setPilih]);
  /** Ganti seluruh pilihan dengan blok sel (tahan-geser, Shift) — termasuk
   *  sel kosong agar santri tanpa tagihan ikut sasaran Buat Massal. */
  const pilihBlok = useCallback((items: SelBlok[]) => {
    setPilih(() => {
      const m = new Map<string, { santriId: number; key: string; jenisId: number; sel?: CrosstabSel }>();
      for (const it of items) m.set(kunciSel(it), { santriId: it.santriId, key: it.key, jenisId: it.jenisId, sel: it.sel });
      return m;
    });
  }, [setPilih]);
  /** Klik kiri biasa: sorotan (anchor) pindah ke satu sel. Pilihan diserahkan
   *  ke sel terpilih itu sendiri (ganti seluruh pilihan) ala Excel. */
  const pilihAnchorSatu = useCallback((cell: SelBlok) => {
    setPilih(() => {
      const m = new Map<string, { santriId: number; key: string; jenisId: number; sel?: CrosstabSel }>();
      m.set(kunciSel(cell), { santriId: cell.santriId, key: cell.key, jenisId: cell.jenisId, sel: cell.sel });
      return m;
    });
  }, [setPilih]);
  /** Pilihan BEKAS yang jadi acuan irisan untuk gesture geser yang sedang
   *  berjalan; `null` = gesture ini memulai seleksi baru (blok dipakai utuh).
   *
   *  Irisan hanya diukur terhadap pilihan yang dibuat oleh gesture ITU
   *  sendiri — bukan terhadap pilihan dari gesture sebelumnya. Dua akibat yang
   *  ingin dihindari:
   *   - mengukur terhadap hasil langkah sebelumnya membuat blok menyusut sel
   *     demi sel ("geser cuma memblok satu sel");
   *   - mengukur terhadap pilihan gesture sebelumnya membuat drag kedua di
   *     luar pilihan pertama menghasilkan pilihan KOSONG (drag tampak mati).
   *
   *  Aturannya mengikuti Excel: drag yang DIMULAI dari sel yang sudah terpilih
   *  = menggeser/menyusutkan seleksi itu (irisan); drag yang dimulai dari sel
   *  di luar seleksi = seleksi baru yang menggantikan. */
  const pilihAwalRef = useRef<Set<string> | null>(null);
  /** Tahan-geser dimulai di sel `idAwal` → putuskan mode gesture ini.
   *
   *  Irisan (geser/susutkan seleksi lama ala Excel) HANYA bila pilihan lama
   *  benar-benar "sebuah blok", yaitu memuat lebih dari satu sel. Bila pilihan
   *  lama cuma SATU sel — persis kondisi setelah klik kiri lalu drag cepat dari
   *  sel yang sama — gesture ini diperlakukan sebagai seleksi BARU: kalau
   *  memakai irisan, blok yang digeser disaring oleh himpunan berisi satu sel
   *  itu saja, sehingga seluruh drag terbuang dan tak ada seleksi yang
   *  terbentuk (laporan bug: "klik lalu klik-geser di sel itu tidak
   *  menyeleksi"). Drag dari dalam pilihan banyak tetap mengiris seperti
   *  sebelumnya. */
  const mulaiGeser = useCallback((kunciAwal: string) => {
    const sekarang = pilihRef.current;
    pilihAwalRef.current = sekarang.size > 1 && sekarang.has(kunciAwal) ? new Set(sekarang) : null;
  }, []);
  /** Gesture geser berakhir → lupakan acuan. Gesture berikutnya memutuskan
   *  mode-nya sendiri lewat `mulaiGeser`. */
  const geserSelesai = useCallback(() => {
    pilihAwalRef.current = null;
  }, []);
  /** Tahan-geser biasa — lihat `pilihAwalRef` untuk aturan irisannya. */
  const pilihIrisan = useCallback((items: SelBlok[]) => {
    const awal = pilihAwalRef.current;
    setPilih(() => {
      const n = new Map<string, { santriId: number; key: string; jenisId: number; sel?: CrosstabSel }>();
      for (const it of items) {
        if (awal === null || awal.has(kunciSel(it))) {
          n.set(kunciSel(it), { santriId: it.santriId, key: it.key, jenisId: it.jenisId, sel: it.sel });
        }
      }
      return n;
    });
  }, [setPilih]);
  /** Ctrl/Cmd+tahan-geser: blok baru ditambahkan ke pilihan yang sudah ada. */
  const tambahBlok = useCallback((items: SelBlok[]) => {
    setPilih((prev) => {
      const n = new Map(prev);
      for (const it of items) n.set(kunciSel(it), { santriId: it.santriId, key: it.key, jenisId: it.jenisId, sel: it.sel });
      return n;
    });
  }, [setPilih]);
  /** Kurangi blok tagihan dari pilihan (Alt/Option+tahan-geser). */
  const lepasBlok = useCallback((items: SelBlok[]) => {
    setPilih((prev) => {
      const n = new Map(prev);
      for (const it of items) n.delete(kunciSel(it));
      return n;
    });
  }, [setPilih]);
  /** Buka dialog konfirmasi salah satu aksi batch. */
  const bukaBatch = useCallback((aksi: AksiBatch) => {
    if (aksi === 'bayar') { setBatchMetode('tunai'); setBatchKas('tunai_tu'); }
    if (aksi === 'ubah') {
      setUbahPakaiJatuhTempo(false); setUbahJatuhTempo(''); setUbahDispen(''); setDaftarDispenBatch([]);
      daftarDispensasi({ is_active: true })
        .then((d) => setDaftarDispenBatch(d))
        .catch(() => setDaftarDispenBatch([]));
    }
    if (aksi === 'buat') {

      const nominal: Record<string, string> = {};
      const jt: Record<string, string> = {};
      for (const t of targetBuat) {
        const tarifCocok = tarif.find((x) => x.jenis_id === t.kolom.jenis_id
          && (genTAtopbar == null || x.tahun_ajaran === genTAtopbar));
        nominal[t.key] = tarifCocok ? String(tarifCocok.nominal) : '';
        if (t.kolom.tipe !== 'bulanan') jt[t.key] = hariIniIso();
      }
      setNominalBuat(nominal);
      setJatuhTempoBuat(jt);
      setGalatBuat(null);
    }
    setBatchDialog(aksi);
  }, [targetBuat, tarif, genTAtopbar]);
  /** Jalankan aksi batch yang sedang dikonfirmasi. */
  const jalankanBatch = useCallback(async () => {
    const aksi = batchDialog;
    if (aksi === null) return;
    const entries = [...pilihanTerpilih.entries()];
    if (entries.length === 0) { setBatchDialog(null); return; }

    type EntriAda = [string, { santriId: number; key: string; jenisId: number; sel: CrosstabSel }];
    const ada = entries.filter(([, v]) => v.sel !== undefined) as EntriAda[];
    const gagal = new Map<string, string>();
    const laporkan = (jumlah: number, pesan: string) => {
      if (gagal.size === 0) {
        toast.success(pesan);
        return;
      }
      if (jumlah > 0) toast.warning(pesan);
      toast.error(`${gagal.size} tagihan gagal. ${[...new Set(gagal.values())].join(' · ')}`);
    };
    setBatchBusy(true);
    try {
      if (aksi === 'bayar') {
        const bisa = ada.filter(([, v]) => v.sel.sisa > 0);
        if (bisa.length === 0) {
          toast.warning('Tidak ada tagihan dengan sisa yang bisa dibayar.');
          setBatchDialog(null);
          return;
        }
        let sukses = 0;
        for (const [key, v] of bisa) {
          try {
            await catatPembayaran({ tagihan_id: v.sel.id, jumlah: v.sel.sisa, metode: batchMetode, kas: batchKas });
            sukses += 1;
          } catch (e) { gagal.set(key, errorMessage(e)); }
        }
        laporkan(sukses, `${sukses} tagihan dibayar lunas.`);
      } else if (aksi === 'hapus_tagihan') {
        if (ada.length === 0) {
          toast.warning('Tidak ada tagihan terpilih.');
          setBatchDialog(null);
          return;
        }
        let sukses = 0;
        for (const [key, v] of ada) {
          try { await hapusTagihan(v.sel.id); sukses += 1; } catch (e) { gagal.set(key, errorMessage(e)); }
        }
        laporkan(sukses, `${sukses} tagihan dihapus.`);
      } else if (aksi === 'hapus_riwayat') {
        if (ada.length === 0) {
          toast.warning('Tidak ada tagihan terpilih.');
          setBatchDialog(null);
          return;
        }
        let dihapus = 0;
        for (const [key, v] of ada) {
          try {
            const riwayat = await riwayatPembayaran(v.sel.id);
            for (const r of riwayat) {
              try { await hapusPembayaran(r.id); dihapus += 1; } catch (e) { gagal.set(key, errorMessage(e)); }
            }
          } catch (e) { gagal.set(key, errorMessage(e)); }
        }
        laporkan(dihapus, `${dihapus} baris riwayat dihapus.`);
      } else if (aksi === 'ubah') {
        const pkg = ubahDispen !== '' && ubahDispen !== 'tanpa'
          ? daftarDispenBatch.find((d) => d.id === ubahDispen) ?? null
          : null;
        if (ada.length === 0) {
          toast.warning('Tidak ada tagihan terpilih.');
          setBatchDialog(null);
          return;
        }
        let sukses = 0;
        /** Sel yang paketnya tak berlaku (jenis/lembaga beda) — dilaporkan
         *  supaya pemilihan paket berlingkup lain tak diam-diam tanpa hasil. */
        let lewatDispen = 0;
        for (const [key, v] of ada) {

          const cocokJenis = pkg ? pkg.aturan.some((a) => a.jenis_id === v.jenisId) : false;
          const cocokLingkup = pkg ? lingkupCocokJenjang(pkg.jenjang, v.sel.jenjang) : false;
          const dispenIds = pkg && cocokJenis && cocokLingkup
            ? [pkg.id]
            : ubahDispen === 'tanpa' ? [] : undefined;
          if (pkg && dispenIds === undefined) lewatDispen += 1;
          try {
            await ubahTagihan(v.sel.id, {
              nominal: v.sel.nominal,
              tahun_ajaran: v.sel.tahun_ajaran,
              jatuh_tempo: ubahPakaiJatuhTempo ? (ubahJatuhTempo || null) : v.sel.jatuh_tempo,
              ...(dispenIds !== undefined ? { dispensasi_ids: dispenIds } : {}),
            });
            sukses += 1;
          } catch (e) { gagal.set(key, errorMessage(e)); }
        }
        laporkan(sukses, `${sukses} tagihan diubah${lewatDispen > 0 ? `, ${lewatDispen} dilewati (paket tidak berlaku untuk jenis/lembaga tagihan itu)` : ''}.`);
      } else if (aksi === 'buat') {
        const ta = genTAtopbar;
        if (ta === null) { setGalatBuat('Pilih satu tahun ajaran pada filter di atas.'); return; }
        if (targetBuat.length === 0) {
          setGalatBuat('Tidak ada sel kosong yang terseleksi untuk dibuatkan tagihan.'); return;
        }

        const rencana: { t: TargetBuatKolom; nominal: number }[] = [];
        let galatRencana: string | null = null;
        for (const t of targetBuat) {
          if (t.kolom.tipe === 'bulanan' && (t.kolom.periode ?? '') === '') {
            galatRencana ??= `Kolom ${labelSel(t.kolom)} tidak punya periode bulan yang valid.`;
            continue;
          }
          const teks = (nominalBuat[t.key] ?? '').trim();
          const n = Number(teks);
          if (teks === '' || !Number.isInteger(n) || n < 0) {
            galatRencana ??= `Nominal ${labelSel(t.kolom)} harus bilangan bulat ≥ 0.`;
            continue;
          }
          rencana.push({ t, nominal: n });
        }
        if (galatRencana !== null) { setGalatBuat(galatRencana); return; }
        setGalatBuat(null);

        let dibuat = 0;
        let dilewati = 0;
        let galat: string | null = null;
        for (const { t, nominal } of rencana) {
          try {
            const r = await generateTagihan({
              tahun_ajaran: ta, jenis_id: t.kolom.jenis_id,
              periode: t.kolom.tipe === 'bulanan' ? t.kolom.periode : null,
              periode_sampai: null,
              jatuh_tempo: t.kolom.tipe === 'bulanan'
                ? null : ((jatuhTempoBuat[t.key] ?? '') || null),
              nominal,
              santri: t.santriIds.map((id) => ({ santri_id: id })),
            });
            dibuat += r.dibuat;
            dilewati += r.dilewati;
          } catch (e2) { galat ??= errorMessage(e2); }
        }

        if (galat !== null && dibuat === 0) { setGalatBuat(galat); return; }
        toast.success(`Dibuat ${dibuat} tagihan${dilewati > 0 ? `, dilewati ${dilewati}` : ''}.`);
        if (galat !== null) toast.error(galat);
      }
      setPilih((prev) => new Map([...prev].filter(([key]) => gagal.has(key))));
      if (gagal.size === 0) setBatchDialog(null);
      await load();
      await muatCrosstabSekarang();
    } catch (e) {
      toast.error(errorMessage(e));

    } finally {
      setBatchBusy(false);
    }
  }, [batchDialog, pilihanTerpilih, batchMetode, batchKas, ubahPakaiJatuhTempo, ubahJatuhTempo, ubahDispen, daftarDispenBatch, targetBuat, nominalBuat, jatuhTempoBuat, genTAtopbar, load, muatCrosstabSekarang, setPilih]);

  /** Permintaan aksi per tagihan dari crosstab (klik kanan / Enter): sel yang
   *  diminta + rect sel saat permintaan dibuat (koordinat layar). Crosstab
   *  memetakannya kembali ke elemen sel setelah render selesai — jadi popover
   *  tak pernah menempel pada baris yang salah ketika tabel bergeser. */
  const [aksiSel, setAksiSel] = useState<{
    sel: CrosstabSel; meta: MetaSel; kolom: CrosstabKolom; jangkar: DOMRect;
  } | null>(null);

  /** Penanda "popover per-tagihan baru dipasang". Radix DismissableLayer
   *  menutup popover yang baru dipasang bila mendeteksi event klik/kanan yang
   *  sama sudah lewat (klik kanan dari crosstab) — popover lalu berkedip
   *  buka-tutup. Dismiss pertama sesudah pemasangan itu diabaikan SEKALI;
   *  penutupan berikutnya (Escape, klik di luar) tetap dihormati. */
  const abaikanTutupRef = useRef(false);
  const pilihSel = useCallback((
    sel: CrosstabSel,
    meta: MetaSel,
    anchor: HTMLElement,
    kolom: CrosstabKolom,
  ) => {
    abaikanTutupRef.current = true;
    setPaksaBatch(false);
    setTambahCtx(null);
    setSelTagihan({
      id: sel.id, nama: meta.nama, label: meta.label,
      ayah_nama: meta.ayah_nama, ibu_nama: meta.ibu_nama, santri_id: meta.santri_id,
      foto_dokumen_id: meta.foto_dokumen_id, foto_profil: meta.foto_profil,
      kelas: meta.kelas, jenjang_riwayat: meta.jenjang_riwayat,
      nominal: sel.nominal, sisa: sel.sisa, status: sel.status,
    });
    setSelPenuh(sel);
    setKolomTerpilih(kolom);
    setAnchorSel(anchor);
  }, []);

  /** Klik kanan sel kosong: sel ini dipilih (ganti) bila belum ada di
   *  pilihan, lalu panel batch dibuka — walau tinggal 1 sel (tak ada panel
   *  tunggal untuk sel kosong). */
  const [paksaBatch, setPaksaBatch] = useState(false);
  /** Permintaan panel batch dari sel kosong (diproses effect di bawah). */
  const [aksiKosongReq, setAksiKosongReq] = useState<{ cell: SelBlok; anchor: HTMLElement } | null>(null);
  const mintaAksiKosong = useCallback((cell: SelBlok, _kolom: CrosstabKolom, anchor: HTMLElement) => {
    setAksiKosongReq({ cell, anchor });
  }, []);
  /** Buka panel batch untuk sel kosong LEWAT effect (persis jalur terisi via
   *  `aksiSel`): panel dibuka di luar dispatch klik-kanan, setelah React
   *  merender seleksi. Sel diambil ulang dari DOM karena render seleksi bisa
   *  mengganti elemen tangkapan event. */
  useEffect(() => {
    if (aksiKosongReq === null) return;
    const { cell, anchor } = aksiKosongReq;
    const kunci = kunciSel(cell);
    if (!pilihanTerpilih.has(kunci)) {
      setPilih(() => new Map<string, { santriId: number; key: string; jenisId: number; sel?: CrosstabSel }>([
        [kunci, { santriId: cell.santriId, key: cell.key, jenisId: cell.jenisId }],
      ]));
    }

    abaikanTutupRef.current = true;
    const segar = document.getElementById(`td_tagihan_kosong_${cell.santriId}_${cell.key}`);
    setAnchorSel(segar ?? anchor);
    setPaksaBatch(true);
    setAksiKosongReq(null);
  }, [aksiKosongReq, pilihanTerpilih, setPilih]);
  /** Klik kanan / Enter pada sel → serahkan permintaan ke crosstab. Rect sel
   *  dipakai mencari elemen yang sama setelah render (tabel bisa bergeser). */
  const mintaAksiSel = useCallback((
    sel: CrosstabSel, meta: MetaSel, kolom: CrosstabKolom, kotak: DOMRect,
  ) => {
    setAksiSel({ sel, meta, kolom, jangkar: kotak });
  }, []);

  const tutupPopover = useCallback(() => {

    if (abaikanTutupRef.current) { abaikanTutupRef.current = false; return; }
    setAksiSel(null);
    setAnchorSel(null);
    setSelTagihan(null);
    setSelPenuh(null);
    setKolomTerpilih(null);
    setTambahCtx(null);
    setPaksaBatch(false);
  }, []);

  /** Konteks tambah dari sel kosong (santri + kolom): popover dibuka dalam
   *  mode tambah. null = popover (bila terbuka) dalam mode aksi biasa. */
  const [tambahCtx, setTambahCtx] = useState<{
    baris: CrosstabBaris; kolom: CrosstabKolom; anchor: HTMLElement; nominalAwal: number | null;
  } | null>(null);
  /** Klik sel kosong (·) → buka popover tambah untuk santri × kolom itu. */
  const tambahDariSel = useCallback((baris: CrosstabBaris, kolom: CrosstabKolom, anchor: HTMLElement) => {
    const cocok = tarif.find((t) => t.jenis_id === kolom.jenis_id
      && (genTAtopbar == null || t.tahun_ajaran === genTAtopbar));
    setSelTagihan(null);
    setSelPenuh(null);
    setKolomTerpilih(null);
    setTambahCtx({ baris, kolom, anchor, nominalAwal: cocok?.nominal ?? null });
    setAnchorSel(anchor);
  }, [tarif, genTAtopbar]);

  /** Simpan dari popover tambah: buat satuan → muat ulang → buka popover
   *  aksi pada sel yang baru dibuat (lanjut bayar bila perlu). */
  const simpanTambah = useCallback(async (d: { nominal: number; jatuh_tempo: string | null }) => {
    if (!tambahCtx) return;
    const { baris, kolom } = tambahCtx;
    const ta = genTAtopbar;
    if (!ta) {
      toast.error('Pilih satu tahun ajaran pada filter di atas.');
      return;
    }
    try {
      const dibuat = await buatTagihan({
        santri_id: baris.santri_id,
        jenjang: baris.jenjang,
        tahun_ajaran: ta,
        jenis_id: kolom.jenis_id,
        periode: kolom.tipe === 'bulanan' ? (kolom.periode ?? null) : null,
        nominal: d.nominal,
        jatuh_tempo: d.jatuh_tempo,
      });
      toast.success('Tagihan dibuat.');
      tutupPopover();
      await muatCrosstabSekarang();

      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const tombol = document.querySelector<HTMLElement>(`#btn_tagihan_sel_${dibuat.id}`);
      if (!tombol) return;
      const hariIni = hariIniIso();

      const jt = dibuat.jatuh_tempo?.slice(0, 10) ?? null;
      pilihSel(
        {
          id: dibuat.id, nominal: dibuat.nominal, terbayar: dibuat.terbayar,
          sisa: Math.max(dibuat.nominal - dibuat.terbayar, 0), status: dibuat.status,
          jatuh_tempo: jt, terlambat: dibuat.status !== 'lunas' && !!jt && jt < hariIni,
          tahun_ajaran: dibuat.tahun_ajaran, jenjang: dibuat.jenjang,
        },
        {
          nama: baris.nama, label: labelSel(kolom),
          ayah_nama: baris.ayah_nama, ibu_nama: baris.ibu_nama, santri_id: baris.santri_id,
          foto_dokumen_id: baris.foto_dokumen_id, foto_profil: baris.foto_profil,
          kelas: baris.kelas, jenjang_riwayat: baris.jenjang_riwayat,
        },
        tombol,
        kolom,
      );
    } catch (e) {
      toast.error(errorMessage(e));

      throw e;
    }
  }, [tambahCtx, genTAtopbar, muatCrosstabSekarang, pilihSel]);

  /** Konteks tambah untuk popover (di-memo: identitas stabil agar form
   *  tambah tak di-reset tiap render halaman — alasan sama `popoverTagihan`). */
  const tambahPop: TambahCtx | null = useMemo(
    () => (tambahCtx ? {
      nama: tambahCtx.baris.nama,
      label: labelSel(tambahCtx.kolom),
      santri_id: tambahCtx.baris.santri_id,
      jenjang: tambahCtx.baris.jenjang,
      ayah_nama: tambahCtx.baris.ayah_nama,
      ibu_nama: tambahCtx.baris.ibu_nama,
      jenis_id: tambahCtx.kolom.jenis_id,
      periode: tambahCtx.kolom.periode,
      tipe: tambahCtx.kolom.tipe,
      tahunAjaran: genTAtopbar,
      nominalAwal: tambahCtx.nominalAwal,
    } : null),
    [tambahCtx, genTAtopbar],
  );

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
  const hapusJenisBaris = useCallback((r: JenisTagihan) => {
    void (async () => {
      try {
        await hapusJenis(r.id);
        toast.success('Jenis dihapus.');
        await load();
      } catch (e2) { toast.error(errorMessage(e2)); }
    })();
  }, [load]);

  /** Simpan satu baris tarif hasil edit sel (auto-save mode Edit): nominal &
   *  status aktif; field lain memakai nilai baris (endpoint minta keduanya). */
  const commitTarif = useCallback(async (id: number, f: Record<string, string | null>) => {
    const baris = tarif.find((t) => t.id === id);
    if (!baris) return;
    const { nominal, is_active } = payloadUbahTarif(baris, f);
    await ubahTarif(id, nominal, is_active);
  }, [tarif]);

  /** Antrean auto-save mode Edit selesai → muat ulang tabel tarif sekali. */
  const muatUlangTarif = useCallback(async () => {
    await loadTarif(jenjangs, tahunAjaranNames);
  }, [loadTarif, jenjangs, tahunAjaranNames]);

  /** Mode Input: buat tarif baru dari baris input. Lembaga + tahun ajaran
   *  diambil dari filter (harus tunggal agar baris baru tetap terlihat di
   *  tabel); jenis & nominal diisi di baris input. */
  const createTarifRow = useCallback(async (f: Record<string, string | null>) => {
    if (jenjangInputTarif === null || genTAtopbar === null) {
      throw new Error('Pilih satu lembaga & satu tahun ajaran di filter dulu untuk mode Input.');
    }
    const { jenis_id, nominal } = payloadBuatTarif(f);

    pastikanTarifBaru(tarif, { jenjang: jenjangInputTarif, tahun_ajaran: genTAtopbar, jenis_id });
    await buatTarif({ jenjang: jenjangInputTarif, tahun_ajaran: genTAtopbar, jenis_id, nominal });
    toast.success('Tarif dibuat.');
    await loadTarif(jenjangs, tahunAjaranNames);
  }, [jenjangInputTarif, genTAtopbar, tarif, loadTarif, jenjangs, tahunAjaranNames]);

  /** Simpan satu baris jenis tagihan hasil edit sel (mode Edit): nama, tipe,
   *  status; lingkup lembaga tidak ikut — pindah lingkup lewat dialog Ubah. */
  const commitJenis = useCallback(async (id: number, f: Record<string, string | null>) => {
    const baris = jenis.find((j) => j.id === id);
    if (!baris) return;
    await ubahJenis(id, payloadUbahJenis(baris, f));
  }, [jenis]);

  /** Mode Input tabel Jenis: buat jenis baru dari baris input. Lingkup lembaga
   *  dipilih di baris input; jenis global hanya untuk super_admin (server
   *  menolak bila bukan — pesannya tampil sebagai toast baris input). */
  const createJenisRow = useCallback(async (f: Record<string, string | null>) => {
    await buatJenis(payloadBuatJenis(f));
    toast.success('Jenis dibuat.');
    await load();
  }, [load]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <TopBarSearch
        value={cariTagihan}
        onChange={setCariTagihan}
        placeholder="Cari santri / tagihan…"
      />
      <PengaturanHalaman
        tampil={{ lembaga: true, tahun_ajaran: true, tingkat: true, kelas: true }}
        tabel={[
          { key: 'keuangan_jenis', judul: 'Jenis Tagihan', fields: FIELDS_JENIS },
          { key: 'keuangan_tarif', judul: 'Tarif', fields: FIELDS_TARIF },
          { key: 'keuangan_tagihan_crosstab', judul: 'Tagihan' },
        ]}
      />
      <Tabs value={tab} onValueChange={(v) => { setTab(v); prefSet('simpes_keuangan_tab', v).catch(() => {}); }} className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList className={KELAS_LIST_TAB} indikator="primer">
          <TabsTrigger value="jenis" id="keu_tab_jenis" className={KELAS_TRIGGER}>Jenis Tagihan</TabsTrigger>
          <TabsTrigger value="tarif" id="keu_tab_tarif" className={KELAS_TRIGGER}>Tarif</TabsTrigger>
          <TabsTrigger value="tagihan" id="keu_tab_tagihan" className={KELAS_TRIGGER}>Tagihan</TabsTrigger>
          <TabsTrigger value="custom" id="keu_tab_custom" className={KELAS_TRIGGER}>Santri Custom</TabsTrigger>
        </TabsList>

        <TabsContent value="jenis" className={`min-h-0 flex-1 flex flex-col gap-1 ${KELAS_PANEL_TAB}`}>
          <JenisTab
            rows={jenis}
            loading={loadingJenis}
            sort={uJenis}
            efektifSuper={efektifSuper}
            pilihanLembaga={pilihanLembaga}
            canEdit={canUbahKeuangan}
            onCommit={commitJenis}
            onSaved={load}
            onCreateRow={canTambahKeuangan ? createJenisRow : undefined}
            onTambah={bukaTambahJenis}
            onEdit={setEditJenis}
            onHapus={hapusJenisBaris}

            aktif={tab === 'jenis'}
          />
        </TabsContent>

        <TabsContent value="tarif" className={`min-h-0 flex-1 flex flex-col gap-1 ${KELAS_PANEL_TAB}`}>
          <TarifTab
            rows={tarif}
            loading={loadingTarif}
            sort={uTarif}
            jenis={jenis}
            jenjangFilter={jenjangInputTarif}
            jenisTerpakai={jenisTerpakaiTarif}
            canEdit={canUbahKeuangan}
            onCommit={commitTarif}
            onSaved={muatUlangTarif}
            onCreateRow={canTambahKeuangan ? createTarifRow : undefined}
            inputRowValues={{ jenjang: jenjangInputTarif ?? '', tahun_ajaran: genTAtopbar ?? '' }}
            onTambah={bukaTambahTarif}
            onEdit={setEditTarif}
            onHapus={hapusTarifBaris}
            aktif={tab === 'tarif'}
          />
        </TabsContent>

        <TabsContent value="tagihan" className={`min-h-0 flex-1 flex flex-col gap-1 bg-muted/30 p-0 ${KELAS_PANEL_TAB}`}>
          <TagihanTab
            crosstab={crosstab}
            loading={loadingTagihan}
            terpilihId={selTagihan?.id ?? null}
            total={tagihanTotal}
            cari={cariTagihan}
            onCari={setCariTagihan}
            sort={uTagihan}
            terlambat={terlambatTagihan}
            onTerlambat={(v) => { setTerlambatTagihan(v); setTagihanPage(1); }}
            keaktifan={keaktifanTagihan}
            onKeaktifan={(v) => { setKeaktifanTagihan(v); setTagihanPage(1); }}
            onPilih={pilihSel}
            aksiSel={aksiSel}
            onAksiSel={mintaAksiSel}
            onAksiKosong={mintaAksiKosong}
            onTambah={tambahDariSel}
            selection={selectionSet}
            onTogglePilih={togglePilih}
            onPilihBlok={pilihBlok}
            onKlikSel={pilihAnchorSatu}
            onPilihIrisan={pilihIrisan}
            onMulaiGeser={mulaiGeser}
            onGeserSelesai={geserSelesai}
            onTambahBlok={tambahBlok}
            onLepasBlok={lepasBlok}
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
                tambah={tambahPop}
                anchor={anchorSel}
                riwayat={riwayatRows}
                riwayatBusy={riwayatBusy}
                riwayatError={riwayatError}
                onTutup={tutupPopover}
                jumlahTerpilih={pilihanTerpilih.size}
                jumlahTagihan={jmlTagihanTerpilih}
                paksaBatch={paksaBatch}
                totalSisaTerpilih={totalSisaTerpilih}
                onAksiBatch={bukaBatch}
                batchBusy={batchBusy}
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
                onTambah={simpanTambah}
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
          <BatchAksiTagihan
            aksi={batchDialog}
            jumlah={pilihanTerpilih.size}
            totalSisa={totalSisaTerpilih}
            busy={batchBusy}
            metode={batchMetode}
            kas={batchKas}
            onMetode={setBatchMetode}
            onKas={setBatchKas}
            pakaiJatuhTempo={ubahPakaiJatuhTempo}
            jatuhTempo={ubahJatuhTempo}
            onPakaiJatuhTempo={setUbahPakaiJatuhTempo}
            onJatuhTempo={setUbahJatuhTempo}
            dispen={ubahDispen}
            onDispen={setUbahDispen}
            daftarDispen={daftarDispenBatch}
            targetBuat={targetBuat}
            nonaktifDilewati={nonaktifBuat}
            nominalBuat={nominalBuat}
            onNominalBuat={(key, v) => setNominalBuat((prev) => ({ ...prev, [key]: v }))}
            jatuhTempoBuat={jatuhTempoBuat}
            onJatuhTempoBuat={(key, v) => setJatuhTempoBuat((prev) => ({ ...prev, [key]: v }))}
            galatBuat={galatBuat}
            onBatal={() => setBatchDialog(null)}
            onKonfirmasi={jalankanBatch}
          />
        </TabsContent>

        <TabsContent value="custom" className={`min-h-0 flex-1 flex flex-col gap-1 ${KELAS_PANEL_TAB}`}>
          <SantriCustomTab
            canEdit={canUbahKeuangan} canTambah={canTambahKeuangan}
            jenjangs={jenjangs} tahunAjaranNames={tahunAjaranNames} semesters={semesters}
            tingkat={tingkat} kelas={kelasAktif}
          />
        </TabsContent>

      </Tabs>

      <GenerateTagihanDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        jenis={jenis}
        tarif={tarif}
        tahunAjaran={genTAtopbar}
        jenjangs={jenjangPilihan}
        onTarifBaru={async () => { await muatUlangTarif(); }}
        onSelesai={async () => {
          await load();
          setTagihanPage(1);
          await loadCrosstab(1, tagihanPerPage, jenjangs, tahunAjaranNames);
        }}
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
