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
  ScrollText,
  Server,
  Users,
  Wallet,
  type Ikon,
} from '@/icons';

/** Kategori navigasi (grup di sidebar). */
export type TabKategori = 'beranda' | 'master' | 'psb' | 'santri' | 'keuangan' | 'pengaturan';

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
}

export const HALAMAN: HalamanDef[] = [
  { to: '/', label: 'Dashboard', deskripsi: 'Ringkasan data pesantren.', tab: 'beranda', icon: Home },
  {
    to: '/users',
    label: 'Pengguna',
    deskripsi: 'Role diri sendiri terkunci untuk semua peran. Baris pemegang admin/super_admin hanya bisa diubah super_admin; hanya super_admin yang dapat memberi role admin/super_admin.',
    tab: 'master',
    grid: true,
    icon: Users,
  },
  {
    to: '/lembaga',
    label: 'Lembaga',
    deskripsi: 'Tambah/ubah/hapus lembaga hanya super_admin.',
    tab: 'master',
    grid: true,
    icon: Landmark,
  },
  { to: '/tahun-ajaran', label: 'Tahun Ajaran', tab: 'master', grid: true, icon: CalendarDays },
  { to: '/kelas', label: 'Kelas', tab: 'master', grid: true, icon: BookOpen },
  { to: '/referensi', label: 'Referensi', tab: 'master', grid: true, icon: BookMarked },
  { to: '/psb', label: 'PSB — Antrean Pendaftaran', tab: 'psb', grid: true, icon: ClipboardList },
  { to: '/kegiatan-psb', label: 'Kegiatan PSB', tab: 'psb', grid: true, icon: CalendarRange },
  {
    to: '/dokumen-wajib',
    label: 'Dokumen Wajib per Lembaga',
    deskripsi: 'Ketentuan per kegiatan PSB. Wajib = penekanan saja (tidak menahan pendaftaran); checklist otomatis dibuat untuk santri saat ACC.',
    tab: 'psb',
    grid: true,
    icon: FileCheck2,
  },
  { to: '/santri', label: 'Data Santri', tab: 'santri', grid: true, icon: GraduationCap },
  { to: '/riwayat-belajar', label: 'Riwayat Belajar', tab: 'santri', grid: true, icon: History },
  { to: '/daftar-kelas', label: 'Daftar Kelas', tab: 'santri', grid: true, icon: ClipboardList },
  { to: '/pindah-kelas', label: 'Pindah Kelas', tab: 'santri', grid: true, icon: MoveHorizontal },
  { to: '/kenaikan', label: 'Kenaikan Kelas', tab: 'santri', grid: true, icon: ChevronUp },
  { to: '/kelulusan', label: 'Kelulusan', tab: 'santri', grid: true, icon: GraduationCap },
  { to: '/rekap-santri', label: 'Rekap Santri', tab: 'santri', grid: true, icon: ReceiptText },
  { to: '/mutasi-keluar', label: 'Mutasi Keluar', tab: 'santri', grid: true, icon: LogOut },
  { to: '/pengajuan-biodata', label: 'Pengajuan Biodata', tab: 'santri', grid: true, icon: NotebookTabs },
  { to: '/pos', label: 'Pos Keuangan', tab: 'keuangan', grid: true, icon: Wallet },
  { to: '/tarif', label: 'Tarif Biaya', tab: 'keuangan', grid: true, icon: ReceiptText },
  { to: '/keuangan', label: 'Keuangan', tab: 'keuangan', grid: true, icon: ScrollText },
  { to: '/pengaturan/tampilan', label: 'Tampilan', tab: 'pengaturan', icon: Palette },
  {
    to: '/pengaturan/tampilan-standar',
    label: 'Tampilan Standar',
    deskripsi: 'Super admin menyebar standar tampilan ke seluruh lembaga; admin lembaga mengatur salinan lembaganya.',
    tab: 'pengaturan',
    icon: Paintbrush,
  },
  { to: '/pengaturan/server', label: 'Server', tab: 'pengaturan', icon: Server },
];

/** Urutan & label grup sidebar (hanya grup yang punya halaman yang tampil). */
export const NAV_GRUP: { id: TabKategori; label: string }[] = [
  { id: 'beranda', label: 'Beranda' },
  { id: 'master', label: 'Data Induk' },
  { id: 'psb', label: 'PSB' },
  { id: 'santri', label: 'Kesiswaan' },
  { id: 'keuangan', label: 'Keuangan' },
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
