import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { prefGet, prefSet, setLembagaAktifHeader, tanpaHeaderPeran } from '@/api/client';
import { isDesktopRoleAllowed, me } from '@/api/auth';
import { listLembaga } from '@/api/master';
import { useAuth } from '@/auth/AuthContext';

/** Lembaga aktif (per perangkat): menentukan standar tampilan & filter awal halaman. */
const KEY = 'simpes_lembaga_aktif_v2';
/** Target "bertindak sebagai lembaga" (peran super_admin, terpisah dari filter). */
const PERAN_KEY = 'simpes_peran_lembaga_v2';

export interface PilihanLembaga {
  /** Kunci alami lembaga (mis. MI/MD/MTS/MLN). */
  jenjang: string;
  nama: string;
}

interface LembagaAktifState {
  loading: boolean;
  /** Filter lembaga (dropdown topbar + filter awal halaman). Bukan peran. */
  jenjang: string | null;
  lembaga: PilihanLembaga | null;
  pilihan: PilihanLembaga[];
  /** Opsi peran act-as super_admin: SELALU penuh (pilihan menyempit saat bertindak). */
  pilihanPeran: PilihanLembaga[];
  /** Boleh memilih "Semua lembaga" (super_admin / admin tanpa pivot). */
  adaSemua: boolean;
  banyakPilihan: boolean;
  /** Target peran "bertindak sebagai lembaga" (tombol PERAN SEBAGAI + banner). */
  peranJenjang: string | null;
  peran: PilihanLembaga | null;
  /** Sedang "bertindak sebagai lembaga" (super_admin + peran terpilih). */
  bertindak: boolean;
  /** Super_admin EFEKTIF: mati saat bertindak (murni seperti peran yang dijalani). */
  efektifSuper: boolean;
  /** Filter lembaga halaman terkunci (satu pilihan saja): bertindak / hanya 1 lembaga. */
  terkunci: boolean;
  /** Ubah filter lembaga (topbar). */
  pilih: (jenjang: string | null) => void;
  /** Ubah peran (banner); sekaligus mengarahkan filter ke lembaga itu. */
  pilihPeran: (jenjang: string | null) => void;
}

const Ctx = createContext<LembagaAktifState | null>(null);

export function LembagaAktifProvider({ children }: { children: ReactNode }) {
  const { user, setUser } = useAuth();
  const [pilihan, setPilihan] = useState<PilihanLembaga[]>([]);
  const [pilihanPeran, setPilihanPeran] = useState<PilihanLembaga[]>([]);
  const [jenjang, setJenjang] = useState<string | null>(null);
  const [peranJenjang, setPeranJenjang] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /** Izin efektif (/me) sudah disegarkan untuk peran pulihan (sekali saja). */
  const disegarkan = useRef(false);
  // Ganti akun → izinkan penyegaran ulang untuk peran pulihan akun baru.
  const idPengguna = user?.id ?? null;
  useEffect(() => { disegarkan.current = false; }, [idPengguna]);

  const adaSemua = !!user
    && (user.roles.some((r) => r.name === 'super_admin')
      || (user.roles.some((r) => r.name === 'admin') && (user.lembagas?.length ?? 0) === 0));

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!user) {
        setPilihan([]);
        setPilihanPeran([]);
        setJenjang(null);
        setPeranJenjang(null);
        // `loading` sengaja TIDAK dimatikan di sini: selama user belum ada,
        // provider anak (tahun ajaran/TopBar) harus tetap menunggu agar tidak
        // memuat untuk state perantara ("Semua" lalu jenjang terpilih).
        return;
      }

      setLoading(true);
      const peranSuper = user.roles.some((r) => r.name === 'super_admin');
      let daftar: PilihanLembaga[] = [];
      let daftarPeran: PilihanLembaga[] = [];
      if (adaSemua) {
        try {
          // Opsi filter: ikut scope header (menyempit ke peran saat bertindak).
          const p = await listLembaga({ per_page: 1000 });
          daftar = p.data.map((l) => ({ jenjang: l.jenjang, nama: l.nama }));
        } catch {
          daftar = [];
        }
        // Opsi peran act-as: selalu penuh agar tombol banner lengkap.
        if (peranSuper) {
          try {
            const p = await tanpaHeaderPeran(() => listLembaga({ per_page: 1000 }));
            daftarPeran = p.data.map((l) => ({ jenjang: l.jenjang, nama: l.nama }));
          } catch {
            daftarPeran = [];
          }
        }
      } else {
        daftar = (user.lembagas ?? []).map((l) => ({ jenjang: l.jenjang, nama: l.nama }));
      }
      if (!alive) return;
      setPilihan(daftar);
      setPilihanPeran(daftarPeran);

      const simpanan = await prefGet(KEY).catch(() => null);
      let terpilih: string | null;
      if (simpanan === '0' && adaSemua) terpilih = null;
      else if (simpanan && daftar.some((d) => d.jenjang === simpanan)) terpilih = simpanan;
      else terpilih = adaSemua ? null : (daftar[0]?.jenjang ?? null);
      if (!alive) return;
      setJenjang(terpilih);
      // Pulihkan peran tersimpan (hanya jenjang yang masih valid di daftar).
      const simpananPeran = await prefGet(PERAN_KEY).catch(() => null);
      if (alive && simpananPeran && simpananPeran !== '0' && daftar.some((d) => d.jenjang === simpananPeran)) {
        setPeranJenjang(simpananPeran);
        // Peran pulihan: segarkan izin efektif sekali (tanpa ini tombol
        // berizin super tetap tampil sampai reload; guard anti-loop via ref).
        if (!disegarkan.current) {
          disegarkan.current = true;
          setLembagaAktifHeader(simpananPeran);
          me().then((u) => { if (alive && isDesktopRoleAllowed(u)) setUser(u); }).catch(() => {});
        }
      }
      setLoading(false);
    })();

    return () => { alive = false; };
  }, [user, adaSemua]);

  const pilih = useMemo(() => (jenjangBaru: string | null) => {
    setJenjang(jenjangBaru);
    prefSet(KEY, jenjangBaru == null ? '0' : jenjangBaru).catch(() => {});
  }, []);

  // Mode "bertindak sebagai lembaga" hanya untuk super_admin: header act-as
  // dipasang sinkron saat render agar request anak (halaman) memakainya.
  const superAdmin = !!user?.roles.some((r) => r.name === 'super_admin');
  const pilihPeran = useMemo(() => (jenjangBaru: string | null) => {
    if (!superAdmin) return;
    setPeranJenjang(jenjangBaru);
    prefSet(PERAN_KEY, jenjangBaru == null ? '0' : jenjangBaru).catch(() => {});
    // Berperan sekaligus memfilter ke lembaga itu (filter lama dipertahankan
    // saat kembali ke super_admin).
    if (jenjangBaru != null) {
      setJenjang(jenjangBaru);
      prefSet(KEY, jenjangBaru).catch(() => {});
    }
    // Header sinkron SEBELUM /me agar izin efektif sesuai peran baru, lalu
    // segarkan user (tanpa ini UI berizin super tetap terbuka sampai reload).
    setLembagaAktifHeader(jenjangBaru);
    me().then((u) => { if (isDesktopRoleAllowed(u)) setUser(u); }).catch(() => {});
  }, [superAdmin, setUser]);
  setLembagaAktifHeader(superAdmin && peranJenjang != null ? peranJenjang : null);

  const value = useMemo<LembagaAktifState>(() => {
    const bertindak = superAdmin && peranJenjang != null;
    const peran = pilihanPeran.find((p) => p.jenjang === peranJenjang)
      ?? pilihan.find((p) => p.jenjang === peranJenjang) ?? null;
    return {
      loading,
      jenjang,
      lembaga: pilihan.find((p) => p.jenjang === jenjang) ?? null,
      pilihan,
      pilihanPeran,
      adaSemua,
      banyakPilihan: pilihan.length > 1,
      peranJenjang,
      peran,
      bertindak,
      /** Gerbang kemampuan super: mati total saat bertindak. */
      efektifSuper: superAdmin && !bertindak,
      // Satu pilihan (atau sedang bertindak) → filter lembaga tak perlu dipilih:
      // nilainya sudah lembaga aktif. Super_admin/admin pesantren tetap bebas.
      terkunci: (superAdmin && peranJenjang != null) || (!adaSemua && pilihan.length === 1),
      pilih,
      pilihPeran,
    };
  }, [loading, jenjang, pilihan, pilihanPeran, adaSemua, superAdmin, pilih, peranJenjang, pilihPeran]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLembagaAktif() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLembagaAktif di luar LembagaAktifProvider');
  return ctx;
}
