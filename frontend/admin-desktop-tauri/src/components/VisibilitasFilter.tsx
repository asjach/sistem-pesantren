import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useLocation } from 'react-router-dom';
import type { ExcelField } from './excel/types';
import {
  TAMPIL_BAWAAN_GLOBAL,
  konfigurasiFilterHalaman,
  tampilEfektifFilterHalaman,
  type KunciFilterGlobal,
  type ModeFilterGlobal,
  type ModeSemuaFilterGlobal,
  type TampilFilterGlobal,
} from '@/lib/filterHalaman';

/** Kunci filter global di topBar. */
export type { KunciFilterGlobal, ModeFilterGlobal };

/** Tampil bawaan: lembaga/TA/semester selalu; tingkat/kelas hanya bila halaman
 *  memintanya lewat `<PengaturanHalaman>`. */
export const TAMPIL_BAWAAN = TAMPIL_BAWAAN_GLOBAL;

/** Satu tabel di halaman (untuk section Kolom/Urutan/Toolbar dialog Kelola
 *  Tabel). `fields` opsional: tanpa fields, section Kolom diganti keterangan
 *  (mis. tabel dinamis / non-grid). */
export interface TabelHalaman {
  key: string;
  judul?: string;
  fields?: ExcelField[];
}

/** Registrasi halaman aktif: kunci halaman (dari path) + daftar tabel +
 *  bawaan filter kode. Daftar tabel dipakai untuk membuka dialog Kelola Tabel. */
export interface RegistrasiHalaman {
  pageKey: string;
  tabel: TabelHalaman[];
  filterRelevan: readonly KunciFilterGlobal[];
  bawaan: TampilFilterGlobal;
  modeBawaan: ModeSemuaFilterGlobal;
}

/** Kunci halaman dari path route (`/daftar-kelas` → `daftar_kelas`,
 *  `/` → `dashboard`, `/psb/pendaftar` → `psb_pendaftar`). */
export function pageKeyDariPath(pathname: string): string {
  const kunci = pathname.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
  return kunci === '' ? 'dashboard' : kunci;
}

interface VisibilitasFilterCtxValue {
  tampil: TampilFilterGlobal;
  setTampil: Dispatch<SetStateAction<TampilFilterGlobal>>;
  mode: ModeSemuaFilterGlobal;
  setMode: Dispatch<SetStateAction<ModeSemuaFilterGlobal>>;
  siap: boolean;
  filterRelevan: readonly KunciFilterGlobal[];
  registrasi: RegistrasiHalaman | null;
  setRegistrasi: Dispatch<SetStateAction<RegistrasiHalaman | null>>;
}

const Ctx = createContext<VisibilitasFilterCtxValue | null>(null);

/** Visibilitas filter topBar — MURNI dari kode: bawaan tiap halaman
 *  (`KONFIGURASI_FILTER_HALAMAN`) dengan override `<PengaturanHalaman
 *  tampil={...}>`. Tidak ada lapisan DB: dulu setelan ini bisa disimpan di
 *  `pengaturan_tabel`, tetapi tak pernah dipakai (semua baris kosong) dan
 *  sudah dihapus. */
export function VisibilitasFilterProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const pageKey = pageKeyDariPath(pathname);
  const konfigurasi = useMemo(() => konfigurasiFilterHalaman(pageKey), [pageKey]);
  const [tampil, setTampil] = useState<TampilFilterGlobal>(konfigurasi.tampil);
  const [mode, setMode] = useState<ModeSemuaFilterGlobal>(konfigurasi.mode);
  const [registrasi, setRegistrasi] = useState<RegistrasiHalaman | null>(null);
  const fallback = useMemo<RegistrasiHalaman | null>(() => (
    konfigurasi.filter.length > 0 ? {
      pageKey,
      tabel: [],
      filterRelevan: konfigurasi.filter,
      bawaan: { ...konfigurasi.tampil },
      modeBawaan: { ...konfigurasi.mode },
    } : null
  ), [pageKey, konfigurasi]);
  const registrasiAktif = registrasi?.pageKey === pageKey ? registrasi : fallback;

  useEffect(() => {
    const relevan = registrasiAktif?.filterRelevan ?? konfigurasi.filter;
    const bawaan = registrasiAktif?.bawaan ?? konfigurasi.tampil;
    const modeBawaan = registrasiAktif?.modeBawaan ?? konfigurasi.mode;

    setTampil({ ...bawaan });
    setMode({ ...modeBawaan });
    setRegistrasi((saatIni) => saatIni?.pageKey === pageKey ? saatIni : null);
  }, [pageKey, konfigurasi, registrasiAktif]);

  const value = useMemo(() => ({
    tampil,
    setTampil,
    mode,
    setMode,
    siap: true,
    filterRelevan: registrasiAktif?.filterRelevan ?? [],
    registrasi: registrasiAktif,
    setRegistrasi,
  }), [tampil, mode, pageKey, registrasiAktif]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Konteks visibilitas (dipakai TopBar untuk memutuskan filter yang tampil
 *  + tombol Kelola Tabel). */
export function useVisibilitasFilter() {
  return useContext(Ctx);
}

/** Deklarasikan pengaturan halaman ini: daftar tabel (untuk dialog Kelola
 *  Tabel) dan override `tampil`. Kembali ke bawaan otomatis saat halaman
 *  unmount. */
export function PengaturanHalaman({
  tampil = {},
  tabel = [],
}: {
  tampil?: Partial<TampilFilterGlobal>;
  tabel?: TabelHalaman[];
}) {
  const ctx = useContext(Ctx);
  const setRegistrasi = ctx?.setRegistrasi;
  const { pathname } = useLocation();
  const pageKey = pageKeyDariPath(pathname);
  const konfigurasi = konfigurasiFilterHalaman(pageKey);
  const kunci = JSON.stringify(tampil);
  // Kunci registrasi mencakup susunan field: perubahan kolom tanpa ganti
  // key tabel (mis. rename key field) wajib mendaftarkan ulang agar section
  // Kolom/Urutan di dialog Kelola Tabel selalu sinkron dengan halaman.
  const kunciTabel = JSON.stringify(tabel.map((t) => `${t.key}:${(t.fields ?? []).map((f) => f.key).join(',')}`));
  const tabelRef = useRef(tabel);
  tabelRef.current = tabel;
  const kunciLengkap = `${kunci}|${kunciTabel}`;

  useEffect(() => {
    if (!setRegistrasi) return;
    const perubahan = JSON.parse(kunci) as Partial<TampilFilterGlobal>;
    const bawaan = tampilEfektifFilterHalaman(konfigurasi, perubahan);
    const modeBawaan = { ...konfigurasi.mode };
    setRegistrasi({
      pageKey,
      tabel: tabelRef.current,
      filterRelevan: konfigurasi.filter,
      bawaan,
      modeBawaan,
    });

    return () => {
      setRegistrasi(null);
    };
  }, [setRegistrasi, pageKey, konfigurasi, kunciLengkap]);

  return null;
}
