/** Kontrak anotasi dev; dipakai UI dan middleware Vite. */
export const GRUP_STYLE = [
  { label: 'Jarak', properti: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'row-gap', 'column-gap'] },
  { label: 'Border', properti: ['border-top-width', 'border-top-style', 'border-top-color', 'border-right-width', 'border-right-style', 'border-right-color', 'border-bottom-width', 'border-bottom-style', 'border-bottom-color', 'border-left-width', 'border-left-style', 'border-left-color', 'border-radius'] },
  { label: 'Warna', properti: ['color', 'background-color', 'opacity'] },
  { label: 'Font', properti: ['font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align'] },
  { label: 'Ukuran', properti: ['width', 'height', 'min-width', 'max-width', 'min-height', 'max-height', 'box-sizing'] },
  { label: 'Layout', properti: ['display', 'position', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'flex-grow', 'flex-shrink', 'flex-basis', 'grid-template-columns', 'grid-template-rows'] },
] as const;
export type PropertiStyle = (typeof GRUP_STYLE)[number]['properti'][number];
export type StyleElemen = Partial<Record<PropertiStyle, string>>;
export const PROPERTI_STYLE: readonly PropertiStyle[] = GRUP_STYLE.flatMap((grup) => [...grup.properti]);
export const GRUP_PREVIEW = GRUP_STYLE.filter((grup) => ['Jarak', 'Border', 'Warna', 'Font'].includes(grup.label));
export const PROPERTI_PREVIEW: readonly PropertiStyle[] = GRUP_PREVIEW.flatMap((grup) => [...grup.properti]);

export interface PreviewElemen {
  sebelum: StyleElemen;
  sesudah: StyleElemen;
  perubahan: StyleElemen;
}

export interface KonteksElemen {
  selector: string;
  tag: string;
  teks: string;
  komponen: string[];
  sumber: string | null;
  style?: StyleElemen;
  preview?: PreviewElemen;
}

export const POSISI_RELATIF = {
  di_dalam: 'Di dalam',
  sebelum: 'Sebelum',
  sesudah: 'Sesudah',
} as const;
export type PosisiRelatif = keyof typeof POSISI_RELATIF;

export interface GambarAnotasi {
  berkas: string;
  lebar: number;
  tinggi: number;
  dibuat: string;
  preview_aktif: boolean;
}

export const ID_GAMBAR_VALID = /^[a-zA-Z0-9_-]{1,120}$/;
export const BATAS_GAMBAR = 8 * 1024 * 1024;

export interface Anotasi extends KonteksElemen {
  id: string;
  dibuat: string;
  rute: string;
  instruksi: string;
  tujuan?: KonteksElemen & { posisi: PosisiRelatif };
  gambar?: GambarAnotasi;
}

function teks(nilai: unknown, batas: number): string {
  return typeof nilai === 'string' ? nilai.slice(0, batas) : '';
}

function normalisasiStyle(data: unknown): StyleElemen {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Snapshot style tidak valid.');
  const hasil: StyleElemen = {};
  for (const properti of PROPERTI_STYLE) {
    const nilai = (data as Record<string, unknown>)[properti];
    if (nilai == null) continue;
    if (typeof nilai !== 'string') throw new Error('Nilai snapshot style harus berupa teks.');
    if (nilai.trim()) hasil[properti] = nilai.trim().slice(0, 256);
  }
  return hasil;
}

function konteks(data: Record<string, unknown>): KonteksElemen {
  const hasil: KonteksElemen = {
    selector: teks(data.selector, 4000),
    tag: teks(data.tag, 40),
    teks: teks(data.teks, 400),
    komponen: Array.isArray(data.komponen)
      ? data.komponen.filter((k): k is string => typeof k === 'string').slice(0, 12).map((k) => k.slice(0, 120))
      : [],
    sumber: typeof data.sumber === 'string' ? data.sumber.slice(0, 600) : null,
  };
  if (data.style != null) {
    hasil.style = normalisasiStyle(data.style);
  }
  if (data.preview != null) {
    if (typeof data.preview !== 'object' || Array.isArray(data.preview)) throw new Error('Preview tidak valid.');
    const preview = data.preview as Record<string, unknown>;
    const sebelum = normalisasiStyle(preview.sebelum);
    const sesudah = normalisasiStyle(preview.sesudah);
    const perubahan = normalisasiStyle(preview.perubahan);
    if (!Object.keys(perubahan).length || Object.keys(preview.perubahan as object).some((p) => !PROPERTI_PREVIEW.includes(p as PropertiStyle))) {
      throw new Error('Properti preview tidak didukung.');
    }
    hasil.preview = { sebelum, sesudah, perubahan };
  }
  return hasil;
}

/** Batasi payload dan tolak tujuan tidak lengkap sebelum menulis berkas. */
export function normalisasiAnotasi(data: Record<string, unknown>): Anotasi {
  const instruksi = teks(data.instruksi, 4000).trim();
  if (!instruksi) throw new Error('Instruksi wajib diisi.');

  const hasil: Anotasi = {
    id: teks(data.id, 120) || `anotasi-${Date.now()}`,
    dibuat: teks(data.dibuat, 40) || new Date().toISOString(),
    rute: teks(data.rute, 600),
    ...konteks(data),
    instruksi,
  };

  if (data.tujuan != null) {
    if (typeof data.tujuan !== 'object' || Array.isArray(data.tujuan)) {
      throw new Error('Tujuan anotasi tidak valid.');
    }
    const dataTujuan = data.tujuan as Record<string, unknown>;
    const tujuan = konteks(dataTujuan);
    const posisi = dataTujuan.posisi;
    if (!tujuan.selector.trim() || !tujuan.tag.trim()
      || typeof posisi !== 'string' || !Object.prototype.hasOwnProperty.call(POSISI_RELATIF, posisi)) {
      throw new Error('Elemen dan posisi tujuan wajib lengkap.');
    }
    if (tujuan.selector === hasil.selector) throw new Error('Asal dan tujuan harus berbeda.');
    hasil.tujuan = { ...tujuan, posisi: posisi as PosisiRelatif };
  }

  if (data.gambar != null) {
    const gambar = data.gambar as GambarAnotasi;
    if (!ID_GAMBAR_VALID.test(hasil.id) || typeof gambar !== 'object' || Array.isArray(gambar)
      || gambar.berkas !== `screenshots/${hasil.id}.png`
      || !Number.isInteger(gambar.lebar) || gambar.lebar < 1 || gambar.lebar > 4096
      || !Number.isInteger(gambar.tinggi) || gambar.tinggi < 1 || gambar.tinggi > 4096
      || typeof gambar.dibuat !== 'string' || gambar.dibuat.length > 40 || !Number.isFinite(Date.parse(gambar.dibuat))
      || typeof gambar.preview_aktif !== 'boolean') throw new Error('Metadata screenshot tidak valid.');
    hasil.gambar = { berkas: gambar.berkas, lebar: gambar.lebar, tinggi: gambar.tinggi, dibuat: gambar.dibuat, preview_aktif: gambar.preview_aktif };
  }
  return hasil;
}
