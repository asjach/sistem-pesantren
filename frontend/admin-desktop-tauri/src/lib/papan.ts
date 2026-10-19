import type { ModulPapan, StatusPapan, SubPapan } from '@/api/papan';
import { KOLOM_PAPAN } from '@/api/papan';

/** Satu kartu papan = satu sub-modul beserta konteks modulnya. */
export interface KartuPapan extends SubPapan {
  modulKode: string;
  modulNama: string;
  /** Jumlah butir per status, untuk ringkasan di kartu. */
  jumlahButir: Record<StatusPapan, number>;
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

/** Hitung jumlah butir per status dalam satu sub-modul. */
function hitungButir(sub: SubPapan): Record<StatusPapan, number> {
  const hasil: Record<StatusPapan, number> = { sudah: 0, sedang: 0, akan: 0, ditunda: 0 };
  for (const b of sub.butir) hasil[b.status] += 1;
  return hasil;
}

/** Ratakan modul -> sub-modul menjadi daftar kartu. */
export function ratakanKartu(modul: ModulPapan[]): KartuPapan[] {
  return modul.flatMap((m) =>
    m.sub.map((s) => ({
      ...s,
      modulKode: m.kode,
      modulNama: m.nama,
      jumlahButir: hitungButir(s),
    })),
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

/** Ringkasan "berapa dari berapa" untuk sebuah kolom, dipakai di kepala kolom. */
export function hitungKolomPenuh(kartu: KartuPapan[]): number {
  return kartu.filter((k) => k.status === 'sudah').length;
}

/** Jumlah kartu per status dalam satu modul, untuk lencana di tab. */
export function ringkasanModul(modul: ModulPapan): Record<StatusPapan, number> {
  const hasil: Record<StatusPapan, number> = { sudah: 0, sedang: 0, akan: 0, ditunda: 0 };
  for (const s of modul.sub) hasil[s.status] += 1;
  return hasil;
}

/** Kartu satu modul saja (untuk halaman bertab per modul). */
export function kartuModul(modul: ModulPapan): KartuPapan[] {
  return ratakanKartu([modul]);
}

/**
 * Cari modul dari kode pada segmen URL. Kode modul dipakai apa adanya
 * (huruf besar, mis. \`E\`), tapi pencocokan dibuat tidak peka huruf besar-kecil
 * supaya tautan \`/papan/e\` tetap bekerja.
 */
export function modulDariKode(modul: ModulPapan[], kode: string | undefined): ModulPapan | null {
  if (!kode) return null;
  const cari = kode.trim().toUpperCase();

  return modul.find((m) => m.kode.toUpperCase() === cari) ?? null;
}

/** Kode modul pertama yang punya isi, dipakai sebagai tujuan awal. */
export function modulPertama(modul: ModulPapan[]): ModulPapan | null {
  return modul.find((m) => m.sub.length > 0) ?? modul[0] ?? null;
}
