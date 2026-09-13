/** Registri halaman: sumber tunggal judul/deskripsi untuk tab dokumen & ribbon. */
export interface HalamanDef {
  to: string;
  label: string;
  deskripsi?: string;
  /** Kategori tab ribbon. */
  tab: 'beranda' | 'master' | 'psb' | 'santri' | 'keuangan' | 'pengaturan';
  /** Punya grid tabel (memunculkan tab ribbon "Tabel"). */
  grid?: boolean;
}

export const HALAMAN: HalamanDef[] = [
  { to: '/', label: 'Dashboard', deskripsi: 'Ringkasan data pesantren.', tab: 'beranda' },
  {
    to: '/users',
    label: 'Pengguna',
    deskripsi: 'Role diri sendiri terkunci untuk semua peran. Baris pemegang admin/super_admin hanya bisa diubah super_admin; hanya super_admin yang dapat memberi role admin/super_admin.',
    tab: 'master',
    grid: true,
  },
  {
    to: '/lembaga',
    label: 'Lembaga',
    deskripsi: 'Tambah/ubah/hapus lembaga hanya super_admin.',
    tab: 'master',
    grid: true,
  },
  { to: '/tahun-ajaran', label: 'Tahun Ajaran', tab: 'master', grid: true },
  { to: '/kelas', label: 'Kelas', tab: 'master', grid: true },
  { to: '/referensi', label: 'Referensi', tab: 'master', grid: true },
  { to: '/psb', label: 'PSB — Antrean Pendaftaran', tab: 'psb', grid: true },
  { to: '/kegiatan-psb', label: 'Kegiatan PSB', tab: 'psb', grid: true },
  {
    to: '/dokumen-wajib',
    label: 'Dokumen Wajib per Lembaga',
    deskripsi: 'Ketentuan per kegiatan PSB. Wajib = penekanan saja (tidak menahan pendaftaran); checklist otomatis dibuat untuk santri saat ACC.',
    tab: 'psb',
    grid: true,
  },
  { to: '/santri', label: 'Data Santri', tab: 'santri', grid: true },
  { to: '/siklus', label: 'Siklus Santri (Mutasi & Alumni)', tab: 'santri', grid: true },
  { to: '/pengajuan-biodata', label: 'Pengajuan Biodata', tab: 'santri', grid: true },
  { to: '/pos', label: 'Pos Keuangan', tab: 'keuangan', grid: true },
  { to: '/tarif', label: 'Tarif Biaya', tab: 'keuangan', grid: true },
  { to: '/keuangan', label: 'Keuangan', tab: 'keuangan', grid: true },
  { to: '/pengaturan/tampilan', label: 'Tampilan', tab: 'pengaturan' },
  { to: '/pengaturan/bagian', label: 'Bagian UI', tab: 'pengaturan' },
  { to: '/pengaturan/server', label: 'Server', tab: 'pengaturan' },
];

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
