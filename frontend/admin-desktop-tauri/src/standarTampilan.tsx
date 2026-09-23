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
/** Tombol "rekam visual" (per perangkat; default mati = hanya berperan). */
const REKAM_KEY = 'simpes_rekam_visual';

export type PribadiMap = Record<string, true>;

/**
 * Kunci penanda pribadi yang nilainya BERUBAH antara standar lama & baru.
 * Dipakai agar perubahan standar oleh super_admin berlaku untuk kunci itu,
 * tanpa menghapus penyesuaian pribadi user pada kunci lain.
 */
export function kunciStandarBerubah(lama: TampilanData | null, baru: TampilanData | null): string[] {
  if (!lama || !baru) return [];
  const out: string[] = [];
  const beda = (a: unknown, b: unknown) => JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);

  const t1 = lama.tema ?? {};
  const t2 = baru.tema ?? {};
  for (const k of ['theme', 'mode', 'warnaUI', 'iconSet', 'density'] as const) {
    if (beda(t1[k], t2[k])) out.push(`tema.${k}`);
  }

  for (const m of ['gaya', 'terang', 'gelap'] as const) {
    const g1 = (lama.parts?.[m] ?? {}) as Record<string, unknown>;
    const g2 = (baru.parts?.[m] ?? {}) as Record<string, unknown>;
    for (const id of new Set([...Object.keys(g1), ...Object.keys(g2)])) {
      if (beda(g1[id], g2[id])) out.push(`parts.${m}.${id}`);
    }
  }

  const gr1 = lama.grid ?? {};
  const gr2 = baru.grid ?? {};
  if (beda(gr1.rowH, gr2.rowH)) out.push('grid.rowH');
  if (beda(gr1.headerH, gr2.headerH)) out.push('grid.headerH');
  const a1 = gr1.align ?? {};
  const a2 = gr2.align ?? {};
  for (const k of new Set([...Object.keys(a1), ...Object.keys(a2)])) {
    if (beda(a1[k], a2[k])) out.push(`grid.align.${k}`);
  }

  const kunci = (k: 'lebar' | 'beku' | 'presetAktif') => {
    const o1 = (lama[k] ?? {}) as Record<string, unknown>;
    const o2 = (baru[k] ?? {}) as Record<string, unknown>;
    const prefiks = k === 'presetAktif' ? 'preset' : k;
    for (const t of new Set([...Object.keys(o1), ...Object.keys(o2)])) {
      if (beda(o1[t], o2[t])) out.push(`${prefiks}.${t}`);
    }
  };
  kunci('lebar');
  kunci('beku');
  kunci('presetAktif');

  return out;
}

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
  /** Mode rekam visual aktif (bertindak + tombol rekam menyala). */
  merekam: boolean;
  /** Status tombol rekam visual (per perangkat). */
  rekam: boolean;
  setRekam: (v: boolean) => void;
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
  const { jenjang, bertindak } = useLembagaAktif();

  const [tampilan, setTampilan] = useState<TampilanData | null>(null);
  const [versi, setVersi] = useState(0);
  const [loading, setLoading] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [rekam, setRekamState] = useState(false);
  const [pribadi, setPribadi] = useState<PribadiMap>({});
  const versiRef = useRef(0);
  versiRef.current = versi;
  const tampilanRef = useRef<TampilanData | null>(null);
  tampilanRef.current = tampilan;
  const simpanTimerRef = useRef<number | null>(null);
  /** Lembaga pemilik `tampilan` saat ini (hindari dif saat ganti lembaga). */
  const tampilanLembagaRef = useRef<string | null>(null);
  /** Penghapus penanda pribadi (diisi setelah callback `hapus` siap). */
  const hapusRef = useRef<(...keys: string[]) => void>(() => {});

  const merekam = bertindak && rekam;

  useEffect(() => {
    prefGet(REKAM_KEY).then((v) => setRekamState(v === '1')).catch(() => {});
  }, []);

  const setRekam = useCallback((v: boolean) => {
    setRekamState(v);
    prefSet(REKAM_KEY, v ? '1' : '0').catch(() => {});
  }, []);

  useEffect(() => {
    prefGet(PERSONAL_KEY)
      .then((v) => { if (v) setPribadi(JSON.parse(v) as PribadiMap); })
      .catch(() => {});
  }, []);

  const muat = useCallback(async () => {
    if (!user || jenjang == null) {
      setTampilan(null);
      setVersi(0);
      return;
    }
    setLoading(true);
    try {
      const res = await getPengaturanTampilan(jenjang);
      // Standar berubah (versi baru): lepas penanda pribadi untuk kunci yang
      // diubah super_admin agar standar baru berlaku, tanpa mengganggu
      // penyesuaian pribadi user pada kunci lain.
      if (tampilanLembagaRef.current === jenjang) {
        const berubah = kunciStandarBerubah(tampilanRef.current, res.data.tampilan);
        if (berubah.length > 0) hapusRef.current(...berubah);
      }
      tampilanLembagaRef.current = jenjang;
      setTampilan(res.data.tampilan);
      setVersi(res.data.versi);
      prefSet(
        `${CACHE_PREFIX}${jenjang}`,
        JSON.stringify({ versi: res.data.versi, tampilan: res.data.tampilan, ts: Date.now() }),
      ).catch(() => {});
    } catch {
      // Server tak terjangkau: pertahankan cache (jika ada) agar tampilan konsisten.
    } finally {
      setLoading(false);
    }
  }, [user?.id, jenjang]);

  // Tampilkan cache lebih dulu agar tidak berkedip, lalu ambil versi server.
  useEffect(() => {
    if (jenjang == null) {
      setTampilan(null);
      setVersi(0);
      tampilanLembagaRef.current = null;
      return;
    }
    prefGet(`${CACHE_PREFIX}${jenjang}`)
      .then((raw) => {
        if (!raw) return;
        const c = JSON.parse(raw) as { versi?: number; tampilan?: TampilanData | null };
        tampilanLembagaRef.current = jenjang;
        setTampilan(c.tampilan ?? null);
        setVersi(c.versi ?? 0);
      })
      .catch(() => {});
  }, [jenjang]);

  useEffect(() => { void muat(); }, [muat]);

  // Pantau versi: saat jendela kembali fokus & berkala.
  useEffect(() => {
    if (!user || jenjang == null) return;
    let batal = false;
    const cek = async () => {
      if (batal || document.visibilityState === 'hidden') return;
      try {
        const res = await getVersiTampilan(jenjang);
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
  }, [user?.id, jenjang, muat]);

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
  hapusRef.current = hapus;

  const isPribadi = useCallback((key: string) => !!pribadi[key], [pribadi]);

  // Simpan standar lembaga aktif (mode bertindak) — langsung ke DB, debounce.
  const kirimStandar = useCallback(async (data: TampilanData) => {
    if (jenjang == null) return;
    setMenyimpan(true);
    try {
      const res = await putPengaturanTampilan({
        jenjangs: [jenjang],
        sumber_jenjang: jenjang,
        data,
      });
      const row = res.data?.[0];
      if (row) {
        setTampilan(row.tampilan);
        setVersi(row.versi);
        prefSet(
          `${CACHE_PREFIX}${jenjang}`,
          JSON.stringify({ versi: row.versi, tampilan: row.tampilan, ts: Date.now() }),
        ).catch(() => {});
      }
    } catch {
      // Gagal simpan: biarkan nilai lokal; perubahan berikutnya mencoba lagi.
    } finally {
      setMenyimpan(false);
    }
  }, [jenjang]);

  /** Terapkan perubahan ke standar lembaga aktif (hanya saat mode rekam aktif). */
  const simpanKeStandar = useCallback((patch: TampilanData) => {
    if (!(bertindak && rekam)) return;
    const next = gabungTampilan(tampilanRef.current, patch);
    tampilanRef.current = next;
    setTampilan(next);
    if (simpanTimerRef.current) window.clearTimeout(simpanTimerRef.current);
    simpanTimerRef.current = window.setTimeout(() => { void kirimStandar(next); }, SIMPAN_MS);
  }, [bertindak, jenjang, rekam, kirimStandar]);

  useEffect(() => () => {
    if (simpanTimerRef.current) window.clearTimeout(simpanTimerRef.current);
  }, []);

  const value = useMemo<StandarState>(() => ({
    loading,
    versi,
    tampilan,
    bertindak,
    merekam,
    rekam,
    setRekam,
    menyimpan,
    muatUlang: () => void muat(),
    simpanKeStandar,
    pribadi,
    isPribadi,
    tandai,
    hapus,
  }), [loading, versi, tampilan, bertindak, merekam, rekam, setRekam, menyimpan, muat, simpanKeStandar, pribadi, isPribadi, tandai, hapus]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStandarTampilan() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStandarTampilan di luar StandarTampilanProvider');
  return ctx;
}
