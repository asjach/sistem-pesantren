import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { prefGet, prefSet } from '@/api/client';
import { listTahunAjaran, type TahunAjaran } from '@/api/master';
import { useLembagaAktif } from '@/lembagaAktif';
import { useAuth } from '@/auth/AuthContext';

/** Tahun ajaran aktif (per perangkat): default filter tahun ajaran halaman.
 *  Daftarnya mengikuti lembaga aktif; nilainya dipakai halaman sebagai
 *  filter tetap (tanpa dropdown di bar filter halaman).
 *  Nilai = nama TA (kunci alami), mis. '2026/2027'. */
const KEY = 'simpes_tahun_ajaran_aktif';

interface TahunAjaranAktifState {
  loading: boolean;
  tahunAjaranNames: string[];
  tahunAjaranNama: string | null;
  tahunAjaran: TahunAjaran | null;
  pilihan: TahunAjaran[];
  pilih: (nama: string | null) => void;
  pilihBanyak: (nama: string[]) => void;
}

function normalisasiNamaAktif(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function bacaNamaAktif(simpanan: string | null): string[] {
  if (!simpanan || simpanan === '0') return [];
  try {
    const parsed: unknown = JSON.parse(simpanan);
    if (parsed === null) return [];
    if (Array.isArray(parsed)) {
      return normalisasiNamaAktif(parsed.filter((value): value is string => typeof value === 'string'));
    }
    if (typeof parsed === 'string' && parsed !== '0') return normalisasiNamaAktif([parsed]);
  } catch {
    return normalisasiNamaAktif([simpanan]);
  }
  return normalisasiNamaAktif([simpanan]);
}

function simpanNamaAktif(values: readonly string[]): string {
  return JSON.stringify(normalisasiNamaAktif(values));
}

const Ctx = createContext<TahunAjaranAktifState | null>(null);

/** Bawaan: TA aktif; jika tak ada → tanggal_mulai terbaru, lalu nama terbesar.
 *  Tanpa lembaga tunggal (mode "Semua lembaga") → "Semua tahun". */
function bawaan(daftar: TahunAjaran[], jenjang: string | null): string | null {
  if (jenjang == null) return null;
  const aktif = daftar.find((t) => t.is_aktif);
  if (aktif) return aktif.nama;
  const urut = [...daftar].sort((a, b) =>
    (b.tanggal_mulai ?? '').localeCompare(a.tanggal_mulai ?? '') || b.nama.localeCompare(a.nama));
  return urut[0]?.nama ?? null;
}

export function TahunAjaranAktifProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { jenjangs, loading: lembagaLoading } = useLembagaAktif();
  const jenjang = jenjangs[0] ?? null;
  const [pilihan, setPilihan] = useState<TahunAjaran[]>([]);
  const [tahunAjaranNames, setTahunAjaranNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!user) {
        setPilihan([]);
        setTahunAjaranNames([]);
        setLoading(false);
        return;
      }
      // Tunggu lembaga aktif selesai dimuat agar tak memuat dua kali
      // (untuk "Semua" lalu untuk jenjang terpilih).
      if (lembagaLoading) return;

      setLoading(true);
      let daftar: TahunAjaran[] = [];
      try {
        const p = await listTahunAjaran({ jenjang: jenjangs.length > 0 ? jenjangs : undefined, per_page: 1000 });
        daftar = p.data;
      } catch {
        daftar = [];
      }
      if (!alive) return;
      setPilihan(daftar);

      const simpanan = await prefGet(KEY).catch(() => null);
      const valid = bacaNamaAktif(simpanan).filter((nilai) =>
        daftar.some((d) => d.nama === nilai),
      );
      const bawaanNama = bawaan(daftar, jenjang);
      let nama: string[];
      if (simpanan === '0' || simpanan === '[]') nama = [];
      else if (valid.length > 0) nama = valid;
      else nama = bawaanNama == null ? [] : [bawaanNama];
      if (!alive) return;
      setTahunAjaranNames(nama);
      setLoading(false);
    })();

    return () => { alive = false; };
  }, [user?.id, jenjangs, lembagaLoading]);

  const pilihBanyak = useMemo(() => (values: string[]) => {
    const next = normalisasiNamaAktif(values);
    setTahunAjaranNames(next);
    prefSet(KEY, simpanNamaAktif(next)).catch(() => {});
  }, []);

  const pilih = useMemo(() => (nama: string | null) => {
    const next = nama == null ? [] : normalisasiNamaAktif([nama]);
    setTahunAjaranNames(next);
    prefSet(KEY, next[0] ?? '0').catch(() => {});
  }, []);

  const value = useMemo<TahunAjaranAktifState>(() => {
    const tahunAjaranNama = tahunAjaranNames[0] ?? null;
    return {
      loading,
      tahunAjaranNames,
      tahunAjaranNama,
      tahunAjaran: pilihan.find((p) => p.nama === tahunAjaranNama) ?? null,
      pilihan,
      pilih,
      pilihBanyak,
    };
  }, [loading, tahunAjaranNames, pilihan, pilih, pilihBanyak]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTahunAjaranAktif() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTahunAjaranAktif di luar TahunAjaranAktifProvider');
  return ctx;
}
