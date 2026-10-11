import { api } from './client';

export type ArahUrut = 'naik' | 'turun';

/** Satu opsi urut yang tampil di dropdown: kode backend berurut + label +
 *  arah bawaan. Nilai AWAL (opsi terpilih saat halaman dibuka) ditentukan
 *  lewat popover "Nilai awal", bukan flag di preset. */
export interface OpsiUrut {
  kode: string[];
  label: string;
  arah: ArahUrut | null;
  arah_kolom?: Record<string, ArahUrut> | null;
}

/** Kode urut yang diizinkan backend + kolom DB-nya (untuk dialog pengelolaan). */
export interface KodeUrut {
  kode: string;
  kolom: string[];
}

export interface PresetUrutData {
  table_key: string;
  opsi: OpsiUrut[];
  tersedia: KodeUrut[];
}

/** Memo janji preset per tabel: pemakaian serentak (hook data + dropdown +
 *  dialog kelola) berbagi satu request. Entri gagal dibuang agar bisa dicoba
 *  lagi; simpan/hapus mengosongkan semuanya. */
const memoMuat = new Map<string, Promise<{ pesan: string; data: PresetUrutData }>>();

export function muatUrutPreset(tableKey: string, segar = false): Promise<{ pesan: string; data: PresetUrutData }> {
  if (segar) memoMuat.delete(tableKey);
  let janji = memoMuat.get(tableKey);
  if (!janji) {
    janji = api<{ pesan: string; data: PresetUrutData }>(
      `/admin/urut-preset?table_key=${encodeURIComponent(tableKey)}`,
    );
    memoMuat.set(tableKey, janji);
    janji.then(undefined, () => {
      if (memoMuat.get(tableKey) === janji) memoMuat.delete(tableKey);
    });
  }
  return janji;
}

/** Arah per kode dari satu opsi preset (hanya kode yang benar-benar diatur). */
export function arahKolomDariOpsi(o: Pick<OpsiUrut, 'kode' | 'arah_kolom'>): Record<string, ArahUrut> | undefined {
  const peta = o.arah_kolom;
  if (!peta || Object.keys(peta).length === 0) return undefined;
  const keluar: Record<string, ArahUrut> = {};
  for (const k of o.kode) {
    if (peta[k] === 'naik' || peta[k] === 'turun') keluar[k] = peta[k];
  }
  return Object.keys(keluar).length > 0 ? keluar : undefined;
}

export function simpanUrutPreset(tableKey: string, opsi: OpsiUrut[]) {
  memoMuat.clear();
  return api<{ pesan: string; data: unknown }>('/admin/urut-preset', {
    method: 'PUT',
    body: JSON.stringify({ table_key: tableKey, opsi }),
  });
}

export function hapusUrutPreset(tableKey: string) {
  memoMuat.clear();
  return api<{ pesan: string }>(`/admin/urut-preset?table_key=${encodeURIComponent(tableKey)}`, {
    method: 'DELETE',
  });
}
