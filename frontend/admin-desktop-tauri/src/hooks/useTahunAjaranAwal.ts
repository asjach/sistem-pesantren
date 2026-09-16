import { useEffect } from 'react';
import { useTahunAjaranAktif } from '@/tahunAjaranAktif';

/**
 * Default filter tahun ajaran halaman mengikuti tahun ajaran aktif (TopBar,
 * per perangkat). Dropdown-nya sudah dihapus dari bar filter halaman, jadi
 * nilai ini dipakai apa adanya oleh request halaman.
 */
export function useTahunAjaranAwalString(set: (v: string) => void): void {
  const { tahunAjaranId } = useTahunAjaranAktif();
  useEffect(() => {
    set(tahunAjaranId != null ? String(tahunAjaranId) : '');
  }, [tahunAjaranId, set]);
}

/** Varian untuk state filter bertipe `number | ''`. */
export function useTahunAjaranAwalNumber(set: (v: number | '') => void): void {
  const { tahunAjaranId } = useTahunAjaranAktif();
  useEffect(() => {
    set(tahunAjaranId ?? '');
  }, [tahunAjaranId, set]);
}
