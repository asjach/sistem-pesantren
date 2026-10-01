export const KUNCI_FILTER_GLOBAL = [
  'lembaga',
  'tahun_ajaran',
  'semester',
  'tingkat',
  'kelas',
] as const;

export type KunciFilterGlobal = (typeof KUNCI_FILTER_GLOBAL)[number];
export type ModeFilterGlobal = 'single' | 'multiple';
export type TampilFilterGlobal = Record<KunciFilterGlobal, boolean>;
export type ModeSemuaFilterGlobal = Record<KunciFilterGlobal, ModeFilterGlobal>;

export interface KonfigurasiFilterHalaman {
  filter: readonly KunciFilterGlobal[];
  mode: ModeSemuaFilterGlobal;
  tampil: TampilFilterGlobal;
}

export const TAMPIL_BAWAAN_GLOBAL: TampilFilterGlobal = {
  lembaga: true,
  tahun_ajaran: true,
  semester: true,
  tingkat: false,
  kelas: false,
};

const MODE_BAWAAN: ModeSemuaFilterGlobal = {
  lembaga: 'single',
  tahun_ajaran: 'single',
  semester: 'single',
  tingkat: 'single',
  kelas: 'single',
};

function buatKonfigurasi(
  filter: readonly KunciFilterGlobal[],
  tampil: Partial<TampilFilterGlobal> = {},
): KonfigurasiFilterHalaman {
  const hasil: TampilFilterGlobal = {
    lembaga: false,
    tahun_ajaran: false,
    semester: false,
    tingkat: false,
    kelas: false,
  };
  for (const kunci of KUNCI_FILTER_GLOBAL) {
    if (filter.includes(kunci)) hasil[kunci] = tampil[kunci] ?? TAMPIL_BAWAAN_GLOBAL[kunci];
  }
  return { filter, mode: { ...MODE_BAWAAN }, tampil: hasil };
}

const FILTER_SEMUA: readonly KunciFilterGlobal[] = ['lembaga', 'tahun_ajaran', 'semester', 'tingkat', 'kelas'];
const FILTER_AKADEMIK: readonly KunciFilterGlobal[] = ['lembaga', 'tahun_ajaran', 'tingkat', 'kelas'];
const FILTER_PSB: readonly KunciFilterGlobal[] = ['lembaga'];
const FILTER_MI_MD: readonly KunciFilterGlobal[] = ['tahun_ajaran', 'semester', 'tingkat', 'kelas'];
const FILTER_KELULUSAN: readonly KunciFilterGlobal[] = ['lembaga', 'tahun_ajaran'];
const FILTER_KELAS: readonly KunciFilterGlobal[] = ['lembaga', 'tahun_ajaran', 'tingkat'];
const FILTER_REKAP: readonly KunciFilterGlobal[] = ['lembaga', 'tahun_ajaran', 'semester'];

export const KONFIGURASI_FILTER_HALAMAN = {
  dashboard: buatKonfigurasi([]),
  users: buatKonfigurasi([]),
  lembaga: buatKonfigurasi([]),
  tahun_ajaran: buatKonfigurasi(['lembaga']),
  pengaturan_semester: buatKonfigurasi([]),
  kelas: buatKonfigurasi(FILTER_KELAS, { tingkat: true }),
  referensi: buatKonfigurasi(['lembaga']),
  pengaturan_kamus_label: buatKonfigurasi([]),
  psb_pendaftar: buatKonfigurasi(FILTER_PSB),
  psb_terdaftar: buatKonfigurasi(FILTER_PSB),
  psb_daftar_ulang: buatKonfigurasi(FILTER_PSB),
  psb_diterima: buatKonfigurasi(FILTER_PSB),
  psb_mengundurkan_diri: buatKonfigurasi(FILTER_PSB),
  psb_ditolak: buatKonfigurasi(FILTER_PSB),
  kegiatan_psb: buatKonfigurasi([]),
  dokumen_santri: buatKonfigurasi(['lembaga']),
  dokumen_santri_tambah: buatKonfigurasi(FILTER_SEMUA, { tingkat: true, kelas: true }),
  dokumen_santri_lihat: buatKonfigurasi(FILTER_SEMUA, { tingkat: true, kelas: true }),
  dokumen_guru: buatKonfigurasi(['lembaga']),
  dokumen_guru_tambah: buatKonfigurasi(FILTER_KELULUSAN),
  dokumen_madrasah: buatKonfigurasi(['lembaga']),
  santri: buatKonfigurasi(['lembaga']),
  keanggotaan: buatKonfigurasi(['lembaga']),
  mi_md: buatKonfigurasi(FILTER_MI_MD, { tingkat: true, kelas: true }),
  riwayat_belajar: buatKonfigurasi(FILTER_AKADEMIK, { tingkat: true, kelas: true }),
  daftar_kelas: buatKonfigurasi(FILTER_SEMUA, { tingkat: true, kelas: true }),
  pindah_kelas: buatKonfigurasi(FILTER_SEMUA, { tingkat: true, kelas: true }),
  mutasi_keluar: buatKonfigurasi(FILTER_SEMUA, { tingkat: true, kelas: true }),
  kenaikan: buatKonfigurasi(['lembaga', 'tahun_ajaran', 'tingkat'], { tingkat: true }),
  kelulusan: buatKonfigurasi(FILTER_KELULUSAN),
  rekap_santri: buatKonfigurasi(FILTER_REKAP),
  pengajuan_biodata: buatKonfigurasi([]),
  pegawai: buatKonfigurasi([]),
  pegawai_penempatan: buatKonfigurasi(['lembaga']),
  pegawai_akun: buatKonfigurasi(['lembaga']),
  pegawai_keaktifan: buatKonfigurasi(FILTER_KELULUSAN),
  pengaturan_tampilan: buatKonfigurasi(['lembaga']),
  pengaturan_izin: buatKonfigurasi([]),
  pengaturan_server: buatKonfigurasi([]),
} satisfies Record<string, KonfigurasiFilterHalaman>;

const KONFIGURASI_KOSONG = buatKonfigurasi([]);

export function konfigurasiFilterHalaman(pageKey: string): KonfigurasiFilterHalaman {
  if (pageKey.startsWith('psb_')) return KONFIGURASI_FILTER_HALAMAN.psb_pendaftar;
  return KONFIGURASI_FILTER_HALAMAN[pageKey as keyof typeof KONFIGURASI_FILTER_HALAMAN] ?? KONFIGURASI_KOSONG;
}

export function tampilEfektifFilterHalaman(
  konfigurasi: KonfigurasiFilterHalaman,
  perubahan: Partial<TampilFilterGlobal> = {},
): TampilFilterGlobal {
  const hasil: TampilFilterGlobal = {
    lembaga: false,
    tahun_ajaran: false,
    semester: false,
    tingkat: false,
    kelas: false,
  };
  for (const kunci of konfigurasi.filter) {
    hasil[kunci] = perubahan[kunci] ?? konfigurasi.tampil[kunci];
  }
  return hasil;
}
