import { JENIS_SLOT_LABEL, type JadwalBaris, type SlotJadwal } from '@/api/kurikulum';

/** Isi sel matriks: mapel + guru (dua baris), mapel saja, atau guru saja. */
export type TampilanJadwal = 'keduanya' | 'mapel' | 'guru';

/** Format nama mapel: nama lengkap, kode, atau singkatan. */
export type FormatMapel = 'nama' | 'kode' | 'singkatan';

/** Format guru: nama/gelar, panggilan/singkat, berprefiks Ust./Usth., atau kode. */
export type FormatGuru =
  | 'nama'
  | 'gelar'
  | 'panggilan'
  | 'singkat'
  | 'prefiks'
  | 'prefiks_gelar'
  | 'kode';

/** Gaya satu baris teks di dalam sel matriks.
 *
 *  Kelas TAILWIND WAJIB ditulis utuh sebagai literal di sini, tak boleh
 *  dirakit dari template literal (`text-[${ukuran}px]`) — pemindai Tailwind
 *  hanya melihat kelas yang tertulis di sumber, sehingga kelas yang dirakit
 *  saat runtime tak akan pernah dibuat dan baris kecilnya diam-diam jatuh ke
 *  ukuran huruf sel. `ukuran` dipakai AutoFit: huruf sel bukan ukuran yang
 *  benar-benar digambar, jadi AutoFit perlu tahu ukuran sebenarnya. */
type GayaGaris = 'penuh' | 'mapel' | 'guru_muda' | 'slot';

export const GAYA_GARIS: Record<GayaGaris, { kelas: string; ukuran?: number }> = {
  penuh: { kelas: 'max-w-full truncate' },
  mapel: { kelas: 'max-w-full truncate text-[10px] leading-[1.15]', ukuran: 10 },
  guru_muda: {
    kelas: 'max-w-full truncate text-[9px] leading-[1.15] text-muted-foreground',
    ukuran: 9,
  },
  slot: { kelas: 'max-w-full truncate text-[10px] text-muted-foreground', ukuran: 10 },
};

/** Satu baris teks yang digambar dalam sel matriks. */
export interface GarisSel {
  teks: string;
  gaya: GayaGaris;
}

/** Nama mapel sesuai format; kode/singkatan kosong kembali ke nama. */
export function formatMapelBaris(j: JadwalBaris, format: FormatMapel): string {
  if (format === 'kode') return j.kode_mapel?.trim() || j.nama_mapel || '';
  if (format === 'singkatan') return j.singkatan?.trim() || j.nama_mapel || '';
  return j.nama_mapel || '';
}

/** Nama guru sesuai format. Prefiks mengikuti jenis kelamin Pegawai. */
export function formatGuruBaris(j: JadwalBaris, format: FormatGuru): string {
  const nama = j.guru?.trim();
  if (!nama) return '';
  if (format === 'kode') {
    return j.guru_pegawai_id !== null ? String(j.guru_pegawai_id) : '';
  }
  if (format === 'panggilan') return j.guru_nama_panggilan?.trim() || nama;
  if (format === 'singkat') return j.guru_nama_singkat?.trim() || nama;
  const depan = j.guru_gelar_depan?.trim();
  const belakang = j.guru_gelar_belakang?.trim();
  const denganGelar = `${depan ? `${depan} ` : ''}${nama}${belakang ? `, ${belakang}` : ''}`;
  if (format === 'gelar') return denganGelar;
  if (format === 'nama') return nama;
  const prefiks = j.guru_jenis_kelamin === 'P' ? 'Usth.' : 'Ust.';
  return format === 'prefiks_gelar' ? `${prefiks} ${denganGelar}` : `${prefiks} ${nama}`;
}

/** Opsi penentu isi sel matriks. */
export interface OpsiGaris {
  tampilan: TampilanJadwal;
  formatMapel: FormatMapel;
  formatGuru: FormatGuru;
}

/**
 * Baris-baris yang benar-benar digambar di dalam sel matriks.
 *
 *  Satu sumber kebenaran untuk dua pemakai: `renderSel` menggambarnya, dan
 *  `barisSel` kolom ([[`BarisSel`]]) mengukurnya untuk AutoFit. Kalau
 *  AutoFit mengukur baris yang tak digambar (atau tak mengukur yang
 *  digambar), lebar kolom meleset diam-diam — untuk sel dua baris
 *  (mapel di atas guru di bawah) AutoFit mengukur teksnya utuh, seolah
 *  keduanya bersebelahan, sehingga kolom selalu lebih lebar dari isinya.
 *
 *  Slot non-pelajaran terkunci (tak bisa diisi mapel/guru) dan tetap punya
 *  satu baris: nama slot atau jenisnya.
 */
export function garisSelMatriks(
  slot: SlotJadwal | undefined,
  jadwal: JadwalBaris | undefined,
  opsi: OpsiGaris,
): GarisSel[] {
  if (slot === undefined) return [];
  if (slot.jenis !== 'pelajaran') {
    return [{ teks: slot.nama_slot ?? JENIS_SLOT_LABEL[slot.jenis], gaya: 'slot' }];
  }
  if (jadwal === undefined) return [];
  const tanpaMapel = jadwal.mata_pelajaran_id === null;
  const mapel = tanpaMapel ? '' : formatMapelBaris(jadwal, opsi.formatMapel);
  const guru = formatGuruBaris(jadwal, opsi.formatGuru);
  if (opsi.tampilan === 'mapel') return mapel === '' ? [] : [{ teks: mapel, gaya: 'penuh' }];
  if (opsi.tampilan === 'guru') return [{ teks: guru || '—', gaya: 'penuh' }];

  if (tanpaMapel) return guru === '' ? [] : [{ teks: guru, gaya: 'penuh' }];
  const baris: GarisSel[] = [{ teks: mapel, gaya: 'mapel' }];
  if (guru !== '') baris.push({ teks: guru, gaya: 'guru_muda' });
  return baris;
}
