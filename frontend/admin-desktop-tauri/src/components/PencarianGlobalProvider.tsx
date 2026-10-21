import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCariGlobal } from '@/hooks/useCariGlobal';

interface PencarianGlobalCtx {
  pilih: (target: string) => void;
}

const Ctx = createContext<PencarianGlobalCtx | null>(null);

/** Navigasi hasil pencarian global + bersihkan kata kunci TopBar. */
export function PencarianGlobalProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { ubah } = useCariGlobal();

  const pilih = useCallback((target: string) => {
    ubah('');
    navigate(target);
  }, [navigate, ubah]);

  return <Ctx.Provider value={{ pilih }}>{children}</Ctx.Provider>;
}

export function usePencarianGlobal() {
  return useContext(Ctx);
}
