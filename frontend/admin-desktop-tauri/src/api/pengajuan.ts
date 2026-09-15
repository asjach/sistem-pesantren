import { api } from './client';
import type { Paginate } from './master';

// ---------- Pengajuan biodata santri (portal wali → verifikasi admin) ----------

export interface PengajuanBiodata {
  id: number;
  santri_id: number;
  wali_user_id: number;
  perubahan_json: Record<string, unknown>;
  status: 'diajukan' | 'disetujui' | 'ditolak' | 'dibatalkan' | string;
  catatan_admin: string | null;
  cancelled_at: string | null;
  created_at: string | null;
  santri?: { id: number; nama_lengkap: string; nik: string | null; lembaga_id: number } | null;
  wali?: { id: number; name: string } | null;
}

export function listPengajuan(params: { status?: string; page?: number; per_page?: number } = {}) {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  q.set('page', String(params.page ?? 1));
  if (params.per_page != null) q.set('per_page', String(params.per_page));
  return api<{ pesan: string; data: Paginate<PengajuanBiodata>; badge: Record<string, number> }>(
    `/admin/pengajuan-biodata?${q.toString()}`,
  );
}

export function setujuiPengajuan(id: number) {
  return api<{ pesan: string }>(`/admin/pengajuan-biodata/${id}/setujui`, { method: 'POST' });
}

export function tolakPengajuan(id: number, catatan?: string) {
  return api<{ pesan: string }>(`/admin/pengajuan-biodata/${id}/tolak`, {
    method: 'POST',
    body: JSON.stringify({ catatan }),
  });
}
