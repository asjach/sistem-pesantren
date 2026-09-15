import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { prefGet, prefSet } from '@/api/client';
import { listLembaga } from '@/api/master';
import { useAuth } from '@/auth/AuthContext';

/** Lembaga aktif (per perangkat): menentukan standar tampilan & filter awal halaman. */
const KEY = 'simpes_lembaga_aktif';

export interface PilihanLembaga {
  id: number;
  nama: string;
  kode: string | null;
}

interface LembagaAktifState {
  loading: boolean;
  lembagaId: number | null;
  lembaga: PilihanLembaga | null;
  pilihan: PilihanLembaga[];
  /** Boleh memilih "Semua lembaga" (super_admin / admin tanpa pivot). */
  adaSemua: boolean;
  banyakPilihan: boolean;
  pilih: (id: number | null) => void;
}

const Ctx = createContext<LembagaAktifState | null>(null);

export function LembagaAktifProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [pilihan, setPilihan] = useState<PilihanLembaga[]>([]);
  const [lembagaId, setLembagaId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const adaSemua = !!user
    && (user.roles.some((r) => r.name === 'super_admin')
      || (user.roles.some((r) => r.name === 'admin') && (user.lembagas?.length ?? 0) === 0));

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!user) {
        setPilihan([]);
        setLembagaId(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      let daftar: PilihanLembaga[] = [];
      if (adaSemua) {
        try {
          const p = await listLembaga({ per_page: 1000 });
          daftar = p.data.map((l) => ({ id: l.id, nama: l.nama, kode: l.kode }));
        } catch {
          daftar = [];
        }
      } else {
        daftar = (user.lembagas ?? []).map((l) => ({ id: l.id, nama: l.nama, kode: l.kode }));
      }
      if (!alive) return;
      setPilihan(daftar);

      const simpanan = await prefGet(KEY).catch(() => null);
      let id: number | null;
      if (simpanan === '0' && adaSemua) id = null;
      else if (simpanan && daftar.some((d) => String(d.id) === simpanan)) id = Number(simpanan);
      else id = adaSemua ? null : (daftar[0]?.id ?? null);
      if (!alive) return;
      setLembagaId(id);
      setLoading(false);
    })();

    return () => { alive = false; };
  }, [user, adaSemua]);

  const pilih = useMemo(() => (id: number | null) => {
    setLembagaId(id);
    prefSet(KEY, id == null ? '0' : String(id)).catch(() => {});
  }, []);

  const value = useMemo<LembagaAktifState>(() => ({
    loading,
    lembagaId,
    lembaga: pilihan.find((p) => p.id === lembagaId) ?? null,
    pilihan,
    adaSemua,
    banyakPilihan: pilihan.length > 1,
    pilih,
  }), [loading, lembagaId, pilihan, adaSemua, pilih]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLembagaAktif() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLembagaAktif di luar LembagaAktifProvider');
  return ctx;
}
