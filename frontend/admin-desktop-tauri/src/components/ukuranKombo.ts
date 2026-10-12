/**
 * Tipe, batas, dan alat bantu UKURAN kotak komponen kustom.
 *
 *  Tipe & batasnya dipakai bersama oleh popover pengaturan dan validasi backend
 *  (`KomponenCustomController`). PENYIMPANANNYA tak ada di file ini: setelan
 *  komponen hidup di server, tabel `komponen_custom` (lihat
 *  `components/komponenCustom.ts`) — dulu pernah per perangkat lewat store ini.
 */

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
  /** Label opsi yang dipakai sebagai nilai AWAL combobox (dari opsi yang
   *  ada). Absen = pakai nilai dari pemanggil. */
  nilaiDefault?: string;
  /** Langkah tombol −/+ stepper angka (interval perubahan nilai). Absen =
   *  ikut prop `step` pemanggil (bawaan 1). Hanya dipakai `LabeledStepper`. */
  langkah?: number;
}

/** Nilai `null` = hapus kunci itu (kembali ke bawaan); dipakai reset per-baris. */
export type UbahUkuranKombo = {
  tinggi?: number | null;
  lebar?: number | null;
  lebarLabel?: number | null;
  lebarKontrol?: number | null;
  expandLabel?: boolean | null;
  labelTransparan?: boolean | null;
  nilaiDefault?: string | null;
  langkah?: number | null;
};

/** Batas panjang nilai default (selaras validasi backend `nilai_default.*`). */
export const NILAI_DEFAULT_MAKS = 100;

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
/** Bawaan lebar kontrol terkunci — `LEBAR_KOMBO_BAWAAN` − `LEBAR_LABEL_BAWAAN`
 *  (160 − 80), supaya titik awal popover konsisten dengan total bawaannya. */
export const LEBAR_KONTROL_BAWAAN = 80;
/** Titik awal stepper "Total" di popover bila kotak tak terukur (mis. jsdom);
 *  selaras dengan lebar total bawaan kotak (`LEBAR_BAWAHAN_FILTER`). */
export const LEBAR_KOMBO_BAWAAN = 160;

/** Langkah tombol −/+ stepper ANGKA: bilangan bulat ≥ 1 (0 membuat tombol tak
 * berpengaruh; pecahan tak mungkin karena nilai stepper selalu dibulatkan).
 * Batas atas 1000 cukup untuk interval besar. Selaras validasi backend
 * (`KomponenCustomController`, `langkah` 1–1000). */
export const LANGKAH_STEPPER_BAWAAN = 1;
export const LANGKAH_STEPPER_MIN = 1;
export const LANGKAH_STEPPER_MAKS = 1000;

/** Snapshot stabil untuk komponen tanpa setelan (nilai yang dikembalikan
 *  `getSnapshot` tak boleh berubah identitas tiap panggilan). */
const KOSONG: UkuranKombo = Object.freeze({});

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

/** Jepit langkah stepper ke rentang sah (≥ 1). */
export function jepitLangkah(v: number): number {
  return jepitKetat(v, LANGKAH_STEPPER_MIN, LANGKAH_STEPPER_MAKS) ?? LANGKAH_STEPPER_BAWAAN;
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
  // Nilai default: hanya string tak kosong; dipotong ke batas backend.
  if (typeof o.nilaiDefault === 'string' && o.nilaiDefault.trim() !== '') {
    hasil.nilaiDefault = o.nilaiDefault.trim().slice(0, NILAI_DEFAULT_MAKS);
  }
  // Langkah stepper: angka apa pun (termasuk string angka) dijepit ke rentang.
  const langkah = jepitKetat(o.langkah, LANGKAH_STEPPER_MIN, LANGKAH_STEPPER_MAKS);
  if (langkah !== undefined) hasil.langkah = langkah;
  return hasil;
}
