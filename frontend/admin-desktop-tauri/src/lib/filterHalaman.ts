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
  mode: Partial<ModeSemuaFilterGlobal> = {},
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
  // Mode bawaan per kunci bisa ditimpa halaman (mis. halaman yang memang
  // bekerja dengan beberapa kelas sekaligus → `kelas: 'multiple'`).
  return { filter, mode: { ...MODE_BAWAAN, ...mode }, tampil: hasil };
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
  dokumen_guru_lihat: buatKonfigurasi(FILTER_KELULUSAN),
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
  // Degree + kelas dipakai rail filter tab Tagihan (crosstab), bukan TopBar.
  keuangan: buatKonfigurasi(FILTER_AKADEMIK, { tingkat: true, kelas: true }),
  // Halaman Dispensasi: Jenjang (lembaga) + Tahun Ajaran tampil di TopBar —
  // dipakai daftar SANTRI-nya; tingkat & kelas masuk daftar relevan supaya
  // rail tabel santri hidup (lihat FilterRail: `tampil` saja tak cukup).
  // Daftar DISPENSASI-nya sendiri tetap tak disaring (paket tak terikat TA).
  keuangan_dispensasi: buatKonfigurasi(FILTER_AKADEMIK, { tingkat: true, kelas: true }),
  // Halaman Pembayaran (kasir): Jenjang (lembaga) + Tahun Ajaran tampil di
  // TopBar; kelas masuk daftar relevan supaya rail KELAS tabel santri di kartu
  // Pilih Santri hidup (lihat FilterRail: `tampil` saja tak cukup). Tingkat
  // sengaja tak relevan agar relnya tak tampil (kasir menyaring per kelas).
  pembayaran: buatKonfigurasi(['lembaga', 'tahun_ajaran', 'kelas'], { kelas: true }),
  rekap_santri: buatKonfigurasi(FILTER_REKAP),
  pengajuan_biodata: buatKonfigurasi([]),
  // Modul Penilaian: master hanya butuh jenjang (lembaga) + tahun ajaran
  // (komponen/bobot, KKM, predikat, ekskul per TA).
  penilaian_master: buatKonfigurasi(['lembaga', 'tahun_ajaran']),
  // Impor: lingkup nilai = jenjang + TA + semester + kelas (kolom mapel
  // template mengikuti kelas terpilih).
  penilaian_impor: buatKonfigurasi(FILTER_SEMUA, { kelas: true }),
  // Leger: santri × mapel per jenjang/TA/semester, rail tingkat & kelas hidup.
  penilaian_leger: buatKonfigurasi(FILTER_SEMUA, { tingkat: true, kelas: true }),
  // Rapor: per kelas (cetak massal) — tingkat & kelas masuk daftar relevan.
  penilaian_rapor: buatKonfigurasi(FILTER_SEMUA, { tingkat: true, kelas: true }),
  // Modul Mapel & Pengampu (BLOK 5): mapel hanya terikat jenjang; pengampu
  // terangkai ke kelas (jenjang + TA) — kelas dipilih lewat rail TINGKAT +
  // KELAS di kiri tabel pengampu (boleh beberapa kelas sekaligus, tabelnya
  // lalu punya kolom "Kelas"). Jadwal masih memakai pemilih kelas di dalam
  // halaman.
  kurikulum_mapel: buatKonfigurasi(['lembaga']),
  // Pengampu: rail kelas mulai dalam mode JAMAK — tabelnya memang menampilkan
  // pengampu beberapa kelas sekaligus (ada kolom "Kelas"), jadi mode tunggal
  // bawaan akan menyembunyikan semua kelas terpilih selain yang pertama.
  kurikulum_pengampu: buatKonfigurasi(
    FILTER_AKADEMIK,
    { tingkat: true, kelas: true },
    { kelas: 'multiple', tingkat: 'multiple' },
  ),
  kurikulum_jadwal: buatKonfigurasi(FILTER_AKADEMIK, { tingkat: true, kelas: true }),
  pegawai: buatKonfigurasi([]),
  pegawai_penempatan: buatKonfigurasi(['lembaga']),
  pegawai_akun: buatKonfigurasi(['lembaga']),
  pegawai_keaktifan: buatKonfigurasi(FILTER_KELULUSAN),
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
