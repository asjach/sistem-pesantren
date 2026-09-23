/** Registri halaman: sumber tunggal judul/deskripsi/ikon untuk sidebar & judul. */
import {
  BadgeCheck,
  BookMarked,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronUp,
  ClipboardCheck,
  ClipboardList,
  Copy,
  FileCheck2,
  FolderOpen,
  GraduationCap,
  History,
  Home,
  Landmark,
  LogOut,
  MoveHorizontal,
  NotebookTabs,
  Palette,
  Pin,
  ReceiptText,
  ScrollText,
  Server,
  Undo2,
  UserCheck,
  Users,
  UserX,
  type Ikon,
} from '@/icons';

/** Kategori navigasi (grup di sidebar). */
export type TabKategori = 'beranda' | 'master' | 'santri' | 'pengaturan';

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
  /** Izin matriks untuk melihat halaman (`modul.lihat`). */
  permission: string;
}

export const HALAMAN: HalamanDef[] = [
  { to: '/', label: 'Dashboard', deskripsi: 'Ringkasan data pesantren.', tab: 'beranda', icon: Home, permission: 'dashboard.lihat' },
  {
    to: '/users',
    label: 'Pengguna',
    deskripsi: 'Role diri sendiri terkunci untuk semua peran. Baris pemegang admin/super_admin hanya bisa diubah super_admin; hanya super_admin yang dapat memberi role admin/super_admin.',
    tab: 'master',
    grid: true,
    icon: Users,
    permission: 'pengguna.lihat',
  },
  {
    to: '/lembaga',
    label: 'Lembaga',
    deskripsi: 'Tambah/ubah/hapus lembaga hanya super_admin.',
    tab: 'master',
    grid: true,
    icon: Landmark,
    permission: 'lembaga.lihat',
  },
  { to: '/tahun-ajaran', label: 'Tahun Ajaran', tab: 'master', grid: true, icon: CalendarDays, permission: 'tahun_ajaran.lihat' },
  { to: '/kelas', label: 'Kelas', tab: 'master', grid: true, icon: BookOpen, permission: 'kelas.lihat' },
  { to: '/referensi', label: 'Referensi', tab: 'master', grid: true, icon: BookMarked, permission: 'referensi.lihat' },
  { to: '/psb/pendaftar', label: 'Pendaftar', tab: 'santri', sub: 'antrean', grid: true, icon: UserCheck, permission: 'psb.lihat' },
  { to: '/psb/terdaftar', label: 'Terdaftar', tab: 'santri', sub: 'antrean', grid: true, icon: BadgeCheck, permission: 'psb.lihat' },
  { to: '/psb/daftar-ulang', label: 'Daftar Ulang', tab: 'santri', sub: 'antrean', grid: true, icon: ClipboardCheck, permission: 'psb.lihat' },
  { to: '/psb/diterima', label: 'Diterima', tab: 'santri', sub: 'antrean', grid: true, icon: CheckCircle2, permission: 'psb.lihat' },
  { to: '/psb/mengundurkan-diri', label: 'Mengundurkan Diri', tab: 'santri', sub: 'antrean', grid: true, icon: Undo2, permission: 'psb.lihat' },
  { to: '/psb/ditolak', label: 'Ditolak', tab: 'santri', sub: 'antrean', grid: true, icon: UserX, permission: 'psb.lihat' },
  { to: '/kegiatan-psb', label: 'Kegiatan PSB', tab: 'santri', sub: 'psb', grid: true, icon: CalendarRange, permission: 'kegiatan_psb.lihat' },
  {
    to: '/dokumen-wajib',
    label: 'Dokumen PSB',
    deskripsi: 'Ketentuan per kegiatan PSB. Wajib = penekanan saja (tidak menahan pendaftaran); checklist otomatis dibuat untuk santri saat ACC.',
    tab: 'santri',
    sub: 'psb',
    grid: true,
    icon: FileCheck2,
    permission: 'dokumen_wajib.lihat',
  },
  { to: '/santri', label: 'Buku Induk', tab: 'santri', sub: 'identitas', grid: true, icon: GraduationCap, permission: 'santri.lihat' },
  { to: '/keanggotaan', label: 'Santri Per Lembaga', tab: 'santri', sub: 'penempatan', grid: true, icon: BadgeCheck, permission: 'santri.lihat' },
  { to: '/mi-md', label: 'MI-MD', tab: 'santri', sub: 'penempatan', grid: true, icon: MoveHorizontal, permission: 'rekap_santri.lihat' },
  { to: '/riwayat-belajar', label: 'Riwayat Belajar', tab: 'santri', sub: 'penempatan', grid: true, icon: History, permission: 'riwayat_belajar.lihat' },
  { to: '/pindah-semester', label: 'Pindah Semester', tab: 'santri', sub: 'penempatan', grid: true, icon: Copy, permission: 'kenaikan.lihat' },
  { to: '/daftar-kelas', label: 'Daftar Kelas', tab: 'santri', grid: true, icon: ClipboardList, permission: 'daftar_kelas.lihat' },
  { to: '/pindah-kelas', label: 'Pindah Kelas', tab: 'santri', sub: 'mutasi', grid: true, icon: MoveHorizontal, permission: 'pindah_kelas.lihat' },
  { to: '/mutasi-keluar', label: 'Mutasi Keluar', tab: 'santri', sub: 'mutasi', grid: true, icon: LogOut, permission: 'mutasi_keluar.lihat' },
  { to: '/kenaikan', label: 'Kenaikan Kelas', tab: 'santri', sub: 'akademik', grid: true, icon: ChevronUp, permission: 'kenaikan.lihat' },
  { to: '/kelulusan', label: 'Kelulusan', tab: 'santri', sub: 'akademik', grid: true, icon: GraduationCap, permission: 'kelulusan.lihat' },
  { to: '/rekap-santri', label: 'Rekap Santri', tab: 'santri', grid: true, icon: ReceiptText, permission: 'rekap_santri.lihat' },
  { to: '/pengajuan-biodata', label: 'Pengajuan Biodata', tab: 'santri', sub: 'identitas', grid: true, icon: NotebookTabs, permission: 'pengajuan_biodata.lihat' },
  { to: '/pengaturan/tampilan', label: 'Tampilan', tab: 'pengaturan', icon: Palette, permission: 'tampilan.lihat' },
  {
    to: '/pengaturan/semester',
    label: 'Semester',
    deskripsi: 'Aktivasi semester berjalan per lembaga. Hanya super_admin.',
    tab: 'pengaturan',
    grid: true,
    icon: CalendarCheck,
    permission: 'semester.aktivasi',
  },
  {
    to: '/pengaturan/kamus-label',
    label: 'Kamus Label',
    deskripsi: 'Satu acuan nama header, perataan, dan lebar kolom untuk semua halaman (berbasis tabel database). Urut bawaan per endpoint juga diatur di sini. Hanya super_admin.',
    tab: 'pengaturan',
    grid: true,
    icon: NotebookTabs,
    permission: 'kamus_label.lihat',
  },
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
}

/** Urutan & label grup sidebar (hanya grup yang punya halaman yang tampil).
 *  Grup multi-halaman dirender sebagai baris induk collapsible (ikon +
 *  chevron) dengan anak menjorok; grup satu halaman jadi tautan langsung. */
export const NAV_GRUP: GrupNav[] = [
  { id: 'beranda', label: 'Beranda', icon: Home },
  { id: 'master', label: 'Data Induk', icon: FolderOpen },
  {
    id: 'santri',
    label: 'Santri',
    icon: GraduationCap,
    anak: [
      {
        id: 'psb',
        label: 'PSB',
        icon: ClipboardCheck,
        anak: [{ id: 'antrean', label: 'Antrean', icon: ClipboardList }],
      },
      // Daftar Kelas & Rekap Santri (halaman langsung) tampil di sini.
      { langsung: true },
      { id: 'identitas', label: 'Identitas', icon: NotebookTabs },
      { id: 'penempatan', label: 'Penempatan', icon: Pin },
      { id: 'mutasi', label: 'Mutasi', icon: MoveHorizontal },
      { id: 'akademik', label: 'Akademik', icon: ScrollText },
    ],
  },
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

/** Halaman langsung grup (tanpa subgrup), mengikuti urutan registri. */
export function halamanGrupLangsung(grup: TabKategori): HalamanDef[] {
  return HALAMAN.filter((h) => h.tab === grup && !h.sub);
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
  return HALAMAN.filter((h) => h.tab === grup && h.sub === sub);
}

/** Halaman yang cocok dengan rute (prefix terpanjang menang). */
export function halamanDariPath(pathname: string): HalamanDef | null {
  let best: HalamanDef | null = null;
  for (const h of HALAMAN) {
    if (h.to === '/') {
      if (pathname === '/') return h;
      continue;
    }
    if (pathname === h.to || pathname.startsWith(`${h.to}/`)) {
      if (!best || h.to.length > best.to.length) best = h;
    }
  }
  return best;
}
