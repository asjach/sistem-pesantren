import { useEffect, useState } from 'react';
import { petaKolom, type KamusPeta } from '@/api/kamusLabel';

/** Cache peta kamus per daftar tabel (dibagi semua grid dalam sesi). */
const cache = new Map<string, KamusPeta>();
const inFlight = new Map<string, Promise<KamusPeta>>();

function muat(kunci: string): Promise<KamusPeta> {
  const ada = inFlight.get(kunci);
  if (ada) return ada;
  const p = petaKolom(kunci.split(','))
    .then((r) => {
      cache.set(kunci, r.data);
      inFlight.delete(kunci);
      return r.data;
    })
    .catch(() => {
      inFlight.delete(kunci);
      return {} as KamusPeta;
    });
  inFlight.set(kunci, p);
  return p;
}

/** Buang cache (dipakai halaman Kamus Label setelah menyimpan perubahan). */
export function bersihkanCacheKamus(): void {
  cache.clear();
  inFlight.clear();
}

/**
 * Peta kamus kolom untuk daftar tabel database (mis. ['santri','lembaga']).
 * Satu permintaan per kombinasi tabel; hasil dibagi antar grid.
 */
export function useKamusPeta(tabel: string[]): KamusPeta {
  const kunci = [...new Set(tabel.filter(Boolean))].sort().join(',');
  const [peta, setPeta] = useState<KamusPeta>(() => (kunci ? cache.get(kunci) ?? {} : {}));

  useEffect(() => {
    if (!kunci) {
      setPeta({});
      return;
    }
    const ada = cache.get(kunci);
    if (ada) {
      setPeta(ada);
      return;
    }
    let hidup = true;
    void muat(kunci).then((p) => {
      if (hidup) setPeta(p);
    });
    return () => {
      hidup = false;
    };
  }, [kunci]);

  return peta;
}
