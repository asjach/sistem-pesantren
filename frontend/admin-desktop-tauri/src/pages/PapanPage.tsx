import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { PAGE_SHELL } from '@/components/PageHeader';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KELAS_LIST_TAB, KELAS_TRIGGER } from '@/components/HalamanTabs';
import { DialogButir, PapanKolom } from '@/components/papan/PapanKolom';
import {
  muatPapan,
  muatRiwayatPapan,
  pindahStatusPapan,
  type DataPapan,
  type RiwayatPapan,
  type StatusPapan,
} from '@/api/papan';
import { kartuModul, modulPertama, type KartuPapan } from '@/lib/papan';

/**
 * Papan perkembangan modul - satu tab per modul (A, B, C, ...), tiap tab
 * berisi papan empat kolom (akan, sedang, sudah, ditunda).
 *
 * Tab dibangun dari modul yang ada di papan, jadi modul baru langsung muncul
 * tanpa mengubah kode. Sumbernya API /papan, bukan data pesantren, jadi
 * halaman ini tidak ikut mode lembaga aktif.
 */
export default function PapanPage() {
  const { kodeModul } = useParams<{ kodeModul?: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<DataPapan | null>(null);
  const [riwayat, setRiwayat] = useState<RiwayatPapan[]>([]);
  const [galat, setGalat] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [pilihan, setPilihan] = useState<KartuPapan | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const papan = await muatPapan();
      setData(papan);
      setGalat(null);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Papan gagal dimuat.');
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

  const modul = useMemo(() => data?.modul ?? [], [data]);
  const aktif = useMemo(() => {
    if (!kodeModul) return null;

    return modul.find((m) => m.kode.toUpperCase() === kodeModul.toUpperCase()) ?? null;
  }, [modul, kodeModul]);

  /** Simpan perpindahan; gagal = kembalikan tampilan ke data server. */
  const pindah = useCallback(
    async (kode: string, ke: StatusPapan) => {
      if (!data) return;

      // Optimistis: geser dulu di layar, batalkan bila server menolak.
      setData({
        ...data,
        modul: data.modul.map((m) => ({
          ...m,
          sub: m.sub.map((s) => (s.kode === kode ? { ...s, status: ke } : s)),
        })),
      });

      try {
        await pindahStatusPapan(kode, ke);
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

  // Modul tak dikenal atau belum dipilih -> arahkan ke modul pertama yang berisi.
  if (data && (!kodeModul || !aktif)) {
    const tujuan = modulPertama(modul);

    return <Navigate to={tujuan ? `/papan/${tujuan.kode}` : '/papan/redirect'} replace />;
  }

  if (memuat && !data) {
    return (
      <div id="papan_modul" className={cn(PAGE_SHELL, 'h-full')}>
        <div className="px-6 pt-7 text-sm text-muted-foreground">Memuat papan...</div>
      </div>
    );
  }

  if (galat && !data) {
    return (
      <div id="papan_modul" className={cn(PAGE_SHELL, 'h-full')}>
        <div className="px-6 pt-7 text-sm" style={{ color: 'var(--danger)' }}>
          {galat}
        </div>
      </div>
    );
  }

  const kartu = aktif ? kartuModul(aktif) : [];

  return (
    <div id="papan_modul" className={cn(PAGE_SHELL, 'h-full')}>
      {modul.length > 0 ? (
        <Tabs
          value={aktif?.kode ?? ''}
          onValueChange={(k) => navigate(`/papan/${k}`)}
          className="min-h-0 flex-1 gap-0"
        >
          <TabsList className={KELAS_LIST_TAB} indikator="primer">
            {modul.map((m) => (
              <TabsTrigger
                key={m.kode}
                id={`tab_papan_${m.kode.toLowerCase()}`}
                value={m.kode}
                className={KELAS_TRIGGER}
              >
                {m.kode}. {m.nama}
                <span className="ml-1.5 tabular-nums opacity-70">{m.sub.length}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {galat ? (
            <div className="px-6 py-2 text-xs" style={{ color: 'var(--danger)' }}>
              {galat}
            </div>
          ) : null}

          {aktif ? (
            <PapanKolom
              key={aktif.kode}
              kartu={kartu}
              tampilkanModul={false}
              onPindah={pindah}
              onBuka={setPilihan}
              riwayat={riwayat}
              idAwalan={`modul_${aktif.kode.toLowerCase()}`}
            />
          ) : null}
        </Tabs>
      ) : (
        <div className="px-6 pt-2 text-sm text-muted-foreground">Papan belum berisi modul.</div>
      )}

      {pilihan ? <DialogButir kartu={pilihan} onTutup={() => setPilihan(null)} /> : null}
    </div>
  );
}
