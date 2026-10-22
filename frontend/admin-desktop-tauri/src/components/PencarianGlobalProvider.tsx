import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCariGlobal } from '@/hooks/useCariGlobal';

interface PencarianGlobalCtx {
  /** Buka halaman hasil; `kueri` (NIS/NIP/nama) dipakai halaman tujuan sebagai
   *  kata kunci pencarian tabelnya. */
  pilih: (target: string, kueri?: string) => void;
}

const Ctx = createContext<PencarianGlobalCtx | null>(null);

/** Navigasi hasil pencarian global + bawa kata kunci ke halaman tujuan.
 *
 *  Kata kunci TIDAK dikosongkan lagi: halaman tujuan memakai `kueri` hasil
 *  (NIS/NIP/nama) sebagai nilai pencariannya, sehingga tabelnya langsung
 *  tersaring. Mengosongkannya dulu justru menghapus saringan yang dipasang
 *  halaman dari parameter `?cari=` (efek adopsi TopBarSearch menimpa nilai
 *  itu dengan string kosong). */
export function PencarianGlobalProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { ubah } = useCariGlobal();

  const pilih = useCallback((target: string, kueri?: string) => {
    ubah((kueri ?? '').trim());
    navigate(target);
  }, [navigate, ubah]);

  return <Ctx.Provider value={{ pilih }}>{children}</Ctx.Provider>;
}

export function usePencarianGlobal() {
  return useContext(Ctx);
}
