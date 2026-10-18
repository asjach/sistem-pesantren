import type { GridSelection } from './types';

/**
 * Logika seret ISI SEL (klik-tahan → geser → lepas) tanpa DOM.
 *
 * Aturan yang dibedakan pengguna:
 *  - seret biasa            → isi blok DITIRU (salin)
 *  - seret + Ctrl/Cmd ditekan → isi blok DIPINDAH (potong)
 *
 * Selalu memperlakukan seleksi sebagai SATU blok utuh (tak ada gagang isi/
 * seret-mengisi seperti Excel), jadi sumbernya cukup satu persegi.
 *
 * Semua fungsi di sini murni (tanpa DOM, tanpa state) supaya bisa diuji
 * langsung tanpa menggrid.
 */

/** Macam perlakuan saat tombol dilepas. */
export type ModeSeret = 'salin' | 'pindah';

/** Kolom grid yang bukan data — tak pernah ikut disalin/dipindah. */
export const KOLOM_NON_DATA = new Set(['check', '__aksi']);

/**
 * Satu blok sel: rentang baris (inklusif) + indeks kolom grid yang diikutkan.
 *
 * Kolom disimpan sebagai DAFTAR indeks (bukan rentang) supaya blok tetap
 * benar walau di tengahnya ada kolom non-data (mis. kolom centang di kiri
 * dan kolom Aksi sticky di kanan).
 */
export interface BlokIsi {
  /** Baris grid pertama (inklusif). */
  r0: number;
  /** Baris grid terakhir (inklusif). */
  r1: number;
  /** Indeks kolom grid yang diikutkan, urut kiri→kanan. */
  kolom: number[];
}

/** Jumlah sel dalam blok. */
export function ukuranBlok(b: BlokIsi): number {
  return Math.max(0, b.r1 - b.r0 + 1) * b.kolom.length;
}

/** Dua blok dianggap sama bila menutup sel-sel yang persis sama. */
export function samaBlok(a: BlokIsi, b: BlokIsi): boolean {
  if (a.r0 !== b.r0 || a.r1 !== b.r1 || a.kolom.length !== b.kolom.length) return false;
  return a.kolom.every((c, i) => c === b.kolom[i]);
}

/** TRUE bila kedua blok memakai setidaknya satu sel yang sama. */
export function beririsan(a: BlokIsi, b: BlokIsi): boolean {
  if (b.r1 < a.r0 || b.r0 > a.r1) return false;
  return a.kolom.some((c) => b.kolom.includes(c));
}

/**
 * Indeks kolom data dalam rentang `[c0, c1]` (inklusif) menurut daftar kunci
 * kolom grid. Kolom centang & Aksi dilewati.
 */
export function kolomData(
  kunciKolom: readonly string[], c0: number, c1: number,
): number[] {
  const out: number[] = [];
  const a = Math.max(0, Math.min(c0, c1));
  const b = Math.min(kunciKolom.length - 1, Math.max(c0, c1));
  for (let c = a; c <= b; c += 1) {
    const k = kunciKolom[c];
    if (k && !KOLOM_NON_DATA.has(k)) out.push(c);
  }
  return out;
}

/**
 * Blok dari seleksi aktif DSG, dijepit ke area data tabel. `null` bila tak
 * ada sel data yang tersentuh (mis. yang terseleksi hanya kolom centang).
 */
export function blokDariSeleksi(
  range: GridSelection | null, kunciKolom: readonly string[], jumlahBaris: number,
): BlokIsi | null {
  if (range === null || jumlahBaris <= 0) return null;
  const kolom = kolomData(kunciKolom, range.min.col, range.max.col);
  if (kolom.length === 0) return null;
  const r0 = Math.max(0, Math.min(range.min.row, range.max.row, jumlahBaris - 1));
  const r1 = Math.max(0, Math.min(Math.max(range.min.row, range.max.row), jumlahBaris - 1));
  if (r1 < r0) return null;
  return { r0, r1, kolom };
}

/** Blok satu sel (satu baris × satu kolom). */
export function blokSel(row: number, kolom: number[]): BlokIsi {
  return { r0: row, r1: row, kolom };
}

/**
 * Geser blok sejauh kursor bergerak sejak titik TEKAN (`genggam`).
 *
 *  Offset dihitung dari sel yang dipegang, bukan dari pojok kiri atas blok:
 *  kursor yang memegang kolom kedua blok dan berakhir di kolom kedua blok
 *  lain harus menurunkan blok sebagai kolom kedua — bukan kolom pertama.
 *
 *  Jangkar boleh berada di kolom yang TIDAK termasuk blok — itulah kasus
 *  "seret ke kolom lain", jadi jaraknya harus dihitung dari posisi tekan,
 *  bukan dari daftar kolom blok.
 */
export function geserBlok(
  sumber: BlokIsi,
  genggam: { row: number; kolom: number },
  jangkar: { row: number; kolom: number },
): BlokIsi {
  const geserBaris = jangkar.row - genggam.row;
  const geserKolom = jangkar.kolom - genggam.kolom;
  return {
    r0: sumber.r0 + geserBaris,
    r1: sumber.r1 + geserBaris,
    kolom: sumber.kolom.map((c) => c + geserKolom),
  };
}

/**
 * Jepit blok ke area data tabel (buang kolom centang/Aksi dan baris di luar
 * tabel). `null` bila tak ada sel data yang tersisa — inilah yang terjadi
 * saat kursor dilepas di kolom Aksi atau di luar jangkauan tabel.
 */
export function jepitBlok(
  blok: BlokIsi, kunciKolom: readonly string[], jumlahBaris: number,
): BlokIsi | null {
  if (jumlahBaris <= 0) return null;
  const kolom = kolomData(kunciKolom, blok.kolom[0], blok.kolom[blok.kolom.length - 1]);
  if (kolom.length === 0) return null;
  const r0 = Math.max(0, Math.min(blok.r0, jumlahBaris - 1));
  const r1 = Math.max(0, Math.min(blok.r1, jumlahBaris - 1));
  if (r1 < r0) return null;
  return { r0, r1, kolom };
}

/** Nilai mentah sel sebagai teks; null untuk sel kosong atau baris tak ada. */
export function nilaiSel(
  baris: readonly Record<string, unknown>[],
  row: number, kolom: number, kunciKolom: readonly string[],
): string | null {
  const key = kunciKolom[kolom];
  const g = baris[row];
  if (key === undefined || g === undefined) return null;
  const v = g[key];
  if (v === null || v === undefined || v === '') return null;
  return String(v);
}

/**
 * Terapkan seret pada salinan array baris grid: isi blok `sumber` ditulis
 * ke blok `target` (salin), lalu blok sumber DIKOSONGKAN bila mode `pindah`.
 *
 * Mengembalikan array BARU; array asal tak pernah diubah.
 */
export function terapkanSeret<T extends { id: string | number }>(
  baris: readonly T[], sumber: BlokIsi, target: BlokIsi,
  kunciKolom: readonly string[], mode: ModeSeret,
): T[] {
  const out = baris.map((g) => ({ ...g }) as Record<string, unknown>);
  // Rekam isi sumber DULU: langkah "pindah" mengosongkan sumber, jadi nilainya
  // harus dibekukan lebih dulu supaya penulisan ke target tak terpengaruh.
  const isi: (string | null)[][] = [];
  for (let r = sumber.r0; r <= sumber.r1; r += 1) {
    isi.push(sumber.kolom.map((c) => nilaiSel(baris, r, c, kunciKolom)));
  }
  for (let dr = 0; dr <= target.r1 - target.r0; dr += 1) {
    const g = out[target.r0 + dr];
    if (g === undefined) continue;
    target.kolom.forEach((c, dc) => {
      const key = kunciKolom[c];
      if (key !== undefined) g[key] = isi[dr]?.[dc] ?? null;
    });
  }
  if (mode === 'pindah') {
    /* Sel yang jadi tujuan SEKALIGUS jadi sumber (mis. blok digeser ke
       kanan pada baris yang sama) tak boleh dikosongkan — isinya yang baru
       saja ditulis ke sana akan ikut terhapus. Perbandingan harus per-sel:
       kolom yang sama pada baris BERBEDA tetap wajib dikosongkan. */
    const kolomTujuan = new Set(target.kolom);
    for (let r = sumber.r0; r <= sumber.r1; r += 1) {
      const g = out[r];
      if (g === undefined) continue;
      const barisSama = r >= target.r0 && r <= target.r1;
      for (const c of sumber.kolom) {
        if (barisSama && kolomTujuan.has(c)) continue;
        const key = kunciKolom[c];
        if (key !== undefined) g[key] = null;
      }
    }
  }
  return out as T[];
}