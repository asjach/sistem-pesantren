import { useEffect, useState } from 'react';
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import PageHeader, { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';

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
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const mutasiFields: ExcelField[] = [
    { key: 'santri', label: 'Santri', width: 200, kind: 'static' },
    { key: 'lembaga', label: 'Lembaga', width: 180, kind: 'static' },
    { key: 'kelas', label: 'Kelas terakhir', width: 130, kind: 'static' },
    { key: 'tanggal', label: 'Tanggal', width: 110, kind: 'static' },
    { key: 'alasan', label: 'Alasan', width: 140, kind: 'static' },
    { key: 'tujuan', label: 'Sekolah tujuan', width: 220, kind: 'static' },
    { key: 'no_surat', label: 'No. surat', width: 140, kind: 'static' },
  ];

  const alumniFields: ExcelField[] = [
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

  async function load(p = pager.page, pp = pager.perPage) {
    setErr('');
    setLoading(true);
    try {
      if (view === 'mutasi') {
        const res = await listMutasiKeluar({
          lembaga_id: lembagaId ? Number(lembagaId) : undefined,
          page: p,
          per_page: pp,
        });
        const fix = pager.sync(res.current_page, res.last_page);
        if (fix != null && fix !== p) {
          await load(fix, pp);
          return;
        }
        setMutasi(res.data);
        setLastPage(res.last_page);
        setTotal(res.total);
      } else {
        const res = await listAlumni({
          tahun_ajaran_lulus_id: taId ? Number(taId) : undefined,
          page: p,
          per_page: pp,
        });
        const fix = pager.sync(res.current_page, res.last_page);
        if (fix != null && fix !== p) {
          await load(fix, pp);
          return;
        }
        setAlumni(res.data);
        setLastPage(res.last_page);
        setTotal(res.total);
      }
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (pager.ready) load(pager.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, view, lembagaId, taId]);

  useEffect(() => {
    listLembaga({ per_page: 100 }).then((p) => setLembagas(p.data)).catch((e) => setErr(errorMessage(e)));
    listTahunAjaran({ per_page: 100 }).then((p) => setTas(p.data)).catch(() => {});
  }, []);

  return (
    <div className={PAGE_SHELL}>
      <PageHeader titleId="title_siklus" title="Siklus Santri (Mutasi & Alumni)" />
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable<MutasiKeluar | Alumni>
        key={view}
        tableKey={`siklus_${view}`}
        fields={view === 'mutasi' ? mutasiFields : alumniFields}
        rows={view === 'mutasi' ? mutasi : alumni}
        getValues={(r) => (view === 'mutasi' ? mutasiValues(r as MutasiKeluar) : alumniValues(r as Alumni))}
        loading={loading}
        emptyText={view === 'mutasi' ? 'Belum ada mutasi keluar.' : 'Belum ada alumni.'}
        canEdit={false}
        onCommit={async () => {}}
        onSaved={() => load()}
        renderActions={() => null}
        filter={(
          <>
            <Select value={view} onValueChange={(v) => { setView(v as 'mutasi' | 'alumni'); pager.goFirst(); }}>
              <SelectTrigger id="select_jenis_siklus" title="Jenis data" aria-label="Jenis data" className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mutasi">Mutasi keluar</SelectItem>
                <SelectItem value="alumni">Alumni</SelectItem>
              </SelectContent>
            </Select>
            {view === 'mutasi' ? (
              <Select value={lembagaId === '' ? '_semua' : lembagaId} onValueChange={(v) => { setLembagaId(v === '_semua' ? '' : v); pager.goFirst(); }}>
                <SelectTrigger id="select_lembaga_siklus" title="Filter lembaga" aria-label="Filter lembaga" className="h-8 w-40">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_semua">Semua lembaga</SelectItem>
                  {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Select value={taId === '' ? '_semua' : taId} onValueChange={(v) => { setTaId(v === '_semua' ? '' : v); pager.goFirst(); }}>
                <SelectTrigger id="select_ta_siklus" title="Filter tahun lulus" aria-label="Filter tahun lulus" className="h-8 w-40">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_semua">Semua tahun</SelectItem>
                  {tas.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.nama}</SelectItem>)}
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
