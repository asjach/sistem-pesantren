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
import { getPengaturanTampilan, getVersiTampilan, putPengaturanTampilan, type TampilanData } from '@/api/tampilan';
import { useLembagaAktif } from '@/lembagaAktif';
import { useAuth } from '@/auth/AuthContext';

/** Cache standar terakhir per lembaga (agar tampilan benar walau server tak terjangkau). */
const CACHE_PREFIX = 'simpes_std_';
/** Kunci setelan yang sengaja diubah user (menang atas standar). */
const PERSONAL_KEY = 'simpes_personal_tampilan';
/** Selang pemantauan versi standar (ms). */
const POLL_MS = 60_000;
/** Tunda penyimpanan standar saat bertindak (ms) agar tidak spam request. */
const SIMPAN_MS = 800;

export type PribadiMap = Record<string, true>;

/** Gabung bagian JSON: nilai null/undefined menghapus kunci; objek digabung dangkal. */
function gabungSection<T extends Record<string, unknown>>(
  prev: T | undefined,
  patch: T | undefined,
): T | undefined {
  if (!patch) return prev;
  const out: Record<string, unknown> = { ...(prev ?? {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined) delete out[k];
    else if (typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object') {
      out[k] = { ...(out[k] as Record<string, unknown>), ...(v as Record<string, unknown>) };
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

/** Gabung standar lama dengan perubahan (per bagian). */
export function gabungTampilan(prev: TampilanData | null, patch: TampilanData): TampilanData {
  const base: TampilanData = prev ?? {};
  return {
    tema: gabungSection(base.tema, patch.tema),
    parts: {
      gaya: gabungSection(base.parts?.gaya, patch.parts?.gaya),
      terang: gabungSection(base.parts?.terang, patch.parts?.terang),
      gelap: gabungSection(base.parts?.gelap, patch.parts?.gelap),
    },
    grid: {
      ...gabungSection(base.grid, patch.grid ? { rowH: patch.grid.rowH, headerH: patch.grid.headerH } : undefined),
      align: gabungSection(base.grid?.align, patch.grid?.align),
    },
    presetAktif: gabungSection(base.presetAktif, patch.presetAktif),
    lebar: gabungSection(base.lebar, patch.lebar),
    beku: gabungSection(base.beku, patch.beku),
  };
}

interface StandarState {
  loading: boolean;
  versi: number;
  tampilan: TampilanData | null;
  /** Sedang "bertindak sebagai lembaga" (super_admin + lembaga aktif). */
  bertindak: boolean;
  /** Sedang menyimpan standar ke server. */
  menyimpan: boolean;
  /** Muat ulang standar aktif (mis. setelah versi berubah). */
  muatUlang: () => void;
  /**
   * Simpan perubahan tampilan langsung ke standar lembaga aktif (mode bertindak);
   * diabaikan saat tidak bertindak. Debounce agar hemat request.
   */
  simpanKeStandar: (patch: TampilanData) => void;
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
  const [menyimpan, setMenyimpan] = useState(false);
  const [pribadi, setPribadi] = useState<PribadiMap>({});
  const versiRef = useRef(0);
  versiRef.current = versi;
  const tampilanRef = useRef<TampilanData | null>(null);
  tampilanRef.current = tampilan;
  const simpanTimerRef = useRef<number | null>(null);

  const superAdmin = !!user?.roles.some((r) => r.name === 'super_admin');
  const bertindak = superAdmin && lembagaId != null;

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

  // Simpan standar lembaga aktif (mode bertindak) — langsung ke DB, debounce.
  const kirimStandar = useCallback(async (data: TampilanData) => {
    if (lembagaId == null) return;
    setMenyimpan(true);
    try {
      const res = await putPengaturanTampilan({
        lembaga_ids: [lembagaId],
        sumber_lembaga_id: lembagaId,
        data,
      });
      const row = res.data?.[0];
      if (row) {
        setTampilan(row.tampilan);
        setVersi(row.versi);
        prefSet(
          `${CACHE_PREFIX}${lembagaId}`,
          JSON.stringify({ versi: row.versi, tampilan: row.tampilan, ts: Date.now() }),
        ).catch(() => {});
      }
    } catch {
      // Gagal simpan: biarkan nilai lokal; perubahan berikutnya mencoba lagi.
    } finally {
      setMenyimpan(false);
    }
  }, [lembagaId]);

  /** Terapkan perubahan ke standar lembaga aktif (mode bertindak). */
  const simpanKeStandar = useCallback((patch: TampilanData) => {
    if (!(superAdmin && lembagaId != null)) return;
    const next = gabungTampilan(tampilanRef.current, patch);
    tampilanRef.current = next;
    setTampilan(next);
    if (simpanTimerRef.current) window.clearTimeout(simpanTimerRef.current);
    simpanTimerRef.current = window.setTimeout(() => { void kirimStandar(next); }, SIMPAN_MS);
  }, [superAdmin, lembagaId, kirimStandar]);

  useEffect(() => () => {
    if (simpanTimerRef.current) window.clearTimeout(simpanTimerRef.current);
  }, []);

  const value = useMemo<StandarState>(() => ({
    loading,
    versi,
    tampilan,
    bertindak,
    menyimpan,
    muatUlang: () => void muat(),
    simpanKeStandar,
    pribadi,
    isPribadi,
    tandai,
    hapus,
  }), [loading, versi, tampilan, bertindak, menyimpan, muat, simpanKeStandar, pribadi, isPribadi, tandai, hapus]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStandarTampilan() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStandarTampilan di luar StandarTampilanProvider');
  return ctx;
}
