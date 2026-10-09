import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage, prefGet, prefSet } from '../api/client';
import { tokenUrut, type PetaArahKolom } from '@/lib/urut';
import {
  daftarJenis, daftarTarif, hapusTarif, buatJenis, ubahJenis, buatTarif, buatTagihan, ubahTarif,
  crosstabTagihan, hapusTagihan, ubahTagihan, catatPembayaran,
  riwayatPembayaran, hapusPembayaran,
  type JenisTagihan, type Tarif, type PembayaranRow,
  type CrosstabBaris, type CrosstabTagihan, type CrosstabSel, type CrosstabKolom,
} from '../api/keuangan';
import { labelSel } from '@/components/keuangan/TagihanCrosstab';
import { listKelas, listLembaga, listTahunAjaran, type Kelas, type Lembaga, type TahunAjaran } from '../api/master';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KELAS_LIST_TAB, KELAS_PANEL_TAB, KELAS_TRIGGER } from '@/components/HalamanTabs';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
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
import {
  DialogTambahJenis, DialogTambahTarif, DialogUbahJenis, DialogUbahTarif,
} from '@/components/keuangan/jenisTarifDialogs';

const TAB_KEUANGAN = ['jenis', 'tarif', 'tagihan'] as const;

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
  const { jenjangs, tahunAjaranNames, tingkat, kelas: kelasAktif, loading: filterLoading } = useFilterGlobalAktif();
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

  /** Crosstab tagihan: baris = santri, kolom = jenis (bulanan per bulan). */
  const [crosstab, setCrosstab] = useState<CrosstabTagihan | null>(null);
  const [cariTagihan, setCariTagihan] = useState('');
  /** Pencarian yang benar-benar dipakai saat muat: ditunda 400 ms supaya tak
   *  memanggil API tiap ketikan (pola sama dengan `useDaftarTabel`). */
  const [cariTagihanTertunda, setCariTagihanTertunda] = useState('');
  const [urutTagihan, setUrutTagihan] = useState('');
  const [arahTagihan, setArahTagihan] = useState<'naik' | 'turun'>('naik');
  /** Tab Tagihan: hanya sel yang sudah lewat jatuh tempo. */
  const [terlambatTagihan, setTerlambatTagihan] = useState(false);

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
    /* Tanpa penjaga ini, mengetik cepat membuat balasan yang lebih LAMA
       tiba belakangan dan menimpa data kueri yang lebih baru — tabel menampilkan
       hasil ketikan lama sementara kotak pencarian sudah berisi teks baru
       (terbukti Playwright: ketik "a" lalu "zzz" → tetap 543 baris, bukan
       tabel kosong). Pola req + AbortController + debounce mengikuti
       `useDaftarTabel`. */
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
        /* `''` = opsi "nama": tetap kirim eksplisit agar arah naik/turun
           dihormati backend. Sebelumnya keduanya di-undefined-kan sehingga
           tombol ASC/DESC tak berpengaruh (dan urutannya id, bukan nama). */
        sort: [urutTagihan === '' ? 'nama' : urutTagihan],
        arah: arahTagihan,
        terlambat: terlambatTagihan || undefined,
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
  }, [cariTagihanTertunda, urutTagihan, arahTagihan, terlambatTagihan, tingkat, kelasFilterIds]);

  // Ketikan pencarian → tunggu 400 ms baru jadi nilai muat.
  useEffect(() => {
    const bersih = cariTagihan.trim();
    const t = setTimeout(() => setCariTagihanTertunda(bersih), bersih === '' ? 0 : 400);
    return () => clearTimeout(t);
  }, [cariTagihan]);

  // Filter global/pencarian/urut berubah → muat dari halaman 1.
  useEffect(() => {
    if (filterLoading || jenjangs.length === 0) { if (!filterLoading && jenjangs.length === 0) setCrosstab(null); return; }
    void loadCrosstab(1, tagihanPerPage, jenjangs, tahunAjaranNames);
  }, [filterLoading, jenjangs, tahunAjaranNames, tagihanPerPage, cariTagihanTertunda, urutTagihan, arahTagihan, terlambatTagihan, loadCrosstab]);

  // Batalkan request yang masih jalan saat halaman dilepas.
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

  // Form sederhana
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
  /** Sel asal popover aksi (jangkar). null = popover tertutup. */
  const [anchorSel, setAnchorSel] = useState<HTMLElement | null>(null);
  /** Tagihan terpilih dari sel crosstab (isi popover aksi). */
  const [selTagihan, setSelTagihan] = useState<{
    id: number; nama: string; label: string;
    ayah_nama: string | null; ibu_nama: string | null;
    santri_id: number; nominal: number; sisa: number;
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

  /* Menandai "gesture ini sedang memilih sel baru". Radix DismissableLayer
     menutup popover di pointerdown pertama, lalu memilih sel baru di
     pointerdown yang sama; tanpa penanda ini, pindah sel akan menutup popover
     sepenuhnya (tak ada sel terpilih) dan pengguna harus klik dua kali. Direset di task berikutnya supaya tak hinggap bila tak ada
     dismiss yang menyusul (mis. popover sedang tertutup). */
  const pindahSelRef = useRef(false);
  const pilihSel = useCallback((
    sel: CrosstabSel,
    meta: { nama: string; label: string; ayah_nama: string | null; ibu_nama: string | null; santri_id: number },
    anchor: HTMLElement,
    kolom: CrosstabKolom,
  ) => {
    pindahSelRef.current = true;
    setTimeout(() => { pindahSelRef.current = false; }, 0);
    setTambahCtx(null);
    setSelTagihan({
      id: sel.id, nama: meta.nama, label: meta.label,
      ayah_nama: meta.ayah_nama, ibu_nama: meta.ibu_nama, santri_id: meta.santri_id,
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
    setTambahCtx(null);
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
      // Tunggu cat/React selesai agar tombol sel baru sudah ada di DOM.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const tombol = document.querySelector<HTMLElement>(`#btn_tagihan_sel_${dibuat.id}`);
      if (!tombol) return;
      const hariIni = new Date().toLocaleDateString('sv-SE');
      // Respons create membawa datetime penuh; crosstab memakai tanggal saja.
      const jt = dibuat.jatuh_tempo?.slice(0, 10) ?? null;
      pilihSel(
        {
          id: dibuat.id, nominal: dibuat.nominal, terbayar: dibuat.terbayar,
          sisa: Math.max(dibuat.nominal - dibuat.terbayar, 0), status: dibuat.status,
          jatuh_tempo: jt, terlambat: dibuat.status !== 'lunas' && !!jt && jt < hariIni,
          tahun_ajaran: dibuat.tahun_ajaran,
        },
        {
          nama: baris.nama, label: labelSel(kolom),
          ayah_nama: baris.ayah_nama, ibu_nama: baris.ibu_nama, santri_id: baris.santri_id,
        },
        tombol,
        kolom,
      );
    } catch (e) {
      toast.error(errorMessage(e));
      // Dilempar agar popover tetap terbuka untuk koreksi (pola onUbah).
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
    // Bentrok dicek dari baris yang sudah dimuat (lingkup filter = lingkup
    // baris ini). Tanpa ini pasangan lembaga+TA+jenis yang sama bisa tersimpan
    // dua kali: index `uq_tarif_tagihan` memuat `tingkat`, dan MySQL/SQLite
    // menganggap NULL berbeda sehingga baris tanpa tingkat tidak tertahan.
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
    const { nama, tipe, jenjang } = payloadBuatJenis(f);
    await buatJenis(nama, tipe, jenjang);
    toast.success('Jenis dibuat.');
    await load();
  }, [load]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <PengaturanHalaman
        tampil={{ lembaga: true, tahun_ajaran: true, tingkat: true, kelas: true }}
        tabel={[
          { key: 'keuangan_jenis', judul: 'Jenis Tagihan', fields: FIELDS_JENIS },
          { key: 'keuangan_tarif', judul: 'Tarif', fields: FIELDS_TARIF },
        ]}
      />
      <Tabs value={tab} onValueChange={(v) => { setTab(v); prefSet('simpes_keuangan_tab', v).catch(() => {}); }} className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList className={KELAS_LIST_TAB}>
          <TabsTrigger value="jenis" id="keu_tab_jenis" className={KELAS_TRIGGER}>Jenis Tagihan</TabsTrigger>
          <TabsTrigger value="tarif" id="keu_tab_tarif" className={KELAS_TRIGGER}>Tarif</TabsTrigger>
          <TabsTrigger value="tagihan" id="keu_tab_tagihan" className={KELAS_TRIGGER}>Tagihan</TabsTrigger>
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
            onTambah={tambahDariSel}
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
                tambah={tambahPop}
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
