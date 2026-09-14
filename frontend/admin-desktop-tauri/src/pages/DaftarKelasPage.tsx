import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import { listRiwayat, type RiwayatRow } from '../api/siklus';
import ExcelTable from '@/components/ExcelTable';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';
import {
  FilterLembaga,
  FilterSemester,
  FilterTahunAjaran,
  ROSTER_FIELDS,
  noopCommit,
  riwayatValues,
  useLembagaTa,
} from '@/components/siklus/bersama';

/** Daftar Kelas: santri aktif (per kelas) pada tahun & semester berjalan.
 *  Default semua lembaga untuk admin full/super_admin; admin scoped terbatas
 *  otomatis oleh backend. Baca-saja. */
export default function DaftarKelasPage() {
  const [lembagaId, setLembagaId] = useState('');
  const [taId, setTaId] = useState('');
  const [semester, setSemester] = useState('');
  const [search, setSearch] = useState('');
  const [terapkanCari, setTerapkanCari] = useState('');
  const [rows, setRows] = useState<RiwayatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pager = usePager('daftar_kelas');
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
          semester: semester || undefined,
          is_aktif: true,
          q: terapkanCari || undefined,
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
    [pager.page, pager.perPage, pager.sync, lembagaId, taId, semester, terapkanCari],
  );

  useEffect(() => {
    if (pager.ready) load(pager.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, lembagaId, taId, semester, terapkanCari]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable<RiwayatRow>
        tableKey="daftar_kelas"
        fields={ROSTER_FIELDS}
        rows={rows}
        getValues={riwayatValues}
        loading={loading}
        emptyText="Tidak ada santri aktif pada filter ini."
        canEdit={false}
        onCommit={noopCommit}
        onSaved={noopCommit}
        renderActions={() => null}
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => { setTerapkanCari(search.trim()); pager.goFirst(); }}
        searchPlaceholder="Nama / NIS"
        searchIds={{ form: 'form_cari_daftar_kelas', input: 'input_cari_daftar_kelas', button: 'btn_cari_daftar_kelas' }}
        filter={(
          <>
            <FilterLembaga
              id="select_lembaga_daftar_kelas"
              value={lembagaId}
              onChange={(v) => { setLembagaId(v); setTaId(''); pager.goFirst(); }}
              lembagas={lembagas}
            />
            <FilterTahunAjaran
              id="select_ta_daftar_kelas"
              value={taId}
              onChange={(v) => { setTaId(v); pager.goFirst(); }}
              tas={tas}
            />
            <FilterSemester
              id="select_semester_daftar_kelas"
              value={semester}
              onChange={(v) => { setSemester(v); pager.goFirst(); }}
            />
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
