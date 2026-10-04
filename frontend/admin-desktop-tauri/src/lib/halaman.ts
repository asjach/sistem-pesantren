/** Registri halaman: sumber tunggal judul/deskripsi/ikon untuk sidebar & judul. */
import {
  BadgeCheck,
  CalendarCheck,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Eye,
  FileCheck2,
  FolderOpen,
  GraduationCap,
  Home,
  Palette,
  Pin,
  ScrollText,
  Server,
  UserCheck,
  Users,
  Wallet,
  type Ikon,
} from '@/icons';

/** Kategori navigasi (grup di sidebar). */
export type TabKategori = 'beranda' | 'master' | 'psb' | 'santri' | 'pegawai' | 'dokumen' | 'keuangan' | 'pengaturan';

/** Tab dalam satu halaman gabungan (mis. Data Induk punya 6 tab). */
export interface TabHalamanDef {
  /** Rute tab. Tetap rute tersendiri supaya pengaturan halaman, filter,
   *  tautan lama, dan guard izin per tab tidak berubah. */
  to: string;
  label: string;
  /** Izin matriks untuk melihat tab (`modul.lihat`). */
  permission: string;
}

export interface HalamanDef {
  to: string;
  label: string;
  deskripsi?: string;
  /** Kategori tab sidebar. */
  tab: TabKategori;
  /** Subgrup satu tingkat dalam tab (mis. `psb` = PSB di dalam Santri). */
  sub?: string;
  /** Punya grid tabel (memunculkan tools tabel di ribbon). */
  grid?: boolean;
  /** Ikon di sidebar. */
  icon: Ikon;
  /** Izin matriks untuk melihat halaman (`modul.lihat`). Kosong untuk halaman
   *  gabungan: izinnya diambil dari tiap tab (`tabHalaman`), cukup salah satu. */
  permission?: string;
  /** Sub-halaman yang tampil sebagai tab dalam SATU halaman (mis. Data Induk
   *  menampung Pengguna … Referensi). `halamanDariPath` mengenali rute tiap
   *  tab sebagai halaman ini. */
  tabHalaman?: TabHalamanDef[];
  /** Tampil di sidebar dan pencarian topbar. Default true. Halaman detail
   *  (editor, isi & cetak) memakai false: tetap punya judul dari
   *  `halamanDariPath`, tapi tidak perlu entri menu. */
  menu?: boolean;
}

/** Halaman Data Induk: satu halaman berisi beberapa tab (pola sama dengan
 *  Keuangan). Rute tiap tab tetap rute lamanya agar pengaturan halaman,
 *  filter, tautan lama, dan izin per halaman lestari. */
export const HALAMAN_DATA_INDUK: HalamanDef = {
  to: '/data-induk',
  label: 'Data Induk',
  deskripsi: 'Data acuan pesantren: pengguna, lembaga, tahun ajaran, semester, kelas, buku induk, referensi.',
  tab: 'master',
  grid: true,
  icon: FolderOpen,
  tabHalaman: [
    { to: '/users', label: 'Pengguna', permission: 'pengguna.lihat' },
    { to: '/lembaga', label: 'Lembaga', permission: 'lembaga.lihat' },
    { to: '/tahun-ajaran', label: 'Tahun Ajaran', permission: 'tahun_ajaran.lihat' },
    { to: '/pengaturan/semester', label: 'Semester', permission: 'semester.aktivasi' },
    { to: '/kelas', label: 'Kelas', permission: 'kelas.lihat' },
    { to: '/santri', label: 'Buku Induk', permission: 'santri.lihat' },
    { to: '/referensi', label: 'Referensi', permission: 'referensi.lihat' },
  ],
};

/** Halaman Penempatan: satu halaman berisi tiga tab penempatan santri
 *  (Santri Per Lembaga, MI-MD, Riwayat Belajar) — pola sama dengan Data Induk;
 *  rute tiap tab tetap rute lamanya. */
export const HALAMAN_PENEMPATAN: HalamanDef = {
  to: '/penempatan',
  label: 'Penempatan',
  deskripsi: 'Penempatan santri: santri per lembaga, MI-MD, dan riwayat belajar.',
  tab: 'santri',
  grid: true,
  icon: Pin,
  tabHalaman: [
    { to: '/keanggotaan', label: 'Santri Per Lembaga', permission: 'santri.lihat' },
    { to: '/mi-md', label: 'MI-MD', permission: 'rekap_santri.lihat' },
    { to: '/riwayat-belajar', label: 'Riwayat Belajar', permission: 'riwayat_belajar.lihat' },
  ],
};

/** Halaman Akademik: satu halaman berisi empat tab akademik santri (Pindah
 *  Kelas, Mutasi Keluar, Kenaikan Kelas, Kelulusan) — pola sama dengan
 *  Penempatan; rute tiap tab tetap rute lamanya. */
export const HALAMAN_AKADEMIK: HalamanDef = {
  to: '/akademik',
  label: 'Akademik',
  deskripsi: 'Akademik santri: pindah kelas, mutasi keluar, kenaikan kelas, kelulusan.',
  tab: 'santri',
  grid: true,
  icon: ScrollText,
  tabHalaman: [
    { to: '/pindah-kelas', label: 'Pindah Kelas', permission: 'pindah_kelas.lihat' },
    { to: '/mutasi-keluar', label: 'Mutasi Keluar', permission: 'mutasi_keluar.lihat' },
    { to: '/kenaikan', label: 'Kenaikan Kelas', permission: 'kenaikan.lihat' },
    { to: '/kelulusan', label: 'Kelulusan', permission: 'kelulusan.lihat' },
  ],
};

/** Halaman Santri Aktif: satu halaman berisi tiga tab (Daftar Kelas, Rekap,
 *  Pengajuan Biodata) — pola sama dengan Penempatan; rute tiap tab tetap rute
 *  lamanya. Label halaman "Santri Aktif"; tab pertama tetap "Daftar Kelas". */
export const HALAMAN_SANTRI_AKTIF: HalamanDef = {
  to: '/santri-aktif',
  label: 'Santri Aktif',
  deskripsi: 'Santri aktif: daftar kelas, rekap, dan pengajuan biodata.',
  tab: 'santri',
  grid: true,
  icon: ClipboardList,
  tabHalaman: [
    { to: '/daftar-kelas', label: 'Daftar Kelas', permission: 'daftar_kelas.lihat' },
    { to: '/rekap-santri', label: 'Rekap', permission: 'rekap_santri.lihat' },
    { to: '/pengajuan-biodata', label: 'Pengajuan Biodata', permission: 'pengajuan_biodata.lihat' },
  ],
};

/** Halaman Penempatan (Pegawai): satu halaman berisi tiga tab (Pegawai,
 *  Lembaga Pegawai, Akun Pegawai) — pola sama dengan Penempatan santri;
 *  rute tiap tab tetap rute lamanya. */
export const HALAMAN_PENEMPATAN_PEGAWAI: HalamanDef = {
  to: '/penempatan-pegawai',
  label: 'Penempatan',
  deskripsi: 'Kepegawaian: pegawai, lembaga pegawai, dan akun pegawai.',
  tab: 'pegawai',
  grid: true,
  icon: BadgeCheck,
  tabHalaman: [
    { to: '/pegawai', label: 'Buku Induk PTK', permission: 'pegawai.lihat' },
    { to: '/pegawai-penempatan', label: 'PTK Per Jenjang', permission: 'pegawai.lihat' },
    { to: '/pegawai-akun', label: 'Akun PTK', permission: 'pegawai.lihat' },
  ],
};

export const HALAMAN: HalamanDef[] = [
  { to: '/', label: 'Dashboard', deskripsi: 'Ringkasan data pesantren.', tab: 'beranda', icon: Home, permission: 'dashboard.lihat' },
  HALAMAN_DATA_INDUK,
  { to: '/dokumen-santri', label: 'Daftar Dokumen Santri', deskripsi: 'Berkas dokumen santri (KK, akta, ijazah, dll).', tab: 'dokumen', sub: 'santri', grid: true, icon: FolderOpen, permission: 'dokumen_santri.lihat' },
  { to: '/dokumen-santri/lihat', label: 'Dokumen Santri', deskripsi: 'Pratinjau dokumen per santri (lihat, unduh, ganti).', tab: 'dokumen', sub: 'santri', icon: Eye, permission: 'dokumen_santri.lihat' },
  { to: '/pegawai-keaktifan', label: 'PTK Aktif', tab: 'pegawai', grid: true, icon: CalendarCheck, permission: 'pegawai.lihat' },
  HALAMAN_PENEMPATAN_PEGAWAI,
  { to: '/dokumen-guru', label: 'Daftar Dokumen Pegawai', deskripsi: 'Berkas dokumen pegawai (ijazah, sertifikat, SK, dll).', tab: 'dokumen', sub: 'pegawai', grid: true, icon: FolderOpen, permission: 'dokumen_pegawai.lihat' },
  { to: '/dokumen-guru/lihat', label: 'Dokumen Pegawai', deskripsi: 'Pratinjau dokumen per pegawai (lihat, unduh, ganti).', tab: 'dokumen', sub: 'pegawai', icon: Eye, permission: 'dokumen_pegawai.lihat' },
  { to: '/dokumen-madrasah', label: 'Dokumen Madrasah', deskripsi: 'Berkas tingkat madrasah (izin operasional, akreditasi, SK, dll).', tab: 'dokumen', grid: true, icon: FolderOpen, permission: 'dokumen_lembaga.lihat' },
  { to: '/psb', label: 'Antrean PSB', deskripsi: 'Antrean calon per tahap (Pendaftar, Terdaftar, Daftar Ulang, Diterima, Mengundurkan Diri, Ditolak).', tab: 'psb', grid: true, icon: UserCheck, permission: 'psb.lihat' },
  { to: '/kegiatan-psb', label: 'Kegiatan PSB', tab: 'psb', grid: true, icon: CalendarRange, permission: 'kegiatan_psb.lihat' },
  HALAMAN_SANTRI_AKTIF,
  HALAMAN_PENEMPATAN,
  HALAMAN_AKADEMIK,
  { to: '/keuangan', label: 'Keuangan', deskripsi: 'Tagihan, tunggakan, dan pembayaran santri.', tab: 'keuangan', grid: true, icon: Wallet, permission: 'keuangan.lihat' },
  {
    to: '/pengaturan/izin',
    label: 'Kelola Izin',
    deskripsi: 'Matriks izin role × modul. Hanya super_admin.',
    tab: 'pengaturan',
    grid: true,
    icon: FileCheck2,
    permission: 'izin.lihat',
  },
  {
    to: '/pengaturan/server',
    label: 'Server',
    deskripsi: 'Alamat backend untuk perangkat ini. Hanya super_admin.',
    tab: 'pengaturan',
    icon: Server,
    permission: 'server.lihat',
  },
];

/** Subgrup navigasi (bersarang, mis. Antrean di dalam PSB di dalam Santri).
 *  Id subgrup unik dalam satu tab. */
export interface SubgrupNav {
  id: string;
  label: string;
  icon: Ikon;
  anak?: SubgrupNav[];
}

/** Penanda sisip: halaman langsung grup tampil di posisi ini (di antara
 *  subgrup), bukan selalu di akhir. */
export interface PenandaLangsung {
  langsung: true;
}

/** Entri `anak` grup: subgrup bernama atau penanda sisip halaman langsung. */
export type AnakNav = SubgrupNav | PenandaLangsung;

/** Grup navigasi sidebar/menubar; `anak` = subgrup/penanda sisip halaman
 *  langsung sesuai urutan tampil. */
export interface GrupNav {
  id: TabKategori;
  label: string;
  icon: Ikon;
  anak?: AnakNav[];
  /** Paksa tampil sebagai baris induk collapsible meski hanya berisi satu
   *  halaman (bawaan: grup satu halaman jadi tautan langsung). */
  paksaGrup?: boolean;
}

/** Urutan & label grup sidebar (hanya grup yang punya halaman yang tampil).
 *  Grup multi-halaman dirender sebagai baris induk collapsible (ikon +
 *  chevron) dengan anak menjorok; grup satu halaman jadi tautan langsung. */
export const NAV_GRUP: GrupNav[] = [
  { id: 'beranda', label: 'Beranda', icon: Home },
  { id: 'master', label: 'Data Induk', icon: FolderOpen },
  // PSB kini grup tersendiri (dulu subgrup di dalam Santri), di atas Santri.
  { id: 'psb', label: 'PSB', icon: ClipboardCheck },
  // Santri kini tanpa subgrup: Santri Aktif, Penempatan, Akademik (halaman
  // langsung semua, mengikuti urutan registri).
  { id: 'santri', label: 'Santri', icon: GraduationCap },
  // Grup PTK (kategori `pegawai`): PTK Aktif + Penempatan (Pegawai,
  // Lembaga Pegawai, Akun Pegawai).
  { id: 'pegawai', label: 'PTK', icon: Users },
  {
    id: 'dokumen',
    label: 'Dokumen',
    icon: FolderOpen,
    anak: [
      { id: 'santri', label: 'Santri', icon: GraduationCap },
      { id: 'pegawai', label: 'Pegawai', icon: Users },
      // Dokumen Madrasah (halaman langsung) tampil di sini.
      { langsung: true },
    ],
  },
  { id: 'keuangan', label: 'Keuangan', icon: Wallet },
  { id: 'pengaturan', label: 'Pengaturan', icon: Palette },
];

/** Kunci lipat subgrup (jalur penuh, mis. `santri:psb:antrean`). */
export function kunciSubgrup(grup: TabKategori, ...jalur: string[]): string {
  return [grup, ...jalur].join(':');
}

/** Jalur subgrup dari akar tab ke daun (mis. `['psb', 'antrean']`); null bila
 *  id tak terdaftar. */
export function jalurSubgrup(grup: TabKategori, sub: string): string[] | null {
  const akar = NAV_GRUP.find((g) => g.id === grup)?.anak;
  const cari = (nodes: AnakNav[] | undefined, jejak: string[]): string[] | null => {
    for (const n of nodes ?? []) {
      if ('langsung' in n) continue;
      if (n.id === sub) return [...jejak, n.id];
      const dalam = cari(n.anak, [...jejak, n.id]);
      if (dalam) return dalam;
    }
    return null;
  };
  return cari(akar, []);
}

function diMenu(h: HalamanDef): boolean {
  return h.menu !== false;
}

/** Halaman langsung grup (tanpa subgrup), mengikuti urutan registri. */
export function halamanGrupLangsung(grup: TabKategori): HalamanDef[] {
  return HALAMAN.filter((h) => h.tab === grup && !h.sub && diMenu(h));
}

/** Blok isi grup sesuai urutan `anak`: subgrup bernama atau array halaman
 *  langsung pada posisi penanda `{ langsung: true }`. Tanpa penanda, halaman
 *  langsung diletakkan di akhir (perilaku lama). */
export function blokGrup(grup: TabKategori): (SubgrupNav | HalamanDef[])[] {
  const def = NAV_GRUP.find((g) => g.id === grup);
  const langsung = halamanGrupLangsung(grup);
  const blok: (SubgrupNav | HalamanDef[])[] = [];
  let adaPenanda = false;
  for (const a of def?.anak ?? []) {
    if ('langsung' in a) {
      adaPenanda = true;
      blok.push(langsung);
    } else {
      blok.push(a);
    }
  }
  if (!adaPenanda && langsung.length > 0) blok.push(langsung);
  return blok;
}

/** Halaman satu subgrup, mengikuti urutan registri. */
export function halamanSubgrup(grup: TabKategori, sub: string): HalamanDef[] {
  return HALAMAN.filter((h) => h.tab === grup && h.sub === sub && diMenu(h));
}

/** Semua izin yang membolehkan halaman: izin utama, atau seluruh izin tab
 *  untuk halaman gabungan (mis. Data Induk). Cukup salah satu. */
export function izinHalaman(h: HalamanDef): string[] {
  return [
    ...(h.permission ? [h.permission] : []),
    ...(h.tabHalaman ?? []).map((t) => t.permission),
  ];
}

/** Rute yang dikenali halaman: rutenya sendiri + rute tiap tab. */
function ruteHalaman(h: HalamanDef): string[] {
  return [h.to, ...(h.tabHalaman ?? []).map((t) => t.to)];
}

/** Halaman yang cocok dengan rute (prefix terpanjang menang; rute tab
 *  halaman gabungan ikut dikenali). */
export function halamanDariPath(pathname: string): HalamanDef | null {
  let best: HalamanDef | null = null;
  let panjang = 0;
  for (const h of HALAMAN) {
    for (const rute of ruteHalaman(h)) {
      if (rute === '/') {
        if (pathname === '/') return h;
        continue;
      }
      if ((pathname === rute || pathname.startsWith(`${rute}/`)) && rute.length > panjang) {
        best = h;
        panjang = rute.length;
      }
    }
  }
  return best;
}
