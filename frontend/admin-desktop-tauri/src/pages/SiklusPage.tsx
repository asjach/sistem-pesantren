import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  berhentiJenjang,
  keluarKelas,
  listAlumni,
  listMutasiKeluar,
  listRiwayat,
  type Alumni,
  type MutasiKeluar,
  type RiwayatRow,
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
import { Button } from '@/components/ui/button';
import ExcelTable, { type ExcelField } from '@/components/ExcelTable';
import { PAGE_SHELL, ErrorNotice } from '@/components/PageHeader';
import Pager from '@/components/Pager';
import { usePager } from '@/hooks/usePager';
import { ActionIcon } from '@/components/RowActions';
import ConfirmDelete from '@/components/ConfirmDelete';
import {
  Ban,
  Copy,
  GraduationCap,
  LogOut,
  MoveHorizontal,
  Undo2,
  ChevronUp,
} from '@/icons';
import {
  DialogKelas,
  DialogLulus,
  DialogMutasi,
  DialogNaikKelas,
  DialogSalinGenap,
} from '../components/siklus/SiklusDialogs';
import { toast } from 'sonner';

type View = 'santri' | 'salin' | 'kenaikan' | 'penempatan' | 'mutasi' | 'alumni';
type Baris = RiwayatRow | MutasiKeluar | Alumni;

const ROSTER_VIEWS: View[] = ['santri', 'salin', 'kenaikan', 'penempatan'];

const ROSTER_FIELDS: ExcelField[] = [
  { key: 'santri', label: 'Santri', width: 200, kind: 'static' },
  { key: 'nis', label: 'NIS', width: 100, kind: 'static' },
  { key: 'lembaga', label: 'Lembaga', width: 110, kind: 'static' },
  { key: 'smt', label: 'Smt', width: 60, kind: 'static' },
  { key: 'tingkat', label: 'Tingkat', width: 80, kind: 'static' },
  { key: 'kelas', label: 'Kelas', width: 140, kind: 'static' },
  { key: 'absen', label: 'Absen', width: 70, kind: 'static' },
  { key: 'status', label: 'Status awal', width: 130, kind: 'static' },
  { key: 'masuk', label: 'Tgl masuk', width: 110, kind: 'static' },
];

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

const EMPTY_TEXT: Record<View, string> = {
  santri: 'Tidak ada riwayat aktif pada filter ini.',
  salin: 'Tidak ada baris ganjil (semester 1) aktif.',
  kenaikan: 'Tidak ada baris genap (semester 2) aktif.',
  penempatan: 'Semua santri sudah ditempatkan.',
  mutasi: 'Belum ada mutasi keluar.',
  alumni: 'Belum ada alumni.',
};

function riwayatValues(r: RiwayatRow): Record<string, string | null> {
  return {
    santri: r.santri?.nama_lengkap ?? String(r.santri_id),
    nis: r.nis ?? r.santri?.nis ?? null,
    lembaga: r.lembaga?.kode ?? r.lembaga?.nama ?? String(r.lembaga_id),
    smt: r.semester,
    tingkat: r.tingkat,
    kelas: r.kelas?.nama_kelas ?? '—',
    absen: r.no_absen !== null && r.no_absen !== undefined ? String(r.no_absen) : null,
    status: r.status_awal,
    masuk: r.tgl_masuk ? r.tgl_masuk.slice(0, 10) : null,
  };
}

function mutasiValues(m: MutasiKeluar): Record<string, string | null> {
  return {
    santri: m.santri?.nama_lengkap ?? String(m.santri_id),
    lembaga: m.lembaga?.kode ?? m.lembaga?.nama ?? String(m.lembaga_id),
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
    lembaga: a.lembaga_lulus?.kode ?? a.lembaga_lulus?.nama ?? String(a.lembaga_lulus_id),
    ta: a.tahun_ajaran_lulus?.nama ?? String(a.tahun_ajaran_lulus_id),
    ijazah: a.nomor_ijazah,
    tanggal: a.tanggal_lulus,
    penyerahan: a.penyerahan_ijazah,
    melanjutkan: a.melanjutkan,
  };
}

/** Satu lembaga saja? → id-nya; campuran/kosong → null. */
function lembagaSeragam(rows: RiwayatRow[]): number | null {
  if (rows.length === 0) return null;
  const id = rows[0].lembaga_id;
  return rows.every((r) => r.lembaga_id === id) ? id : null;
}

// 102 Siklus: roster riwayat + salin genap + kenaikan massal + mutasi/lulus + arsip.
export default function SiklusPage() {
  const [view, setView] = useState<View>('santri');
  const [lembagas, setLembagas] = useState<Lembaga[]>([]);
  const [tas, setTas] = useState<TahunAjaran[]>([]);
  const [lembagaId, setLembagaId] = useState('');
  const [taId, setTaId] = useState('');
  const [semester, setSemester] = useState('');
  const [search, setSearch] = useState('');
  const [terapkanCari, setTerapkanCari] = useState('');
  const [riwayat, setRiwayat] = useState<RiwayatRow[]>([]);
  const [mutasi, setMutasi] = useState<MutasiKeluar[]>([]);
  const [alumni, setAlumni] = useState<Alumni[]>([]);
  const [kelasTarget, setKelasTarget] = useState<RiwayatRow[] | null>(null);
  const [salinTarget, setSalinTarget] = useState<{ lembagaId: number; rows: RiwayatRow[] | null } | null>(null);
  const [naikTarget, setNaikTarget] = useState<{ lembagaId: number; rows: RiwayatRow[] } | null>(null);
  const [mutasiRow, setMutasiRow] = useState<RiwayatRow | null>(null);
  const [lulusRow, setLulusRow] = useState<RiwayatRow | null>(null);
  const pager = usePager('siklus');
  const reqRef = useRef(0);
  const lembagaReqRef = useRef(0);
  const taReqRef = useRef(0);
  const clearSelRef = useRef<() => void>(() => {});
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const isRoster = ROSTER_VIEWS.includes(view);

  const getValues = useCallback(
    (r: Baris) => {
      if (isRoster) return riwayatValues(r as RiwayatRow);
      return view === 'mutasi' ? mutasiValues(r as MutasiKeluar) : alumniValues(r as Alumni);
    },
    [isRoster, view],
  );

  const load = useCallback(
    async function loadPage(p = pager.page, pp = pager.perPage) {
      const req = ++reqRef.current;
      setErr('');
      setLoading(true);
      try {
        let res: { data: Baris[]; current_page: number; last_page: number; total: number };
        if (view === 'mutasi') {
          res = await listMutasiKeluar({
            lembaga_id: lembagaId ? Number(lembagaId) : undefined,
            page: p,
            per_page: pp,
          });
        } else if (view === 'alumni') {
          res = await listAlumni({
            tahun_ajaran_lulus_id: taId ? Number(taId) : undefined,
            page: p,
            per_page: pp,
          });
        } else {
          res = await listRiwayat({
            lembaga_id: lembagaId ? Number(lembagaId) : undefined,
            tahun_ajaran_id: taId ? Number(taId) : undefined,
            semester: view === 'salin' ? '1' : view === 'kenaikan' ? '2' : (semester || undefined),
            tanpa_kelas: view === 'penempatan' ? true : undefined,
            q: terapkanCari || undefined,
            page: p,
            per_page: pp,
          });
        }
        if (req !== reqRef.current) return;
        const fix = pager.sync(res.current_page, res.last_page);
        if (fix != null && fix !== p) {
          await loadPage(fix, pp);
          return;
        }
        if (req !== reqRef.current) return;
        if (view === 'mutasi') setMutasi(res.data as MutasiKeluar[]);
        else if (view === 'alumni') setAlumni(res.data as Alumni[]);
        else setRiwayat(res.data as RiwayatRow[]);
        setLastPage(res.last_page);
        setTotal(res.total);
      } catch (e) {
        if (req === reqRef.current) setErr(errorMessage(e));
      } finally {
        if (req === reqRef.current) setLoading(false);
      }
    },
    [pager.page, pager.perPage, pager.sync, view, lembagaId, taId, semester, terapkanCari],
  );

  useEffect(() => {
    if (pager.ready) load(pager.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pager.ready, view, lembagaId, taId, semester, terapkanCari]);

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
  }, []);

  useEffect(() => {
    const taReq = ++taReqRef.current;
    listTahunAjaran({ lembaga_id: lembagaId ? Number(lembagaId) : undefined, per_page: 100 })
      .then((p) => {
        if (taReq !== taReqRef.current) return;
        setTas(p.data);
      })
      .catch(() => {});
  }, [lembagaId]);

  const selesaiAksi = useCallback(() => {
    clearSelRef.current();
    setKelasTarget(null);
    setSalinTarget(null);
    setNaikTarget(null);
    setMutasiRow(null);
    setLulusRow(null);
    load();
  }, [load]);

  const onSaved = useCallback(() => load(), [load]);
  const onCommit = useCallback(async () => {}, []);

  const bukaKelas = useCallback((rows: RiwayatRow[]) => {
    const lembaga = lembagaSeragam(rows);
    if (lembaga === null) {
      toast.error('Pilih satu lembaga dulu (filter) agar kelas tujuan konsisten.');
      return;
    }
    setKelasTarget(rows);
  }, []);

  const bukaSalin = useCallback((rows: RiwayatRow[] | null, fallbackLembagaId?: number) => {
    const lembaga = rows ? lembagaSeragam(rows) : (fallbackLembagaId ?? null);
    if (lembaga === null) {
      toast.error('Pilih lembaga dulu (filter) sebelum salin ke genap.');
      return;
    }
    setSalinTarget({ lembagaId: lembaga, rows });
  }, []);

  const bukaNaik = useCallback((rows: RiwayatRow[]) => {
    const lembaga = lembagaSeragam(rows);
    if (lembaga === null) {
      toast.error('Pilih satu lembaga dulu (filter) agar kenaikan satu batch.');
      return;
    }
    setNaikTarget({ lembagaId: lembaga, rows });
  }, []);

  async function aksiBerhenti(row: RiwayatRow) {
    try {
      await berhentiJenjang(row.santri_id, row.lembaga_id);
      toast.success('Riwayat jenjang dinonaktifkan (berhenti).');
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function aksiKeluarKelas(row: RiwayatRow) {
    try {
      await keluarKelas(row.id);
      toast.success('Santri dikeluarkan dari kelas.');
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const renderActions = useCallback((r: Baris) => {
    if (!isRoster) return null;
    const row = r as RiwayatRow;
    if (view === 'salin') {
      return (
        <ActionIcon id={`btn_salin_genap_${row.id}`} title="Salin ke genap" onClick={() => bukaSalin([row])}>
          <Copy size={16} />
        </ActionIcon>
      );
    }
    if (view === 'kenaikan') {
      return (
        <ActionIcon id={`btn_naik_siklus_${row.id}`} title="Proses kenaikan" onClick={() => bukaNaik([row])}>
          <ChevronUp size={16} />
        </ActionIcon>
      );
    }
    return (
      <>
        <ActionIcon
          id={`btn_kelas_siklus_${row.id}`}
          title={row.kelas_id ? 'Pindah kelas' : 'Tetapkan kelas'}
          onClick={() => bukaKelas([row])}
        >
          <MoveHorizontal size={16} />
        </ActionIcon>
        {view === 'santri' && row.kelas_id !== null && (
          <ConfirmDelete
            title="Keluarkan dari kelas?"
            description={`Penempatan kelas ${row.santri?.nama_lengkap ?? ''} dibatalkan (kelas menjadi kosong, bisa ditempatkan ulang).`}
            confirmLabel="Keluarkan"
            onConfirm={() => aksiKeluarKelas(row)}
          >
            <ActionIcon id={`btn_keluar_kelas_${row.id}`} title="Keluarkan dari kelas">
              <Undo2 size={16} />
            </ActionIcon>
          </ConfirmDelete>
        )}
        {view === 'santri' && (
          <>
            <ActionIcon id={`btn_mutasi_siklus_${row.id}`} title="Mutasi keluar" onClick={() => setMutasiRow(row)}>
              <LogOut size={16} />
            </ActionIcon>
            <ActionIcon id={`btn_lulus_siklus_${row.id}`} title="Kelulusan" onClick={() => setLulusRow(row)}>
              <GraduationCap size={16} />
            </ActionIcon>
            <ConfirmDelete
              title="Berhenti jenjang?"
              description={`Riwayat aktif ${row.santri?.nama_lengkap ?? ''} di ${row.lembaga?.kode ?? row.lembaga?.nama ?? ''} diarsipkan sebagai berhenti; jenjang lain tetap berjalan.`}
              confirmLabel="Berhenti"
              onConfirm={() => aksiBerhenti(row)}
            >
              <ActionIcon id={`btn_berhenti_siklus_${row.id}`} title="Berhenti jenjang">
                <Ban size={16} />
              </ActionIcon>
            </ConfirmDelete>
          </>
        )}
      </>
    );
  }, [isRoster, view, bukaKelas, bukaNaik, bukaSalin]);

  const renderBulkActions = useCallback((checked: Baris[], clear: () => void) => {
    clearSelRef.current = clear;
    if (!isRoster || checked.length === 0) return null;
    const rows = checked as RiwayatRow[];
    if (view === 'salin') {
      return (
        <Button id="btn_bulk_salin_genap" size="sm" onClick={() => bukaSalin(rows)}>
          Salin {rows.length} terpilih ke genap
        </Button>
      );
    }
    if (view === 'kenaikan') {
      return (
        <Button id="btn_bulk_naik_siklus" size="sm" onClick={() => bukaNaik(rows)}>
          Proses kenaikan {rows.length} terpilih
        </Button>
      );
    }
    return (
      <Button id="btn_bulk_kelas_siklus" size="sm" onClick={() => bukaKelas(rows)}>
        {view === 'penempatan' ? `Tetapkan kelas ${rows.length} terpilih` : `Pindah kelas ${rows.length} terpilih`}
      </Button>
    );
  }, [isRoster, view, bukaKelas, bukaNaik, bukaSalin]);

  const rows: Baris[] = isRoster ? riwayat : view === 'mutasi' ? mutasi : alumni;
  const fields = isRoster ? ROSTER_FIELDS : view === 'mutasi' ? MUTASI_FIELDS : ALUMNI_FIELDS;

  return (
    <div className={PAGE_SHELL}>
      <ErrorNotice>{err}</ErrorNotice>
      <ExcelTable<Baris>
        key={view}
        tableKey={`siklus_${view}`}
        fields={fields}
        rows={rows}
        getValues={getValues}
        loading={loading}
        emptyText={EMPTY_TEXT[view]}
        canEdit={false}
        onCommit={onCommit}
        onSaved={onSaved}
        renderActions={renderActions}
        renderBulkActions={renderBulkActions}
        searchValue={isRoster ? search : undefined}
        onSearchChange={isRoster ? setSearch : undefined}
        onSearchSubmit={isRoster ? () => { setTerapkanCari(search.trim()); pager.goFirst(); } : undefined}
        searchPlaceholder={isRoster ? 'Nama / NIS' : undefined}
        searchIds={isRoster ? { form: 'form_cari_siklus', input: 'input_cari_siklus', button: 'btn_cari_siklus' } : undefined}
        addButton={view === 'salin' ? (
          <Button
            id="btn_salin_semua_genap"
            variant="outline"
            onClick={() => bukaSalin(null, lembagaId ? Number(lembagaId) : undefined)}
          >
            Salin semua ganjil
          </Button>
        ) : undefined}
        filter={(
          <>
            <Select value={view} onValueChange={(v) => { setView(v as View); setSearch(''); setTerapkanCari(''); pager.goFirst(); }}>
              <SelectTrigger id="select_jenis_siklus" title="Jenis data" aria-label="Jenis data" size="sm" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="santri">Santri aktif</SelectItem>
                  <SelectItem value="salin">Salin ke genap</SelectItem>
                  <SelectItem value="kenaikan">Kenaikan kelas</SelectItem>
                  <SelectItem value="penempatan">Belum ditempatkan</SelectItem>
                  <SelectItem value="mutasi">Mutasi keluar</SelectItem>
                  <SelectItem value="alumni">Alumni</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            {view !== 'alumni' && (
              <Select
                value={lembagaId === '' ? '_semua' : lembagaId}
                onValueChange={(v) => { setLembagaId(v === '_semua' ? '' : v); setTaId(''); pager.goFirst(); }}
              >
                <SelectTrigger id="select_lembaga_siklus" title="Filter lembaga" aria-label="Filter lembaga" size="sm" className="w-40">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="_semua">Semua lembaga</SelectItem>
                    {lembagas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.kode ?? l.nama}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
            {(view === 'alumni' || isRoster) && (
              <Select value={taId === '' ? '_semua' : taId} onValueChange={(v) => { setTaId(v === '_semua' ? '' : v); pager.goFirst(); }}>
                <SelectTrigger id="select_ta_siklus" title={view === 'alumni' ? 'Filter tahun lulus' : 'Filter tahun ajaran'} aria-label="Filter tahun ajaran" size="sm" className="w-40">
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
            {view === 'santri' && (
              <Select value={semester === '' ? '_semua' : semester} onValueChange={(v) => { setSemester(v === '_semua' ? '' : v); pager.goFirst(); }}>
                <SelectTrigger id="select_semester_siklus" title="Filter semester" aria-label="Filter semester" size="sm" className="w-32">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="_semua">Semua smt</SelectItem>
                    <SelectItem value="1">Semester 1</SelectItem>
                    <SelectItem value="2">Semester 2</SelectItem>
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
      {kelasTarget && (
        <DialogKelas rows={kelasTarget} onClose={() => setKelasTarget(null)} onDone={selesaiAksi} />
      )}
      {salinTarget && (
        <DialogSalinGenap
          lembagaId={salinTarget.lembagaId}
          rows={salinTarget.rows}
          onClose={() => setSalinTarget(null)}
          onDone={selesaiAksi}
        />
      )}
      {naikTarget && (
        <DialogNaikKelas
          lembagaId={naikTarget.lembagaId}
          rows={naikTarget.rows}
          onClose={() => setNaikTarget(null)}
          onDone={selesaiAksi}
        />
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
