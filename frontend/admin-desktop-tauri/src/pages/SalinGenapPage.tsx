import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import { listRiwayat, type RiwayatRow } from '../api/siklus';
import { Button } from '@/components/ui/button';
import ExcelTable from '@/components/ExcelTable';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';
import { ActionIcon } from '@/components/RowActions';
import { DialogSalinGenap } from '@/components/siklus/SiklusDialogs';
import {
  FilterLembaga,
  FilterTahunAjaran,
  ROSTER_FIELDS,
  lembagaSeragam,
  noopCommit,
  riwayatValues,
  useLembagaTa,
} from '@/components/siklus/bersama';
import { Copy } from '@/icons';
import { toast } from 'sonner';

/** Salin Ganjil→Genap: roster semester 1 aktif disalin ke semester 2. */
export default function SalinGenapPage() {
  const [lembagaId, setLembagaId] = useState('');
  const [taId, setTaId] = useState('');
  const [search, setSearch] = useState('');
  const [terapkanCari, setTerapkanCari] = useState('');
  const [rows, setRows] = useState<RiwayatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [salinTarget, setSalinTarget] = useState<{ lembagaId: number; rows: RiwayatRow[] | null } | null>(null);
  const pager = usePager('salin_genap');
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
          semester: '1',
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

  const bukaSalin = useCallback((pilih: RiwayatRow[] | null, fallbackLembagaId?: number) => {
    const lembaga = pilih ? lembagaSeragam(pilih) : (fallbackLembagaId ?? null);
    if (lembaga === null) {
      toast.error('Pilih satu lembaga dulu (filter) sebelum salin ke genap.');
      return;
    }
    setSalinTarget({ lembagaId: lembaga, rows: pilih });
  }, []);

  const selesaiAksi = useCallback(() => {
    setSalinTarget(null);
    load();
  }, [load]);

  const renderActions = useCallback((r: RiwayatRow) => (
    <ActionIcon id={`btn_salin_${r.id}`} title="Salin ke genap" onClick={() => bukaSalin([r])}>
      <Copy size={16} />
    </ActionIcon>
  ), [bukaSalin]);

  const renderBulkActions = useCallback((checked: RiwayatRow[], clear: () => void) => (
    <Button
      id="btn_bulk_salin_genap"
      size="sm"
      onClick={() => { bukaSalin(checked); clear(); }}
    >
      Salin {checked.length} terpilih ke genap
    </Button>
  ), [bukaSalin]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable<RiwayatRow>
        tableKey="salin_genap"
        fields={ROSTER_FIELDS}
        rows={rows}
        getValues={riwayatValues}
        loading={loading}
        emptyText="Tidak ada baris ganjil (semester 1) aktif."
        canEdit={false}
        onCommit={noopCommit}
        onSaved={noopCommit}
        renderActions={renderActions}
        renderBulkActions={renderBulkActions}
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => { setTerapkanCari(search.trim()); pager.goFirst(); }}
        searchPlaceholder="Nama / NIS"
        searchIds={{ form: 'form_cari_salin_genap', input: 'input_cari_salin_genap', button: 'btn_cari_salin_genap' }}
        addButton={(
          <Button
            id="btn_salin_semua_genap"
            variant="outline"
            onClick={() => bukaSalin(null, lembagaId ? Number(lembagaId) : undefined)}
          >
            Salin semua ganjil
          </Button>
        )}
        filter={(
          <>
            <FilterLembaga
              id="select_lembaga_salin_genap"
              value={lembagaId}
              onChange={(v) => { setLembagaId(v); setTaId(''); pager.goFirst(); }}
              lembagas={lembagas}
            />
            <FilterTahunAjaran
              id="select_ta_salin_genap"
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

      {salinTarget && (
        <DialogSalinGenap
          lembagaId={salinTarget.lembagaId}
          rows={salinTarget.rows}
          onClose={() => setSalinTarget(null)}
          onDone={selesaiAksi}
        />
      )}
    </div>
  );
}
