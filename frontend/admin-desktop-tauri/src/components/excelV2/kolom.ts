import { labelKolom } from '@/lib/labelKolom';
import type { AlignKolom } from '@/components/kelolaTabel/jenis';
import type { ExcelField } from '@/components/excel/types';

/**
 * Susun kolom tampil sesuai preset kolom.
 *
 *  `null`/kosong = semua kolom dengan urutan asli halaman (perilaku bawaan,
 *  jadi tabel yang belum pernah memilih preset tidak berubah). Daftar key =
 *  hanya kolom itu, urut sesuai preset; key yang tak dikenal (mis. kolom yang
 *  sudah dihapus dari kode) dilewati. Kolom yang tak disebut TIDAK
 *  ditambahkan di belakang: preset kustom memang menyembunyikannya.
 */
export function susunKolom(fields: ExcelField[], keys: string[] | null): ExcelField[] {
  if (!keys || keys.length === 0) return fields;

  const sisa = new Map(fields.map((f) => [f.key, f]));
  const hasil: ExcelField[] = [];
  for (const key of keys) {
    const f = sisa.get(key);
    if (!f) continue;
    hasil.push(f);
    sisa.delete(key);
  }
  return hasil;
}

export type StatusPilihSemua = 'semua' | 'sebagian' | 'tidak';

/** Status header "pilih semua" dari id yang sedang tampil + pilihan sekarang.
 *  Dipisah dari komponen agar bisa diuji tanpa merender grid. */
export function statusPilihSemua(
  ids: readonly (string | number)[],
  dipilih: ReadonlySet<string | number>,
): StatusPilihSemua {
  if (ids.length === 0) return 'tidak';

  let jumlah = 0;
  for (const id of ids) {
    if (dipilih.has(id)) jumlah += 1;
  }
  if (jumlah === 0) return 'tidak';
  return jumlah === ids.length ? 'semua' : 'sebagian';
}

export type RataKolom = 'kiri' | 'tengah' | 'kanan';

/** Perataan efektif satu kolom. Setelan per tabel menang; TANPA setelan
 *  default tengah — sama dengan ExcelTable V1 (alignDb[key] ?? 'center').
 *  Format angka tidak mengubah perataan: kolom angka pun ikut setelan. */
export function rataKolom(
  f: ExcelField,
  align: Partial<Record<string, AlignKolom>> = {},
): RataKolom {
  const a = align[f.key];
  if (a === 'left') return 'kiri';
  if (a === 'right') return 'kanan';
  return 'tengah';
}

/** Nama header tampil: label kustom per tabel > label field > humanize key. */
export function labelTampil(
  key: string,
  bawaan: string | undefined,
  labelDb: Record<string, string> = {},
): string {
  return labelKolom(labelDb[key]?.trim() || bawaan || key);
}
