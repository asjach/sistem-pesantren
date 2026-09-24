import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import type { ExcelField } from './excel/types';
import { muatPengaturanHalaman } from '../api/halaman';

/** Kunci filter global di topBar. */
export type KunciFilterGlobal = 'lembaga' | 'tahun_ajaran' | 'semester' | 'tingkat' | 'kelas';

/** Kunci filter yang dikenal dialog Kelola Halaman (sama dengan backend). */
export const KUNCI_FILTER_HALAMAN: KunciFilterGlobal[] = ['lembaga', 'tahun_ajaran', 'semester', 'tingkat', 'kelas'];

/** Tampil bawaan: lembaga/TA/semester selalu; tingkat/kelas hanya bila halaman
 *  memintanya lewat `<PengaturanHalaman>`. */
export const TAMPIL_BAWAAN: Record<KunciFilterGlobal, boolean> = {
  lembaga: true,
  tahun_ajaran: true,
  semester: true,
  tingkat: false,
  kelas: false,
};

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
  bawaan: Record<KunciFilterGlobal, boolean>;
}

/** Event jendela setelah filter halaman tersimpan: penanda halaman memuat
 *  ulang override DB-nya sendiri. */
export const EVENT_HALAMAN_BERUBAH = 'simpes:halaman-berubah';

/** Kunci halaman dari path route (`/daftar-kelas` → `daftar_kelas`,
 *  `/` → `dashboard`, `/psb/pendaftar` → `psb_pendaftar`). */
export function pageKeyDariPath(pathname: string): string {
  const kunci = pathname.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
  return kunci === '' ? 'dashboard' : kunci;
}

interface VisibilitasFilterCtxValue {
  tampil: Record<KunciFilterGlobal, boolean>;
  setTampil: React.Dispatch<React.SetStateAction<Record<KunciFilterGlobal, boolean>>>;
  registrasi: RegistrasiHalaman | null;
  setRegistrasi: React.Dispatch<React.SetStateAction<RegistrasiHalaman | null>>;
}

const Ctx = createContext<VisibilitasFilterCtxValue | null>(null);

export function VisibilitasFilterProvider({ children }: { children: ReactNode }) {
  const [tampil, setTampil] = useState<Record<KunciFilterGlobal, boolean>>(TAMPIL_BAWAAN);
  const [registrasi, setRegistrasi] = useState<RegistrasiHalaman | null>(null);
  const value = useMemo(() => ({ tampil, setTampil, registrasi, setRegistrasi }), [tampil, registrasi]);
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
  tampil,
  tabel = [],
}: {
  tampil: Partial<Record<KunciFilterGlobal, boolean>>;
  tabel?: TabelHalaman[];
}) {
  const ctx = useContext(Ctx);
  const setTampil = ctx?.setTampil;
  const setRegistrasi = ctx?.setRegistrasi;
  const { pathname } = useLocation();
  const pageKey = pageKeyDariPath(pathname);
  const kunci = JSON.stringify(tampil);
  const kunciTabel = JSON.stringify(tabel.map((t) => t.key));
  /** Ref agar registrasi memakai objek `tabel` terbaru tanpa mengulang efek
   *  tiap render (prop inline selalu identitas baru). */
  const tabelRef = useRef(tabel);
  tabelRef.current = tabel;

  useEffect(() => {
    if (!setTampil || !setRegistrasi) return;
    const parsed = JSON.parse(kunci) as Partial<Record<KunciFilterGlobal, boolean>>;
    const bawaan = { ...TAMPIL_BAWAAN, ...parsed };
    setTampil(bawaan);
    setRegistrasi({ pageKey, tabel: tabelRef.current, bawaan });
    let hidup = true;
    // Override DB (bila ada) menang atas bawaan kode; kunci asing diabaikan.
    muatPengaturanHalaman(pageKey)
      .then((res) => {
        if (!hidup) return;
        const bersih: Partial<Record<KunciFilterGlobal, boolean>> = {};
        for (const k of KUNCI_FILTER_HALAMAN) {
          const v = res.data.filter?.[k];
          if (typeof v === 'boolean') bersih[k] = v;
        }
        if (Object.keys(bersih).length > 0) setTampil((prev) => ({ ...prev, ...bersih }));
      })
      .catch(() => {});
    const segarkan = (e: Event) => {
      if ((e as CustomEvent).detail?.pageKey !== pageKey) return;
      muatPengaturanHalaman(pageKey)
        .then((res) => {
          if (!hidup) return;
          const bersih: Partial<Record<KunciFilterGlobal, boolean>> = {};
          for (const k of KUNCI_FILTER_HALAMAN) {
            const v = res.data.filter?.[k];
            if (typeof v === 'boolean') bersih[k] = v;
          }
          setTampil({ ...bawaan, ...bersih });
        })
        .catch(() => {});
    };
    window.addEventListener(EVENT_HALAMAN_BERUBAH, segarkan);
    return () => {
      hidup = false;
      window.removeEventListener(EVENT_HALAMAN_BERUBAH, segarkan);
      setTampil(TAMPIL_BAWAAN);
      setRegistrasi(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setTampil, setRegistrasi, pageKey, kunci, kunciTabel]);

  return null;
}
