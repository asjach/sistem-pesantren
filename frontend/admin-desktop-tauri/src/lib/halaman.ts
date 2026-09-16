/** Registri halaman: sumber tunggal judul/deskripsi/ikon untuk sidebar & judul. */
import {
  BookMarked,
  BookOpen,
  CalendarDays,
  CalendarRange,
  ChevronUp,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  History,
  Home,
  Landmark,
  LogOut,
  MoveHorizontal,
  NotebookTabs,
  Paintbrush,
  Palette,
  ReceiptText,
  Server,
  Users,
  type Ikon,
} from '@/icons';

/** Kategori navigasi (grup di sidebar). */
export type TabKategori = 'beranda' | 'master' | 'psb' | 'santri' | 'pengaturan';

export interface HalamanDef {
  to: string;
  label: string;
  deskripsi?: string;
  /** Kategori tab sidebar. */
  tab: TabKategori;
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
  { to: '/psb', label: 'PSB — Antrean Pendaftaran', tab: 'psb', grid: true, icon: ClipboardList, permission: 'psb.lihat' },
  { to: '/kegiatan-psb', label: 'Kegiatan PSB', tab: 'psb', grid: true, icon: CalendarRange, permission: 'kegiatan_psb.lihat' },
  {
    to: '/dokumen-wajib',
    label: 'Dokumen Wajib per Lembaga',
    deskripsi: 'Ketentuan per kegiatan PSB. Wajib = penekanan saja (tidak menahan pendaftaran); checklist otomatis dibuat untuk santri saat ACC.',
    tab: 'psb',
    grid: true,
    icon: FileCheck2,
    permission: 'dokumen_wajib.lihat',
  },
  { to: '/santri', label: 'Data Santri', tab: 'santri', grid: true, icon: GraduationCap, permission: 'santri.lihat' },
  { to: '/riwayat-belajar', label: 'Riwayat Belajar', tab: 'santri', grid: true, icon: History, permission: 'riwayat_belajar.lihat' },
  { to: '/daftar-kelas', label: 'Daftar Kelas', tab: 'santri', grid: true, icon: ClipboardList, permission: 'daftar_kelas.lihat' },
  { to: '/pindah-kelas', label: 'Pindah Kelas', tab: 'santri', grid: true, icon: MoveHorizontal, permission: 'pindah_kelas.lihat' },
  { to: '/kenaikan', label: 'Kenaikan Kelas', tab: 'santri', grid: true, icon: ChevronUp, permission: 'kenaikan.lihat' },
  { to: '/kelulusan', label: 'Kelulusan', tab: 'santri', grid: true, icon: GraduationCap, permission: 'kelulusan.lihat' },
  { to: '/rekap-santri', label: 'Rekap Santri', tab: 'santri', grid: true, icon: ReceiptText, permission: 'rekap_santri.lihat' },
  { to: '/mutasi-keluar', label: 'Mutasi Keluar', tab: 'santri', grid: true, icon: LogOut, permission: 'mutasi_keluar.lihat' },
  { to: '/pengajuan-biodata', label: 'Pengajuan Biodata', tab: 'santri', grid: true, icon: NotebookTabs, permission: 'pengajuan_biodata.lihat' },
  { to: '/pengaturan/tampilan', label: 'Tampilan', tab: 'pengaturan', icon: Palette, permission: 'tampilan.lihat' },
  {
    to: '/pengaturan/tampilan-standar',
    label: 'Tampilan Standar',
    deskripsi: 'Super admin menyebar standar tampilan ke seluruh lembaga; admin lembaga mengatur salinan lembaganya.',
    tab: 'pengaturan',
    icon: Paintbrush,
    permission: 'tampilan_standar.lihat',
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

/** Urutan & label grup sidebar (hanya grup yang punya halaman yang tampil). */
export const NAV_GRUP: { id: TabKategori; label: string }[] = [
  { id: 'beranda', label: 'Beranda' },
  { id: 'master', label: 'Data Induk' },
  { id: 'psb', label: 'PSB' },
  { id: 'santri', label: 'Kesiswaan' },
  { id: 'pengaturan', label: 'Pengaturan' },
];

/** Halaman per grup sidebar, mengikuti urutan registri. */
export function halamanPerGrup(grup: TabKategori): HalamanDef[] {
  return HALAMAN.filter((h) => h.tab === grup);
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
