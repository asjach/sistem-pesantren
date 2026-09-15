import { useEffect } from 'react';
import { useLembagaAktif } from '@/lembagaAktif';

/**
 * Default filter lembaga halaman mengikuti lembaga aktif (per perangkat).
 * Diterapkan saat lembaga aktif tersedia/berganti; user tetap bisa mengubahnya
 * sendiri lewat filter halaman.
 */
export function useLembagaAwalString(set: (v: string) => void): void {
  const { lembagaId } = useLembagaAktif();
  useEffect(() => {
    set(lembagaId != null ? String(lembagaId) : '');
  }, [lembagaId, set]);
}

/** Varian untuk state filter bertipe `number | ''`. */
export function useLembagaAwalNumber(set: (v: number | '') => void): void {
  const { lembagaId } = useLembagaAktif();
  useEffect(() => {
    set(lembagaId ?? '');
  }, [lembagaId, set]);
}
