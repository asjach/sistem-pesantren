import { useEffect } from 'react';
import { useTahunAjaranAktif } from '@/tahunAjaranAktif';

/**
 * Default filter tahun ajaran halaman mengikuti tahun ajaran aktif (TopBar,
 * per perangkat). Dropdown-nya sudah dihapus dari bar filter halaman, jadi
 * nilai ini dipakai apa adanya oleh request halaman. Nilai = nama TA
 * (mis. '2026/2027'), bukan id.
 */
export function useTahunAjaranAwalString(set: (v: string) => void): void {
  const { tahunAjaranNama } = useTahunAjaranAktif();
  useEffect(() => {
    set(tahunAjaranNama ?? '');
  }, [tahunAjaranNama, set]);
}
