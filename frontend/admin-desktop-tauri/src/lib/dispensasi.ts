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
