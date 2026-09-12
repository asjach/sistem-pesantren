export const API_BASE =
  (import.meta.env.VITE_PSB_API_BASE as string | undefined) ?? 'http://127.0.0.1:8000/api';

export type TipeSantri = 'asrama' | 'non_asrama';
export type JenisKelamin = 'L' | 'P';

export interface KuotaBiaya {
  tipe_santri: 'semua' | TipeSantri;
  nominal_pendaftaran: number;
  nominal_pendaftaran_lanjutan: number | null;
  nominal_paket: number | null;
  sisa_kuota: number | null;
}

export interface LembagaOpsi {
  id: number;
  kode: string;
  nama: string;
  nama_singkat: string | null;
  kelompok_psb: string | null;
  is_seleksi: boolean;
  tingkat_baru: string | null;
  tingkat_pindahan: string[];
  biaya_masuk: number;
  biaya_asrama: number;
  kuota_biaya: KuotaBiaya[];
}

export interface GelombangAktif {
  id: number;
  nama: string;
  nomor: number | null;
  tgl_buka: string | null;
  tgl_tutup: string | null;
  kegiatan: { id: number; nama: string } | null;
}

export interface OpsiPendaftaran {
  gelombang_aktif: GelombangAktif | null;
  lembaga: LembagaOpsi[];
}

export interface FormPendaftaran {
  lembaga_id: number | null;
  paket: boolean;
  is_pindahan: boolean;
  masuk_tingkat: string;
  tipe_santri: TipeSantri;
  nik: string;
  nama_lengkap: string;
  jk: JenisKelamin | '';
  tgl_lahir: string;
  nama_ayah: string;
  nama_ibu: string;
  email_ortu: string;
  telp_ortu: string;
  bukti_transfer: File | null;
  setuju: boolean;
}

export interface HasilPendaftaran {
  no_pendaftaran: string;
  status: string;
  signed_url_bukti: string;
}

export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]>;

  constructor(status: number, message: string, errors: Record<string, string[]> = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function baca<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.pesan ?? body?.message ?? 'Terjadi kesalahan. Coba lagi.',
      body?.errors ?? {},
    );
  }
  return body as T;
}

export async function ambilOpsi(): Promise<OpsiPendaftaran> {
  const res = await fetch(`${API_BASE}/psb/opsi`, { headers: { Accept: 'application/json' } });
  const body = await baca<{ data: OpsiPendaftaran }>(res);
  return body.data;
}

export async function cekNik(nik: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/psb/cek-nik`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ nik }),
  });
  const body = await baca<{ terdaftar: boolean }>(res);
  return body.terdaftar;
}

export async function kirimPendaftaran(
  form: FormPendaftaran,
  lembagaId: number,
): Promise<HasilPendaftaran> {
  const fd = new FormData();
  fd.set('lembaga_id', String(lembagaId));
  fd.set('tipe_santri', form.paket ? 'non_asrama' : form.tipe_santri);
  fd.set('nik', form.nik);
  fd.set('nama_lengkap', form.nama_lengkap.trim());
  fd.set('is_pindahan', form.is_pindahan ? '1' : '0');
  if (form.jk) fd.set('jk', form.jk);
  if (form.tgl_lahir) fd.set('tgl_lahir', form.tgl_lahir);
  if (form.email_ortu.trim()) fd.set('email_ortu', form.email_ortu.trim());
  if (form.telp_ortu.trim()) fd.set('telp_ortu', form.telp_ortu.trim());
  if (form.nama_ayah.trim()) fd.set('nama_ayah', form.nama_ayah.trim());
  if (form.nama_ibu.trim()) fd.set('nama_ibu', form.nama_ibu.trim());
  if (form.is_pindahan && form.masuk_tingkat) fd.set('masuk_tingkat', form.masuk_tingkat);
  if (form.paket) fd.set('paket', 'MI-MD');
  if (form.bukti_transfer) fd.set('bukti_transfer', form.bukti_transfer);

  const url = form.paket ? `${API_BASE}/psb/daftar-paket` : `${API_BASE}/psb/daftar`;
  const res = await fetch(url, { method: 'POST', headers: { Accept: 'application/json' }, body: fd });

  const body = await baca<{
    data: {
      no_pendaftaran: string;
      waiting: boolean;
      calon: { status_pendaftaran: string };
      signedUrlBukti: string;
    };
  }>(res);

  return {
    no_pendaftaran: body.data.no_pendaftaran,
    status: body.data.waiting ? 'waiting_list' : body.data.calon.status_pendaftaran,
    signed_url_bukti: body.data.signedUrlBukti,
  };
}
