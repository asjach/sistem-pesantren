import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';

/** Jalankan perubahan konteks setelah draft halaman diselesaikan atau dibuang.
 *  Tanpa halaman yang mendaftar, perubahan langsung dijalankan. */
export type MintaJalan = (tujuan: string, jalankan: () => void) => void;

interface DraftGuard {
  daftarkan: (mintaJalan: MintaJalan) => () => void;
  mintaJalan: MintaJalan;
}

const Ctx = createContext<DraftGuard | null>(null);

/** Penjaga perubahan konteks global (filter TopBar/rail, peran) agar halaman
 *  bertabel yang punya draft bisa meminta penyelesaian lebih dulu. */
export function DraftGuardProvider({ children }: { children: ReactNode }) {
  const aktifRef = useRef<MintaJalan | null>(null);

  const daftarkan = useCallback((mintaJalan: MintaJalan) => {
    aktifRef.current = mintaJalan;
    return () => {
      if (aktifRef.current === mintaJalan) aktifRef.current = null;
    };
  }, []);

  const mintaJalan = useCallback<MintaJalan>((tujuan, jalankan) => {
    const aktif = aktifRef.current;
    if (aktif) aktif(tujuan, jalankan);
    else jalankan();
  }, []);

  const value = useMemo<DraftGuard>(() => ({ daftarkan, mintaJalan }), [daftarkan, mintaJalan]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Untuk halaman: `null` bila provider tidak dipasang (mis. tes komponen). */
export function useDraftGuard(): DraftGuard | null {
  return useContext(Ctx);
}

/** Untuk kontrol global: tetap jalan langsung bila tak ada halaman berpenjaga. */
export function useMintaJalan(): MintaJalan {
  const ctx = useContext(Ctx);
  return useCallback<MintaJalan>((tujuan, jalankan) => {
    if (ctx) ctx.mintaJalan(tujuan, jalankan);
    else jalankan();
  }, [ctx]);
}
