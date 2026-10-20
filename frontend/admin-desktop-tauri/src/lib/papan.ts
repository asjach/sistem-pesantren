import type { ModulPapan, StatusPapan, SubPapan, SubpoinPapan } from '@/api/papan';
import { KOLOM_PAPAN } from '@/api/papan';

/**
 * Satu kartu papan = satu POIN (butir).
 *
 * Ini tetap dipakai sebagai satuan yang BERGESER: yang diseret antar kolom
 * adalah poinnya, karena satu sub-modul bisa separuh selesai dan status
 * tunggal tidak bisa mewakilinya. Konteks sub-modul dibawa (kode, nama,
 * modul) supaya kartu bisa menjelaskan dirinya sendiri.
 */
export interface KartuPapan {
  /** Id poin, dipakai untuk memindahkan dan menghapus. */
  id: number;
  kode: string;
  nama: string;
  status: StatusPapan;
  deskripsi: string;
  subpoin: SubpoinPapan[];
  /** Kode sub-modul induk, mis. E.3. */
  subKode: string;
  subNama: string;
  modulKode: string;
  modulNama: string;
  /** Status sub-modul induk (turunan) - konteks, bukan status kartu. */
  statusSub: StatusPapan;
}

/**
 * Satu kartu yang TERLIHAT di kolom = satu sub-modul, berisi poin-poinnya.
 *
 * Kenapa digabung: satu sub-modul berpoin delapan dulu tampil sebagai
 * delapan kartu berjudul sama, sehingga judulnya berulang dan pertanyaan
 * "sub-modul ini sudah sampai mana" justru hilang dari pandangan. Digabung,
 * judul muncul sekali per kolom dan isinya bisa dibaca sekaligus.
 *
 * Yang DISERET tetap poinnya, bukan kartu ini - lihat `poin` di bawah.
 */
export interface KartuSub {
  /** Kode sub-modul, mis. D.1 - sekaligus kunci unik kartu. */
  subKode: string;
  subNama: string;
  modulKode: string;
  modulNama: string;
  /** Status kolom tempat kartu ini berada. */
  status: StatusPapan;
  /** Poin berstatus ini, urut seperti di papan. */
  poin: KartuPapan[];
  /** Status sub-modul induk (turunan dari SELURUH poinnya). */
  statusSub: StatusPapan;
}

/** Satu kolom papan beserta kartunya, urut sesuai KOLOM_PAPAN. */
export interface KolomPapanData {
  id: StatusPapan;
  judul: string;
  kartu: KartuSub[];
}

const JUDUL: Record<StatusPapan, string> = {
  akan: 'Akan',
  sedang: 'Sedang',
  sudah: 'Sudah',
  ditunda: 'Ditunda',
};

/** Ratakan modul -> sub-modul -> poin menjadi daftar poin. */
export function ratakanKartu(modul: ModulPapan[]): KartuPapan[] {
  return modul.flatMap((m) =>
    m.sub.flatMap((s) =>
      s.butir.map((b) => ({
        id: b.id,
        kode: s.kode,
        nama: s.nama,
        status: b.status,
        deskripsi: b.deskripsi,
        subpoin: b.subpoin ?? [],
        subKode: s.kode,
        subNama: s.nama,
        modulKode: m.kode,
        modulNama: m.nama,
        statusSub: s.status,
      })),
    ),
  );
}

/**
 * Gabungkan poin menjadi satu entri per sub-modul.
 *
 * Urutan mengikuti kemunculan pertama di papan, supaya kartu tidak
 * melompat-lompat saat status salah satu poinnya berubah.
 */
export function kelompokkanSub(kartu: KartuPapan[]): KartuSub[] {
  const peta = new Map<string, KartuSub>();

  for (const k of kartu) {
    const ada = peta.get(k.subKode);

    if (ada === undefined) {
      peta.set(k.subKode, {
        subKode: k.subKode,
        subNama: k.subNama,
        modulKode: k.modulKode,
        modulNama: k.modulNama,
        status: k.status,
        poin: [k],
        statusSub: k.statusSub,
      });

      continue;
    }

    ada.poin.push(k);
  }

  return [...peta.values()];
}

/**
 * Kelompokkan poin ke empat kolom sebagai kartu per sub-modul.
 *
 * Satu sub-modul muncul di SETIAP kolom yang punya poin berstatus itu, tapi
 * hanya sekali per kolom - jadi judulnya tidak berulang dalam satu kolom.
 * Kolom kosong tetap ada supaya susunan empat kolom tidak goyah.
 */
export function kelompokkanKolom(kartu: KartuPapan[]): KolomPapanData[] {
  const perSub = kelompokkanSub(kartu);

  return KOLOM_PAPAN.map((id) => ({
    id,
    judul: JUDUL[id],
    kartu: perSub
      .map((k) => ({
        ...k,
        status: id,
        poin: k.poin.filter((p) => p.status === id),
      }))
      .filter((k) => k.poin.length > 0),
  }));
}

/** Berapa kartu (sub-modul) di kolom ini yang seluruh poinnya sudah selesai. */
export function hitungKolomPenuh(kartu: KartuSub[]): number {
  return kartu.filter((k) => k.statusSub === 'sudah').length;
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
 * Berapa unit yang sudah selesai dari seluruh unit sebuah modul.
 *
 * Satu subpoin = satu unit. Poin yang tidak punya subpoin tetap dihitung
 * satu unit dan selesai bila status poinnya `sudah`.
 *
 * Dipakai untuk lencana kemajuan di tab; 0/0 berarti modul itu belum
 * punya poin sama sekali (bukan berarti selesai).
 */
export function kemajuanModul(modul: ModulPapan): { selesai: number; total: number } {
  let selesai = 0;
  let total = 0;

  for (const s of modul.sub) {
    for (const b of s.butir) {
      const subpoin = b.subpoin ?? [];

      if (subpoin.length === 0) {
        total += 1;
        if (b.status === 'sudah') selesai += 1;

        continue;
      }

      total += subpoin.length;
      selesai += subpoin.filter((item) => item.selesai).length;
    }
  }

  return { selesai, total };
}

/** Poin satu modul saja (untuk halaman bertab per modul). */
export function kartuModul(modul: ModulPapan): KartuPapan[] {
  return ratakanKartu([modul]);
}

/**
 * Kolom tujuan bila kartu digeser satu langkah (jalur keyboard).
 *
 * Mengembalikan null bila sudah di ujung, supaya pemanggil bisa memberi
 * tahu pengguna alih-alih diam saja. Urutannya mengikuti KOLOM_PAPAN
 * (urutan tampil), bukan urutan kepentingan status, supaya arah panah
 * terasa sama dengan arah matanya.
 */
export function kolomSebelah(status: StatusPapan, arah: -1 | 1): StatusPapan | null {
  const kini = KOLOM_PAPAN.indexOf(status);
  if (kini === -1) return null;

  return KOLOM_PAPAN[kini + arah] ?? null;
}

export function modulDariKode(modul: ModulPapan[], kode: string | undefined): ModulPapan | null {
  if (!kode) return null;
  // .trim() penting: kode datang dari segmen URL, dan spasi nyasar
  // (mis. /board/%20f%20) harus tetap menemukan modulnya.
  const cari = kode.trim().toUpperCase();

  return modul.find((m) => m.kode.toUpperCase() === cari) ?? null;
}

export function modulPertama(modul: ModulPapan[]): ModulPapan | null {
  return modul.find((m) => m.sub.length > 0) ?? modul[0] ?? null;
}

export function subDariKartu(kartu: KartuPapan): Pick<SubPapan, 'kode' | 'nama' | 'status'> {
  return { kode: kartu.subKode, nama: kartu.subNama, status: kartu.statusSub };
}
