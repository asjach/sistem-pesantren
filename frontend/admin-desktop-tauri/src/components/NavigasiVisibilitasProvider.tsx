import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { semuaKunciNavigasi } from '@/lib/halaman';

const KUNCI_SIMPAN = 'simpes_navigasi_tersembunyi';

function baca(): Set<string> {
  try {
    const mentah = localStorage.getItem(KUNCI_SIMPAN);
    if (!mentah) return new Set();
    const daftar: unknown = JSON.parse(mentah);
    if (!Array.isArray(daftar)) return new Set();
    const valid = semuaKunciNavigasi();

    return new Set(daftar.filter((k): k is string => typeof k === 'string' && valid.has(k)));
  } catch {
    return new Set();
  }
}

function tulis(nilai: Set<string>) {
  try {
    localStorage.setItem(KUNCI_SIMPAN, JSON.stringify([...nilai]));
  } catch {
    // Preferensi tampilan: gagal menyimpan tidak boleh menghentikan UI.
  }
}

interface NavigasiVisibilitas {
  tersembunyi: ReadonlySet<string>;
  jungkit: (kunci: string) => void;
  atur: (kunci: string[], terlihat: boolean) => void;
  reset: () => void;
}

const Ctx = createContext<NavigasiVisibilitas | null>(null);
const FALLBACK: NavigasiVisibilitas = {
  tersembunyi: new Set(),
  jungkit: () => {},
  atur: () => {},
  reset: () => {},
};

/** Visibilitas entri navigasi (grup/sub/halaman/tab) per perangkat. */
export function NavigasiVisibilitasProvider({ children }: { children: ReactNode }) {
  const [tersembunyi, setTersembunyi] = useState<Set<string>>(baca);

  const ubah = useCallback((fn: (sebelum: Set<string>) => Set<string>) => {
    setTersembunyi((sebelum) => {
      const sesudah = fn(new Set(sebelum));
      tulis(sesudah);

      return sesudah;
    });
  }, []);

  const value = useMemo<NavigasiVisibilitas>(() => ({
    tersembunyi,
    jungkit: (kunci) => ubah((sebelum) => {
      if (sebelum.has(kunci)) sebelum.delete(kunci);
      else sebelum.add(kunci);

      return sebelum;
    }),
    atur: (kunci, terlihat) => ubah((sebelum) => {
      for (const k of kunci) {
        if (terlihat) sebelum.delete(k);
        else sebelum.add(k);
      }

      return sebelum;
    }),
    reset: () => ubah(() => new Set()),
  }), [tersembunyi, ubah]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNavigasiVisibilitas(): NavigasiVisibilitas {
  return useContext(Ctx) ?? FALLBACK;
}
