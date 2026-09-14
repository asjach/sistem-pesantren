import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import { listRiwayat, type RiwayatRow } from '../api/siklus';
import { Button } from '@/components/ui/button';
import ExcelTable from '@/components/ExcelTable';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';
import { ActionIcon } from '@/components/RowActions';
import { DialogNaikKelas } from '@/components/siklus/SiklusDialogs';
import {
  FilterLembaga,
  FilterTahunAjaran,
  ROSTER_FIELDS,
  lembagaSeragam,
  noopCommit,
  riwayatValues,
  useLembagaTa,
} from '@/components/siklus/bersama';
import { ChevronUp } from '@/icons';
import { toast } from 'sonner';

/** Kenaikan Kelas: roster semester 2 aktif → naik/mengulang ke tahun baru. */
export default function KenaikanKelasPage() {
  const [lembagaId, setLembagaId] = useState('');
  const [taId, setTaId] = useState('');
  const [search, setSearch] = useState('');
  const [terapkanCari, setTerapkanCari] = useState('');
  const [rows, setRows] = useState<RiwayatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [naikTarget, setNaikTarget] = useState<{ lembagaId: number; rows: RiwayatRow[] } | null>(null);
  const pager = usePager('kenaikan_kelas');
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
          semester: '2',
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
    [pager.page, pager.perPage, pager.sync, lembagaId, taId, terapkanCari],
  );

  useEffect(() => {
    if (pager.ready) load(pager.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, lembagaId, taId, terapkanCari]);

  const bukaNaik = useCallback((pilih: RiwayatRow[]) => {
    const lembaga = lembagaSeragam(pilih);
    if (lembaga === null) {
      toast.error('Pilih baris dari satu lembaga yang sama.');
      return;
    }
    setNaikTarget({ lembagaId: lembaga, rows: pilih });
  }, []);

  const selesaiAksi = useCallback(() => {
    setNaikTarget(null);
    load();
  }, [load]);

  const renderActions = useCallback((r: RiwayatRow) => (
    <ActionIcon id={`btn_naik_${r.id}`} title="Proses kenaikan" onClick={() => bukaNaik([r])}>
      <ChevronUp size={16} />
    </ActionIcon>
  ), [bukaNaik]);

  const renderBulkActions = useCallback((checked: RiwayatRow[], clear: () => void) => (
    <Button
      id="btn_bulk_naik_kelas"
      size="sm"
      onClick={() => { bukaNaik(checked); clear(); }}
    >
      Proses kenaikan {checked.length} terpilih
    </Button>
  ), [bukaNaik]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable<RiwayatRow>
        tableKey="kenaikan_kelas"
        fields={ROSTER_FIELDS}
        rows={rows}
        getValues={riwayatValues}
        loading={loading}
        emptyText="Tidak ada baris semester 2 aktif pada filter ini."
        canEdit={false}
        onCommit={noopCommit}
        onSaved={noopCommit}
        renderActions={renderActions}
        renderBulkActions={renderBulkActions}
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => { setTerapkanCari(search.trim()); pager.goFirst(); }}
        searchPlaceholder="Nama / NIS"
        searchIds={{ form: 'form_cari_kenaikan', input: 'input_cari_kenaikan', button: 'btn_cari_kenaikan' }}
        filter={(
          <>
            <FilterLembaga
              id="select_lembaga_kenaikan"
              value={lembagaId}
              onChange={(v) => { setLembagaId(v); setTaId(''); pager.goFirst(); }}
              lembagas={lembagas}
            />
            <FilterTahunAjaran
              id="select_ta_kenaikan"
              value={taId}
              onChange={(v) => { setTaId(v); pager.goFirst(); }}
              tas={tas}
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

      {naikTarget && (
        <DialogNaikKelas
          lembagaId={naikTarget.lembagaId}
          rows={naikTarget.rows}
          onClose={() => setNaikTarget(null)}
          onDone={selesaiAksi}
        />
      )}
    </div>
  );
}
