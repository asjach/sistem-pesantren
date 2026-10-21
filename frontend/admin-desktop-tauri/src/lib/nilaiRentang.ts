import type { RentangNilai } from '@/api/penilaian';

/** Batas atas nilai untuk pilihan rentang peristiwa. */
export function batasAtasRentang(rentang: RentangNilai): number {
  return rentang === '0-10' ? 10 : rentang === '0-4' ? 4 : 100;
}

export function nilaiDalamRentang(nilai: number, rentang: RentangNilai): boolean {
  return Number.isFinite(nilai) && nilai >= 0 && nilai <= batasAtasRentang(rentang);
}
