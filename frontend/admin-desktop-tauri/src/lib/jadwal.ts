/** Jam dari server bisa berbentuk `HH:MM` atau `HH:MM:SS`. */
export function jamPendek(v: string | null): string | null {
  return v === null || v === '' ? null : v.slice(0, 5);
}

/** Ubah `HH:MM`/`HH:MM:SS` menjadi menit sejak 00:00; null bila tak sah. */
export function menitDariJam(v: string | null): number | null {
  const teks = jamPendek(v);
  if (teks === null) return null;
  const cocok = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(teks);
  if (cocok === null) return null;
  return Number(cocok[1]) * 60 + Number(cocok[2]);
}

/** Ubah menit sejak 00:00 menjadi `HH:MM`; null bila melewati 23:59. */
export function jamDariMenit(total: number): string | null {
  if (!Number.isInteger(total) || total < 0 || total > 23 * 60 + 59) return null;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export interface SlotJamBaru {
  nama_slot: string;
  jam_mulai: string;
  jam_selesai: string;
  urutan: number;
}

/**
 * Slot berikutnya dari slot dengan jam selesai TERAKHIR: mulai = jam selesai
 * slot itu, selesai = mulai + durasi (1 JPL), urutan = urutan terbesar + 1.
 * Slot tanpa jam selesai diabaikan; bila belum ada slot berjam, mulai dari
 * `mulaiAwal`.
 */
export function hitungSlotBaru(
  slots: readonly { jam_mulai: string | null; jam_selesai: string | null; urutan: number }[],
  durasiMenit: number,
  mulaiAwal = '07:00',
): SlotJamBaru | null {
  if (!Number.isInteger(durasiMenit) || durasiMenit <= 0) return null;

  let akhirTerakhir: number | null = null;
  for (const s of slots) {
    const akhir = menitDariJam(s.jam_selesai);
    if (akhir !== null && (akhirTerakhir === null || akhir > akhirTerakhir)) {
      akhirTerakhir = akhir;
    }
  }

  const mulaiMenit = akhirTerakhir ?? menitDariJam(mulaiAwal);
  if (mulaiMenit === null) return null;

  const jamMulai = jamDariMenit(mulaiMenit);
  const jamSelesai = jamDariMenit(mulaiMenit + durasiMenit);
  if (jamMulai === null || jamSelesai === null) return null;

  const urutan = slots.reduce((maks, s) => Math.max(maks, s.urutan), 0) + 1;

  return { nama_slot: `Jam ${urutan}`, jam_mulai: jamMulai, jam_selesai: jamSelesai, urutan };
}
