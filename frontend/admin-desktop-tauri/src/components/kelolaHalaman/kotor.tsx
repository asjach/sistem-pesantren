import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';

/** Registri bagian dialog Kelola Halaman.
 *
 *  Semua bagian tampil sekaligus (tanpa tab) dan kini memakai satu tombol
 *  Simpan di footer. Tiap bagian mendaftarkan dua hal ke cangkang: status
 *  "kotor" (ada perubahan belum tersimpan) dan fungsi simpannya. */
interface Registri {
  lapor: (id: string, kotor: boolean) => void;
  daftarSimpan: (id: string, simpan: (() => void) | null) => void;
}

const Ctx = createContext<Registri>({ lapor: () => {}, daftarSimpan: () => {} });

export const BagianProvider = Ctx.Provider;

/** Daftarkan bagian ini. Kembalikan `lapor(boolean)` untuk melaporkan status
 *  kotor; `simpan` adalah fungsi simpan bagian (dipanggil tombol Simpan
 *  terpadu). Identitas `simpan` boleh berubah tiap render — yang dipakai
 *  selalu versi terakhir. */
export function useBagian(id: string, simpan: () => void): (kotor: boolean) => void {
  const { lapor, daftarSimpan } = useContext(Ctx);
  const simpanRef = useRef(simpan);
  simpanRef.current = simpan;
  useEffect(() => {
    daftarSimpan(id, () => simpanRef.current());
    return () => daftarSimpan(id, null);
  }, [daftarSimpan, id]);
  return useCallback((kotor: boolean) => lapor(id, kotor), [lapor, id]);
}

/** Nilai provider yang stabil untuk cangkang dialog. */
export function useRegistriBagian(
  lapor: (id: string, kotor: boolean) => void,
  daftarSimpan: (id: string, simpan: (() => void) | null) => void,
) {
  return useMemo(() => ({ lapor, daftarSimpan }), [lapor, daftarSimpan]);
}
