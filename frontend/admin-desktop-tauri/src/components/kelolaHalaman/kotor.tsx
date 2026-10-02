import { createContext, useContext } from 'react';

/** Pelaporan "ada perubahan belum tersimpan" dari tab dialog ke cangkangnya.
 *
 *  Tiap tab menyimpan draf lokal; cangkang perlu tahu apakah draf itu berbeda
 *  dari yang tersimpan, supaya menutup dialog atau berpindah tab tidak
 *  membuang perubahan diam-diam. Tab memanggil `laporKotor(true)` saat ada
 *  perubahan dan `laporKotor(false)` saat kembali bersih. */
const KotorCtx = createContext<(kotor: boolean) => void>(() => {});

export const KotorProvider = KotorCtx.Provider;

export function useLaporKotor(): (kotor: boolean) => void {
  return useContext(KotorCtx);
}
