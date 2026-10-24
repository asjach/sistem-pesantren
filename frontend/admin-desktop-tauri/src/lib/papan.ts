import type { AplikasiPapan, ButirPapan, ModulPapan, StatusPapan, SubPapan, SubpoinPapan } from '@/api/papan';
import { JUDUL_KOLOM, KOLOM_PAPAN } from '@/api/papan';

/** Unit kemajuan: berapa yang sudah selesai dari total unit yang bisa diselesaikan. */
export interface Kemajuan {
  selesai: number;
  total: number;
}

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
  keterangan: string | null;
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
        keterangan: b.keterangan ?? null,
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
 * Kelompokkan poin ke enam kolom status sebagai kartu per sub-modul.
 *
 * Satu sub-modul muncul di SETIAP kolom yang punya poin berstatus itu, tapi
 * hanya sekali per kolom - jadi judulnya tidak berulang dalam satu kolom.
 * Kolom kosong tetap ada supaya susunan workflow tidak goyah.
 */
export function kelompokkanKolom(kartu: KartuPapan[]): KolomPapanData[] {
  const perSub = kelompokkanSub(kartu);

  return KOLOM_PAPAN.map((id) => ({
    id,
    judul: JUDUL_KOLOM[id],
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
  return kartu.filter((k) => k.statusSub === 'done').length;
}

/** Jumlah POIN per status dalam satu modul, untuk lencana di tab. */
export function ringkasanModul(modul: ModulPapan): Record<StatusPapan, number> {
  return ringkasanPoin(ratakanKartu([modul]));
}

/**
 * Kemajuan sekumpulan poin (butir) mentah.
 *
 * Satu subpoin = satu unit. Poin yang tidak punya subpoin tetap dihitung
 * satu unit dan selesai bila status poinnya `sudah`; 0/0 berarti belum
 * ada isi, bukan berarti selesai.
 */
export function kemajuanButir(butir: ButirPapan[]): Kemajuan {
  let selesai = 0;
  let total = 0;

  for (const b of butir) {
    const subpoin = b.subpoin ?? [];

    if (subpoin.length === 0) {
      total += 1;
      if (b.status === 'done') selesai += 1;

      continue;
    }

    total += subpoin.length;
    selesai += subpoin.filter((item) => item.selesai).length;
  }

  return { selesai, total };
}

/** Versi kartu (poin papan) dari `kemajuanButir`, dipakai kartu & ringkasan. */
export function kemajuanPoin(poin: KartuPapan[]): Kemajuan {
  return kemajuanButir(poin);
}

/** Persen bulat 0-100; modul tanpa isi bernilai 0, bukan 100. */
export function persenKemajuan({ selesai, total }: Kemajuan): number {
  if (total <= 0) return 0;

  return Math.round((selesai / total) * 100);
}

/**
 * Berapa unit yang sudah selesai dari seluruh unit sebuah modul.
 *
 * Dipakai untuk lencana kemajuan di tab.
 */
export function kemajuanModul(modul: ModulPapan): Kemajuan {
  return kemajuanButir(modul.sub.flatMap((s) => s.butir));
}

/**
 * Apakah modul punya pekerjaan yang menunggu peninjauan.
 *
 * Satu poin berstatus `for_review` sudah cukup. Rail modul memakainya untuk
 * menandai modul yang perlu dievaluasi tanpa membuka modulnya lebih dulu.
 */
export function modulAdaTinjauan(modul: ModulPapan): boolean {
  return modul.sub.some((s) => s.butir.some((b) => b.status === 'for_review'));
}

/** Apakah satu poin cocok dengan kata kunci pencarian Board. */
export function poinCocok(poin: KartuPapan, kueri: string): boolean {
  const q = kueri.trim().toLowerCase();
  if (!q) return true;

  return [
    poin.deskripsi,
    poin.keterangan ?? '',
    poin.kode,
    poin.nama,
    poin.subKode,
    poin.subNama,
    poin.modulKode,
    poin.modulNama,
    poin.status,
    JUDUL_KOLOM[poin.status],
    ...poin.subpoin.map((item) => item.teks),
  ].join(' ').toLowerCase().includes(q);
}

/** Satu poin yang cocok pada pencarian global Board. */
export interface HasilCariPapan {
  aplikasiKode: string;
  aplikasiNama: string;
  modulKode: string;
  modulNama: string;
  poin: KartuPapan;
}

/**
 * Cari poin di SELURUH aplikasi dan modul Board.
 *
 * Kecocokan nama aplikasi/modul membuat semua poin di dalamnya ikut tampil;
 * kecocokan lain memakai aturan {@see poinCocok}.
 */
export function cariPapan(aplikasi: AplikasiPapan[], kueri: string): HasilCariPapan[] {
  const q = kueri.trim().toLowerCase();
  if (!q) return [];

  const hasil: HasilCariPapan[] = [];

  for (const app of aplikasi) {
    const appCocok = `${app.kode} ${app.nama}`.toLowerCase().includes(q);

    for (const modul of app.modul) {
      const modulCocok = appCocok || `${modul.kode} ${modul.nama}`.toLowerCase().includes(q);

      for (const poin of kartuModul(modul)) {
        if (!modulCocok && !poinCocok(poin, q)) continue;

        hasil.push({
          aplikasiKode: app.kode,
          aplikasiNama: app.nama,
          modulKode: modul.kode,
          modulNama: modul.nama,
          poin,
        });
      }
    }
  }

  return hasil;
}

/** Jumlah POIN per status dari daftar poin papan (untuk ringkasan & meter). */
export function ringkasanPoin(poin: KartuPapan[]): Record<StatusPapan, number> {
  const hasil: Record<StatusPapan, number> = {
    pending: 0,
    backlog: 0,
    todo: 0,
    in_progress: 0,
    for_review: 0,
    done: 0,
  };
  for (const p of poin) hasil[p.status] += 1;

  return hasil;
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
export function kolomSebelah(status: StatusPapan, arah: -1 | 1, kolom: StatusPapan[] = KOLOM_PAPAN): StatusPapan | null {
  const kini = kolom.indexOf(status);
  if (kini === -1) return null;

  return kolom[kini + arah] ?? null;
}

/** Preferensi rusak kembali ke semua kolom; array kosong berarti semua disembunyikan. */
export function bacaKolomTerlihat(nilai: string | null): StatusPapan[] {
  try {
    const isi: unknown = JSON.parse(nilai ?? 'null');
    if (Array.isArray(isi) && isi.every((status) => KOLOM_PAPAN.includes(status))) {
      return KOLOM_PAPAN.filter((status) => isi.includes(status));
    }
  } catch {
    // Preferensi perangkat tidak boleh menghalangi pemuatan Board.
  }

  return [...KOLOM_PAPAN];
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
