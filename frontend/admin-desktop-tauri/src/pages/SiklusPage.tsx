import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  listAlumni,
  listMutasiKeluar,
  type Alumni,
  type MutasiKeluar,
} from '../api/siklus';
import { listLembaga, listTahunAjaran, type Lembaga, type TahunAjaran } from '../api/master';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import PageHeader, { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';

const MUTASI_FIELDS: ExcelField[] = [
  { key: 'santri', label: 'Santri', width: 200, kind: 'static' },
  { key: 'lembaga', label: 'Lembaga', width: 180, kind: 'static' },
  { key: 'kelas', label: 'Kelas terakhir', width: 130, kind: 'static' },
  { key: 'tanggal', label: 'Tanggal', width: 110, kind: 'static' },
  { key: 'alasan', label: 'Alasan', width: 140, kind: 'static' },
  { key: 'tujuan', label: 'Sekolah tujuan', width: 220, kind: 'static' },
  { key: 'no_surat', label: 'No. surat', width: 140, kind: 'static' },
];

const ALUMNI_FIELDS: ExcelField[] = [
  { key: 'santri', label: 'Santri', width: 200, kind: 'static' },
  { key: 'lembaga', label: 'Lembaga lulus', width: 180, kind: 'static' },
  { key: 'ta', label: 'Tahun lulus', width: 140, kind: 'static' },
  { key: 'ijazah', label: 'No. ijazah', width: 160, kind: 'static' },
  { key: 'tanggal', label: 'Tanggal lulus', width: 120, kind: 'static' },
  { key: 'penyerahan', label: 'Ijazah', width: 100, kind: 'static' },
  { key: 'melanjutkan', label: 'Lanjut', width: 90, kind: 'static' },
];

function mutasiValues(m: MutasiKeluar): Record<string, string | null> {
  return {
    santri: m.santri?.nama_lengkap ?? String(m.santri_id),
    lembaga: m.lembaga?.nama ?? String(m.lembaga_id),
    kelas: m.kelas_terakhir?.nama_kelas ?? String(m.kelas_terakhir_id),
    tanggal: m.tanggal_mutasi,
    alasan: m.alasan_mutasi,
    tujuan: m.nama_sekolah_tujuan,
    no_surat: m.no_surat,
  };
}

function alumniValues(a: Alumni): Record<string, string | null> {
  return {
    santri: a.santri?.nama_lengkap ?? String(a.santri_id),
    lembaga: a.lembaga_lulus?.nama ?? String(a.lembaga_lulus_id),
    ta: a.tahun_ajaran_lulus?.nama ?? String(a.tahun_ajaran_lulus_id),
    ijazah: a.nomor_ijazah,
    tanggal: a.tanggal_lulus,
    penyerahan: a.penyerahan_ijazah,
    melanjutkan: a.melanjutkan,
  };
}

// 102 Siklus: arsip hasil proses (mutasi keluar + alumni).
export default function SiklusPage() {
  const [view, setView] = useState<'mutasi' | 'alumni'>('mutasi');
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [tas, setTas] = useState<TahunAjaran[]>([]);
  const [lembagaId, setLembagaId] = useState('');
  const [taId, setTaId] = useState('');
  const [mutasi, setMutasi] = useState<MutasiKeluar[]>([]);
  const [alumni, setAlumni] = useState<Alumni[]>([]);
  const pager = usePager('siklus');
  const reqRef = useRef(0);
  const lembagaReqRef = useRef(0);
  const taReqRef = useRef(0);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const getValues = useCallback(
    (r: MutasiKeluar | Alumni) =>
      view === 'mutasi' ? mutasiValues(r as MutasiKeluar) : alumniValues(r as Alumni),
    [view],
  );

  const load = useCallback(
    async function loadPage(p = pager.page, pp = pager.perPage) {
      const req = ++reqRef.current;
      setErr('');
      setLoading(true);
      try {
        if (view === 'mutasi') {
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
          setMutasi(res.data);
          setLastPage(res.last_page);
          setTotal(res.total);
        } else {
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
          setAlumni(res.data);
          setLastPage(res.last_page);
          setTotal(res.total);
        }
      } catch (e) {
        if (req === reqRef.current) setErr(errorMessage(e));
      } finally {
        if (req === reqRef.current) setLoading(false);
      }
    },
    [pager.page, pager.perPage, pager.sync, view, lembagaId, taId],
  );

  useEffect(() => {
    if (pager.ready) load(pager.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, view, lembagaId, taId]);

  useEffect(() => {
    const lembagaReq = ++lembagaReqRef.current;
    listLembaga({ per_page: 100 })
      .then((p) => {
        if (lembagaReq !== lembagaReqRef.current) return;
        setLembagas(p.data);
      })
      .catch((e) => {
        if (lembagaReq !== lembagaReqRef.current) return;
        setErr(errorMessage(e));
      });
    const taReq = ++taReqRef.current;
    listTahunAjaran({ per_page: 100 })
      .then((p) => {
        if (taReq !== taReqRef.current) return;
        setTas(p.data);
      })
      .catch(() => {});
  }, []);

  const onSaved = useCallback(() => load(), [load]);
  const onCommit = useCallback(async () => {}, []);
  const renderActions = useCallback(() => null, []);

  return (
    <div className={PAGE_SHELL}>
      <PageHeader titleId="title_siklus" title="Siklus Santri (Mutasi & Alumni)" />
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable<MutasiKeluar | Alumni>
        key={view}
        tableKey={`siklus_${view}`}
        fields={view === 'mutasi' ? MUTASI_FIELDS : ALUMNI_FIELDS}
        rows={view === 'mutasi' ? mutasi : alumni}
        getValues={getValues}
        loading={loading}
        emptyText={view === 'mutasi' ? 'Belum ada mutasi keluar.' : 'Belum ada alumni.'}
        canEdit={false}
        onCommit={onCommit}
        onSaved={onSaved}
        renderActions={renderActions}
        filter={(
          <>
            <Select value={view} onValueChange={(v) => { setView(v as 'mutasi' | 'alumni'); pager.goFirst(); }}>
              <SelectTrigger id="select_jenis_siklus" title="Jenis data" aria-label="Jenis data" size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="mutasi">Mutasi keluar</SelectItem>
                  <SelectItem value="alumni">Alumni</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            {view === 'mutasi' ? (
              <Select value={lembagaId === '' ? '_semua' : lembagaId} onValueChange={(v) => { setLembagaId(v === '_semua' ? '' : v); pager.goFirst(); }}>
                <SelectTrigger id="select_lembaga_siklus" title="Filter lembaga" aria-label="Filter lembaga" size="sm" className="w-40">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="_semua">Semua lembaga</SelectItem>
                    {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nama}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            ) : (
              <Select value={taId === '' ? '_semua' : taId} onValueChange={(v) => { setTaId(v === '_semua' ? '' : v); pager.goFirst(); }}>
                <SelectTrigger id="select_ta_siklus" title="Filter tahun lulus" aria-label="Filter tahun lulus" size="sm" className="w-40">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="_semua">Semua tahun</SelectItem>
                    {tas.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.nama}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
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
