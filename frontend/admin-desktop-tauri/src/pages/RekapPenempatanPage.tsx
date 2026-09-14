import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import { rekapPenempatan, type RekapPenempatanRow } from '../api/siklus';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import {
  FilterLembaga,
  FilterSemester,
  FilterTahunAjaran,
  noopCommit,
  useLembagaTa,
} from '@/components/siklus/bersama';

const FIELDS: ExcelField[] = [
  { key: 'lembaga', label: 'Lembaga', width: 110, kind: 'static' },
  { key: 'tahun_ajaran', label: 'Tahun ajaran', width: 140, kind: 'static' },
  { key: 'tingkat', label: 'Tingkat', width: 80, kind: 'static' },
  { key: 'kelas', label: 'Kelas', width: 180, kind: 'static' },
  { key: 'kapasitas', label: 'Kapasitas', width: 100, kind: 'static' },
  { key: 'terisi', label: 'Terisi', width: 80, kind: 'static' },
  { key: 'sisa', label: 'Sisa', width: 80, kind: 'static' },
];

function gridValues(r: RekapPenempatanRow): Record<string, string | null> {
  return {
    lembaga: r.lembaga,
    tahun_ajaran: r.tahun_ajaran,
    tingkat: r.tingkat,
    kelas: r.kelas,
    kapasitas: r.kapasitas !== null ? String(r.kapasitas) : '—',
    terisi: String(r.terisi),
    sisa: r.sisa !== null ? String(r.sisa) : '—',
  };
}

/** Rekap Penempatan per Kelas: isi vs kapasitas (baca-saja). */
export default function RekapPenempatanPage() {
  const [lembagaId, setLembagaId] = useState('');
  const [taId, setTaId] = useState('');
  const [semester, setSemester] = useState('');
  const [rows, setRows] = useState<RekapPenempatanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const reqRef = useRef(0);
  const { lembagas, tas } = useLembagaTa(lembagaId);

  const load = useCallback(async () => {
    const req = ++reqRef.current;
    setErr('');
    setLoading(true);
    try {
      const res = await rekapPenempatan({
        lembaga_id: lembagaId ? Number(lembagaId) : undefined,
        tahun_ajaran_id: taId ? Number(taId) : undefined,
        semester: semester || undefined,
      });
      if (req !== reqRef.current) return;
      setRows(res.data);
    } catch (e) {
      if (req === reqRef.current) setErr(errorMessage(e));
    } finally {
      if (req === reqRef.current) setLoading(false);
    }
  }, [lembagaId, taId, semester]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable<RekapPenempatanRow>
        tableKey="rekap_penempatan"
        fields={FIELDS}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText="Belum ada kelas pada filter ini."
        canEdit={false}
        onCommit={noopCommit}
        onSaved={noopCommit}
        renderActions={() => null}
        filter={(
          <>
            <FilterLembaga
              id="select_lembaga_rekap"
              value={lembagaId}
              onChange={(v) => { setLembagaId(v); setTaId(''); }}
              lembagas={lembagas}
            />
            <FilterTahunAjaran
              id="select_ta_rekap"
              value={taId}
              onChange={setTaId}
              tas={tas}
            />
            <FilterSemester
              id="select_semester_rekap"
              value={semester}
              onChange={setSemester}
            />
          </>
        )}
      />
    </div>
  );
}
