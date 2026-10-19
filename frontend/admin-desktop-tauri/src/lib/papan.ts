import type { ModulPapan, StatusPapan, SubPapan } from '@/api/papan';
import { KOLOM_PAPAN } from '@/api/papan';

/**
 * Satu kartu papan = satu POIN (butir), bukan sub-modul.
 *
 * Ini perubahan model yang disengaja: yang bergerak antar kolom adalah poin,
 * karena satu sub-modul bisa separuh selesai dan status tunggal tidak bisa
 * mewakilinya. Konteks sub-modul tetap dibawa (kode, nama, modul) supaya
 * kartu bisa menjelaskan dirinya sendiri tanpa kehilangan asal-usulnya.
 */
export interface KartuPapan {
  /** Id poin, dipakai untuk memindahkan dan menghapus. */
  id: number;
  kode: string;
  nama: string;
  status: StatusPapan;
  deskripsi: string;
  /** Kode sub-modul induk, mis. "E.3". */
  subKode: string;
  subNama: string;
  modulKode: string;
  modulNama: string;
  /** Status sub-modul induk (turunan) — konteks, bukan status kartu. */
  statusSub: StatusPapan;
}

/** Satu kolom papan beserta kartunya, urut sesuai KOLOM_PAPAN. */
export interface KolomPapanData {
  id: StatusPapan;
  judul: string;
  kartu: KartuPapan[];
}

const JUDUL: Record<StatusPapan, string> = {
  akan: 'Akan',
  sedang: 'Sedang',
  sudah: 'Sudah',
  ditunda: 'Ditunda',
};

/** Ratakan modul -> sub-modul -> poin menjadi daftar kartu. */
export function ratakanKartu(modul: ModulPapan[]): KartuPapan[] {
  return modul.flatMap((m) =>
    m.sub.flatMap((s) =>
      s.butir.map((b) => ({
        id: b.id,
        kode: s.kode,
        nama: s.nama,
        status: b.status,
        deskripsi: b.deskripsi,
        subKode: s.kode,
        subNama: s.nama,
        modulKode: m.kode,
        modulNama: m.nama,
        statusSub: s.status,
      })),
    ),
  );
}

/** Kelompokkan kartu ke empat kolom; kolom kosong tetap ada. */
export function kelompokkanKolom(kartu: KartuPapan[]): KolomPapanData[] {
  return KOLOM_PAPAN.map((id) => ({
    id,
    judul: JUDUL[id],
    kartu: kartu.filter((k) => k.status === id),
  }));
}

/** Berapa kartu di kolom ini yang berstatus selesai (untuk kepala kolom). */
export function hitungKolomPenuh(kartu: KartuPapan[]): number {
  return kartu.filter((k) => k.status === 'sudah').length;
}

/** Jumlah POIN per status dalam satu modul, untuk lencana di tab. */
export function ringkasanModul(modul: ModulPapan): Record<StatusPapan, number> {
  const hasil: Record<StatusPapan, number> = { sudah: 0, sedang: 0, akan: 0, ditunda: 0 };
  for (const s of modul.sub) {
    for (const b of s.butir) hasil[b.status] += 1;
  }
  return hasil;
}

/**
 * Berapa poin yang sudah selesai dari seluruh poin sebuah modul.
 *
 * Dipakai untuk lencana kemajuan di tab; `0/0` berarti modul itu belum
 * punya poin sama sekali (bukan berarti selesai).
 */
export function kemajuanModul(modul: ModulPapan): { selesai: number; total: number } {
  let selesai = 0;
  let total = 0;

  for (const s of modul.sub) {
    for (const b of s.butir) {
      total += 1;
      if (b.status === 'sudah') selesai += 1;
    }
  }

  return { selesai, total };
}

/** Kartu satu modul saja (untuk halaman bertab per modul). */
export function kartuModul(modul: ModulPapan): KartuPapan[] {
  return ratakanKartu([modul]);
}

/**
 * Cari modul dari kode pada segmen URL. Kode modul dipakai apa adanya
 * (huruf besar, mis. `E`), tapi pencocokan dibuat tidak peka huruf besar-kecil
 * supaya tautan `/papan/e` tetap bekerja.
 */
export function modulDariKode(modul: ModulPapan[], kode: string | undefined): ModulPapan | null {
  if (!kode) return null;
  const cari = kode.trim().toUpperCase();

  return modul.find((m) => m.kode.toUpperCase() === cari) ?? null;
}

/** Kode modul pertama yang punya POIN, dipakai sebagai tujuan awal. */
export function modulPertama(modul: ModulPapan[]): ModulPapan | null {
  const berisi = modul.find((m) => m.sub.some((s) => s.butir.length > 0));

  return berisi ?? modul[0] ?? null;
}

/** Sub-modul induk dari sebuah kartu, kalau perlu ditampilkan terpisah. */
export function subDariKartu(kartu: KartuPapan): Pick<SubPapan, 'kode' | 'nama' | 'status'> {
  return { kode: kartu.subKode, nama: kartu.subNama, status: kartu.statusSub };
}
