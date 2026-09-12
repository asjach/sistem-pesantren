import type { KuotaBiaya, LembagaOpsi, TipeSantri } from '../api/psb';

export function biayaUntuk(lembaga: LembagaOpsi | null | undefined, tipe: TipeSantri): KuotaBiaya | null {
  if (!lembaga) return null;
  return (
    lembaga.kuota_biaya.find((k) => k.tipe_santri === tipe) ??
    lembaga.kuota_biaya.find((k) => k.tipe_santri === 'semua') ??
    null
  );
}

export function tipeTersedia(lembaga: LembagaOpsi | null | undefined): TipeSantri[] {
  if (!lembaga) return [];
  const hasil = new Set<TipeSantri>();
  for (const k of lembaga.kuota_biaya) {
    if (k.tipe_santri === 'semua') {
      hasil.add('non_asrama');
      hasil.add('asrama');
    } else {
      hasil.add(k.tipe_santri);
    }
  }
  return (['non_asrama', 'asrama'] as TipeSantri[]).filter((t) => hasil.has(t));
}

export interface PaketInfo {
  lembagaPrimer: LembagaOpsi;
  lembagaSekunder: LembagaOpsi;
  biaya: KuotaBiaya;
}

export function infoPaket(daftarLembaga: LembagaOpsi[] | null | undefined): PaketInfo | null {
  if (!daftarLembaga) return null;
  const lembagaPrimer = daftarLembaga.find((l) => l.kode === 'MI');
  const lembagaSekunder = daftarLembaga.find((l) => l.kode === 'MD');
  if (!lembagaPrimer || !lembagaSekunder) return null;
  const biaya = biayaUntuk(lembagaPrimer, 'non_asrama');
  if (!biaya || biaya.nominal_paket === null) return null;
  return { lembagaPrimer, lembagaSekunder, biaya };
}

export function labelTipe(tipe: TipeSantri): string {
  return tipe === 'asrama' ? 'Asrama (Mondok)' : 'Non Asrama (Pulang)';
}

export function labelStatus(status: string): string {
  if (status === 'waiting_list') return 'Waiting List';
  if (status === 'baru') return 'Baru';
  return status;
}
