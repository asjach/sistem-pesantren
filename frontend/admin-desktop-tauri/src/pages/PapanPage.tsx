import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ErrorNotice, PAGE_SHELL } from '@/components/PageHeader';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { KELAS_LIST_TAB, KELAS_TRIGGER } from '@/components/HalamanTabs';
import { PapanKolom } from '@/components/papan/PapanKolom';
import { Columns3, History, Loader2, Plus, RefreshCcw } from '@/icons';
import {
  hapusButirPapan,
  muatPapan,
  muatRiwayatPapan,
  pindahStatusPapan,
  setTimelinePapan,
  tambahButirPapan,
  tambahModulPapan,
  ubahButirPapan,
  ubahSubPapan,
  hapusSubPapan,
  type DataPapan,
  type ModulPapan,
  type RiwayatPapan,
  type StatusPapan,
} from '@/api/papan';
import { bisa } from '@/api/auth';
import { useAuth } from '@/auth/AuthContext';
import { kartuModul, kemajuanModul, modulPertama, type KartuPapan } from '@/lib/papan';
import type { AksiButir, AksiSub } from '@/components/papan/PapanKolom';
import { KelolaSubModul } from '@/components/papan/KelolaSubModul';
import { TambahModul } from '@/components/papan/TambahModul';

/** Kolom selesai/ditunda mulai terlipat agar fokus ke pekerjaan aktif. */
const KOLOM_TERTUTUP_AWAL: StatusPapan[] = ['sudah', 'ditunda'];

/** Modul pertama yang berisi, atau modul pertama bila semuanya kosong. */
function modulAwal(modul: ModulPapan[]): ModulPapan | null {
  return modulPertama(modul) ?? modul[0] ?? null;
}

/**
 * Board perkembangan proyek: tab aplikasi (horizontal), modul (vertikal),
 * lalu empat kolom status. Sumbernya API /board, bukan data pesantren.
 */
export default function PapanPage() {
  const { kodeAplikasi, kodeModul } = useParams<{ kodeAplikasi?: string; kodeModul?: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<DataPapan | null>(null);
  const [riwayat, setRiwayat] = useState<RiwayatPapan[]>([]);
  const [galat, setGalat] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [kelolaTerbuka, setKelolaTerbuka] = useState(false);
  const [modulTerbuka, setModulTerbuka] = useState(false);
  const [sibukTimeline, setSibukTimeline] = useState(false);

  const { user } = useAuth();
  // Satu gerbang untuk seluruh UI sunting. Tanpa izin ini halaman
  // tetap berfungsi penuh sebagai pembaca - tidak ada tombol mati yang
  // menggantung, dan kartu tidak bisa diseret ke kolom lain.
  const bolehUbah = bisa(user, 'papan.ubah');

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const papan = await muatPapan();
      setData(papan);
      setGalat(null);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Board gagal dimuat.');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  useEffect(() => {
    muatRiwayatPapan(undefined, 8)
      .then((log) => setRiwayat(log.riwayat))
      .catch(() => setRiwayat([]));
  }, []);

  const aplikasi = useMemo(() => data?.aplikasi ?? [], [data]);
  const aplikasiAktif = useMemo(
    () => aplikasi.find((a) => a.kode === kodeAplikasi) ?? null,
    [aplikasi, kodeAplikasi],
  );
  const modul = useMemo(() => aplikasiAktif?.modul ?? [], [aplikasiAktif]);
  const aktif = useMemo(() => {
    if (!kodeModul) return null;

    return modul.find((m) => m.kode.toUpperCase() === kodeModul.toUpperCase()) ?? null;
  }, [modul, kodeModul]);

  /**
   * Arahkan ke aplikasi/modul yang valid. Aplikasi yang belum punya modul
   * sengaja TIDAK dialihkan supaya tombol tambah modul di sana tetap terpakai.
   */
  const tujuan = useMemo(() => {
    if (!data) return null;

    if (aplikasiAktif) {
      if (aplikasiAktif.modul.length === 0 || aktif) return null;

      const m = modulAwal(aplikasiAktif.modul);

      return m ? { aplikasi: aplikasiAktif.kode, modul: m.kode } : null;
    }

    const aplikasiBerisi = aplikasi.find((a) => a.modul.length > 0) ?? aplikasi[0];
    if (!aplikasiBerisi) return null;

    const m = modulAwal(aplikasiBerisi.modul);

    return { aplikasi: aplikasiBerisi.kode, modul: m?.kode ?? null };
  }, [data, aplikasiAktif, aktif, aplikasi]);

  /**
   * Simpan perpindahan satu POIN; gagal = kembalikan tampilan ke data server.
   *
   * Pemindahan menyentuh dua hal sekaligus: status poinnya, dan status
   * sub-modul induknya yang diturunkan. Keduanya digeser optimistis di layar
   * supaya tidak ada jeda; kalau server menolak, seluruh papan dimuat ulang.
   */
  const pindah = useCallback(
    async (butirId: number, ke: StatusPapan) => {
      if (!data) return;

      const subTersentuh = data.aplikasi
        .flatMap((a) => a.modul)
        .flatMap((m) => m.sub)
        .find((s) => s.butir.some((b) => b.id === butirId));

      const hitungTurunan = (status: StatusPapan[]): StatusPapan => {
        if (status.includes('sedang')) return 'sedang';
        if (status.includes('akan')) return 'akan';
        if (status.includes('ditunda')) return 'ditunda';

        return 'sudah';
      };

      setData({
        ...data,
        aplikasi: data.aplikasi.map((a) => ({
          ...a,
          modul: a.modul.map((m) => ({
            ...m,
            sub: m.sub.map((s) => {
              const butir = s.butir.map((b) => (b.id === butirId ? { ...b, status: ke } : b));

              return {
                ...s,
                butir,
                status:
                  subTersentuh?.kode === s.kode ? hitungTurunan(butir.map((b) => b.status)) : s.status,
              };
            }),
          })),
        })),
      });

      try {
        await pindahStatusPapan(subTersentuh?.kode ?? '', butirId, ke);
        const log = await muatRiwayatPapan(undefined, 8);
        setRiwayat(log.riwayat);
        setGalat(null);
      } catch (e) {
        setGalat(e instanceof Error ? e.message : 'Perpindahan gagal disimpan.');
        void muat();
      }
    },
    [data, muat],
  );

  /**
   * Simpan perubahan pada satu poin, lalu segarkan papan dari server.
   *
   * Berbeda dari pemindahan lewat seret (yang optimistis), suntingan di
   * sini memuat ulang setelah sukses karena bisa menggeser banyak kartu.
   */
  const segarkan = useCallback(async () => {
    try {
      const [papan, log] = await Promise.all([muatPapan(), muatRiwayatPapan(undefined, 8)]);
      setData(papan);
      setRiwayat(log.riwayat);
      setGalat(null);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Board gagal dimuat ulang.');
    }
  }, []);

  /** Aksi sunting untuk satu baris poin. */
  const aksiButir = useCallback(
    (kartu: KartuPapan): AksiButir => ({
      onSimpanTeks: async (deskripsi, status) => {
        await ubahButirPapan(kartu.subKode, kartu.id, status ? { deskripsi, status } : { deskripsi });
        await segarkan();
      },
      onSimpanSubpoin: async (subpoin) => {
        await ubahButirPapan(kartu.subKode, kartu.id, { subpoin });
        await segarkan();
      },
      onHapus: async () => {
        await hapusButirPapan(kartu.subKode, kartu.id);
        await segarkan();
      },
    }),
    [segarkan],
  );

  const aksiSub = useCallback(
    (kartu: { subKode: string }): AksiSub => ({
      onSimpan: async (kode, nama) => {
        await ubahSubPapan(kartu.subKode, { kode_baru: kode, nama });
        await segarkan();
      },
      onHapus: async () => {
        await hapusSubPapan(kartu.subKode);
        await segarkan();
      },
    }),
    [segarkan],
  );

  /** Tambah poin baru ke sebuah sub-modul lalu muat ulang papan. */
  const tambahPoin = useCallback(
    async (subKode: string, status: StatusPapan, deskripsi: string) => {
      await tambahButirPapan(subKode, status, deskripsi);
      await segarkan();
    },
    [segarkan],
  );

  async function ubahTimeline() {
    if (!data || sibukTimeline) return;

    setSibukTimeline(true);
    try {
      const hasil = await setTimelinePapan(!data.timeline_aktif);
      setData({ ...data, timeline_aktif: hasil.timeline_aktif });
      setGalat(null);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Status timeline gagal diubah.');
    } finally {
      setSibukTimeline(false);
    }
  }

  if (memuat && !data) {
    return (
      <div id="papan_modul" className={cn(PAGE_SHELL, 'h-full')}>
        <div
          role="status"
          className="flex flex-1 items-center justify-center gap-2 px-6 text-sm text-muted-foreground"
        >
          <Loader2 size={15} className="animate-spin" />
          Memuat Board...
        </div>
      </div>
    );
  }

  if (galat && !data) {
    return (
      <div id="papan_modul" className={cn(PAGE_SHELL, 'h-full')}>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 px-6">
          <ErrorNotice className="mb-0">{galat}</ErrorNotice>
          <Button
            id="btn_muat_ulang_papan"
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void muat()}
            className="self-start"
          >
            <RefreshCcw size={13} />
            Coba lagi
          </Button>
        </div>
      </div>
    );
  }

  if (data && tujuan && (tujuan.aplikasi !== kodeAplikasi || tujuan.modul !== kodeModul)) {
    const alamat = tujuan.modul
      ? `/board/${tujuan.aplikasi}/${tujuan.modul}`
      : `/board/${tujuan.aplikasi}`;

    return <Navigate to={alamat} replace />;
  }

  const kartu = aktif ? kartuModul(aktif) : [];

  return (
    <div id="papan_modul" className={cn(PAGE_SHELL, 'h-full')}>
      <Tabs
        value={aplikasiAktif?.kode ?? ''}
        onValueChange={(k) => {
          const app = aplikasi.find((a) => a.kode === k);
          const awal = app ? modulAwal(app.modul) : null;

          navigate(awal ? `/board/${k}/${awal.kode}` : `/board/${k}`);
        }}
        className="min-h-0 flex-1 gap-0"
      >
        <div className="flex flex-wrap items-center gap-2 px-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <TabsList
              className={KELAS_LIST_TAB}
              indikator="primer"
              style={{ justifyContent: 'flex-start' }}
            >
              {aplikasi.map((a) => (
                <TabsTrigger
                  key={a.kode}
                  id={`tab_aplikasi_${a.kode}`}
                  value={a.kode}
                  className={KELAS_TRIGGER}
                >
                  {a.nama}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {bolehUbah ? (
            <Button
              id="btn_timeline"
              type="button"
              variant="outline"
              size="sm"
              disabled={sibukTimeline || !data}
              aria-label={data?.timeline_aktif ? 'Nonaktifkan timeline' : 'Aktifkan timeline'}
              onClick={() => void ubahTimeline()}
              className={cn(
                'shrink-0',
                data?.timeline_aktif ? 'text-success' : 'text-muted-foreground',
              )}
            >
              Timeline: {data?.timeline_aktif ? 'Aktif' : 'Draf'}
            </Button>
          ) : (
            <span
              className="shrink-0 border px-2 py-1 text-[11px] text-muted-foreground"
              style={{ borderColor: 'var(--divider)' }}
            >
              Timeline: {data?.timeline_aktif ? 'Aktif' : 'Draf'}
            </span>
          )}
          {bolehUbah ? (
            <Button
              id="btn_tambah_modul"
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Tambah modul"
              title="Tambah modul"
              disabled={!aplikasiAktif}
              onClick={() => setModulTerbuka(true)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Plus size={14} />
            </Button>
          ) : null}
          {riwayat.length > 0 ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="btn_riwayat_papan"
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Aktivitas papan"
                  title="Aktivitas papan"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <History size={14} />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 max-w-[calc(100vw-1.5rem)] border border-foreground/30 p-2">
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <History size={12} />
                  Aktivitas papan
                </p>
                <ul aria-label="Aktivitas terakhir di papan" className="flex max-h-64 flex-col gap-1 overflow-y-auto text-[11px]">
                  {riwayat.map((r, i) => (
                    <li
                      key={`${r.kode}-${r.waktu}-${i}`}
                      className="flex items-center gap-1.5 border-b pb-1 last:border-0"
                      style={{ borderColor: 'var(--divider)' }}
                      title={r.waktu}
                    >
                      <span className="font-mono text-[10px] font-semibold text-foreground/75">{r.kode}</span>
                      <span>{r.dari ?? '-'}</span>
                      <span aria-hidden="true" className="text-muted-foreground/50">→</span>
                      <span>{r.ke}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{r.waktu}</span>
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
          ) : null}
        </div>

        {aplikasiAktif ? (
          <Tabs
            value={aktif?.kode ?? ''}
            orientation="vertical"
            onValueChange={(k) => navigate(`/board/${aplikasiAktif.kode}/${k}`)}
            className="flex min-h-0 flex-1 gap-3 px-3 pb-4 sm:px-6 sm:pb-6"
          >
            <TabsList
              className="flex h-full w-32 shrink-0 flex-col items-stretch justify-start gap-1 overflow-y-auto border p-1 sm:w-52"
              style={{ borderColor: 'var(--divider)' }}
            >
              {modul.map((m) => (
                <TabsTrigger
                  key={m.kode}
                  id={`tab_papan_${m.kode.toLowerCase()}`}
                  value={m.kode}
                  className="flex w-full flex-none items-start justify-between gap-2 whitespace-normal px-2 py-1.5 text-left text-[12px] leading-snug"
                >
                  <span className="min-w-0">
                    <span className="font-mono text-[10px] text-muted-foreground">{m.kode}</span>
                    <span className="block">{m.nama}</span>
                  </span>
                  <span className="lencana-tab-papan shrink-0" title="Subpoin selesai dari total subpoin">
                    {kemajuanModul(m).selesai}/{kemajuanModul(m).total}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {galat ? (
                <div className="pb-2">
                  <ErrorNotice className="mb-0">{galat}</ErrorNotice>
                </div>
              ) : null}

              {aktif ? (
                <PapanKolom
                  key={aktif.kode}
                  kartu={kartu}
                  tampilkanModul={false}
                  onPindah={pindah}
                  bolehUbah={bolehUbah}
                  aksiButir={aksiButir}
                  aksiSub={aksiSub}
                  onTambahPoin={tambahPoin}
                  subKosong={aktif.sub.filter((s) => s.butir.length === 0)}
                  idAwalan={`modul_${aktif.kode.toLowerCase()}`}
                  lipatAwal={KOLOM_TERTUTUP_AWAL}
                  onTambahSub={bolehUbah ? () => setKelolaTerbuka(true) : undefined}
                />
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
                  <Columns3 size={24} className="text-muted-foreground/60" />
                  <p className="text-sm font-medium">Belum ada modul di aplikasi ini</p>
                  {bolehUbah ? (
                    <Button
                      id="btn_tambah_modul_kosong"
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setModulTerbuka(true)}
                    >
                      <Plus size={13} />
                      Tambah modul
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          </Tabs>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <Columns3 size={24} className="text-muted-foreground/60" />
            <p className="text-sm font-medium">Board belum berisi aplikasi</p>
          </div>
        )}
      </Tabs>

      {bolehUbah && modulTerbuka && aplikasiAktif ? (
        <TambahModul
          onTutup={() => setModulTerbuka(false)}
          onSimpan={async (kode, nama) => {
            const modulBaru = await tambahModulPapan(aplikasiAktif.kode, kode, nama);

            // Sisipkan lebih dulu supaya rute tab baru langsung menemukan
            // modulnya, lalu segarkan dari server.
            setData((prev) => (
              prev
                ? {
                    ...prev,
                    aplikasi: prev.aplikasi.map((a) => (
                      a.kode === aplikasiAktif.kode
                        ? { ...a, modul: [...a.modul, { kode: modulBaru.kode, nama: modulBaru.nama, sub: [] }] }
                        : a
                    )),
                  }
                : prev
            ));
            navigate(`/board/${aplikasiAktif.kode}/${modulBaru.kode}`);
            void segarkan();
          }}
        />
      ) : null}

      {bolehUbah && kelolaTerbuka && aktif ? (
        <KelolaSubModul
          modulKode={aktif.kode}
          modulNama={aktif.nama}
          onTutup={() => setKelolaTerbuka(false)}
          onBerubah={segarkan}
        />
      ) : null}
    </div>
  );
}
