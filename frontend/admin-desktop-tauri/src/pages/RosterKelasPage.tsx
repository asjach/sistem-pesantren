import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  berhentiJenjang,
  keluarKelas,
  listRiwayat,
  type RiwayatRow,
} from '../api/siklus';
import ExcelTable from '@/components/ExcelTable';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';
import { ActionIcon } from '@/components/RowActions';
import ConfirmDelete from '@/components/ConfirmDelete';
import { DialogKelas, DialogLulus, DialogMutasi } from '@/components/siklus/SiklusDialogs';
import {
  FilterLembaga,
  FilterSemester,
  FilterTahunAjaran,
  ROSTER_FIELDS,
  noopCommit,
  riwayatValues,
  useLembagaTa,
} from '@/components/siklus/bersama';
import { Ban, GraduationCap, LogOut, MoveHorizontal, Undo2 } from '@/icons';
import { toast } from 'sonner';

/** Roster & Pindah Kelas: santri aktif + aksi lifecycle per-santri. */
export default function RosterKelasPage() {
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
  const [kelasTarget, setKelasTarget] = useState<RiwayatRow[] | null>(null);
  const [mutasiRow, setMutasiRow] = useState<RiwayatRow | null>(null);
  const [lulusRow, setLulusRow] = useState<RiwayatRow | null>(null);
  const pager = usePager('roster_kelas');
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

  const run = useCallback(async (fn: () => Promise<unknown>, sukses: string) => {
    setErr('');
    try {
      await fn();
      toast.success(sukses);
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [load]);

  const selesaiAksi = useCallback(() => {
    setKelasTarget(null);
    setMutasiRow(null);
    setLulusRow(null);
    load();
  }, [load]);

  const renderActions = useCallback((r: RiwayatRow) => (
    <>
      <ActionIcon
        id={`btn_kelas_roster_${r.id}`}
        title={r.kelas_id ? 'Pindah kelas' : 'Tetapkan kelas'}
        onClick={() => setKelasTarget([r])}
      >
        <MoveHorizontal size={16} />
      </ActionIcon>
      {r.kelas_id !== null && (
        <ConfirmDelete
          title="Keluarkan dari kelas?"
          description={`Penempatan kelas ${r.santri?.nama_lengkap ?? ''} dibatalkan (kelas menjadi kosong, bisa ditempatkan ulang).`}
          confirmLabel="Keluarkan"
          onConfirm={() => run(() => keluarKelas(r.id), 'Santri dikeluarkan dari kelas.')}
        >
          <ActionIcon id={`btn_keluar_roster_${r.id}`} title="Keluarkan dari kelas">
            <Undo2 size={16} />
          </ActionIcon>
        </ConfirmDelete>
      )}
      <ActionIcon id={`btn_mutasi_roster_${r.id}`} title="Mutasi keluar" onClick={() => setMutasiRow(r)}>
        <LogOut size={16} />
      </ActionIcon>
      <ActionIcon id={`btn_lulus_roster_${r.id}`} title="Kelulusan" onClick={() => setLulusRow(r)}>
        <GraduationCap size={16} />
      </ActionIcon>
      <ConfirmDelete
        title="Berhenti jenjang?"
        description={`Riwayat aktif ${r.santri?.nama_lengkap ?? ''} di ${r.lembaga?.kode ?? r.lembaga?.nama ?? ''} diarsipkan sebagai berhenti; jenjang lain tetap berjalan.`}
        confirmLabel="Berhenti"
        onConfirm={() => run(() => berhentiJenjang(r.santri_id, r.lembaga_id), 'Riwayat jenjang dihentikan.')}
      >
        <ActionIcon id={`btn_berhenti_roster_${r.id}`} title="Berhenti jenjang">
          <Ban size={16} />
        </ActionIcon>
      </ConfirmDelete>
    </>
  ), [run]);

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable<RiwayatRow>
        tableKey="roster_kelas"
        fields={ROSTER_FIELDS}
        rows={rows}
        getValues={riwayatValues}
        loading={loading}
        emptyText="Tidak ada santri aktif pada filter ini."
        canEdit={false}
        onCommit={noopCommit}
        onSaved={noopCommit}
        renderActions={renderActions}
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => { setTerapkanCari(search.trim()); pager.goFirst(); }}
        searchPlaceholder="Nama / NIS"
        searchIds={{ form: 'form_cari_roster_kelas', input: 'input_cari_roster_kelas', button: 'btn_cari_roster_kelas' }}
        filter={(
          <>
            <FilterLembaga
              id="select_lembaga_roster_kelas"
              value={lembagaId}
              onChange={(v) => { setLembagaId(v); setTaId(''); pager.goFirst(); }}
              lembagas={lembagas}
            />
            <FilterTahunAjaran
              id="select_ta_roster_kelas"
              value={taId}
              onChange={(v) => { setTaId(v); pager.goFirst(); }}
              tas={tas}
            />
            <FilterSemester
              id="select_semester_roster_kelas"
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

      {kelasTarget && (
        <DialogKelas rows={kelasTarget} onClose={() => setKelasTarget(null)} onDone={selesaiAksi} />
      )}
      {mutasiRow && (
        <DialogMutasi row={mutasiRow} onClose={() => setMutasiRow(null)} onDone={selesaiAksi} />
      )}
      {lulusRow && (
        <DialogLulus row={lulusRow} onClose={() => setLulusRow(null)} onDone={selesaiAksi} />
      )}
    </div>
  );
}
