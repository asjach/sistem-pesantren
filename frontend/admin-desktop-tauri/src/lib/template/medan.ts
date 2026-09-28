import { bulatMm, jepit } from './satuan';
import type { Kotak } from './snap';
import { dalamHalaman } from './snap';
import {
  BATAS,
  FONT_PDF,
  RATA,
  SIZEMODE,
  TIPE_MEDAN,
  type DefinisiTemplate,
  type GayaMedan,
  type Medan,
  type TipeMedan,
  type UkuranHalaman,
} from './tipe';

/**
 * Operasi pada daftar medan template. Semua fungsi murni: masuk dan keluar
 * objek baru, sehingga cocok dipakai reducer dan mudah diuji tanpa DOM.
 */

export function gayaBawaan(ubah: Partial<GayaMedan> = {}): GayaMedan {
  return {
    font: 'helvetica',
    tebal: false,
    miring: false,
    ukuran: 11,
    warna: '#000000',
    rata: 'kiri',
    baris: 1.2,
    spasi: 0,
    huruf_besar: false,
    skala_otomatis: true,
    huruf_min: 6,
    // Dipakai tipe garis dan kotak: tebal dalam milimeter dan warna isian.
    tebal_mm: 0.3,
    isi: null,
    ...ubah,
  };
}

/** Kotak bawaan per tipe, dalam milimeter, supaya medan baru tak nol. */
const KOTAK_BAWAAN: Record<TipeMedan, Kotak> = {
  teks: { x: 20, y: 40, w: 120, h: 8 },
  paragraf: { x: 20, y: 60, w: 170, h: 24 },
  gambar: { x: 20, y: 100, w: 40, h: 55 },
  centang: { x: 20, y: 40, w: 6, h: 6 },
  tanda_tangan: { x: 140, y: 240, w: 45, h: 22 },
  // Tabel bawaannya sudah memakai tinggi kepala, jadi h memuat kepala + baris.
  baris_berulang: { x: 20, y: 60, w: 170, h: 86 },
  halaman_otomatis: { x: 20, y: 285, w: 60, h: 6 },
  // Garis memakai tinggi sebagai tebal, jadi tinggi bawaannya tipis.
  garis: { x: 20, y: 45, w: 170, h: 0.4 },
  kotak: { x: 20, y: 60, w: 170, h: 8 },
};

export function idBaru(medan: Medan[]): string {
  const dipakai = new Set(medan.map((m) => m.id));
  let n = medan.length + 1;
  while (dipakai.has(`m${n}`)) {
    n += 1;
  }
  return `m${n}`;
}

export function medanBaru(
  tipe: TipeMedan,
  halaman: number,
  posisi: Kotak | null = null,
  urutan: Medan[] = [],
): Medan {
  const dasar = KOTAK_BAWAAN[tipe];
  const kotak = posisi
    ? { x: posisi.x, y: posisi.y, w: posisi.w, h: posisi.h }
    : { ...dasar, x: dasar.x + (urutan.length % 5) * 3, y: dasar.y + (urutan.length % 5) * 3 };

  const medan: Medan = {
    id: idBaru(urutan),
    label: labelBawaan(tipe),
    tipe,
    halaman,
    x: bulatMm(kotak.x),
    y: bulatMm(kotak.y),
    w: bulatMm(kotak.w),
    h: bulatMm(kotak.h),
    sumber: null,
    kunci: null,
    gaya: gayaBawaan(gayaBawaanTipe(tipe)),
  };

  if (tipe === 'centang') {
    medan.bawa = null;
    medan.huruf = '✓';
    medan.huruf_kosong = '';
  }

  if (tipe === 'gambar') {
    medan.sizemode = 'sesuaikan';
  }

  if (tipe === 'halaman_otomatis') {
    medan.format = 'Halaman {halaman} dari {jumlah}';
  }

  if (tipe === 'baris_berulang') {
    medan.baris_berulang = {
      sumber: '',
      jumlah: 10,
      tinggi_baris: 8,
      tinggi_kepala: 6,
      kolom: [
        { label: 'No', x: 0, w: 12, sumber: 'tetap', kunci: 'no_urut', gaya: gayaBawaan({ rata: 'tengah' }) },
        { label: 'Isi', x: 14, w: 120, sumber: 'baris', kunci: '', gaya: gayaBawaan() },
      ],
      gaya: {
        garis_sel: 0.25,
        warna_garis: '#7a7a7a',
        warna_kepala: '#f1f1f1',
        tebal_kepala: true,
        ukuran_kepala: 8.5,
      },
    };
  }

  return medan;
}

function labelBawaan(tipe: TipeMedan): string {
  return (
    {
      teks: 'Teks',
      paragraf: 'Paragraf',
      gambar: 'Gambar',
      centang: 'Centang',
      tanda_tangan: 'Tanda tangan',
      baris_berulang: 'Daftar baris',
      halaman_otomatis: 'Nomor halaman',
      garis: 'Garis',
      kotak: 'Kotak',
    }[tipe]
  );
}

function gayaBawaanTipe(tipe: TipeMedan): Partial<GayaMedan> {
  if (tipe === 'paragraf') {
    return { ukuran: 11, baris: 1.4 };
  }
  if (tipe === 'halaman_otomatis') {
    return { ukuran: 9, rata: 'tengah' };
  }
  if (tipe === 'centang') {
    return { ukuran: 12 };
  }
  return {};
}

/** Ganti satu medan berdasarkan id, atau kembalikan daftar bila id tak ada. */
export function gantiMedan(medan: Medan[], id: string, ubah: Partial<Medan>): Medan[] {
  return medan.map((m) => (m.id === id ? { ...m, ...ubah, id: m.id } : m));
}

/**
 * Ganti isi kotak satu medan dan jaga agar tetap di dalam halaman.
 * `ukuran` boleh null bila ukuran halaman belum diketahui.
 */
export function pindahMedan(
  medan: Medan[],
  id: string,
  kotak: Partial<Kotak>,
  ukuran: UkuranHalaman | null,
): Medan[] {
  return medan.map((m) => {
    if (m.id !== id) {
      return m;
    }

    const gabung = dalamHalaman(
      {
        x: kotak.x ?? m.x,
        y: kotak.y ?? m.y,
        w: kotak.w ?? m.w,
        h: kotak.h ?? m.h,
      },
      ukuran ?? { lebar_mm: 9999, tinggi_mm: 9999 },
    );

    return { ...m, ...gabung };
  });
}

export function ubahGaya(medan: Medan[], id: string, gaya: Partial<GayaMedan>): Medan[] {
  return medan.map((m) => (m.id === id ? { ...m, gaya: { ...m.gaya, ...gaya } } : m));
}

export function hapusMedan(medan: Medan[], id: string): Medan[] {
  return medan.filter((m) => m.id !== id);
}

/** Salin medan dengan id baru, digeser sedikit agar tidak menutupi aslinya. */
export function duplikatMedan(medan: Medan[], id: string): Medan[] {
  const asal = medan.find((m) => m.id === id);

  if (!asal) {
    return medan;
  }

  const salinan: Medan = {
    ...asal,
    id: idBaru(medan),
    label: `${asal.label} (salinan)`,
    x: bulatMm(jepit(asal.x + 3, 0, BATAS.ukuranHalaman)),
    y: bulatMm(jepit(asal.y + 3, 0, BATAS.ukuranHalaman)),
    gaya: { ...asal.gaya },
    baris_berulang: asal.baris_berulang
      ? {
          ...asal.baris_berulang,
          kolom: asal.baris_berulang.kolom.map((k) => ({ ...k, gaya: { ...k.gaya } })),
        }
      : undefined,
  };

  const posisi = medan.findIndex((m) => m.id === id);

  return [...medan.slice(0, posisi + 1), salinan, ...medan.slice(posisi + 1)];
}

export function pindahkanMedan(medan: Medan[], id: string, arah: -1 | 1): Medan[] {
  const posisi = medan.findIndex((m) => m.id === id);

  if (posisi < 0) {
    return medan;
  }

  const tujuan = jepit(posisi + arah, 0, medan.length - 1);

  if (tujuan === posisi) {
    return medan;
  }

  const salinan = [...medan];
  const [dipindah] = salinan.splice(posisi, 1);
  salinan.splice(tujuan, 0, dipindah);

  return salinan;
}

/** Normalisasi definisi yang datang dari server atau dari estado lokal. */
export function normalisasiDefinisi(mentah: unknown): DefinisiTemplate {
  const data = (mentah ?? {}) as Partial<DefinisiTemplate>;
  const daftar = Array.isArray(data.medan) ? data.medan : [];

  return {
    versi: 1,
    medan: daftar.filter((m): m is Medan => !!m && TIPE_MEDAN.includes(m.tipe)).slice(0, BATAS.medan),
  };
}

export function definisiKosong(): DefinisiTemplate {
  return { versi: 1, medan: [] };
}

export function ukuranA4(): UkuranHalaman {
  return { lebar_mm: 210, tinggi_mm: 297 };
}

export { FONT_PDF, RATA, SIZEMODE, TIPE_MEDAN };
