import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { prefGet, prefSet, setLembagaAktifHeader, tanpaHeaderPeran } from '@/api/client';
import { isDesktopRoleAllowed, me } from '@/api/auth';
import { listLembaga } from '@/api/master';
import { useAuth } from '@/auth/AuthContext';

/** Lembaga aktif (per perangkat): menentukan standar tampilan & filter awal halaman. */
const KEY = 'simpes_lembaga_aktif';
/** Target "bertindak sebagai lembaga" (peran super_admin, terpisah dari filter). */
const PERAN_KEY = 'simpes_peran_lembaga';

export interface PilihanLembaga {
  id: number;
  nama: string;
  kode: string | null;
}

interface LembagaAktifState {
  loading: boolean;
  /** Filter lembaga (dropdown topbar + filter awal halaman). Bukan peran. */
  lembagaId: number | null;
  lembaga: PilihanLembaga | null;
  pilihan: PilihanLembaga[];
  /** Opsi peran act-as super_admin: SELALU penuh (pilihan menyempit saat bertindak). */
  pilihanPeran: PilihanLembaga[];
  /** Boleh memilih "Semua lembaga" (super_admin / admin tanpa pivot). */
  adaSemua: boolean;
  banyakPilihan: boolean;
  /** Target peran "bertindak sebagai lembaga" (tombol PERAN SEBAGAI + banner). */
  peranId: number | null;
  peran: PilihanLembaga | null;
  /** Sedang "bertindak sebagai lembaga" (super_admin + peran terpilih). */
  bertindak: boolean;
  /** Super_admin EFEKTIF: mati saat bertindak (murni seperti peran yang dijalani). */
  efektifSuper: boolean;
  /** Bertindak sebagai akar pesantren (PST) = admin pesantren: lintas data. */
  bertindakPst: boolean;
  /** Filter lembaga halaman terkunci (satu pilihan saja): bertindak / hanya 1 lembaga. */
  terkunci: boolean;
  /** Ubah filter lembaga (topbar). */
  pilih: (id: number | null) => void;
  /** Ubah peran (banner); sekaligus mengarahkan filter ke lembaga itu. */
  pilihPeran: (id: number | null) => void;
}

const Ctx = createContext<LembagaAktifState | null>(null);

export function LembagaAktifProvider({ children }: { children: ReactNode }) {
  const { user, setUser } = useAuth();
  const [pilihan, setPilihan] = useState<PilihanLembaga[]>([]);
  const [pilihanPeran, setPilihanPeran] = useState<PilihanLembaga[]>([]);
  const [lembagaId, setLembagaId] = useState<number | null>(null);
  const [peranId, setPeranId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
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
        setLembagaId(null);
        setPeranId(null);
        setLoading(false);
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
          daftar = p.data.map((l) => ({ id: l.id, nama: l.nama, kode: l.kode }));
        } catch {
          daftar = [];
        }
        // Opsi peran act-as: selalu penuh agar tombol banner lengkap.
        if (peranSuper) {
          try {
            const p = await tanpaHeaderPeran(() => listLembaga({ per_page: 1000 }));
            daftarPeran = p.data.map((l) => ({ id: l.id, nama: l.nama, kode: l.kode }));
          } catch {
            daftarPeran = [];
          }
        }
      } else {
        daftar = (user.lembagas ?? []).map((l) => ({ id: l.id, nama: l.nama, kode: l.kode }));
      }
      if (!alive) return;
      setPilihan(daftar);
      setPilihanPeran(daftarPeran);

      const simpanan = await prefGet(KEY).catch(() => null);
      let id: number | null;
      if (simpanan === '0' && adaSemua) id = null;
      else if (simpanan && daftar.some((d) => String(d.id) === simpanan)) id = Number(simpanan);
      else id = adaSemua ? null : (daftar[0]?.id ?? null);
      if (!alive) return;
      setLembagaId(id);
      // Pulihkan peran tersimpan (hanya id yang masih valid di daftar).
      const simpananPeran = await prefGet(PERAN_KEY).catch(() => null);
      if (alive && simpananPeran && simpananPeran !== '0' && daftar.some((d) => String(d.id) === simpananPeran)) {
        const pid = Number(simpananPeran);
        setPeranId(pid);
        // Peran pulihan: segarkan izin efektif sekali (tanpa ini tombol
        // berizin super tetap tampil sampai reload; guard anti-loop via ref).
        if (!disegarkan.current) {
          disegarkan.current = true;
          setLembagaAktifHeader(pid);
          me().then((u) => { if (alive && isDesktopRoleAllowed(u)) setUser(u); }).catch(() => {});
        }
      }
      setLoading(false);
    })();

    return () => { alive = false; };
  }, [user, adaSemua]);

  const pilih = useMemo(() => (id: number | null) => {
    setLembagaId(id);
    prefSet(KEY, id == null ? '0' : String(id)).catch(() => {});
  }, []);

  // Mode "bertindak sebagai lembaga" hanya untuk super_admin: header act-as
  // dipasang sinkron saat render agar request anak (halaman) memakainya.
  const superAdmin = !!user?.roles.some((r) => r.name === 'super_admin');
  const pilihPeran = useMemo(() => (id: number | null) => {
    if (!superAdmin) return;
    setPeranId(id);
    prefSet(PERAN_KEY, id == null ? '0' : String(id)).catch(() => {});
    // Berperan sekaligus memfilter ke lembaga itu (filter lama dipertahankan
    // saat kembali ke super_admin).
    if (id != null) {
      setLembagaId(id);
      prefSet(KEY, String(id)).catch(() => {});
    }
    // Header sinkron SEBELUM /me agar izin efektif sesuai peran baru, lalu
    // segarkan user (tanpa ini UI berizin super tetap terbuka sampai reload).
    setLembagaAktifHeader(id);
    me().then((u) => { if (isDesktopRoleAllowed(u)) setUser(u); }).catch(() => {});
  }, [superAdmin, setUser]);
  setLembagaAktifHeader(superAdmin && peranId != null ? peranId : null);

  const value = useMemo<LembagaAktifState>(() => {
    const bertindak = superAdmin && peranId != null;
    const peran = pilihanPeran.find((p) => p.id === peranId)
      ?? pilihan.find((p) => p.id === peranId) ?? null;
    return {
      loading,
      lembagaId,
      lembaga: pilihan.find((p) => p.id === lembagaId) ?? null,
      pilihan,
      pilihanPeran,
      adaSemua,
      banyakPilihan: pilihan.length > 1,
      peranId,
      peran,
      bertindak,
      /** Gerbang kemampuan super: mati total saat bertindak. */
      efektifSuper: superAdmin && !bertindak,
      /** Peran akar pesantren (PST) = admin pesantren: lintas data. */
      bertindakPst: bertindak && (peran?.kode ?? '') === 'PESANTREN',
      // Satu pilihan (atau sedang bertindak) → filter lembaga tak perlu dipilih:
      // nilainya sudah lembaga aktif. Super_admin/admin pesantren tetap bebas.
      terkunci: (superAdmin && peranId != null) || (!adaSemua && pilihan.length === 1),
      pilih,
      pilihPeran,
    };
  }, [loading, lembagaId, pilihan, pilihanPeran, adaSemua, superAdmin, pilih, peranId, pilihPeran]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLembagaAktif() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLembagaAktif di luar LembagaAktifProvider');
  return ctx;
}
