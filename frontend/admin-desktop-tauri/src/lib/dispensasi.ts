import type { Dispensasi, JenisTagihan, PratinjauBaris } from '@/api/keuangan';

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** "2025-07" → "Jul"; periode lain (mis. kode TA) dikembalikan apa adanya.
 *  Tahunnya sengaja tidak diulang: dialog sudah menampilkan Dari/Sampai Bulan. */
export function labelBulan(periode: string): string {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(periode);
  if (!m) return periode;
  return BULAN[Number(m[2]) - 1];
}

/** Rentang satu kelompok bulan: "Jul" atau "Agu–Jun". */
function labelRentang(pertama: string, terakhir: string): string {
  return pertama === terakhir
    ? labelBulan(pertama)
    : `${labelBulan(pertama)}–${labelBulan(terakhir)}`;
}

/** Satu rentang bulan yang bernilai & berdispensasi sama (hasil pengelompokan). */
export interface RentangPeriode {
  /** "Jul–Agu" (label ringkas, sudah dibentuk `labelRentang`). */
  label: string;
  /** Periode pertama & terakhir rentang (untuk label panjang di kartu). */
  dari: string;
  sampai: string;
  bulan: number;
  nominal: number;
  potongan: number;
  nama: string[];
  langkah: PratinjauBaris['langkah'];
  sebab: string | null;
}

/** Kelompokkan bulan-bulan berurutan yang bernilai & berdispensasi sama.
 *  Satu sumber untuk teks ringkas sel maupun kartu hover. */
export function rentangPeriode(baris: PratinjauBaris[]): RentangPeriode[] {
  const kunci = (b: PratinjauBaris) =>
    `${b.nominal}|${b.dispensasi_ids.join(',')}|${b.sebab ?? ''}`;
  const kelompok: PratinjauBaris[][] = [];
  for (const b of baris) {
    const akhir = kelompok[kelompok.length - 1];
    if (akhir && kunci(akhir[0]) === kunci(b)) akhir.push(b);
    else kelompok.push([b]);
  }
  return kelompok.map((k) => {
    const awal = k[0];
    return {
      label: labelRentang(awal.periode, k[k.length - 1].periode),
      dari: awal.periode,
      sampai: k[k.length - 1].periode,
      bulan: k.length,
      nominal: awal.nominal,
      potongan: awal.potongan,
      nama: awal.nama,
      langkah: awal.langkah ?? [],
      sebab: awal.sebab,
    };
  });
}

/** Label rentang untuk kartu hover — dengan tahun ("Agu 2026 – Jun 2027"). */
export function labelRentangPanjang(dari: string, sampai: string): string {
  if (dari === sampai) return `${labelBulan(dari)} ${dari.slice(0, 4)}`;
  return `${labelBulan(dari)} ${dari.slice(0, 4)} – ${labelBulan(sampai)} ${sampai.slice(0, 4)}`;
}

/** Rincian potongan per bulan dari jawaban pratinjau backend: bulan-bulan
 *  berurutan yang bernilai & berdispensasi sama digabung, jadi efek failover
 *  kuota terlihat (mis. "Jul: 0 · Agu–Jun: 50.000").
 *  `null` bila rentangnya cuma satu bulan — tak ada yang perlu dijelaskan;
 *  "Sama tiap bulan" bila semua bulannya sama. */
export function rincianPeriode(baris: PratinjauBaris[]): string | null {
  if (baris.length < 2) return null;
  const rentang = rentangPeriode(baris);
  if (rentang.length === 1) return 'Sama tiap bulan';

  return rentang.map((r, i) => {
    const bagian = [`${r.label}: ${r.nominal.toLocaleString('id')}`];
    const nama = r.nama.join(', ');
    const sebelum = i === 0 ? '' : rentang[i - 1].nama.join(', ');
    if (nama !== '' && nama !== sebelum) bagian.push(`(${nama})`);
    if (r.sebab) bagian.push('(dilewati)');
    return bagian.join(' ');
  }).join(' · ');
}

/** Aturan satu dispensasi untuk jenis terpilih (spesifik menang atas semua-jenis).
 *  Cerminan `DispensasiService::aturanUntukJenis` di backend (dipakai pratinjau). */
export function aturanUntukJenis(
  d: Dispensasi,
  jenisId: number,
): Dispensasi['aturan'][number] | null {
  let umum: Dispensasi['aturan'][number] | null = null;
  for (const a of d.aturan ?? []) {
    if (a.jenis_id === null) umum ??= a;
    else if (a.jenis_id === jenisId) return a;
  }
  return umum;
}

/** Lingkup selembaga: lingkup kosong (semua lembaga), jenjang tanpa patokan,
 *  atau jenjang yang sama. Cermin penjaga lingkup di backend (`saring` saat
 *  generate dan penjaga `updateTagihan` saat memilih paket manual). */
export function lingkupCocokJenjang(
  lingkup: string | null | undefined,
  jenjang: string | null | undefined,
): boolean {
  return jenjang == null || lingkup == null || lingkup === jenjang;
}

/** Dispensasi yang cocok untuk satu santri: terdaftar sebagai penerima DAN
 *  lingkup lembaganya cocok. Cerminan `DispensasiService::saring` di backend —
 *  `jenjang` = jenjang tagihan (generate memakai jenjang utama santri); paket
 *  berlingkup hanya berlaku untuk jenjang itu, null di sisi mana pun = bebas. */
export function saringDispensasi(
  daftar: Dispensasi[],
  santriId: number,
  jenjang: string | null = null,
): Dispensasi[] {
  return daftar.filter((d) => lingkupCocokJenjang(d.jenjang, jenjang)
    && (d.santri_ids ?? []).includes(santriId));
}

/** Saring baris penerima dengan kotak pencarian topBar: cocok pada nama ATAU
 *  NIS, tanpa peduli besar-kecil huruf; `q` kosong = daftar apa adanya.
 *  Sereaksi dengan penyaringan SERVER pada Daftar Santri (`q` di `listSantri`)
 *  supaya dua tabel santri di halaman Dispensasi menanggapi satu kotak
 *  pencarian dengan cara yang sama. */
export function saringPenerima<T extends { nama: string; nis: string | null }>(
  baris: T[],
  q: string,
): T[] {
  const kunci = q.trim().toLowerCase();
  if (kunci === '') return baris;
  return baris.filter((r) => r.nama.toLowerCase().includes(kunci)
    || (r.nis ?? '').toLowerCase().includes(kunci));
}

/** Jenis tagihan cocok dengan lingkup jenjang paket: lingkup kosong (semua
 *  lembaga), jenis global (`jenjang` null), atau jenis lembaga itu sendiri.
 *  Cermin penjaga backend `pastikanAturanSelarasJenjang`. */
export function jenisCocokJenjang(
  j: Pick<JenisTagihan, 'jenjang'>,
  jenjang: string | null,
): boolean {
  return lingkupCocokJenjang(j.jenjang, jenjang);
}

/** Buang aturan yang jenisnya tak lagi cocok setelah lingkup jenjang berubah
 *  (aturan yang jenisnya tak dikenal DIPERTAHANKAN — biar backend yang
 *  menolak, bukan hilang senyap di klien). Lingkup null = tak ada yang dibuang. */
export function saringAturanJenjang<T extends { jenisId: number }>(
  baris: T[],
  jenis: readonly Pick<JenisTagihan, 'id' | 'jenjang'>[],
  jenjang: string | null,
): T[] {
  if (jenjang === null) return baris;
  const peta = new Map(jenis.map((j) => [j.id, j.jenjang]));
  return baris.filter((b) => {
    const j = peta.get(b.jenisId);
    return j === undefined || j === null || j === jenjang;
  });
}

/** Paket yang disaring di rekap dampak per lembaga: `undefined` = ikut paket
 *  yang sedang dipilih di tabel (bawaan halaman, supaya sebaran satu paket
 *  bisa ditelusuri sekali klik), `null` = semua paket, number = paket itu. */
export function paketRekapEfektif(
  pilihan: number | null | undefined,
  aktifId: number | null,
): number | null {
  return pilihan === undefined ? aktifId : pilihan;
}

/** Akumulatif urut id — sama dengan DispensasiService di backend. */
export function hitungDispensasi(
  nominalAwal: number,
  cocok: Dispensasi[],
  jenisId: number,
): { nominal: number; potongan: number; ids: number[]; label: string } {
  const urut = [...cocok].sort((a, b) => a.id - b.id);
  let nominal = nominalAwal;
  const pakai: Dispensasi[] = [];
  for (const d of urut) {
    const a = aturanUntukJenis(d, jenisId);
    if (!a) continue;
    nominal = a.tipe === 'persen'
      ? Math.floor(nominal * (100 - Math.min(100, Math.max(0, a.nilai))) / 100)
      : a.tipe === 'bebas'
        ? 0
        : Math.max(0, nominal - Math.max(0, a.nilai));
    pakai.push(d);
  }
  return {
    nominal,
    potongan: Math.max(0, nominalAwal - nominal),
    ids: pakai.map((d) => d.id),
    label: pakai.map((d) => d.nama).join(', '),
  };
}

/** Ringkasan aturan untuk label dropdown (mis. "50%", "Rp 10.000", "Bebas"). */
export function ringkasAturan(
  d: Dispensasi,
  jenisId: number,
): string | null {
  const a = aturanUntukJenis(d, jenisId);
  if (!a) return null;
  if (a.tipe === 'persen') return `${a.nilai}%`;
  if (a.tipe === 'bebas') return 'Bebas';
  return `Rp ${a.nilai.toLocaleString('id')}`;
}

/** Teks satu baris aturan potongan: "50%", "Rp 10.000", "Bebas". Beda dengan
 *  `ringkasAturan` (pasangan paket × jenis): ini bekerja pada aturan itu
 *  sendiri, jadi bisa dipakai tanpa tahu jenisnya. */
export function teksAturan(a: Pick<Dispensasi['aturan'][number], 'tipe' | 'nilai'>): string {
  if (a.tipe === 'persen') return `${a.nilai}%`;
  if (a.tipe === 'bebas') return 'Bebas';
  return `Rp ${a.nilai.toLocaleString('id')}`;
}

/** Seluruh aturan satu paket jadi satu baris: "Yatim: 50% · Semua jenis: Rp 5.000".
 *  Aturan tanpa jenis (berlaku semua jenis tagihan) ditulis "Semua jenis".
 *  Satu sumber untuk kolom tabel Dispensasi, kartu paket terpilih, dan panel
 *  dispensasi di profil santri. */
export function teksAturanPaket(d: Pick<Dispensasi, 'aturan'>): string {
  return (d.aturan ?? [])
    .map((a) => `${a.jenis?.nama ?? 'Semua jenis'}: ${teksAturan(a)}`)
    .join(' · ');
}

/** Gabung dua daftar paket per grup — cermin `DispensasiService::selaraskan`:
 *  `$utama` menang dalam grupnya, daftar pertama menang bila se-grup ganda
 *  (termasuk di dalam `$utama` — menormalkan jejak legacy); grup null
 *  selalu digabung. Dipakai pratinjau (backend otoritatif). */
export function selaraskanGrup<T extends { id: number; grup: string | null }>(utama: T[], lawan: T[]): T[] {
  const grupMenang = new Set<string>();
  const hasil: T[] = [];
  const adaId = new Set<number>();
  for (const daftar of [utama, lawan]) {
    for (const d of daftar) {
      if (adaId.has(d.id)) continue;
      if (d.grup !== null && grupMenang.has(d.grup)) continue;
      hasil.push(d);
      adaId.add(d.id);
      if (d.grup !== null) grupMenang.add(d.grup);
    }
  }
  return hasil;
}

/** Sisa kuota paket untuk satu santri (null = tanpa batas). */
export function sisaKuota(
  d: Dispensasi,
  terpakai: number,
): number | null {
  if (d.kuota_bulan === null || d.kuota_bulan === undefined) return null;
  return d.kuota_bulan - terpakai;
}
