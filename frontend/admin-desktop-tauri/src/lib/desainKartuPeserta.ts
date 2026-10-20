import type {
  BarisPesertaPeristiwa, DesainKartuServer, ElemenKartuPeserta,
  FieldKartuPeserta, GayaLatarKartu, PengaturanKartuPeserta, PeristiwaNilai, TipeElemenKartu,
} from '@/api/penilaian';

export type {
  ElemenKartuPeserta, FieldKartuPeserta, GayaLatarKartu, RataTeksKartu, TipeElemenKartu,
} from '@/api/penilaian';

export interface DesainKartuPeserta {
  id: number | `bawaan:${string}`;
  nama: string;
  sumber: 'bawaan' | 'pengguna';
  elemen: ElemenKartuPeserta[];
  warna_latar: string;
  gaya_latar: GayaLatarKartu;
  latar_ada: boolean;
  latar_url: string | null;
}

export interface KonteksKartuPeserta {
  peserta: BarisPesertaPeristiwa;
  peristiwa: PeristiwaNilai;
  semester: string;
  lembaga: string;
}

export const KATALOG_DATA_KARTU: readonly { field: FieldKartuPeserta; label: string }[] = [
  { field: 'nama', label: 'Nama peserta' },
  { field: 'nomor_peserta', label: 'Nomor peserta' },
  { field: 'nis_lokal', label: 'NIS lokal' },
  { field: 'kelas', label: 'Kelas' },
  { field: 'tingkat', label: 'Tingkat' },
  { field: 'peristiwa', label: 'Nama peristiwa' },
  { field: 'tahun_ajaran', label: 'Tahun ajaran' },
  { field: 'semester', label: 'Semester' },
  { field: 'lembaga', label: 'Nama lembaga' },
];

const elemen = (
  id: string,
  tipe: TipeElemenKartu,
  posisi: Pick<ElemenKartuPeserta, 'x' | 'y' | 'lebar' | 'tinggi'>,
  gaya: Partial<ElemenKartuPeserta> = {},
): ElemenKartuPeserta => ({
  id,
  tipe,
  field: null,
  teks: null,
  ukuran_font: 12,
  warna: '#111827',
  tebal: false,
  rata: 'left',
  ...posisi,
  ...gaya,
});

export const DESAIN_BAWAAN_KARTU: readonly DesainKartuPeserta[] = [
  {
    id: 'bawaan:klasik', nama: 'Klasik Pesantren', sumber: 'bawaan',
    warna_latar: '#f8fafc', gaya_latar: 'klasik', latar_ada: false, latar_url: null,
    elemen: [
      elemen('judul', 'teks', { x: 30, y: 8, lebar: 65, tinggi: 10 }, { teks: 'KARTU PESERTA', ukuran_font: 16, warna: '#14532d', tebal: true, rata: 'center' }),
      elemen('lembaga', 'data', { x: 30, y: 20, lebar: 65, tinggi: 9 }, { field: 'lembaga', ukuran_font: 12, warna: '#14532d', tebal: true, rata: 'center' }),
      elemen('foto', 'foto', { x: 6, y: 20, lebar: 20, tinggi: 58 }, { rata: 'center' }),
      elemen('nama', 'data', { x: 31, y: 42, lebar: 62, tinggi: 12 }, { field: 'nama', ukuran_font: 16, tebal: true }),
      elemen('nomor', 'data', { x: 31, y: 57, lebar: 62, tinggi: 10 }, { field: 'nomor_peserta', ukuran_font: 13, tebal: true }),
      elemen('kelas', 'data', { x: 31, y: 70, lebar: 30, tinggi: 9 }, { field: 'kelas', ukuran_font: 11 }),
      elemen('peristiwa', 'data', { x: 31, y: 82, lebar: 62, tinggi: 9 }, { field: 'peristiwa', ukuran_font: 10 }),
    ],
  },
  {
    id: 'bawaan:modern', nama: 'Modern Vertikal', sumber: 'bawaan',
    warna_latar: '#ecfdf5', gaya_latar: 'modern', latar_ada: false, latar_url: null,
    elemen: [
      elemen('lembaga', 'data', { x: 8, y: 8, lebar: 55, tinggi: 9 }, { field: 'lembaga', ukuran_font: 11, warna: '#064e3b', tebal: true }),
      elemen('judul', 'teks', { x: 8, y: 19, lebar: 55, tinggi: 11 }, { teks: 'KARTU PESERTA', ukuran_font: 17, warna: '#065f46', tebal: true }),
      elemen('foto', 'foto', { x: 69, y: 12, lebar: 23, tinggi: 46 }, { rata: 'center' }),
      elemen('nama', 'data', { x: 8, y: 43, lebar: 55, tinggi: 12 }, { field: 'nama', ukuran_font: 16, warna: '#052e16', tebal: true }),
      elemen('nomor', 'data', { x: 8, y: 59, lebar: 55, tinggi: 10 }, { field: 'nomor_peserta', ukuran_font: 13, warna: '#065f46', tebal: true }),
      elemen('kelas', 'data', { x: 8, y: 73, lebar: 40, tinggi: 9 }, { field: 'kelas', ukuran_font: 11 }),
      elemen('tahun', 'data', { x: 8, y: 85, lebar: 55, tinggi: 8 }, { field: 'tahun_ajaran', ukuran_font: 10 }),
    ],
  },
  {
    id: 'bawaan:bersih', nama: 'Bersih Minimal', sumber: 'bawaan',
    warna_latar: '#ffffff', gaya_latar: 'bersih', latar_ada: false, latar_url: null,
    elemen: [
      elemen('judul', 'teks', { x: 7, y: 8, lebar: 86, tinggi: 9 }, { teks: 'KARTU PESERTA', ukuran_font: 14, tebal: true, rata: 'center' }),
      elemen('peristiwa', 'data', { x: 7, y: 19, lebar: 86, tinggi: 8 }, { field: 'peristiwa', ukuran_font: 10, rata: 'center' }),
      elemen('foto', 'foto', { x: 8, y: 35, lebar: 20, tinggi: 50 }, { rata: 'center' }),
      elemen('nama', 'data', { x: 34, y: 38, lebar: 58, tinggi: 12 }, { field: 'nama', ukuran_font: 16, tebal: true }),
      elemen('nomor', 'data', { x: 34, y: 54, lebar: 58, tinggi: 10 }, { field: 'nomor_peserta', ukuran_font: 13, tebal: true }),
      elemen('nis', 'data', { x: 34, y: 67, lebar: 58, tinggi: 9 }, { field: 'nis_lokal', ukuran_font: 10 }),
      elemen('kelas', 'data', { x: 34, y: 79, lebar: 58, tinggi: 9 }, { field: 'kelas', ukuran_font: 10 }),
    ],
  },
];

export function salinDesainKartu(desain: DesainKartuPeserta): DesainKartuPeserta {
  return { ...desain, elemen: desain.elemen.map((item) => ({ ...item })) };
}

export function nilaiElemenKartu(elemenKartu: ElemenKartuPeserta, konteks: KonteksKartuPeserta): string {
  if (elemenKartu.tipe === 'teks') return elemenKartu.teks ?? '';
  if (elemenKartu.tipe === 'foto') return '';
  const nilai: Record<FieldKartuPeserta, string> = {
    nama: konteks.peserta.nama,
    nomor_peserta: konteks.peserta.nomor_peserta ?? 'Belum bernomor',
    nis_lokal: konteks.peserta.nis_lokal ?? '—',
    kelas: konteks.peserta.kelas ?? '—',
    tingkat: konteks.peserta.tingkat ?? '—',
    peristiwa: konteks.peristiwa.nama,
    tahun_ajaran: konteks.peristiwa.tahun_ajaran,
    semester: konteks.semester,
    lembaga: konteks.lembaga,
  };
  return elemenKartu.field ? nilai[elemenKartu.field] : '';
}

export function pindahkanElemenKartu(elemenKartu: ElemenKartuPeserta, x: number, y: number): ElemenKartuPeserta {
  return {
    ...elemenKartu,
    x: Math.max(0, Math.min(100 - elemenKartu.lebar, x)),
    y: Math.max(0, Math.min(100 - elemenKartu.tinggi, y)),
  };
}

export function buatElemenDataKartu(field: FieldKartuPeserta, urutan: number): ElemenKartuPeserta {
  return elemen(`data_${field}_${urutan}`, 'data', { x: 35, y: 10 + (urutan % 8) * 10, lebar: 55, tinggi: 9 }, {
    field,
    ukuran_font: field === 'nama' ? 16 : 11,
    tebal: field === 'nama' || field === 'nomor_peserta',
  });
}

export function buatElemenTeksKartu(urutan: number): ElemenKartuPeserta {
  return elemen(`teks_${urutan}`, 'teks', { x: 10, y: 10 + (urutan % 9) * 8, lebar: 80, tinggi: 9 }, {
    teks: 'Teks baru', ukuran_font: 12, tebal: true, rata: 'center',
  });
}

export function buatElemenFotoKartu(): ElemenKartuPeserta {
  return elemen('foto', 'foto', { x: 7, y: 28, lebar: 22, tinggi: 55 }, { rata: 'center' });
}

export function desainDariServer(desain: DesainKartuServer): DesainKartuPeserta {
  return {
    id: desain.id,
    nama: desain.nama,
    sumber: 'pengguna',
    elemen: desain.elemen.map((item) => ({ ...item })),
    warna_latar: desain.warna_latar,
    gaya_latar: desain.gaya_latar,
    latar_ada: desain.latar_ada,
    latar_url: desain.latar_url,
  };
}

export function pilihDesainKartu(
  daftar: readonly DesainKartuServer[],
  pengaturan: Pick<PengaturanKartuPeserta, 'desain_id' | 'template_bawaan'>,
): DesainKartuPeserta {
  const dariServer = daftar.find((item) => item.id === pengaturan.desain_id);
  if (dariServer) return desainDariServer(dariServer);

  return DESAIN_BAWAAN_KARTU.find((item) => item.gaya_latar === pengaturan.template_bawaan)
    ?? DESAIN_BAWAAN_KARTU[0];
}

export function ubahUkuranElemenKartu(
  elemenKartu: ElemenKartuPeserta,
  lebar: number,
  tinggi: number,
): ElemenKartuPeserta {
  return {
    ...elemenKartu,
    lebar: Math.max(5, Math.min(100 - elemenKartu.x, lebar)),
    tinggi: Math.max(5, Math.min(100 - elemenKartu.y, tinggi)),
  };
}

export function idElemenKartu(dasar: string, daftar: readonly ElemenKartuPeserta[]): string {
  let id = dasar;
  let urutan = 2;
  while (daftar.some((item) => item.id === id)) {
    id = `${dasar}_${urutan}`;
    urutan += 1;
  }
  return id;
}
