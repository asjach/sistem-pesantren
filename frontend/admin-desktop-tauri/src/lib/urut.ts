import type { ArahUrut } from '@/api/urutPreset';
import type { Santri } from '@/api/santri';

export type PetaArahKolom = Record<string, ArahUrut>;

/**
 * Susun token `sort` dari daftar kode + arah per kolom opsional.
 * Kode dengan arah sendiri ditulis `kode:naik`/`kode:turun` (dikenali backend
 * `UrutDaftar::parseUrut`); kode lain dibiarkan mengikuti `arah` global.
 */
export function tokenUrut(urut: readonly string[], arahKolom?: PetaArahKolom | null): string[] {
  if (!arahKolom) return [...urut];
  return urut.map((k) => {
    const a = arahKolom[k];
    return a === 'naik' || a === 'turun' ? `${k}:${a}` : k;
  });
}

/** Keanggotaan tampil (aktif diutamakan) untuk segmen jenjang. */
export function jenjangTampilSantri(s: Santri): string {
  const a = s.lembaga_aktif?.find((l) => l.is_active_lembaga === 'Ya') ?? s.lembaga_aktif?.[0];
  return a?.jenjang ?? '';
}

/** Info urut per santri (kunci: santri_id) untuk mode filter. */
export interface InfoUrutSantri {
  jenjang: string;
  tingkat: string;
  kelas: string;
}

const collatorId = new Intl.Collator('id', { numeric: true, sensitivity: 'base' });
const INFO_KOSONG: InfoUrutSantri = { jenjang: '', tingkat: '', kelas: '' };

/** Urutan mode filter santri: kelas → status aktif → nama → jk. */
export function urutSantriFilter(
  santris: readonly Santri[],
  info: Record<number, InfoUrutSantri | undefined>,
): Santri[] {
  return [...santris].sort((a, b) => {
    const ia = info[a.id] ?? INFO_KOSONG;
    const ib = info[b.id] ?? INFO_KOSONG;
    const cKelas = collatorId.compare(ia.kelas, ib.kelas);
    if (cKelas !== 0) return cKelas;
    const aa = a.is_active_pst === 'Ya' ? 0 : 1;
    const ab = b.is_active_pst === 'Ya' ? 0 : 1;
    if (aa !== ab) return aa - ab;
    return collatorId.compare(a.nama_lengkap, b.nama_lengkap)
      || collatorId.compare(a.jk ?? '', b.jk ?? '');
  });
}
