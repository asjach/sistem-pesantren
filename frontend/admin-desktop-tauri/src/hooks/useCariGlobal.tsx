import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { prefGet, prefSet } from '@/api/client';

/** Kunci persistensi nilai pencarian global (per perangkat, pola pager/sidebar). */
const KUNCI_CARI_GLOBAL = 'simpes_cari_global';

interface CariGlobalCtxValue {
  nilai: string;
  ubah: (v: string) => void;
}

const Ctx = createContext<CariGlobalCtxValue | null>(null);

/** Store satu nilai pencarian untuk seluruh halaman (plus persistensi per perangkat).
 *  Halaman tetap memakai state lokalnya masing-masing; `TopBarSearch`
 *  mengadopsi nilai ini saat dipasang dan menulis balik tiap ketikan. */
export function CariGlobalProvider({ children }: { children: ReactNode }) {
  const [nilai, setNilai] = useState('');
  useEffect(() => {
    let hidup = true;
    prefGet(KUNCI_CARI_GLOBAL)
      .then((v) => { if (hidup && typeof v === 'string') setNilai(v); })
      .catch(() => {});
    return () => { hidup = false; };
  }, []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const ubah = useCallback((v: string) => {
    setNilai(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { prefSet(KUNCI_CARI_GLOBAL, v).catch(() => {}); }, 500);
  }, []);
  const value = useMemo(() => ({ nilai, ubah }), [nilai, ubah]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Nilai pencarian global ('' bila provider belum terpasang — tak pernah null). */
export function useCariGlobal(): CariGlobalCtxValue {
  return useContext(Ctx) ?? { nilai: '', ubah: () => {} };
}
