import { useEffect, useSyncExternalStore } from 'react';
import { prefGet, prefSet } from '@/api/client';

/** Ukuran KOTAK `LabeledCombobox` (label + zona kontrol) per komponen:
 *  tinggi & lebar TOTAL kotak dalam px, plus lebar LABEL dan lebar KONTROL
 *  yang dikunci terpisah (keduanya diisi → kotak rangkul isi, lebar total
 *  diabaikan — lihat `KotakLabel`). Properti yang absen = ikut nilai dari
 *  pemanggil (prop `tinggi` / `lebarKotak` / `lebarLabel` / `lebarKombo`,
 *  termasuk lebar dari Kelola Tabel). */
export interface UkuranKombo {
  tinggi?: number;
  lebar?: number;
  lebarLabel?: number;
  lebarKontrol?: number;
  /** True = LABEL yang mengembang saat total diubah; absen/false = KONTROL
   *  (bawaan). Hanya `true` yang disimpan. */
  expandLabel?: boolean;
  /** True = label TRANSPARAN (tanpa bg, teks bertitik dua); absen = ikut
   *  bawaan (transparan). `false` tersimpan eksplisit = label ber-bg. */
  labelTransparan?: boolean;
}

/** Nilai `null` = hapus kunci itu (kembali ke bawaan); dipakai reset per-baris. */
export type UbahUkuranKombo = {
  tinggi?: number | null;
  lebar?: number | null;
  lebarLabel?: number | null;
  lebarKontrol?: number | null;
  expandLabel?: boolean | null;
  labelTransparan?: boolean | null;
};

/** Bawaan tinggi kotak = tinggi kontrol proyek (26px). */
export const TINGGI_KOMBO_BAWAAN = 26;
export const TINGGI_KOMBO_MIN = 20;
export const TINGGI_KOMBO_MAKS = 120;

/** Lebar total kotak: di bawah 80px label + kontrol tak terbaca. */
export const LEBAR_KOMBO_MIN = 80;
export const LEBAR_KOMBO_MAKS = 1200;
/** Lebar label terkunci: di bawah 40px teks tak terbaca; 400px cukup untuk
 *  label terpanjang. Selaras dengan validasi backend (`lebar.*` 40–1200;
 *  batas atas 400 ditegakkan di controller). */
export const LEBAR_LABEL_MIN = 40;
export const LEBAR_LABEL_MAKS = 400;
export const LEBAR_LABEL_BAWAAN = 80;
/** Lebar kontrol terkunci: batas bawah = `MIN_LEBAR_KONTROL` KotakLabel. */
export const LEBAR_KONTROL_MIN = 40;
export const LEBAR_KONTROL_MAKS = LEBAR_KOMBO_MAKS;
export const LEBAR_KONTROL_BAWAAN = 120;
/** Titik awal stepper lebar bila kotak tak terukur (mis. di jsdom). */
export const LEBAR_KOMBO_BAWAAN = 200;

/** Kunci simpanan preferensi perangkat (peta: kunci komponen → ukuran). */
export const KUNCI_UKURAN_KOMBO = 'simpes_ukuran_kombo';

/** Snapshot stabil untuk komponen tanpa ukuran tersimpan (wajib: nilai yang
 *  dikembalikan `getSnapshot` tak boleh berubah identitas tiap panggilan). */
const KOSONG: UkuranKombo = Object.freeze({});

/** Registri modul: kunci komponen (htmlFor combobox) → ukuran tersimpan. */
const peta = new Map<string, UkuranKombo>();
const pendengar = new Set<() => void>();

/** Jepit nilai apa pun ke rentang; non-angka → undefined (dibuang). */
function jepitKetat(v: unknown, min: number, maks: number): number | undefined {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
  return Math.min(maks, Math.max(min, Math.round(n)));
}

/** Jepit angka (sudah pasti angka) ke rentang ukuran kotak. */
export function jepitTinggi(v: number): number {
  return jepitKetat(v, TINGGI_KOMBO_MIN, TINGGI_KOMBO_MAKS) ?? TINGGI_KOMBO_BAWAAN;
}
export function jepitLebar(v: number): number {
  return jepitKetat(v, LEBAR_KOMBO_MIN, LEBAR_KOMBO_MAKS) ?? LEBAR_KOMBO_MIN;
}
export function jepitLebarLabel(v: number): number {
  return jepitKetat(v, LEBAR_LABEL_MIN, LEBAR_LABEL_MAKS) ?? LEBAR_LABEL_MIN;
}
export function jepitLebarKontrol(v: number): number {
  return jepitKetat(v, LEBAR_KONTROL_MIN, LEBAR_KONTROL_MAKS) ?? LEBAR_KONTROL_MIN;
}

/** Normalisasi satu entri: kunci asing dibuang, angka dijepit ke rentang. */
export function normalkanUkuran(v: unknown): UkuranKombo {
  if (v === null || typeof v !== 'object') return KOSONG;
  const o = v as Record<string, unknown>;
  const hasil: UkuranKombo = {};
  const tinggi = jepitKetat(o.tinggi, TINGGI_KOMBO_MIN, TINGGI_KOMBO_MAKS);
  const lebar = jepitKetat(o.lebar, LEBAR_KOMBO_MIN, LEBAR_KOMBO_MAKS);
  const lebarLabel = jepitKetat(o.lebarLabel, LEBAR_LABEL_MIN, LEBAR_LABEL_MAKS);
  const lebarKontrol = jepitKetat(o.lebarKontrol, LEBAR_KONTROL_MIN, LEBAR_KONTROL_MAKS);
  if (tinggi !== undefined) hasil.tinggi = tinggi;
  if (lebar !== undefined) hasil.lebar = lebar;
  if (lebarLabel !== undefined) hasil.lebarLabel = lebarLabel;
  if (lebarKontrol !== undefined) hasil.lebarKontrol = lebarKontrol;
  // Absen = kontrol mengembang (bawaan); hanya `true` yang disimpan.
  if (o.expandLabel === true) hasil.expandLabel = true;
  // Absen = ikut bawaan (transparan); `false` eksplisit = label ber-bg.
  if (typeof o.labelTransparan === 'boolean') hasil.labelTransparan = o.labelTransparan;
  return hasil;
}

function beritahu() {
  for (const f of pendengar) f();
}

function langganan(f: () => void): () => void {
  pendengar.add(f);
  return () => {
    pendengar.delete(f);
  };
}

let janjiMuat: Promise<void> | null = null;

/** Muat peta ukuran dari penyimpanan SEKALI (Tauri store di desktop,
 *  localStorage di browser — keduanya lewat `prefGet`). */
export function muatUkuranKombo(): Promise<void> {
  if (janjiMuat === null) {
    janjiMuat = (async () => {
      try {
        const mentah = await prefGet(KUNCI_UKURAN_KOMBO);
        if (mentah === null || mentah.trim() === '') return;
        const obj: unknown = JSON.parse(mentah);
        if (obj === null || typeof obj !== 'object') return;
        for (const [kunci, nilai] of Object.entries(obj as Record<string, unknown>)) {
          const ukuran = normalkanUkuran(nilai);
          if (Object.keys(ukuran).length > 0) peta.set(kunci, ukuran);
        }
        beritahu();
      } catch {
        /* simpanan rusak / penyimpanan tak tersedia: pakai bawaan */
      }
    })();
  }
  return janjiMuat;
}

function simpanKePenyimpanan(): void {
  const obj: Record<string, UkuranKombo> = {};
  for (const [kunci, ukuran] of peta) obj[kunci] = ukuran;
  void prefSet(KUNCI_UKURAN_KOMBO, JSON.stringify(obj));
}

/** Ukuran tersimpan sebuah komponen (absen = ikut nilai dari pemanggil). */
export function ukuranKombo(kunci: string): UkuranKombo {
  return peta.get(kunci) ?? KOSONG;
}

/** Simpan sebagian ukuran (nilai di luar rentang dijepit, `null` menghapus
 *  kunci itu — dipakai reset per-baris popover). */
export function simpanUkuranKombo(kunci: string, ubah: UbahUkuranKombo): void {
  if (kunci === '') return;
  peta.set(kunci, normalkanUkuran({ ...ukuranKombo(kunci), ...ubah }));
  beritahu();
  simpanKePenyimpanan();
}

/** Hapus ukuran tersimpan → kotak kembali ke ukuran dari pemanggil. */
export function kosongkanUkuranKombo(kunci: string): void {
  if (!peta.delete(kunci)) return;
  beritahu();
  simpanKePenyimpanan();
}

/** Hook: ukuran sebuah komponen; ikut berubah begitu diatur dari popover. */
export function useUkuranKombo(kunci: string): UkuranKombo {
  useEffect(() => {
    void muatUkuranKombo();
  }, []);
  return useSyncExternalStore(langganan, () => ukuranKombo(kunci), () => KOSONG);
}
