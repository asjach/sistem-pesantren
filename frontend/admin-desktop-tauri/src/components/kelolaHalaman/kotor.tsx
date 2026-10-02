import { createContext, useCallback, useContext, useEffect } from 'react';

/** Pelaporan "ada perubahan belum tersimpan" dari bagian dialog ke cangkangnya.
 *
 *  Semua bagian kini tampil sekaligus (tanpa tab), jadi cangkang perlu tahu
 *  status tiap bagian dan menggabungkannya: satu bagian kotor = dialog kotor.
 *  Tiap bagian memakai {@link useLaporKotor} dengan id unik. */
type Lapor = (id: string, kotor: boolean) => void;

const KotorCtx = createContext<Lapor>(() => {});

export const KotorProvider = KotorCtx.Provider;

/** Kembalikan pelapor untuk bagian ini. Panggil `lapor(boolean)` saat status
 *  berubah; saat komponen dilepas, entrinya otomatis dibersihkan. */
export function useLaporKotor(id: string): (kotor: boolean) => void {
  const lapor = useContext(KotorCtx);
  const kirim = useCallback((kotor: boolean) => lapor(id, kotor), [lapor, id]);
  useEffect(() => () => lapor(id, false), [lapor, id]);
  return kirim;
}
