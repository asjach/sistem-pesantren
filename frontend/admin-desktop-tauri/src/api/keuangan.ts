import { api } from './client';

// ---------- Keuangan (103: tagihan, generate bulanan, bayar, void) ----------

export interface Tagihan {
  id: number;
  no_tagihan: string;
  santri_id: number | null;
  psb_calon_santri_id: number | null;
  pos_keuangan_id: number;
  tahun_ajaran_id: number;
  lembaga_id: number;
  periode: string | null;
  paket_kode: string | null;
  nominal_total: string | number;
  nominal_terbayar: string | number;
  sisa_tagihan: string | number;
  status: 'belum_bayar' | 'mencicil' | 'lunas' | string;
  pos_keuangan?: { id: number; kode_pos: string; nama_pos: string } | null;
}

export interface Pembayaran {
  id: number;
  no_kuitansi: string;
  akun_kas_id: number;
  user_id: number;
  santri_id: number | null;
  psb_calon_santri_id: number | null;
  tgl_pembayaran: string | null;
  total_bayar: string | number;
  metode_pembayaran: string;
  catatan: string | null;
}

export function tagihanSantri(santriId: number) {
  return api<{ pesan: string; data: Tagihan[] }>(`/keuangan/santri/${santriId}/tagihan`);
}

export function generateBulanan(input: { lembaga_id: number; tahun_ajaran_id: number; periode: string }) {
  return api<{ pesan: string; data: { berhasil: number; dilewati_paket: number; gagal: { santri_id: number; pos_id: number; pesan: string }[] } }>(
    '/keuangan/tagihan/generate-bulanan',
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function bayarTagihan(input: {
  akun_kas_id: number;
  total_bayar: number;
  metode_pembayaran: string;
  items: { tagihan_id: number; nominal_dibayar: number }[];
  tgl_pembayaran?: string;
  catatan?: string;
  santri_id?: number;
  client_op_id?: string;
}) {
  return api<{ pesan: string; data: Pembayaran }>('/keuangan/bayar', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function voidPembayaran(pembayaranId: number, alasan: string) {
  return api<{ pesan: string; data: Pembayaran }>(`/keuangan/pembayaran/${pembayaranId}/void`, {
    method: 'POST',
    body: JSON.stringify({ alasan }),
  });
}
