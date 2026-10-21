import { useEffect, useState } from 'react';
import type { BarisPesertaKegiatanEvaluatif } from '@/api/penilaian';
import { ambilFotoProfilSantri } from '@/api/santri';

const cache = new Map<number, string>();
const gagal = new Set<number>();
const BATAS_AKTIF = 4;

/** Muat foto profil peserta yang punya foto, dengan batas permintaan paralel.
 *  Hasil disimpan sebagai blob URL agar aman dipakai di area cetak. */
export function useFotoPeserta(
  peserta: readonly BarisPesertaKegiatanEvaluatif[],
  aktif: boolean,
): { foto: Record<number, string>; memuat: boolean } {
  const [, setVersi] = useState(0);
  const [memuat, setMemuat] = useState(false);

  useEffect(() => {
    if (!aktif) return;
    const perlu = peserta.filter(
      (item) => item.foto_url && !cache.has(item.santri_id) && !gagal.has(item.santri_id),
    );
    if (perlu.length === 0) {
      setMemuat(false);
      return;
    }

    let hidup = true;
    let berjalan = 0;
    let indeks = 0;
    setMemuat(true);

    const berikut = () => {
      if (!hidup) return;
      while (berjalan < BATAS_AKTIF && indeks < perlu.length) {
        const item = perlu[indeks++];
        berjalan += 1;
        ambilFotoProfilSantri(item.santri_id)
          .then((bytes) => {
            if (!cache.has(item.santri_id)) {
              cache.set(item.santri_id, URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer])));
            }
          })
          .catch(() => {
            gagal.add(item.santri_id);
          })
          .finally(() => {
            berjalan -= 1;
            if (!hidup) return;
            setVersi((nilai) => nilai + 1);
            if (indeks >= perlu.length && berjalan === 0) setMemuat(false);
            else berikut();
          });
      }
    };
    berikut();

    return () => {
      hidup = false;
    };
  }, [peserta, aktif]);

  const foto: Record<number, string> = {};
  for (const item of peserta) {
    const url = cache.get(item.santri_id);
    if (url) foto[item.santri_id] = url;
  }
  const tertunda = peserta.some(
    (item) => item.foto_url && !cache.has(item.santri_id) && !gagal.has(item.santri_id),
  );

  return { foto, memuat: memuat || tertunda };
}
