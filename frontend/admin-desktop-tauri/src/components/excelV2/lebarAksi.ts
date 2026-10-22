/** Lebar kolom Aksi V2 dihitung dari jumlah ikon yang benar-benar dirender,
 *  bukan dari angka tetap per halaman: tabel yang punya izin berbeda per baris
 *  bisa menampilkan 0–3 ikon, dan satu kolom dipakai bersama semua baris.
 *
 *  Angka di bawah adalah cermin kelas di `SelAksiV2` dan ukuran tombol aksi
 *  (`Button size="icon-sm"` = `size-6` = 24px). Bila salah satunya berubah,
 *  konstanta ini wajib ikut diubah — tidak ada pengukuran DOM. */
export const AKSI_IKON_W = 24;

/** Jarak antar ikon (`gap-0.5`). */
export const AKSI_GAP = 2;

/** Padding sel per sisi (`px-1`); dipakai dua kali (kiri + kanan). */
export const AKSI_PAD_X = 4;

/** Lebar kolom Aksi untuk `n` ikon. Tanpa ikon hanya tersisa padding. */
export function lebarKolomAksi(n: number): number {
  const jumlah = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  return jumlah * AKSI_IKON_W + Math.max(0, jumlah - 1) * AKSI_GAP + AKSI_PAD_X * 2;
}
