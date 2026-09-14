import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import { listAlumni, type Alumni, type RiwayatRow } from '../api/siklus';
import { Button } from '@/components/ui/button';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';
import { DialogLulus } from '@/components/siklus/SiklusDialogs';
import { SantriPickerDialog } from '@/components/siklus/SantriPickerDialog';
import { FilterTahunAjaran, noopCommit, useLembagaTa } from '@/components/siklus/bersama';

const FIELDS: ExcelField[] = [
  { key: 'santri', label: 'Santri', width: 200, kind: 'static' },
  { key: 'lembaga', label: 'Lembaga lulus', width: 180, kind: 'static' },
  { key: 'ta', label: 'Tahun lulus', width: 140, kind: 'static' },
  { key: 'ijazah', label: 'No. ijazah', width: 160, kind: 'static' },
  { key: 'tanggal', label: 'Tanggal lulus', width: 120, kind: 'static' },
  { key: 'penyerahan', label: 'Ijazah', width: 100, kind: 'static' },
  { key: 'melanjutkan', label: 'Lanjut', width: 90, kind: 'static' },
];

function gridValues(a: Alumni): Record<string, string | null> {
  return {
    santri: a.santri?.nama_lengkap ?? String(a.santri_id),
    lembaga: a.lembaga_lulus?.kode ?? a.lembaga_lulus?.nama ?? String(a.lembaga_lulus_id),
    ta: a.tahun_ajaran_lulus?.nama ?? String(a.tahun_ajaran_lulus_id),
    ijazah: a.nomor_ijazah,
    tanggal: a.tanggal_lulus ? a.tanggal_lulus.slice(0, 10) : null,
    penyerahan: a.penyerahan_ijazah,
    melanjutkan: a.melanjutkan,
  };
}

/** Alumni: arsip lulusan + tombol "Proses kelulusan" (dua jalur). */
export default function AlumniPage() {
  const [taId, setTaId] = useState('');
  const [rows, setRows] = useState<Alumni[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lulusRow, setLulusRow] = useState<RiwayatRow | null>(null);
  const pager = usePager('alumni');
  const reqRef = useRef(0);
  const { tas } = useLembagaTa('');

  const load = useCallback(
    async function loadPage(p = pager.page, pp = pager.perPage) {
      const req = ++reqRef.current;
      setErr('');
      setLoading(true);
      try {
        const res = await listAlumni({
          tahun_ajaran_lulus_id: taId ? Number(taId) : undefined,
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
    [pager.page, pager.perPage, pager.sync, taId],
  );

  useEffect(() => {
    if (pager.ready) load(pager.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, taId]);

  const selesaiAksi = useCallback(() => {
    setLulusRow(null);
    load();
  }, [load]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable<Alumni>
        tableKey="alumni"
        fields={FIELDS}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText="Belum ada alumni."
        canEdit={false}
        onCommit={noopCommit}
        onSaved={noopCommit}
        renderActions={() => null}
        addButton={(
          <Button id="btn_lulus_baru" onClick={() => setPickerOpen(true)}>
            Proses kelulusan
          </Button>
        )}
        filter={(
          <FilterTahunAjaran
            id="select_ta_lulus_alumni"
            value={taId}
            onChange={(v) => { setTaId(v); pager.goFirst(); }}
            tas={tas}
            label="Tahun lulus"
          />
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

      <SantriPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        judul="Pilih santri untuk diproses kelulusan"
        onPick={setLulusRow}
      />
      {lulusRow && (
        <DialogLulus row={lulusRow} onClose={() => setLulusRow(null)} onDone={selesaiAksi} />
      )}
    </div>
  );
}
