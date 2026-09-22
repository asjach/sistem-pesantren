import { useEffect } from 'react';
import { useLembagaAktif } from '@/lembagaAktif';

/**
 * Default filter lembaga halaman mengikuti lembaga aktif (per perangkat).
 * Diterapkan saat lembaga aktif tersedia/berganti; user tetap bisa mengubahnya
 * sendiri lewat filter halaman.
 */
export function useLembagaAwalString(set: (v: string) => void): void {
  const { jenjang } = useLembagaAktif();
  useEffect(() => {
    set(jenjang ?? '');
  }, [jenjang, set]);
}
