import { useEffect, useState } from 'react';
import { listLembaga, listTahunAjaran, type Lembaga, type TahunAjaran } from '@/api/master';
import type { RiwayatRow } from '@/api/siklus';
import type { ExcelField } from '@/components/ExcelTable';
import FilterField from '@/components/FilterField';
import { formatStatus } from '@/lib/nilaiTampil';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Kolom grid roster riwayat (Daftar Kelas, Riwayat Belajar, Kenaikan, Pindah Kelas). */
export const ROSTER_FIELDS: ExcelField[] = [
  { key: 'santri', label: 'santri.nama_lengkap', width: 200, kind: 'static', sumber: { tabel: 'santri', kolom: 'nama_lengkap' } },
  { key: 'nis', label: 'nis_lokal', width: 110, kind: 'static', sumber: { tabel: 'lembaga_santri', kolom: 'nis_lokal' } },
  { key: 'lembaga', label: 'lembaga.jenjang', width: 110, kind: 'static', sumber: { tabel: 'lembaga', kolom: 'jenjang' } },
  { key: 'smt', label: 'semester', width: 60, kind: 'static', sumber: { tabel: 'riwayat_belajar', kolom: 'semester' } },
  { key: 'tingkat', label: 'tingkat', width: 80, kind: 'static', sumber: { tabel: 'riwayat_belajar', kolom: 'tingkat' } },
  { key: 'kelas', label: 'kelas.nama_kelas', width: 140, kind: 'static', sumber: { tabel: 'kelas', kolom: 'nama_kelas' } },
  { key: 'absen', label: 'no_absen', width: 70, kind: 'static', sumber: { tabel: 'riwayat_belajar', kolom: 'no_absen' } },
  { key: 'status', label: 'status_awal', width: 130, kind: 'static', sumber: { tabel: 'riwayat_belajar', kolom: 'status_awal' } },
  { key: 'masuk', label: 'tgl_masuk', width: 110, kind: 'static', sumber: { tabel: 'riwayat_belajar', kolom: 'tgl_masuk' } },
];

export function riwayatValues(r: RiwayatRow): Record<string, string | null> {
  return {
    santri: r.santri?.nama_lengkap ?? String(r.santri_id),
    nis: r.nis_lokal ?? null,
    lembaga: r.lembaga?.jenjang ?? String(r.jenjang),
    smt: r.semester,
    tingkat: r.tingkat,
    kelas: r.kelas?.nama_kelas ?? '—',
    absen: r.no_absen !== null && r.no_absen !== undefined ? String(r.no_absen) : null,
    status: formatStatus(r.status_awal),
    masuk: r.tgl_masuk ? r.tgl_masuk.slice(0, 10) : null,
  };
}

/** Commit/no-op untuk tabel baca-saja. */
export async function noopCommit(): Promise<void> {}

/** Satu lembaga saja? → id-nya; campuran/kosong → null. */
export function lembagaSeragam(rows: { jenjang: string }[]): string | null {
  if (rows.length === 0) return null;
  const id = rows[0].jenjang;
  return rows.every((r) => r.jenjang === id) ? id : null;
}

/** Muat daftar lembaga + tahun ajaran (TA mengikuti lembaga terpilih). */
export function useLembagaTa(jenjang: string) {
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [tas, setTas] = useState<TahunAjaran[]>([]);

  useEffect(() => {
    listLembaga({ per_page: 100 }).then((p) => setLembagas(p.data)).catch(() => {});
  }, []);

  useEffect(() => {
    listTahunAjaran({ jenjang: jenjang || undefined, per_page: 100 })
      .then((p) => setTas(p.data))
      .catch(() => {});
  }, [jenjang]);

  return { lembagas, tas };
}
