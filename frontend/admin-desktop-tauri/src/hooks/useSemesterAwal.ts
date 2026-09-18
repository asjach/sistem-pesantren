import { useEffect } from 'react';
import { useSemesterAktif, type SemesterAktif } from '@/semesterAktif';

/**
 * Default filter semester halaman mengikuti semester aktif (TopBar,
 * per perangkat). Halaman tetap bisa menimpanya sendiri bila punya
 * kebutuhan khusus (mis. halaman khusus ganjil).
 */
export function useSemesterAwal(set: (v: SemesterAktif | '') => void): void {
  const { semester } = useSemesterAktif();
  useEffect(() => {
    set(semester ?? '');
  }, [semester, set]);
}
