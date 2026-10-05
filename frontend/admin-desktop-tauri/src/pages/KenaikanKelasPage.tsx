import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bisa } from '../api/auth';
import { errorMessage } from '../api/client';
import { batalKenaikan, listRiwayatBelajar, naikKelasOtomatis, type RiwayatRow } from '../api/siklus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FilterField from '@/components/FilterField';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { ActionIcon } from '@/components/RowActions';
import { Check, X } from '@/icons';
import { targetTunggal, useFilterGlobalAktif } from '@/hooks/useFilterGlobalAktif';
import { PengaturanHalaman } from '@/components/VisibilitasFilter';
import { TopBarSearch } from '@/components/TopBarSearch';
import { ResizableAutoHidePanel, ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import { toast } from 'sonner';
import { useAksiProfilSantri, type AksiProfilSantri } from '@/components/santri/useAksiProfilSantri';
import { tokenUrut, type PetaArahKolom } from '@/lib/urut';

/** Baris tabel hasil (kenaikan / tidak naik). */
interface Baris {
  santri_id: number;
  nama: string;
  kelas: string | null;
  tingkat: string | null;
  tahun_ajaran: string | null;
  status_awal: string | null;
  /** Baris tak aktif (sudah disusul periode lain) tak bisa dibatalkan. */
  aktif: boolean;
}

/** Tingkat yang boleh naik kelas; tingkat akhir lewat halaman Kelulusan. */
const TINGKAT_KENAIKAN = ['1', '2', '3', '4', '5'];
/** Status awal hasil proses; `santri_baru` bukan hasil kenaikan. */
const STATUS_AWAL_DIKSUKAI = ['santri_baru'];
/** Status awal yang bisa dibatalkan (batal-kenaikan). */
const STATUS_AWAL_BATAL = ['kenaikan', 'mengulang'];

/** TA tujuan kenaikan = TA dasar + 1 (cermin SiklusSantriService::taBerikutnya). */
function taBerikutnya(ta: string | null | undefined): string | null {
  const m = /^(\d{4})\/(\d{4})$/.exec(ta ?? '');
  return m ? `${Number(m[1]) + 1}/${Number(m[2]) + 1}` : null;
}

/** Baris hasil boleh dibatalkan: status awal hasil kenaikan & masih aktif. */
function bisaBatalkan(b: Baris): boolean {
  return b.aktif && STATUS_AWAL_BATAL.includes(b.status_awal ?? '');
}

/** Kolom tabel kandidat (santri semester 2) + tabel hasil (naik/tidak naik). */
const FIELDS_KENAIKAN: ExcelField[] = [
  { key: 'nama', label: 'Nama Lengkap', kind: 'static' },
  { key: 'kelas', label: 'Nama Kelas', kind: 'static' },
  { key: 'tingkat', label: 'tingkat', kind: 'static' },
  { key: 'tahun_ajaran', label: 'tahun_ajaran', kind: 'static',  },
];

/** Kenaikan kelas: kandidat = baris semester 2 yang masih berstatus akhir
 *  aktif pada tahun ajaran yang dipilih filter (tidak dibatasi tahun ajaran
 *  aktif). Proses naik/tidak naik dijalankan per baris tercentang; hasilnya
 *  berstatus awal `kenaikan`/`mengulang` di tahun ajaran berikutnya, dan
 *  dapat dibatalkan (Santri kembali ke semester 2 tahun asal). */
export default function KenaikanKelasPage() {
  const { user } = useAuth();
  const canUbah = bisa(user, 'kenaikan.ubah');
  const {
    jenjangs,
    tahunAjaranNames,
    tingkat: tingkatAktif,
    loading: filterLoading,
  } = useFilterGlobalAktif();
  /** Tahun ajaran acuan (wajib satu): semua query diturunkan dari sini. */
  const taDasar = targetTunggal(tahunAjaranNames);
  const taTahunDepan = taBerikutnya(taDasar);
  const siap = !filterLoading && taDasar !== null && taTahunDepan !== null;
  /** Kandidat: hanya tingkat 1–5, diiris dengan filter tingkat. */
  const tingkatKandidat = useMemo(() => {
    if (tingkatAktif.length === 0) return TINGKAT_KENAIKAN;
    return tingkatAktif.filter((t) => TINGKAT_KENAIKAN.includes(t));
  }, [tingkatAktif]);
  const targetJenjang = targetTunggal(jenjangs);
  /** Tanggal masuk kelas baru; bawaan hari ini (lokal). */
  const [tglMasuk, setTglMasuk] = useState(() => {
    const now = new Date();
    const lokal = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return lokal.toISOString().slice(0, 10);
  });
  const [cari, setCari] = useState('');
  const [kiri, setKiri] = useState<RiwayatRow[]>([]);
  const [hasilNaik, setHasilNaik] = useState<Baris[]>([]);
  const [hasilTidak, setHasilTidak] = useState<Baris[]>([]);
  /** Baris tercentang pada tabel kandidat (untuk tombol naik/tidak naik). */
  const [tercentangKiri, setTercentangKiri] = useState<RiwayatRow[]>([]);
  /** Baris tercentang pada tabel hasil (untuk tombol Batalkan di header). */
  const [tercentangNaik, setTercentangNaik] = useState<Baris[]>([]);
  const [tercentangTidak, setTercentangTidak] = useState<Baris[]>([]);
  const [err, setErr] = useState('');
  const { aksiProfil, dialogProfil } = useAksiProfilSantri();
  /** Urutan tiap tabel asal untuk navigasi tetangga pada dialog profil. */
  const daftarKandidat = useMemo(() => kiri.map((r) => r.santri_id), [kiri]);
  const daftarNaik = useMemo(() => hasilNaik.map((b) => b.santri_id), [hasilNaik]);
  const daftarTidak = useMemo(() => hasilTidak.map((b) => b.santri_id), [hasilTidak]);
  const [busy, setBusy] = useState(false);
  /** Urut header ketiga tabel (pola KelulusanPage). */
  const [urutKiri, setUrutKiri] = useState<string[]>([]);
  const [arahKiri, setArahKiri] = useState<'naik' | 'turun'>('naik');
  const [arahKolomKiri, setArahKolomKiri] = useState<PetaArahKolom | undefined>(undefined);
  const [urutNaik, setUrutNaik] = useState<string[]>([]);
  const [arahNaik, setArahNaik] = useState<'naik' | 'turun'>('naik');
  const [arahKolomNaik, setArahKolomNaik] = useState<PetaArahKolom | undefined>(undefined);
  const [urutTidak, setUrutTidak] = useState<string[]>([]);
  const [arahTidak, setArahTidak] = useState<'naik' | 'turun'>('naik');
  const [arahKolomTidak, setArahKolomTidak] = useState<PetaArahKolom | undefined>(undefined);

  /** Kandidat: semester 2 pada TA acuan, hanya baris berstatus akhir aktif. */
  const loadKiri = useCallback(async (
    f?: { urut?: string[]; arah?: 'naik' | 'turun'; arahKolom?: PetaArahKolom },
  ) => {
    if (!siap || targetJenjang === null || tingkatKandidat.length === 0) {
      setKiri([]);
      return;
    }
    setErr('');
    try {
      const u = f?.urut ?? urutKiri;
      const a = f?.arah ?? arahKiri;
      const ak = f?.arahKolom ?? arahKolomKiri;
      const res = await listRiwayatBelajar({
        jenjang: jenjangs,
        tahun_ajaran: taDasar,
        semester: '2',
        tingkat: tingkatKandidat,
        is_active_riwayat: true,
        q: cari || undefined,
        sort: u.length ? tokenUrut(u, ak) : undefined,
        arah: u.length ? a : undefined,
        page: 1,
        per_page: 0,
      });
      setKiri(res.data);
    } catch (e) { setErr(errorMessage(e)); }
  }, [siap, targetJenjang, tingkatKandidat, jenjangs, taDasar, cari, urutKiri, arahKiri, arahKolomKiri]);

  /** Petakan baris riwayat (kelas/tingkat/TA/status awal) ke tabel hasil. */
  const barisHasil = useCallback((r: RiwayatRow): Baris => ({
    santri_id: r.santri_id,
    nama: r.santri?.nama_lengkap ?? String(r.santri_id),
    kelas: r.kelas?.nama_kelas ?? null,
    tingkat: r.tingkat ?? null,
    tahun_ajaran: r.tahun_ajaran ?? null,
    status_awal: r.status_awal ?? null,
    aktif: r.is_active_riwayat === 'Ya',
  }), []);

  /** Tabel naik: tahun ajaran berikutnya, status awal selain `santri_baru`. */
  const loadNaik = useCallback(async (
    f?: { urut?: string[]; arah?: 'naik' | 'turun'; arahKolom?: PetaArahKolom },
  ) => {
    if (!siap) {
      setHasilNaik([]);
      return;
    }
    try {
      const u = f?.urut ?? urutNaik;
      const a = f?.arah ?? arahNaik;
      const ak = f?.arahKolom ?? arahKolomNaik;
      const res = await listRiwayatBelajar({
        jenjang: jenjangs,
        tahun_ajaran: taTahunDepan,
        tingkat: tingkatAktif,
        status_awal_bukan: STATUS_AWAL_DIKSUKAI,
        is_active_riwayat: true,
        q: cari || undefined,
        sort: u.length ? tokenUrut(u, ak) : undefined,
        arah: u.length ? a : undefined,
        page: 1,
        per_page: 0,
      });
      setHasilNaik(res.data.map(barisHasil));
    } catch (e) { setErr(errorMessage(e)); }
  }, [siap, jenjangs, taTahunDepan, tingkatAktif, cari, barisHasil, urutNaik, arahNaik, arahKolomNaik]);

  /** Tabel tidak naik: tahun ajaran berikutnya, status awal `mengulang`. */
  const loadTidak = useCallback(async (
    f?: { urut?: string[]; arah?: 'naik' | 'turun'; arahKolom?: PetaArahKolom },
  ) => {
    if (!siap) {
      setHasilTidak([]);
      return;
    }
    try {
      const u = f?.urut ?? urutTidak;
      const a = f?.arah ?? arahTidak;
      const ak = f?.arahKolom ?? arahKolomTidak;
      const res = await listRiwayatBelajar({
        jenjang: jenjangs,
        tahun_ajaran: taTahunDepan,
        tingkat: tingkatAktif,
        status_awal: 'mengulang',
        is_active_riwayat: true,
        q: cari || undefined,
        sort: u.length ? tokenUrut(u, ak) : undefined,
        arah: u.length ? a : undefined,
        page: 1,
        per_page: 0,
      });
      setHasilTidak(res.data.map(barisHasil));
    } catch (e) { setErr(errorMessage(e)); }
  }, [siap, jenjangs, taTahunDepan, tingkatAktif, cari, barisHasil, urutTidak, arahTidak, arahKolomTidak]);

  useEffect(() => { void loadKiri(); }, [loadKiri]);
  useEffect(() => { void loadNaik(); }, [loadNaik]);
  useEffect(() => { void loadTidak(); }, [loadTidak]);

  /** Muat ulang semua tabel (setelah proses/batal). */
  const muatUlang = useCallback(async () => {
    setTercentangKiri([]);
    setTercentangNaik([]);
    setTercentangTidak([]);
    await Promise.all([loadKiri(), loadNaik(), loadTidak()]);
  }, [loadKiri, loadNaik, loadTidak]);

  function terapkanUrutKiri(nilai: string[], arah: 'naik' | 'turun', arahKolomBaru?: PetaArahKolom) {
    const peta = nilai.length > 0 ? arahKolomBaru : undefined;
    setUrutKiri(nilai);
    setArahKiri(arah);
    setArahKolomKiri(peta);
    void loadKiri({ urut: nilai, arah, arahKolom: peta });
  }

  function terapkanUrutNaik(nilai: string[], arah: 'naik' | 'turun', arahKolomBaru?: PetaArahKolom) {
    const peta = nilai.length > 0 ? arahKolomBaru : undefined;
    setUrutNaik(nilai);
    setArahNaik(arah);
    setArahKolomNaik(peta);
    void loadNaik({ urut: nilai, arah, arahKolom: peta });
  }

  function terapkanUrutTidak(nilai: string[], arah: 'naik' | 'turun', arahKolomBaru?: PetaArahKolom) {
    const peta = nilai.length > 0 ? arahKolomBaru : undefined;
    setUrutTidak(nilai);
    setArahTidak(arah);
    setArahKolomTidak(peta);
    void loadTidak({ urut: nilai, arah, arahKolom: peta });
  }

  /** Proses baris tercentang: naik (tingkat+1) atau tidak naik (mengulang). */
  const prosesMassal = useCallback(async (
    tercentang: RiwayatRow[],
    status: 'naik' | 'tidak_naik',
    clearSelection: () => void,
  ) => {
    if (!targetJenjang || tercentang.length === 0 || !tglMasuk || busy) return;
    setBusy(true);
    try {
      const res = await naikKelasOtomatis({
        jenjang: targetJenjang,
        siswa: tercentang.map((r) => ({santri_id: r.santri_id, status, tgl_masuk: tglMasuk })),
      });
      toast.success(
        `Kenaikan ${status === 'naik' ? 'naik' : 'tidak naik'} selesai: ${res.berhasil} berhasil, ${res.gagal.length} gagal.`,
      );
      if (res.gagal.length) toast.error(res.gagal.map((g) => `#${g.santri_id}: ${g.pesan}`).join(' · '));
      clearSelection();
      await muatUlang();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  }, [targetJenjang, tglMasuk, busy, muatUlang]);

  /** Proses satu baris dari kolom Aksi (naik / tidak naik). */
  const prosesSatu = useCallback(async (r: RiwayatRow, status: 'naik' | 'tidak_naik') => {
    if (!targetJenjang || !tglMasuk || busy) return;
    setBusy(true);
    try {
      const res = await naikKelasOtomatis({
        jenjang: targetJenjang,
        siswa: [{ santri_id: r.santri_id, status, tgl_masuk: tglMasuk }],
      });
      if (res.berhasil === 1) {
        toast.success(status === 'naik' ? 'Santri naik kelas.' : 'Santri tidak naik.');
        await muatUlang();
      } else {
        toast.error(res.gagal.map((g) => `#${g.santri_id}: ${g.pesan}`).join(' · '));
      }
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  }, [targetJenjang, tglMasuk, busy, muatUlang]);

  /** Batalkan hasil kenaikan: baris tahun berikutnya dihapus, baris asal
   *  semester 2 di TA acuan dibuka kembali (Santri jadi kandidat lagi). */
  const batalkan = useCallback(async (daftar: Baris[], clearSelection?: () => void) => {
    if (!targetJenjang || daftar.length === 0 || busy) return;
    setBusy(true);
    const gagal: string[] = [];
    for (const b of daftar) {
      try {
        await batalKenaikan(b.santri_id, targetJenjang);
      } catch (e) { gagal.push(`#${b.santri_id}: ${errorMessage(e)}`); }
    }
    if (gagal.length) toast.error(gagal.join(' · '));
    else toast.success(`Kenaikan dibatalkan: ${daftar.length} Santri.`);
    clearSelection?.();
    await muatUlang();
    setBusy(false);
  }, [targetJenjang, busy, muatUlang]);

  /** Tombol massal kandidat, diletakkan di kanan tanggal masuk kelas baru. */
  const tombolKandidat = useMemo(() => {
    if (!canUbah) {
      return (
        <FilterField label="Tanggal masuk kelas baru" htmlFor="input_tgl_kenaikan">
          <Input id="input_tgl_kenaikan" type="date" value={tglMasuk} onChange={(e) => setTglMasuk(e.target.value)} className="w-40" />
        </FilterField>
      );
    }
    const mati = busy || !tglMasuk || targetJenjang === null || tercentangKiri.length === 0;
    return (
      <div className="flex items-center gap-1.5">
        <FilterField label="Tanggal masuk kelas baru" htmlFor="input_tgl_kenaikan">
          <Input id="input_tgl_kenaikan" type="date" value={tglMasuk} onChange={(e) => setTglMasuk(e.target.value)} className="w-40" />
        </FilterField>
        <Button id="btn_naik_terpilih" size="sm" disabled={mati} onClick={() => void prosesMassal(tercentangKiri, 'naik', () => setTercentangKiri([]))}>
          Naik ({tercentangKiri.length})
        </Button>
        <Button id="btn_tidak_naik_terpilih" size="sm" variant="outline" disabled={mati} onClick={() => void prosesMassal(tercentangKiri, 'tidak_naik', () => setTercentangKiri([]))}>
          Tidak naik ({tercentangKiri.length})
        </Button>
      </div>
    );
  }, [canUbah, busy, tglMasuk, targetJenjang, tercentangKiri, prosesMassal]);

  /** Tombol Batalkan pada baris judul tabel hasil: memproses baris tercentang. */
  const tombolBatalkan = useCallback((idPrefix: string, tercentang: Baris[]) => {
    if (!canUbah) return undefined;
    const eligible = tercentang.filter(bisaBatalkan);
    return (
      <Button
        id={`btn_batalkan_${idPrefix}_terpilih`}
        size="sm"
        variant="ghost"
        disabled={busy || targetJenjang === null || eligible.length === 0}
        onClick={() => void batalkan(eligible)}
      >
        Batalkan ({eligible.length})
      </Button>
    );
  }, [canUbah, busy, targetJenjang, batalkan]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <TopBarSearch value={cari} onChange={setCari} placeholder="Cari santri…" />
      {!siap ? (
        <p className="text-xs text-muted-foreground" id="catatan_kenaikan_ta">
          Pilih satu tahun ajaran di filter untuk melihat dan memproses kenaikan kelas.
        </p>
      ) : null}
      <PengaturanHalaman tampil={{ tahun_ajaran: true, tingkat: true }} tabel={[{ key: 'kenaikan_santri_genap', judul: 'Santri semester 2', fields: FIELDS_KENAIKAN }, { key: 'kenaikan_naik_kelas', judul: 'Santri naik kelas', fields: FIELDS_KENAIKAN }, { key: 'kenaikan_tidak_naik_kelas', judul: 'Santri tidak naik', fields: FIELDS_KENAIKAN }]} />

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1" id="grup_kenaikan_kolom">
        <ResizableAutoHidePanel id="panel_kenaikan_santri_genap" defaultSize="50%" minSize="25%">
        <section className="flex h-full min-h-0 min-w-0 flex-col">
           <div className="flex min-h-0 flex-1 flex-col">
            <ExcelTable
               tableKey="kenaikan_santri_genap"
               rail
                header={<span>Santri semester 2 — {taDasar ?? '—'}</span>}
                filter={tombolKandidat}
                onCheckedChange={setTercentangKiri}
                fields={FIELDS_KENAIKAN}
              rows={kiri}
              urutAktif={urutKiri}
              arahUrut={arahKiri}
              onUrut={terapkanUrutKiri}
              getValues={(r) => ({
                nama: r.santri?.nama_lengkap ?? null,
                kelas: r.kelas?.nama_kelas ?? null,
                tingkat: r.tingkat ?? null,
                tahun_ajaran: r.tahun_ajaran ?? null,
              })}
                canEdit={false}
              onCommit={async () => {}}
              onSaved={() => {}}
              renderActions={(r) => (
                <>
                  {aksiProfil(r.santri_id, { prefix: 'kandidat', daftar: daftarKandidat })}
                  {canUbah && (
                  <>
                  <ActionIcon
                    id={`btn_naik_santri_${r.santri_id}`}
                    title="Naik kelas"
                    disabled={busy || !tglMasuk || targetJenjang === null}
                    onClick={() => void prosesSatu(r, 'naik')}
                    className="text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400"
                  >
                    <Check size={16} />
                  </ActionIcon>
                  <ActionIcon
                    id={`btn_tidak_naik_santri_${r.santri_id}`}
                    title="Tidak naik kelas (mengulang)"
                    disabled={busy || !tglMasuk || targetJenjang === null}
                    onClick={() => void prosesSatu(r, 'tidak_naik')}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X size={16} />
                  </ActionIcon>
                  </>
                  )}
                </>
              )}
               hidePreset
               emptyText="Tidak ada Santri semester 2 aktif pada tahun ajaran ini."
            />
          </div>
        </section>
        </ResizableAutoHidePanel>
        <ResizableHandle withHandle orientation="horizontal" id="gagang_kenaikan_kolom" />
        <ResizablePanel defaultSize="50%" minSize="25%">
        <div className="flex h-full min-h-0 flex-col">
        <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1" id="grup_kenaikan_baris">
          <ResizableAutoHidePanel id="panel_kenaikan_naik_kelas" defaultSize="65%" minSize="15%">
          <PanelDaftar
            idPrefix="naik_kelas"
            judul={`Santri naik kelas — ${taTahunDepan ?? '—'}`}
            baris={hasilNaik}
            urutAktif={urutNaik}
            arahUrut={arahNaik}
            onUrut={terapkanUrutNaik}
            tombolHeader={tombolBatalkan('naik_kelas', tercentangNaik)}
            onCheckedChange={setTercentangNaik}
            onBatalkan={(b) => void batalkan([b])}
            aksiProfil={aksiProfil}
            daftar={daftarNaik}
          />
          </ResizableAutoHidePanel>
          <ResizableHandle withHandle orientation="vertical" id="gagang_kenaikan_baris" />
          <ResizableAutoHidePanel id="panel_kenaikan_tidak_naik_kelas" defaultSize="35%" minSize="15%" sembunyiOtomatis={hasilTidak.length === 0}>
          <PanelDaftar
            idPrefix="tidak_naik_kelas"
            judul={`Santri tidak naik — ${taTahunDepan ?? '—'}`}
            baris={hasilTidak}
            urutAktif={urutTidak}
            arahUrut={arahTidak}
            onUrut={terapkanUrutTidak}
            tombolHeader={tombolBatalkan('tidak_naik_kelas', tercentangTidak)}
            onCheckedChange={setTercentangTidak}
            onBatalkan={(b) => void batalkan([b])}
            aksiProfil={aksiProfil}
            daftar={daftarTidak}
          />
          </ResizableAutoHidePanel>
        </ResizablePanelGroup>
        </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      {dialogProfil}
    </div>
  );
}

/** Panel tabel hasil (naik / tidak naik): centang + batalkan, boleh kosong. */
function PanelDaftar({
  idPrefix,
  judul,
  baris,
  tombolHeader,
  onCheckedChange,
  onBatalkan,
  aksiProfil,
  daftar,
  urutAktif,
  arahUrut,
  onUrut,
}: {
  idPrefix: string;
  judul: string;
  baris: Baris[];
  tombolHeader?: ReactNode;
  onCheckedChange: (tercentang: Baris[]) => void;
  onBatalkan: (b: Baris) => void;
  aksiProfil: AksiProfilSantri['aksiProfil'];
  /** Id Santri sesuai urutan baris tabel ini (untuk navigasi tetangga). */
  daftar: number[];
  urutAktif?: string[];
  arahUrut?: 'naik' | 'turun';
  onUrut?: (nilai: string[], arah: 'naik' | 'turun', arahKolom?: PetaArahKolom) => void;
}) {
  // Memoized: ExcelTable membersihkan seleksi tiap `rows` berubah identitas.
  const rows = useMemo(() => baris.map((b) => ({ ...b, id: b.santri_id })), [baris]);
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col">
       <div className="flex min-h-0 flex-1 flex-col pb-0">
        <ExcelTable
           tableKey={`kenaikan_${idPrefix}`}
           header={(
             <span className="flex w-full min-w-0 items-center justify-between gap-2">
               <span className="min-w-0 truncate">{judul}</span>
               {tombolHeader ? <span className="shrink-0">{tombolHeader}</span> : null}
             </span>
           )}
           fields={FIELDS_KENAIKAN}
          rows={rows}
          urutAktif={urutAktif}
          arahUrut={arahUrut}
          onUrut={onUrut}
          getValues={(b) => ({ nama: b.nama, kelas: b.kelas, tingkat: b.tingkat, tahun_ajaran: b.tahun_ajaran })}
          onCheckedChange={onCheckedChange}
          canEdit={false}
          onCommit={async () => {}}
          onSaved={() => {}}
          renderActions={(b) => (
            <>
              {aksiProfil(b.santri_id, { prefix: idPrefix, daftar })}
              {bisaBatalkan(b) ? (
            <ActionIcon
              id={`btn_batal_${idPrefix}_${b.santri_id}`}
              title="Batalkan kenaikan (kembali ke kandidat)"
              onClick={() => onBatalkan(b)}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <X size={16} />
            </ActionIcon>
          ) : null}
            </>
          )}
           hidePreset
           emptyText="Belum ada."
        />
      </div>
    </section>
  );
}
