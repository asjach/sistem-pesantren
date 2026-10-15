import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage, prefGet, prefSet } from '../api/client';
import { tokenUrut, type PetaArahKolom } from '@/lib/urut';
import {
  daftarDispensasi, daftarJenis, hapusDispensasi, kuotaPakai, rekapDispensasi, ubahDispensasi,
  type Dispensasi, type DispensasiInput, type JenisTagihan, type RekapDispensasi,
} from '../api/keuangan';
import { listKelas, listTahunAjaran, type Kelas, type TahunAjaran } from '../api/master';
import { listSantri, type Santri } from '../api/santri';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { KELAS_LIST_TAB, KELAS_PANEL_TAB, KELAS_TRIGGER } from '@/components/HalamanTabs';
import { TopBarSearch } from '@/components/TopBarSearch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import Pager from '@/components/Pager';
import { ActionIcon } from '@/components/RowActions';
import { Button } from '@/components/ui/button';
import { ArrowRight } from '@/icons';
import DispensasiDialog from '@/components/keuangan/DispensasiDialog';
import {
  barisPenerima, DispensasiTab, FIELDS_DISPENSASI, FIELDS_PENERIMA, FIELDS_REKAP_DISPENSASI,
  KartuDispensasiTerpilih, PenerimaDispensasiPanel, RekapDispensasiTab, type BarisPenerima,
} from '@/components/keuangan/tabKeuangan';
import { jenjangTampil, nisTampil } from '@/components/keuangan/tabSantriCustom';
import { targetTunggal, useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { useLembagaAktif } from '@/lembagaAktif';
import { paketRekapEfektif, saringPenerima } from '@/lib/dispensasi';
import { bacaPerPageGlobal, tulisPerPageGlobal } from '@/hooks/usePager';
import type { PerPage } from '@/prefs';

/** Nilai tab halaman (urut tampil); pref perangkat menyimpannya sebagai teks,
 *  jadi nilai lama yang tak dikenal diabaikan saat memulihkan. */
const TAB_DISPENSASI = ['kelola', 'rekap'] as const;
/** Kunci pref tab terakhir halaman (pola sama dengan `simpes_keuangan_tab`). */
const KUNCI_TAB = 'simpes_dispensasi_tab';

/** Kolom daftar santri — sama dengan tabel kandidat di tab Santri Custom,
 *  plus **Kelas** (nama rombel TA acuan; diisi endpoint daftar santri). */
const FIELDS_SANTRI: ExcelField[] = [
  { key: 'nama_lengkap', label: 'Nama Lengkap', kind: 'static', width: 200 },
  { key: 'nis', label: 'NIS', kind: 'static', width: 110 },
  { key: 'jk', label: 'JK', kind: 'static', width: 60 },
  { key: 'kelas', label: 'Kelas', kind: 'static', width: 100 },
  { key: 'jenjang', label: 'Jenjang', kind: 'static', width: 90 },
];

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

/** Payload PUT dari satu baris dispensasi + daftar santri pengganti. Endpoint
 *  Ubah mengganti SELURUH isi paket (termasuk aturan), jadi identitas & aturan
 *  baris ikut dikirim apa adanya — hanya `santri_ids` yang diubah. */
function payloadDari(d: Dispensasi, santriIds: number[]): DispensasiInput {
  return {
    nama: d.nama,
    keterangan: d.keterangan,
    tahun_ajaran: d.tahun_ajaran,
    kuota_bulan: d.kuota_bulan,
    grup: d.grup,
    aturan: (d.aturan ?? []).map((a) => ({ jenis_id: a.jenis_id, tipe: a.tipe, nilai: a.nilai })),
    santri_ids: santriIds.length > 0 ? santriIds : null,
    is_active: d.is_active,
  };
}

/**
 * Halaman Dispensasi — dua tab: **Kelola Dispensasi** (area kerja, tata letak
 * dua kolom mengikuti tab Santri Custom) dan **Rekap Dispensasi** (laporan
 * dampak per lembaga).
 *
 * Tab Kelola — kiri: baris 1 tabel **Daftar Dispensasi** (barisnya bisa
 * dipilih), baris 2 tabel **Daftar Santri** (lingkup filter topBar + rail;
 * santri yang sudah menjadi penerima paket terpilih disembunyikan) dengan aksi
 * `→` untuk memasukkannya. Kanan: **kartu informasi** paket terpilih (nama,
 * status, TA, kuota, grup, keterangan, aturan) lalu **Daftar Penerima** paket
 * itu dengan aksi mengeluarkan. Lebar panel kiri & tinggi bagian atasnya bisa
 * digeser.
 *
 * Tab Rekap — **Rekap Dampak per Lembaga**: angka dari baris tagihan (jumlah
 * tagihan, penerima, total potongan, jumlah paket) dengan pemilih paket;
 * bawaannya mengikuti paket yang dipilih di tab Kelola sehingga sebaran satu
 * paket ke tiap lembaga bisa ditelusuri langsung (pilih paket di sana, buka
 * tab ini). Kartu pengaturan halaman & filter topBar tetap di luar tab supaya
 * lingkup filter sama untuk kedua laporan.
 *
 * Catatan lingkup: daftar DISPENSASI sengaja tak disaring filter topBar —
 * paket tidak terikat tahun ajaran (kolom `tahun_ajaran` hanya label arsip),
 * jadi penyaringan itu tak akan mengubah apa pun. Filter topBar (jenjang +
 * tahun ajaran) & rail (tingkat + kelas) dipakai oleh daftar SANTRI, seperti
 * di tab Santri Custom. Pencarian topBar juga hanya berlaku untuk DUA tabel
 * santri — **Daftar Santri** (lewat server `q`) dan **Daftar Penerima**
 * (disaring di klien) — bukan daftar dispensasi, supaya mencari nama santri
 * tak mengosongkan daftar paket yang jadi sumber pilihan.
 */
export default function DispensasiPage() {
  const { user } = useAuth();
  /** Gerbang izin `keuangan.ubah`: aksi memasukkan/mengeluarkan penerima. */
  const bolehUbah = bisa(user, 'keuangan.ubah');

  const [dispensasi, setDispensasi] = useState<Dispensasi[]>([]);
  const [jenis, setJenis] = useState<JenisTagihan[]>([]);
  const [daftarTA, setDaftarTA] = useState<TahunAjaran[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const uDispensasi = useUrutTabel();
  const uRekap = useUrutTabel();
  const { jenjangs, tahunAjaranNames, semesters, tingkat, kelas: kelasAktif } = useFilterGlobalAktif();
  /** Lingkup jenjang yang boleh dipakai di dialog dispensasi (peran pengguna). */
  const { pilihan: pilihanLembaga } = useLembagaAktif();

  /** Tab aktif (Kelola / Rekap); dipulihkan dari pref perangkat. */
  const [tab, setTab] = useState<string>('kelola');

  const [dispensasiOpen, setDispensasiOpen] = useState(false);
  const [editDispensasi, setEditDispensasi] = useState<Dispensasi | null>(null);
  /** Paket terpilih — isi panel kanan mengikutinya. */
  const [aktifId, setAktifId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  /** Pencarian topBar: menyaring DUA tabel santri — Daftar Santri (nama/NIS,
   *  lewat server) dan Daftar Penerima (nama/NIS, di klien). Tabel Daftar
   *  Dispensasi sengaja tak ikut disaring. */
  const [cari, setCari] = useState('');

  /** Lebar panel kiri (px); gagang di tengah bisa menggesernya. */
  const [lebarKiri, setLebarKiri] = useState(500);
  const geserRef = useRef<{ x: number; w: number } | null>(null);
  /** Tinggi bagian atas kiri (tabel dispensasi, px). */
  const [tinggiAtas, setTinggiAtas] = useState(320);
  const atasRef = useRef<HTMLDivElement | null>(null);
  const geserVertikalRef = useRef<{ y: number; h: number } | null>(null);

  /** Opsi kelas lingkup topBar (rail bicara nama, endpoint minta id). */
  const [kelasOpsi, setKelasOpsi] = useState<Kelas[]>([]);
  const [kandidat, setKandidat] = useState<Santri[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState<PerPage>(10);
  const [loadingKandidat, setLoadingKandidat] = useState(false);
  /** Bulan terpakai per penerima paket terpilih (hanya paket berkuota) —
   *  dasar kolom "Sisa Kuota" di panel kanan. */
  const [kuotaTerpakai, setKuotaTerpakai] = useState<Record<number, number>>({});
  /** Baris rekap dampak per lembaga (lingkup filter topBar). */
  const [rekap, setRekap] = useState<RekapDispensasi[]>([]);
  const [loadingRekap, setLoadingRekap] = useState(false);
  /** Paket yang disaring di rekap: `undefined` = ikut paket terpilih,
   *  `null` = semua paket (pilihan eksplisit), number = paket itu. */
  const [paketRekap, setPaketRekap] = useState<number | null | undefined>(undefined);

  /** Pulihkan tab terakhir yang dibuka (pref perangkat); nilai tak dikenal
   *  (mis. tab yang sudah dihapus) diabaikan sehingga jatuh ke tab pertama. */
  useEffect(() => {
    let hidup = true;
    prefGet(KUNCI_TAB).then((v) => {
      if (hidup && v !== null && (TAB_DISPENSASI as readonly string[]).includes(v)) setTab(v);
    }).catch(() => {});
    return () => { hidup = false; };
  }, []);

  const aktif = useMemo(() => dispensasi.find((d) => d.id === aktifId) ?? null, [dispensasi, aktifId]);
  /** Paket efektif rekap: bawaan mengikuti baris yang dipilih di tabel kiri. */
  const paketRekapTerpilih = paketRekapEfektif(paketRekap, aktifId);
  /** Ringkasan rekap dari baris yang tampil (bukan query terpisah). */
  const ringkasRekap = useMemo(
    () => rekap.reduce(
      (a, r) => ({ tagihan: a.tagihan + r.jumlah_tagihan, potongan: a.potongan + r.total_potongan }),
      { tagihan: 0, potongan: 0 },
    ),
    [rekap],
  );
  /** Opsi pemilih paket rekap: "Semua paket" + daftar dispensasi halaman. */
  const opsiPaketRekap = useMemo(
    () => [
      { nilai: null, label: 'Semua paket' },
      ...dispensasi.map((d) => ({ nilai: d.id as number | null, label: d.nama })),
    ],
    [dispensasi],
  );
  /** Baris penerima paket terpilih (satu baris per santri). */
  const penerima = useMemo(() => (aktif === null ? [] : barisPenerima([aktif])), [aktif]);
  /** Id santri yang SUDAH penerima paket terpilih (disembunyikan di daftar). */
  const idPenerima = useMemo(() => new Set(aktif?.santri_ids ?? []), [aktif]);
  const kandidatTampil = useMemo(
    () => kandidat.filter((s) => !idPenerima.has(s.id)),
    [kandidat, idPenerima],
  );
  /** Daftar penerima tersaring pencarian (nama/NIS) — server hanya menyaring
   *  kandidat, sedangkan panel kanan memuat seluruh penerima paket terpilih. */
  const penerimaTampil = useMemo(() => saringPenerima(penerima, cari), [penerima, cari]);
  /** Ada pencarian aktif? Dipakai pesan kosong tiap tabel. */
  const adaCari = cari.trim() !== '';
  /** Nama kelas rail → id (endpoint santri minta id). */
  const kelasIds = useMemo(
    () => kelasOpsi.filter((k) => kelasAktif.includes(k.nama_kelas)).map((k) => k.id),
    [kelasOpsi, kelasAktif],
  );

  const load = useCallback(async () => {
    setErr('');
    setLoading(true);
    try {
      const [dispen, j, tas] = await Promise.all([
        daftarDispensasi({
          sort: uDispensasi.urut.length ? tokenUrut(uDispensasi.urut, uDispensasi.arahKolom) : undefined,
          arah: uDispensasi.urut.length ? uDispensasi.arah : undefined,
        }),
        daftarJenis({}),
        listTahunAjaran({ per_page: 100 }),
      ]);
      setDispensasi(dispen);
      setJenis(j);
      setDaftarTA(tas.data);
      // Paket terpilih yang tersaring keluar ikut dilepas.
      setAktifId((id) => (id !== null && dispen.some((d) => d.id === id) ? id : null));
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [uDispensasi.urut, uDispensasi.arah, uDispensasi.arahKolom]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => { void bacaPerPageGlobal().then((pp) => setPerPage(pp)); }, []);

  /* Paket berkuota: muat pemakaian bulan per penerima supaya kolom "Sisa
     Kuota" terisi. Tanpa kuota / tanpa penerima → kolomnya disembunyikan. */
  useEffect(() => {
    const ids = aktif?.santri_ids ?? [];
    const kuota = aktif?.kuota_bulan ?? null;
    if (kuota === null || ids.length === 0) { setKuotaTerpakai({}); return; }
    let hidup = true;
    void (async () => {
      try {
        const m = await kuotaPakai(ids);
        if (!hidup) return;
        const per: Record<number, number> = {};
        for (const [sid, pakai] of Object.entries(m)) per[Number(sid)] = pakai[aktif?.id ?? 0] ?? 0;
        setKuotaTerpakai(per);
      } catch { if (hidup) setKuotaTerpakai({}); }
    })();
    return () => { hidup = false; };
  }, [aktif]);

  // Opsi kelas mengikuti lingkup topBar (pemetaan nama rail → id).
  useEffect(() => {
    let hidup = true;
    void (async () => {
      try {
        const res = await listKelas({ jenjang: jenjangs, tahun_ajaran: tahunAjaranNames, per_page: 1000 });
        if (hidup) setKelasOpsi(res.data);
      } catch (e) { if (hidup) setErr(errorMessage(e)); }
    })();
    return () => { hidup = false; };
  }, [jenjangs, tahunAjaranNames]);

  /* Rekap dampak: lingkup topBar (TA + jenjang) + paket yang sedang dipilih
     + urutan tabelnya. Gagal memuat → pesannya masuk ErrorNotice halaman
     (bukan panel kosong yang menyamar "belum ada data"). */
  useEffect(() => {
    let hidup = true;
    setLoadingRekap(true);
    void (async () => {
      try {
        const res = await rekapDispensasi({
          tahun_ajaran: tahunAjaranNames,
          jenjang: jenjangs,
          dispensasi_id: paketRekapTerpilih ?? '',
          sort: uRekap.urut.length ? tokenUrut(uRekap.urut, uRekap.arahKolom) : undefined,
          arah: uRekap.urut.length ? uRekap.arah : undefined,
        });
        if (hidup) setRekap(res.data);
      } catch (e) {
        if (hidup) { setRekap([]); setErr(errorMessage(e)); }
      } finally { if (hidup) setLoadingRekap(false); }
    })();
    return () => { hidup = false; };
  }, [jenjangs, tahunAjaranNames, paketRekapTerpilih, uRekap.urut, uRekap.arah, uRekap.arahKolom]);

  const muatKandidat = useCallback(async (p: number, pp: number, q: string) => {
    setLoadingKandidat(true);
    try {
      const res = await listSantri({
        jenjang: jenjangs,
        tahun_ajaran: tahunAjaranNames,
        semester: semesters,
        tingkat,
        kelas_id: kelasIds,
        q: q === '' ? undefined : q,
        page: p, per_page: pp,
      });
      setKandidat(res.data);
      setPage(res.current_page);
      setLastPage(res.last_page);
      setTotal(res.total);
    } catch (e) { setErr(errorMessage(e)); } finally { setLoadingKandidat(false); }
  }, [jenjangs, tahunAjaranNames, semesters, tingkat, kelasIds]);

  // Lingkup topBar / pencarian berubah → muat ulang dari halaman 1 (tahan 250ms).
  useEffect(() => {
    setPage(1);
    const t = setTimeout(() => { void muatKandidat(1, perPage, cari); }, 250);
    return () => clearTimeout(t);
  }, [cari, perPage, muatKandidat]);

  const bukaTambahDispensasi = useCallback(() => {
    setEditDispensasi(null);
    setDispensasiOpen(true);
  }, []);

  const bukaUbahDispensasi = useCallback((d: Dispensasi) => {
    setEditDispensasi(d);
    setDispensasiOpen(true);
  }, []);

  const hapusDispensasiBaris = useCallback((r: Dispensasi) => {
    void (async () => {
      try {
        await hapusDispensasi(r.id);
        toast.success('Dispensasi dihapus.');
        await load();
      } catch (e2) {
        toast.error(errorMessage(e2));
      }
    })();
  }, [load]);

  /** Masukkan santri ke daftar penerima paket terpilih. */
  const masukkan = useCallback(async (ids: number[]) => {
    if (aktif === null || ids.length === 0) return;
    const baru = [...new Set([...(aktif.santri_ids ?? []), ...ids])];
    setBusy(true);
    try {
      await ubahDispensasi(aktif.id, payloadDari(aktif, baru));
      toast.success(`${ids.length} santri masuk daftar penerima ${aktif.nama}.`);
      await load();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  }, [aktif, load]);

  /** Keluarkan santri dari daftar penerima paket terpilih. */
  const keluarkan = useCallback(async (ids: number[]) => {
    if (aktif === null || ids.length === 0) return;
    const buang = new Set(ids);
    const baru = (aktif.santri_ids ?? []).filter((id) => !buang.has(id));
    setBusy(true);
    try {
      await ubahDispensasi(aktif.id, payloadDari(aktif, baru));
      toast.success(`${ids.length} santri keluar dari daftar penerima ${aktif.nama}.`);
      await load();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  }, [aktif, load]);

  const mulaiGeser = (e: React.PointerEvent) => {
    geserRef.current = { x: e.clientX, w: lebarKiri };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const selamaGeser = (e: React.PointerEvent) => {
    const awal = geserRef.current;
    if (awal === null) return;
    setLebarKiri(Math.min(800, Math.max(320, Math.round(awal.w + (e.clientX - awal.x)))));
  };
  const selesaiGeser = () => { geserRef.current = null; };
  const mulaiGeserVertikal = (e: React.PointerEvent) => {
    const h = atasRef.current?.getBoundingClientRect().height ?? 300;
    geserVertikalRef.current = { y: e.clientY, h };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const selamaGeserVertikal = (e: React.PointerEvent) => {
    const awal = geserVertikalRef.current;
    if (awal === null) return;
    setTinggiAtas(Math.min(900, Math.max(200, Math.round(awal.h + (e.clientY - awal.y)))));
  };
  const selesaiGeserVertikal = () => { geserVertikalRef.current = null; };

  const taBawaan = targetTunggal(tahunAjaranNames) ?? daftarTA.find((x) => x.is_aktif)?.nama ?? '';

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <PengaturanHalaman
        /* Filter halaman ini: **Jenjang (lembaga) + Tahun Ajaran** tampil di
           topBar, **tingkat & kelas** di rail tabel santri (lihat
           `KONFIGURASI_FILTER_HALAMAN.keuangan_dispensasi`). Keempatnya
           dipakai daftar SANTRI; daftar DISPENSASI sendiri tak disaring karena
           paket tak terikat TA. */
        tampil={{ lembaga: true, tahun_ajaran: true, tingkat: true, kelas: true }}
        tabel={[
          { key: 'keuangan_dispensasi', judul: 'Daftar Dispensasi', fields: FIELDS_DISPENSASI },
          { key: 'keuangan_penerima_dispensasi', judul: 'Daftar Penerima Dispensasi', fields: FIELDS_PENERIMA },
          { key: 'keuangan_rekap_dispensasi', judul: 'Rekap Dampak per Lembaga', fields: FIELDS_REKAP_DISPENSASI },
        ]}
      />

      <Tabs
        value={tab}
        onValueChange={(v) => { setTab(v); prefSet(KUNCI_TAB, v).catch(() => {}); }}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <TabsList className={KELAS_LIST_TAB} indikator="primer">
          <TabsTrigger value="kelola" id="disp_tab_kelola" className={KELAS_TRIGGER}>Kelola Dispensasi</TabsTrigger>
          <TabsTrigger value="rekap" id="disp_tab_rekap" className={KELAS_TRIGGER}>Rekap Dispensasi</TabsTrigger>
        </TabsList>

        {/* Panel tab Kelola: dua kolom (daftar + penerima) berikut gagang
            gesernya. Pencarian topBar hidup di dalam panel ini karena
            menyaring dua tabel santri di sini, bukan rekap. */}
        <TabsContent value="kelola" className={`min-h-0 flex-1 flex flex-col gap-1 ${KELAS_PANEL_TAB}`}>
          <div className="flex min-h-0 flex-1">
            <TopBarSearch value={cari} onChange={setCari} placeholder="Cari nama / NIS…" />

            {/* Kiri (bawaan 500px, bisa digeser): tabel dispensasi + daftar santri. */}
            <div style={{ width: lebarKiri }} className="flex min-h-0 shrink-0 flex-col gap-2">
              <div
                ref={atasRef}
                style={{ height: tinggiAtas }}
                className="flex min-h-0 shrink-0 flex-col"
              >
                <DispensasiTab
                  rows={dispensasi}
                  loading={loading}
                  sort={uDispensasi}
                  onTambah={bukaTambahDispensasi}
                  onEdit={bukaUbahDispensasi}
                  onHapus={hapusDispensasiBaris}
                  aktifId={aktifId}
                  onPilih={(d) => setAktifId(d.id)}
                />
              </div>

              {/* Gagang geser tinggi tabel dispensasi vs daftar santri. */}
              <div
                id="gagang_tabel_dispensasi"
                role="separator"
                aria-orientation="horizontal"
                aria-label="Atur tinggi tabel dispensasi dan daftar santri"
                className="h-1.5 shrink-0 cursor-row-resize hover:bg-accent"
                onPointerDown={mulaiGeserVertikal}
                onPointerMove={selamaGeserVertikal}
                onPointerUp={selesaiGeserVertikal}
                onPointerCancel={selesaiGeserVertikal}
              />

              <div className="flex min-h-0 flex-1 flex-col">
                <ExcelTable<Santri>
                  tableKey="dispensasi_kandidat"
                  rail
                  header={(
                    <span id="judul_dispensasi_santri" tabIndex={-1} className="text-sm font-semibold focus:outline-none">
                      Daftar Santri ({total})
                    </span>
                  )}
                  fields={FIELDS_SANTRI}
                  rows={kandidatTampil}
                  getValues={(r) => ({ nama_lengkap: r.nama_lengkap, nis: nisTampil(r), jk: r.jk, kelas: r.kelas ?? null, jenjang: jenjangTampil(r) })}
                  loading={loadingKandidat}
                  emptyText={adaCari
                    ? 'Tidak ada santri yang cocok dengan pencarian.'
                    : aktif === null
                      ? 'Pilih dispensasi dulu di tabel atas, lalu masukkan santri dari daftar ini.'
                      : 'Tidak ada santri (yang belum jadi penerima).'}
                  canEdit={false}
                  onCommit={async () => {}}
                  onSaved={() => {}}
                  aksiLangsung
                  renderActions={!bolehUbah || aktif === null ? () => null : (r) => (
                    <ActionIcon
                      id={`btn_dispensasi_masukkan_${r.id}`}
                      title={`Masukkan ${r.nama_lengkap} ke ${aktif.nama}`}
                      onClick={() => void masukkan([r.id])}
                    >
                      <ArrowRight size={16} />
                    </ActionIcon>
                  )}
                  renderBulkActions={!bolehUbah || aktif === null ? undefined : (checked, clear) => checked.length === 0 ? null : (
                    <Button
                      id="btn_dispensasi_masukkan_banyak"
                      size="sm"
                      disabled={busy}
                      onClick={() => { void masukkan(checked.map((r) => r.id)); clear(); }}
                    >
                      <ArrowRight data-icon="inline-start" size={14} /> Masukkan ({checked.length})
                    </Button>
                  )}
                  pager={(
                    <Pager
                      page={page}
                      lastPage={lastPage}
                      total={total}
                      perPage={perPage}
                      onPage={(p) => void muatKandidat(p, perPage, cari)}
                      onPerPage={(pp) => setPerPage(tulisPerPageGlobal(pp))}
                    />
                  )}
                />
              </div>
            </div>

            {/* Gagang geser antar panel. */}
            <div
              id="gagang_dispensasi"
              role="separator"
              aria-orientation="vertical"
              aria-label="Atur lebar panel kiri"
              className="w-1.5 shrink-0 cursor-col-resize self-stretch hover:bg-accent"
              onPointerDown={mulaiGeser}
              onPointerMove={selamaGeser}
              onPointerUp={selesaiGeser}
              onPointerCancel={selesaiGeser}
            />

            {/* Kanan: kartu informasi paket terpilih + daftar penerimanya. */}
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              {aktif === null ? (
                <p className="grid flex-1 place-items-center text-sm text-muted-foreground">
                  Pilih dispensasi di tabel kiri untuk melihat daftar penerimanya.
                </p>
              ) : (
                <>
                  {/* Kartu info paket terpilih — ditaruh di ATAS tabel penerima
                      supaya daftar santrinya tetap terlihat di bawah. */}
                  <KartuDispensasiTerpilih d={aktif} jumlahPenerima={penerima.length} />
                  <div className="flex min-h-0 flex-1 flex-col">
                    <PenerimaDispensasiPanel
                      rows={penerimaTampil}
                      loading={loading}
                      nama={aktif.nama}
                      kuota={aktif.kuota_bulan}
                      terpakai={kuotaTerpakai}
                      busy={busy}
                      bolehUbah={bolehUbah}
                      emptyText={adaCari ? 'Tidak ada penerima yang cocok dengan pencarian.' : undefined}
                      onKeluarkan={(ids) => void keluarkan(ids)}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab Rekap: laporan dampak per lembaga selebar area konten (bukan
            lagi panel sempit di kolom kanan), jadi semua kolomnya terbaca.
            Angkanya dari baris TAGIHAN, jadi paket berlingkup lembaga lain pun
            ketahuan di sini; pemilih paketnya mewarisi pilihan di tab Kelola. */}
        <TabsContent value="rekap" className={`min-h-0 flex-1 flex flex-col gap-1 ${KELAS_PANEL_TAB}`}>
          <RekapDispensasiTab
            rows={rekap}
            loading={loadingRekap}
            sort={uRekap}
            paket={paketRekapTerpilih}
            opsiPaket={opsiPaketRekap}
            onPaket={setPaketRekap}
            ringkas={ringkasRekap}
          />
        </TabsContent>
      </Tabs>

      <DispensasiDialog
        open={dispensasiOpen}
        onOpenChange={setDispensasiOpen}
        editing={editDispensasi}
        jenis={jenis}
        daftarTA={daftarTA}
        pilihanLembaga={pilihanLembaga}
        taBawaan={taBawaan}
        onSaved={load}
      />
    </div>
  );
}
