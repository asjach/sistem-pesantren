import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { prefGet, prefSet } from '@/api/client';
import { getPengaturanTampilan, getVersiTampilan, type TampilanData } from '@/api/tampilan';
import { useLembagaAktif } from '@/lembagaAktif';
import { useAuth } from '@/auth/AuthContext';

/** Cache standar terakhir per lembaga (agar tampilan benar walau server tak terjangkau). */
const CACHE_PREFIX = 'simpes_std_';
/** Kunci setelan yang sengaja diubah user (menang atas standar). */
const PERSONAL_KEY = 'simpes_personal_tampilan';
/** Selang pemantauan versi standar (ms). */
const POLL_MS = 60_000;

export type PribadiMap = Record<string, true>;

interface StandarState {
  loading: boolean;
  versi: number;
  tampilan: TampilanData | null;
  /** Muat ulang standar aktif (mis. setelah versi berubah). */
  muatUlang: () => void;
  /** Setelan yang diubah user sendiri (mengalahkan standar). */
  pribadi: PribadiMap;
  isPribadi: (key: string) => boolean;
  tandai: (...keys: string[]) => void;
  hapus: (...keys: string[]) => void;
}

const Ctx = createContext<StandarState | null>(null);

export function StandarTampilanProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { lembagaId } = useLembagaAktif();

  const [tampilan, setTampilan] = useState<TampilanData | null>(null);
  const [versi, setVersi] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pribadi, setPribadi] = useState<PribadiMap>({});
  const versiRef = useRef(0);
  versiRef.current = versi;

  useEffect(() => {
    prefGet(PERSONAL_KEY)
      .then((v) => { if (v) setPribadi(JSON.parse(v) as PribadiMap); })
      .catch(() => {});
  }, []);

  const muat = useCallback(async () => {
    if (!user || lembagaId == null) {
      setTampilan(null);
      setVersi(0);
      return;
    }
    setLoading(true);
    try {
      const res = await getPengaturanTampilan(lembagaId);
      setTampilan(res.data.tampilan);
      setVersi(res.data.versi);
      prefSet(
        `${CACHE_PREFIX}${lembagaId}`,
        JSON.stringify({ versi: res.data.versi, tampilan: res.data.tampilan, ts: Date.now() }),
      ).catch(() => {});
    } catch {
      // Server tak terjangkau: pertahankan cache (jika ada) agar tampilan konsisten.
    } finally {
      setLoading(false);
    }
  }, [user, lembagaId]);

  // Tampilkan cache lebih dulu agar tidak berkedip, lalu ambil versi server.
  useEffect(() => {
    if (lembagaId == null) {
      setTampilan(null);
      setVersi(0);
      return;
    }
    prefGet(`${CACHE_PREFIX}${lembagaId}`)
      .then((raw) => {
        if (!raw) return;
        const c = JSON.parse(raw) as { versi?: number; tampilan?: TampilanData | null };
        setTampilan(c.tampilan ?? null);
        setVersi(c.versi ?? 0);
      })
      .catch(() => {});
  }, [lembagaId]);

  useEffect(() => { void muat(); }, [muat]);

  // Pantau versi: saat jendela kembali fokus & berkala.
  useEffect(() => {
    if (!user || lembagaId == null) return;
    let batal = false;
    const cek = async () => {
      if (batal || document.visibilityState === 'hidden') return;
      try {
        const res = await getVersiTampilan(lembagaId);
        if (!batal && res.data.versi !== versiRef.current) void muat();
      } catch {
        /* offline: coba lagi pada pemantauan berikutnya */
      }
    };
    const timer = window.setInterval(() => void cek(), POLL_MS);
    const onFokus = () => void cek();
    window.addEventListener('focus', onFokus);
    document.addEventListener('visibilitychange', onFokus);
    return () => {
      batal = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFokus);
      document.removeEventListener('visibilitychange', onFokus);
    };
  }, [user, lembagaId, muat]);

  const simpanPribadi = useCallback((next: PribadiMap) => {
    prefSet(PERSONAL_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const tandai = useCallback((...keys: string[]) => {
    setPribadi((prev) => {
      const next: PribadiMap = { ...prev };
      for (const k of keys) next[k] = true;
      simpanPribadi(next);
      return next;
    });
  }, [simpanPribadi]);

  const hapus = useCallback((...keys: string[]) => {
    setPribadi((prev) => {
      const next: PribadiMap = { ...prev };
      for (const k of keys) delete next[k];
      simpanPribadi(next);
      return next;
    });
  }, [simpanPribadi]);

  const isPribadi = useCallback((key: string) => !!pribadi[key], [pribadi]);

  const value = useMemo<StandarState>(() => ({
    loading,
    versi,
    tampilan,
    muatUlang: () => void muat(),
    pribadi,
    isPribadi,
    tandai,
    hapus,
  }), [loading, versi, tampilan, muat, pribadi, isPribadi, tandai, hapus]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStandarTampilan() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStandarTampilan di luar StandarTampilanProvider');
  return ctx;
}
