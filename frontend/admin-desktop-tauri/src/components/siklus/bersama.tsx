import { useEffect, useState } from 'react';
import { listLembaga, listTahunAjaran, type Lembaga, type TahunAjaran } from '@/api/master';
import type { RiwayatRow } from '@/api/siklus';
import type { ExcelField } from '@/components/ExcelTable';
import FilterField from '@/components/FilterField';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Kolom grid roster riwayat (dipakai Daftar Kelas, Roster, Penempatan, Kenaikan, Salin, Arsip). */
export const ROSTER_FIELDS: ExcelField[] = [
  { key: 'santri', label: 'Santri', width: 200, kind: 'static' },
  { key: 'nis', label: 'NIS', width: 100, kind: 'static' },
  { key: 'lembaga', label: 'Lembaga', width: 110, kind: 'static' },
  { key: 'smt', label: 'Smt', width: 60, kind: 'static' },
  { key: 'tingkat', label: 'Tingkat', width: 80, kind: 'static' },
  { key: 'kelas', label: 'Kelas', width: 140, kind: 'static' },
  { key: 'absen', label: 'Absen', width: 70, kind: 'static' },
  { key: 'status', label: 'Status awal', width: 130, kind: 'static' },
  { key: 'masuk', label: 'Tgl masuk', width: 110, kind: 'static' },
];

export function riwayatValues(r: RiwayatRow): Record<string, string | null> {
  return {
    santri: r.santri?.nama_lengkap ?? String(r.santri_id),
    nis: r.nis ?? r.santri?.nis ?? null,
    lembaga: r.lembaga?.kode ?? r.lembaga?.nama ?? String(r.lembaga_id),
    smt: r.semester,
    tingkat: r.tingkat,
    kelas: r.kelas?.nama_kelas ?? '—',
    absen: r.no_absen !== null && r.no_absen !== undefined ? String(r.no_absen) : null,
    status: r.status_awal,
    masuk: r.tgl_masuk ? r.tgl_masuk.slice(0, 10) : null,
  };
}

/** Commit/no-op untuk tabel baca-saja. */
export async function noopCommit(): Promise<void> {}

/** Satu lembaga saja? → id-nya; campuran/kosong → null. */
export function lembagaSeragam(rows: { lembaga_id: number }[]): number | null {
  if (rows.length === 0) return null;
  const id = rows[0].lembaga_id;
  return rows.every((r) => r.lembaga_id === id) ? id : null;
}

/** Muat daftar lembaga + tahun ajaran (TA mengikuti lembaga terpilih). */
export function useLembagaTa(lembagaId: string) {
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [tas, setTas] = useState<TahunAjaran[]>([]);

  useEffect(() => {
    listLembaga({ per_page: 100 }).then((p) => setLembagas(p.data)).catch(() => {});
  }, []);

  useEffect(() => {
    listTahunAjaran({ lembaga_id: lembagaId ? Number(lembagaId) : undefined, per_page: 100 })
      .then((p) => setTas(p.data))
      .catch(() => {});
  }, [lembagaId]);

  return { lembagas, tas };
}

/** Filter Lembaga (opsional "Semua lembaga"; default semua untuk admin full). */
export function FilterLembaga({ id, value, onChange, lembagas }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  lembagas: Lembaga[];
}) {
  return (
    <FilterField label="Lembaga" htmlFor={id}>
      <Select value={value === '' ? '_semua' : value} onValueChange={(v) => onChange(v === '_semua' ? '' : v)}>
        <SelectTrigger id={id} title="Filter lembaga" aria-label="Filter lembaga" size="sm" className="w-40">
          <SelectValue placeholder="Semua" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="_semua">Semua lembaga</SelectItem>
            {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.kode ?? l.nama}</SelectItem>)}
          </SelectGroup>
        </SelectContent>
      </Select>
    </FilterField>
  );
}

/** Filter Tahun ajaran (label bisa disesuaikan, mis. "Tahun lulus"). */
export function FilterTahunAjaran({ id, value, onChange, tas, label = 'Tahun ajaran' }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  tas: TahunAjaran[];
  label?: string;
}) {
  return (
    <FilterField label={label} htmlFor={id}>
      <Select value={value === '' ? '_semua' : value} onValueChange={(v) => onChange(v === '_semua' ? '' : v)}>
        <SelectTrigger id={id} title={`Filter ${label.toLowerCase()}`} aria-label={`Filter ${label.toLowerCase()}`} size="sm" className="w-40">
          <SelectValue placeholder="Semua" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="_semua">Semua tahun</SelectItem>
            {tas.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.nama}</SelectItem>)}
          </SelectGroup>
        </SelectContent>
      </Select>
    </FilterField>
  );
}

/** Filter semester (1/2). */
export function FilterSemester({ id = 'select_semester_siklus', value, onChange }: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FilterField label="Semester" htmlFor={id}>
      <Select value={value === '' ? '_semua' : value} onValueChange={(v) => onChange(v === '_semua' ? '' : v)}>
        <SelectTrigger id={id} title="Filter semester" aria-label="Filter semester" size="sm" className="w-32">
          <SelectValue placeholder="Semua" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="_semua">Semua smt</SelectItem>
            <SelectItem value="1">Semester 1</SelectItem>
            <SelectItem value="2">Semester 2</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </FilterField>
  );
}
