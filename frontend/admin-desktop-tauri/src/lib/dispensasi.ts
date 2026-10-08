import type { Dispensasi } from '@/api/keuangan';

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

/** Dispensasi yang cocok untuk satu santri (terdaftar sebagai penerima).
 *  Cerminan `DispensasiService::saring` di backend. */
export function saringDispensasi(daftar: Dispensasi[], santriId: number): Dispensasi[] {
  return daftar.filter((d) => (d.santri_ids ?? []).includes(santriId));
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

/** Alokasi paket berkuota ke baris-baris generate (urut daftar santri,
 *  bulan-bulan awal dulu — cermin alokasi backend). Non-kuota & penerima
 *  selalu ikut; berkuota ikut bila sisa masih ada (konsumsi = periode run).
 *  Se-grup tak menumpuk: saring kuota dulu (failover — habis dicoret agar
 *  bersisa maju), lalu pertama (id terkecil) menang per grup.
 *  Pratinjau indicatif: backend otoritatif (pengecualian baris existing
 *  & parsial dalam-santri hanya dihitung di sana). */
export function alokasiPaketKuota(
  paket: Dispensasi[],
  santriIds: number[],
  terpakai: Record<number, Record<number, number>>,
  periode: number,
): Map<number, Dispensasi[]> {
  const jalan = new Map<string, number>();
  const hasil = new Map<number, Dispensasi[]>();
  for (const sid of santriIds) {
    const pakai = terpakai[sid] ?? {};
    const tersedia = saringDispensasi(paket, sid).filter((d) => {
      if (d.kuota_bulan === null || d.kuota_bulan === undefined) return true;
      const sisa = d.kuota_bulan - (pakai[d.id] ?? 0) - (jalan.get(`${sid}:${d.id}`) ?? 0);
      return sisa > 0;
    });
    const menang = new Set<string>();
    const selaras = [...tersedia].sort((a, b) => a.id - b.id).filter((d) => {
      if (d.grup === null || d.grup === undefined) return true;
      if (menang.has(d.grup)) return false;
      menang.add(d.grup);
      return true;
    });
    for (const d of selaras) {
      if (d.kuota_bulan !== null && d.kuota_bulan !== undefined) {
        const kunci = `${sid}:${d.id}`;
        jalan.set(kunci, (jalan.get(kunci) ?? 0) + periode);
      }
    }
    hasil.set(sid, selaras);
  }
  return hasil;
}
