import { bulatMm, jepit } from './satuan';
import type { UkuranHalaman } from './tipe';

export interface Kotak {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Toleransi magnet keselarasan, dalam milimeter. */
export const TOLERANSI = 1.2;

/** Ukuran kisi snap, dalam milimeter. */
export const KISI_MM = 5;

export function tepiKotak(kotak: Kotak): { kiri: number; kanan: number; atas: number; bawah: number; tengahX: number; tengahY: number } {
  return {
    kiri: kotak.x,
    kanan: kotak.x + kotak.w,
    atas: kotak.y,
    bawah: kotak.y + kotak.h,
    tengahX: kotak.x + kotak.w / 2,
    tengahY: kotak.y + kotak.h / 2,
  };
}

/**
 * Kandidat magnet: tepi halaman, titik tengah halaman, dan tepi kotak lain
 * yang sedang diedit. Nilai dalam milimeter diukur dari kiri atas.
 */
export function garisMagnet(
  halaman: UkuranHalaman[],
  halamanAktif: number,
  lain: Kotak[],
): { x: number[]; y: number[] } {
  const ukuran = halaman[halamanAktif - 1] ?? { lebar_mm: 210, tinggi_mm: 297 };
  const x = [0, ukuran.lebar_mm / 2, ukuran.lebar_mm];
  const y = [0, ukuran.tinggi_mm / 2, ukuran.tinggi_mm];

  for (const kotak of lain) {
    const t = tepiKotak(kotak);
    x.push(t.kiri, t.tengahX, t.kanan);
    y.push(t.atas, t.tengahY, t.bawah);
  }

  return { x, y };
}

/**
 * Geser kotak agar menempel ke garis magnet terdekat bila jaraknya masih di
 * dalam toleransi. Mengembalikan kotak baru dan garis yang terpakai, supaya
 * editor bisa menggambar penanda keselarasan.
 */
export function tempel(
  kotak: Kotak,
  magnet: { x: number[]; y: number[] },
  toleransi = TOLERANSI,
): { kotak: Kotak; garis: { x: number[]; y: number[] } } {
  const t = tepiKotak(kotak);
  const garis = { x: [] as number[], y: [] as number[] };

  const cari = (nilai: number, kandidat: number[]): { geser: number; garis?: number; jarak: number } => {
    let geser = 0;
    let terdekat: number | undefined;
    let jarakTerdekat = Number.POSITIVE_INFINITY;

    for (const k of kandidat) {
      const jarak = Math.abs(k - nilai);
      if (jarak < jarakTerdekat) {
        jarakTerdekat = jarak;
        terdekat = k;
      }
    }

    if (terdekat !== undefined && jarakTerdekat <= toleransi) {
      geser = terdekat - nilai;
    }

    return { geser, garis: geser !== 0 ? terdekat : undefined, jarak: jarakTerdekat };
  };

  const terbaik = (a: { geser: number; garis?: number; jarak: number }, b: { geser: number; garis?: number; jarak: number }) =>
    a.jarak <= b.jarak ? a : b;

  // Urut berdasarkan jarak terdekat, bukan besar geseran: mengurutkan dari
  // geseran terkecil selalu memilih "tidak bergerak" dan snap pun tak pernah jalan.
  const kandidatX = [
    cari(t.kiri, magnet.x),
    cari(t.tengahX, magnet.x),
    cari(t.kanan, magnet.x),
  ].reduce(terbaik);

  const kandidatY = [
    cari(t.atas, magnet.y),
    cari(t.tengahY, magnet.y),
    cari(t.bawah, magnet.y),
  ].reduce(terbaik);

  const geserX = kandidatX.jarak <= toleransi ? kandidatX.geser : 0;
  const geserY = kandidatY.jarak <= toleransi ? kandidatY.geser : 0;

  if (geserX !== 0) {
    garis.x.push(kandidatX.garis as number);
  }
  if (geserY !== 0) {
    garis.y.push(kandidatY.garis as number);
  }

  return {
    kotak: {
      ...kotak,
      x: bulatMm(kotak.x + kandidatX.geser),
      y: bulatMm(kotak.y + kandidatY.geser),
    },
    garis,
  };
}

/** Bulatkan ke kisi terdekat bila kisi aktif. */
export function snapKisi(nilai: number, aktif: boolean, kisi = KISI_MM): number {
  if (!aktif || kisi <= 0) {
    return bulatMm(nilai);
  }
  return bulatMm(Math.round(nilai / kisi) * kisi);
}

/** Jaga agar kotak tidak keluar dari halaman dan tetap punya ukuran positif. */
export function dalamHalaman(kotak: Kotak, ukuran: UkuranHalaman, minimum = 1): Kotak {
  return {
    x: bulatMm(jepit(kotak.x, 0, Math.max(0, ukuran.lebar_mm))),
    y: bulatMm(jepit(kotak.y, 0, Math.max(0, ukuran.tinggi_mm))),
    w: bulatMm(jepit(kotak.w, minimum, ukuran.lebar_mm)),
    h: bulatMm(jepit(kotak.h, minimum, ukuran.tinggi_mm)),
  };
}

export function kotakBertumpuk(a: Kotak, b: Kotak): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
