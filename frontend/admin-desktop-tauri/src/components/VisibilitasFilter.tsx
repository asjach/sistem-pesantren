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
  muatPengaturanHalaman,
  type PengaturanHalamanData,
} from '../api/halaman';
import {
  KUNCI_FILTER_GLOBAL,
  TAMPIL_BAWAAN_GLOBAL,
  konfigurasiFilterHalaman,
  tampilEfektifFilterHalaman,
  type KunciFilterGlobal,
  type KonfigurasiFilterHalaman,
  type ModeFilterGlobal,
  type ModeSemuaFilterGlobal,
  type TampilFilterGlobal,
} from '@/lib/filterHalaman';

/** Kunci filter global di topBar. */
export type { KunciFilterGlobal, ModeFilterGlobal };

/** Kunci filter yang dikenal dialog Kelola Halaman (sama dengan backend). */
export const KUNCI_FILTER_HALAMAN = KUNCI_FILTER_GLOBAL;

/** Tampil bawaan: lembaga/TA/semester selalu; tingkat/kelas hanya bila halaman
 *  memintanya lewat `<PengaturanHalaman>`. */
export const TAMPIL_BAWAAN = TAMPIL_BAWAAN_GLOBAL;

/** Satu tabel di halaman (untuk tab Kolom/Urutan/Toolbar dialog Kelola
 *  Halaman). `fields` opsional: tanpa fields, tab Kolom disembunyikan
 *  untuk tabel itu (mis. tabel dinamis / non-grid). */
export interface TabelHalaman {
  key: string;
  judul?: string;
  fields?: ExcelField[];
}

/** Registrasi halaman aktif: kunci halaman (dari path) + daftar tabel +
 *  bawaan filter kode (untuk tab Filter dialog). */
export interface RegistrasiHalaman {
  pageKey: string;
  tabel: TabelHalaman[];
  filterRelevan: readonly KunciFilterGlobal[];
  bawaan: TampilFilterGlobal;
  modeBawaan: ModeSemuaFilterGlobal;
}

/** Event jendela setelah filter halaman tersimpan: penanda halaman memuat
 *  ulang override DB-nya sendiri. */
export const EVENT_HALAMAN_BERUBAH = 'simpes:halaman-berubah';
export const EVENT_KELOLA_HALAMAN = 'simpes:kelola-halaman';

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

function gabungkanPengaturan(
  data: PengaturanHalamanData,
  filter: readonly KunciFilterGlobal[],
  bawaanTampil: TampilFilterGlobal,
  bawaanMode: ModeSemuaFilterGlobal,
) {
  const tampil = { ...bawaanTampil };
  const mode = { ...bawaanMode };
  for (const kunci of filter) {
    const tampilTersimpan = data.filter[kunci];
    const modeTersimpan = data.filter_mode[kunci];
    if (typeof tampilTersimpan === 'boolean') tampil[kunci] = tampilTersimpan;
    if (modeTersimpan === 'single' || modeTersimpan === 'multiple') mode[kunci] = modeTersimpan;
  }
  return { tampil, mode };
}

const Ctx = createContext<VisibilitasFilterCtxValue | null>(null);

export function VisibilitasFilterProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const pageKey = pageKeyDariPath(pathname);
  const konfigurasi = useMemo(() => konfigurasiFilterHalaman(pageKey), [pageKey]);
  const [tampil, setTampil] = useState<TampilFilterGlobal>(konfigurasi.tampil);
  const [mode, setMode] = useState<ModeSemuaFilterGlobal>(konfigurasi.mode);
  const [pageSiap, setPageSiap] = useState<string | null>(null);
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
    setTampil({ ...konfigurasi.tampil });
    setMode({ ...konfigurasi.mode });
    setPageSiap(null);
    setRegistrasi((saatIni) => saatIni?.pageKey === pageKey ? saatIni : null);

    let hidup = true;
    const muat = () => {
      setPageSiap(null);
      return muatPengaturanHalaman(pageKey)
        .then((res) => {
          if (!hidup) return;
          const hasil = gabungkanPengaturan(
            res.data,
            konfigurasi.filter,
            konfigurasi.tampil,
            konfigurasi.mode,
          );
          setTampil(hasil.tampil);
          setMode(hasil.mode);
        })
        .catch(() => {})
        .finally(() => {
          if (hidup) setPageSiap(pageKey);
        });
    };

    muat();
    const segarkan = (e: Event) => {
      if ((e as CustomEvent).detail?.pageKey === pageKey) muat();
    };
    window.addEventListener(EVENT_HALAMAN_BERUBAH, segarkan);
    return () => {
      hidup = false;
      window.removeEventListener(EVENT_HALAMAN_BERUBAH, segarkan);
    };
  }, [pageKey, konfigurasi]);

  const value = useMemo(() => ({
    tampil,
    setTampil,
    mode,
    setMode,
    siap: pageSiap === pageKey,
    filterRelevan: registrasiAktif?.filterRelevan ?? [],
    registrasi: registrasiAktif,
    setRegistrasi,
  }), [tampil, mode, pageSiap, pageKey, registrasiAktif]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Konteks visibilitas (dipakai TopBar untuk memutuskan filter yang tampil
 *  + tombol Kelola Halaman). */
export function useVisibilitasFilter() {
  return useContext(Ctx);
}

/** Deklarasikan pengaturan halaman ini: filter yang tampil (bawaan kode),
 *  daftar tabel untuk dialog Kelola Halaman, dan override visibilitas dari
 *  DB bila ada. Kembali ke bawaan otomatis saat halaman unmount. */
export function PengaturanHalaman({
  tampil = {},
  tabel = [],
}: {
  tampil?: Partial<TampilFilterGlobal>;
  tabel?: TabelHalaman[];
}) {
  const ctx = useContext(Ctx);
  const setTampil = ctx?.setTampil;
  const setMode = ctx?.setMode;
  const setRegistrasi = ctx?.setRegistrasi;
  const { pathname } = useLocation();
  const pageKey = pageKeyDariPath(pathname);
  const konfigurasi = konfigurasiFilterHalaman(pageKey);
  const kunci = JSON.stringify(tampil);
  // Kunci registrasi mencakup susunan field: perubahan kolom tanpa ganti
  // key tabel (mis. rename key field) wajib mendaftarkan ulang agar tab
  // Kolom/Urutan di dialog Kelola Halaman selalu sinkron dengan halaman.
  const kunciTabel = JSON.stringify(tabel.map((t) => `${t.key}:${(t.fields ?? []).map((f) => f.key).join(',')}`));
  const tabelRef = useRef(tabel);
  tabelRef.current = tabel;

  useEffect(() => {
    if (!setTampil || !setMode || !setRegistrasi) return;
    const perubahan = JSON.parse(kunci) as Partial<TampilFilterGlobal>;
    const bawaan = tampilEfektifFilterHalaman(konfigurasi, perubahan);
    const modeBawaan = { ...konfigurasi.mode };
    setTampil(bawaan);
    setMode(modeBawaan);
    setRegistrasi({
      pageKey,
      tabel: tabelRef.current,
      filterRelevan: konfigurasi.filter,
      bawaan,
      modeBawaan,
    });

    let hidup = true;
    const muat = () => muatPengaturanHalaman(pageKey)
      .then((res) => {
        if (!hidup) return;
        const hasil = gabungkanPengaturan(res.data, konfigurasi.filter, bawaan, modeBawaan);
        setTampil(hasil.tampil);
        setMode(hasil.mode);
      })
      .catch(() => {});

    muat();
    const segarkan = (e: Event) => {
      if ((e as CustomEvent).detail?.pageKey === pageKey) muat();
    };
    window.addEventListener(EVENT_HALAMAN_BERUBAH, segarkan);
    return () => {
      hidup = false;
      window.removeEventListener(EVENT_HALAMAN_BERUBAH, segarkan);
      setRegistrasi(null);
    };
  }, [setTampil, setMode, setRegistrasi, pageKey, konfigurasi, kunci, kunciTabel]);

  return null;
}
