import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import { listRiwayat, type RiwayatRow } from '../api/siklus';
import ExcelTable from '@/components/ExcelTable';
import FilterField from '@/components/FilterField';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';
import {
  FilterLembaga,
  FilterTahunAjaran,
  ROSTER_FIELDS,
  noopCommit,
  riwayatValues,
  useLembagaTa,
} from '@/components/siklus/bersama';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_AKHIR = [
  { value: 'aktif', label: 'Berhenti / arsip' },
  { value: 'naik', label: 'Naik' },
  { value: 'tidak_naik', label: 'Tidak naik' },
  { value: 'lulus', label: 'Lulus' },
  { value: 'tidak_lulus', label: 'Tidak lulus' },
  { value: 'pindah_keluar', label: 'Pindah/keluar' },
];

/** Arsip Berhenti/Nonaktif: baris riwayat non-aktif (default status_akhir aktif). */
export default function ArsipBerhentiPage() {
  const [lembagaId, setLembagaId] = useState('');
  const [taId, setTaId] = useState('');
  const [statusAkhir, setStatusAkhir] = useState('aktif');
  const [rows, setRows] = useState<RiwayatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pager = usePager('arsip_berhenti');
  const reqRef = useRef(0);
  const { lembagas, tas } = useLembagaTa(lembagaId);

  const load = useCallback(
    async function loadPage(p = pager.page, pp = pager.perPage) {
      const req = ++reqRef.current;
      setErr('');
      setLoading(true);
      try {
        const res = await listRiwayat({
          lembaga_id: lembagaId ? Number(lembagaId) : undefined,
          tahun_ajaran_id: taId ? Number(taId) : undefined,
          is_aktif: false,
          status_akhir: statusAkhir || undefined,
          page: p,
          per_page: pp,
        });
        if (req !== reqRef.current) return;
        const fix = pager.sync(res.current_page, res.last_page);
        if (fix != null && fix !== p) {
          await loadPage(fix, pp);
          return;
        }
        if (req !== reqRef.current) return;
        setRows(res.data);
        setLastPage(res.last_page);
        setTotal(res.total);
      } catch (e) {
        if (req === reqRef.current) setErr(errorMessage(e));
      } finally {
        if (req === reqRef.current) setLoading(false);
      }
    },
    [pager.page, pager.perPage, pager.sync, lembagaId, taId, statusAkhir],
  );

  useEffect(() => {
    if (pager.ready) load(pager.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, lembagaId, taId, statusAkhir]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable<RiwayatRow>
        tableKey="arsip_berhenti"
        fields={ROSTER_FIELDS}
        rows={rows}
        getValues={riwayatValues}
        loading={loading}
        emptyText="Tidak ada riwayat non-aktif pada filter ini."
        canEdit={false}
        onCommit={noopCommit}
        onSaved={noopCommit}
        renderActions={() => null}
        filter={(
          <>
            <FilterLembaga
              id="select_lembaga_arsip"
              value={lembagaId}
              onChange={(v) => { setLembagaId(v); setTaId(''); pager.goFirst(); }}
              lembagas={lembagas}
            />
            <FilterTahunAjaran
              id="select_ta_arsip"
              value={taId}
              onChange={(v) => { setTaId(v); pager.goFirst(); }}
              tas={tas}
            />
            <FilterField label="Status akhir" htmlFor="select_status_akhir_arsip">
              <Select value={statusAkhir} onValueChange={(v) => { setStatusAkhir(v); pager.goFirst(); }}>
                <SelectTrigger id="select_status_akhir_arsip" title="Filter status akhir" aria-label="Filter status akhir" size="sm" className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {STATUS_AKHIR.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FilterField>
          </>
        )}
      />
      <Pager
        page={pager.page}
        lastPage={lastPage}
        total={total}
        perPage={pager.perPage}
        onPage={(p) => { pager.setPage(p); load(p); }}
        onPerPage={(pp) => { pager.setPerPage(pp); load(1, pp); }}
      />
    </div>
  );
}
