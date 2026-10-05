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
  muatPengaturanTabel,
  type PengaturanTabelData,
} from '../api/pengaturanTabel';
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

/** Satu tabel di halaman (untuk section Kolom/Urutan/Toolbar/Filter dialog
 *  Kelola Tabel). `fields` opsional: tanpa fields, section Kolom diganti
 *  keterangan (mis. tabel dinamis / non-grid). */
export interface TabelHalaman {
  key: string;
  judul?: string;
  fields?: ExcelField[];
}

/** Registrasi halaman aktif: kunci halaman (dari path) + daftar tabel +
 *  bawaan filter kode. Daftar tabel dipakai untuk merge visibilitas filter
 *  topBar (per tabel) dan membuka dialog Kelola Tabel. */
export interface RegistrasiHalaman {
  pageKey: string;
  tabel: TabelHalaman[];
  filterRelevan: readonly KunciFilterGlobal[];
  bawaan: TampilFilterGlobal;
  modeBawaan: ModeSemuaFilterGlobal;
}

/** Event jendela setelah filter sebuah tabel tersimpan: penanda memuat
 *  ulang override DB tabel terkait (`detail.tableKey`). */
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

/** Gabung pengaturan semua tabel halaman (aturan merge): filter tampil bila
 *  ADA tabel yang menghendaki tampil (OR eksplisit; absen = bawaan), mode
 *  `multiple` menang bila ada yang memilihnya. */
export function gabungPengaturanTabel(
  data: Record<string, PengaturanTabelData>,
  kunciTabel: readonly string[],
  filter: readonly KunciFilterGlobal[],
  bawaanTampil: TampilFilterGlobal,
  bawaanMode: ModeSemuaFilterGlobal,
) {
  const tampil = { ...bawaanTampil };
  const mode = { ...bawaanMode };
  for (const kunci of filter) {
    const nilaiTabel = kunciTabel
      .map((k) => data[k]?.filter?.[kunci])
      .filter((v): v is boolean => typeof v === 'boolean');
    if (nilaiTabel.length > 0) tampil[kunci] = nilaiTabel.some(Boolean);

    const modeTabel = kunciTabel
      .map((k) => data[k]?.filter_mode?.[kunci])
      .filter((v): v is ModeFilterGlobal => v === 'single' || v === 'multiple');
    if (modeTabel.includes('multiple')) mode[kunci] = 'multiple';
    else if (modeTabel.length > 0) mode[kunci] = 'single';
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

  /** Kunci DB yang dibaca: tabel halaman, atau page_key untuk halaman tanpa
   *  tabel (mis. Dokumen Santri Lihat). */
  const kunciBaca = useMemo(() => {
    const tabel = registrasiAktif?.tabel.map((t) => t.key) ?? [];
    return tabel.length > 0 ? [...tabel] : [pageKey];
  }, [registrasiAktif, pageKey]);
  const kunciBacaRef = useRef(kunciBaca);
  kunciBacaRef.current = kunciBaca;

  useEffect(() => {
    const relevan = registrasiAktif?.filterRelevan ?? konfigurasi.filter;
    const bawaan = registrasiAktif?.bawaan ?? konfigurasi.tampil;
    const modeBawaan = registrasiAktif?.modeBawaan ?? konfigurasi.mode;

    setTampil({ ...bawaan });
    setMode({ ...modeBawaan });
    setPageSiap(null);
    setRegistrasi((saatIni) => saatIni?.pageKey === pageKey ? saatIni : null);

    let hidup = true;
    const muat = () => {
      setPageSiap(null);
      const keys = kunciBacaRef.current;
      return muatPengaturanTabel(keys)
        .then((res) => {
          if (!hidup) return;
          const hasil = gabungPengaturanTabel(res.data, keys, relevan, bawaan, modeBawaan);
          setTampil(hasil.tampil);
          setMode(hasil.mode);
        })
        .catch(() => {})
        .finally(() => {
          if (hidup) setPageSiap(pageKey);
        });
    };

    void muat();
    const segarkan = (e: Event) => {
      const tableKey = (e as CustomEvent).detail?.tableKey;
      if (tableKey === pageKey || kunciBacaRef.current.includes(tableKey)) void muat();
    };
    window.addEventListener(EVENT_HALAMAN_BERUBAH, segarkan);
    return () => {
      hidup = false;
      window.removeEventListener(EVENT_HALAMAN_BERUBAH, segarkan);
    };
  }, [pageKey, konfigurasi, registrasiAktif]);

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
 *  + tombol Kelola Tabel). */
export function useVisibilitasFilter() {
  return useContext(Ctx);
}

/** Deklarasikan pengaturan halaman ini: filter relevan (bawaan kode), daftar
 *  tabel (kunci merge filter + dialog Kelola Tabel), dan override `tampil`.
 *  Kembali ke bawaan otomatis saat halaman unmount. */
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
  }, [setRegistrasi, pageKey, konfigurasi, kunci, kunciTabel]);

  return null;
}
