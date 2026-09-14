import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import { listMutasiKeluar, type MutasiKeluar, type RiwayatRow } from '../api/siklus';
import { Button } from '@/components/ui/button';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';
import { DialogMutasi } from '@/components/siklus/SiklusDialogs';
import { SantriPickerDialog } from '@/components/siklus/SantriPickerDialog';
import { FilterLembaga, noopCommit, useLembagaTa } from '@/components/siklus/bersama';

const FIELDS: ExcelField[] = [
  { key: 'santri', label: 'Santri', width: 200, kind: 'static' },
  { key: 'lembaga', label: 'Lembaga', width: 180, kind: 'static' },
  { key: 'kelas', label: 'Kelas terakhir', width: 130, kind: 'static' },
  { key: 'tanggal', label: 'Tanggal', width: 110, kind: 'static' },
  { key: 'alasan', label: 'Alasan', width: 140, kind: 'static' },
  { key: 'tujuan', label: 'Sekolah tujuan', width: 220, kind: 'static' },
  { key: 'no_surat', label: 'No. surat', width: 140, kind: 'static' },
];

function gridValues(m: MutasiKeluar): Record<string, string | null> {
  return {
    santri: m.santri?.nama_lengkap ?? String(m.santri_id),
    lembaga: m.lembaga?.kode ?? m.lembaga?.nama ?? String(m.lembaga_id),
    kelas: m.kelas_terakhir?.nama_kelas ?? '—',
    tanggal: m.tanggal_mutasi ? m.tanggal_mutasi.slice(0, 10) : null,
    alasan: m.alasan_mutasi,
    tujuan: m.nama_sekolah_tujuan,
    no_surat: m.no_surat,
  };
}

/** Mutasi Keluar: arsip mutasi + tombol "Mutasi baru" (dua jalur). */
export default function MutasiKeluarPage() {
  const [lembagaId, setLembagaId] = useState('');
  const [rows, setRows] = useState<MutasiKeluar[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mutasiRow, setMutasiRow] = useState<RiwayatRow | null>(null);
  const pager = usePager('mutasi_keluar');
  const reqRef = useRef(0);
  const { lembagas } = useLembagaTa(lembagaId);

  const load = useCallback(
    async function loadPage(p = pager.page, pp = pager.perPage) {
      const req = ++reqRef.current;
      setErr('');
      setLoading(true);
      try {
        const res = await listMutasiKeluar({
          lembaga_id: lembagaId ? Number(lembagaId) : undefined,
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
    [pager.page, pager.perPage, pager.sync, lembagaId],
  );

  useEffect(() => {
    if (pager.ready) load(pager.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, lembagaId]);

  const selesaiAksi = useCallback(() => {
    setMutasiRow(null);
    load();
  }, [load]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable<MutasiKeluar>
        tableKey="mutasi_keluar"
        fields={FIELDS}
        rows={rows}
        getValues={gridValues}
        loading={loading}
        emptyText="Belum ada mutasi keluar."
        canEdit={false}
        onCommit={noopCommit}
        onSaved={noopCommit}
        renderActions={() => null}
        addButton={(
          <Button id="btn_mutasi_baru" onClick={() => setPickerOpen(true)}>
            + Mutasi
          </Button>
        )}
        filter={(
          <FilterLembaga
            id="select_lembaga_mutasi"
            value={lembagaId}
            onChange={(v) => { setLembagaId(v); pager.goFirst(); }}
            lembagas={lembagas}
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
        judul="Pilih santri untuk dimutasi"
        onPick={setMutasiRow}
      />
      {mutasiRow && (
        <DialogMutasi row={mutasiRow} onClose={() => setMutasiRow(null)} onDone={selesaiAksi} />
      )}
    </div>
  );
}
