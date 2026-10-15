/**
 * Pengurut baris referensi (kamus) yang dijalankan DI KLIEN.
 *
 * Halaman Referensi memuat seluruh baris sekaligus — endpoint-nya
 * mengembalikan array, bukan halaman berpaginasi — jadi `sort` tidak dikirim
 * ke server. Kode urutnya tetap harus terdaftar di katalog backend hanya
 * untuk validasi; di sini yang menentukan hasilnya.
 */
import type { ArahUrut } from '@/api/urutPreset';
import type { PetaArahKolom } from './urut';

/** Bentuk minimal baris yang dibutuhkan pengurut (subset `ReferensiRow`). */
export interface BarisReferensiUrut {
  nama?: string | null;
  kode?: string | null;
  urutan?: number | string | null;
  is_active?: boolean | null;
  jenjang?: string | null;
  is_aktif_bawaan?: boolean | null;
  terminal_ke?: string | null;
}

/** Sifat logika status akhir — samakan dengan `sifatOf` di halaman. */
function sifatOf(r: BarisReferensiUrut): string {
  if (r.is_aktif_bawaan) return 'Aktif bawaan';
  if (r.terminal_ke) return `Terminal → ${r.terminal_ke}`;
  return 'Netral';
}

/** Nilai satu kolom sebagai teks siap-banding. `sumber` memakai nama lembaga
 *  yang sudah diresolusi pemanggil (peta jenjang → nama). */
export function nilaiKolomReferensi(
  r: BarisReferensiUrut,
  key: string,
  namaLembaga?: (jenjang: string | null) => string,
): string {
  switch (key) {
    case 'nama': return r.nama ?? '';
    case 'kode': return r.kode ?? '';
    case 'urutan': return String(r.urutan ?? 0);
    case 'sumber': return namaLembaga ? (namaLembaga(r.jenjang ?? null) ?? '') : (r.jenjang ?? '');
    case 'tampil': return r.is_active === false ? 'tidak' : 'ya';
    case 'sifat': return sifatOf(r);
    default: return '';
  }
}

/**
 * Urutkan salinan baris referensi menurut kode urut aktif.
 *
 * Aturan: kolom numerik (`urutan`) dibandingkan sebagai angka — "10" harus
 * setelah "9", bukan sebelum "1". Sisanya dibandingkan sebagai teks locale
 * `id` supaya huruf besar/kecil tidak memencar. `arahKolom` (opsional) menang
 * atas `arah` global, sehingga tiap kolom bisa punya orientasi sendiri.
 *
 * Tak mengubah array masukan (`rows` biasanya state React).
 */
export function urutkanReferensi<T extends BarisReferensiUrut>(
  rows: readonly T[],
  kolom: readonly string[],
  arah: ArahUrut = 'naik',
  arahKolom?: PetaArahKolom,
  namaLembaga?: (jenjang: string | null) => string,
): T[] {
  if (kolom.length === 0) {
    return [...rows];
  }

  // Token bisa berbentuk `kode` atau `kode:arah`; token gabungan `a,b` pun
  // dipecah supaya bentuknya sama dengan token yang dikirim PresetUrut.
  const kunci = kolom.flatMap((k) => k.split(','));

  return [...rows].sort((a, b) => {
    for (const key of kunci) {
      const ka = nilaiKolomReferensi(a, key, namaLembaga);
      const kb = nilaiKolomReferensi(b, key, namaLembaga);
      if (ka === kb) continue;

      const na = Number(ka);
      const nb = Number(kb);
      const numerik = ka.trim() !== '' && kb.trim() !== ''
        && Number.isFinite(na) && Number.isFinite(nb);
      const banding = numerik ? na - nb : ka.localeCompare(kb, 'id');
      if (banding === 0) continue;

      const arahKolomIni = arahKolom?.[key] ?? arah;
      return arahKolomIni === 'turun' ? -banding : banding;
    }

    return 0;
  });
}
