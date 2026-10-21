import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/client';
import { muatNavigasiTersembunyi, simpanNavigasiTersembunyi } from '@/api/navigasi';
import { semuaKunciNavigasi } from '@/lib/halaman';

function samaSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const k of a) {
    if (!b.has(k)) return false;
  }

  return true;
}

interface NavigasiVisibilitas {
  tersembunyi: ReadonlySet<string>;
  globalTersembunyi: ReadonlySet<string>;
  mode: 'global' | 'pribadi';
  memuat: boolean;
  jungkit: (kunci: string) => void;
  atur: (kunci: string[], terlihat: boolean) => void;
  reset: () => void;
}

const Ctx = createContext<NavigasiVisibilitas | null>(null);
const FALLBACK: NavigasiVisibilitas = {
  tersembunyi: new Set(),
  globalTersembunyi: new Set(),
  mode: 'global',
  memuat: false,
  jungkit: () => {},
  atur: () => {},
  reset: () => {},
};

/** Visibilitas navigasi global (super_admin) + pilihan pribadi admin. */
export function NavigasiVisibilitasProvider({ children }: { children: ReactNode }) {
  const [globalSet, setGlobalSet] = useState<Set<string>>(new Set());
  const [pribadiSet, setPribadiSet] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'global' | 'pribadi'>('global');
  const [memuat, setMemuat] = useState(true);
  const globalRef = useRef(globalSet);
  const pribadiRef = useRef(pribadiSet);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    let hidup = true;
    muatNavigasiTersembunyi()
      .then((res) => {
        if (!hidup) return;
        const valid = semuaKunciNavigasi();
        const g = new Set(res.global_tersembunyi.filter((k) => valid.has(k)));
        const p = new Set(res.pribadi_tersembunyi.filter((k) => valid.has(k)));
        globalRef.current = g;
        pribadiRef.current = p;
        setGlobalSet(g);
        setPribadiSet(p);
        setMode(res.mode);
      })
      .catch(() => {})
      .finally(() => { if (hidup) setMemuat(false); });

    return () => { hidup = false; };
  }, []);

  const simpan = useCallback(async (
    modeBaru: 'global' | 'pribadi',
    g: Set<string>,
    p: Set<string>,
    sebelumG: Set<string>,
    sebelumP: Set<string>,
  ) => {
    try {
      const res = await simpanNavigasiTersembunyi([...(modeBaru === 'global' ? g : p)]);
      const valid = semuaKunciNavigasi();
      const gBaru = new Set(res.global_tersembunyi.filter((k) => valid.has(k)));
      const pBaru = new Set(res.pribadi_tersembunyi.filter((k) => valid.has(k)));
      globalRef.current = gBaru;
      pribadiRef.current = pBaru;
      setGlobalSet(gBaru);
      setPribadiSet(pBaru);
      setMode(res.mode);
    } catch (e) {
      globalRef.current = sebelumG;
      pribadiRef.current = sebelumP;
      setGlobalSet(sebelumG);
      setPribadiSet(sebelumP);
      toast.error(errorMessage(e));
    }
  }, []);

  const ubah = useCallback((fn: (g: Set<string>, p: Set<string>) => { g: Set<string>; p: Set<string> }) => {
    const modeKini = modeRef.current;
    const sebelumG = globalRef.current;
    const sebelumP = pribadiRef.current;
    const { g, p } = fn(new Set(sebelumG), new Set(sebelumP));

    if (samaSet(g, sebelumG) && samaSet(p, sebelumP)) return;

    globalRef.current = g;
    pribadiRef.current = p;
    setGlobalSet(g);
    setPribadiSet(p);
    void simpan(modeKini, g, p, sebelumG, sebelumP);
  }, [simpan]);

  const efektif = useMemo(
    () => new Set([...globalSet, ...pribadiSet]),
    [globalSet, pribadiSet],
  );

  const value = useMemo<NavigasiVisibilitas>(() => ({
    tersembunyi: efektif,
    globalTersembunyi: globalSet,
    mode,
    memuat,
    jungkit: (kunci) => ubah((g, p) => {
      if (modeRef.current === 'global') {
        if (g.has(kunci)) g.delete(kunci);
        else g.add(kunci);
      } else if (!g.has(kunci)) {
        if (p.has(kunci)) p.delete(kunci);
        else p.add(kunci);
      }

      return { g, p };
    }),
    atur: (kunci, terlihat) => ubah((g, p) => {
      for (const k of kunci) {
        if (modeRef.current === 'global') {
          if (terlihat) g.delete(k);
          else g.add(k);
        } else if (!g.has(k)) {
          if (terlihat) p.delete(k);
          else p.add(k);
        }
      }

      return { g, p };
    }),
    reset: () => ubah((g, p) => {
      if (modeRef.current === 'global') g.clear();
      else p.clear();

      return { g, p };
    }),
  }), [efektif, globalSet, mode, memuat, ubah]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNavigasiVisibilitas(): NavigasiVisibilitas {
  return useContext(Ctx) ?? FALLBACK;
}
