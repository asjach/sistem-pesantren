import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';

/** Registri bagian dialog Kelola Tabel / Filter Halaman.
 *
 *  Semua bagian tampil sekaligus (tanpa tab) dan kini memakai satu tombol
 *  Simpan di footer. Tiap bagian mendaftarkan dua hal ke cangkang: status
 *  "kotor" (ada perubahan belum tersimpan) dan fungsi simpannya. */
/** Aksi ikon di kanan judul bagian (mis. "Kembalikan bawaan"). */
export interface AksiBagian {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

/** Hasil simpan satu bagian: `false` = gagal (galat sudah di-toast bagian),
 *  selain itu = sukses. Dipakai cangkang untuk putuskan tutup dialog. */
export type HasilSimpan = boolean | Promise<boolean> | void | Promise<void>;

interface Registri {
  lapor: (id: string, kotor: boolean) => void;
  daftarSimpan: (id: string, simpan: (() => HasilSimpan) | null) => void;
  daftarAksi: (id: string, aksi: AksiBagian | null) => void;
}

const Ctx = createContext<Registri>({ lapor: () => {}, daftarSimpan: () => {}, daftarAksi: () => {} });

export const BagianProvider = Ctx.Provider;

/** Daftarkan bagian ini. Kembalikan `lapor(boolean)` untuk melaporkan status
 *  kotor; `simpan` adalah fungsi simpan bagian (dipanggil tombol Simpan
 *  terpadu). Identitas `simpan` boleh berubah tiap render — yang dipakai
 *  selalu versi terakhir. */
export function useBagian(id: string, simpan: () => HasilSimpan): (kotor: boolean) => void {
  const { lapor, daftarSimpan } = useContext(Ctx);
  const simpanRef = useRef(simpan);
  simpanRef.current = simpan;
  useEffect(() => {
    daftarSimpan(id, () => simpanRef.current());
    return () => daftarSimpan(id, null);
  }, [daftarSimpan, id]);
  return useCallback((kotor: boolean) => lapor(id, kotor), [lapor, id]);
}

/** Daftarkan aksi ikon bagian ini. `onClick` selalu versi terakhir; daftar
 *  ulang hanya saat label/disabled berubah. */
export function useAksiBagian(id: string, aksi: AksiBagian): void {
  const { daftarAksi } = useContext(Ctx);
  const ref = useRef(aksi);
  ref.current = aksi;
  const { label, disabled } = aksi;
  useEffect(() => {
    daftarAksi(id, { label, disabled, onClick: () => ref.current.onClick() });
    return () => daftarAksi(id, null);
  }, [daftarAksi, id, label, disabled]);
}

/** Nilai provider yang stabil untuk cangkang dialog. */
export function useRegistriBagian(
  lapor: (id: string, kotor: boolean) => void,
  daftarSimpan: (id: string, simpan: (() => HasilSimpan) | null) => void,
  daftarAksi: (id: string, aksi: AksiBagian | null) => void,
) {
  return useMemo(() => ({ lapor, daftarSimpan, daftarAksi }), [lapor, daftarSimpan, daftarAksi]);
}
