import { useEffect, useState } from 'react';
import { ambilBerkas } from '@/api/client';
import type { DesainKartuPeserta } from '@/lib/desainKartuPeserta';

/** Muat gambar latar desain (disk lokal, ber-token) menjadi blob URL.
 *  `kunci` dipakai saat berkas diganti tetapi URL-nya tetap sama. */
export function useLatarDesain(desain: DesainKartuPeserta | null, kunci = 0): string | null {
  const sumber = desain?.latar_ada ? desain.latar_url : null;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!sumber) {
      setUrl(null);
      return;
    }
    let hidup = true;
    let dibuat: string | null = null;
    ambilBerkas(sumber)
      .then((buf) => {
        if (!hidup) return;
        dibuat = URL.createObjectURL(new Blob([buf]));
        setUrl(dibuat);
      })
      .catch(() => {
        if (hidup) setUrl(null);
      });
    return () => {
      hidup = false;
      if (dibuat !== null) URL.revokeObjectURL(dibuat);
    };
  }, [sumber, kunci]);

  return url;
}
